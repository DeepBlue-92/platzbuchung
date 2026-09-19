import { Person, Mitgliedschaft, Verein, Role } from "../types";
import { db } from "../lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, getDoc } from "firebase/firestore";
import { mergeLeagueProfiles } from "./league";

export interface DuplicatePair {
  id: string;
  personA: Person;
  personB: Person;
  membershipsA: Mitgliedschaft[];
  membershipsB: Mitgliedschaft[];
  score: number;
  level: "Sehr hohe Übereinstimmung" | "Hohe Übereinstimmung" | "Mittlere Übereinstimmung";
  matchedFields: string[];
}

export interface PrivacySafeCandidate {
  personId: string;
  firstName: string;
  lastName: string;
  gender?: string;
  emailMatched?: boolean;
  nameMatched?: boolean;
  hasAdminInOtherClub?: boolean;
  otherClubNames?: string[];
}

// Helper to normalize strings for comparison
export function normalizeString(str: any): string {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

// List of known test / placeholder phone number patterns to ignore
const DUMMY_PHONE_PATTERNS = [
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "0123456789",
  "08912345",
  "8912345",
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "00000000",
  "11111111",
  "99999999",
];

// Helper to normalize phone numbers (e.g., +49 170 1234567 -> 1701234567)
export function normalizePhone(phone: any): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^0-9]/g, "");
  if (cleaned.startsWith("49")) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  
  // Ignore dummy/test numbers
  if (cleaned.length < 6) return "";
  for (const dummy of DUMMY_PHONE_PATTERNS) {
    if (cleaned === dummy || cleaned.endsWith(dummy)) {
      return "";
    }
  }
  // Check for repetitive sequences like all same digits
  if (/^(\d)\1+$/.test(cleaned)) {
    return "";
  }

  return cleaned;
}

// Levenshtein distance calculation for fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = 0; i <= n; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= m; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[n][m];
}

// Calculate similarity ratio (0 to 1)
export function calculateSimilarity(s1: any, s2: any): number {
  const norm1 = normalizeString(s1);
  const norm2 = normalizeString(s2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(norm1, norm2);
  return (maxLen - distance) / maxLen;
}

// Calculate matching score between two persons
export function calculatePersonMatchScore(
  p1: { firstName?: string; lastName?: string; name?: string; email?: string; phone?: string; birthDate?: string; is_placeholder_email?: boolean },
  p2: { firstName?: string; lastName?: string; name?: string; email?: string; phone?: string; birthDate?: string; is_placeholder_email?: boolean }
): { score: number; level: "Sehr hohe Übereinstimmung" | "Hohe Übereinstimmung" | "Mittlere Übereinstimmung"; matchedFields: string[] } {
  if (!p1 || !p2) {
    return { score: 0, level: "Mittlere Übereinstimmung", matchedFields: [] };
  }

  let score = 0;
  const matchedFields: string[] = [];

  const p1Fn = p1.firstName || (p1.name ? p1.name.split(" ")[0] : "");
  const p1Ln = p1.lastName || (p1.name ? p1.name.split(" ").slice(1).join(" ") : "");
  const p2Fn = p2.firstName || (p2.name ? p2.name.split(" ")[0] : "");
  const p2Ln = p2.lastName || (p2.name ? p2.name.split(" ").slice(1).join(" ") : "");

  const fNameSim = calculateSimilarity(p1Fn, p2Fn);
  const lNameSim = calculateSimilarity(p1Ln, p2Ln);

  const p1IsPlaceholder = p1.is_placeholder_email || (p1.email && p1.email.startsWith("no-email.") && p1.email.endsWith("@internal.app"));
  const p2IsPlaceholder = p2.is_placeholder_email || (p2.email && p2.email.startsWith("no-email.") && p2.email.endsWith("@internal.app"));

  // Check BirthDate match if both have one
  const b1 = p1.birthDate ? String(p1.birthDate).trim().substring(0, 10) : "";
  const b2 = p2.birthDate ? String(p2.birthDate).trim().substring(0, 10) : "";
  const birthDateMatch = b1 && b2 && b1 === b2;

  // Exact full name match
  let hasExactName = false;
  let hasStrongName = false;
  if (fNameSim === 1 && lNameSim === 1 && normalizeString(p1Fn).length > 1 && normalizeString(p1Ln).length > 1) {
    score += 70;
    matchedFields.push("Identischer Vor- & Nachname");
    hasExactName = true;
    hasStrongName = true;
  } else if (lNameSim === 1 && fNameSim >= 0.7) {
    score += 55;
    matchedFields.push("Identischer Nachname & ähnlicher Vorname");
    hasStrongName = true;
  } else if (fNameSim === 1 && lNameSim >= 0.7) {
    score += 50;
    matchedFields.push("Identischer Vorname & ähnlicher Nachname");
    hasStrongName = true;
  } else if (fNameSim >= 0.8 && lNameSim >= 0.8) {
    score += 45;
    matchedFields.push("Hohe Name-Ähnlichkeit");
    hasStrongName = true;
  }

  // BirthDate combination bonus (Name + Vorname + Geburtsdatum -> >= 85%)
  if (birthDateMatch) {
    if (hasExactName) {
      score = Math.max(score, 95);
      matchedFields.push("Identisches Geburtsdatum");
    } else if (hasStrongName) {
      score = Math.max(score, 85);
      matchedFields.push("Identisches Geburtsdatum & Namensübereinstimmung");
    }
  }

  // Exact Email match (only if neither is a placeholder email)
  const e1 = normalizeString(p1.email);
  const e2 = normalizeString(p2.email);
  if (!p1IsPlaceholder && !p2IsPlaceholder && e1 && e2 && e1 === e2) {
    score = Math.max(score + 95, 95);
    matchedFields.push("Identische E-Mail-Adresse");
  }

  // Placeholder email matching rule
  if ((p1IsPlaceholder || p2IsPlaceholder) && hasExactName) {
    score = Math.max(score, 85);
    matchedFields.push("Platzhalter-E-Mail & Namensübereinstimmung");
  }

  // Phone match:
  // Rule: Identical phone number alone gives maximum 20-25% score.
  // Phone match MUST be paired with name match to produce a high score.
  const ph1 = normalizePhone(p1.phone);
  const ph2 = normalizePhone(p2.phone);
  if (ph1 && ph2 && ph1 === ph2) {
    if (hasExactName) {
      score = Math.max(score + 25, 90);
      matchedFields.push("Identische Telefonnummer");
    } else if (hasStrongName) {
      score = Math.max(score + 25, 75);
      matchedFields.push("Identische Telefonnummer");
    } else {
      // Standalone phone number without name match gets low score (20%)
      score += 20;
      matchedFields.push("Identische Telefonnummer (ohne Namensübereinstimmung)");
    }
  }

  // Cap at 100
  score = Math.min(100, Math.round(score));

  let level: "Sehr hohe Übereinstimmung" | "Hohe Übereinstimmung" | "Mittlere Übereinstimmung" = "Mittlere Übereinstimmung";
  if (score >= 85) {
    level = "Sehr hohe Übereinstimmung";
  } else if (score >= 65) {
    level = "Hohe Übereinstimmung";
  }

  return { score, level, matchedFields };
}

// Fetch ignored duplicate pairs from system_settings
export async function getIgnoredDuplicatePairs(): Promise<string[]> {
  try {
    const docRef = doc(db, "system_settings", "duplicates");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().ignoredPairs || [];
    }
    return [];
  } catch (err) {
    console.error("Error fetching ignored pairs:", err);
    return [];
  }
}

export async function ignoreDuplicatePair(id1: string, id2: string): Promise<void> {
  try {
    const docRef = doc(db, "system_settings", "duplicates");
    const snap = await getDoc(docRef);
    const pairId = [id1, id2].sort().join("_");
    
    let current: string[] = [];
    if (snap.exists()) {
      current = snap.data().ignoredPairs || [];
    }
    if (!current.includes(pairId)) {
      current.push(pairId);
      await setDoc(docRef, { ignoredPairs: current }, { merge: true });
    }
  } catch (err) {
    console.error("Error ignoring duplicate pair:", err);
    throw err;
  }
}

// Super-Admin: Detect all system duplicate pairs
export function findSystemDuplicates(
  allPersons: Person[],
  allMemberships: Mitgliedschaft[],
  ignoredPairs: string[] = []
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];
  if (!Array.isArray(allPersons) || allPersons.length === 0) return duplicates;
  const safeMemberships = Array.isArray(allMemberships) ? allMemberships : [];
  const ignoredSet = new Set(Array.isArray(ignoredPairs) ? ignoredPairs : []);

  for (let i = 0; i < allPersons.length; i++) {
    for (let j = i + 1; j < allPersons.length; j++) {
      const p1 = allPersons[i];
      const p2 = allPersons[j];

      if (!p1 || !p2 || !p1.id || !p2.id) continue;

      // Skip identical IDs
      if (p1.id === p2.id) continue;
      
      const pairId = [p1.id, p2.id].sort().join("_");
      if (ignoredSet.has(pairId)) continue;

      const { score, level, matchedFields } = calculatePersonMatchScore(p1, p2);

      if (score >= 40) {
        const ms1 = safeMemberships.filter((m) => m && (m.personId === p1.id || m.userId === p1.id));
        const ms2 = safeMemberships.filter((m) => m && (m.personId === p2.id || m.userId === p2.id));

        duplicates.push({
          id: `${p1.id}_${p2.id}`,
          personA: p1,
          personB: p2,
          membershipsA: ms1,
          membershipsB: ms2,
          score,
          level,
          matchedFields,
        });
      }
    }
  }

  // Sort descending by score
  duplicates.sort((a, b) => b.score - a.score);
  return duplicates;
}

// Club Admin: Privacy-Safe candidate check when creating/editing a member
export function checkCandidateDuplicatesForClubAdmin(
  input: { firstName: string; lastName: string; email?: string; phone?: string },
  allPersons: Person[],
  allMemberships: Mitgliedschaft[],
  currentVereinId: string
): PrivacySafeCandidate[] {
  const normCurrentVereinId = (currentVereinId || "sv-neuhausen").toLowerCase().replace(/\s/g, "");

  // Find persons who are NOT already active members of currentVereinId
  const activeMembersInCurrentClub = new Set(
    allMemberships
      .filter((m) => (m.vereinId || "").toLowerCase().replace(/\s/g, "") === normCurrentVereinId && m.active !== false)
      .map((m) => m.personId)
  );

  const candidates: PrivacySafeCandidate[] = [];

  const inputEmail = (input.email || "").toLowerCase().trim();
  const inputFn = normalizeString(input.firstName);
  const inputLn = normalizeString(input.lastName);

  if (!inputEmail && !inputFn && !inputLn) return [];

  for (const person of allPersons) {
    if (!person.id) continue;
    // Skip if person is already a member of current club
    if (activeMembersInCurrentClub.has(person.id)) continue;

    const personEmail = (person.email || "").toLowerCase().trim();
    const isPlaceholder = person.is_placeholder_email || personEmail.startsWith("no-email.");

    let emailMatched = false;
    if (inputEmail && !isPlaceholder && personEmail && inputEmail === personEmail) {
      emailMatched = true;
    }

    const { score } = calculatePersonMatchScore(input, person);
    const nameMatched = score >= 50 || (inputFn.length > 1 && inputLn.length > 1 && normalizeString(person.firstName) === inputFn && normalizeString(person.lastName) === inputLn);

    if (emailMatched || nameMatched) {
      // Check if candidate has admin rights in another club
      let hasAdminInOtherClub = false;
      const otherClubNamesSet = new Set<string>();

      // Check main person role
      if (person.role === Role.ADMIN || (person.role as any) === "admin" || person.role === Role.SUPER_ADMIN) {
        const pVerein = (person.vereinsId || "").toLowerCase().replace(/\s/g, "");
        if (pVerein && pVerein !== normCurrentVereinId && pVerein !== "super-admin" && pVerein !== "system") {
          hasAdminInOtherClub = true;
          otherClubNamesSet.add(person.vereinsId!);
        }
      }

      // Check clubs array
      if (Array.isArray(person.clubs)) {
        person.clubs.forEach((c: any) => {
          const cId = typeof c === "string" ? c : (c.vereinsId || c.id);
          const cRole = typeof c === "object" ? c.role : undefined;
          const normCId = (cId || "").toLowerCase().replace(/\s/g, "");
          if (normCId && normCId !== normCurrentVereinId && normCId !== "super-admin" && normCId !== "system") {
            if (cRole === Role.ADMIN || cRole === "admin") {
              hasAdminInOtherClub = true;
              otherClubNamesSet.add(c.clubName || c.name || cId);
            }
          }
        });
      }

      // Check allMemberships
      allMemberships.forEach((m) => {
        if (m.personId === person.id) {
          const mVerein = (m.vereinId || "").toLowerCase().replace(/\s/g, "");
          if (mVerein && mVerein !== normCurrentVereinId && mVerein !== "super-admin" && mVerein !== "system") {
            if (m.role === Role.ADMIN || (m.role as any) === "admin") {
              hasAdminInOtherClub = true;
              otherClubNamesSet.add(m.vereinId);
            }
          }
        }
      });

      candidates.push({
        personId: person.id,
        firstName: person.firstName || person.name || "Mitglied",
        lastName: person.lastName || "",
        gender: person.gender || "m",
        emailMatched,
        nameMatched,
        hasAdminInOtherClub,
        otherClubNames: Array.from(otherClubNamesSet),
      });
    }
  }

  return candidates;
}

// Club Admin: Query system in real-time for privacy-safe candidate duplicates
export async function findCandidateDuplicatesForAdmin(
  input: { firstName: string; lastName: string; email?: string; phone?: string },
  currentVereinId: string
): Promise<PrivacySafeCandidate[]> {
  try {
    const normVereinId = (currentVereinId || "sv-neuhausen").toLowerCase().replace(/\s/g, "");
    const usersSnap = await getDocs(collection(db, "users"));
    const allPersons: Person[] = [];
    usersSnap.docs.forEach((d) => {
      allPersons.push({ id: d.id, ...d.data() } as Person);
    });

    const vereineSnap = await getDocs(collection(db, "vereine"));
    const allMemberships: Mitgliedschaft[] = [];
    for (const clubDoc of vereineSnap.docs) {
      const vId = clubDoc.id;
      const mSnap = await getDocs(collection(db, "vereine", vId, "mitglieder"));
      mSnap.docs.forEach((m) => {
        allMemberships.push({
          id: m.id,
          vereinId: vId,
          personId: m.data().personId || m.id,
          role: m.data().role || Role.USER,
          active: m.data().active !== false,
          // joinedAt: m.data().joinedAt || new Date().toISOString(),
        });
      });
    }

    return checkCandidateDuplicatesForClubAdmin(input, allPersons, allMemberships, normVereinId);
  } catch (err) {
    console.error("Error finding candidate duplicates:", err);
    return [];
  }
}

// Club Admin / Super Admin: Add an existing system Person to a Verein as a Mitglied
export async function addExistingPersonToClub(
  personId: string,
  vereinId: string,
  role: Role = Role.USER,
  clubName?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const normVereinId = (vereinId || "sv-neuhausen").toLowerCase().replace(/\s/g, "");
    const membershipRef = doc(db, "vereine", normVereinId, "mitglieder", personId);

    // Standard role for new club membership is Role.MITGLIED / Role.USER unless explicitly promoted for this club
    const assignedRole = (role === Role.ADMIN || (role as any) === "admin") ? Role.ADMIN : Role.MITGLIED;

    await setDoc(
      membershipRef,
      {
        id: personId,
        personId: personId,
        vereinId: normVereinId,
        role: assignedRole,
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Also update the person's clubs array on user doc
    const userRef = doc(db, "users", personId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const uData = userSnap.data() as Person;
      const existingClubs = Array.isArray(uData.clubs) ? [...uData.clubs] : [];
      
      let resolvedClubName = clubName;
      if (!resolvedClubName) {
        try {
          const clubDoc = await getDoc(doc(db, "vereine", normVereinId));
          if (clubDoc.exists()) {
            resolvedClubName = clubDoc.data()?.name || clubDoc.data()?.vereinsName || clubDoc.data()?.clubName || normVereinId;
          }
        } catch {
          // ignore fallback
        }
      }
      if (!resolvedClubName) {
        resolvedClubName = normVereinId;
      }

      const foundIdx = existingClubs.findIndex((c: any) => {
        const id = typeof c === "string" ? c : (c.vereinsId || c.id);
        return id && id.toLowerCase().replace(/\s/g, "") === normVereinId;
      });

      const newClubEntry = {
        id: normVereinId,
        vereinsId: normVereinId,
        clubName: resolvedClubName,
        role: assignedRole,
        type: "club",
        is_tenant: true,
      };

      if (foundIdx >= 0) {
        existingClubs[foundIdx] = newClubEntry;
      } else {
        existingClubs.push(newClubEntry);
      }

      const updates: any = {
        clubs: existingClubs,
      };
      if (!uData.tenantId && !uData.vereinsId) {
        updates.tenantId = normVereinId;
        updates.vereinsId = normVereinId;
      }

      await updateDoc(userRef, updates);
    }

    return {
      success: true,
      message: "Bestehende Person wurde diesem Verein erfolgreich als Mitglied hinzugefügt.",
    };
  } catch (err: any) {
    console.error("Error adding person to club:", err);
    throw new Error(`Fehler beim Hinzufügen der Mitgliedschaft: ${err.message || err}`);
  }
}

// Super-Admin: Merge sourcePerson into targetPerson across all collections
export async function mergePersons(
  targetPersonId: string,
  sourcePersonId: string,
  options?: { skipRecalculation?: boolean }
): Promise<{ success: boolean; message: string; oldestMatchDate: string | null }> {
  if (targetPersonId === sourcePersonId) {
    throw new Error("Eine Person kann nicht mit sich selbst zusammengeführt werden.");
  }

  try {
    // 1. Fetch Target & Source Person docs in parallel
    const targetRef = doc(db, "users", targetPersonId);
    const sourceRef = doc(db, "users", sourcePersonId);

    const [targetSnap, sourceSnap] = await Promise.all([getDoc(targetRef), getDoc(sourceRef)]);

    if (!targetSnap.exists() || !sourceSnap.exists()) {
      throw new Error("Ein oder beide Personendatensätze existieren nicht mehr in der Datenbank.");
    }

    const targetData = targetSnap.data() as Person;
    const sourceData = sourceSnap.data() as Person;

    // 2. Merge contact info & profile options
    const isTargetPlaceholder = targetData.is_placeholder_email || 
      (!targetData.email) || 
      (targetData.email && targetData.email.startsWith("no-email.") && targetData.email.endsWith("@internal.app"));

    const isSourcePlaceholder = sourceData.is_placeholder_email || 
      (!sourceData.email) || 
      (sourceData.email && sourceData.email.startsWith("no-email.") && sourceData.email.endsWith("@internal.app"));

    const chosenEmail = (!isTargetPlaceholder && targetData.email) 
      ? targetData.email 
      : ((!isSourcePlaceholder && sourceData.email) ? sourceData.email : (targetData.email || sourceData.email || ""));

    // 3. Set-Union of linked clubs / memberships
    const mergedClubsMap = new Map<string, { vereinsId: string; clubName: string; role: Role }>();

    const normKey = (str: string) => String(str).trim().toLowerCase().replace(/\s/g, "");

    const addClubToMergedMap = (cId: string, name?: string, role?: Role) => {
      if (!cId) return;
      const key = normKey(cId);
      if (!key || key === "super-admin") return;

      const cleanRole = (role === Role.ADMIN || (role as any) === "admin" || role === Role.SUPER_ADMIN)
        ? Role.ADMIN 
        : Role.MITGLIED;

      if (!mergedClubsMap.has(key)) {
        mergedClubsMap.set(key, {
          vereinsId: cId,
          clubName: name || cId,
          role: cleanRole,
        });
      } else if (cleanRole === Role.ADMIN) {
        mergedClubsMap.get(key)!.role = Role.ADMIN;
      }
    };

    // Add target's clubs
    if (targetData.vereinsId) addClubToMergedMap(targetData.vereinsId, undefined, targetData.role);
    if (Array.isArray(targetData.clubs)) {
      targetData.clubs.forEach((c: any) => {
        if (typeof c === "string") addClubToMergedMap(c);
        else if (c && (c.vereinsId || c.id)) addClubToMergedMap(c.vereinsId || c.id, c.clubName || c.name, c.role);
      });
    }

    // Add source's clubs
    if (sourceData.vereinsId) addClubToMergedMap(sourceData.vereinsId, undefined, sourceData.role);
    if (Array.isArray(sourceData.clubs)) {
      sourceData.clubs.forEach((c: any) => {
        if (typeof c === "string") addClubToMergedMap(c);
        else if (c && (c.vereinsId || c.id)) addClubToMergedMap(c.vereinsId || c.id, c.clubName || c.name, c.role);
      });
    }

    // 4. Update all club subcollections & memberships
    const vereineSnap = await getDocs(collection(db, "vereine"));
    const clubUpdatePromises: Promise<void>[] = [];

    for (const clubDoc of vereineSnap.docs) {
      const vereinId = clubDoc.id;
      const clubData = clubDoc.data();
      const clubName = clubData.name || clubData.vereinsName || vereinId;

      // A. Mitglieder (Club Memberships)
      const mitgliederRef = collection(db, "vereine", vereinId, "mitglieder");
      const mitgliederSnap = await getDocs(mitgliederRef);

      let targetMembershipDoc: { id: string; data: any } | null = null;
      const sourceMembershipDocs: { id: string; data: any }[] = [];

      mitgliederSnap.docs.forEach((d) => {
        const mData = d.data();
        if (mData.personId === targetPersonId || d.id === targetPersonId) {
          targetMembershipDoc = { id: d.id, data: mData };
        }
        if (mData.personId === sourcePersonId || d.id === sourcePersonId) {
          sourceMembershipDocs.push({ id: d.id, data: mData });
        }
      });

      if (targetMembershipDoc) {
        addClubToMergedMap(vereinId, clubName, targetMembershipDoc.data.role);
      }

      if (sourceMembershipDocs.length > 0) {
        const hasAdminRole = sourceMembershipDocs.some(sm => sm.data.role === Role.ADMIN || sm.data.role === "admin");
        addClubToMergedMap(vereinId, clubName, hasAdminRole ? Role.ADMIN : Role.MITGLIED);

        if (targetMembershipDoc) {
          // Target already member: upgrade role if source was admin & delete duplicate source membership
          if (hasAdminRole && targetMembershipDoc.data.role !== Role.ADMIN) {
            clubUpdatePromises.push(
              updateDoc(doc(db, "vereine", vereinId, "mitglieder", targetMembershipDoc.id), {
                role: Role.ADMIN,
              })
            );
          }
          for (const sm of sourceMembershipDocs) {
            clubUpdatePromises.push(
              deleteDoc(doc(db, "vereine", vereinId, "mitglieder", sm.id))
            );
          }
        } else {
          // Target not member in this club: transfer source's membership doc to target
          for (const sm of sourceMembershipDocs) {
            clubUpdatePromises.push(
              updateDoc(doc(db, "vereine", vereinId, "mitglieder", sm.id), {
                personId: targetPersonId,
              })
            );
          }
        }
      }

      // B. Arbeitseinsätze
      try {
        const aeRef = collection(db, "vereine", vereinId, "arbeitseinsaetze");
        const aeSnap = await getDocs(query(aeRef, where("userId", "==", sourcePersonId)));
        aeSnap.docs.forEach((aeDoc) => {
          clubUpdatePromises.push(
            updateDoc(doc(db, "vereine", vereinId, "arbeitseinsaetze", aeDoc.id), {
              userId: targetPersonId,
            })
          );
        });
      } catch (e) {
        console.warn(`Error updating arbeitseinsaetze for verein ${vereinId}:`, e);
      }

      // C. Planned Work Shifts
      try {
        const shiftsRef = collection(db, "vereine", vereinId, "plannedWorkShifts");
        const shiftsSnap = await getDocs(shiftsRef);
        shiftsSnap.docs.forEach((sDoc) => {
          const sData = sDoc.data();
          if (Array.isArray(sData.assigned_user_ids) && sData.assigned_user_ids.includes(sourcePersonId)) {
            const newAssigned = Array.from(new Set(
              sData.assigned_user_ids.map((uid: string) => (uid === sourcePersonId ? targetPersonId : uid))
            ));
            clubUpdatePromises.push(
              updateDoc(doc(db, "vereine", vereinId, "plannedWorkShifts", sDoc.id), {
                assigned_user_ids: newAssigned,
              })
            );
          }
        });
      } catch (e) {
        console.warn(`Error updating plannedWorkShifts for verein ${vereinId}:`, e);
      }

      // D. Bookings
      try {
        const bookingsRef = collection(db, "vereine", vereinId, "bookings");
        const bookingsSnap = await getDocs(bookingsRef);
        bookingsSnap.docs.forEach((bDoc) => {
          const bData = bDoc.data();
          let needsUpdate = false;
          const updates: any = {};

          if (bData.createdBy === sourcePersonId) {
            updates.createdBy = targetPersonId;
            needsUpdate = true;
          }

          if (Array.isArray(bData.players)) {
            const sourceName = `${sourceData.firstName || ""} ${sourceData.lastName || ""}`.trim() || sourceData.name || sourcePersonId;
            const targetName = `${targetData.firstName || ""} ${targetData.lastName || ""}`.trim() || targetData.name || targetPersonId;

            let changedPlayers = false;
            const newPlayers = bData.players.map((p: string) => {
              if (p === sourcePersonId || p === sourceData.id) {
                changedPlayers = true;
                return targetPersonId;
              }
              if (sourceName && p === sourceName) {
                changedPlayers = true;
                return targetName;
              }
              return p;
            });

            if (changedPlayers) {
              updates.players = newPlayers;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            clubUpdatePromises.push(
              updateDoc(doc(db, "vereine", vereinId, "bookings", bDoc.id), updates)
            );
          }
        });
      } catch (e) {
        console.warn(`Error updating bookings for verein ${vereinId}:`, e);
      }
    }

    await Promise.all(clubUpdatePromises);

    // 5. Update target user document with merged profile & clubs
    const mergedClubsArray = Array.from(mergedClubsMap.values());
    const updatedTarget: Partial<Person> = {
      email: chosenEmail,
      is_placeholder_email: isTargetPlaceholder && isSourcePlaceholder,
      phone: targetData.phone || sourceData.phone || "",
      firstName: targetData.firstName || sourceData.firstName || "",
      lastName: targetData.lastName || sourceData.lastName || "",
      gender: targetData.gender || sourceData.gender || "m",
      showContactInfo: targetData.showContactInfo ?? sourceData.showContactInfo ?? true,
      hobbyLeagueOptIn: targetData.hobbyLeagueOptIn || sourceData.hobbyLeagueOptIn || false,
      clubs: mergedClubsArray as any,
      vereinsId: targetData.vereinsId || sourceData.vereinsId || (mergedClubsArray[0]?.vereinsId || ""),
    };

    await updateDoc(targetRef, updatedTarget);

    // 6. Update secondary user docs in 'users' collection pointing to sourcePersonId
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userDocPromises: Promise<void>[] = [];
      usersSnap.docs.forEach((uDoc) => {
        if (uDoc.id === sourcePersonId) return;
        const uData = uDoc.data();
        if (uData.personId === sourcePersonId || uData.id === sourcePersonId) {
          userDocPromises.push(
            updateDoc(doc(db, "users", uDoc.id), {
              id: targetPersonId,
              personId: targetPersonId,
            })
          );
        }
      });
      await Promise.all(userDocPromises);
    } catch (e) {
      console.warn("Error updating secondary user docs in users collection:", e);
    }

    // 7. Merge league profiles & matches
    const { oldestMatchDate } = await mergeLeagueProfiles(targetPersonId, sourcePersonId, options);

    // 8. Delete source person primary document
    await deleteDoc(sourceRef);

    return {
      success: true,
      message: `Person "${sourceData.firstName} ${sourceData.lastName}" wurde erfolgreich in "${targetData.firstName} ${targetData.lastName}" zusammengeführt. Target ist nun in ${mergedClubsArray.length} Verein(en) registriert.`,
      oldestMatchDate,
    };
  } catch (err: any) {
    console.error("Error merging persons:", err);
    throw new Error(`Fehler bei der Personen-Zusammenführung: ${err.message || err}`);
  }
}
