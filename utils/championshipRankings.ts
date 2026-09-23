import { Participant, TournamentInstance } from '../types/championship';
import { RankingState, User } from '../types';

/**
 * Checks if a tournament has ranking consideration active (useRankings === true)
 * and resolves the 1-based ranking position of a participant.
 */
export function getParticipantRanking(
  participantId: string | null | undefined,
  tournament: TournamentInstance,
  rankings: RankingState | null | undefined,
  users: Record<string, User> = {}
): number | null {
  if (!tournament?.useRankings || !participantId || !rankings?.categories) {
    return null;
  }

  const participantList = tournament.participants || [];
  const participant = participantList.find((p) => p && p.id === participantId);
  const playerIds = participant?.playerIds && participant.playerIds.length > 0
    ? participant.playerIds
    : [participantId];

  // Resolve target player ID (for singles it's the primary player)
  const targetId = playerIds[0];
  if (!targetId) return null;

  // Resolve target User object if available
  const targetUser = users[targetId] || Object.values(users).find((u) =>
    u.id === targetId ||
    u.name?.toLowerCase() === targetId.toLowerCase() ||
    (u.klarname && u.klarname.toLowerCase() === targetId.toLowerCase()) ||
    `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase() === targetId.toLowerCase()
  );

  const targetNames = new Set<string>();
  targetNames.add(targetId.toLowerCase().trim());
  if (targetUser) {
    if (targetUser.id) targetNames.add(targetUser.id.toLowerCase().trim());
    if (targetUser.name) targetNames.add(targetUser.name.toLowerCase().trim());
    if (targetUser.username) targetNames.add(targetUser.username.toLowerCase().trim());
    if (targetUser.klarname) targetNames.add(targetUser.klarname.toLowerCase().trim());
    const fullName = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();
    if (fullName) targetNames.add(fullName.toLowerCase());
  }

  // Iterate categories to find entry
  for (const category of rankings.categories) {
    const entries = category.entries || [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      const entryName = (entry.userName || '').toLowerCase().trim();
      const entryId = (entry.id || '').toLowerCase().trim();

      if (entryId && targetNames.has(entryId)) return i + 1;
      if (entryName && targetNames.has(entryName)) return i + 1;

      const entryUser = users[entry.userName] || Object.values(users).find((u) =>
        u.id === entry.userName ||
        u.name?.toLowerCase() === entryName ||
        (u.klarname && u.klarname.toLowerCase() === entryName) ||
        `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase() === entryName
      );

      if (entryUser && targetUser && entryUser.id === targetUser.id) {
        return i + 1;
      }
    }
  }

  return null;
}
