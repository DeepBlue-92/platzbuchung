import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TIME_SLOTS } from '../constants';
import { User, Booking, LeagueMatch } from '../types';
import { resolvePlayerDisplayName } from '../utils/playerHelper';
import { getCanonicalClubId, KNOWN_CLUBS_STAMMDATEN } from '../lib/userUtils';

export interface PlayerCandidate {
  id?: string;
  userId?: string;
  name?: string;
  klarname?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}

export interface PlayerCollision {
  hasCollision: boolean;
  conflictingPlayerName: string;
  conflictingPlayerId?: string;
  existingStartTime: string;
  existingEndTime: string;
  court: string;
  facilityName?: string;
  sourceType: 'booking' | 'league_match';
  errorMessage: string;
}

export interface CollisionCheckParams {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  players: Array<PlayerCandidate | User | string>;
  editingBookingId?: string;
  editingGroupToken?: string;
  editingMatchId?: string;
  currentClubId?: string;
  currentClubBookings?: Booking[];
  knownClubIds?: string[];
}

/**
 * Standard overlap formula:
 * (neuerStart < bestehenderEnde) UND (neuerEnde > bestehenderStart)
 */
export function isTimeOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean {
  return newStart < existingEnd && newEnd > existingStart;
}

/**
 * Calculates end time for a given time slot.
 * Default single slot duration is 1 hour in TIME_SLOTS.
 */
export function getSlotEndTime(time: string): string {
  const idx = TIME_SLOTS.indexOf(time);
  if (idx !== -1 && idx + 1 < TIME_SLOTS.length) {
    return TIME_SLOTS[idx + 1];
  }
  const [h, m] = time.split(':').map(Number);
  const nextH = Math.min(23, (h || 0) + 1);
  return `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * Normalizes a string for comparison (lowercase, trimmed, stripped punctuation/spaces).
 */
function normalizeStr(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.,()]/g, '');
}

/**
 * Checks whether a candidate player matches an appointment player string or ID.
 */
function isPlayerMatch(
  target: PlayerCandidate,
  rawPlayerString: string,
  bookedByUserId?: string
): boolean {
  const normRaw = normalizeStr(rawPlayerString);
  const targetId = target.id || target.userId;

  // 1. Direct user ID match
  if (targetId && (rawPlayerString === targetId || bookedByUserId === targetId)) {
    return true;
  }

  // 2. Normalized name match
  if (target.name && normRaw === normalizeStr(target.name)) {
    return true;
  }
  if (target.klarname && normRaw === normalizeStr(target.klarname)) {
    return true;
  }
  if (target.displayName && normRaw === normalizeStr(target.displayName)) {
    return true;
  }

  // 3. First + Last name match
  if (target.firstName || target.lastName) {
    const fullName = `${target.firstName || ''} ${target.lastName || ''}`.trim();
    if (fullName && normRaw === normalizeStr(fullName)) {
      return true;
    }
    const reverseFullName = `${target.lastName || ''} ${target.firstName || ''}`.trim();
    if (reverseFullName && normRaw === normalizeStr(reverseFullName)) {
      return true;
    }
  }

  // 4. Username match
  if (target.username && normRaw === normalizeStr(target.username)) {
    return true;
  }

  // 5. Email or email prefix match
  if (target.email) {
    if (normRaw === normalizeStr(target.email)) {
      return true;
    }
    const prefix = target.email.split('@')[0];
    if (prefix && normRaw === normalizeStr(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves a friendly display name for the player candidate.
 */
export function getPlayerCandidateDisplayName(p: PlayerCandidate | User | string): string {
  if (typeof p === 'string') {
    return p;
  }
  return resolvePlayerDisplayName(p as any, p.name || p.id);
}

/**
 * Converts any player input into a standard PlayerCandidate object.
 */
export function toPlayerCandidate(
  p: PlayerCandidate | User | string,
  usersRecord?: Record<string, User>
): PlayerCandidate {
  if (typeof p === 'string') {
    const trimmed = p.trim();
    // Check if it's a known userId in usersRecord
    if (usersRecord && usersRecord[trimmed]) {
      const u = usersRecord[trimmed];
      return {
        id: u.id,
        userId: u.id,
        name: u.name,
        klarname: (u as any).klarname,
        displayName: (u as any).displayName,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        email: u.email,
      };
    }
    // Check by name in usersRecord
    if (usersRecord) {
      const found = Object.values(usersRecord).find(
        (u) =>
          normalizeStr(u.name) === normalizeStr(trimmed) ||
          normalizeStr(`${u.firstName || ''} ${u.lastName || ''}`.trim()) === normalizeStr(trimmed) ||
          normalizeStr((u as any).klarname) === normalizeStr(trimmed)
      );
      if (found) {
        return {
          id: found.id,
          userId: found.id,
          name: found.name,
          klarname: (found as any).klarname,
          displayName: (found as any).displayName,
          firstName: found.firstName,
          lastName: found.lastName,
          username: found.username,
          email: found.email,
        };
      }
    }
    return { name: trimmed };
  }

  return {
    id: p.id || (p as any).userId,
    userId: (p as any).userId || p.id,
    name: p.name,
    klarname: (p as any).klarname,
    displayName: (p as any).displayName,
    firstName: (p as any).firstName,
    lastName: (p as any).lastName,
    username: (p as any).username,
    email: (p as any).email,
  };
}

export interface ConsolidatedBooking {
  id: string;
  groupToken?: string;
  date: string;
  startTime: string;
  endTime: string;
  court: string;
  clubId: string;
  clubName?: string;
  players: string[];
  bookedBy?: string;
  userId?: string;
  isLeagueBooking?: boolean;
}

/**
 * Consolidates slot-by-slot bookings into continuous time ranges per court & player group.
 */
export function consolidateBookings(
  bookings: Booking[],
  clubId: string,
  clubName?: string
): ConsolidatedBooking[] {
  if (!bookings || bookings.length === 0) return [];

  // Exclude administrative pure locks that have no players
  const playerBookings = bookings.filter((b) => {
    if (b.isLocked && !b.isEvent && (!b.players || b.players.length === 0)) {
      return false;
    }
    return true;
  });

  // Sort by court, then time
  const sorted = [...playerBookings].sort((a, b) => {
    if (a.court !== b.court) return a.court.localeCompare(b.court);
    return a.time.localeCompare(b.time);
  });

  const consolidated: ConsolidatedBooking[] = [];

  for (const b of sorted) {
    const slotStart = b.time;
    const slotEnd = getSlotEndTime(b.time);
    const rawPlayers = Array.isArray(b.players) ? b.players : [];
    const bId = b.id || '';
    const groupToken = b.group_token;

    // Check if this slot extends the previous consolidated booking on the same court
    const prev = consolidated[consolidated.length - 1];
    const canMerge =
      prev &&
      prev.court === b.court &&
      prev.date === b.date &&
      prev.endTime === slotStart &&
      ((groupToken && prev.groupToken === groupToken) ||
        (JSON.stringify(prev.players.slice().sort()) === JSON.stringify(rawPlayers.slice().sort())));

    if (canMerge) {
      prev.endTime = slotEnd;
      if (!prev.groupToken && groupToken) prev.groupToken = groupToken;
    } else {
      consolidated.push({
        id: bId,
        groupToken,
        date: b.date,
        startTime: slotStart,
        endTime: slotEnd,
        court: b.court,
        clubId,
        clubName,
        players: rawPlayers,
        bookedBy: b.bookedBy,
        userId: (b as any).userId,
        isLeagueBooking: (b as any).isLeagueBooking || b.comment?.includes('[Ligaspiel]'),
      });
    }
  }

  return consolidated;
}

/**
 * Formats the exact error message required by user specifications:
 * "Buchung nicht möglich: [Spielername] ist im gewählten Zeitraum ([Startzeit] - [Endzeit] Uhr) bereits in einem anderen Spiel auf Platz [X] gebucht."
 */
export function formatCollisionMessage(
  playerName: string,
  startTime: string,
  endTime: string,
  court: string,
  facilityName?: string,
  currentClubId?: string
): string {
  let courtDisplay = court;
  if (facilityName && currentClubId) {
    const normCur = getCanonicalClubId(currentClubId);
    const normFac = getCanonicalClubId(facilityName);
    if (normCur !== normFac) {
      courtDisplay = `${court} (${facilityName})`;
    }
  }
  return `Buchung nicht möglich: ${playerName} ist im gewählten Zeitraum (${startTime} - ${endTime} Uhr) bereits in einem anderen Spiel auf ${courtDisplay} gebucht.`;
}

// In-memory cache for cross-club data on a given date to keep UI interactions blazing fast
const dateCache = new Map<
  string,
  {
    timestamp: number;
    matches: LeagueMatch[];
    bookingsByClub: Record<string, Booking[]>;
  }
>();

/**
 * Fetches all scheduled league matches and club bookings for a given date.
 * Cached for 5 seconds to prevent redundant round-trips during rapid UI adjustments.
 */
export async function fetchCrossClubAppointments(
  date: string,
  knownClubIds?: string[]
): Promise<{ matches: LeagueMatch[]; bookingsByClub: Record<string, Booking[]> }> {
  const cached = dateCache.get(date);
  if (cached && Date.now() - cached.timestamp < 5000) {
    return { matches: cached.matches, bookingsByClub: cached.bookingsByClub };
  }

  const allClubsToQuery = Array.from(
    new Set([
      'sv-neuhausen',
      'djk-furth',
      'tcsportsgeist',
      ...(knownClubIds || []).map(getCanonicalClubId),
    ])
  ).filter(Boolean);

  // 1. Fetch scheduled league matches for this date
  let matches: LeagueMatch[] = [];
  try {
    const qMatches = query(
      collection(db, 'league_matches'),
      where('scheduledDate', '==', date)
    );
    const snapMatches = await getDocs(qMatches);
    snapMatches.forEach((d) => {
      const m = { ...d.data(), id: d.id } as LeagueMatch;
      if (m.status !== 'cancelled') {
        matches.push(m);
      }
    });
  } catch (err) {
    console.warn('Failed to query league_matches for collision check:', err);
  }

  // 2. Fetch bookings across all active clubs for this date
  const bookingsByClub: Record<string, Booking[]> = {};
  await Promise.all(
    allClubsToQuery.map(async (cId) => {
      try {
        const qBookings = query(
          collection(db, 'vereine', cId, 'bookings'),
          where('date', '==', date)
        );
        const snap = await getDocs(qBookings);
        const list: Booking[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Booking);
        });
        bookingsByClub[cId] = list;
      } catch (err) {
        // Silent fallback - club may be unreachable or empty
        bookingsByClub[cId] = [];
      }
    })
  );

  const result = { matches, bookingsByClub };
  dateCache.set(date, { timestamp: Date.now(), ...result });
  return result;
}

/**
 * Synchronous player collision checker using available in-memory data.
 * Ideal for real-time validation inside modals, sliders, and form renders.
 */
export function checkPlayerCollisionSync(
  params: CollisionCheckParams,
  availableMatches: LeagueMatch[],
  availableBookingsByClub: Record<string, Booking[]>
): PlayerCollision | null {
  const {
    date,
    startTime: newStart,
    endTime: newEnd,
    players,
    editingBookingId,
    editingGroupToken,
    editingMatchId,
    currentClubId,
  } = params;

  if (!date || !newStart || !newEnd || !players || players.length === 0) {
    return null;
  }

  const candidates = players
    .map((p) => toPlayerCandidate(p))
    .filter((p) => Boolean(p.id || p.userId || p.name || p.firstName));

  if (candidates.length === 0) return null;

  // 1. Check League Matches
  for (const match of availableMatches) {
    if (match.scheduledDate !== date) continue;
    if (match.status === 'cancelled') continue;
    if (editingMatchId && match.id === editingMatchId) continue;

    const mStart = match.scheduledStartTime;
    const mEnd = match.scheduledEndTime;
    if (!mStart || !mEnd) continue;

    // Time-Overlap check: (neuerStart < bestehenderEnde) UND (neuerEnde > bestehenderStart)
    if (!isTimeOverlap(newStart, newEnd, mStart, mEnd)) {
      continue;
    }

    // Check if any candidate player is involved in this match
    for (const candidate of candidates) {
      const isPlayer1 =
        (candidate.id && (match.player1Id === candidate.id || match.player1UserId === candidate.id)) ||
        (candidate.name && normalizeStr(match.player1Id) === normalizeStr(candidate.name));
      const isPlayer2 =
        (candidate.id && (match.player2Id === candidate.id || match.player2UserId === candidate.id)) ||
        (candidate.name && normalizeStr(match.player2Id) === normalizeStr(candidate.name));

      if (isPlayer1 || isPlayer2) {
        const playerName = getPlayerCandidateDisplayName(candidate);
        const facilityName =
          match.facilityName ||
          match.clubName ||
          KNOWN_CLUBS_STAMMDATEN[getCanonicalClubId(match.clubId)]?.clubName ||
          match.clubId ||
          'Verein';
        const courtName = match.court || 'Platz';

        return {
          hasCollision: true,
          conflictingPlayerName: playerName,
          conflictingPlayerId: candidate.id || candidate.userId,
          existingStartTime: mStart,
          existingEndTime: mEnd,
          court: courtName,
          facilityName,
          sourceType: 'league_match',
          errorMessage: formatCollisionMessage(
            playerName,
            mStart,
            mEnd,
            courtName,
            facilityName,
            currentClubId
          ),
        };
      }
    }
  }

  // 2. Check Club Bookings across all available clubs
  for (const [clubId, bookings] of Object.entries(availableBookingsByClub)) {
    const clubMeta = KNOWN_CLUBS_STAMMDATEN[getCanonicalClubId(clubId)];
    const clubName = clubMeta?.clubName || clubId;
    const consolidated = consolidateBookings(bookings, clubId, clubName);

    for (const item of consolidated) {
      if (item.date !== date) continue;

      // Skip the booking currently being edited
      if (editingBookingId && item.id === editingBookingId) continue;
      if (editingGroupToken && item.groupToken === editingGroupToken) continue;

      // Time-Overlap check: (neuerStart < bestehenderEnde) UND (neuerEnde > bestehenderStart)
      if (!isTimeOverlap(newStart, newEnd, item.startTime, item.endTime)) {
        continue;
      }

      // Check if any candidate player is involved in this booking
      for (const candidate of candidates) {
        const matchesPlayer = item.players.some((pStr) =>
          isPlayerMatch(candidate, pStr, item.bookedBy || item.userId)
        );
        const matchesBookedBy =
          candidate.id && (item.bookedBy === candidate.id || item.userId === candidate.id);

        if (matchesPlayer || matchesBookedBy) {
          const playerName = getPlayerCandidateDisplayName(candidate);
          return {
            hasCollision: true,
            conflictingPlayerName: playerName,
            conflictingPlayerId: candidate.id || candidate.userId,
            existingStartTime: item.startTime,
            existingEndTime: item.endTime,
            court: item.court,
            facilityName: item.clubName || clubName,
            sourceType: 'booking',
            errorMessage: formatCollisionMessage(
              playerName,
              item.startTime,
              item.endTime,
              item.court,
              item.clubName || clubName,
              currentClubId
            ),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Asynchronous player collision checker.
 * Fetches cross-club appointments dynamically and executes the collision validation.
 */
export async function checkPlayerCollisionAsync(
  params: CollisionCheckParams
): Promise<PlayerCollision | null> {
  const { date, currentClubId, currentClubBookings, knownClubIds } = params;

  // Fetch cross-club appointments
  const { matches, bookingsByClub } = await fetchCrossClubAppointments(
    date,
    knownClubIds
  );

  // If current club bookings were passed from local state, merge them to have the freshest data
  if (currentClubId && currentClubBookings && currentClubBookings.length > 0) {
    const cKey = getCanonicalClubId(currentClubId);
    bookingsByClub[cKey] = currentClubBookings;
  }

  return checkPlayerCollisionSync(params, matches, bookingsByClub);
}
