/**
 * Utilities for championship scheduling, deadlines, countdowns, and finals day formatting.
 */

export interface DeadlineCountdownInfo {
  text: string;
  daysRemaining: number;
  isOverdue: boolean;
  isToday: boolean;
  isUpcoming: boolean;
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
    return {
      text: overdueDays === 1 ? 'Frist gestern abgelaufen' : `Frist seit ${overdueDays} Tagen abgelaufen`,
      daysRemaining: diffDays,
      isOverdue: true,
      isToday: false,
      isUpcoming: false,
      formattedDate,
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Frist endet heute!',
      daysRemaining: 0,
      isOverdue: false,
      isToday: true,
      isUpcoming: false,
      formattedDate,
    };
  }

  if (diffDays === 1) {
    return {
      text: 'noch 1 Tag (morgen)',
      daysRemaining: 1,
      isOverdue: false,
      isToday: false,
      isUpcoming: true,
      formattedDate,
    };
  }

  return {
    text: `noch ${diffDays} Tage`,
    daysRemaining: diffDays,
    isOverdue: false,
    isToday: false,
    isUpcoming: true,
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
