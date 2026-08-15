import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, Timestamp, increment, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LeaguePlayer, LeagueMatch, LeagueTimePreference, LeaguePartnerSearch, LeagueConfigVersion, DynamicLeague } from "../types";
import { getConfigForDate, applyDecay, calculatePoints, defaultConfig } from "./leagueEngine";

export const LEAGUE_PROFILES_COLLECTION = "league_profiles";
export const LEAGUE_MATCHES_COLLECTION = "league_matches";
export const LEAGUE_SEARCHES_COLLECTION = "league_searches";
export const LEAGUE_CONFIG_VERSIONS_COLLECTION = "league_config_versions";
export const DYNAMIC_LEAGUES_COLLECTION = "dynamic_leagues";

export const BASE_RULE_EFFECTIVE_DATE = "2000-01-01";
export const BASE_RULE_SYSTEM_STATUS = "System Default / Basis-Regelwerk";

function baseRuleId(leagueId: string): string {
  return `base_rule_${leagueId}_20000101`;
}

export const DEFAULT_INITIAL_LEAGUES: DynamicLeague[] = [
  { id: "herren", name: "Herren", active: true, description: "Hobbyliga Herren", displayOrder: 1 },
  { id: "damen", name: "Damen", active: true, description: "Hobbyliga Damen", displayOrder: 2 },
];

export async function getDynamicLeagues(): Promise<DynamicLeague[]> {
  try {
    const collRef = collection(db, DYNAMIC_LEAGUES_COLLECTION);
    const snap = await getDocs(collRef);
    if (snap.empty) {
      for (const league of DEFAULT_INITIAL_LEAGUES) {
        await setDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, league.id), league, { merge: true });
      }
      return [...DEFAULT_INITIAL_LEAGUES];
    }
    const leagues: DynamicLeague[] = [];
    snap.forEach((d) => {
      const data = d.data();
      leagues.push({
        id: d.id,
        name: data.name || d.id,
        active: data.active !== false,
        description: data.description || "",
        displayOrder: data.displayOrder ?? 0,
      });
    });
    return leagues.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name));
  } catch (err) {
    console.error("Error fetching dynamic leagues:", err);
    return [...DEFAULT_INITIAL_LEAGUES];
  }
}

export function listenToDynamicLeagues(callback: (leagues: DynamicLeague[]) => void): () => void {
  const collRef = collection(db, DYNAMIC_LEAGUES_COLLECTION);
  return onSnapshot(collRef, async (snap) => {
    if (snap.empty) {
      try {
        for (const league of DEFAULT_INITIAL_LEAGUES) {
          await setDoc(doc(db, DYNAMIC_LEAGUES_COLLECTION, league.id), league, { merge: true });
        }
      } catch (e) {
        console.error("Error auto-seeding dynamic leagues:", e);
      }
      callback([...DEFAULT_INITIAL_LEAGUES]);
      return;
    }
    const leagues: DynamicLeague[] = [];
    snap.forEach((d) => {
      const data = d.data();
      leagues.push({
        id: d.id,
        name: data.name || d.id,
        active: data.active !== false,
        description: data.description || "",
        displayOrder: data.displayOrder ?? 0,
      });
    });
    callback(leagues.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)));
  }, (err) => {
    console.error("Error listening to dynamic leagues:", err);
    callback([...DEFAULT_INITIAL_LEAGUES]);
  });
}

export async function saveDynamicLeague(leagueData: {
  id?: string;
  name: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
}): Promise<DynamicLeague> {
  let id = leagueData.id;
  if (!id) {
    const slug = leagueData.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    id = slug || `league_${Date.now()}`;
  }
  const docRef = doc(db, DYNAMIC_LEAGUES_COLLECTION, id);
  const toSave: DynamicLeague = {
    id,
    name: leagueData.name.trim(),
    description: leagueData.description?.trim() || "",
    active: leagueData.active !== false,
    displayOrder: leagueData.displayOrder ?? 0,
  };
  await setDoc(docRef, toSave, { merge: true });
  await ensureLeagueBaseRules([toSave]);
  return toSave;
}

export async function toggleDynamicLeagueStatus(id: string, active: boolean): Promise<void> {
  const docRef = doc(db, DYNAMIC_LEAGUES_COLLECTION, id);
  await updateDoc(docRef, { active });
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
    logistic_factor: Number(configData.logistic_factor),
    max_bonus: Number(configData.max_bonus),
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

    if (match.isManualAdjustment) {
      if (match.manualPointsValue !== undefined) {
        p1New = match.manualPointsValue;
      }
      p1Awarded = Number((p1New - p1Live).toFixed(1));
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
    if (!match.isManualAdjustment) {
      matchesCountMap[p1Id] = (matchesCountMap[p1Id] || 0) + 1;
    }

    if (!match.isManualAdjustment) {
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
  const matchRef = doc(collection(db, LEAGUE_MATCHES_COLLECTION));
  const newMatch: LeagueMatch = {
    ...match,
    id: matchRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(matchRef, newMatch);
  return newMatch;
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
  player2Id: string
): Promise<void> {
  const matchRef = doc(db, LEAGUE_MATCHES_COLLECTION, matchId);
  const now = new Date().toISOString();
  
  // Update match
  await updateDoc(matchRef, {
    status: 'completed',
    result,
    pointsAwarded,
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
        searches.push(data);
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
  clubName?: string
): Promise<LeaguePartnerSearch> {
  const docRef = doc(db, LEAGUE_SEARCHES_COLLECTION, userId);
  const now = new Date().toISOString();
  const search: LeaguePartnerSearch = {
    id: userId,
    userId,
    clubId,
    availabilityText,
    expiresAt,
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
  await updateDoc(docRef, {
    expiresAt: newExpiry,
    updatedAt: now,
  });
}

export async function deleteLeaguePartnerSearch(userId: string): Promise<void> {
  const docRef = doc(db, LEAGUE_SEARCHES_COLLECTION, userId);
  await deleteDoc(docRef);
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
