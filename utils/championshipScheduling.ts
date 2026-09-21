import { TournamentInstance } from '../types/championship';

/**
 * Utilities for championship scheduling, deadlines, countdowns, and finals day formatting.
 */

export interface DeadlineCountdownInfo {
  text: string;
  daysRemaining: number;
  daysRemainingText?: string;
  isOverdue: boolean;
  isToday: boolean;
  isUpcoming: boolean;
  isUrgent?: boolean;
  formattedDate: string;
}

/**
 * Calculates human-friendly deadline and countdown information.
 * E.g. "Zu spielen bis 15.07.2026 (noch 5 Tage)"
 */
export function getDeadlineCountdownInfo(deadlineDateStr?: string | null): DeadlineCountdownInfo | null {
  if (!deadlineDateStr || typeof deadlineDateStr !== 'string') {
    return null;
  }

  const parts = deadlineDateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const targetDate = new Date(year, month, day, 23, 59, 59);
  if (isNaN(targetDate.getTime())) {
    return null;
  }

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const targetZero = new Date(year, month, day, 0, 0, 0);

  const diffMs = targetZero.getTime() - todayZero.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = targetDate.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    const text = overdueDays === 1 ? 'Frist gestern abgelaufen' : `Frist seit ${overdueDays} Tagen abgelaufen`;
    return {
      text,
      daysRemaining: diffDays,
      daysRemainingText: text,
      isOverdue: true,
      isToday: false,
      isUpcoming: false,
      isUrgent: true,
      formattedDate,
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Frist endet heute!',
      daysRemaining: 0,
      daysRemainingText: 'endet heute!',
      isOverdue: false,
      isToday: true,
      isUpcoming: false,
      isUrgent: true,
      formattedDate,
    };
  }

  if (diffDays === 1) {
    return {
      text: 'noch 1 Tag (morgen)',
      daysRemaining: 1,
      daysRemainingText: 'noch 1 Tag',
      isOverdue: false,
      isToday: false,
      isUpcoming: true,
      isUrgent: true,
      formattedDate,
    };
  }

  const isUrgent = diffDays <= 3;
  return {
    text: `noch ${diffDays} Tage`,
    daysRemaining: diffDays,
    daysRemainingText: `noch ${diffDays} Tage`,
    isOverdue: false,
    isToday: false,
    isUpcoming: true,
    isUrgent,
    formattedDate,
  };
}

/**
 * Formats a fixed event date for finals day.
 * E.g. "Finaltag am Samstag, 15.08.2026"
 */
export function formatEventDate(dateStr?: string | null, includeWeekday = true): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const target = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );

  if (isNaN(target.getTime())) return dateStr;

  if (includeWeekday) {
    return target.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return target.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Determines the currently active stage and tab ('groups' | 'bracket') based on
 * the maintained stage dates/deadlines ("zu spielen bis" or event date).
 *
 * Rules:
 * 1. Stages are checked in chronological order.
 * 2. If a group stage has a maintained deadline that has passed (today > deadline),
 *    the tournament has progressed beyond the group phase and switches to the KO phase ('bracket').
 * 3. If the group stage deadline is still in the future or today (today <= deadline),
 *    it remains on 'groups'.
 * 4. Once the KO phase / bracket is reached, it remains the final overarching view ('bracket'),
 *    containing all matches planned for the tournament (KO rounds, semifinals, finals, placement matches, finals day).
 * 5. If no date is maintained, it falls back to match completion progress
 *    (e.g., if group matches are 100% completed, show 'bracket', else 'groups').
 */
export function determineActiveChampionshipTab(
  tournament?: TournamentInstance | null
): 'groups' | 'bracket' {
  if (!tournament || !tournament.stages || tournament.stages.length === 0) {
    return 'groups';
  }

  const sortedStages = [...tournament.stages].sort((a, b) => a.order - b.order);
  const groupStages = sortedStages.filter((s) => s.type === 'group');
  const koStages = sortedStages.filter(
    (s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay
  );

  // If there are no group stages, KO phase is the only/active view
  if (groupStages.length === 0) {
    return 'bracket';
  }

  // If there are no KO stages, group phase is the only view
  if (koStages.length === 0) {
    return 'groups';
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  // Check group stages for deadlines
  let anyGroupDeadlineMaintained = false;
  let allGroupDeadlinesPassed = true;

  for (const groupStage of groupStages) {
    const deadline =
      tournament.stageDeadlines?.[groupStage.id] || groupStage.deadlineDate;
    if (deadline && typeof deadline === 'string' && deadline.trim() !== '') {
      anyGroupDeadlineMaintained = true;
      // String comparison for ISO YYYY-MM-DD:
      // If deadline >= todayStr, the deadline is today or in the future -> group stage still active!
      if (deadline >= todayStr) {
        allGroupDeadlinesPassed = false;
      }
    }
  }

  if (anyGroupDeadlineMaintained) {
    // If deadline of the group phase is exceeded, automatically switch to KO phase (bracket)!
    // If not exceeded, stay on groups!
    return allGroupDeadlinesPassed ? 'bracket' : 'groups';
  }

  // Fallback if no dates were maintained: check if all group matches are completed
  const groupMatches = (tournament.matches || []).filter((m) =>
    groupStages.some((gs) => gs.id === m.stageId)
  );
  if (groupMatches.length > 0) {
    const allGroupMatchesCompleted = groupMatches.every(
      (m) => m.status === 'completed' || m.status === 'walkover'
    );
    if (allGroupMatchesCompleted) {
      return 'bracket';
    }
  }

  return 'groups';
}

