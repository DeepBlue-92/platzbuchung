import { Match, Participant, TournamentInstance } from '../types/championship';
import { User, Role } from '../types';

/**
 * Checks whether the current user has superadmin or admin privileges.
 * Admins and superadmins are allowed to edit any match at any time.
 */
export function isChampionshipAdmin(user?: User | null): boolean {
  if (!user) return false;
  const role = (user.role as any)?.toString().toLowerCase().trim();
  return (
    role === 'admin' ||
    role === Role.ADMIN ||
    role === 'superadmin' ||
    role === 'super-admin' ||
    role === 'super_admin' ||
    role === Role.SUPER_ADMIN ||
    Boolean((user as any).isSuperAdmin) ||
    Boolean((user as any).superAdmin)
  );
}

/**
 * Checks if a user matches a given identifier (ID, username, auth UID, full name, or email).
 */
function isUserMatch(idOrName: string | null | undefined, user: User): boolean {
  if (!idOrName) return false;
  const target = idOrName.trim().toLowerCase();
  const targetNoSpaces = target.replace(/\s+/g, '');

  if (user.id && user.id.trim().toLowerCase() === target) return true;
  if ((user as any).authUid && (user as any).authUid.trim().toLowerCase() === target) return true;
  if (user.email && user.email.trim().toLowerCase() === target) return true;

  if (user.name) {
    const nameLower = user.name.trim().toLowerCase();
    if (nameLower === target) return true;
    if (nameLower.replace(/\s+/g, '') === targetNoSpaces) return true;
  }

  if (user.firstName && user.lastName) {
    const fullName = `${user.firstName} ${user.lastName}`.trim().toLowerCase();
    if (fullName === target) return true;
    if (fullName.replace(/\s+/g, '') === targetNoSpaces) return true;
  }

  return false;
}

/**
 * Checks if a user is part of a participant object (singles or doubles).
 */
export function isUserInParticipant(
  participant: Participant | null | undefined,
  user: User | null | undefined
): boolean {
  if (!participant || !user) return false;

  // Direct participant ID check
  if (isUserMatch(participant.id, user)) return true;

  // Check playerIds (primary array)
  if (Array.isArray(participant.playerIds)) {
    for (const pId of participant.playerIds) {
      if (isUserMatch(pId, user)) return true;
    }
  }

  // Check displayNames (fallback cached names)
  if (Array.isArray(participant.displayNames)) {
    for (const name of participant.displayNames) {
      if (isUserMatch(name, user)) return true;
    }
  }

  return false;
}

/**
 * Checks if the user is a participating player in the given match.
 */
export function isUserParticipantInMatch(
  match: Match | null | undefined,
  tournament: TournamentInstance | null | undefined,
  user: User | null | undefined
): boolean {
  if (!match || !tournament || !user) return false;

  // If no participants are assigned to the match yet (e.g. pending KO bracket)
  if (!match.participant1Id && !match.participant2Id) return false;

  // Check if participant IDs directly point to user
  if (isUserMatch(match.participant1Id, user) || isUserMatch(match.participant2Id, user)) {
    return true;
  }

  const participants = tournament.participants || [];
  const p1 = participants.find((p) => p.id === match.participant1Id);
  const p2 = participants.find((p) => p.id === match.participant2Id);

  return isUserInParticipant(p1, user) || isUserInParticipant(p2, user);
}

/**
 * Determines which stage IDs in the tournament are currently active.
 *
 * Rules:
 * 1. Stages are checked in chronological order by order index.
 * 2. An earlier stage is considered completed/closed if:
 *    - All matches in the stage are finished (status 'completed' or 'walkover'), OR
 *    - The stage deadline has passed AND there is a subsequent stage, OR
 *    - A subsequent stage has already had matches completed.
 * 3. The first stage that is not completed/closed is the active phase.
 * 4. If all stages are finished, the last stage remains active.
 */
export function getActiveStageIds(tournament: TournamentInstance | null | undefined): Set<string> {
  const activeIds = new Set<string>();
  if (!tournament) return activeIds;

  const stages = tournament.stages || [];
  if (stages.length === 0) return activeIds;

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  let activeIndex = -1;

  for (let i = 0; i < sortedStages.length; i++) {
    const stage = sortedStages[i];
    const isLast = i === sortedStages.length - 1;

    const stageMatches = (tournament.matches || []).filter(
      (m) =>
        m.stageId === stage.id ||
        (!m.stageId && (stage.type === 'group' ? !!m.groupId : !m.groupId))
    );
    const totalMatches = stageMatches.length;
    const completedMatches = stageMatches.filter(
      (m) => m.status === 'completed' || m.status === 'walkover'
    ).length;

    const isAllCompleted = totalMatches > 0 && completedMatches === totalMatches;

    // Check deadline / date
    const deadline =
      tournament.stageDeadlines?.[stage.id] || stage.deadlineDate || stage.eventDate;
    const isDeadlinePassed = Boolean(
      deadline && typeof deadline === 'string' && deadline.trim() !== '' && deadline < todayStr
    );

    // Check if any subsequent stage already has completed matches
    const subsequentHasStarted = sortedStages.slice(i + 1).some((nextStage) => {
      const nextMatches = (tournament.matches || []).filter(
        (m) =>
          m.stageId === nextStage.id ||
          (!m.stageId && (nextStage.type === 'group' ? !!m.groupId : !m.groupId))
      );
      return nextMatches.some((m) => m.status === 'completed' || m.status === 'walkover');
    });

    // If this stage is completed, or its deadline has passed, or subsequent stage has already played:
    // and this is not the final stage, then this stage is no longer the active phase.
    if ((isAllCompleted || isDeadlinePassed || subsequentHasStarted) && !isLast) {
      continue;
    }

    // Found active stage
    activeIndex = i;
    break;
  }

  if (activeIndex === -1) {
    activeIndex = sortedStages.length - 1;
  }

  if (activeIndex >= 0 && activeIndex < sortedStages.length) {
    const activeStage = sortedStages[activeIndex];
    activeIds.add(activeStage.id);

    // Also include any stages sharing the same order / parallel stages
    sortedStages
      .filter((s) => s.order === activeStage.order)
      .forEach((s) => activeIds.add(s.id));
  }

  return activeIds;
}

/**
 * Checks whether the given match is part of the currently active phase of the tournament.
 */
export function isMatchInCurrentPhase(
  match: Match | null | undefined,
  tournament: TournamentInstance | null | undefined
): boolean {
  if (!match || !tournament) return false;

  const stages = tournament.stages || [];
  // If no stages are defined, assume single active phase
  if (stages.length <= 1) return true;

  const activeStageIds = getActiveStageIds(tournament);
  if (activeStageIds.size === 0) return true;

  // Determine stageId of the match
  let matchStageId = match.stageId;
  if (!matchStageId) {
    if (match.groupId) {
      matchStageId = stages.find((s) => s.type === 'group')?.id || '';
    } else {
      matchStageId = stages.find((s) => s.type !== 'group')?.id || '';
    }
  }

  return activeStageIds.has(matchStageId);
}

/**
 * Main permission check for editing / entering a championship match result.
 *
 * Rules:
 * 1. Superadmin and Admins can edit ANY match at any time.
 * 2. Regular users must be a participating player in the match.
 * 3. Regular users can ONLY edit in the CURRENT PHASE of the tournament.
 * 4. Users without participation and without admin rights can only view results.
 */
export function canUserEditChampionshipMatch(
  match: Match | null | undefined,
  tournament: TournamentInstance | null | undefined,
  currentUser: User | null | undefined
): boolean {
  if (!match || !tournament) return false;

  // Superadmin & Admins can edit everything
  if (isChampionshipAdmin(currentUser)) {
    return true;
  }

  // Regular players must be logged in
  if (!currentUser) {
    return false;
  }

  // Archived or trash tournaments cannot be edited by regular players
  if (tournament.status === 'trash' || tournament.status === 'archived') {
    return false;
  }

  // Regular player must be involved in the match
  if (!isUserParticipantInMatch(match, tournament, currentUser)) {
    return false;
  }

  // Match must belong to the active phase of the tournament
  if (!isMatchInCurrentPhase(match, tournament)) {
    return false;
  }

  return true;
}
