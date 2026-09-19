import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, Timestamp, increment, onSnapshot, deleteField } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LeaguePlayer, LeagueMatch, LeagueTimePreference, LeaguePartnerSearch, LeagueConfigVersion, DynamicLeague } from "../types";
import { getConfigForDate, applyDecay, calculatePoints, defaultConfig } from "./leagueEngine";
import { checkPlayerCollisionAsync } from "./collisionService";

export const LEAGUE_PROFILES_COLLECTION = "league_profiles";
export const LEAGUE_MATCHES_COLLECTION = "league_matches";
export const LEAGUE_SEARCHES_COLLECTION = "league_searches";
export const LEAGUE_CONFIG_VERSIONS_COLLECTION = "league_config_versions";
export const LEAGUES_COLLECTION = "leagues";
export const DYNAMIC_LEAGUES_COLLECTION = "dynamic_leagues";

export const BASE_RULE_EFFECTIVE_DATE = "2000-01-01";
export const BASE_RULE_SYSTEM_STATUS = "System Default / Basis-Regelwerk";

function baseRuleId(leagueId: string): string {
  return `base_rule_${leagueId}_20000101`;
}

export const DEFAULT_INITIAL_LEAGUES: DynamicLeague[] = [
  { id: "herren_einzel", name: "Herren Einzel", active: true, isActive: true, status: "active", description: "Hobbyliga Herren", allowedGenders: ["m"], minAge: 18, displayOrder: 1 },
  { id: "damen_einzel", name: "Damen Einzel", active: true, isActive: true, status: "active", description: "Hobbyliga Damen", allowedGenders: ["w"], minAge: 18, displayOrder: 2 },
  { id: "open_mixed", name: "Offen", active: true, isActive: true, status: "active", description: "Hobbyliga Offen", displayOrder: 3 },
];

export function isLeagueActiveDoc(data: any): boolean {
  if (!data) return false;
  if (typeof data.status === 'string') {
    const s = data.status.toLowerCase().trim();
    if (s === 'inactive' || s === 'inaktiv' || s === 'disabled' || s === 'deactivated' || s === 'archived') {
      return false;
    }
    if (s === 'active' || s === 'aktiv' || s === 'enabled') {
      return true;
    }
  }
  if (data.isActive === false || data.active === false) return false;
  if (data.isActive === true || data.active === true) return true;
  return true;
}

export async function getDynamicLeagues(): Promise<DynamicLeague[]> {
  try {
    const map = new Map<string, DynamicLeague>();

    // 1. Try 'leagues' collection
    try {
      const snapLeagues = await getDocs(collection(db, LEAGUES_COLLECTION));
      snapLeagues.forEach((d) => {
        const data = d.data();
        const active = isLeagueActiveDoc(data);
        map.set(d.id, {
          id: d.id,
          name: data.name || data.title || data.bezeichnung || d.id,
          active,
          isActive: data.isActive ?? active,
          status: data.status || (active ? 'active' : 'inactive'),
          description: data.description || "",
          displayOrder: data.displayOrder ?? 0,
          allowedGenders: data.allowedGenders,
          minAge: typeof data.minAge === 'number' && !isNaN(data.minAge) ? data.minAge : null,
          maxAge: typeof data.maxAge === 'number' && !isNaN(data.maxAge) ? data.maxAge : null,
        });
      });
    } catch (e) {
      // ignore
    }

    // 2. Try 'dynamic_leagues' collection
    try {
      const snapDyn = await getDocs(collection(db, DYNAMIC_LEAGUES_COLLECTION));
      snapDyn.forEach((d) => {
        const data = d.data();
        const active = isLeagueActiveDoc(data);
        const existing = map.get(d.id);
        map.set(d.id, {
          id: d.id,
          name: data.name || data.title || data.bezeichnung || existing?.name || d.id,
          active,
          isActive: data.isActive ?? active,
          status: data.status || (active ? 'active' : 'inactive'),
          description: data.description || existing?.description || "",
          displayOrder: data.displayOrder ?? existing?.displayOrder ?? 0,
          allowedGenders: data.allowedGenders ?? existing?.allowedGenders,
          minAge: typeof data.minAge === 'number' && !isNaN(data.minAge) ? data.minAge : (existing?.minAge ?? null),
          maxAge: typeof data.maxAge === 'number' && !isNaN(data.maxAge) ? data.maxAge : (existing?.maxAge ?? null),
        });
      });
    } catch (e) {
      // ignore
    }

    if (map.size > 0) {
      const list = Array.from(map.values());
      return list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, 'de'));
    }

    return [...DEFAULT_INITIAL_LEAGUES];
  } catch (err) {
    console.error("Error fetching dynamic leagues:", err);
    return [...DEFAULT_INITIAL_LEAGUES];
  }
}

export function listenToDynamicLeagues(callback: (leagues: DynamicLeague[]) => void): () => void {
  const mapLeagues = new Map<string, DynamicLeague>();
  const mapDyn = new Map<string, DynamicLeague>();

  const emit = () => {
    const combined = new Map<string, DynamicLeague>();
    mapLeagues.forEach((v, k) => combined.set(k, v));
    mapDyn.forEach((v, k) => {
      const existing = combined.get(k);
      combined.set(k, {
        id: k,
        name: v.name !== k ? v.name : (existing?.name || k),
        active: v.active,
        isActive: v.isActive,
        status: v.status,
        description: v.description || existing?.description || "",
        displayOrder: v.displayOrder || existing?.displayOrder || 0,
        allowedGenders: v.allowedGenders || existing?.allowedGenders,
        minAge: v.minAge !== null ? v.minAge : (existing?.minAge ?? null),
        maxAge: v.maxAge !== null ? v.maxAge : (existing?.maxAge ?? null),
      });
    });

    if (combined.size === 0) {
      callback([...DEFAULT_INITIAL_LEAGUES]);
      return;
    }

    const list = Array.from(combined.values());
    callback(list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, 'de')));
  };

  let unsubLeagues = () => {};
  let unsubDyn = () => {};

  try {
    unsubLeagues = onSnapshot(collection(db, LEAGUES_COLLECTION), (snap) => {
      mapLeagues.clear();
      snap.forEach((d) => {
        const data = d.data();
        const active = isLeagueActiveDoc(data);
        mapLeagues.set(d.id, {
          id: d.id,
          name: data.name || data.title || data.bezeichnung || d.id,
          active,
          isActive: data.isActive ?? active,
          status: data.status || (active ? 'active' : 'inactive'),
          description: data.description || "",
          displayOrder: data.displayOrder ?? 0,
          allowedGenders: data.allowedGenders,
          minAge: typeof data.minAge === 'number' && !isNaN(data.minAge) ? data.minAge : null,
          maxAge: typeof data.maxAge === 'number' && !isNaN(data.maxAge) ? data.maxAge : null,
        });
      });
      emit();
    }, (err) => {
      console.warn("Could not listen to leagues collection:", err);
      emit();
    });
  } catch (e) {
    // ignore
  }

  try {
    unsubDyn = onSnapshot(collection(db, DYNAMIC_LEAGUES_COLLECTION), (snap) => {
      mapDyn.clear();
      snap.forEach((d) => {
        const data = d.data();
        const active = isLeagueActiveDoc(data);
        mapDyn.set(d.id, {
          id: d.id,
          name: data.name || data.title || data.bezeichnung || d.id,
          active,
          isActive: data.isActive ?? active,
          status: data.status || (active ? 'active' : 'inactive'),
          description: data.description || "",
          displayOrder: data.displayOrder ?? 0,
          allowedGenders: data.allowedGenders,
          minAge: typeof data.minAge === 'number' && !isNaN(data.minAge) ? data.minAge : null,
          maxAge: typeof data.maxAge === 'number' && !isNaN(data.maxAge) ? data.maxAge : null,
        });
      });
      emit();
    }, (err) => {
      console.warn("Could not listen to dynamic_leagues collection:", err);
      emit();
    });
  } catch (e) {
    // ignore
  }

  return () => {
    unsubLeagues();
    unsubDyn();
  };
}

export async function saveDynamicLeague(leagueData: {
  id?: string;
  name: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
  allowedGenders?: ("m" | "w" | "u")[];
  minAge?: number | string | null;
  maxAge?: number | string | null;
}): Promise<DynamicLeague> {
  let id = leagueData.id;
  if (!id) {
    const slug = leagueData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    id = slug || `league_${Date.now()}`;
  }
  const docRef = doc(db, DYNAMIC_LEAGUES_COLLECTION, id);
  const isActive = leagueData.active !== false;

  const parsedMinAge =
    leagueData.minAge !== undefined && leagueData.minAge !== null && (leagueData.minAge as any) !== "" && !isNaN(Number(leagueData.minAge))
      ? Number(leagueData.minAge)
      : null;

  const parsedMaxAge =
    leagueData.maxAge !== undefined && leagueData.maxAge !== null && (leagueData.maxAge as any) !== "" && !isNaN(Number(leagueData.maxAge))
      ? Number(leagueData.maxAge)
      : null;

  const toSave: Record<string, any> = {
    id,
    name: leagueData.name ? leagueData.name.trim() : "",
    description: leagueData.description ? leagueData.description.trim() : "",
    active: isActive,
    isActive: isActive,
    status: isActive ? "active" : "inactive",
    allowedGenders: Array.isArray(leagueData.allowedGenders) && leagueData.allowedGenders.length > 0 ? leagueData.allowedGenders : ["m", "w", "u"],
    minAge: parsedMinAge,
    maxAge: parsedMaxAge,
  };

  if (typeof leagueData.displayOrder === 'number' && !isNaN(leagueData.displayOrder)) {
    toSave.displayOrder = leagueData.displayOrder;
  }

  // Strip any accidental undefined keys before persisting to Firestore
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(toSave)) {
    if (val !== undefined) {
      cleaned[key] = val;
    }
  }

  await setDoc(docRef, cleaned, { merge: true });
  try {
    await setDoc(doc(db, LEAGUES_COLLECTION, id), cleaned, { merge: true });
  } catch (e) {
    // ignore
  }
  await ensureLeagueBaseRules([cleaned as DynamicLeague]);
  return cleaned as DynamicLeague;
}

export async function reorderDynamicLeagues(leagues: DynamicLeague[]): Promise<void> {
  const promises = leagues.map((league, idx) => {
    const docRef = doc(db, DYNAMIC_LEAGUES_COLLECTION, league.id);
    const updateData = { displayOrder: idx };
    const p1 = setDoc(docRef, updateData, { merge: true });
    const p2 = setDoc(doc(db, LEAGUES_COLLECTION, league.id), updateData, { merge: true }).catch(() => {});
    return Promise.all([p1, p2]);
  });
  await Promise.all(promises);
}

export async function toggleDynamicLeagueStatus(id: string, active: boolean): Promise<void> {
  const docRef = doc(db, DYNAMIC_LEAGUES_COLLECTION, id);
  const updateData = {
    active,
    isActive: active,
    status: active ? "active" : "inactive",
  };
  await setDoc(docRef, updateData, { merge: true });
  try {
    await setDoc(doc(db, LEAGUES_COLLECTION, id), updateData, { merge: true });
  } catch (e) {
    // ignore
  }
}

/**
 * Returns the count of registered matches for a specific league.
 */
export async function getLeagueMatchCount(leagueId: string): Promise<number> {
  if (!leagueId) return 0;
  try {
    const collRef = collection(db, LEAGUE_MATCHES_COLLECTION);
    const q = query(collRef, where("leagueId", "==", leagueId));
    const snap = await getDocs(q);

    // Also account for legacy matches where leagueId might have been omitted (defaulting to open_mixed)
    if (leagueId === "open_mixed") {
      const allMatchesSnap = await getDocs(collRef);
      let count = 0;
      allMatchesSnap.forEach((d) => {
        const m = d.data();
        if (m.leagueId === "open_mixed" || !m.leagueId) {
          count++;
        }
      });
      return count;
    }

    return snap.size;
  } catch (err) {
    console.error("Error getting match count for league:", leagueId, err);
    return 0;
  }
}

/**
 * Archives a dynamic league (Soft Delete).
 * Sets status: 'archived', active: false, isActive: false.
 * Removes leagueId from all player profiles assigned to this league.
 */
export async function archiveDynamicLeague(leagueId: string): Promise<{ success: boolean }> {
  if (!leagueId) {
    throw new Error("Ungültige Liga-ID.");
  }

  const updates = {
    status: 'archived',
    active: false,
    isActive: false,
    archivedAt: new Date().toISOString(),
  };

  try {
    await updateDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, leagueId), updates);
  } catch (e) {
    try {
      await setDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, leagueId), updates, { merge: true });
    } catch (err) {
      console.warn("Could not archive in dynamic_leagues:", err);
    }
  }

  try {
    await updateDoc(doc(db, LEAGUES_COLLECTION, leagueId), updates);
  } catch (e) {
    // ignore
  }

  // Remove leagueId from profiles assigned to this archived league
  try {
    const pSnap = await getDocs(query(collection(db, LEAGUE_PROFILES_COLLECTION), where("leagueId", "==", leagueId)));
    const profileUpdates: Promise<void>[] = [];
    pSnap.forEach((d) => {
      profileUpdates.push(updateDoc(d.ref, { leagueId: null, updatedAt: new Date().toISOString() }));
    });
    await Promise.all(profileUpdates);
  } catch (e) {
    console.warn("Could not reset player league assignments for archived league:", e);
  }

  return { success: true };
}

/**
 * Restores / reactivates an archived or inactive league.
 */
export async function restoreDynamicLeague(leagueId: string): Promise<{ success: boolean }> {
  if (!leagueId) {
    throw new Error("Ungültige Liga-ID.");
  }

  const updates = {
    status: 'active',
    active: true,
    isActive: true,
    unarchivedAt: new Date().toISOString(),
  };

  try {
    await updateDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, leagueId), updates);
  } catch (e) {
    try {
      await setDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, leagueId), updates, { merge: true });
    } catch (err) {
      console.warn("Could not restore in dynamic_leagues:", err);
    }
  }

  try {
    await updateDoc(doc(db, LEAGUES_COLLECTION, leagueId), updates);
  } catch (e) {
    // ignore
  }

  return { success: true };
}

/**
 * Resets all test data for a specific league.
 * - Creates an automatic safety snapshot before deleting (allows 1-click rollback in emergency).
 * - Keeps the league object, configuration, and player assignments.
 * - Deletes all matches, point logs (including admin corrections), and associated bookings for this league.
 * - Resets points of all assigned players to the initialPoints value.
 */
export async function resetLeagueTestData(leagueId: string, leagueName?: string): Promise<{ success: boolean; matchesDeleted: number; profilesReset: number; backupName: string }> {
  if (!leagueId) {
    throw new Error("Ungültige Liga-ID.");
  }

  // 0. Safety snapshot right before data deletion (isolated on-demand snapshot)
  const { createGlobalBackup } = await import("./db");
  const backup = await createGlobalBackup(
    "league-reset",
    undefined,
    `Sicherheits-Snapshot vor Testdaten-Reset (Liga: ${leagueName || leagueId})`
  );

  const { writeBatch } = await import("firebase/firestore");
  let batch = writeBatch(db);
  let batchCount = 0;
  let matchesDeleted = 0;
  let profilesReset = 0;

  // 1. Fetch all matches for this league
  const qMatches = query(collection(db, LEAGUE_MATCHES_COLLECTION), where("leagueId", "==", leagueId));
  const snapMatches = await getDocs(qMatches);

  for (const docSnap of snapMatches.docs) {
    const match = docSnap.data() as LeagueMatch;
    
    // Delete the match
    batch.delete(docSnap.ref);
    batchCount++;
    matchesDeleted++;

    // Delete associated booking if it exists
    if (match.bookingId && match.clubId) {
      const bookingRef = doc(db, `clubs/${match.clubId}/bookings`, match.bookingId);
      batch.delete(bookingRef);
      batchCount++;
    }

    if (batchCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // 2. Determine initial points from config
  const configs = await getLeagueConfigVersions(leagueId);
  let initialPoints = 0.0;
  if (configs && configs.length > 0) {
    const sorted = [...configs].sort((a,b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime());
    initialPoints = sorted[0].initial_ranking_points ?? 0.0;
  }

  // 3. Reset player profiles assigned to this league
  const qProfiles = query(collection(db, LEAGUE_PROFILES_COLLECTION), where("leagueId", "==", leagueId));
  const snapProfiles = await getDocs(qProfiles);

  for (const docSnap of snapProfiles.docs) {
    batch.update(docSnap.ref, {
      basePoints: initialPoints,
      matchesCount: 0,
      updatedAt: new Date().toISOString()
    });
    batchCount++;
    profilesReset++;

    if (batchCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { success: true, matchesDeleted, profilesReset, backupName: backup.name };
}

export async function getLeagueConfigVersions(leagueId?: string): Promise<LeagueConfigVersion[]> {
  try {
    const collRef = collection(db, LEAGUE_CONFIG_VERSIONS_COLLECTION);
    const snap = await getDocs(collRef);
    const versions: LeagueConfigVersion[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as LeagueConfigVersion;
      const isBase = data.effective_date === BASE_RULE_EFFECTIVE_DATE && Boolean(data.leagueId);
      // Old global defaults are retained in Firestore as a migration source, but
      // must not be displayed or selected as a league rule.
      if (!data.leagueId && data.effective_date === BASE_RULE_EFFECTIVE_DATE) return;
      versions.push({
        id: docSnap.id,
        ...data,
        is_base_rule: isBase,
        system_status: isBase ? (data.system_status || BASE_RULE_SYSTEM_STATUS) : data.system_status,
      } as LeagueConfigVersion);
    });

    const filtered = leagueId ? versions.filter(v => v.leagueId === leagueId) : versions;

    // Sort by effective_date ascending
    return filtered.sort((a, b) => (a.effective_date || '').localeCompare(b.effective_date || ''));
  } catch (err) {
    console.error("Error fetching league config versions:", err);
    return [];
  }
}

/** Ensures exactly one immutable base rule (01.01.2000) for every league. */
export async function ensureLeagueBaseRules(leagues: DynamicLeague[]): Promise<void> {
  if (leagues.length === 0) return;

  const snap = await getDocs(collection(db, LEAGUE_CONFIG_VERSIONS_COLLECTION));
  const existing = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueConfigVersion));
  const legacyTemplate = existing.find((v) =>
    v.effective_date === BASE_RULE_EFFECTIVE_DATE && !v.leagueId
  );

  await Promise.all(leagues.map(async (league) => {
    const canonicalId = baseRuleId(league.id);
    const alreadyExists = existing.some((v) =>
      v.leagueId === league.id && v.effective_date === BASE_RULE_EFFECTIVE_DATE
    );
    if (alreadyExists) return;

    const template = legacyTemplate || {
      base_points_win: 5,
      base_points_loss: 5,
      inactivity_deduction_per_week: 5,
      logistic_factor: 0.05,
      max_bonus: 45,
      initial_ranking_points: 0,
    };
    await setDoc(doc(db, LEAGUE_CONFIG_VERSIONS_COLLECTION, canonicalId), {
      id: canonicalId,
      leagueId: league.id,
      effective_date: BASE_RULE_EFFECTIVE_DATE,
      created_at: new Date("2000-01-01T00:00:00.000Z").toISOString(),
      created_by: "System-Migration",
      system_status: BASE_RULE_SYSTEM_STATUS,
      is_base_rule: true,
      base_points_win: Number(template.base_points_win ?? 5),
      base_points_loss: Number(template.base_points_loss ?? 5),
      inactivity_deduction_per_week: Number(template.inactivity_deduction_per_week ?? 5),
      logistic_factor: Number(template.logistic_factor ?? 0.05),
      max_bonus: Number(template.max_bonus ?? 45),
      initial_ranking_points: Number(template.initial_ranking_points ?? 0),
    }, { merge: true });
  }));
}

export async function saveLeagueConfigVersion(
  configData: Omit<LeagueConfigVersion, 'id' | 'created_at'> & { id?: string }
): Promise<LeagueConfigVersion> {
  const now = new Date().toISOString();
  let versionId = configData.id;
  const isBase = configData.effective_date === BASE_RULE_EFFECTIVE_DATE || configData.is_base_rule === true;

  if (isBase && !configData.leagueId) {
    throw new Error("Ein Basis-Regelwerk muss einer Liga zugeordnet sein.");
  }

  if (!versionId) {
    if (isBase) {
      versionId = baseRuleId(configData.leagueId!);
    } else {
      const newRef = doc(collection(db, LEAGUE_CONFIG_VERSIONS_COLLECTION));
      versionId = newRef.id;
    }
  }

  const effectiveDate = isBase ? BASE_RULE_EFFECTIVE_DATE : configData.effective_date;

  // Firestore rejects `undefined` anywhere in a document.  The former
  // implementation always added optional fields with an undefined value;
  // therefore saving a league rule failed before the document was written.
  const versionDoc: LeagueConfigVersion = {
    id: versionId,
    effective_date: effectiveDate,
    created_at: now,
    created_by: isBase ? (configData.created_by || 'System') : (configData.created_by || 'super-admin'),
    base_points_win: Number(configData.base_points_win),
    base_points_loss: Number(configData.base_points_loss),
    inactivity_deduction_per_week: Number(configData.inactivity_deduction_per_week),
    logistic_factor: Math.round((parseFloat(String(configData.logistic_factor).replace(',', '.')) || 0.05) * 10000) / 10000,
    max_bonus: Number(configData.max_bonus),
    initial_ranking_points: Number(configData.initial_ranking_points ?? 0),
  };

  if (configData.leagueId) {
    versionDoc.leagueId = configData.leagueId;
  }
  if (isBase) {
    versionDoc.system_status = BASE_RULE_SYSTEM_STATUS;
    versionDoc.is_base_rule = true;
  }

  const docRef = doc(db, LEAGUE_CONFIG_VERSIONS_COLLECTION, versionId);
  await setDoc(docRef, versionDoc, { merge: true });

  // Recalculate from effective_date
  await recalculateLeaguePointsFrom(effectiveDate);

  return versionDoc;
}

export async function deleteLeagueConfigVersion(versionId: string): Promise<void> {

  const docRef = doc(db, LEAGUE_CONFIG_VERSIONS_COLLECTION, versionId);
  const snap = await getDoc(docRef);
  let effectiveDate = '2026-01-01';
  if (snap.exists()) {
    const data = snap.data() as LeagueConfigVersion;
    if (data.effective_date === BASE_RULE_EFFECTIVE_DATE || data.is_base_rule) {
      throw new Error("Das Basis-Regelwerk (01.01.2000) ist unveränderlich und kann nicht gelöscht werden.");
    }
    if (data.effective_date) effectiveDate = data.effective_date;
  }
  await deleteDoc(docRef);

  // Recalculate from effective_date using remaining versions
  await recalculateLeaguePointsFrom(effectiveDate);
}

export async function recalculateLeaguePointsFrom(startDate: string): Promise<void> {
  // 1. Fetch versions
  const versions = await getLeagueConfigVersions();

  // 2. Fetch all profiles & matches
  const profiles = await getAllLeagueProfiles();
  const allMatches = await getAllLeagueMatches();

  // Map to track running player points and last match dates
  const runningPoints: Record<string, number> = {};
  const lastMatchDates: Record<string, string> = {};
  const matchesCountMap: Record<string, number> = {};

  for (const p of profiles) {
    runningPoints[p.userId] = 100; // initial points
    lastMatchDates[p.userId] = p.createdAt || "2026-01-01T00:00:00.000Z";
    matchesCountMap[p.userId] = 0;
  }

  // Filter completed matches and sort chronologically by match date (played_at / scheduledDate / reportedAt / createdAt)
  const completedMatches = allMatches
    .filter((m) => m.status === 'completed' && m.result)
    .sort((a, b) => {
      const dateA = a.played_at || a.result?.played_at || a.scheduledDate || a.result?.reportedAt || a.createdAt;
      const dateB = b.played_at || b.result?.played_at || b.scheduledDate || b.result?.reportedAt || b.createdAt;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  // Re-run matches in chronological order
  for (const match of completedMatches) {
    const matchDate = match.played_at || match.result?.played_at || match.scheduledDate || match.result?.reportedAt || match.createdAt;
    const config = getConfigForDate(versions, matchDate, match.leagueId);

    const p1Id = match.player1UserId;
    const p2Id = match.player2UserId;

    if (runningPoints[p1Id] === undefined) {
      runningPoints[p1Id] = 100;
      lastMatchDates[p1Id] = matchDate;
      matchesCountMap[p1Id] = 0;
    }
    if (runningPoints[p2Id] === undefined) {
      runningPoints[p2Id] = 100;
      lastMatchDates[p2Id] = matchDate;
      matchesCountMap[p2Id] = 0;
    }

    const p1Live = applyDecay(runningPoints[p1Id], lastMatchDates[p1Id], config, matchesCountMap[p1Id], matchDate);
    const p2Live = applyDecay(runningPoints[p2Id], lastMatchDates[p2Id], config, matchesCountMap[p2Id], matchDate);

    let p1New = p1Live;
    let p2New = p2Live;
    let p1Awarded = 0;
    let p2Awarded = 0;

    if (match.isManualAdjustment || match.entryType === 'ADMIN_CORRECTION') {
      if (match.correctionType === 'relative' && match.pointsDelta !== undefined) {
        p1New = Math.max(0, Number((p1Live + match.pointsDelta).toFixed(1)));
        p1Awarded = match.pointsDelta;
      } else if (match.newTotalPoints !== undefined) {
        p1New = match.newTotalPoints;
        p1Awarded = Number((p1New - p1Live).toFixed(1));
      } else if (match.manualPointsValue !== undefined) {
        p1New = match.manualPointsValue;
        p1Awarded = Number((p1New - p1Live).toFixed(1));
      }
      p2Awarded = 0; // p2 is not affected in manual adjustment
      p2New = p2Live;
    } else {
      const isP1Winner = match.result?.winnerId === p1Id;
      p1New = calculatePoints(p1Live, p2Live, isP1Winner, config);
      p2New = calculatePoints(p2Live, p1Live, !isP1Winner, config);
      p1Awarded = Number((p1New - p1Live).toFixed(1));
      p2Awarded = Number((p2New - p2Live).toFixed(1));
    }

    const pointsAwarded = {
      player1: p1Awarded,
      player2: p2Awarded,
    };

    // Update match document
    const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, match.id);
    await updateDoc(matchRef, {
      pointsAwarded,
      updatedAt: new Date().toISOString(),
    });

    runningPoints[p1Id] = p1New;
    lastMatchDates[p1Id] = matchDate;
    if (!match.isManualAdjustment && match.entryType !== 'ADMIN_CORRECTION') {
      matchesCountMap[p1Id] = (matchesCountMap[p1Id] || 0) + 1;
    }

    if (!match.isManualAdjustment && match.entryType !== 'ADMIN_CORRECTION') {
      runningPoints[p2Id] = p2New;
      lastMatchDates[p2Id] = matchDate;
      matchesCountMap[p2Id] = (matchesCountMap[p2Id] || 0) + 1;
    }
  }

  // Update profile documents in Firestore for all players
  const nowIso = new Date().toISOString();
  const allUserIds = Array.from(new Set([...profiles.map(p => p.userId), ...Object.keys(runningPoints)]));
  for (const pId of allUserIds) {
    if (!pId) continue;
    const existingP = profiles.find(p => p.userId === pId);
    const currentConfig = getConfigForDate(versions, nowIso, existingP?.leagueId);
    const rawBase = runningPoints[pId] !== undefined ? runningPoints[pId] : (existingP?.basePoints ?? 100);
    const pLastMatch = lastMatchDates[pId] || existingP?.lastMatchDate || nowIso;
    const pCount = matchesCountMap[pId] !== undefined ? matchesCountMap[pId] : (existingP?.matchesCount || 0);

    const finalPoints = applyDecay(rawBase, pLastMatch, currentConfig, pCount, nowIso);

    const pRef = doc(db, LEAGUE_PROFILES_COLLECTION, pId);
    await setDoc(pRef, {
      id: pId,
      userId: pId,
      clubId: existingP?.clubId || "sv-neuhausen",
      basePoints: Number(finalPoints.toFixed(1)),
      lastMatchDate: pLastMatch,
      matchesCount: pCount,
      updatedAt: nowIso,
    }, { merge: true });
  }
}

export async function getLeagueProfile(userId: string): Promise<LeaguePlayer | null> {
  const docRef = doc(db, LEAGUE_PROFILES_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as LeaguePlayer;
  }
  return null;
}

export async function createLeagueProfile(
  userId: string,
  clubId: string,
  initialPoints: number,
  leagueId?: string
): Promise<LeaguePlayer> {
  const now = new Date().toISOString();
  const profile: LeaguePlayer = {
    id: userId,
    userId,
    clubId,
    leagueId,
    basePoints: initialPoints,
    lastMatchDate: now,
    preferences: [],
    matchesCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  await setDoc(doc(db, LEAGUE_PROFILES_COLLECTION, userId), profile);
  return profile;
}

export async function updatePlayerLeagueAssignment(
  userId: string,
  newLeagueId: string,
  options?: {
    clubId?: string;
    manualPointsOverride?: number | "";
    manualPointsReason?: string;
    adminName?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const basePoints = (options?.manualPointsOverride !== undefined && options.manualPointsOverride !== "")
    ? Number(options.manualPointsOverride)
    : 100;

  const pRef = doc(db, LEAGUE_PROFILES_COLLECTION, userId);
  await setDoc(pRef, {
    id: userId,
    userId,
    clubId: options?.clubId || "sv-neuhausen",
    leagueId: newLeagueId,
    basePoints,
    lastMatchDate: now,
    matchesCount: 0,
    updatedAt: now,
  }, { merge: true });

  if (options?.manualPointsOverride !== undefined && options.manualPointsOverride !== "") {
    await createLeagueMatch({
      clubId: options.clubId || "sv-neuhausen",
      leagueId: newLeagueId,
      player1Id: userId,
      player2Id: "system",
      player1UserId: userId,
      player2UserId: "system",
      status: 'completed',
      isManualAdjustment: true,
      manualPointsValue: Number(options.manualPointsOverride),
      manualAdjustmentReason: options.manualPointsReason || `Liga-Wechsel (${newLeagueId})`,
      played_at: now,
      result: {
        winnerId: userId,
        sets: [],
        reportedBy: options.adminName || "Admin",
        reportedAt: now,
      }
    });
  }
}

export async function updateLeaguePreferences(
  userId: string,
  preferences: LeagueTimePreference[]
): Promise<void> {
  const docRef = doc(db, LEAGUE_PROFILES_COLLECTION, userId);
  await updateDoc(docRef, {
    preferences,
    updatedAt: new Date().toISOString(),
  });
}

export async function getAllLeagueProfiles(clubId?: string): Promise<LeaguePlayer[]> {
  const collRef = collection(db, LEAGUE_PROFILES_COLLECTION);
  const q = clubId ? query(collRef, where("clubId", "==", clubId)) : query(collRef);
  const querySnapshot = await getDocs(q);
  const profiles: LeaguePlayer[] = [];
  querySnapshot.forEach((doc) => {
    profiles.push(doc.data() as LeaguePlayer);
  });
  return profiles;
}

export async function createLeagueMatch(
  match: Omit<LeagueMatch, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LeagueMatch> {
  // Validate player-level time collisions across all clubs and matches
  if (match.scheduledDate && match.scheduledStartTime && match.scheduledEndTime) {
    const collision = await checkPlayerCollisionAsync({
      date: match.scheduledDate,
      startTime: match.scheduledStartTime,
      endTime: match.scheduledEndTime,
      players: [
        { id: match.player1UserId || match.player1Id, name: (match as any).player1Name },
        { id: match.player2UserId || match.player2Id, name: (match as any).player2Name },
      ],
      currentClubId: match.clubId,
    });
    if (collision) {
      throw new Error(collision.errorMessage);
    }
  }

  const matchRef = doc(collection(db, LEAGUE_MATCHES_COLLECTION));
  const rawMatch: Record<string, any> = {
    ...match,
    id: matchRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const cleanMatch: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawMatch)) {
    if (value !== undefined) {
      cleanMatch[key] = value;
    }
  }
  await setDoc(matchRef, cleanMatch);
  return cleanMatch as LeagueMatch;
}

export async function getAllLeagueMatches(clubId?: string): Promise<LeagueMatch[]> {
  try {
    const collRef = collection(db, LEAGUE_MATCHES_COLLECTION);
    const q = clubId ? query(collRef, where("clubId", "==", clubId)) : query(collRef);
    const querySnapshot = await getDocs(q);
    const matchesMap = new Map<string, LeagueMatch>();
    querySnapshot.forEach((docSnap) => {
      matchesMap.set(docSnap.id, docSnap.data() as LeagueMatch);
    });
    return Array.from(matchesMap.values()).sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
  } catch (e) {
    console.error("Error fetching all league matches:", e);
    return [];
  }
}

export async function getPlayerMatches(userId: string): Promise<LeagueMatch[]> {
  // Need to query where player1UserId == userId OR player2UserId == userId
  // Firestore doesn't support OR natively in a simple way without composite indexes for this,
  // so we do two queries and merge them.
  const q1 = query(
    collection(db, LEAGUE_MATCHES_COLLECTION),
    where("player1UserId", "==", userId)
  );
  const q2 = query(
    collection(db, LEAGUE_MATCHES_COLLECTION),
    where("player2UserId", "==", userId)
  );
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const matchesMap = new Map<string, LeagueMatch>();
  
  snap1.forEach(doc => matchesMap.set(doc.id, doc.data() as LeagueMatch));
  snap2.forEach(doc => matchesMap.set(doc.id, doc.data() as LeagueMatch));
  
  return Array.from(matchesMap.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateLeagueMatchResult(
  matchId: string,
  result: LeagueMatch['result'],
  pointsAwarded: LeagueMatch['pointsAwarded'],
  player1NewPoints: number,
  player2NewPoints: number,
  player1Id: string,
  player2Id: string,
  options?: {
    reportedByUserId?: string;
    isProvisional?: boolean;
    provisionalUntil?: string;
  }
): Promise<void> {
  const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, matchId);
  const now = new Date().toISOString();
  const provisionalUntil = options?.provisionalUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  const cleanedSets = (result?.sets || []).map(s => ({
    p1: typeof s.p1 === 'number' ? s.p1 : 0,
    p2: typeof s.p2 === 'number' ? s.p2 : 0,
    tb1: s.tb1 !== undefined && s.tb1 !== null ? Number(s.tb1) : null,
    tb2: s.tb2 !== undefined && s.tb2 !== null ? Number(s.tb2) : null,
  }));

  const cleanedResult: Record<string, any> = {
    winnerId: result?.winnerId || null,
    sets: cleanedSets,
    reportedBy: result?.reportedBy || player1Id,
    reportedAt: result?.reportedAt || now,
    played_at: result?.played_at || null,
    retiredPlayerId: result?.retiredPlayerId || null,
    completionType: result?.completionType || 'regular',
    abandonmentReason: result?.abandonmentReason || null,
  };

  // Safely copy any extra non-undefined fields (e.g. comment if present)
  if (result) {
    for (const [k, v] of Object.entries(result)) {
      if (v !== undefined && !(k in cleanedResult)) {
        cleanedResult[k] = v;
      }
    }
  }

  // Update match
  await updateDoc(matchRef, {
    status: 'completed',
    completionType: result?.completionType || 'regular',
    result: cleanedResult,
    pointsAwarded: pointsAwarded || null,
    isProvisional: options?.isProvisional !== undefined ? options.isProvisional : true,
    provisionalUntil,
    reportedAt: result?.reportedAt || now,
    reportedByUserId: options?.reportedByUserId || result?.reportedBy || player1Id,
    updatedAt: now
  });
  
  // Update players
  const p1Ref = doc(db, LEAGUE_PROFILES_COLLECTION, player1Id);
  const p2Ref = doc(db, LEAGUE_PROFILES_COLLECTION, player2Id);
  
  await setDoc(p1Ref, {
    id: player1Id,
    userId: player1Id,
    basePoints: player1NewPoints,
    lastMatchDate: now,
    matchesCount: increment(1),
    updatedAt: now
  }, { merge: true });
  
  await setDoc(p2Ref, {
    id: player2Id,
    userId: player2Id,
    basePoints: player2NewPoints,
    lastMatchDate: now,
    matchesCount: increment(1),
    updatedAt: now
  }, { merge: true });
}

export async function editLeagueMatchResult(
  matchId: string,
  updatedResult: {
    winnerId?: string;
    sets: { p1: number; p2: number; tb1?: number; tb2?: number }[];
    played_at?: string;
    retiredPlayerId?: string;
    completionType?: 'regular' | 'retired' | 'aborted';
    abandonmentReason?: string;
  },
  editorUserId: string
): Promise<void> {
  const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) {
    throw new Error("Match nicht gefunden.");
  }
  const matchData = snap.data() as LeagueMatch;
  if (matchData.status !== "completed" && matchData.status !== "aborted") {
    throw new Error("Dieses Match ist nicht abgeschlossen.");
  }

  const now = new Date().toISOString();
  const cleanedSets = (updatedResult.sets || []).map(s => ({
    p1: typeof s.p1 === 'number' ? s.p1 : 0,
    p2: typeof s.p2 === 'number' ? s.p2 : 0,
    tb1: s.tb1 !== undefined && s.tb1 !== null ? Number(s.tb1) : null,
    tb2: s.tb2 !== undefined && s.tb2 !== null ? Number(s.tb2) : null,
  }));

  await updateDoc(matchRef, {
    status: updatedResult.completionType === 'aborted' ? 'aborted' : 'completed',
    completionType: updatedResult.completionType || 'regular',
    abandonmentReason: updatedResult.abandonmentReason || deleteField(),
    result: {
      ...matchData.result,
      winnerId: updatedResult.winnerId || deleteField(),
      sets: cleanedSets,
      played_at: updatedResult.played_at || matchData.result?.played_at || matchData.played_at || matchData.scheduledDate,
      retiredPlayerId: updatedResult.retiredPlayerId || deleteField(),
      completionType: updatedResult.completionType || 'regular',
      abandonmentReason: updatedResult.abandonmentReason || deleteField(),
    },
    played_at: updatedResult.played_at || matchData.played_at || matchData.scheduledDate,
    lastModifiedBy: editorUserId,
    lastModifiedAt: now,
    updatedAt: now,
  });

  // Chronologically recalculate points starting from this match's date
  const recalculateFromDate = matchData.played_at || matchData.result?.played_at || matchData.scheduledDate || "2026-01-01";
  await recalculateLeaguePointsFrom(recalculateFromDate);
}

export async function abortLeagueMatch(
  matchId: string,
  data: {
    sets?: { p1: number; p2: number; tb1?: number; tb2?: number }[];
    abandonmentReason: string;
    played_at: string;
  },
  reportingUserId: string
): Promise<void> {
  const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) {
    throw new Error("Match nicht gefunden.");
  }
  const matchData = snap.data() as LeagueMatch;
  const now = new Date().toISOString();

  const cleanedSets = (data.sets || []).map(s => ({
    p1: typeof s.p1 === 'number' ? s.p1 : 0,
    p2: typeof s.p2 === 'number' ? s.p2 : 0,
    tb1: s.tb1 !== undefined && s.tb1 !== null ? Number(s.tb1) : null,
    tb2: s.tb2 !== undefined && s.tb2 !== null ? Number(s.tb2) : null,
  }));

  await updateDoc(matchRef, {
    status: "aborted",
    completionType: "aborted",
    abandonmentReason: data.abandonmentReason,
    result: {
      sets: cleanedSets,
      reportedBy: reportingUserId,
      reportedAt: now,
      played_at: data.played_at,
      completionType: "aborted",
      abandonmentReason: data.abandonmentReason,
    },
    played_at: data.played_at,
    pointsAwarded: deleteField(),
    isProvisional: false,
    provisionalUntil: deleteField(),
    reportedByUserId: reportingUserId,
    reportedAt: now,
    lastModifiedBy: reportingUserId,
    lastModifiedAt: now,
    updatedAt: now,
  });

  const recalculateFromDate = matchData.played_at || matchData.result?.played_at || matchData.scheduledDate || data.played_at || "2026-01-01";
  await recalculateLeaguePointsFrom(recalculateFromDate);
}

export async function cancelLeagueMatchResult(
  matchId: string,
  cancellingUserId: string
): Promise<void> {
  const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) {
    throw new Error("Match nicht gefunden.");
  }
  const matchData = snap.data() as LeagueMatch;

  const now = new Date().toISOString();
  // Reset back to scheduled and clear result fields
  await updateDoc(matchRef, {
    status: "scheduled",
    result: deleteField(),
    pointsAwarded: deleteField(),
    isProvisional: deleteField(),
    provisionalUntil: deleteField(),
    reportedAt: deleteField(),
    reportedByUserId: deleteField(),
    lastModifiedBy: cancellingUserId,
    lastModifiedAt: now,
    updatedAt: now,
  });

  // Chronologically recalculate points from this match's date
  const recalculateFromDate = matchData.played_at || matchData.result?.played_at || matchData.scheduledDate || "2026-01-01";
  await recalculateLeaguePointsFrom(recalculateFromDate);
}

export async function getLeaguePartnerSearches(clubId?: string): Promise<LeaguePartnerSearch[]> {
  try {
    let q;
    if (clubId) {
      q = query(collection(db, LEAGUE_SEARCHES_COLLECTION), where("clubId", "==", clubId));
    } else {
      q = query(collection(db, LEAGUE_SEARCHES_COLLECTION));
    }
    const snap = await getDocs(q);
    const searches: LeaguePartnerSearch[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as LeaguePartnerSearch;
      if (!data.expiresAt || data.expiresAt >= todayStr) {
        searches.push({
          ...data,
          id: docSnap.id || data.id || data.userId,
          userId: data.userId || docSnap.id,
        });
      }
    });
    return searches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  } catch (e) {
    console.error("Error fetching league partner searches:", e);
    return [];
  }
}

export async function saveLeaguePartnerSearch(
  userId: string,
  clubId: string,
  availabilityText: string,
  expiresAt: string,
  userName?: string,
  clubName?: string,
  showContactInfo?: boolean
): Promise<LeaguePartnerSearch> {
  const docRef = doc(db, LEAGUE_SEARCHES_COLLECTION, userId);
  const now = new Date().toISOString();
  const search: LeaguePartnerSearch = {
    id: userId,
    userId,
    clubId,
    availabilityText,
    expiresAt,
    showContactInfo,
    userName,
    clubName,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef, search, { merge: true });
  return search;
}

export async function renewLeaguePartnerSearch(
  userId: string,
  daysToExtend: number = 14
): Promise<void> {
  const docRef = doc(db, LEAGUE_SEARCHES_COLLECTION, userId);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysToExtend);
  const newExpiry = expiryDate.toISOString().split('T')[0];
  const now = new Date().toISOString();
  try {
    await updateDoc(docRef, {
      expiresAt: newExpiry,
      updatedAt: now,
    });
  } catch (err) {
    // If doc ID was different, find by userId
    const q = query(collection(db, LEAGUE_SEARCHES_COLLECTION), where("userId", "==", userId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(d.ref, {
        expiresAt: newExpiry,
        updatedAt: now,
      });
    }
  }
}

export async function deleteLeaguePartnerSearch(searchIdOrUserId: string): Promise<void> {
  if (!searchIdOrUserId) return;
  try {
    const docRef = doc(db, LEAGUE_SEARCHES_COLLECTION, searchIdOrUserId);
    await deleteDoc(docRef);
  } catch (e) {
    // ignore
  }
  try {
    const q = query(collection(db, LEAGUE_SEARCHES_COLLECTION), where("userId", "==", searchIdOrUserId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    // ignore
  }
}

export async function mergeLeagueProfiles(
  targetUserId: string,
  sourceUserId: string,
  options?: { skipRecalculation?: boolean }
): Promise<{ oldestMatchDate: string | null }> {
  const collRef = collection(db, LEAGUE_MATCHES_COLLECTION);
  const qSource1 = query(collRef, where("player1UserId", "==", sourceUserId));
  const qSource2 = query(collRef, where("player2UserId", "==", sourceUserId));

  const [snap1, snap2] = await Promise.all([getDocs(qSource1), getDocs(qSource2)]);
  
  const matchesToProcess = new Map<string, LeagueMatch>();
  snap1.forEach(doc => matchesToProcess.set(doc.id, { id: doc.id, ...doc.data() } as LeagueMatch));
  snap2.forEach(doc => matchesToProcess.set(doc.id, { id: doc.id, ...doc.data() } as LeagueMatch));

  if (matchesToProcess.size === 0) {
    try {
      await deleteDoc(doc(db, "league_profiles", sourceUserId));
    } catch(e) {}
    return { oldestMatchDate: null };
  }

  let oldestMatchDate: string | null = null;
  const updatePromises: Promise<void>[] = [];

  for (const match of Array.from(matchesToProcess.values())) {
    const matchDate = match.played_at || match.result?.played_at || match.scheduledDate || match.result?.reportedAt || match.createdAt || new Date().toISOString();
    
    if (!oldestMatchDate || new Date(matchDate) < new Date(oldestMatchDate)) {
      oldestMatchDate = matchDate;
    }

    const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, match.id);
    const isConflict = (match.player1UserId === targetUserId && match.player2UserId === sourceUserId) || 
                       (match.player1UserId === sourceUserId && match.player2UserId === targetUserId);

    if (isConflict) {
      updatePromises.push(updateDoc(matchRef, { status: "cancelled", updatedAt: new Date().toISOString() }));
    } else {
      const updates: any = { updatedAt: new Date().toISOString() };
      if (match.player1UserId === sourceUserId) {
        updates.player1UserId = targetUserId;
        updates.player1Id = targetUserId;
      }
      if (match.player2UserId === sourceUserId) {
        updates.player2UserId = targetUserId;
        updates.player2Id = targetUserId;
      }
      if (match.result && match.result.winnerId === sourceUserId) {
        updates["result.winnerId"] = targetUserId;
      }
      updatePromises.push(updateDoc(matchRef, updates));
    }
  }

  await Promise.all(updatePromises);
  
  try {
    await deleteDoc(doc(db, "league_profiles", sourceUserId));
  } catch(e) {}

  if (oldestMatchDate && !options?.skipRecalculation) {
    await recalculateLeaguePointsFrom(oldestMatchDate);
  }

  return { oldestMatchDate };
}

export async function checkLeagueMergeConflicts(personAId: string, personBId: string): Promise<number> {
  const collRef = collection(db, LEAGUE_MATCHES_COLLECTION);
  const q1 = query(collRef, where("player1UserId", "==", personAId), where("player2UserId", "==", personBId));
  const q2 = query(collRef, where("player1UserId", "==", personBId), where("player2UserId", "==", personAId));
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  return snap1.size + snap2.size;
}

export async function joinDynamicLeague(userId: string, leagueId: string): Promise<void> {
  const docRef = doc(db, LEAGUE_PROFILES_COLLECTION, userId);
  await updateDoc(docRef, { leagueId, updatedAt: new Date().toISOString() });
}

export interface AdminPointsCorrectionParams {
  playerIds: string[];
  mode: 'absolute' | 'relative';
  value: number;
  reason: string;
  adminUser: { id: string; name?: string; email?: string };
}

export interface AdminPointsCorrectionResult {
  success: boolean;
  count: number;
  results: Array<{
    userId: string;
    previousPoints: number;
    delta: number;
    newTotalPoints: number;
  }>;
}

export async function applyAdminPointsCorrection(
  params: AdminPointsCorrectionParams
): Promise<AdminPointsCorrectionResult> {
  const { playerIds, mode, value, reason, adminUser } = params;
  if (!playerIds || playerIds.length === 0) {
    return { success: true, count: 0, results: [] };
  }

  const now = new Date().toISOString();
  const results: Array<{
    userId: string;
    previousPoints: number;
    delta: number;
    newTotalPoints: number;
  }> = [];

  for (const userId of playerIds) {
    if (!userId) continue;
    const playerRef = doc(db, LEAGUE_PROFILES_COLLECTION, userId);
    const snap = await getDoc(playerRef);
    const existingP = snap.exists() ? (snap.data() as LeaguePlayer) : null;

    const previousPoints =
      existingP && typeof existingP.basePoints === 'number' && !isNaN(existingP.basePoints)
        ? existingP.basePoints
        : 0;

    let newTotalPoints = 0;
    if (mode === 'absolute') {
      newTotalPoints = Number(value.toFixed(1));
    } else {
      newTotalPoints = Math.max(0, Number((previousPoints + value).toFixed(1)));
    }

    const delta = Number((newTotalPoints - previousPoints).toFixed(1));

    // 1. Create audit trail history record in league_matches
    const matchDocRef = doc(collection(db, LEAGUE_MATCHES_COLLECTION));
    const historyEntry: LeagueMatch = {
      id: matchDocRef.id,
      entryType: 'ADMIN_CORRECTION',
      isManualAdjustment: true,
      correctionType: mode,
      pointsDelta: delta,
      newTotalPoints: newTotalPoints,
      adminUserId: adminUser.id,
      adminName: adminUser.name || adminUser.email || 'Super-Admin',
      reason: reason.trim(),
      manualAdjustmentReason: reason.trim(),
      manualPointsValue: newTotalPoints,
      clubId: existingP?.clubId || 'sv-neuhausen',
      leagueId: existingP?.leagueId || '',
      player1Id: userId,
      player2Id: 'system',
      player1UserId: userId,
      player2UserId: 'system',
      status: 'completed',
      played_at: now,
      reportedAt: now,
      reportedByUserId: adminUser.id,
      pointsAwarded: {
        player1: delta,
        player2: 0,
      },
      result: {
        winnerId: userId,
        sets: [],
        reportedBy: adminUser.name || adminUser.email || 'Super-Admin',
        reportedAt: now,
        played_at: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(matchDocRef, historyEntry);

    // 2. Update LeaguePlayer document with new basePoints and timestamp
    await setDoc(
      playerRef,
      {
        id: userId,
        userId: userId,
        clubId: existingP?.clubId || 'sv-neuhausen',
        leagueId: existingP?.leagueId || '',
        basePoints: newTotalPoints,
        lastMatchDate: now,
        updatedAt: now,
      },
      { merge: true }
    );

    results.push({
      userId,
      previousPoints,
      delta,
      newTotalPoints,
    });
  }

  return {
    success: true,
    count: results.length,
    results,
  };
}

