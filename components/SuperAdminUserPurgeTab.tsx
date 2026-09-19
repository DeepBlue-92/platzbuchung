import React, { useState, useEffect, useMemo } from "react";
import { calculateAge, parseDateToYYYYMMDD } from "../utils/playerHelper";
import { Person, Mitgliedschaft, LeagueMatch, Role, User } from "../types";
import {
  removeUserFromClub,
  updateUserTenantRole,
  purgeUserAccount,
  purgeUserAccountsBatch,
} from "../services/accountPurge";
import { addExistingPersonToClub } from "../services/duplicateDetection";
import { resolveClubName } from "../services/clubHelper";
import SuperAdminCreateUserModal from "./SuperAdminCreateUserModal";

interface SuperAdminUserPurgeTabProps {
  allPersons: Person[];
  clubs: any[];
  allMemberships: Mitgliedschaft[];
  allLeagueMatches: LeagueMatch[];
  backupsByClub?: Record<string, any[]>;
  globalBackups?: any[];
  onRefreshData?: () => void;
  onLoginAs?: (user: User, targetClubId?: string) => void;
}

export default function SuperAdminUserPurgeTab({
  allPersons,
  clubs,
  allMemberships,
  allLeagueMatches,
  backupsByClub = {},
  globalBackups = [],
  onRefreshData,
  onLoginAs,
}: SuperAdminUserPurgeTabProps) {
  // --- Search & Filters ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClubFilter, setSelectedClubFilter] = useState("all");
  const [selectedProtectionFilter, setSelectedProtectionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // --- Selection & Batch Actions ---
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // --- Modal States ---
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [singleRemoveClubUser, setSingleRemoveClubUser] = useState<{
    user: Person;
    clubId: string;
    clubName: string;
  } | null>(null);

  const [lastClubWarningUser, setLastClubWarningUser] = useState<{
    user: Person;
    clubId: string;
    clubName: string;
  } | null>(null);

  const [globalEditUser, setGlobalEditUser] = useState<{
    user: Person;
    linkedClubs: { clubId: string; clubName: string; role: Role; isAdmin: boolean }[];
  } | null>(null);
  const [globalEditForm, setGlobalEditForm] = useState<{
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string;
    gender: "m" | "w";
    birthDate: string;
    newPassword?: string;
    passwordConfirm?: string;
    showContactInfo: boolean;
    show_onboarding_hints: boolean;
    clubAssignments: Record<string, Role>;
  }>({
    firstName: "",
    lastName: "",
    name: "",
    email: "",
    phone: "",
    gender: "m",
    birthDate: "",
    newPassword: "",
    passwordConfirm: "",
    showContactInfo: true,
    show_onboarding_hints: true,
    clubAssignments: {},
  });
  
  const [showGlobalPassword, setShowGlobalPassword] = useState(false);

  const handleOpenGlobalEdit = (user: Person, linkedClubs: any[]) => {
    setGlobalEditUser({ user, linkedClubs });
    
    const initialAssignments: Record<string, Role> = {};
    linkedClubs.forEach(c => {
      initialAssignments[c.clubId] = c.role;
    });

    setGlobalEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      gender: user.gender || "m",
      birthDate: parseDateToYYYYMMDD(user.birthDate),
      newPassword: "",
      passwordConfirm: "",
      showContactInfo: user.showContactInfo !== false,
      show_onboarding_hints: user.show_onboarding_hints !== false,
      clubAssignments: initialAssignments,
    });
  };

  const handleSaveGlobalEdit = async () => {
    if (!globalEditUser) return;
    
    if (globalEditForm.newPassword && globalEditForm.newPassword !== globalEditForm.passwordConfirm) {
      alert("Die Passwörter stimmen nicht überein.");
      return;
    }

    try {
      setLoadingAction("global_edit");
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("../lib/firebase");
      
      const userRef = doc(db, "users", globalEditUser.user.id);
      
      const updates: any = {
        firstName: globalEditForm.firstName.trim(),
        lastName: globalEditForm.lastName.trim(),
        name: globalEditForm.name.trim(),
        email: globalEditForm.email.trim(),
        phone: globalEditForm.phone.trim(),
        gender: globalEditForm.gender,
        birthDate: globalEditForm.birthDate || null,
        showContactInfo: globalEditForm.showContactInfo,
        show_onboarding_hints: globalEditForm.show_onboarding_hints,
      };

      if (globalEditForm.newPassword && globalEditForm.newPassword.trim().length >= 4) {
        updates.password = globalEditForm.newPassword.trim();
        updates.passwort = globalEditForm.newPassword.trim();
      }

      const { getDocs, collection, deleteDoc, setDoc } = await import("firebase/firestore");
      
      // Update clubs array on user document
      const currentSelectedClubs = Object.keys(globalEditForm.clubAssignments);
      
      const newClubsArray = currentSelectedClubs.map(cId => {
        const clubDetails = clubs.find(c => c.vereinsId === cId);
        return {
          id: cId,
          vereinsId: cId,
          clubName: clubDetails ? (clubDetails.vereinsName || clubDetails.name || cId) : cId,
          role: globalEditForm.clubAssignments[cId]
        };
      });
      
      if (newClubsArray.length > 0) {
         updates.clubs = newClubsArray;
         if (!currentSelectedClubs.includes(globalEditUser.user.tenantId as string) && !currentSelectedClubs.includes(globalEditUser.user.vereinsId as string)) {
            updates.tenantId = currentSelectedClubs[0];
            updates.vereinsId = currentSelectedClubs[0];
         }
      } else {
         updates.clubs = [];
      }
      
      await updateDoc(userRef, updates);

      // Now sync memberships in "clubs/{clubId}/memberships"
      const oldClubIds = globalEditUser.linkedClubs.map(c => c.clubId);
      for (const oldClubId of oldClubIds) {
        if (!currentSelectedClubs.includes(oldClubId)) {
          const memRef = doc(db, "clubs", oldClubId, "memberships", `${globalEditUser.user.id}_${oldClubId}`);
          try { await deleteDoc(memRef); } catch(e) {}
        }
      }
      for (const newClubId of currentSelectedClubs) {
        const role = globalEditForm.clubAssignments[newClubId];
        const memRef = doc(db, "clubs", newClubId, "memberships", `${globalEditUser.user.id}_${newClubId}`);
        try {
          await setDoc(memRef, {
             personId: globalEditUser.user.id,
             userId: globalEditUser.user.name || globalEditUser.user.id.split("_")[0],
             vereinId: newClubId,
             role: role,
             email: globalEditForm.email.trim() || globalEditUser.user.email || "",
             updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch(e) {}
      }
      
      if (onRefreshData) {
        onRefreshData();
      }
      showToast("Benutzerdaten erfolgreich aktualisiert.");
      setGlobalEditUser(null);
    } catch (err) {
      console.error("Error updating user globally:", err);
      showToast("Fehler beim Speichern der Benutzerdaten.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const [assignClubUser, setAssignClubUser] = useState<{
    user: Person;
    linkedClubIds: string[];
    linkedClubNames: string[];
  } | null>(null);

  const [assignClubForm, setAssignClubForm] = useState<{
    clubId: string;
    role: Role;
  }>({
    clubId: "",
    role: Role.MITGLIED,
  });

  const [userActionsModalUser, setUserActionsModalUser] = useState<{
    user: Person;
    linkedClubs: any[];
    linkedClubIds: string[];
    linkedClubNames: string[];
  } | null>(null);

  const [singlePurgeUser, setSinglePurgeUser] = useState<Person | null>(null);
  const [showBatchPurgeModal, setShowBatchPurgeModal] = useState(false);

  const [proxyClubSelectionUser, setProxyClubSelectionUser] = useState<{
    user: Person;
    linkedClubIds: string[];
    linkedClubNames: string[];
  } | null>(null);

  const executeProxy = (person: Person, targetClubId: string) => {
    // Validate targetClubId against person's assigned clubs
    const assignedClubs = (person.clubs || []).map((c: any) => typeof c === "string" ? c : (c.vereinsId || c.id)).filter(Boolean);
    if (person.vereinsId) assignedClubs.push(person.vereinsId);
    
    const normTarget = targetClubId.toLowerCase().replace(/\s/g, "");
    const isValid = assignedClubs.some(
      (cId) => cId.toLowerCase().replace(/\s/g, "") === normTarget
    );

    if (!isValid && assignedClubs.length > 0) {
      showToast(`Aktion abgebrochen: Benutzer ist nicht dem Verein '${targetClubId}' zugeordnet.`, "error");
      return;
    }

    const userObj: User = {
      ...person,
      role: person.role || Role.MITGLIED,
      name: person.name || person.klarname || `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.id,
      vereinsId: targetClubId,
    };
    if (onLoginAs) {
      onLoginAs(userObj, targetClubId);
    }
  };

  const handleInitiateProxy = (
    person: Person,
    linkedClubIds: string[],
    linkedClubNames: string[]
  ) => {
    // Determine the user's actual verified clubs
    const validClubIds = linkedClubIds && linkedClubIds.length > 0
      ? linkedClubIds
      : (person.clubs && person.clubs.length > 0
          ? person.clubs.map((c: any) => typeof c === "string" ? c : (c.vereinsId || c.id)).filter(Boolean)
          : (person.vereinsId ? [person.vereinsId] : []));

    if (validClubIds.length === 0) {
      showToast("Dieser Benutzer ist keinem aktiven Verein zugeordnet.", "error");
      return;
    }

    // If currently filtered by club, only auto-select it if user actually belongs to it
    if (selectedClubFilter && selectedClubFilter !== "all") {
      const match = validClubIds.find(
        (cId) => cId.toLowerCase().replace(/\s/g, "") === selectedClubFilter.toLowerCase().replace(/\s/g, "")
      );
      if (match) {
        executeProxy(person, match);
        return;
      }
    }

    // If user has multiple assigned clubs, prompt admin to choose ONLY among those clubs
    if (validClubIds.length > 1) {
      setProxyClubSelectionUser({ user: person, linkedClubIds: validClubIds, linkedClubNames });
      return;
    }

    // Exactly 1 assigned club
    executeProxy(person, validClubIds[0]);
  };

  // --- Loading & Progress States ---
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  const [toastNotification, setToastNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 5000);
  };

  // Map club IDs to club names
  const clubNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clubs.forEach((c) => {
      const vId = c.vereinsId || c.id;
      const name = c.clubName || c.vereinsName || c.name || vId;
      if (vId) {
        map.set(vId, name);
        map.set(vId.toLowerCase(), name);
        map.set(vId.toLowerCase().replace(/[\s_-]/g, ""), name);
      }
      if (c.id) {
        map.set(c.id, name);
        map.set(c.id.toLowerCase(), name);
        map.set(c.id.toLowerCase().replace(/[\s_-]/g, ""), name);
      }
    });
    return map;
  }, [clubs]);

  // Map each user ID to their active memberships & clubs
  const userMembershipsMap = useMemo(() => {
    const map = new Map<string, Mitgliedschaft[]>();
    allMemberships.forEach((m) => {
      if (!map.has(m.personId)) {
        map.set(m.personId, []);
      }
      map.get(m.personId)!.push(m);
    });
    return map;
  }, [allMemberships]);

  // Map each user ID to their league matches
  const userMatchesMap = useMemo(() => {
    const map = new Map<string, LeagueMatch[]>();
    allLeagueMatches.forEach((m) => {
      if (m.player1UserId) {
        if (!map.has(m.player1UserId)) map.set(m.player1UserId, []);
        map.get(m.player1UserId)!.push(m);
      }
      if (m.player2UserId) {
        if (!map.has(m.player2UserId)) map.set(m.player2UserId, []);
        map.get(m.player2UserId)!.push(m);
      }
    });
    return map;
  }, [allLeagueMatches]);

  // Compute detailed status for each user
  const userStatsList = useMemo(() => {
    return allPersons.map((user) => {
      const memberships = userMembershipsMap.get(user.id) || [];
      
      // Determine linked club IDs & roles
      const clubIdsSet = new Set<string>();
      memberships.forEach((m) => {
        if (m.vereinId) clubIdsSet.add(m.vereinId);
      });
      if (user.vereinsId) clubIdsSet.add(user.vereinsId);
      if (Array.isArray(user.clubs)) {
        user.clubs.forEach((c: any) => {
          const cId = typeof c === "string" ? c : (c.vereinsId || c.id);
          if (cId) clubIdsSet.add(cId);
        });
      }

      const linkedClubs = Array.from(clubIdsSet).map((cId) => {
        const normCId = cId.toLowerCase().replace(/\s/g, "");
        const cName = clubNameMap.get(cId) || clubNameMap.get(cId.toLowerCase()) || clubNameMap.get(normCId) || resolveClubName(cId, undefined, clubs);

        const mem = memberships.find(
          (m) => m.vereinId && m.vereinId.toLowerCase().replace(/\s/g, "") === normCId
        );

        let clubRole: Role = Role.MITGLIED;
        if (mem && mem.role) {
          clubRole = (mem.role === Role.ADMIN || (mem.role as any) === "admin") ? Role.ADMIN : Role.MITGLIED;
        } else if (Array.isArray(user.clubs)) {
          const uClub = user.clubs.find((c: any) => {
            const id = typeof c === "string" ? c : (c.vereinsId || c.id);
            return id && id.toLowerCase().replace(/\s/g, "") === normCId;
          });
          if (uClub && typeof uClub !== "string" && uClub.role) {
            clubRole = (uClub.role === Role.ADMIN || (uClub.role as any) === "admin") ? Role.ADMIN : Role.MITGLIED;
          }
        } else if (
          (user.vereinsId && user.vereinsId.toLowerCase().replace(/\s/g, "") === normCId) ||
          ((user as any).tenantId && (user as any).tenantId.toLowerCase().replace(/\s/g, "") === normCId)
        ) {
          clubRole = (user.role === Role.ADMIN || (user.role as any) === "admin") ? Role.ADMIN : Role.MITGLIED;
        }

        return {
          clubId: cId,
          clubName: cName,
          role: clubRole,
          isAdmin: clubRole === Role.ADMIN,
        };
      });

      const linkedClubIds = linkedClubs.map((c) => c.clubId);
      const linkedClubNames = linkedClubs.map((c) => c.clubName);

      // Matches
      const matches = userMatchesMap.get(user.id) || [];
      const activeMatches = matches.filter((m) => m.status !== "cancelled");

      // Match breakdown by club
      const matchesByClub: Record<string, number> = {};
      activeMatches.forEach((m) => {
        const cId = m.clubId || "unassigned";
        matchesByClub[cId] = (matchesByClub[cId] || 0) + 1;
      });

      // Protection & Backup Status
      let isProtected = false;
      let protectionType: "admin" | "backup" | "none" = "none";
      let backupCount = 0;

      const isSuperAdminUser =
        (user.role === Role.SUPER_ADMIN || (user.role as any) === "super-admin") &&
        (user.id === "superadmin" ||
          (user.username && user.username.toLowerCase() === "superadmin") ||
          (user.name && user.name.toLowerCase() === "superadmin") ||
          user.vereinsId === "super-admin" ||
          (user as any).tenantId === "system");

      const hasAdminRole =
        isSuperAdminUser ||
        user.hauptAdmin ||
        linkedClubs.some((c) => c.isAdmin);

      if (hasAdminRole) {
        isProtected = true;
        protectionType = "admin";
      } else {
        if (globalBackups && globalBackups.length > 0) {
          backupCount = globalBackups.length;
        } else {
          linkedClubIds.forEach((cId) => {
            const clubBackups = backupsByClub[cId] || [];
            backupCount += clubBackups.length;
          });
        }
        if (backupCount > 0) {
          isProtected = true;
          protectionType = "backup";
        }
      }

      return {
        user,
        memberships,
        linkedClubs,
        linkedClubIds,
        linkedClubNames,
        matches,
        activeMatchesCount: activeMatches.length,
        matchesByClub,
        isProtected,
        protectionType,
        backupCount,
      };
    });
  }, [allPersons, userMembershipsMap, userMatchesMap, clubNameMap, backupsByClub]);

  // Filtered users list
  const filteredUserStats = useMemo(() => {
    return userStatsList.filter((item) => {
      const u = item.user;
      // 1. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const fullName = `${u.firstName || ""} ${u.lastName || ""} ${u.klarname || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        const username = (u.name || "").toLowerCase();
        const uid = u.id.toLowerCase();
        if (
          !fullName.includes(term) &&
          !email.includes(term) &&
          !username.includes(term) &&
          !uid.includes(term)
        ) {
          return false;
        }
      }

      // 2. Club filter
      if (selectedClubFilter !== "all") {
        if (!item.linkedClubIds.includes(selectedClubFilter)) {
          return false;
        }
      }

      // 3. Protection filter
      if (selectedProtectionFilter === "admin") {
        if (item.protectionType !== "admin") return false;
      } else if (selectedProtectionFilter === "backup") {
        if (item.protectionType !== "backup") return false;
      } else if (selectedProtectionFilter === "none") {
        if (item.protectionType !== "none") return false;
      }

      return true;
    });
  }, [userStatsList, searchTerm, selectedClubFilter, selectedProtectionFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUserStats.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUserStats.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUserStats, currentPage]);

  // Selection handlers
  const isPageAllSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((item) => selectedUserIds.includes(item.user.id));

  const isFilteredAllSelected =
    filteredUserStats.length > 0 &&
    filteredUserStats.every((item) => selectedUserIds.includes(item.user.id));

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedUsers.map((item) => item.user.id);
    if (isPageAllSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectFilteredAll = () => {
    if (isFilteredAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUserStats.map((item) => item.user.id));
    }
  };

  // --- Handlers: Single Actions ---

  // 1. Assign user to club
  const handleOpenAssignClub = (
    person: Person,
    linkedClubIds: string[],
    linkedClubNames: string[]
  ) => {
    const unlinkedClubs = clubs.filter(
      (c) =>
        c.aktiv !== false &&
        c.vereinsId !== "super-admin" &&
        c.vereinsId !== "system" &&
        !linkedClubIds.includes(c.vereinsId)
    );
    setAssignClubForm({
      clubId: unlinkedClubs[0]?.vereinsId || "",
      role: Role.MITGLIED,
    });
    setAssignClubUser({
      user: person,
      linkedClubIds,
      linkedClubNames,
    });
  };

  const handleExecuteAssignClub = async () => {
    if (!assignClubUser || !assignClubForm.clubId) return;
    const { user } = assignClubUser;
    const targetClubId = assignClubForm.clubId;
    const targetClubName = clubNameMap.get(targetClubId) || clubNameMap.get(targetClubId.toLowerCase()) || resolveClubName(targetClubId, undefined, clubs);

    setLoadingAction(`assign_${user.id}`);
    try {
      await addExistingPersonToClub(
        user.id,
        targetClubId,
        assignClubForm.role,
        targetClubName
      );
      const displayName =
        user.firstName || user.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user.name || user.id;
      showToast(
        `"${displayName}" wurde erfolgreich dem Verein "${targetClubName}" zugewiesen.`
      );
      setAssignClubUser(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler bei der Vereinszuweisung: ${err.message}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Remove single user from club
  const handleExecuteSingleRemoveClub = async () => {
    if (!singleRemoveClubUser) return;
    const { user, clubId, clubName } = singleRemoveClubUser;
    setLoadingAction(`remove_${user.id}`);
    try {
      await removeUserFromClub(user.id, clubId);
      showToast(
        `Person "${user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.name}" wurde erfolgreich aus "${clubName}" entfernt.`
      );
      setSingleRemoveClubUser(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler beim Entfernen aus Verein: ${err.message}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Last club purge handler
  const handleExecuteLastClubPurge = async () => {
    if (!lastClubWarningUser) return;
    const { user } = lastClubWarningUser;
    setLoadingAction(`purge_${user.id}`);
    try {
      const res = await purgeUserAccount(user.id);
      const displayName =
        user.firstName || user.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user.name || user.id;
      showToast(
        `Letzter Verein entfernt: Konto von "${displayName}" wurde vollständig gelöscht. ${
          res.cancelledMatchesCount > 0
            ? `${res.cancelledMatchesCount} Ligaspiele wurden annulliert und die Punkte neu berechnet.`
            : ""
        }`
      );
      setLastClubWarningUser(null);
      setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler beim Löschen des Kontos: ${err.message}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Single Purge
  const handleExecuteSinglePurge = async () => {
    if (!singlePurgeUser) return;
    const user = singlePurgeUser;
    setLoadingAction(`purge_${user.id}`);
    try {
      const res = await purgeUserAccount(user.id);
      const displayName =
        user.firstName || user.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user.name || user.id;
      showToast(
        `Konto von "${displayName}" wurde unwiderruflich gelöscht. ${
          res.cancelledMatchesCount > 0
            ? `${res.cancelledMatchesCount} Ligaspiele wurden annulliert und die Punkte neu berechnet.`
            : ""
        }`
      );
      setSinglePurgeUser(null);
      setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler beim Löschen des Kontos: ${err.message}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Role switcher handler for single club membership
  const handleUpdateRoleInClub = async (
    userId: string,
    clubId: string,
    newRole: Role,
    clubName: string
  ) => {
    setLoadingAction(`role_${userId}_${clubId}`);
    try {
      await updateUserTenantRole(userId, clubId, newRole);
      const roleLabel = newRole === Role.ADMIN ? "Vereins-Admin" : "Mitglied / Spieler";
      showToast(`Rolle für "${clubName}" erfolgreich auf "${roleLabel}" geändert.`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler beim Ändern der Rolle: ${err.message}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Batch Purge
  const handleExecuteBatchPurge = async () => {
    if (selectedUserIds.length === 0) return;
    setShowBatchPurgeModal(false);
    setLoadingAction("batch_purge");

    setProgressStatus({
      current: 0,
      total: selectedUserIds.length,
      message: "Starte Konto-Löschungen...",
    });

    try {
      const res = await purgeUserAccountsBatch(
        selectedUserIds,
        (curr, total, msg) => {
          setProgressStatus({ current: curr, total, message: msg });
        }
      );

      showToast(
        `${res.successCount} von ${selectedUserIds.length} Konten wurden erfolgreich gelöscht. ${
          res.totalCancelledMatches > 0
            ? `${res.totalCancelledMatches} Ligaspiele wurden annulliert.`
            : ""
        }`
      );
      setSelectedUserIds([]);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(`Fehler bei Stapellöschung: ${err.message}`, "error");
    } finally {
      setProgressStatus(null);
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-black text-[#1b4332] uppercase tracking-wider">Benutzerverwaltung</h2>
        <button
          onClick={() => setShowCreateUserModal(true)}
          className="px-4 py-2.5 bg-[#1b4332] hover:bg-emerald-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <i className="fa-solid fa-user-plus"></i> Neuen Benutzer anlegen
        </button>
      </div>

      {showCreateUserModal && (
        <SuperAdminCreateUserModal 
          onClose={() => setShowCreateUserModal(false)}
          clubs={clubs}
          onUserCreated={() => {
            setShowCreateUserModal(false);
            showToast("Benutzer erfolgreich angelegt", "success");
            // The list will update automatically via Firebase listener
          }}
        />
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <div
          className={`fixed bottom-6 right-6 z-[100] p-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 transition-all ${
            toastNotification.type === "success"
              ? "bg-emerald-900 text-white border-emerald-500"
              : "bg-rose-900 text-white border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              toastNotification.type === "success"
                ? "fa-circle-check text-emerald-400"
                : "fa-triangle-exclamation text-rose-400"
            } text-xl`}
          ></i>
          <span className="text-xs font-bold leading-relaxed">
            {toastNotification.message}
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Header & Description */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-user-shield text-[#1b4332]"></i>
              Benutzer-Verwaltung & Account-Purge
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 max-w-4xl">
              Globale Liste aller registrierten Konten über alle Vereine hinweg. Hier kannst du Mitgliedschaften entkoppeln oder ungenutzte Accounts und verbundene Ligaspiele unwiderruflich löschen.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold text-slate-700">
            <i className="fa-solid fa-users text-[#1b4332]"></i>
            <span>Gesamt im System: <strong>{allPersons.length} Konten</strong></span>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Bulk Actions */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Name, E-Mail, Username oder ID suchen..."
                className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#1b4332] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Club Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Verein:
              </label>
              <select
                value={selectedClubFilter}
                onChange={(e) => {
                  setSelectedClubFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#1b4332] font-sans font-medium"
              >
                <option value="all">Alle Vereine ({clubs.length})</option>
                {clubs.map((c) => (
                  <option key={c.vereinsId} value={c.vereinsId}>
                    {c.vereinsName || c.name || c.vereinsId}
                  </option>
                ))}
              </select>
            </div>

            {/* Protection Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Schutz-Status:
              </label>
              <select
                value={selectedProtectionFilter}
                onChange={(e) => {
                  setSelectedProtectionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#1b4332] font-sans font-medium"
              >
                <option value="all">Alle Schutzstufen</option>
                <option value="backup">Gesichert (In Backup vorhanden)</option>
                <option value="none">Kein Backup (Ungeschützt)</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection & Actions Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
              <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg border border-slate-200">
                Gefiltert: <strong>{filteredUserStats.length}</strong> von <strong>{allPersons.length}</strong> Konten
              </span>
              <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-200">
                Anzeige: <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredUserStats.length)}</strong> (Seite {currentPage} von {totalPages})
              </span>
              {selectedUserIds.length > 0 && (
                <span className="bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 font-black flex items-center gap-1.5">
                  <i className="fa-solid fa-check-double text-purple-600"></i>
                  {selectedUserIds.length} ausgewählt
                </span>
              )}
            </div>

            {/* Batch Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={toggleSelectPage}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isPageAllSelected ? "Diese Seite abwählen" : `Diese Seite auswählen (${paginatedUsers.length})`}
              </button>
              <button
                onClick={toggleSelectFilteredAll}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isFilteredAllSelected ? "Alle abwählen" : `Alle gefilterten auswählen (${filteredUserStats.length})`}
              </button>

              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Batch Purge Button */}
                  <button
                    disabled={loadingAction !== null}
                    onClick={() => setShowBatchPurgeModal(true)}
                    className="bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-rose-800"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    Löschen ({selectedUserIds.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Progress Bar Indicator */}
        {progressStatus && (
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-3 border-2 border-slate-700">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
              <span className="flex items-center gap-2 text-emerald-400">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Stapelverarbeitung läuft...
              </span>
              <span className="font-mono text-emerald-300 text-sm">
                {progressStatus.current} / {progressStatus.total} ({Math.round((progressStatus.current / progressStatus.total) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-300 shadow-md"
                style={{ width: `${Math.max(5, (progressStatus.current / progressStatus.total) * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">{progressStatus.message}</p>
          </div>
        )}

        {/* Global User Table */}
        {filteredUserStats.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto text-xl">
              <i className="fa-solid fa-user-slash"></i>
            </div>
            <h3 className="text-sm font-bold text-slate-700">Keine Konten gefunden</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Für die gewählten Filter oder den Suchbegriff wurden keine Benutzerkonten ermittelt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border-2 border-slate-200 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input className="w-4 h-4 accent-[#1b4332] rounded cursor-pointer placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </th>
                  <th className="py-3 px-4">Name & E-Mail</th>
                  <th className="py-3 px-4">Verknüpfte Vereine</th>
                  <th className="py-3 px-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {paginatedUsers.map((item) => {
                  const {
                    user,
                    linkedClubs,
                    linkedClubIds,
                    linkedClubNames,
                    activeMatchesCount,
                    matchesByClub,
                    protectionType,
                    backupCount,
                  } = item;

                  const isSelected = selectedUserIds.includes(user.id);

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(user.id)}
                          className="w-4 h-4 accent-[#1b4332] rounded cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                      </td>

                      {/* Name & E-Mail */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {user.firstName || user.lastName
                                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                : user.klarname || user.name || "Unbenannt"}
                            </span>
                            
                            {/* Protection Icons Inline */}
                            {protectionType === "admin" && (
                              <i className="fa-solid fa-shield-halved text-amber-500 text-[10px]" title="Geschützt (Admin)"></i>
                            )}
                            {protectionType === "backup" && (
                              <i className="fa-solid fa-shield-check text-emerald-500 text-[10px]" title={`Gesichert (${backupCount} Backups)`}></i>
                            )}

                            {(user.role === Role.SUPER_ADMIN || (user.role as any) === "super-admin") &&
                            (user.id === "superadmin" ||
                              user.username?.toLowerCase() === "superadmin" ||
                              user.name?.toLowerCase() === "superadmin" ||
                              user.vereinsId === "super-admin" ||
                              (user as any).tenantId === "system") && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-amber-300 uppercase">
                                Super-Admin
                              </span>
                            )}
                            {user.hauptAdmin && (
                              <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-purple-300 uppercase">
                                Haupt-Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {user.is_placeholder_email ||
                            (user.email &&
                              user.email.startsWith("no-email.") &&
                              user.email.endsWith("@internal.app")) ? (
                              <span className="text-slate-400 italic text-[11px] leading-tight">
                                [Keine E-Mail]
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium text-[11px] leading-tight">
                                {user.email || "[Keine E-Mail]"}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[9px] text-slate-400 leading-tight">
                            ID: {user.id}
                          </div>
                        </div>
                      </td>

                      {/* Linked Clubs */}
                      <td className="py-3.5 px-4">
                        {linkedClubs.length === 0 ? (
                          <span className="text-slate-400 text-[11px] font-medium">
                            Kein Verein verknüpft
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {linkedClubs.map((club) => {
                              return (
                                <span
                                  key={club.clubId}
                                  className={`px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1 border transition-all ${
                                    club.isAdmin
                                      ? "bg-amber-50 text-amber-900 border-amber-300 font-black shadow-2xs"
                                      : "bg-slate-100 text-slate-600 border-slate-200 font-semibold"
                                  }`}
                                  title={
                                    club.isAdmin
                                      ? `${club.clubName} (Vereins-Admin)`
                                      : `${club.clubName} (Mitglied / Spieler)`
                                  }
                                >
                                  {club.isAdmin && (
                                    <i className="fa-solid fa-crown text-amber-600 text-[9px]"></i>
                                  )}
                                  <span>{club.clubName}</span>
                                  {club.isAdmin && (
                                    <span className="text-[8px] uppercase tracking-wider font-black text-amber-700 bg-amber-200/60 px-1 py-0.2 rounded border border-amber-300/60">
                                      Admin
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          <button
                            onClick={() => handleOpenGlobalEdit(user, linkedClubs)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                            title={`Nutzer ${user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.name || user.id} bearbeiten`}
                          >
                            <i className="fa-solid fa-pen"></i>
                            <span className="hidden sm:inline">Bearbeiten</span>
                          </button>
                          
                          {/* Proxy als Button */}
                          <button
                            onClick={() => handleInitiateProxy(user, linkedClubIds, linkedClubNames)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                            title={`Als ${user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.name || user.id} einloggen`}
                          >
                            <i className="fa-solid fa-user-check text-blue-600"></i>
                            <span className="hidden sm:inline">Proxy als</span>
                          </button>

                          {/* Context Menu Dropdown / Modal Trigger */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserActionsModalUser({
                                  user,
                                  linkedClubs,
                                  linkedClubIds,
                                  linkedClubNames,
                                });
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                              title="Aktionen & Rollen verwalten"
                            >
                              <i className="fa-solid fa-ellipsis-vertical"></i>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 bg-slate-50/50">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-chevron-left"></i> Vorherige 30
                </button>
                <span className="text-xs font-bold text-slate-600">
                  Seite {currentPage} von {totalPages} ({filteredUserStats.length} Konten)
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs flex items-center justify-center gap-2"
                >
                  Nächste 30 <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODAL 0A: Assign User to Club --- */}
      {assignClubUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden space-y-0">
            <div className="bg-emerald-50 border-b border-emerald-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0 text-xl">
                <i className="fa-solid fa-building-circle-check"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base">
                  Verein zuweisen
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Benutzer einem weiteren Verein hinzufügen
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Wähle den Ziel-Verein und die Rolle für{" "}
                <strong className="text-slate-900">
                  {assignClubUser.user.firstName || assignClubUser.user.lastName
                    ? `${assignClubUser.user.firstName || ""} ${assignClubUser.user.lastName || ""}`.trim()
                    : assignClubUser.user.name || assignClubUser.user.id}
                </strong>
                :
              </p>

              {(() => {
                const availableClubs = clubs.filter(
                  (c) =>
                    c.aktiv !== false &&
                    c.vereinsId !== "super-admin" &&
                    c.vereinsId !== "system" &&
                    !assignClubUser.linkedClubIds.includes(c.vereinsId)
                );

                if (availableClubs.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-500 text-center space-y-1">
                      <p className="font-bold text-slate-700">Keine weiteren Vereine verfügbar</p>
                      <p className="text-[11px]">
                        Dieser Benutzer ist bereits in allen im System registrierten Vereinen Mitglied.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-0.5 tracking-wider">
                        Ziel-Verein
                      </label>
                      <select
                        value={assignClubForm.clubId}
                        onChange={(e) =>
                          setAssignClubForm({ ...assignClubForm, clubId: e.target.value })
                        }
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-[#1b4332] font-sans font-medium"
                      >
                        {availableClubs.map((c) => (
                          <option key={c.vereinsId} value={c.vereinsId}>
                            {c.vereinsName || c.name || c.vereinsId} ({c.vereinsId})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-0.5 tracking-wider">
                        Rolle im Verein
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAssignClubForm({ ...assignClubForm, role: Role.MITGLIED })}
                          className={`h-8 px-3 py-1 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                            assignClubForm.role === Role.MITGLIED
                              ? "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <i className={`fa-solid fa-circle-check text-xs ${assignClubForm.role === Role.MITGLIED ? "text-emerald-600" : "text-slate-300"}`}></i>
                          Mitglied / Spieler
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignClubForm({ ...assignClubForm, role: Role.ADMIN })}
                          className={`h-8 px-3 py-1 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                            assignClubForm.role === Role.ADMIN
                              ? "bg-amber-50 border-amber-400 text-amber-900 shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <i className={`fa-solid fa-circle-check text-xs ${assignClubForm.role === Role.ADMIN ? "text-amber-600" : "text-slate-300"}`}></i>
                          Vereins-Admin
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-[11px] text-slate-500">
                      <p>• Das Benutzerkonto wird dem ausgewählten Verein sofort zugeordnet.</p>
                      <p>• Die Verknüpfung wird in Echtzeit in der Tabelle und für Proxy-Sitzungen wirksam.</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setAssignClubUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                disabled={
                  loadingAction !== null ||
                  !assignClubForm.clubId ||
                  clubs.filter(
                    (c) =>
                      c.aktiv !== false &&
                      c.vereinsId !== "super-admin" &&
                      c.vereinsId !== "system" &&
                      !assignClubUser.linkedClubIds.includes(c.vereinsId)
                  ).length === 0
                }
                onClick={handleExecuteAssignClub}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                {loadingAction !== null && <i className="fa-solid fa-spinner fa-spin"></i>}
                Zuweisen & Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 0B: Last Club Removal Warning Modal --- */}
      {lastClubWarningUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center shrink-0 text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Achtung: Letzter verknüpfter Verein
                </h3>
                <p className="text-xs text-rose-700 font-bold mt-0.5">
                  Entkoppeln löscht das gesamte Benutzerkonto
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 text-rose-950 font-medium">
                Achtung:{" "}
                <strong className="font-black text-slate-900">
                  {lastClubWarningUser.user.firstName || lastClubWarningUser.user.lastName
                    ? `${lastClubWarningUser.user.firstName || ""} ${lastClubWarningUser.user.lastName || ""}`.trim()
                    : lastClubWarningUser.user.name || lastClubWarningUser.user.id}
                </strong>{" "}
                ist nur noch mit{" "}
                <strong className="font-black text-rose-700">
                  {lastClubWarningUser.clubName}
                </strong>{" "}
                verknüpft. Das Entfernen des letzten Vereins löscht das Benutzerkonto vollständig aus dem System.
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                  Automatische Purge-Schritte:
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-trophy text-amber-600 mt-0.5"></i>
                    <span><strong>Ligaspiele-Annullierung:</strong> Alle Hobbyliga-Matches dieser Person werden annulliert und die Punkte der Gegner chronologisch neu berechnet.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-user-xmark text-rose-600 mt-0.5"></i>
                    <span><strong>Mitgliedschaften & Profil:</strong> Sämtliche Vereinsmitgliedschaften und das globale Benutzerkonto werden restlos gelöscht.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setLastClubWarningUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                disabled={loadingAction !== null}
                onClick={handleExecuteLastClubPurge}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                {loadingAction !== null && <i className="fa-solid fa-spinner fa-spin"></i>}
                Konto endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: Single Remove From Club Modal --- */}
      {singleRemoveClubUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden space-y-0">
            <div className="bg-amber-50 border-b border-amber-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0 text-xl">
                <i className="fa-solid fa-user-minus"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base">
                  Aus Verein entkoppeln
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Löscht nur die Vereinsmitgliedschaft im gewählten Verein.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Möchtest du <strong>{singleRemoveClubUser.user.firstName} {singleRemoveClubUser.user.lastName}</strong> wirklich aus dem Verein <strong className="text-amber-800">{singleRemoveClubUser.clubName}</strong> entfernen?
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-slate-600">
                <p>• Das globale Benutzerkonto in der Datenbank bleibt erhalten.</p>
                <p>• Die Zuordnung zum Verein "{singleRemoveClubUser.clubName}" wird gelöscht.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setSingleRemoveClubUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                disabled={loadingAction !== null}
                onClick={handleExecuteSingleRemoveClub}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                {loadingAction !== null && <i className="fa-solid fa-spinner fa-spin"></i>}
                Aus Verein entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Single Purge User Modal --- */}
      {singlePurgeUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center shrink-0 text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">
                  Account unwiderruflich löschen
                </h3>
                <p className="text-xs text-rose-700 font-bold mt-0.5">
                  Sicherheitsprüfung & Hard-Delete Prozess
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Du bist dabei, das Benutzerkonto von <strong className="text-slate-900 text-sm">{singlePurgeUser.firstName} {singlePurgeUser.lastName}</strong> (ID: {singlePurgeUser.id}) vollständig zu löschen.
              </p>

              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                  Automatische Purge-Schritte:
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-trophy text-amber-600 mt-0.5"></i>
                    <span><strong>Ligaspiele-Annullierung:</strong> Alle Hobbyliga-Matches dieser Person werden annulliert und die Punkte der Gegner chronologisch neu berechnet.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-user-xmark text-rose-600 mt-0.5"></i>
                    <span><strong>Mitgliedschaften & Profil:</strong> Sämtliche Vereinsmitgliedschaften und das Ligasport-Profil werden gelöscht.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setSinglePurgeUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                disabled={loadingAction !== null}
                onClick={handleExecuteSinglePurge}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                {loadingAction !== null && <i className="fa-solid fa-spinner fa-spin"></i>}
                Konto jetzt unwiderruflich löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Batch Purge Confirm Modal --- */}
      {showBatchPurgeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center shrink-0 text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">
                  Stapellöschung von {selectedUserIds.length} Konten
                </h3>
                <p className="text-xs text-rose-700 font-bold mt-0.5">
                  Warnung: Unwiderruflicher Hard-Delete
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Du bist dabei, <strong className="text-rose-700 text-sm font-black">{selectedUserIds.length} ausgewählte Benutzerkonten</strong> unwiderruflich aus dem System zu löschen.
              </p>

              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                  Ablauf der Stapellöschung:
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-rotate text-amber-600 mt-0.5"></i>
                    <span><strong>Hobbyliga Re-Calculation:</strong> Alle betroffenen Ligaspiele werden annulliert und die Punktehistorie am Ende in einem Durchgang chronologisch neu berechnet.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <i className="fa-solid fa-trash-can text-rose-600 mt-0.5"></i>
                    <span><strong>Restlose Bereinigung:</strong> Mitgliedschaften und Benutzerprofile der ausgewählten Konten werden restlos entfernt.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowBatchPurgeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                disabled={loadingAction !== null}
                onClick={handleExecuteBatchPurge}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                {loadingAction !== null && <i className="fa-solid fa-spinner fa-spin"></i>}
                Alle {selectedUserIds.length} Konten löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Club Selection Dialog for Proxy Session */}
      {proxyClubSelectionUser && (
        <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden -200">
            <div className="bg-blue-50 border-b border-blue-100 p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-sm">
                <i className="fa-solid fa-user-check"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Vereins-Kontext auswählen
                </h3>
                <p className="text-xs text-blue-700 font-bold mt-0.5">
                  Mehrere Vereine verknüpft
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                In welchem Verein möchtest du als{" "}
                <strong className="text-slate-900 font-bold">
                  {proxyClubSelectionUser.user.firstName || proxyClubSelectionUser.user.lastName
                    ? `${proxyClubSelectionUser.user.firstName || ""} ${proxyClubSelectionUser.user.lastName || ""}`.trim()
                    : proxyClubSelectionUser.user.name}
                </strong>{" "}
                agieren?
              </p>

              <div className="space-y-2">
                {proxyClubSelectionUser.linkedClubIds.map((cId, idx) => {
                  const cName = proxyClubSelectionUser.linkedClubNames[idx] || clubNameMap.get(cId) || resolveClubName(cId, undefined, clubs);
                  return (
                    <button
                      key={cId}
                      onClick={() => {
                        executeProxy(proxyClubSelectionUser.user, cId);
                        setProxyClubSelectionUser(null);
                      }}
                      className="w-full bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-800 p-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <i className="fa-solid fa-building-columns text-slate-400 group-hover:text-blue-600 transition-colors"></i>
                        {cName}
                      </span>
                      <span className="text-[10px] uppercase font-black tracking-wider text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Wählen &rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setProxyClubSelectionUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Edit Modal */}
      {globalEditUser && (
        <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col -200/80">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square text-blue-600"></i>
                  Profil bearbeiten
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Globale Benutzerdaten von {globalEditUser.user.firstName || globalEditUser.user.lastName ? `${globalEditUser.user.firstName || ''} ${globalEditUser.user.lastName || ''}`.trim() : globalEditUser.user.name || globalEditUser.user.id} anpassen
                </p>
              </div>
              <button
                onClick={() => setGlobalEditUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
              {/* 1. PERSÖNLICHE DATEN */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  1. Persönliche Daten
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Vorname <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={globalEditForm.firstName}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, firstName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Vorname"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Nachname <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={globalEditForm.lastName}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, lastName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Nachname"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Geschlecht
                    </label>
                    <select
                      value={globalEditForm.gender}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, gender: e.target.value as "m" | "w" })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer font-sans font-medium"
                    >
                      <option value="m">männlich</option>
                      <option value="w">weiblich</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Geburtsdatum
                    </label>
                    <input
                      type="date"
                      min="1900-01-01"
                      max="2099-12-31"
                      value={globalEditForm.birthDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 10) {
                          setGlobalEditForm({ ...globalEditForm, birthDate: val });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* 2. KONTAKTINFORMATIONEN */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  2. Kontaktinformationen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      E-Mail-Adresse <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={globalEditForm.email}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="E-Mail"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Telefonnummer <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={globalEditForm.phone}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="+49 ..."
                    />
                  </div>
                </div>
              </div>

              {/* 3. ZUGANGSDATEN & PASSWORT */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  3. Zugangsdaten & Passwort
                </h3>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                    Benutzername (Anzeigename) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={globalEditForm.name}
                    onChange={(e) => setGlobalEditForm({ ...globalEditForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    placeholder="Benutzername"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Neues Passwort setzen
                    </label>
                    <input
                      type={showGlobalPassword ? "text" : "password"}
                      value={globalEditForm.newPassword}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, newPassword: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12 font-mono font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Nicht ändern..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowGlobalPassword(!showGlobalPassword)}
                      className="absolute right-3 top-[28px] p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      title={showGlobalPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      <i className={`fa-solid ${showGlobalPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 ml-1">
                      Passwort bestätigen
                    </label>
                    <input
                      type={showGlobalPassword ? "text" : "password"}
                      value={globalEditForm.passwordConfirm}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, passwordConfirm: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Bestätigen..."
                    />
                  </div>
                </div>
              </div>

              {/* 4. PRIVATSPHÄRE & APP-ANZEIGE */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  4. Privatsphäre & App-Anzeige
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={globalEditForm.showContactInfo}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, showContactInfo: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-600 accent-blue-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">
                      Kontaktdaten freigeben (E-Mail / Telefon in Börse anzeigen)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={globalEditForm.show_onboarding_hints}
                      onChange={(e) => setGlobalEditForm({ ...globalEditForm, show_onboarding_hints: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-600 accent-blue-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">
                      Tipps anzeigen (Onboarding-Hinweise)
                    </span>
                  </label>
                </div>
              </div>

              {/* 5. VEREINS- & ROLLENZUORDNUNG */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span>5. Vereine & Rollen</span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{Object.keys(globalEditForm.clubAssignments).length}</span>
                </h3>
                                
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-1">
                  {clubs.map((c) => {
                    const isSelected = !!globalEditForm.clubAssignments[c.vereinsId];
                    return (
                      <div
                        key={c.vereinsId}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/30"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const newAssignments = { ...globalEditForm.clubAssignments };
                              if (isSelected) {
                                delete newAssignments[c.vereinsId];
                              } else {
                                newAssignments[c.vereinsId] = Role.MITGLIED;
                              }
                              setGlobalEditForm({ ...globalEditForm, clubAssignments: newAssignments });
                            }}
                            className="w-4 h-4 accent-blue-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span className="text-sm font-bold text-slate-700 truncate flex items-center gap-2">
                            <i className="fa-solid fa-building-columns text-slate-400 text-xs"></i>
                            {c.vereinsName || c.name || c.vereinsId}
                          </span>
                        </label>

                        {isSelected && (
                          <div className="flex items-center gap-2 pl-7 sm:pl-0">
                            <select
                              value={globalEditForm.clubAssignments[c.vereinsId]}
                              onChange={(e) => setGlobalEditForm({
                                ...globalEditForm,
                                clubAssignments: {
                                  ...globalEditForm.clubAssignments,
                                  [c.vereinsId]: e.target.value as Role
                                }
                              })}
                              className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans font-medium"
                            >
                              <option value={Role.MITGLIED}>Spieler (Standard)</option>
                              <option value={Role.ADMIN}>Vereins-Admin</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setGlobalEditUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveGlobalEdit}
                disabled={loadingAction === "global_edit"}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "global_edit" ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-check"></i>
                )}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
      {/* User Actions & Roles Modal */}
      {userActionsModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div
            className="border-none outline-none bg-white rounded-2xl w-full max-w-sm shadow-2xl -200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex flex-col">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-[#1b4332]"></i>
                  Aktionen & Rollen
                </h3>
                <span className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                  {userActionsModalUser.user.firstName || userActionsModalUser.user.lastName ? `${userActionsModalUser.user.firstName || ''} ${userActionsModalUser.user.lastName || ''}`.trim() : userActionsModalUser.user.name || userActionsModalUser.user.id}
                </span>
              </div>
              <button
                onClick={() => setUserActionsModalUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-400 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col gap-6 max-h-[60vh] overflow-y-auto">
              
              {/* 1. Add to Club */}
              <button
                disabled={loadingAction !== null}
                onClick={() => {
                  const u = userActionsModalUser.user;
                  const ids = userActionsModalUser.linkedClubIds;
                  const names = userActionsModalUser.linkedClubNames;
                  setUserActionsModalUser(null);
                  handleOpenAssignClub(u, ids, names);
                }}
                className="w-full text-left h-8 px-3 py-1 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs text-emerald-800 flex items-center justify-between cursor-pointer disabled:opacity-50 transition-colors shadow-sm font-sans font-medium"
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-plus text-emerald-600"></i>
                  Weiteren Verein zuweisen
                </span>
                <i className="fa-solid fa-chevron-right text-emerald-600/50"></i>
              </button>

              {/* 2. Linked Clubs with Role Switcher & Entkoppeln */}
              <div className="space-y-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
                  <span>Verknüpfte Vereine & Rollen</span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                    {userActionsModalUser.linkedClubs.length}
                  </span>
                </div>

                {userActionsModalUser.linkedClubs.length === 0 ? (
                  <div className="px-3 py-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic bg-slate-50">
                    Bisher keinem Verein zugewiesen.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userActionsModalUser.linkedClubs.map((club) => {
                      const isUpdatingRole = loadingAction === `role_${userActionsModalUser.user.id}_${club.clubId}`;

                      return (
                        <div
                          key={club.clubId}
                          className={`rounded-xl p-3 border transition-all ${
                            club.isAdmin
                              ? "bg-amber-50/50 border-amber-200 shadow-sm"
                              : "bg-white border-slate-200 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <i
                                className={`fa-solid ${
                                  club.isAdmin
                                    ? "fa-crown text-amber-600"
                                    : "fa-building text-slate-400"
                                } text-sm shrink-0`}
                              ></i>
                              <span
                                className="font-bold text-sm text-slate-800 truncate"
                                title={club.clubName}
                              >
                                {club.clubName}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={loadingAction !== null}
                              onClick={() => {
                                const u = userActionsModalUser.user;
                                const clubsLen = userActionsModalUser.linkedClubs.length;
                                setUserActionsModalUser(null);
                                if (clubsLen === 1) {
                                  setLastClubWarningUser({
                                    user: u,
                                    clubId: club.clubId,
                                    clubName: club.clubName,
                                  });
                                } else {
                                  setSingleRemoveClubUser({
                                    user: u,
                                    clubId: club.clubId,
                                    clubName: club.clubName,
                                  });
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 text-xs p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer border border-transparent hover:border-rose-100"
                              title={`Aus "${club.clubName}" entkoppeln`}
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>

                          {/* Role Select Switcher */}
                          <div className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 w-12">
                              Rolle:
                            </label>
                            <div className="relative flex-1">
                              <select
                                disabled={isUpdatingRole || loadingAction !== null}
                                value={club.role}
                                onChange={(e) => {
                                  handleUpdateRoleInClub(
                                    userActionsModalUser.user.id,
                                    club.clubId,
                                    e.target.value as Role,
                                    club.clubName
                                  );
                                  setUserActionsModalUser(prev => {
                                    if (!prev) return prev;
                                    const updatedClubs = prev.linkedClubs.map(c => 
                                      c.clubId === club.clubId ? { ...c, role: e.target.value, isAdmin: e.target.value === Role.ADMIN || e.target.value === Role.SUPER_ADMIN } : c
                                    );
                                    return { ...prev, linkedClubs: updatedClubs };
                                  });
                                }}
                                className={`w-full text-xs font-bold rounded-lg px-3 py-1.5 pr-8 border outline-none cursor-pointer transition-all appearance-none shadow-xs ${
                                  club.isAdmin
                                    ? "bg-white border-amber-300 text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                                    : "bg-white border-slate-300 text-slate-700 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/20"
                                }`}
                              >
                                <option value={Role.MITGLIED}>Mitglied / Spieler</option>
                                <option value={Role.ADMIN}>Vereins-Admin</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                                {isUpdatingRole ? (
                                  <i className="fa-solid fa-spinner fa-spin text-amber-600"></i>
                                ) : (
                                  <i className="fa-solid fa-chevron-down"></i>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions (Purge) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                disabled={loadingAction === `purge_${userActionsModalUser.user.id}`}
                onClick={() => {
                  const u = userActionsModalUser.user;
                  setUserActionsModalUser(null);
                  setSinglePurgeUser(u);
                }}
                className="w-full text-center h-8 px-3 py-1 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs text-rose-600 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm font-sans font-medium"
              >
                <i className="fa-solid fa-user-xmark text-rose-500"></i>
                <span>Account vollständig löschen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
