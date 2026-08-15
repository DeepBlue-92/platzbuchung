export enum Role {
  ADMIN = "admin",
  USER = "user",
  MITGLIED = "mitglied",
  SUPER_ADMIN = "super-admin",
}

export type Gender = "m" | "w"; // m = Herren, w = Damen

export interface UserClub {
  vereinsId: string;
  clubName: string;
  role?: Role;
}

export interface DynamicLeague {
  id: string;
  name: string;
  active: boolean;
  description?: string;
  displayOrder?: number;
}

export interface Person {
  id: string; // PersonID
  firstName: string; // Vorname
  lastName: string; // Nachname
  email?: string; // E-Mail (optional)
  password?: string; // Passwort (optional)
  phone?: string; // Telefon (optional)
  gender: Gender; // Geschlecht ('m' = Herren, 'w' = Damen)
  showContactInfo: boolean; // Kontaktfreigabe: Ja (true) / Nein (false)
  hobbyLeagueOptIn?: boolean; // Hobbyliga Teilnahme
  leagueId?: string; // Zugeordnete dynamische Hobbyliga
  name?: string; // Username / login name
  klarname?: string; // Legacy / combined full name
  isSuspended?: boolean;
  hauptAdmin?: boolean;
  createdAt?: string;
  show_onboarding_hints?: boolean;
  role?: Role;
  vereinsId?: string; // Primary or current club ID
  is_placeholder_email?: boolean;
  clubs?: UserClub[];
}

export type User = Person & {
  role: Role;
  name: string;
  vereinsId: string;
};

export interface Verein {
  id: string; // VereinID
  name: string; // Vereinsname
}

export interface Mitgliedschaft {
  id: string; // MitgliedschaftID
  personId: string; // PersonID
  vereinId: string; // VereinID
  role: Role; // Rolle in diesem Verein
  active: boolean; // aktiv: true / false
  createdAt?: string;
}

export interface Booking {
  id: string;
  date: string;
  time: string;
  court: string;
  players: string[];
  isLocked: boolean;
  isEvent?: boolean;
  reason?: string;
  guestCount?: number;
  guestFeePaid?: boolean;
  isPaid?: boolean;
  createdBy?: string;
  color?: string;
  hasBallMachine?: boolean;
  parentLockId?: string;
  comment?: string;
  group_token?: string;
  parentBookingId?: string;
}

export interface RegularLock {
  id: string;
  title: string;
  courts: string[];
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
  startDate?: string;
  endDate?: string;
  isEvent?: boolean;
  isOpenOffer?: boolean;
  color?: string;
}

export interface RangeLock {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  courts: string[];
  isEvent?: boolean;
  isOpenOffer?: boolean;
}

export interface RankingEntry {
  id: string;
  userName: string;
}

export interface RankingCategory {
  id: string;
  name: string;
  entries: RankingEntry[];
  layout: "pyramid" | "linear";
}

export interface RankingState {
  categories: RankingCategory[];
  rules?: string;
}

export interface Tournament {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  hideExpired?: boolean;
  allowComment?: boolean;
  maxParticipants: number;
  isRegistrationBlocked?: boolean;
  participants: string[];
}

export interface ArbeitsEinsatz {
  id: string;
  date: string;
  hours: number;
  category: string;
  description: string;
  userId: string;
  userName: string;
  userFullName: string;
  createdBy: string;
  createdAt: string;
}

export interface PlannedWorkShift {
  id: string;
  date: string; // YYYY-MM-DD
  time_window: string; // e.g. "10:00 - 12:00 Uhr"
  category: string;
  title_description: string;
  required_volunteers: number;
  assigned_user_ids: string[];
  created_at?: string;
  updated_at?: string;
  createdBy?: string;
}

export interface LeagueTimePreference {
  id: string;
  type: 'recurring' | 'specific';
  dayOfWeek?: number; // 0-6 for recurring
  date?: string; // YYYY-MM-DD for specific
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface LeaguePartnerSearch {
  id: string;
  userId: string;
  userName?: string;
  clubId: string;
  clubName?: string;
  availabilityText: string;
  expiresAt: string; // ISO date string (YYYY-MM-DD or ISO)
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface LeaguePlayer {
  id: string;
  userId: string;
  clubId: string;
  leagueId?: string;
  basePoints: number;
  lastMatchDate: string; // ISO string
  preferences: LeagueTimePreference[];
  matchesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeagueMatch {
  id: string;
  clubId: string; // Home club ID
  leagueId?: string; // League ID
  player1Id: string;
  player2Id: string;
  player1UserId: string; // for easier lookup
  player2UserId: string; // for easier lookup
  status: 'scheduled' | 'completed' | 'cancelled';
  bookingId?: string; // Reference to the regular booking
  scheduledDate?: string; // YYYY-MM-DD
  scheduledStartTime?: string; // HH:mm
  scheduledEndTime?: string; // HH:mm
  result?: {
    winnerId: string;
    sets: { p1: number; p2: number }[];
    reportedBy: string;
    reportedAt: string;
    played_at?: string;
  };
  played_at?: string;
  isManualAdjustment?: boolean;
  manualPointsValue?: number;
  manualAdjustmentReason?: string;
  pointsAwarded?: {
    player1: number;
    player2: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeagueConfigVersion {
  id: string;
  /** Empty only for the universal base rule; all other rules belong to one league. */
  leagueId?: string;
  effective_date: string; // YYYY-MM-DD
  created_at: string;
  created_by: string;
  system_status?: string;
  is_base_rule?: boolean;
  base_points_win: number;
  base_points_loss: number;
  inactivity_deduction_per_week: number;
  logistic_factor: number;
  max_bonus: number;
}
