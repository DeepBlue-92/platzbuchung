export enum Role {
  ADMIN = "admin",
  USER = "mitglied",
  MITGLIED = "mitglied",
  SUPER_ADMIN = "super-admin",
}

export type Gender = "m" | "w"; // m = Herren, w = Damen

export interface UserClub {
  vereinsId: string;
  clubName: string;
  role?: Role;
  logoUrl?: string;
  street?: string;
  zip?: string;
  city?: string;
  facilityPhotoUrl?: string;
}

export interface DynamicLeague {
  id: string;
  name: string;
  active: boolean;
  isActive?: boolean;
  status?: string;
  description?: string;
  displayOrder?: number;
  allowedGenders?: ("m" | "w" | "u")[];
  minAge?: number | null; // Optionales Mindestalter (z.B. 18 für Erwachsene)
  maxAge?: number | null; // Optionales Höchstalter (z.B. 14 für U14)
}

export interface Person {
  id: string; // PersonID
  firstName: string; // Vorname
  lastName: string; // Nachname
  email?: string; // E-Mail (optional)
  password?: string; // Passwort (optional)
  phone?: string; // Telefon (optional)
  gender: Gender; // Geschlecht ('m' = Herren, 'w' = Damen)
  birthDate?: string | null; // Geburtsdatum im Format 'YYYY-MM-DD'
  showContactInfo?: boolean; // Kontaktfreigabe: Ja (true) / Nein (false)
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
  mustChangePassword?: boolean;
  clubs?: UserClub[];
  avatarUrl?: string | null; // WebP komprimiertes Profilbild (< 25 KB, permanent gecached)
  avatarIcon?: string | null; // Zero-Bandwidth Vektor-Icon ID (z.B. "tennis-ball", "racket", "trophy")
  onboarding_pending?: boolean; // Indicates if member onboarding is required
}

export type OnboardingFieldPermission = "HIDDEN" | "READ_ONLY" | "EDITABLE";
export type OnboardingPasswordFieldPermission = "HIDDEN" | "EDITABLE";

export interface ClubOnboardingSettings {
  enable_onboarding: boolean;
  auto_enable_for_new_users: boolean;
  welcome_title: string;
  welcome_description: string;
  show_animation?: boolean;
  field_name: OnboardingFieldPermission;
  field_birthdate: OnboardingFieldPermission;
  field_gender: OnboardingFieldPermission;
  field_demographics?: OnboardingFieldPermission;
  field_avatar: OnboardingFieldPermission;
  field_password: OnboardingPasswordFieldPermission;
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
  hours?: number;
  guestFee?: number;
  guestBillingMode?: string;
  calculatedFeeCents?: number;
  appliedFeeRuleId?: string;
  appliedFeeRuleName?: string;
  feeCalculationMode?: FeeCalculationMode;
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
  viewMode?: "pyramid" | "list";
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
  showContactInfo?: boolean; // Ob Kontaktdaten direkt angezeigt werden
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
  clubName?: string;
  facilityName?: string;
  court?: string; // e.g. "Platz 1"
  leagueId?: string; // League ID
  player1Id: string;
  player2Id: string;
  player1UserId: string; // for easier lookup
  player2UserId: string; // for easier lookup
  player1?: (Partial<User> & { initials?: string; clubName?: string }) | null;
  player2?: (Partial<User> & { initials?: string; clubName?: string }) | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'aborted';
  completionType?: 'regular' | 'retired' | 'aborted';
  abandonmentReason?: string;
  bookingId?: string; // Reference to the regular booking
  scheduledDate?: string; // YYYY-MM-DD
  scheduledStartTime?: string; // HH:mm
  scheduledEndTime?: string; // HH:mm
  result?: {
    winnerId?: string;
    sets: { p1: number; p2: number; tb1?: number; tb2?: number }[];
    reportedBy: string;
    reportedAt: string;
    played_at?: string;
    retiredPlayerId?: string;
    completionType?: 'regular' | 'retired' | 'aborted';
    abandonmentReason?: string;
  };
  played_at?: string;
  isProvisional?: boolean;
  provisionalUntil?: string; // ISO timestamp (reportedAt + 24 hours)
  reportedAt?: string;
  reportedByUserId?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  entryType?: 'match' | 'ADMIN_CORRECTION';
  isManualAdjustment?: boolean;
  correctionType?: 'absolute' | 'relative';
  pointsDelta?: number;
  newTotalPoints?: number;
  adminUserId?: string;
  adminName?: string;
  reason?: string;
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
  initial_ranking_points?: number;
}

export type FeeCalculationMode = 'SIMPLE' | 'ADVANCED';

export interface RuleAction {
  type: 'PER_COURT_HOUR' | 'PER_GUEST' | 'PER_GUEST_HOUR' | 'FREE';
  amount_cents: number;
}

export interface ConditionRow {
  id: string;
  logicOperator?: 'AND' | 'OR'; // Row-level operator for row 2+ (default 'AND')
  field: 'anzahl_gaeste' | 'anzahl_mitglieder' | 'anzahl_gesamt' | 'dauer_minuten';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN_EQUAL' | 'LESS_THAN_EQUAL' | 'GREATER_THAN' | 'LESS_THAN';
  value: number | null;
}

export interface AdvancedRule {
  id: string;
  name: string;
  priority: number; // Order index (top to bottom)
  match_type?: 'ALL' | 'ANY'; // Legacy matching support
  conditions: ConditionRow[];
  action: RuleAction;
}

export interface ClubFeeSettings {
  fee_calculation_mode: FeeCalculationMode; // Default: 'SIMPLE'
  
  // Existing simple mode configuration (preserve untouched!)
  simple_config?: {
    rate_type: 'PER_COURT_HOUR' | 'PER_GUEST' | 'PER_GUEST_HOUR';
    amount_cents: number;
  };

  // New advanced mode configuration
  advanced_config?: {
    rules: AdvancedRule[];
    default_rule: RuleAction; // Standard-Regel (Greift, wenn keine obige Regel zutrifft)
  };
}

export interface BookingFeeContext {
  anzahl_gaeste: number;
  anzahl_mitglieder: number;
  anzahl_gesamt: number;
  dauer_minuten: number;
}

export interface BookingFeeCalculationResult {
  action: RuleAction;
  matchedRuleId?: string;
  matchedRuleName?: string;
  totalCents: number;
  totalEuro: number;
  mode: FeeCalculationMode;
  ratePerUnitEuro: number;
  unitLabel: string;
  description: string;
}
