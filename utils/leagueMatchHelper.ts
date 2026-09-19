import { LeagueMatch, User } from '../types';

/**
 * Checks if a match is currently in the provisional 24-hour verification window.
 */
export function isMatchProvisional(match?: LeagueMatch | null): boolean {
  if (!match) return false;
  if (match.isProvisional === false) return false;
  if (match.provisionalUntil) {
    return new Date(match.provisionalUntil).getTime() > Date.now();
  }
  return !!match.isProvisional;
}

/**
 * Returns human-readable remaining time text for a provisional match.
 */
export function getProvisionalRemainingText(match?: LeagueMatch | null): string {
  if (!match?.provisionalUntil) return 'Vorläufig (24h Prüffrist)';
  const diffMs = new Date(match.provisionalUntil).getTime() - Date.now();
  if (diffMs <= 0) return 'Prüffrist abgelaufen';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `Noch ${hours} Std. änderbar`;
  }
  return `Noch ${Math.max(1, minutes)} Min. änderbar`;
}

/**
 * Determines whether a user has permission to edit or cancel a reported match result.
 */
export function canUserEditOrCancelResult(
  match?: LeagueMatch | null,
  userId?: string,
  userRole?: string
): { canEdit: boolean; canCancel: boolean; reason?: string } {
  if (!match) return { canEdit: false, canCancel: false, reason: 'Kein Match' };

  const isAdmin = userRole === 'admin' || userRole === 'SUPER_ADMIN';
  if (isAdmin) {
    return { canEdit: true, canCancel: true };
  }

  if (!userId) {
    return { canEdit: false, canCancel: false, reason: 'Nicht angemeldet' };
  }

  const isParticipant =
    match.player1UserId === userId ||
    match.player2UserId === userId ||
    match.player1Id === userId ||
    match.player2Id === userId;

  if (!isParticipant) {
    return { canEdit: false, canCancel: false, reason: 'Nicht an dieser Partie beteiligt' };
  }

  const provisional = isMatchProvisional(match);
  if (provisional) {
    return { canEdit: true, canCancel: true };
  }

  return {
    canEdit: false,
    canCancel: false,
    reason: 'Die 24-stündige Frist zur Bearbeitung ist abgelaufen. Bitte wende dich an einen Administrator.',
  };
}

/**
 * Checks whether a user can enter a match result for a scheduled match.
 */
export function canUserEnterResult(
  match: LeagueMatch,
  userId: string,
  userRole?: string
): { allowed: boolean; reason?: string } {
  if (!match) return { allowed: false, reason: 'Kein Match vorhanden' };
  if (match.status === 'completed' || match.result) {
    return { allowed: false, reason: 'Ergebnis bereits eingetragen' };
  }
  if (match.status === 'cancelled') {
    return { allowed: false, reason: 'Match wurde abgesagt' };
  }

  const isAdmin = userRole === 'admin' || userRole === 'SUPER_ADMIN';
  const isParticipant =
    match.player1UserId === userId ||
    match.player2UserId === userId ||
    match.player1Id === userId ||
    match.player2Id === userId;

  if (!isAdmin && !isParticipant) {
    return { allowed: false, reason: 'Nur beteiligte Spieler oder Admins können das Ergebnis erfassen.' };
  }

  return { allowed: true };
}

/**
 * Checks whether a scheduled match has reached its start time.
 */
export function isMatchStarted(match?: LeagueMatch | null): boolean {
  if (!match?.scheduledDate) return false;
  const timeStr = match.scheduledStartTime || '00:00';
  const matchDateTime = new Date(`${match.scheduledDate}T${timeStr}`);
  if (isNaN(matchDateTime.getTime())) return false;
  return Date.now() >= matchDateTime.getTime();
}

/**
 * Checks whether a scheduled match has expired (past its scheduled end time or 2 hours past start time).
 */
export function isMatchExpired(match?: LeagueMatch | null): boolean {
  if (!match?.scheduledDate) return false;
  
  if (match.scheduledEndTime) {
    const endDateTime = new Date(`${match.scheduledDate}T${match.scheduledEndTime}`);
    if (!isNaN(endDateTime.getTime())) {
      return Date.now() > endDateTime.getTime();
    }
  }

  const timeStr = match.scheduledStartTime || '00:00';
  const startDateTime = new Date(`${match.scheduledDate}T${timeStr}`);
  if (!isNaN(startDateTime.getTime())) {
    // If no end time, assume it expires 2 hours after start time
    return Date.now() > startDateTime.getTime() + 2 * 60 * 60 * 1000;
  }
  
  return false;
}

/**
 * Formats court and facility information for display.
 */
export function formatMatchCourtAndFacility(
  match?: LeagueMatch | null,
  fallbackFacility?: string
): string {
  if (!match) return fallbackFacility || '';
  const court = match.court?.trim();
  const facility = match.facilityName?.trim() || match.clubName?.trim() || fallbackFacility?.trim();

  if (court && facility && court !== facility) {
    return `${court} · ${facility}`;
  }
  return court || facility || 'Platz n.V.';
}

/**
 * Formats match time span (e.g., "18:00 – 19:30 Uhr").
 */
export function formatMatchTimeSpan(match?: LeagueMatch | null): string {
  if (!match) return '';
  const start = match.scheduledStartTime?.trim();
  const end = match.scheduledEndTime?.trim();
  if (start && end) {
    return `${start} – ${end} Uhr`;
  }
  if (start) {
    return `${start} Uhr`;
  }
  return 'Uhrzeit n.V.';
}

/**
 * Generates uppercase 1-2 letter initials from a display name or user object.
 * e.g. "Niklas Manns" -> "NM", "Thomas Klein" -> "TK", "Patrick" -> "PA"
 */
export function getPlayerInitials(name: string, user?: Partial<User> | null): string {
  if (user?.firstName && user?.lastName) {
    const fn = user.firstName.trim();
    const ln = user.lastName.trim();
    if (fn && ln) {
      return (fn[0] + ln[0]).toUpperCase();
    }
  }

  const clean = (name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!clean) return '';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0] || '').toUpperCase();
}

/**
 * Enriches a LeagueMatch with complete player1 and player2 data objects,
 * including avatarUrl, avatarIcon, initials, name, and user details.
 */
export function enrichMatchWithPlayerData(
  match: LeagueMatch,
  getUserObject?: (userId: string) => User | null,
  getUserName?: (userId: string) => string
): LeagueMatch {
  if (!match) return match;

  const p1Id = match.player1UserId || match.player1Id || '';
  const p2Id = match.player2UserId || match.player2Id || '';

  const p1User = getUserObject ? getUserObject(p1Id) : null;
  const p2User = getUserObject ? getUserObject(p2Id) : null;

  const p1Name =
    (getUserName ? getUserName(p1Id) : '') ||
    (p1User ? `${p1User.firstName || ''} ${p1User.lastName || ''}`.trim() || p1User.name : '') ||
    'Spieler 1';

  const p2Name =
    (getUserName ? getUserName(p2Id) : '') ||
    (p2User ? `${p2User.firstName || ''} ${p2User.lastName || ''}`.trim() || p2User.name : '') ||
    'Spieler 2';

  const player1 = {
    ...p1User,
    id: p1Id,
    name: p1Name,
    avatarUrl: p1User?.avatarUrl || (match.player1 as any)?.avatarUrl || null,
    avatarIcon: p1User?.avatarIcon || (match.player1 as any)?.avatarIcon || null,
    initials: getPlayerInitials(p1Name, p1User) || (match.player1 as any)?.initials || '',
  };

  const player2 = {
    ...p2User,
    id: p2Id,
    name: p2Name,
    avatarUrl: p2User?.avatarUrl || (match.player2 as any)?.avatarUrl || null,
    avatarIcon: p2User?.avatarIcon || (match.player2 as any)?.avatarIcon || null,
    initials: getPlayerInitials(p2Name, p2User) || (match.player2 as any)?.initials || '',
  };

  return {
    ...match,
    player1,
    player2,
  };
}
