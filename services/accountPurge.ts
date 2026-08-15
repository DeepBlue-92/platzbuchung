import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getNormalizedVereinsId, createGlobalBackup } from "./db";
import {
  recalculateLeaguePointsFrom,
  LEAGUE_MATCHES_COLLECTION,
  LEAGUE_PROFILES_COLLECTION,
  LEAGUE_SEARCHES_COLLECTION,
} from "./league";
import { LeagueMatch, Role, Person } from "../types";

/**
 * Updates a user's role in a specific club/tenant (e.g. member/player vs. club admin).
 * Synchronizes vereine/{normVereinId}/mitglieder, memberships, user_tenant_membership, and user doc.
 */
export async function updateUserTenantRole(
  userId: string,
  vereinId: string,
  newRole: Role
): Promise<void> {
  const normId = getNormalizedVereinsId(vereinId);
  const cleanRole = (newRole === Role.ADMIN || (newRole as any) === "admin") ? Role.ADMIN : Role.MITGLIED;

  // 1. Update in vereine/{normId}/mitglieder
  const mitgliederRef = collection(db, "vereine", normId, "mitglieder");
  const [snap1, snap2] = await Promise.all([
    getDocs(query(mitgliederRef, where("personId", "==", userId))),
    getDocs(query(mitgliederRef, where("id", "==", userId))),
  ]);

  const docIds = new Set<string>();
  snap1.docs.forEach((d) => docIds.add(d.id));
  snap2.docs.forEach((d) => docIds.add(d.id));

  const directSnap = await getDoc(doc(db, "vereine", normId, "mitglieder", userId));
  if (directSnap.exists()) {
    docIds.add(userId);
  }

  if (docIds.size > 0) {
    const updatePromises = Array.from(docIds).map((dId) =>
      updateDoc(doc(db, "vereine", normId, "mitglieder", dId), {
        role: cleanRole,
        updatedAt: new Date().toISOString(),
      })
    );
    await Promise.all(updatePromises);
  } else {
    await setDoc(
      doc(db, "vereine", normId, "mitglieder", userId),
      {
        id: userId,
        personId: userId,
        vereinId: normId,
        role: cleanRole,
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // 2. Update flat memberships collection
  try {
    const flatMembershipsRef = collection(db, "memberships");
    const flatSnap = await getDocs(
      query(flatMembershipsRef, where("personId", "==", userId), where("vereinId", "==", normId))
    );
    if (!flatSnap.empty) {
      for (const d of flatSnap.docs) {
        await updateDoc(doc(db, "memberships", d.id), { role: cleanRole });
      }
    } else {
      const docKey = `${userId}_${normId}`;
      await setDoc(
        doc(db, "memberships", docKey),
        {
          id: docKey,
          personId: userId,
          vereinId: normId,
          role: cleanRole,
          active: true,
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn("Could not update flat memberships collection:", e);
  }

  // 3. Update user_tenant_membership table/collection
  try {
    const utmRef = collection(db, "user_tenant_membership");
    const utmSnap = await getDocs(
      query(utmRef, where("userId", "==", userId), where("tenantId", "==", normId))
    );
    if (!utmSnap.empty) {
      for (const d of utmSnap.docs) {
        await updateDoc(doc(db, "user_tenant_membership", d.id), { role: cleanRole });
      }
    } else {
      await setDoc(
        doc(db, "user_tenant_membership", `${userId}_${normId}`),
        {
          userId,
          personId: userId,
          tenantId: normId,
          vereinId: normId,
          role: cleanRole,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (e) {
    // Non-critical fallback
  }

  // 4. Update user document in 'users' collection
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as Person;
      const clubsList = Array.isArray(userData.clubs) ? [...userData.clubs] : [];

      let clubFound = false;
      const updatedClubs = clubsList.map((c: any) => {
        const cId = typeof c === "string" ? c : (c.vereinsId || c.id);
        if (cId && getNormalizedVereinsId(cId) === normId) {
          clubFound = true;
          return typeof c === "string"
            ? { vereinsId: normId, clubName: normId, role: cleanRole }
            : { ...c, role: cleanRole };
        }
        return c;
      });

      if (!clubFound) {
        updatedClubs.push({
          vereinsId: normId,
          clubName: normId,
          role: cleanRole,
        });
      }

      const userUpdates: any = {
        clubs: updatedClubs,
      };

      if (
        userData.role !== Role.SUPER_ADMIN &&
        (userData.tenantId === normId || userData.vereinsId === normId)
      ) {
        userUpdates.role = cleanRole;
      }

      await updateDoc(userRef, userUpdates);
    }
  } catch (e) {
    console.warn("Could not update user doc for role change:", e);
  }
}

/**
 * Removes a single user from a specific club membership (Mitgliedschaft).
 * Does not delete the user account doc, only the membership for the given club.
 */
export async function removeUserFromClub(userId: string, vereinId: string): Promise<void> {
  const normId = getNormalizedVereinsId(vereinId);
  const mitgliederRef = collection(db, "vereine", normId, "mitglieder");

  const [snap1, snap2] = await Promise.all([
    getDocs(query(mitgliederRef, where("personId", "==", userId))),
    getDocs(query(mitgliederRef, where("id", "==", userId))),
  ]);

  const docsToDeleteMap = new Map<string, string>();
  snap1.forEach((d) => docsToDeleteMap.set(d.id, d.id));
  snap2.forEach((d) => docsToDeleteMap.set(d.id, d.id));

  // Also check if membership doc ID is userId directly
  const directDocRef = doc(db, "vereine", normId, "mitglieder", userId);
  const directSnap = await getDoc(directDocRef);
  if (directSnap.exists()) {
    docsToDeleteMap.set(directSnap.id, directSnap.id);
  }

  const deletePromises = Array.from(docsToDeleteMap.keys()).map((mId) =>
    deleteDoc(doc(db, "vereine", normId, "mitglieder", mId))
  );

  await Promise.all(deletePromises);

  // Check if user's tenantId in users/{userId} matches this club and update clubs array
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const updates: any = {};

    // Remove from clubs array if present
    if (Array.isArray(userData.clubs)) {
      updates.clubs = userData.clubs.filter((c: any) => {
        const cId = typeof c === "string" ? c : (c.id || c.vereinsId);
        return cId && getNormalizedVereinsId(cId) !== normId;
      });
    }

    if (getNormalizedVereinsId(userData.tenantId || userData.vereinsId) === normId) {
      // Try to find if user has another club membership
      let alternateClubId: string | null = null;

      if (Array.isArray(updates.clubs) && updates.clubs.length > 0) {
        const first = updates.clubs[0];
        alternateClubId = typeof first === "string" ? first : (first.vereinsId || first.id);
      }

      if (!alternateClubId) {
        const vereineSnap = await getDocs(collection(db, "vereine"));
        for (const clubDoc of vereineSnap.docs) {
          if (clubDoc.id === normId) continue;
          const clubMitglieder = await getDocs(collection(db, "vereine", clubDoc.id, "mitglieder"));
          const matchesUser = clubMitglieder.docs.some(
            (d) => d.id === userId || d.data().personId === userId
          );
          if (matchesUser) {
            alternateClubId = clubDoc.id;
            break;
          }
        }
      }

      if (alternateClubId) {
        updates.tenantId = alternateClubId;
        updates.vereinsId = alternateClubId;
      } else {
        updates.tenantId = "";
        updates.vereinsId = "";
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  }
}

/**
 * Removes multiple selected users from a specific club.
 */
export async function removeUsersFromClubBatch(
  userIds: string[],
  vereinId: string
): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  for (const uid of userIds) {
    try {
      await removeUserFromClub(uid, vereinId);
      successCount++;
    } catch (err: any) {
      console.error(`Fehler beim Entfernen von User ${uid} aus Verein ${vereinId}:`, err);
      errors.push(`User ${uid}: ${err.message || err}`);
    }
  }

  return { successCount, errors };
}

/**
 * Hard-deletes a user account completely:
 * 1. Performs safety backup check / creates automatic safety backups for affected clubs
 * 2. Cancels user's league matches & tracks oldest match date
 * 3. Deletes league profile & partner search entries
 * 4. Deletes memberships across all clubs
 * 5. Deletes user document from `users` collection
 * 6. Triggers chronological point recalculation for the league if matches were affected
 */
export async function purgeUserAccount(
  userId: string,
  options?: { skipRecalculation?: boolean; createSafetyBackup?: boolean }
): Promise<{
  success: boolean;
  cancelledMatchesCount: number;
  oldestMatchDate: string | null;
  backupsCreatedCount: number;
}> {
  // 1. Identify all clubs where user has memberships or primary tenantId
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;

  const affectedClubIds = new Set<string>();
  if (userData?.tenantId || userData?.vereinsId) {
    affectedClubIds.add(getNormalizedVereinsId(userData.tenantId || userData.vereinsId));
  }

  const vereineSnap = await getDocs(collection(db, "vereine"));
  const membershipDeletePromises: Promise<void>[] = [];

  for (const clubDoc of vereineSnap.docs) {
    const clubId = clubDoc.id;
    const mitgliederRef = collection(db, "vereine", clubId, "mitglieder");
    const [m1, m2] = await Promise.all([
      getDocs(query(mitgliederRef, where("personId", "==", userId))),
      getDocs(query(mitgliederRef, where("id", "==", userId))),
    ]);

    const mDocIds = new Set<string>();
    m1.forEach((d) => mDocIds.add(d.id));
    m2.forEach((d) => mDocIds.add(d.id));

    if (mDocIds.size > 0) {
      affectedClubIds.add(clubId);
      mDocIds.forEach((mId) => {
        membershipDeletePromises.push(deleteDoc(doc(db, "vereine", clubId, "mitglieder", mId)));
      });
    }
  }

  // 2. Create global safety backup if enabled
  let backupsCreatedCount = 0;
  if (options?.createSafetyBackup !== false && affectedClubIds.size > 0) {
    try {
      const userName = userData ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || userData.username || userId : userId;
      await createGlobalBackup(
        "super-admin",
        undefined,
        `Automatisches Sicherheitsbackup vor Account-Purge (${userName})`
      );
      backupsCreatedCount = 1;
    } catch (err) {
      console.error("Global safety backup failed before account purge:", err);
    }
  }

  // 3. Process & cancel league matches
  const matchesColl = collection(db, LEAGUE_MATCHES_COLLECTION);
  const [snap1, snap2] = await Promise.all([
    getDocs(query(matchesColl, where("player1UserId", "==", userId))),
    getDocs(query(matchesColl, where("player2UserId", "==", userId))),
  ]);

  const matchesMap = new Map<string, LeagueMatch>();
  snap1.forEach((d) => matchesMap.set(d.id, { id: d.id, ...d.data() } as LeagueMatch));
  snap2.forEach((d) => matchesMap.set(d.id, { id: d.id, ...d.data() } as LeagueMatch));

  let oldestMatchDate: string | null = null;
  let cancelledMatchesCount = 0;
  const matchUpdatePromises: Promise<void>[] = [];

  for (const match of Array.from(matchesMap.values())) {
    if (match.status !== "cancelled") {
      cancelledMatchesCount++;
      const matchDate =
        match.played_at ||
        match.result?.played_at ||
        match.scheduledDate ||
        match.result?.reportedAt ||
        match.createdAt ||
        new Date().toISOString();

      if (!oldestMatchDate || new Date(matchDate) < new Date(oldestMatchDate)) {
        oldestMatchDate = matchDate;
      }

      matchUpdatePromises.push(
        updateDoc(doc(db, LEAGUE_MATCHES_COLLECTION, match.id), {
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        })
      );
    }
  }

  await Promise.all(matchUpdatePromises);

  // 4. Delete league profiles and partner searches
  try {
    await deleteDoc(doc(db, LEAGUE_PROFILES_COLLECTION, userId));
  } catch (e) {}

  try {
    await deleteDoc(doc(db, LEAGUE_SEARCHES_COLLECTION, userId));
  } catch (e) {}

  // Delete all memberships
  await Promise.all(membershipDeletePromises);

  // 5. Delete user doc from `users`
  if (userSnap.exists()) {
    await deleteDoc(userRef);
  }

  // 6. Recalculate league points if necessary
  if (oldestMatchDate && !options?.skipRecalculation) {
    await recalculateLeaguePointsFrom(oldestMatchDate);
  }

  return {
    success: true,
    cancelledMatchesCount,
    oldestMatchDate,
    backupsCreatedCount,
  };
}

/**
 * Batch purge multiple accounts in sequence, skipping point recalculation until the end.
 */
export async function purgeUserAccountsBatch(
  userIds: string[],
  progressCallback?: (current: number, total: number, message: string) => void
): Promise<{
  successCount: number;
  totalCancelledMatches: number;
  oldestMatchDate: string | null;
}> {
  let successCount = 0;
  let totalCancelledMatches = 0;
  let globalOldestDate: string | null = null;

  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    if (progressCallback) {
      progressCallback(i + 1, userIds.length, `Konto ${i + 1} von ${userIds.length} wird unwiderruflich gelöscht...`);
    }

    try {
      const res = await purgeUserAccount(uid, { skipRecalculation: true, createSafetyBackup: true });
      successCount++;
      totalCancelledMatches += res.cancelledMatchesCount;
      if (res.oldestMatchDate) {
        if (!globalOldestDate || new Date(res.oldestMatchDate) < new Date(globalOldestDate)) {
          globalOldestDate = res.oldestMatchDate;
        }
      }
    } catch (err) {
      console.error(`Fehler beim Löschen des Kontos ${uid}:`, err);
    }
  }

  if (globalOldestDate) {
    if (progressCallback) {
      progressCallback(userIds.length, userIds.length, "Hobbyliga-Punktehistorie wird chronologisch neu berechnet...");
    }
    try {
      await recalculateLeaguePointsFrom(globalOldestDate);
    } catch (err) {
      console.error("Fehler bei Punkte-Neuberechnung nach Bulk-Purge:", err);
    }
  }

  return {
    successCount,
    totalCancelledMatches,
    oldestMatchDate: globalOldestDate,
  };
}
