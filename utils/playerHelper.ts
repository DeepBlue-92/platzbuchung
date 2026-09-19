import { User, Person, DynamicLeague, LeaguePlayer } from '../types';
import { LeaguePointConfig, applyDecay } from '../services/leagueEngine';

/**
 * Checks if a string looks like a raw, cryptic UID or internal hash
 * rather than a human-readable display name.
 */
export function isRawUid(str: string): boolean {
  if (!str || typeof str !== 'string') return true;
  const trimmed = str.trim();
  if (!trimmed) return true;

  // UUID pattern (8-4-4-4-12)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }

  // Firebase standard alphanumeric UID (20+ chars, no spaces)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes(' ')) {
    return true;
  }

  // Pure numeric UID of 10+ digits
  if (/^\d{10,}$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Resolves a player's display name according to the strict fallback schema:
 * 1. displayName / klarname (if not a raw UID)
 * 2. firstName + lastName
 * 3. name (if not a raw UID)
 * 4. E-Mail-Präfix (part before the @)
 * 5. Fallback: "Mitglied"
 *
 * Guaranteed to NEVER output a cryptic raw UID.
 */
export function resolvePlayerDisplayName(
  user?: Partial<User | Person> | null,
  fallbackEmailOrId?: string
): string {
  if (user) {
    // 1. displayName or klarname
    const explicitDisplay = ((user as any).displayName || user.klarname || '').trim();
    if (explicitDisplay && !isRawUid(explicitDisplay) && explicitDisplay !== user.id) {
      return explicitDisplay;
    }

    // 2. firstName + lastName
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) {
      return fullName;
    }

    // 3. Check user.name (if not a raw UID)
    if (user.name && typeof user.name === 'string') {
      const trimmedName = user.name.trim();
      if (trimmedName && !isRawUid(trimmedName) && trimmedName !== user.id) {
        return trimmedName;
      }
    }

    // 4. E-Mail-Präfix
    const email = user.email || fallbackEmailOrId;
    if (email && typeof email === 'string' && email.includes('@')) {
      const prefix = email.split('@')[0].trim();
      if (prefix && !isRawUid(prefix)) {
        return prefix;
      }
    }
  }

  // If we only have a fallback email or ID string
  if (fallbackEmailOrId && typeof fallbackEmailOrId === 'string') {
    if (fallbackEmailOrId.includes('@')) {
      const prefix = fallbackEmailOrId.split('@')[0].trim();
      if (prefix && !isRawUid(prefix)) {
        return prefix;
      }
    }
  }

  // 5. Final fallback
  return "Mitglied";
}

/**
 * Calculates current age in full years from an ISO birthdate string (YYYY-MM-DD).
 * Returns null if birthdate is not set or invalid.
 */
export function calculateAge(birthDate: string | undefined | null): number | null {
  if (!birthDate) return null;
  const match = birthDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const birthYear = parseInt(match[1], 10);
  const birthMonth = parseInt(match[2], 10) - 1;
  const birthDay = parseInt(match[3], 10);

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return isNaN(age) || age < 0 ? null : age;
}

/**
 * Evaluates a player against the sequential waterfall rules (First Match Wins).
 * Evaluates both Gender (allowedGenders) and Age (minAge / maxAge) criteria.
 * Returns the exact dynamic league the player is assigned to, or null if player is not eligible for any active league (e.g. minors without youth leagues).
 */
export function getWaterfallAssignedLeague(
  user: Partial<User | Person> | null | undefined,
  activeLeagues: DynamicLeague[]
): DynamicLeague | null {
  if (!activeLeagues || activeLeagues.length === 0) {
    return null;
  }

  // Check if user is suspended
  if (user?.isSuspended) {
    return null;
  }

  // 1. Direct explicit league assignment (if player has a direct leagueId matching an active league)
  if (user?.leagueId) {
    const directMatch = activeLeagues.find(
      (l) => l.id === user.leagueId && l.active !== false && (l as any).isActive !== false && (l as any).status !== 'inactive'
    );
    if (directMatch) {
      return directMatch;
    }
  }

  // Filter only active leagues and sort by displayOrder / natural list order
  // When displayOrder is identical or not defined, specific gender/age rules take precedence over universal/catch-all leagues
  const activeSorted = [...activeLeagues]
    .filter((l) => l.active !== false && (l as any).isActive !== false && (l as any).status !== 'inactive')
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;

      const isCatchAllA = (!a.allowedGenders || a.allowedGenders.includes("u") || (a.allowedGenders.includes("m") && a.allowedGenders.includes("w"))) && a.minAge === undefined && a.maxAge === undefined;
      const isCatchAllB = (!b.allowedGenders || b.allowedGenders.includes("u") || (b.allowedGenders.includes("m") && b.allowedGenders.includes("w"))) && b.minAge === undefined && b.maxAge === undefined;
      if (isCatchAllA !== isCatchAllB) return isCatchAllA ? 1 : -1;

      return (a.name || "").localeCompare(b.name || "", "de");
    });

  if (activeSorted.length === 0) {
    return null;
  }

  const gender = user?.gender; // 'm' | 'w'
  const userAge = calculateAge(user?.birthDate);

  for (const league of activeSorted) {
    const allowedGenders = league.allowedGenders;
    const minAge = league.minAge;
    const maxAge = league.maxAge;
    const leagueIdNorm = (league.id || "").toLowerCase();
    const leagueNameNorm = (league.name || "").toLowerCase();

    // --- 1. AGE FILTERING (Alterskriterien) ---
    // If a minimum age is specified (e.g. minAge: 18)
    if (minAge !== undefined && minAge !== null) {
      if (userAge !== null && userAge < minAge) {
        // Player is younger than minimum age (e.g. minor trying to enter adult league) -> Skip this league
        continue;
      }
    }

    // If a maximum age is specified (e.g. maxAge: 14 for U14 youth league)
    if (maxAge !== undefined && maxAge !== null) {
      if (userAge !== null && userAge > maxAge) {
        // Player is older than maximum age -> Skip this league
        continue;
      }
      // If user has no birthdate recorded, they don't qualify for specific youth leagues (maxAge <= 18)
      if (userAge === null && maxAge < 18) {
        continue;
      }
    }

    // --- 2. GENDER FILTERING (Geschlechtskriterien) ---
    if (allowedGenders && allowedGenders.length > 0) {
      // Matches specific gender
      if (gender && allowedGenders.includes(gender as any)) {
        return league; // Matches!
      }
      // Universal / Open to all genders
      if (allowedGenders.includes("u") || (allowedGenders.includes("m") && allowedGenders.includes("w"))) {
        return league; // Matches!
      }
      // If user has no gender specified, and league allows 'u'
      if (!gender && allowedGenders.includes("u")) {
        return league;
      }
      // Gender did not match -> Continue to next rule
      continue;
    }

    // Built-in heuristics if allowedGenders is not explicitly set:
    const isDamen = leagueIdNorm.includes("damen") || leagueIdNorm.includes("frauen") || leagueNameNorm.includes("damen") || leagueNameNorm.includes("frauen");
    const isHerren = leagueIdNorm.includes("herren") || leagueIdNorm.includes("männer") || leagueNameNorm.includes("herren") || leagueNameNorm.includes("männer");

    if (isDamen) {
      if (gender === "w") return league;
      continue;
    }

    if (isHerren) {
      if (gender === "m") return league;
      continue;
    }

    // Default / Open / Mixed league matches all remaining players who passed the age check
    return league;
  }

  // If player did not meet criteria for ANY active league (e.g. child with no youth league configured),
  // they are not assigned to any league (return null)
  return null;
}

/**
 * Checks whether a player is eligible to compete in a specific dynamic league.
 * In the Waterfall model, a player is eligible for a league IF AND ONLY IF
 * the waterfall evaluator assigns the player to that league.
 */
export function isPlayerEligibleForLeague(
  user: Partial<User | Person> | null | undefined,
  league: DynamicLeague | undefined,
  activeLeagueId: string,
  playerLeagueId?: string,
  allActiveLeagues?: DynamicLeague[]
): boolean {
  if (!user && !playerLeagueId) {
    return false;
  }

  // Check if suspended
  if (user?.isSuspended) {
    return false;
  }

  const targetLeagueId = league?.id || activeLeagueId;

  // If full list of active leagues is available, use strict waterfall assignment (First Match Wins)
  if (allActiveLeagues && allActiveLeagues.length > 0) {
    const assigned = getWaterfallAssignedLeague(user, allActiveLeagues);
    return assigned?.id === targetLeagueId;
  }

  const leagueId = targetLeagueId.toLowerCase();
  const leagueName = (league?.name || "").toLowerCase();
  const gender = user?.gender;
  const userAge = calculateAge(user?.birthDate);

  // Age checks
  if (league?.minAge !== undefined && league.minAge !== null && userAge !== null && userAge < league.minAge) {
    return false;
  }
  if (league?.maxAge !== undefined && league.maxAge !== null && userAge !== null && userAge > league.maxAge) {
    return false;
  }

  // 1. Check dynamic allowedGenders if defined
  if (league?.allowedGenders && league.allowedGenders.length > 0) {
    if (league.allowedGenders.includes("u") || (league.allowedGenders.includes("m") && league.allowedGenders.includes("w"))) {
      return true;
    }
    if (gender && league.allowedGenders.includes(gender as any)) {
      return true;
    }
    return false;
  }

  // 2. Built-in gender league heuristics
  const isDamenLeague = leagueId === "damen_einzel" || leagueId === "damen" || leagueName.includes("damen") || leagueName.includes("frauen") || leagueName.includes("women");
  const isHerrenLeague = leagueId === "herren_einzel" || leagueId === "herren" || leagueName.includes("herren") || leagueName.includes("männer") || leagueName.includes("men");
  const isOpenLeague = leagueId === "open_mixed" || leagueId === "open" || leagueId === "mixed" || leagueName.includes("open") || leagueName.includes("mixed");

  if (isDamenLeague) {
    return gender === "w";
  }

  if (isHerrenLeague) {
    return gender === "m";
  }

  if (isOpenLeague) {
    return true;
  }

  // If the player has explicitly joined this league and passed gender checks
  if (playerLeagueId && playerLeagueId === activeLeagueId) {
    return true;
  }

  return true;
}

/**
 * Calculates official live points for a league player.
 * If 0 matches have been completed, returns the official initial ranking points (e.g. 100.0)
 * rather than 0.0 or uncalculated values.
 */
export function calculateLeaguePlayerLivePoints(
  player: LeaguePlayer | null | undefined,
  config: LeaguePointConfig
): number {
  const initialPoints = typeof config.initialRankingPoints === 'number'
    ? config.initialRankingPoints
    : 0;

  if (!player) {
    return initialPoints;
  }

  const rawBase = typeof player.basePoints === 'number' && !isNaN(player.basePoints)
    ? player.basePoints
    : initialPoints;

  const count = player.matchesCount || 0;

  // If 0 matches have been played, no decay applies - player starts with full initial points
  if (count === 0) {
    return Number(rawBase.toFixed(1));
  }

  const decayed = applyDecay(
    rawBase,
    player.lastMatchDate || new Date().toISOString(),
    config,
    count,
    new Date().toISOString()
  );

  const finalPoints = typeof decayed === 'number' && !isNaN(decayed) ? decayed : rawBase;
  return Number(finalPoints.toFixed(1));
}

/**
 * Parses various date formats (e.g. Firestore Timestamps, JS Dates, DD.MM.YYYY, YYYY-MM-DD)
 * into a strict YYYY-MM-DD format suitable for HTML5 <input type="date">.
 * Returns empty string if invalid.
 */
export function parseDateToYYYYMMDD(val: any): string {
  if (!val) return "";
  try {
    if (typeof val === 'string') {
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
      // DD.MM.YYYY
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(val)) {
        const [d, m, y] = val.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Fallback: try standard Date
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      return "";
    }
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {
    console.error("Error parsing date:", e);
  }
  return "";
}
