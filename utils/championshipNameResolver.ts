import { Participant } from '../types/championship';
import { User } from '../types';

/**
 * Checks if a string looks like an auto-generated Firestore document ID or Firebase Auth UID
 * (e.g. 20-36 chars alphanumeric string without spaces)
 */
export function isRawIdentifier(str: string): boolean {
  if (!str) return false;
  const clean = str.trim();
  // Standard Firebase 20+ alphanumeric UID/DocID (e.g. "4lYk6PYPmZhJcQSlVttVsQpylvV2", "2dTdoZB...")
  if (clean.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(clean) && !clean.includes(' ')) {
    return true;
  }
  // Standard UUID format
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Turns an email address or technical username into a clean, human-readable name
 * e.g. "hujubussunnah32@gmail.com" -> "Hujubussunnah 32"
 * e.g. "max.mustermann" -> "Max Mustermann"
 */
export function formatFallbackName(raw: string): string {
  if (!raw) return 'Mitglied';
  let text = raw;
  if (text.includes('@')) {
    text = text.split('@')[0];
  }
  // Replace underscores, dots, hyphens, and separate numbers from letters
  const cleaned = text
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!cleaned) return 'Mitglied';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves a single player's display name using the users lookup map and fallback logic.
 */
export function resolvePlayerDisplayName(
  playerId: string,
  users?: Record<string, User>,
  cachedDisplayName?: string
): string {
  if (!playerId) return 'Noch offen (TBD)';

  // 1. Check users registry
  if (users && typeof users === 'object') {
    // A) Direct key lookup
    let user = users[playerId] || users[playerId.toLowerCase().replace(/\s/g, '')];

    // B) Search in users by id, username, email, klarname, or authUid
    if (!user) {
      const userList = Object.values(users);
      user = userList.find(
        (u) =>
          u.id === playerId ||
          (u as any).authUid === playerId ||
          u.username === playerId ||
          u.name === playerId ||
          u.email === playerId ||
          (u.email && u.email.toLowerCase() === playerId.toLowerCase())
      );
    }

    if (user) {
      const first = (user.firstName || '').trim();
      const last = (user.lastName || '').trim();
      if (first && last) return `${first} ${last}`;
      if (first) return first;
      if (last) return last;
      if (user.klarname && !isRawIdentifier(user.klarname)) return user.klarname.trim();
      if (user.name && !isRawIdentifier(user.name)) {
        return formatFallbackName(user.name);
      }
      if (user.email) return formatFallbackName(user.email);
    }
  }

  // 2. Check cached display name on participant
  if (cachedDisplayName && !isRawIdentifier(cachedDisplayName)) {
    return cachedDisplayName.trim();
  }

  // 3. If playerId is an email address
  if (playerId.includes('@')) {
    return formatFallbackName(playerId);
  }

  // 4. If playerId is a raw ID (e.g. Firebase UID), don't show the raw hash!
  if (isRawIdentifier(playerId)) {
    return 'Mitglied';
  }

  // 5. If it's a readable handle
  return formatFallbackName(playerId);
}

/**
 * Resolves a Participant object into a full name (e.g. "Max Mustermann" or "Max / Anna" for doubles).
 */
export function resolveParticipantDisplayName(
  participant?: Participant | null,
  users?: Record<string, User>
): string {
  if (!participant) return 'Noch offen (TBD)';
  if (!participant.playerIds || participant.playerIds.length === 0) {
    if (participant.displayNames && participant.displayNames.length > 0) {
      const names = participant.displayNames.filter((n) => !isRawIdentifier(n));
      if (names.length > 0) return names.join(' / ');
    }
    return 'Noch offen (TBD)';
  }

  return participant.playerIds
    .map((pId, idx) => {
      const cached = participant.displayNames?.[idx];
      return resolvePlayerDisplayName(pId, users, cached);
    })
    .join(' / ');
}

/**
 * Finds a participant by ID in a participants array and formats their name.
 */
export function formatParticipantById(
  participantId: string | null | undefined,
  participants: Participant[] | any = [],
  users?: Record<string, User>
): string {
  if (!participantId) return 'Noch offen (TBD)';

  const list: Participant[] = Array.isArray(participants)
    ? participants
    : participants && typeof participants === 'object' && Array.isArray(participants.participants)
    ? participants.participants
    : [];

  const p = list.find((x) => x && x.id === participantId);
  if (!p) {
    return resolvePlayerDisplayName(participantId, users);
  }
  return resolveParticipantDisplayName(p, users);
}
