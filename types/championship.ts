// Vereinsmeisterschafts-Modul Types

export type DisciplineType = 'singles' | 'doubles';
export type TieBreakRuleType = 'head_to_head' | 'set_difference';
export type TournamentStatus = 'draft' | 'active' | 'archived' | 'trash';
export type StageType = 'group' | 'knockout' | 'finals_day';

export interface MatchFormat {
  setsToWin: number; // usually 2 (Best of 3)
  tiebreakAt: number; // usually 6 (tiebreak at 6:6)
  championsTiebreakFinalSet: boolean; // 3rd set as Champions Tiebreak (first to 10 by 2)
}

export interface TournamentStageConfig {
  id: string;
  name: string;
  type: StageType;
  order: number;
  // For group stages:
  groupCount?: number;
  playersPerGroup?: number;
  advancingPerGroup?: number; // How many advance to next stage (e.g. top 2)
  // For knockout stages / finals_day:
  roundName?: string; // e.g. "Halbfinale", "Finale", "Viertelfinale"
  bracketSize?: number; // 2, 4, 8, 16, 32
  placementMatchesMaxRank?: number; // e.g. 2 for "Nur Finale (Platz 1 & 2)", 4 for "+ Platz 3", 6 for "+ Platz 5", 8 for "+ Platz 7"
  // Timing / Deadlines (Konkret für Meisterschaftsobjekt TournamentInstance, nicht in Templates):
  deadlineDate?: string; // e.g. "2026-07-15" (Zu spielen bis)
  eventDate?: string; // e.g. "2026-08-15" (Festes Event-Datum für finals_day)
  deadlineType?: 'deadline' | 'date'; // 'deadline' ("Zu spielen bis") oder 'date' ("Datum / Spieltag")
  isFinalsDay?: boolean; // Flag to easily treat stage as Club Event Day
}

export interface TournamentTemplate {
  id: string;
  tenantId: string;
  title: string;
  discipline: DisciplineType;
  stages: TournamentStageConfig[];
  tieBreakRule: TieBreakRuleType;
  matchFormat: MatchFormat;
  isLocked: boolean; // Tamper protection: locked as soon as used in an instance
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string; // Unique participant ID in this tournament
  playerIds: string[]; // 1 for singles, 2 for doubles
  displayNames?: string[]; // Cached readable player names
  seed?: number | null; // Optional seeding (1, 2, 3, 4...)
  groupAssignment?: string | null; // Group ID if assigned
  withdrawn?: boolean; // Walkover / injury flag
  withdrawnReason?: string | null;
  withdrawnAt?: string | null;
}

export interface MatchSetScore {
  setNumber: number;
  player1Games: number;
  player2Games: number;
  player1TiebreakPoints?: number | null;
  player2TiebreakPoints?: number | null;
  isChampionsTiebreak?: boolean;
}

export interface MatchResult {
  winnerParticipantId: string;
  sets: MatchSetScore[];
  isWalkover?: boolean;
  walkoverReason?: string;
  enteredByUserId: string;
  enteredByUserName: string;
  enteredAt: string;
  confirmedByOpponent?: boolean;
  confirmedAt?: string | null;
}

export interface Match {
  id: string;
  stageId: string;
  roundIndex: number; // 0 = group match or 0 = quarters, 1 = semis, 2 = final
  roundLabel: string; // e.g. "Runde 1", "Halbfinale", "Finale"
  groupId?: string | null; // If part of a group stage
  matchNumberInStage?: number;
  
  participant1Id: string | null; // null if TBD / waiting for previous round winner
  participant2Id: string | null;
  
  // Track previous match references for KO progression
  previousMatch1Id?: string | null;
  previousMatch2Id?: string | null;
  
  result?: MatchResult | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'walkover';
  courtBookingId?: string | null; // Linked court reservation ID if booked
  scheduledDate?: string | null;
  
  // Timing & Finals Day Slot Details:
  deadlineDate?: string | null; // "Zu spielen bis: [Datum]"
  startTime?: string | null; // e.g. "14:00 Uhr"
  courtId?: string | null; // e.g. "Platz 1"
  courtName?: string | null; // e.g. "Center Court"
  placeholderSource1?: string | null; // e.g. "Sieger HF 1" or "1. Gruppe A"
  placeholderSource2?: string | null; // e.g. "Sieger HF 2" or "2. Gruppe B"
}

export interface Group {
  id: string;
  stageId: string;
  name: string; // e.g. "Gruppe A", "Gruppe B"
  participantIds: string[];
}

export interface GroupStandingRow {
  participantId: string;
  participant: Participant;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number; // Usually equal to wins
  isAdvancing: boolean;
}

export interface ChampionshipAuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  userName: string;
  userRole?: string;
  action: 'create_result' | 'update_result' | 'delete_result' | 'walkover';
  matchId: string;
  roundLabel: string;
  stageName?: string;
  participant1Name: string;
  participant2Name: string;
  previousResultSummary?: string | null;
  newResultSummary: string;
  winnerName: string;
  isWalkover?: boolean;
  walkoverReason?: string;
  details?: string;
}

export interface TournamentInstance {
  id: string;
  tenantId: string;
  templateId: string;
  templateSnapshot: TournamentTemplate;
  title: string;
  discipline: DisciplineType;
  stages: TournamentStageConfig[];
  tieBreakRule: TieBreakRuleType;
  matchFormat: MatchFormat;
  participants: Participant[];
  groups: Group[];
  matches: Match[];
  stageDeadlines: Record<string, string>; // stageId -> ISO Date string ("Zu spielen bis" bzw. "Datum" beim Finaltag)
  stageDeadlineTypes?: Record<string, 'deadline' | 'date'>; // stageId -> 'deadline' | 'date'
  startDate?: string;
  endDate?: string;
  status: TournamentStatus;
  deletedAt?: string | null; // For soft-delete (30-day trash retention)
  auditLog?: ChampionshipAuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}
