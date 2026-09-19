import { LeaguePlayer, LeagueTimePreference, LeagueConfigVersion } from "../types";

export interface LeaguePointConfig {
  initialRankingPoints: number;
  participationPoints: number;
  base_points_win?: number;
  base_points_loss?: number;
  maxBonusPoints: number;
  logisticSteepnessK: number;
  decayPointsPerWeek: number;
}

export const defaultConfig: LeaguePointConfig = {
  initialRankingPoints: 0,
  participationPoints: 5,
  base_points_win: 5,
  base_points_loss: 5,
  maxBonusPoints: 45,
  logisticSteepnessK: 0.05,
  decayPointsPerWeek: 5,
};

export function getConfigForDate(
  versions: LeagueConfigVersion[],
  dateStr?: string,
  leagueId?: string
): LeaguePointConfig {
  const eventDateStr = !dateStr
    ? new Date().toISOString().split('T')[0]
    : (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10));

  // 1. Filter versions by leagueId
  const leagueVersions = leagueId 
    ? versions.filter(v => v.leagueId === leagueId || (!v.leagueId && (v.is_base_rule || v.id === "base_rule_20000101"))) // Fallback to global base rule if no league specific one exists yet
    : versions;

  // Query: WHERE effective_date <= match_date
  const valid = (leagueVersions || []).filter((v) => {
    if (!v.effective_date) return false;
    const effDate = v.effective_date.includes('T') ? v.effective_date.split('T')[0] : v.effective_date.slice(0, 10);
    return effDate <= eventDateStr;
  });

  // If no entry found with effective_date <= match_date, fallback to base rule (01.01.2000)
  if (valid.length === 0) {
    const baseRule = (leagueVersions || []).find((v) => v.effective_date === '2000-01-01' || v.is_base_rule);
    if (baseRule) {
      const winPts = baseRule.base_points_win ?? 5;
      const lossPts = baseRule.base_points_loss ?? 5;
      return {
        initialRankingPoints: baseRule.initial_ranking_points ?? 0,
        participationPoints: winPts,
        base_points_win: winPts,
        base_points_loss: lossPts,
        maxBonusPoints: baseRule.max_bonus ?? 45,
        logisticSteepnessK: baseRule.logistic_factor ?? 0.05,
        decayPointsPerWeek: baseRule.inactivity_deduction_per_week ?? 5,
      };
    }
    return defaultConfig;
  }

  // ORDER BY effective_date DESC LIMIT 1
  valid.sort((a, b) => {
    const aEff = a.effective_date.includes('T') ? a.effective_date.split('T')[0] : a.effective_date.slice(0, 10);
    const bEff = b.effective_date.includes('T') ? b.effective_date.split('T')[0] : b.effective_date.slice(0, 10);
    return bEff.localeCompare(aEff);
  });

  const active = valid[0];
  const winPts = active.base_points_win ?? 5;
  const lossPts = active.base_points_loss ?? 5;

  return {
    initialRankingPoints: active.initial_ranking_points ?? 0,
    participationPoints: winPts,
    base_points_win: winPts,
    base_points_loss: lossPts,
    maxBonusPoints: active.max_bonus ?? 45,
    logisticSteepnessK: active.logistic_factor ?? 0.05,
    decayPointsPerWeek: active.inactivity_deduction_per_week ?? 5,
  };
}

export function calculatePoints(
  playerPoints: number,
  opponentPoints: number,
  isWinner: boolean,
  config: LeaguePointConfig
): number {
  const baseWin = config.base_points_win ?? config.participationPoints ?? 5;
  const baseLoss = config.base_points_loss ?? config.participationPoints ?? 5;

  let newPoints = playerPoints + (isWinner ? baseWin : baseLoss);

  if (isWinner) {
    // D = Punktestand Gegner - eigener Punktestand
    const diff = opponentPoints - playerPoints;

    // Bonus = B_max / (1 + e^(-k * D))
    const bonus = config.maxBonusPoints / (1 + Math.exp(-config.logisticSteepnessK * diff));

    newPoints += bonus;
  }

  return newPoints;
}

export function applyDecay(
  currentPoints: number,
  lastMatchDateIso: string,
  config: LeaguePointConfig,
  matchesCount?: number,
  targetDateIso?: string
): number {
  // Das Punkte-Modell ist rein akkumulativ. Es gibt keinen Punkteabzug für Inaktivität.
  return currentPoints;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Find overlaps in recurring preferences
// Format: DayOfWeek 0-6 (Sunday-Saturday)
export function checkOverlap(
  pref1: LeagueTimePreference, 
  pref2: LeagueTimePreference,
  minDurationMinutes: number
): boolean {
  if (pref1.type !== pref2.type) return false;
  
  if (pref1.type === 'recurring') {
    if (pref1.dayOfWeek !== pref2.dayOfWeek) return false;
  } else if (pref1.type === 'specific') {
    if (pref1.date !== pref2.date) return false;
  }

  const start1 = timeToMinutes(pref1.startTime);
  const end1 = timeToMinutes(pref1.endTime);
  const start2 = timeToMinutes(pref2.startTime);
  const end2 = timeToMinutes(pref2.endTime);

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  
  return (overlapEnd - overlapStart) >= minDurationMinutes;
}

export function findMatches(
  player: LeaguePlayer,
  otherPlayers: LeaguePlayer[],
  minDurationMinutes: number
): LeaguePlayer[] {
  const matchedPlayers: LeaguePlayer[] = [];
  
  for (const other of otherPlayers) {
    if (other.userId === player.userId) continue;
    
    let hasOverlap = false;
    for (const p1 of player.preferences) {
      for (const p2 of other.preferences) {
        if (checkOverlap(p1, p2, minDurationMinutes)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }
    
    if (hasOverlap) {
      matchedPlayers.push(other);
    }
  }
  
  return matchedPlayers;
}
