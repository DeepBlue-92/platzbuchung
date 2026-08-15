import React, { useState, useEffect, useRef, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  listenToClubs,
  saveClub,
  toggleClubActive,
  deleteClub,
  softDeleteClub,
  restoreClub,
  listenToUsers,
  saveUser,
  listenToBookings,
  checkAndPerformWeeklyBackup,
  createBackup,
  restoreBackup,
  listenToBackups,
  checkAndPerformGlobalWeeklyBackup,
  createGlobalBackup,
  restoreGlobalBackup,
  listenToGlobalBackups,
  listenToSystemUpdates,
  saveSystemUpdates,
  setGlobalLeagueEnabled,
  performClubMigration,
  listenToMemberships,
  DEFAULT_DYNAMIC_LEAGUES,
} from "../services/db";
import { Role, User, Booking, Person, Mitgliedschaft, LeagueConfigVersion, LeagueMatch, DynamicLeague } from "../types";
import { findSystemDuplicates, mergePersons, DuplicatePair, getIgnoredDuplicatePairs, ignoreDuplicatePair } from "../services/duplicateDetection";
import { checkLeagueMergeConflicts, recalculateLeaguePointsFrom, LEAGUE_MATCHES_COLLECTION } from "../services/league";
import {
  getLeagueConfigVersions,
  saveLeagueConfigVersion,
  deleteLeagueConfigVersion,
  listenToDynamicLeagues,
  ensureLeagueBaseRules,
  saveDynamicLeague,
  toggleDynamicLeagueStatus,
} from "../services/league";
import ClubBackupsPanel from "./ClubBackupsPanel";
import { LeagueRuleEditor } from "./LeagueRuleEditor";
import { RichTextRenderer, RichTextEditorToolbar } from "./RichText";
import { motion, AnimatePresence } from "motion/react";
import SuperAdminUserPurgeTab from "./SuperAdminUserPurgeTab";

export default function SuperAdminDashboard({
  onLogout,
  onLoginAs,
}: {
  onLogout: () => void;
  onLoginAs?: (user: User) => void;
}) {
  const [clubs, setClubs] = useState<any[]>([]);
  const [showNewClubModal, setShowNewClubModal] = useState(false);
  const [newClubForm, setNewClubForm] = useState({
    vereinsId: "",
    vereinsName: "",
    enableLeague: false,
  });
  const [deleteModalClub, setDeleteModalClub] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editClubModalClub, setEditClubModalClub] = useState<any | null>(null);
  const [editClubForm, setEditClubForm] = useState({
    vereinsId: "",
    vereinsName: "",
    enableLeague: false,
  });
  const [editClubError, setEditClubError] = useState<string | null>(null);

  // States for tenant ID modification / migration
  const [newClubIdInput, setNewClubIdInput] = useState("");
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState<string | null>(null);

  // States for club creation and deletion conflict
  const [createClubError, setCreateClubError] = useState<string | null>(null);
  const [showOverwriteConflict, setShowOverwriteConflict] = useState<
    any | null
  >(null);
  const [isCreatingProgress, setIsCreatingProgress] = useState(false);

  // Helper state for permanent deletion in recycle bin table
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);

  // States for expandable Admin lists
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [clubMembers, setClubMembers] = useState<User[]>([]);

  const [resetPasswordModalUser, setResetPasswordModalUser] =
    useState<User | null>(null);
  const [resetPasswordNewPassword, setResetPasswordNewPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null,
  );
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [clubForReset, setClubForReset] = useState<string | null>(null);
  const [showResetPasswordInput, setShowResetPasswordInput] = useState(false);

  // --- Tab States ---
  const [activeTab, setActiveTabState] = useState<
    "allgemein" | "backup" | "recycle-bin" | "changelog" | "duplicates" | "hobbyliga" | "accounts"
  >(() => {
    const saved = localStorage.getItem("superadmin_active_tab");
    if (saved && ["allgemein", "backup", "recycle-bin", "changelog", "duplicates", "hobbyliga", "accounts"].includes(saved)) {
      return saved as any;
    }
    return "allgemein";
  });

  const setActiveTab = (tab: "allgemein" | "backup" | "recycle-bin" | "changelog" | "duplicates" | "hobbyliga" | "accounts") => {
    setActiveTabState(tab);
    localStorage.setItem("superadmin_active_tab", tab);
  };

  // --- Dynamic Leagues CRUD States ---
  const [dynamicLeagues, setDynamicLeagues] = useState<DynamicLeague[]>([]);
  const [dynamicLeaguesLoading, setDynamicLeaguesLoading] = useState<boolean>(true);
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState<boolean>(false);
  const [editingLeague, setEditingLeague] = useState<DynamicLeague | null>(null);
  const [leagueFormData, setLeagueFormData] = useState<{ id?: string; name: string; description: string; active: boolean }>({
    name: "",
    description: "",
    active: true,
  });
  const [savingLeague, setSavingLeague] = useState<boolean>(false);
  const [leagueNotification, setLeagueNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>("all");
  const [managingRulesLeague, setManagingRulesLeague] = useState<{ id: string; name: string } | null>(null);

  // --- Hobbyliga Config States ---
  const [configVersions, setConfigVersions] = useState<LeagueConfigVersion[]>([]);
  const [configVersionsLoading, setConfigVersionsLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configFormData, setConfigFormData] = useState({
    leagueId: "",
    effective_date: new Date().toISOString().split('T')[0],
    base_points_win: 5,
    base_points_loss: 5,
    inactivity_deduction_per_week: 5,
    logistic_factor: 0.05,
    max_bonus: 45,
  });
  const [showConfigConfirmModal, setShowConfigConfirmModal] = useState<"save" | "delete" | null>(null);
  const [deleteTargetConfigId, setDeleteTargetConfigId] = useState<string | null>(null);
  const [recalculatingConfig, setRecalculatingConfig] = useState(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState<boolean>(false);
  const [configNotification, setConfigNotification] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Subscribe to dynamic leagues from database
  useEffect(() => {
    setDynamicLeaguesLoading(true);
    const unsubscribe = listenToDynamicLeagues((leagues) => {
      setDynamicLeagues(leagues);
      setDynamicLeaguesLoading(false);
      ensureLeagueBaseRules(leagues)
        .then(loadConfigVersions)
        .catch((err) => console.error("Fehler beim Anlegen der Liga-Basiswerte:", err));
    });
    return () => unsubscribe();
  }, []);

  const availableLeagues = useMemo(() => {
    if (dynamicLeagues.length > 0) {
      return dynamicLeagues;
    }
    const map = new Map<string, { id: string; name: string; active?: boolean }>();
    DEFAULT_DYNAMIC_LEAGUES.forEach((l) => {
      map.set(l.id, { id: l.id, name: l.name, active: l.active });
    });
    clubs.forEach((c) => {
      if (c?.leagueSettings?.leagues && Array.isArray(c.leagueSettings.leagues)) {
        c.leagueSettings.leagues.forEach((l: any) => {
          if (l && l.id && l.name) {
            map.set(l.id, { id: l.id, name: l.name, active: l.active !== false });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [dynamicLeagues, clubs]);

  const handleOpenNewLeagueModal = () => {
    setEditingLeague(null);
    setLeagueFormData({
      name: "",
      description: "",
      active: true,
    });
    setIsLeagueModalOpen(true);
  };

  const handleOpenEditLeagueModal = (league: DynamicLeague) => {
    setEditingLeague(league);
    setLeagueFormData({
      id: league.id,
      name: league.name,
      description: league.description || "",
      active: league.active !== false,
    });
    setIsLeagueModalOpen(true);
  };

  const handleSaveLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueFormData.name.trim()) return;
    setSavingLeague(true);
    try {
      await saveDynamicLeague({
        id: editingLeague?.id || undefined,
        name: leagueFormData.name.trim(),
        description: leagueFormData.description.trim(),
        active: leagueFormData.active,
      });
      setIsLeagueModalOpen(false);
      setLeagueNotification({
        text: `Liga "${leagueFormData.name.trim()}" erfolgreich ${editingLeague ? "aktualisiert" : "angelegt"}.`,
        type: "success",
      });
      setTimeout(() => setLeagueNotification(null), 4000);
    } catch (err: any) {
      console.error("Error saving league:", err);
      setLeagueNotification({
        text: `Fehler beim Speichern der Liga: ${err.message || err}`,
        type: "error",
      });
    } finally {
      setSavingLeague(false);
    }
  };

  const handleToggleLeagueActive = async (league: DynamicLeague) => {
    const nextStatus = !league.active;
    try {
      await toggleDynamicLeagueStatus(league.id, nextStatus);
      setLeagueNotification({
        text: `Liga "${league.name}" ist jetzt ${nextStatus ? "Aktiv" : "Inaktiv"}.`,
        type: "success",
      });
      setTimeout(() => setLeagueNotification(null), 4000);
    } catch (err: any) {
      console.error("Error toggling league status:", err);
      setLeagueNotification({
        text: `Fehler beim Ändern des Status: ${err.message || err}`,
        type: "error",
      });
    }
  };
  const [usersByClub, setUsersByClub] = useState<Record<string, User[]>>({});
  const [membershipsByClub, setMembershipsByClub] = useState<Record<string, Mitgliedschaft[]>>({});
  const [revealedInitialPassword, setRevealedInitialPassword] = useState<
    Record<string, boolean>
  >({});

  // --- Duplicate Detection & Merging states ---
  const [duplicateFilterLevel, setDuplicateFilterLevel] = useState<string>("all");
  const [duplicateTenantFilter, setDuplicateTenantFilter] = useState<"all" | "intra" | "cross">("all");
  const [mergeLoadingId, setMergeLoadingId] = useState<string | null>(null);
  const [ignoredPairs, setIgnoredPairs] = useState<string[]>([]);
  const [ignoreLoadingId, setIgnoreLoadingId] = useState<string | null>(null);
  const [pairMergeTargets, setPairMergeTargets] = useState<Record<string, string>>({});
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [batchConfirmData, setBatchConfirmData] = useState<{ pairs: DuplicatePair[]; totalConflicts: number } | null>(null);
  const [mergeConfirmData, setMergeConfirmData] = useState<{pair: DuplicatePair, targetId: string, conflictCount: number} | null>(null);

  // --- Changelog / System updates states ---
  const [changelogText, setChangelogText] = useState("");
  const [changelogSavedText, setChangelogSavedText] = useState("");
  const [changelogSavedBy, setChangelogSavedBy] = useState("");
  const [changelogLastUpdated, setChangelogLastUpdated] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [changelogNotification, setChangelogNotification] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inlineFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = listenToClubs(setClubs);
    getIgnoredDuplicatePairs().then(setIgnoredPairs).catch(console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (editClubModalClub) {
      setNewClubIdInput(editClubModalClub.vereinsId);
      setMigrationError(null);
      setMigrationSuccess(null);
    }
  }, [editClubModalClub]);

  const [globalLeagueEnabled, setGlobalLeagueEnabledState] = useState(true);

  const loadConfigVersions = async () => {
    setConfigVersionsLoading(true);
    try {
      let versions = await getLeagueConfigVersions();
      setConfigVersions(versions);
    } catch (err) {
      console.error("Error loading league config versions:", err);
    } finally {
      setConfigVersionsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigVersions();
  }, []);

  const handleOpenNewConfigModal = () => {
    setEditingConfigId(null);
    setConfigFormData({
      effective_date: new Date().toISOString().split('T')[0],
      base_points_win: 5,
      base_points_loss: 5,
      inactivity_deduction_per_week: 5,
      logistic_factor: 0.05,
      max_bonus: 45,
    });
    inlineFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenEditConfigModal = (ver: LeagueConfigVersion) => {
    const targetLeague = availableLeagues.find((l) => l.id === ver.leagueId) || {
      id: ver.leagueId || (ver.is_base_rule ? "base_rule_20000101" : "herren"),
      name: ver.is_base_rule ? "Basis-Regelwerk (Universal)" : (availableLeagues.find((l) => l.id === ver.leagueId)?.name || ver.leagueId || "Hobbyliga"),
    };
    setManagingRulesLeague(targetLeague);
  };

  const handleFormSubmitConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfigConfirmModal("save");
  };

  const handleConfirmSaveConfig = async () => {
    setRecalculatingConfig(true);
    setConfigNotification(null);
    try {
      await saveLeagueConfigVersion({
        id: editingConfigId || undefined,
        leagueId: configFormData.leagueId || undefined,
        effective_date: configFormData.effective_date,
        created_by: "Super-Admin",
        base_points_win: configFormData.base_points_win,
        base_points_loss: configFormData.base_points_loss,
        inactivity_deduction_per_week: configFormData.inactivity_deduction_per_week,
        logistic_factor: configFormData.logistic_factor,
        max_bonus: configFormData.max_bonus,
      });

      await loadConfigVersions();
      setShowConfigConfirmModal(null);
      setConfigNotification({
        text: `Konfiguration ab ${configFormData.effective_date} gespeichert. Alle betroffenen Matches wurden in Echtzeit neu berechnet.`,
        type: "success",
      });
      setTimeout(() => setConfigNotification(null), 6000);
    } catch (err: any) {
      console.error("Error saving config version:", err);
      setConfigNotification({
        text: `Fehler beim Speichern: ${err.message || err}`,
        type: "error",
      });
    } finally {
      setRecalculatingConfig(false);
    }
  };

  const handleConfirmDeleteConfig = async () => {
    if (!deleteTargetConfigId) return;
    setRecalculatingConfig(true);
    setConfigNotification(null);
    try {
      await deleteLeagueConfigVersion(deleteTargetConfigId);
      await loadConfigVersions();
      setShowConfigConfirmModal(null);
      setDeleteTargetConfigId(null);
      setConfigNotification({
        text: "Konfiguration gelöscht. Alle betroffenen Matches wurden mit dem vorherigen Regelwerk neu berechnet.",
        type: "success",
      });
      setTimeout(() => setConfigNotification(null), 6000);
    } catch (err: any) {
      console.error("Error deleting config version:", err);
      setConfigNotification({
        text: `Fehler beim Löschen: ${err.message || err}`,
        type: "error",
      });
    } finally {
      setRecalculatingConfig(false);
    }
  };

  // Subscribe to system updates / global changelog
  useEffect(() => {
    const unsub = listenToSystemUpdates((updates) => {
      if (updates) {
        setChangelogText(updates.text || "");
        setChangelogSavedText(updates.text || "");
        setChangelogSavedBy(updates.updatedBy || "System");
        setChangelogLastUpdated(updates.lastUpdated || "");
        if (updates.globalLeagueEnabled !== undefined) {
          setGlobalLeagueEnabledState(updates.globalLeagueEnabled);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleSaveChangelog = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setChangelogNotification(null);
    try {
      await saveSystemUpdates(changelogText, "Super-Admin");
      setChangelogSavedText(changelogText);
      setChangelogNotification({
        text: "Das Changelog und die System-Updates wurden erfolgreich systemweit für alle Vereins-Administratoren gespeichert.",
        type: "success",
      });
      setTimeout(() => setChangelogNotification(null), 5000);
    } catch (err: any) {
      setChangelogNotification({
        text: `Fehler beim Speichern: ${err.message || err}`,
        type: "error",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  // Background Cleanup for expired Recycle Bin clubs (>30 days old)
  useEffect(() => {
    if (clubs.length === 0) return;
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    clubs.forEach(async (club) => {
      if (club.geloescht === true && club.deletedAt) {
        const deletedTime = new Date(club.deletedAt).getTime();
        if (now - deletedTime >= thirtyDaysInMs) {
          console.warn(
            `Automatic permanent deletion triggered for ${club.vereinsId} (past 30 days backup-period)`,
          );
          try {
            await deleteClub(club.vereinsId);
          } catch (err) {
            console.error(
              `Failed to auto-delete expired club ${club.vereinsId}:`,
              err,
            );
          }
        }
      }
    });
  }, [clubs]);

  // Background check and trigger for automated weekly global backup
  useEffect(() => {
    checkAndPerformGlobalWeeklyBackup().catch((err) => {
      console.error("Automatic weekly global backup check failed:", err);
    });
  }, []);

  // Listen to members dynamically when a club is selected
  useEffect(() => {
    if (!selectedClubId) {
      setClubMembers([]);
      return;
    }
    const unsub = listenToUsers(selectedClubId, (usersRecord) => {
      const list = Object.values(usersRecord);
      setClubMembers(list);
    });
    return () => unsub();
  }, [selectedClubId]);

  // Subscribe to users for ALL clubs to show member counts
  useEffect(() => {
    const activeClubs = clubs.filter(
      (c) =>
        c.vereinsId !== "super-admin" &&
        c.vereinsId !== "system" &&
        c.geloescht !== true,
    );
    const unsubscribes: (() => void)[] = [];

    setUsersByClub({});

    activeClubs.forEach((club) => {
      try {
        const unsubU = listenToUsers(club.vereinsId, (usersRec) => {
          setUsersByClub((prev) => ({
            ...prev,
            [club.vereinsId]: Object.values(usersRec),
          }));
        });
        unsubscribes.push(unsubU);

        const unsubM = listenToMemberships(club.vereinsId, (membershipsList) => {
          setMembershipsByClub((prev) => ({
            ...prev,
            [club.vereinsId]: membershipsList,
          }));
        });
        unsubscribes.push(unsubM);
      } catch (err) {
        console.error(`Error subscribing for ${club.vereinsId}:`, err);
      }
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [clubs]);

  // Aggregate all unique persons and all memberships across clubs
  const allPersons = useMemo(() => {
    const map = new Map<string, Person>();
    Object.values(usersByClub).forEach((userList: any) => {
      userList.forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, u);
        }
      });
    });
    return Array.from(map.values());
  }, [usersByClub]);

  const allMemberships = useMemo(() => {
    return Object.values(membershipsByClub).flat();
  }, [membershipsByClub]);

  // Subscribe to all league matches and global backups for SuperAdmin Purge Tab
  const [allLeagueMatches, setAllLeagueMatches] = useState<LeagueMatch[]>([]);
  const [globalBackups, setGlobalBackups] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, LEAGUE_MATCHES_COLLECTION), (snap) => {
      const list: LeagueMatch[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeagueMatch));
      setAllLeagueMatches(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenToGlobalBackups((bList) => {
      setGlobalBackups(bList);
    });
    return () => unsub();
  }, []);

  const allSystemDuplicates = useMemo(() => {
    return findSystemDuplicates(allPersons, allMemberships, ignoredPairs);
  }, [allPersons, allMemberships, ignoredPairs]);

  const filteredDuplicates = useMemo(() => {
    let filtered = allSystemDuplicates;

    if (duplicateFilterLevel === "very_high") {
      filtered = filtered.filter((d) => d.score >= 85);
    } else if (duplicateFilterLevel === "high") {
      filtered = filtered.filter((d) => d.score >= 65 && d.score < 85);
    } else if (duplicateFilterLevel === "medium") {
      filtered = filtered.filter((d) => d.score >= 40 && d.score < 65);
    }

    if (duplicateTenantFilter !== "all") {
      filtered = filtered.filter((pair) => {
        const isIntraTenant = pair.membershipsA.some(ma => pair.membershipsB.some(mb => ma.vereinId === mb.vereinId)) || (pair.personA.vereinsId && pair.personB.vereinsId && pair.personA.vereinsId === pair.personB.vereinsId);
        if (duplicateTenantFilter === "intra") return isIntraTenant;
        if (duplicateTenantFilter === "cross") return !isIntraTenant;
        return true;
      });
    }

    return filtered;
  }, [allSystemDuplicates, duplicateFilterLevel, duplicateTenantFilter]);

  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.ceil(filteredDuplicates.length / ITEMS_PER_PAGE) || 1;
  const paginatedDuplicates = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDuplicates.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDuplicates, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [duplicateFilterLevel, duplicateTenantFilter]);

  const isAllPageSelected = paginatedDuplicates.length > 0 && paginatedDuplicates.every((p) => selectedPairIds.includes(p.id));
  const isAllFilteredSelected = filteredDuplicates.length > 0 && filteredDuplicates.every((p) => selectedPairIds.includes(p.id));

  const toggleSelectPair = (pairId: string) => {
    setSelectedPairIds((prev) =>
      prev.includes(pairId) ? prev.filter((id) => id !== pairId) : [...prev, pairId]
    );
  };

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const pageIds = paginatedDuplicates.map((p) => p.id);
      setSelectedPairIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedDuplicates.map((p) => p.id);
      setSelectedPairIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedPairIds([]);
    } else {
      setSelectedPairIds(filteredDuplicates.map((p) => p.id));
    }
  };

  const handleBatchMergeClick = async () => {
    const selectedPairs = filteredDuplicates.filter((p) => selectedPairIds.includes(p.id));
    if (selectedPairs.length === 0) return;

    setBatchLoading(true);
    let totalConflicts = 0;

    try {
      const conflictResults = await Promise.all(
        selectedPairs.map(async (pair) => {
          const targetId = pairMergeTargets[pair.id] || pair.personA.id;
          const sourceId = pair.personA.id === targetId ? pair.personB.id : pair.personA.id;
          const count = await checkLeagueMergeConflicts(targetId, sourceId);
          return count;
        })
      );

      totalConflicts = conflictResults.reduce((sum, c) => sum + c, 0);

      if (totalConflicts > 0) {
        setBatchConfirmData({ pairs: selectedPairs, totalConflicts });
        setBatchLoading(false);
      } else {
        await executeBatchMerge(selectedPairs);
      }
    } catch (err: any) {
      alert("Fehler bei der Konfliktprüfung: " + err.message);
      setBatchLoading(false);
    }
  };

  const executeBatchMerge = async (selectedPairs: DuplicatePair[]) => {
    setBatchLoading(true);
    setBatchProgress({
      current: 0,
      total: selectedPairs.length,
      message: "Zusammenführung wird gestartet...",
    });

    let globalOldestDate: string | null = null;
    let successCount = 0;

    for (let i = 0; i < selectedPairs.length; i++) {
      const pair = selectedPairs[i];
      const targetId = pairMergeTargets[pair.id] || pair.personA.id;
      const sourceId = pair.personA.id === targetId ? pair.personB.id : pair.personA.id;

      setBatchProgress({
        current: i + 1,
        total: selectedPairs.length,
        message: `Zusammenführung ${i + 1} von ${selectedPairs.length}: ${pair.personA.firstName} ${pair.personA.lastName} & ${pair.personB.firstName} ${pair.personB.lastName}...`,
      });

      try {
        const res = await mergePersons(targetId, sourceId, { skipRecalculation: true });
        if (res.oldestMatchDate) {
          if (!globalOldestDate || new Date(res.oldestMatchDate) < new Date(globalOldestDate)) {
            globalOldestDate = res.oldestMatchDate;
          }
        }
        successCount++;
      } catch (err: any) {
        console.error(`Fehler bei Paar ${pair.id}:`, err);
      }
    }

    if (globalOldestDate) {
      setBatchProgress({
        current: selectedPairs.length,
        total: selectedPairs.length,
        message: "Neuberechnung der Hobbyliga-Punktehistorie ab Stichtag...",
      });
      try {
        await recalculateLeaguePointsFrom(globalOldestDate);
      } catch (err: any) {
        console.error("Fehler bei Punkte-Neuberechnung:", err);
      }
    }

    const processedIds = new Set(selectedPairs.map((p) => p.id));
    setSelectedPairIds((prev) => prev.filter((id) => !processedIds.has(id)));

    setBatchProgress(null);
    setBatchLoading(false);
    alert(`${successCount} von ${selectedPairs.length} ausgewählten Personenpaaren wurden erfolgreich zusammengeführt.`);
  };

  const getMergedClubsAndRolesForPair = (pair: DuplicatePair) => {
    const clubNameMap = new Map<string, string>();
    clubs.forEach((c) => {
      const id = c.vereinsId || c.id;
      if (id) {
        clubNameMap.set(id, c.vereinsName || c.name || id);
      }
    });

    const clubRoleMap = new Map<string, string>();

    const processPerson = (p: Person, memberships?: Mitgliedschaft[]) => {
      const pRole = p.role;
      if (p.vereinsId) {
        const id = p.vereinsId;
        const r = (pRole === Role.ADMIN || (pRole as any) === "admin") ? "Admin" : "Spieler";
        if (!clubRoleMap.has(id) || r === "Admin") clubRoleMap.set(id, r);
      }
      if (Array.isArray(p.clubs)) {
        p.clubs.forEach((c: any) => {
          const id = typeof c === "string" ? c : (c.vereinsId || c.id);
          const r = (typeof c === "object" && (c.role === Role.ADMIN || c.role === "admin")) ? "Admin" : "Spieler";
          if (id) {
            if (!clubRoleMap.has(id) || r === "Admin") clubRoleMap.set(id, r);
          }
        });
      }
      if (Array.isArray(memberships)) {
        memberships.forEach((m) => {
          if (m.vereinId) {
            const r = (m.role === Role.ADMIN || (m.role as any) === "admin") ? "Admin" : "Spieler";
            if (!clubRoleMap.has(m.vereinId) || r === "Admin") clubRoleMap.set(m.vereinId, r);
          }
        });
      }
    };

    processPerson(pair.personA, pair.membershipsA);
    processPerson(pair.personB, pair.membershipsB);

    const formatted: { clubName: string; role: string; fullLabel: string }[] = [];

    clubRoleMap.forEach((roleLabel, clubId) => {
      if (clubId && clubId !== "super-admin" && clubId !== "system") {
        const name = clubNameMap.get(clubId) || clubId;
        formatted.push({
          clubName: name,
          role: roleLabel,
          fullLabel: `[${name}: ${roleLabel}]`,
        });
      }
    });

    return formatted.length > 0 ? formatted : [{ clubName: "Keine spezifischen Vereine", role: "Spieler", fullLabel: "[Keine spezifischen Vereine: Spieler]" }];
  };

  const handlePreCheckMerge = async (pair: DuplicatePair, targetId: string) => {
    setMergeLoadingId(pair.id);
    try {
      const sourceId = pair.personA.id === targetId ? pair.personB.id : pair.personA.id;
      const count = await checkLeagueMergeConflicts(targetId, sourceId);
      setMergeConfirmData({ pair, targetId, conflictCount: count });
    } catch(e: any) {
      alert("Fehler bei der Konfliktprüfung: " + e.message);
    } finally {
      setMergeLoadingId(null);
    }
  };

  const handleExecuteMerge = async (pair: DuplicatePair, targetId: string) => {
    const sourceId = pair.personA.id === targetId ? pair.personB.id : pair.personA.id;
    
    setMergeLoadingId(pair.id);

    try {
      await mergePersons(targetId, sourceId);
    } catch (err: any) {
      alert(err.message || "Fehler beim Zusammenführen der Personendatensätze.");
    } finally {
      setMergeLoadingId(null);
    }
  };

  const handleIgnorePair = async (pair: DuplicatePair) => {
    try {
      setIgnoreLoadingId(pair.id);
      await ignoreDuplicatePair(pair.personA.id, pair.personB.id);
      setIgnoredPairs(prev => {
        const pId = [pair.personA.id, pair.personB.id].sort().join("_");
        return prev.includes(pId) ? prev : [...prev, pId];
      });
    } catch (error) {
      console.error("Error ignoring duplicate pair", error);
      alert("Fehler beim Ignorieren der Dublette.");
    } finally {
      setIgnoreLoadingId(null);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateClubError(null);
    setShowOverwriteConflict(null);

    if (!newClubForm.vereinsId || !newClubForm.vereinsName) return;

    const normalizedNewId = newClubForm.vereinsId
      .toLowerCase()
      .replace(/\s/g, "");
    if (!/^[a-zA-Z0-9\-]+$/.test(normalizedNewId)) {
      setCreateClubError(
        "Die Mandanten-ID darf nur Buchstaben, Zahlen und Bindestriche enthalten.",
      );
      return;
    }

    // Check if the club already exists (either active or soft-deleted)
    const existingClub = clubs.find((c) => c.vereinsId === normalizedNewId);
    if (existingClub) {
      if (existingClub.geloescht === true) {
        // Soft-deleted conflict! Highlight this so they can decide what to do
        setShowOverwriteConflict(existingClub);
        return;
      } else {
        // Active conflict! Block.
        setCreateClubError(
          `Die Vereins-ID '${normalizedNewId}' wird bereits aktiv von '${existingClub.clubName || existingClub.vereinsName}' verwendet.`,
        );
        return;
      }
    }

    try {
      setIsCreatingProgress(true);
      await saveClub({
        vereinsId: normalizedNewId,
        vereinsName: newClubForm.vereinsName.trim(),
        aktiv: true,
        plaetze: 2,
        enableLeague: newClubForm.enableLeague,
      });
      setShowNewClubModal(false);
      setNewClubForm({ vereinsId: "", vereinsName: "", enableLeague: false });
    } catch (err: any) {
      setCreateClubError("Fehler beim Erstellen des Vereins: " + err.message);
    } finally {
      setIsCreatingProgress(false);
    }
  };

  const handleResolveConflictRestore = async (clubId: string) => {
    try {
      setIsCreatingProgress(true);
      await restoreClub(clubId);
      if (newClubForm.vereinsName) {
        await saveClub({
          vereinsId: clubId,
          vereinsName: newClubForm.vereinsName.trim(),
          aktiv: true,
        });
      }
      setShowNewClubModal(false);
      setShowOverwriteConflict(null);
      setNewClubForm({ vereinsId: "", vereinsName: "", enableLeague: false });
    } catch (err: any) {
      setCreateClubError("Fehler bei der Wiederherstellung: " + err.message);
    } finally {
      setIsCreatingProgress(false);
    }
  };

  const handleResolveConflictOverwrite = async (clubId: string) => {
    try {
      setIsCreatingProgress(true);
      // Clean up previous subcollections completely so they are fully deleted, then recreate
      await deleteClub(clubId);
      await saveClub({
        vereinsId: clubId,
        vereinsName: newClubForm.vereinsName.trim(),
        aktiv: true,
        plaetze: 2,
      });
      setShowNewClubModal(false);
      setShowOverwriteConflict(null);
      setNewClubForm({ vereinsId: "", vereinsName: "" });
    } catch (err: any) {
      setCreateClubError("Fehler beim Überschreiben: " + err.message);
    } finally {
      setIsCreatingProgress(false);
    }
  };

  const handleMigrateId = async () => {
    setMigrationError(null);
    setMigrationSuccess(null);
    if (!editClubModalClub) return;

    const oldId = editClubModalClub.vereinsId;
    const rawNewId = newClubIdInput.trim().toLowerCase().replace(/\s/g, "");

    if (!rawNewId) {
      setMigrationError("Bitte eine neue Mandanten-ID eingeben.");
      return;
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(rawNewId)) {
      setMigrationError(
        "Die ID darf nur Buchstaben, Zahlen und Bindestriche enthalten.",
      );
      return;
    }

    if (rawNewId === oldId) {
      setMigrationError("Die neue ID ist identisch mit der alten ID.");
      return;
    }

    const existing = clubs.find((c) => c.vereinsId === rawNewId);
    if (existing) {
      setMigrationError(
        `Die ID '${rawNewId}' wird bereits für einen anderen Verein verwendet (${existing.clubName || existing.vereinsName}).`,
      );
      return;
    }

    try {
      setMigrationLoading(true);
      await performClubMigration(oldId, rawNewId);
      setMigrationSuccess(
        `Vereins-ID erfolgreich von '${oldId}' nach '${rawNewId}' geändert!`,
      );
      setSelectedClubId(rawNewId);

      setTimeout(() => {
        setEditClubModalClub(null);
        setEditClubError(null);
        setMigrationSuccess(null);
      }, 2500);
    } catch (err: any) {
      setMigrationError("Fehler beim Ändern der ID: " + err.message);
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleEditClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClubForm.vereinsName) {
      setEditClubError("Bitte einen Vereinsnamen angeben.");
      return;
    }
    try {
      await saveClub({
        vereinsId: editClubForm.vereinsId,
        vereinsName: editClubForm.vereinsName.trim(),
        aktiv:
          editClubModalClub.aktiv !== undefined
            ? editClubModalClub.aktiv
            : true,
        enableLeague: editClubForm.enableLeague,
      });
      setEditClubModalClub(null);
      setEditClubError(null);
    } catch (err: any) {
      setEditClubError("Fehler beim Speichern: " + err.message);
    }
  };

  const handleToggle = async (vereinsId: string, current: boolean) => {
    await toggleClubActive(vereinsId, !current);
  };

  const handleConfirmDelete = async (vereinsId: string) => {
    if (deleteConfirmText.toLowerCase().trim() !== "löschen") {
      setDeleteError("Bitte tippe das Wort 'löschen' exakt ein.");
      return;
    }

    const clubPlayers = (usersByClub[vereinsId] || []).filter(
      (u) => u.role !== Role.ADMIN && u.role !== Role.SUPER_ADMIN,
    );

    if (clubPlayers.length > 0) {
      setDeleteError("Löschen blockiert: Es gibt noch aktive Spieler.");
      return;
    }

    try {
      await softDeleteClub(vereinsId);
      setDeleteModalClub(null);
      setDeleteConfirmText("");
      setDeleteError(null);
    } catch (err: any) {
      setDeleteError("Fehler beim Löschen des Vereins: " + err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModalUser || !clubForReset || !resetPasswordNewPassword)
      return;
    if (resetPasswordNewPassword.length < 4) {
      setResetPasswordError("Passwort muss mindestens 4 Zeichen lang sein.");
      return;
    }
    setResetPasswordLoading(true);
    setResetPasswordError(null);
    try {
      // Create updated user object. Update password, and set ersterLogin to false so they can log in
      // or true to force them to change it? Let's leave it false to behave like new admins.
      const updatedUser = {
        ...resetPasswordModalUser,
        password: resetPasswordNewPassword,
      };
      await saveUser(clubForReset, updatedUser);
      setResetPasswordModalUser(null);
      setResetPasswordNewPassword("");
      setClubForReset(null);
    } catch (err: any) {
      console.error(err);
      setResetPasswordError("Fehler beim Zurücksetzen: " + err.message);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 md:px-8">
      <div className="w-full max-w-7xl bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200 p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1b4332] uppercase tracking-tighter">
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500 font-medium font-sans">
              Verwalte tenantübergreifende Einstellungen
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewClubModal(true)}
              className="bg-[#1b4332] text-white hover:bg-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 border border-[#1b4332]"
            >
              <i className="fa-solid fa-plus text-[var(--color-accent-2)]"></i>{" "}
              Neuer Verein
            </button>
            <button
              onClick={onLogout}
              className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all font-medium !text-sm"
              style={{ fontSize: "14px" }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-[14px]"></i> Abmelden
            </button>
          </div>
        </div>

        {/* tab Switch Navigation */}
        <div className="flex flex-nowrap bg-slate-100 p-1.5 rounded-xl mb-8 max-w-full overflow-x-auto whitespace-nowrap border border-slate-200 shadow-sm hide-scrollbar gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab("allgemein")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "allgemein"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-table-list text-[11px]"></i>
            Allgemein
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "backup"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left text-[11px]"></i>
            Backup
          </button>
          <button
            onClick={() => setActiveTab("recycle-bin")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "recycle-bin"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-trash-can text-[11px]"></i>
            Papierkorb
          </button>
          <button
            onClick={() => setActiveTab("changelog")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "changelog"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-file-waveform text-[11px]"></i>
            Changelog
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "duplicates"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-users text-[11px]"></i>
            Mögliche Dubletten
            {allSystemDuplicates.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-500 text-white">
                {allSystemDuplicates.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("hobbyliga")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "hobbyliga"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-trophy text-[11px] text-amber-400"></i>
            Hobbyliga-Einstellungen
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "accounts"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-user-shield text-[11px] text-emerald-400"></i>
            Benutzer-Verwaltung & Purge
          </button>
        </div>

        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.16, ease: "easeInOut" }}
            className="w-full"
          >
            {activeTab === "allgemein" ? (
              <div className="space-y-6">
                {/* Global Module Settings */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-bolt text-amber-600 text-lg"></i>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                        Hobby-Liga (Globales System-Modul)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Der Superadministrator schaltet die Hobby-Liga global für alle Vereine gleichzeitig frei oder sperrt sie. Damit das Modul in einem Verein aktiv ist, muss es global aktiviert sein UND vom jeweiligen Vereins-Administrator in seinen Modul-Einstellungen eingeschaltet werden.
                    </p>
                  </div>
                  <label className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer shrink-0 hover:border-[#1b4332] transition-colors">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      {globalLeagueEnabled ? "Global Aktiviert" : "Global Deaktiviert"}
                    </span>
                    <input
                      type="checkbox"
                      checked={globalLeagueEnabled}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        setGlobalLeagueEnabledState(val);
                        await setGlobalLeagueEnabled(val);
                      }}
                      className="w-5 h-5 accent-[#1b4332] cursor-pointer"
                    />
                  </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-4 font-black">
                        Vereins-ID (Mandant)
                      </th>
                      <th className="px-6 py-4 font-black">Anzeigename</th>
                      <th className="px-6 py-4 font-black text-center">
                        Benutzer
                      </th>
                      <th className="px-6 py-4 font-black text-center">
                        Status
                      </th>
                      <th className="px-6 py-4 font-black text-right">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {clubs
                      .filter(
                        (c) =>
                          c.vereinsId !== "super-admin" &&
                          c.vereinsId !== "system" &&
                          c.geloescht !== true,
                      )
                      .map((club) => {
                        return (
                          <tr
                            key={club.vereinsId}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-mono text-slate-600 font-bold">
                              {club.vereinsId}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">
                              {club.clubName}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-600">
                              {usersByClub[club.vereinsId]?.length || 0}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${club.aktiv ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                              >
                                {club.aktiv ? "Aktiv" : "Gesperrt"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() =>
                                  window.open(`/${club.vereinsId}`, "_blank")
                                }
                                className="text-slate-400 hover:text-[var(--color-accent)] transition-colors p-1.5"
                                title="Anmeldeseite aufrufen"
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                              </button>
                              <button
                                onClick={() => {
                                  setEditClubModalClub(club);
                                  setEditClubForm({
                                    vereinsId: club.vereinsId,
                                    vereinsName:
                                      club.clubName || club.vereinsName || "",
                                    enableLeague: club.modules?.league === true,
                                  });
                                  setEditClubError(null);
                                }}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-1.5"
                                title="Bearbeiten"
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button
                                onClick={() =>
                                  handleToggle(club.vereinsId, club.aktiv)
                                }
                                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5"
                                title={club.aktiv ? "Sperren" : "Aktivieren"}
                              >
                                <i
                                  className={`fa-solid ${club.aktiv ? "fa-ban text-amber-500" : "fa-check text-emerald-500"}`}
                                ></i>
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteModalClub(club);
                                  setDeleteConfirmText("");
                                  setDeleteError(null);
                                }}
                                className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 mr-2"
                                title="Löschen"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                              {onLoginAs && (
                                <button
                                  onClick={() => {
                                    onLoginAs({
                                      id: `temp-admin-${club.vereinsId}`,
                                      name: "Super-Admin",
                                      klarname: "System-Admin",
                                      role: Role.ADMIN,
                                      hauptAdmin: true,
                                      vereinsId: club.vereinsId,
                                      createdAt: new Date().toISOString(),
                                    });
                                  }}
                                  className="bg-emerald-50 hover:bg-emerald-600 hover:text-white text-[#117154] font-black text-[10px] uppercase px-2.5 py-1.5 rounded-xl border border-emerald-200/80 transition-all duration-200 active:scale-95 inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                  title="Direkt auf diesen Mandanten aufschalten (Direct Tenant Access)"
                                >
                                  <i className="fa-solid fa-right-to-bracket text-[10px]"></i>
                                  Aufschalten
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {clubs.filter(
                      (c) =>
                        c.vereinsId !== "super-admin" &&
                        c.vereinsId !== "system" &&
                        c.geloescht !== true,
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-slate-400 font-medium"
                        >
                          Keine Vereine angelegt.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : activeTab === "backup" ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <ClubBackupsPanel />
              </div>
            ) : activeTab === "recycle-bin" ? (
              /* RECYCLE BIN PANEL */
              <div className="space-y-6 font-sans">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-amber-800 tracking-wider">
                      Papierkorb-Richtlinie
                    </h3>
                    <p className="text-[11px] text-amber-700 font-semibold leading-relaxed mt-1">
                      Hier aufgelistete Vereine wurden soft-gelöscht. Sie
                      bleiben exakt{" "}
                      <strong className="font-extrabold text-[#1b4332]">
                        30 Tage lang als Sicherheits-Backup
                      </strong>{" "}
                      gespeichert, um bei Fehlern eine schnelle
                      Wiederherstellung zu ermöglichen.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed font-sans">
                      Nach Ablauf der 30 Tage wird der Verein mitsamt allen
                      Einstellungen, Mitgliedern und historische Verläufen
                      automatisch und endgültig gelöscht. Um versehentlichen
                      Datenverlust zu vermeiden, kann die Löschung hier nicht
                      beschleunigt oder manuell forciert werden.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="px-6 py-4 font-black">Vereins-ID</th>
                        <th className="px-6 py-4 font-black">Anzeigename</th>
                        <th className="px-6 py-4 font-black">Gelöscht am</th>
                        <th className="px-6 py-4 font-black text-center">
                          Frist verbleibend
                        </th>
                        <th className="px-6 py-4 font-black text-right">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {clubs
                        .filter((c) => c.geloescht === true)
                        .map((club) => {
                          const daysElapsed = club.deletedAt
                            ? (Date.now() -
                                new Date(club.deletedAt).getTime()) /
                              (1000 * 60 * 60 * 24)
                            : 0;
                          const daysRemaining = Math.max(
                            1,
                            30 - Math.ceil(daysElapsed),
                          );

                          return (
                            <tr
                              key={club.vereinsId}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-6 py-4 font-mono text-slate-600 font-bold">
                                {club.vereinsId}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-800">
                                {club.clubName}
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-medium font-mono whitespace-nowrap">
                                {club.deletedAt
                                  ? new Date(club.deletedAt).toLocaleString(
                                      "de-DE",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )
                                  : "-"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 border border-rose-100 text-rose-700 inline-block font-sans">
                                  {daysRemaining}{" "}
                                  {daysRemaining === 1 ? "Tag" : "Tage"} übrig
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                {confirmDeleteId === club.vereinsId ? (
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <span className="text-[10px] font-bold text-rose-600 uppercase">
                                      Sicher? Daten gehen verloren!
                                    </span>
                                    <button
                                      disabled={isDeletingPermanently}
                                      onClick={async () => {
                                        try {
                                          setIsDeletingPermanently(true);
                                          await deleteClub(club.vereinsId);
                                          setConfirmDeleteId(null);
                                        } catch (err: any) {
                                          alert(
                                            "Fehler beim endgültigen Löschen: " +
                                              err.message,
                                          );
                                        } finally {
                                          setIsDeletingPermanently(false);
                                        }
                                      }}
                                      className="bg-[#b7092c] hover:bg-[#8f041b] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1 animate-pulse"
                                    >
                                      <i className="fa-solid fa-fire text-[10px]"></i>
                                      {isDeletingPermanently
                                        ? "Löscht..."
                                        : "Ja"}
                                    </button>
                                    <button
                                      disabled={isDeletingPermanently}
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 cursor-pointer"
                                    >
                                      Nein
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 justify-end">
                                    <button
                                      onClick={async () => {
                                        try {
                                          await restoreClub(club.vereinsId);
                                        } catch (err: any) {
                                          alert(
                                            "Fehler beim Wiederherstellen des Vereins: " +
                                              err.message,
                                          );
                                        }
                                      }}
                                      className="bg-[#1b4332] hover:bg-[#153326] text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 border border-[#1b4332] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                    >
                                      <i className="fa-solid fa-rotate-left"></i>
                                      Wiederherstellen
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmDeleteId(club.vereinsId)
                                      }
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-rose-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                      title="Endgültig unwiderruflich löschen"
                                    >
                                      <i className="fa-solid fa-trash-can"></i>
                                      Endgültig löschen
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      {clubs.filter((c) => c.geloescht === true).length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-slate-400 font-semibold font-sans"
                          >
                            Der Papierkorb ist leer. Keine gelöschten Vereine
                            vorhanden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "changelog" ? (
              /* CHANGELOG PANEL */
              <div className="space-y-6 font-sans">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <h2 className="text-sm font-black text-slate-700 uppercase tracking-tight">
                        System-Updates & Changelog
                      </h2>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Bearbeite hier die globalen Systemänderungen. Diese
                        Mitteilung wird allen Vereins-Administratoren in deren
                        Steuerungs-Dashboard als "System-Updates" angezeigt, um
                        über neue Versionen zu informieren.
                      </p>
                    </div>
                    {changelogLastUpdated && (
                      <div className="text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 self-end md:self-auto">
                        Letztes Update:{" "}
                        {new Date(changelogLastUpdated).toLocaleString("de-DE")}{" "}
                        von {changelogSavedBy}
                      </div>
                    )}
                  </div>

                  {changelogNotification && (
                    <div
                      className={`p-4 rounded-xl text-xs font-bold border mb-4 animate-in fade-in duration-200 ${
                        changelogNotification.type === "success"
                          ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                          : "bg-rose-50 border-rose-100 text-rose-800"
                      }`}
                    >
                      {changelogNotification.text}
                    </div>
                  )}

                  <form onSubmit={handleSaveChangelog} className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left block - Markdown Field with Toolbar */}
                      <div className="flex flex-col">
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                          Markdown-Inhalt bearbeiten
                        </label>
                        <RichTextEditorToolbar
                          textareaRef={textareaRef}
                          value={changelogText}
                          onChange={setChangelogText}
                        />
                        <textarea
                          ref={textareaRef}
                          value={changelogText}
                          onChange={(e) => setChangelogText(e.target.value)}
                          placeholder="# Version 2.0.0\n- Neues Modul 'System-Updates' hinzugefügt\n- Fehler bei Dirty-Save-Checks behoben"
                          className="w-full h-96 bg-white border-2 border-t-0 border-slate-200 rounded-b-2xl p-4 text-xs font-bold font-mono text-slate-700 focus:outline-none focus:border-blue-500 hover:border-slate-300 transition-colors resize-y leading-relaxed"
                        />
                      </div>

                      {/* Right block - Real-time Preview */}
                      <div className="flex flex-col">
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                          Vorschau & Layout
                        </label>
                        <div className="w-full h-[432px] overflow-y-auto bg-white border-2 border-slate-200 rounded-2xl p-5 select-text shadow-sm">
                          {changelogText.trim() ? (
                            <div className="rich-text-content">
                              <RichTextRenderer text={changelogText} />
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                              <i className="fa-solid fa-file-lines text-2xl text-slate-300 mb-2"></i>
                              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                                Noch kein Text eingegeben. Beginne mit dem
                                Tippen auf der linken Seite, um eine
                                Echtzeit-Vorschau deines Changelogs zu erhalten.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              "Möchtest du alle ungespeicherten Änderungen am Entwurf wirklich verwerfen?",
                            )
                          ) {
                            setChangelogText(changelogSavedText);
                          }
                        }}
                        disabled={
                          changelogText === changelogSavedText || saveLoading
                        }
                        className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border border-slate-200 cursor-pointer"
                      >
                        Verwerfen
                      </button>
                      <button
                        type="submit"
                        disabled={saveLoading}
                        className="px-6 bg-[#1b4332] hover:bg-black text-white rounded-xl uppercase tracking-widest shadow-lg transition-all active:scale-95 border border-[#1b4332] flex items-center gap-2 cursor-pointer py-2.5 text-sm font-medium"
                      >
                        {saveLoading ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            Speichern...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-floppy-disk"></i>
                            Änderungen veröffentlichen
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : activeTab === "duplicates" ? (
              /* DUBLETTENERKENNUNG UND ZUSAMMENFÜHRUNG (SUPER-ADMIN ONLY) */
              <div className="space-y-6 font-sans">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Header & Filters */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <i className="fa-solid fa-users-viewfinder text-[#1b4332]"></i>
                        Dublettenerkennung & Personenidentität
                      </h2>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                        Systemweite Analyse zur Identifikation mehrfach angelegter Personen. Vereine verwalten nur Mitgliedschaften. Als Super-Admin kannst du identische Personen manuell zusammenführen.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Relevanz:
                        </label>
                        <select
                          value={duplicateFilterLevel}
                          onChange={(e) => setDuplicateFilterLevel(e.target.value)}
                          className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1b4332]"
                        >
                          <option value="all">Alle Relevanzstufen ({allSystemDuplicates.length})</option>
                          <option value="very_high">Sehr hohe Übereinstimmung (≥85%)</option>
                          <option value="high">Hohe Übereinstimmung (65-84%)</option>
                          <option value="medium">Mittlere Übereinstimmung (40-64%)</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Typ:
                        </label>
                        <select
                          value={duplicateTenantFilter}
                          onChange={(e) => setDuplicateTenantFilter(e.target.value as "all" | "intra" | "cross")}
                          className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1b4332]"
                        >
                          <option value="all">Alle Typen</option>
                          <option value="intra">Intra-Tenant (Selber Verein)</option>
                          <option value="cross">Cross-Tenant (Unterschiedl. Vereine)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Batch Selection & Pagination Info Bar */}
                  {filteredDuplicates.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                        <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg border border-slate-200">
                          <i className="fa-solid fa-list-ol mr-1.5 text-slate-500"></i>
                          Gefiltert: <strong>{filteredDuplicates.length}</strong> von <strong>{allSystemDuplicates.length}</strong> Paarungen
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-200">
                          <i className="fa-solid fa-eye mr-1.5 text-[#1b4332]"></i>
                          Anzeige: <strong>{(currentPage - 1) * 30 + 1} - {Math.min(currentPage * 30, filteredDuplicates.length)}</strong> (Seite {currentPage} von {totalPages})
                        </span>
                        {selectedPairIds.length > 0 && (
                          <span className="bg-purple-50 text-purple-800 px-3 py-1 rounded-lg border border-purple-200 font-black">
                            <i className="fa-solid fa-check-square mr-1.5 text-purple-600"></i>
                            {selectedPairIds.length} ausgewählt
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={toggleSelectAllPage}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isAllPageSelected ? "Seite abwählen" : "Diese Seite auswählen (30)"}
                        </button>
                        <button
                          onClick={toggleSelectAllFiltered}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isAllFilteredSelected ? "Alle abwählen" : `Alle gefilterten auswählen (${filteredDuplicates.length})`}
                        </button>

                        {selectedPairIds.length > 0 && (
                          <button
                            onClick={handleBatchMergeClick}
                            disabled={batchLoading}
                            className="bg-[#1b4332] hover:bg-[#153326] disabled:opacity-50 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer border border-[#1b4332]"
                          >
                            {batchLoading ? (
                              <i className="fa-solid fa-circle-notch fa-spin"></i>
                            ) : (
                              <i className="fa-solid fa-layer-group"></i>
                            )}
                            Auswahl zusammenführen ({selectedPairIds.length})
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Batch Progress Bar Indicator */}
                  {batchProgress && (
                    <div className="bg-emerald-950 text-white p-5 rounded-2xl shadow-xl space-y-3 border-2 border-emerald-700">
                      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                        <span className="flex items-center gap-2 text-emerald-300">
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          Stapelverarbeitung läuft...
                        </span>
                        <span className="font-mono text-emerald-300 text-sm">
                          {batchProgress.current} / {batchProgress.total} ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-emerald-900 rounded-full h-3 overflow-hidden border border-emerald-700">
                        <div
                          className="bg-emerald-400 h-3 rounded-full transition-all duration-300 shadow-md"
                          style={{ width: `${Math.max(5, (batchProgress.current / batchProgress.total) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-emerald-100 font-medium leading-relaxed">{batchProgress.message}</p>
                    </div>
                  )}

                  {filteredDuplicates.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-xl">
                        <i className="fa-solid fa-user-check"></i>
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">Keine potentiellen Dubletten gefunden</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Alle aktuell registrierten Personen weisen eindeutige Stammdaten auf.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paginatedDuplicates.map((pair) => {
                        const isSelected = selectedPairIds.includes(pair.id);
                        const levelColor =
                          pair.score >= 85
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : pair.score >= 65
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-blue-100 text-blue-800 border-blue-200";

                        const isIntraTenant = pair.membershipsA.some(ma => pair.membershipsB.some(mb => ma.vereinId === mb.vereinId)) || (pair.personA.vereinsId && pair.personB.vereinsId && pair.personA.vereinsId === pair.personB.vereinsId);

                        return (
                          <div
                            key={pair.id}
                            className={`bg-white border-2 rounded-2xl p-5 shadow-sm space-y-4 transition-all ${
                              isSelected ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/10" : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                {/* Checkbox for pair */}
                                <label
                                  onClick={(e) => e.stopPropagation()}
                                  className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-[#1b4332] text-white border-[#1b4332]"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectPair(pair.id)}
                                    className="w-4 h-4 accent-[#1b4332] rounded cursor-pointer"
                                  />
                                  <span>{isSelected ? "Ausgewählt" : "Auswählen"}</span>
                                </label>

                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${levelColor}`}>
                                  {pair.level} ({pair.score}%)
                                </span>
                                {isIntraTenant ? (
                                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase border bg-purple-100 text-purple-800 border-purple-200" title="Beide Profile sind mindestens in einem identischen Verein registriert.">
                                    <i className="fa-solid fa-house-user mr-1"></i> Intra-Tenant
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase border bg-slate-100 text-slate-800 border-slate-200" title="Profile stammen aus vollkommen unterschiedlichen Vereinen.">
                                    <i className="fa-solid fa-globe mr-1"></i> Cross-Tenant
                                  </span>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                                  <span>Übereinstimmende Kriterien:</span>
                                  {pair.matchedFields.map((f, idx) => (
                                    <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleIgnorePair(pair)}
                                  disabled={ignoreLoadingId === pair.id || batchLoading}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 border border-slate-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                  {ignoreLoadingId === pair.id ? (
                                    <i className="fa-solid fa-spinner fa-spin"></i>
                                  ) : (
                                    <i className="fa-solid fa-eye-slash"></i>
                                  )}
                                  Kein Duplikat
                                </button>
                                <button
                                  disabled={mergeLoadingId === pair.id || batchLoading}
                                  onClick={() => handlePreCheckMerge(pair, pairMergeTargets[pair.id] || pair.personA.id)}
                                  className="bg-[#1b4332] hover:bg-[#153326] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 border border-[#1b4332] flex items-center gap-2 cursor-pointer"
                                >
                                  {mergeLoadingId === pair.id ? (
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                  ) : (
                                    <i className="fa-solid fa-code-merge"></i>
                                  )}
                                  Personen zusammenführen
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Person A */}
                              <div 
                                className={`rounded-xl p-4 border-2 transition-all cursor-pointer ${
                                  (pairMergeTargets[pair.id] || pair.personA.id) === pair.personA.id
                                    ? "bg-emerald-50/50 border-[#1b4332] shadow-sm"
                                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                                }`}
                                onClick={() => setPairMergeTargets(prev => ({ ...prev, [pair.id]: pair.personA.id }))}
                              >
                                <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200/60 pb-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="radio" 
                                      className="w-4 h-4 accent-[#1b4332]"
                                      checked={(pairMergeTargets[pair.id] || pair.personA.id) === pair.personA.id}
                                      onChange={() => setPairMergeTargets(prev => ({ ...prev, [pair.id]: pair.personA.id }))}
                                    />
                                    <span className="text-slate-900 font-black text-sm">
                                      {pair.personA.firstName} {pair.personA.lastName}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                    ID: {pair.personA.id}
                                  </span>
                                </div>
                                <div className="space-y-1 text-slate-600">
                                  <p><strong>E-Mail:</strong> {pair.personA.is_placeholder_email || (pair.personA.email && pair.personA.email.startsWith("no-email.") && pair.personA.email.endsWith("@internal.app")) ? "[Keine E-Mail hinterlegt]" : (pair.personA.email || "[Keine E-Mail hinterlegt]")}</p>
                                  <p><strong>Telefon:</strong> {pair.personA.phone || "(Keine)"}</p>
                                  <p><strong>Geschlecht:</strong> {pair.personA.gender === "w" ? "Damen" : "Herren"}</p>
                                  <p>
                                    <strong>Mitglied in Vereinen:</strong>{" "}
                                    {pair.membershipsA.length > 0
                                      ? pair.membershipsA.map((m) => m.vereinId).join(", ")
                                      : pair.personA.vereinsId || "-"}
                                  </p>
                                </div>
                              </div>

                              {/* Person B */}
                              <div 
                                className={`rounded-xl p-4 border-2 transition-all cursor-pointer ${
                                  (pairMergeTargets[pair.id] || pair.personA.id) === pair.personB.id
                                    ? "bg-emerald-50/50 border-[#1b4332] shadow-sm"
                                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                                }`}
                                onClick={() => setPairMergeTargets(prev => ({ ...prev, [pair.id]: pair.personB.id }))}
                              >
                                <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200/60 pb-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="radio" 
                                      className="w-4 h-4 accent-[#1b4332]"
                                      checked={(pairMergeTargets[pair.id] || pair.personA.id) === pair.personB.id}
                                      onChange={() => setPairMergeTargets(prev => ({ ...prev, [pair.id]: pair.personB.id }))}
                                    />
                                    <span className="text-slate-900 font-black text-sm">
                                      {pair.personB.firstName} {pair.personB.lastName}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                    ID: {pair.personB.id}
                                  </span>
                                </div>
                                <div className="space-y-1 text-slate-600">
                                  <p><strong>E-Mail:</strong> {pair.personB.is_placeholder_email || (pair.personB.email && pair.personB.email.startsWith("no-email.") && pair.personB.email.endsWith("@internal.app")) ? "[Keine E-Mail hinterlegt]" : (pair.personB.email || "[Keine E-Mail hinterlegt]")}</p>
                                  <p><strong>Telefon:</strong> {pair.personB.phone || "(Keine)"}</p>
                                  <p><strong>Geschlecht:</strong> {pair.personB.gender === "w" ? "Damen" : "Herren"}</p>
                                  <p>
                                    <strong>Mitglied in Vereinen:</strong>{" "}
                                    {pair.membershipsB.length > 0
                                      ? pair.membershipsB.map((m) => m.vereinId).join(", ")
                                      : pair.personB.vereinsId || "-"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-4 mt-6">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer shadow-sm flex items-center justify-center gap-2"
                          >
                            <i className="fa-solid fa-chevron-left"></i> Vorherige 30
                          </button>
                          <span className="text-xs font-bold text-slate-600">
                            Seite {currentPage} von {totalPages} ({filteredDuplicates.length} Paarungen)
                          </span>
                          <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer shadow-sm flex items-center justify-center gap-2"
                          >
                            Nächste 30 <i className="fa-solid fa-chevron-right"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            
            ) : activeTab === "hobbyliga" ? (
              /* HOBBYLIGA-EINSTELLUNGEN (SUPER-ADMIN EFFECTIVE DATE HISTORISIERUNG & DYNAMISCHE LIGEN) */
              <div className="space-y-6 font-sans">
                {/* 1. LIGEN & KATEGORIEN VERWALTEN (CRUD SEKTION) */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-lg shrink-0">
                        <i className="fa-solid fa-layer-group"></i>
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                          Ligen & Kategorien verwalten
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {dynamicLeagues.length} {dynamicLeagues.length === 1 ? "Liga" : "Ligen"}
                          </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                          Erstelle und verwalte die Wettbewerbs-Kategorien der vereinsübergreifenden Hobbyliga (z.B. Herren, Damen). Ligen können nur inaktiviert werden, um historische Matches nicht zu beschädigen.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenNewLeagueModal}
                      className="px-4 py-2.5 bg-[#1b4332] hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i>
                      Neue Liga anlegen
                    </button>
                  </div>

                  {/* League Notification Banner */}
                  {leagueNotification && (
                    <div
                      className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                        leagueNotification.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          leagueNotification.type === "success"
                            ? "fa-circle-check text-emerald-600"
                            : "fa-triangle-exclamation text-rose-600"
                        }`}
                      ></i>
                      <span>{leagueNotification.text}</span>
                    </div>
                  )}

                  {/* Ligen-Tisch / Cards */}
                  {dynamicLeaguesLoading ? (
                    <div className="py-8 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                      <i className="fa-solid fa-circle-notch fa-spin text-lg text-[#1b4332]"></i>
                      <span className="text-xs">Lade Ligen...</span>
                    </div>
                  ) : dynamicLeagues.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs font-medium">
                      Keine Ligen vorhanden. Klicke auf "+ Neue Liga anlegen".
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                            <th className="px-5 py-3.5 font-black">Ligen-Name</th>
                            <th className="px-5 py-3.5 font-black">Beschreibung</th>
                            <th className="px-5 py-3.5 font-black text-center">Status</th>
                            <th className="px-5 py-3.5 font-black text-right">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                          {dynamicLeagues.map((league) => (
                            <tr key={league.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-5 py-4 font-bold">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xs">
                                    <i className="fa-solid fa-trophy"></i>
                                  </div>
                                  <div>
                                    <span className="text-slate-900 font-black text-sm block">
                                      {league.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ID: {league.id}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-slate-600 text-xs max-w-xs truncate">
                                {league.description || (
                                  <span className="text-slate-400 italic text-[11px]">Keine Beschreibung</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleLeagueActive(league)}
                                  title={league.active ? "Klicken zum Deaktivieren" : "Klicken zum Aktivieren"}
                                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border ${
                                    league.active
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      league.active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                    }`}
                                  ></span>
                                  <span>{league.active ? "Aktiv" : "Inaktiv"}</span>
                                </button>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setManagingRulesLeague({ id: league.id, name: league.name })}
                                    className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition-all border border-amber-200 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                  >
                                    <i className="fa-solid fa-sliders text-amber-700"></i>
                                    Parameter bearbeiten
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditLeagueModal(league)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-[#1b4332] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                    Bearbeiten
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 2. STICHTAG-REGELWERK VERWALTUNG */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-calendar-check text-amber-500 text-lg"></i>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                          Stichtag-Regelwerk & Historisierung
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 max-w-3xl">
                        Verwalte zeitgesteuerte Regelwerke für die Punkteberechnung der Hobbyliga. Jedes Regelwerk gilt ab 00:00:00 Uhr des jeweiligen Stichtags (Effective Date) für die ausgewählte Liga. Änderungen oder Löschungen lösen eine automatische, chronologische Neuberechnung aller betroffenen Matches in Echtzeit aus.
                      </p>
                    </div>
                  </div>

                  {/* Notification Banner */}
                  {configNotification && (
                    <div
                      className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 mb-4 ${
                        configNotification.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          configNotification.type === "success"
                            ? "fa-circle-check text-emerald-600"
                            : "fa-triangle-exclamation text-rose-600"
                        }`}
                      ></i>
                      <span>{configNotification.text}</span>
                    </div>
                  )}

                  {/* Recalculating Overlay Spinner if recalculatingConfig is true */}
                  {recalculatingConfig && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs font-bold flex items-center gap-3 mb-4 animate-pulse">
                      <i className="fa-solid fa-circle-notch fa-spin text-amber-600 text-base"></i>
                      <div>
                        <p className="font-extrabold uppercase">Automatische Neuberechnung läuft...</p>
                        <p className="font-normal text-[11px] text-amber-800">
                          Alle Hobbyliga-Matches und Spielerpunkte werden chronologisch anhand der Stichtags-Regelwerke neu verarbeitet.
                        </p>
                      </div>
                    </div>
                  )}

                    {/* Replaced by the per-league editor above. Keeping this legacy
                        form hidden prevents selecting the same league twice. */}
                    <div className="hidden" aria-hidden="true">
                    {(() => {
                      const isEditingBaseRule = Boolean(
                        editingConfigId &&
                        configVersions.find(
                          (v) =>
                            v.id === editingConfigId &&
                            (v.effective_date === "2000-01-01" || v.is_base_rule === true || v.id === "base_rule_20000101")
                        )
                      );

                      return (
                        <div ref={inlineFormRef} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6 mb-8">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-[#1b4332]/10 flex items-center justify-center text-[#1b4332]">
                                <i className="fa-solid fa-sliders text-base"></i>
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                  {isEditingBaseRule
                                    ? "Basis-Regelwerk bearbeiten (System Default)"
                                    : editingConfigId
                                    ? "Stichtag-Regelwerk bearbeiten"
                                    : "Neues Stichtag-Regelwerk anlegen"}
                                  {isEditingBaseRule && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                                      Fixiert (01.01.2000)
                                    </span>
                                  )}
                                </h3>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {isEditingBaseRule
                                    ? "Passe die universellen Standard-Parameter des Basis-Regelwerks an. Der Stichtag bleibt unveränderlich auf 01.01.2000 fixiert."
                                    : "Definiere Parameter und simuliere deren mathematische Auswirkungen direkt in Echtzeit."}
                                </p>
                              </div>
                            </div>

                            {editingConfigId && (
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                                  isEditingBaseRule
                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}>
                                  <i className="fa-solid fa-pen-to-square"></i> Bearbeitungsmodus
                                </span>
                                <button
                                  type="button"
                                  onClick={handleOpenNewConfigModal}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                                >
                                  Als neues Regelwerk anlegen
                                </button>
                              </div>
                            )}
                          </div>

                          <form onSubmit={handleFormSubmitConfig} className="space-y-6">
                            {/* Eingabefelder Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 flex items-center gap-1.5 mb-1.5">
                                  <i className="fa-solid fa-trophy text-slate-400"></i>
                                  Liga auswählen <span className="text-rose-500">*</span>
                                </label>
                                <select
                                  required
                                  disabled={isEditingBaseRule}
                                  value={configFormData.leagueId}
                                  onChange={(e) => setConfigFormData({ ...configFormData, leagueId: e.target.value })}
                                  className={`w-full border rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                                    isEditingBaseRule
                                      ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                      : "bg-slate-50 border-slate-300 text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white"
                                  }`}
                                >
                                  <option value="">-- Bitte Liga wählen --</option>
                                  {availableLeagues.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name} {l.active ? "" : "(Inaktiv)"}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Dieses Regelwerk gilt exklusiv für Matches dieser Liga.
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="block text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar-day text-slate-400"></i>
                                    Stichtag (Effective Date)
                                  </label>
                                  {isEditingBaseRule && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <i className="fa-solid fa-lock text-[9px]"></i> Read-Only
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="date"
                                  required
                                  disabled={isEditingBaseRule}
                                  value={configFormData.effective_date}
                                  onChange={(e) => {
                                    if (!isEditingBaseRule) {
                                      setConfigFormData({ ...configFormData, effective_date: e.target.value });
                                    }
                                  }}
                                  className={`w-full border rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                                    isEditingBaseRule
                                      ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                      : "bg-slate-50 border-slate-300 text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white"
                                  }`}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {isEditingBaseRule
                                    ? "Fixiert auf 01.01.2000 als garantierter Basis-Rückfallwert."
                                    : "Gilt ab 00:00:00 Uhr dieses Tages."}
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center gap-1.5">
                                  <i className="fa-solid fa-circle-plus text-emerald-600"></i>
                                  Base Points Gewinn
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={0}
                                  value={configFormData.base_points_win}
                                  onChange={(e) => setConfigFormData({ ...configFormData, base_points_win: Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Fixer Teilnahmegewinn pro gespieltem Sieg.
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center gap-1.5">
                                  <i className="fa-solid fa-circle-minus text-rose-500"></i>
                                  Base Points Niederlage
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={0}
                                  value={configFormData.base_points_loss}
                                  onChange={(e) => setConfigFormData({ ...configFormData, base_points_loss: Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Fixer Wert/Trostpunkt bei Niederlagen.
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center gap-1.5">
                                  <i className="fa-solid fa-award text-amber-500"></i>
                                  Max. Bonus
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={0}
                                  value={configFormData.max_bonus}
                                  onChange={(e) => setConfigFormData({ ...configFormData, max_bonus: Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Maximaler logistischer Bonus für Siege.
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center gap-1.5">
                                  <i className="fa-solid fa-wave-square text-indigo-500"></i>
                                  Skalierung (K)
                                </label>
                                <input
                                  type="number"
                                  step="0.001"
                                  required
                                  min={0.001}
                                  value={configFormData.logistic_factor}
                                  onChange={(e) => setConfigFormData({ ...configFormData, logistic_factor: Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Steilheit der S-Kurve (Empfehlung: 0.03 - 0.08).
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center gap-1.5">
                                  <i className="fa-solid fa-hourglass-half text-rose-600"></i>
                                  Inaktivität / W.
                                </label>
                                <input
                                  type="number"
                                  required
                                  min={0}
                                  value={configFormData.inactivity_deduction_per_week}
                                  onChange={(e) => setConfigFormData({ ...configFormData, inactivity_deduction_per_week: Number(e.target.value) })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Punkteabzug pro inaktiver Woche.
                                </p>
                              </div>
                            </div>

                            {/* LIVE-BEISPIELRECHNER & MATHEMATISCHE AUFSCHLÜSSELUNG (SIMULATIONS-SANDBOX / COLLAPSIBLE ACCORDION) */}
                            <div className="bg-[#081c15] rounded-2xl p-4 sm:p-5 text-slate-100 border border-[#1b4332] shadow-lg shadow-black/25 transition-all">
                              {/* Header Bar with Toggle */}
                              <div
                                onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none ${
                                  isSimulatorExpanded ? "pb-4 border-b border-[#1b4332]" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-[#1b4332] flex items-center justify-center text-[#52b788] border border-[#2d6a4f]/60 shrink-0">
                                    <i className="fa-solid fa-calculator text-sm"></i>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-[#52b788] animate-pulse shrink-0"></span>
                                      <h4 className="text-xs font-black uppercase tracking-wider text-[#52b788]">
                                        Live-Vorschau & Tuning-Simulator
                                      </h4>
                                    </div>
                                    <p className="text-[11px] text-[#95d5b2] font-medium mt-0.5 hidden sm:block">
                                      Mathematische Modellierung & Live-Berechnung bei Parameteränderungen
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#74c69d] bg-[#0b291e] px-2.5 py-1 rounded-lg border border-[#1b4332] hidden md:inline-block">
                                    Echtzeit-Berechnung
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsSimulatorExpanded(!isSimulatorExpanded);
                                    }}
                                    className="px-3.5 py-1.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-[#d8f3dc] hover:text-white border border-[#2d6a4f] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                  >
                                    <span>{isSimulatorExpanded ? "Simulator ausblenden" : "Simulator anzeigen"}</span>
                                    <i
                                      className={`fa-solid ${
                                        isSimulatorExpanded ? "fa-chevron-up" : "fa-chevron-down"
                                      } text-[10px] text-[#52b788] transition-transform duration-200`}
                                    ></i>
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Content */}
                              {isSimulatorExpanded && (
                                <div className="space-y-4 pt-4 animate-in fade-in zoom-in-95 duration-200">
                                  {/* Formelschema Erklärung */}
                                  <div className="bg-[#0b291e]/90 border border-[#1b4332] rounded-xl p-3.5 text-xs text-slate-200 font-mono space-y-2">
                                    <div className="text-[10px] font-sans font-bold text-[#74c69d] uppercase tracking-wider">
                                      Mathematische Formel-Schritte:
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-slate-100 font-bold text-[11px]">
                                      <div className="bg-[#081c15] p-2.5 rounded-lg border border-[#1b4332]">
                                        <span className="text-[#95d5b2] text-[10px] font-sans block font-semibold mb-0.5">
                                          1. Rating-Differenz:
                                        </span>
                                        <span className="text-white">d = Rating_Gegner - Rating_Spieler</span>
                                      </div>
                                      <div className="bg-[#081c15] p-2.5 rounded-lg border border-[#1b4332]">
                                        <span className="text-[#95d5b2] text-[10px] font-sans block font-semibold mb-0.5">
                                          2. Logistischer Bonus:
                                        </span>
                                        <span className="text-white">Bonus = Max_Bonus / (1 + e^(-K * d))</span>
                                      </div>
                                      <div className="bg-[#081c15] p-2.5 rounded-lg border border-[#1b4332]">
                                        <span className="text-[#95d5b2] text-[10px] font-sans block font-semibold mb-0.5">
                                          3. Endergebnis:
                                        </span>
                                        <span className="text-[#52b788] font-black">Punkte = Base_Gewinn + Bonus</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 3 Match Szenarien */}
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                                    {[
                                      {
                                        title: "Ausgeglichenes Match",
                                        subtitle: "100 vs. 100 Pkt.",
                                        playerPts: 100,
                                        oppPts: 100,
                                        badgeStyle: "bg-[#081c15] text-[#52b788] border-[#2d6a4f]/70",
                                      },
                                      {
                                        title: "Underdog-Sieg",
                                        subtitle: "80 vs. 120 Pkt.",
                                        playerPts: 80,
                                        oppPts: 120,
                                        badgeStyle: "bg-[#081c15] text-[#52b788] border-[#40916c] font-black",
                                      },
                                      {
                                        title: "Favoritensieg",
                                        subtitle: "120 vs. 80 Pkt.",
                                        playerPts: 120,
                                        oppPts: 80,
                                        badgeStyle: "bg-[#081c15] text-[#95d5b2] border-[#2d6a4f]/60",
                                      },
                                    ].map((sc, idx) => {
                                      const baseWin = Number(configFormData.base_points_win) || 0;
                                      const maxBonus = Number(configFormData.max_bonus) || 0;
                                      const k = Number(configFormData.logistic_factor) || 0.001;

                                      const d = sc.oppPts - sc.playerPts;
                                      const expVal = Math.exp(-k * d);
                                      const bonus = maxBonus / (1 + expVal);
                                      const total = baseWin + bonus;

                                      return (
                                        <div
                                          key={idx}
                                          className="bg-[#0b291e] border border-[#1b4332] rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
                                        >
                                          <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2 border-b border-[#1b4332] pb-2">
                                              <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                                                <i className="fa-solid fa-gamepad text-[#52b788]"></i>
                                                {sc.title}
                                              </span>
                                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sc.badgeStyle}`}>
                                                {sc.subtitle}
                                              </span>
                                            </div>

                                            <div className="space-y-2 text-xs">
                                              <div className="bg-[#081c15] border border-[#1b4332]/70 p-2.5 rounded-lg space-y-1.5 font-mono text-[11px]">
                                                <div>
                                                  <span className="text-[#95d5b2] text-[10px] font-sans block font-semibold">
                                                    1. Rating-Differenz:
                                                  </span>
                                                  <span className="text-white font-bold">
                                                    d = {sc.oppPts} - {sc.playerPts} = <span className="text-[#52b788] font-extrabold">{d >= 0 ? `+${d}` : d}</span>
                                                  </span>
                                                </div>

                                                <div className="pt-1.5 border-t border-[#1b4332]">
                                                  <span className="text-[#95d5b2] text-[10px] font-sans block font-semibold">
                                                    2. Sigmoid-Bonus (Formel & Einsetzung):
                                                  </span>
                                                  <span className="text-white font-bold break-all text-[11px] block mt-0.5">
                                                    {maxBonus} / (1 + e^(-{k} * {d})) = <span className="text-[#52b788] font-black">+{bonus.toFixed(1)} Pkt.</span>
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="p-2.5 bg-[#081c15] border border-[#2d6a4f]/60 rounded-lg text-[#d8f3dc] font-medium text-[11px] leading-relaxed">
                                                <span className="font-black text-[#52b788] block mb-0.5 text-[10px] uppercase tracking-wider">
                                                  3. Gesamtergebnis:
                                                </span>
                                                Teilnahme: <span className="font-mono text-[#74c69d] font-bold">+{baseWin.toFixed(1)}</span> | Logistischer Gegner-Bonus: <span className="font-mono text-[#52b788] font-bold">+{bonus.toFixed(1)}</span> | Gesamt: <span className="font-mono text-white font-black text-xs">+{total.toFixed(1)} Pkt.</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Aktions-Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                              <button
                                type="submit"
                                className="flex-1 py-3 bg-[#1b4332] hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <i className="fa-solid fa-floppy-disk text-sm"></i>
                                {isEditingBaseRule ? "Basis-Regelwerk speichern & Neuberechnung starten" : "Änderungen speichern & Neuberechnung starten"}
                              </button>

                              <button
                                type="button"
                                onClick={handleOpenNewConfigModal}
                                className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer flex items-center justify-center gap-2"
                              >
                                <i className="fa-solid fa-arrow-rotate-left text-sm"></i>
                                Abbrechen / Zurücksetzen
                              </button>
                            </div>
                          </form>
                        </div>
                      );
                    })()}
                    </div>

                  {/* Filter bar by League */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pt-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mr-1">
                        <i className="fa-solid fa-filter text-slate-400"></i>
                        Filter nach Liga:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedLeagueFilter("all")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selectedLeagueFilter === "all"
                            ? "bg-[#1b4332] text-white border-[#1b4332] shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        Alle Ligen ({configVersions.length})
                      </button>
                      {availableLeagues.map((l) => {
                        const count = configVersions.filter((v) => v.leagueId === l.id).length;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setSelectedLeagueFilter(l.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              selectedLeagueFilter === l.id
                                ? "bg-[#1b4332] text-white border-[#1b4332] shadow-xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {l.name} {count > 0 ? `(${count})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Config Versions Table */}
                  {configVersionsLoading ? (
                    <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                      <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#1b4332]"></i>
                      <span>Lade Konfigurationen...</span>
                    </div>
                  ) : configVersions.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
                      <p className="text-xs text-slate-500 font-bold">
                        Keine Versionen vorhanden.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                            <th className="px-5 py-3.5 font-black">Stichtag (Effective Date)</th>
                            <th className="px-5 py-3.5 font-black">Liga / Kategorie</th>
                            <th className="px-5 py-3.5 font-black text-center">Sieg / Niederlage Base</th>
                            <th className="px-5 py-3.5 font-black text-center">Max. Bonus</th>
                            <th className="px-5 py-3.5 font-black text-center">Skalierung (k)</th>
                            <th className="px-5 py-3.5 font-black text-center">Inaktivität / Woche</th>
                            <th className="px-5 py-3.5 font-black">Erstellt am / von</th>
                            <th className="px-5 py-3.5 font-black text-right">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                          {configVersions
                            .filter((ver) => {
                              if (selectedLeagueFilter === "all") return true;
                              return ver.leagueId === selectedLeagueFilter;
                            })
                            .map((ver, idx) => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            const isBaseRule = ver.effective_date === "2000-01-01" && Boolean(ver.leagueId);
                            const isCurrent = !isBaseRule && ver.effective_date <= todayStr && (
                              idx === configVersions.length - 1 || configVersions[idx + 1].effective_date > todayStr
                            );
                            const isFuture = !isBaseRule && ver.effective_date > todayStr;

                            return (
                              <tr key={ver.id} className={`hover:bg-slate-50/80 transition-colors ${isBaseRule ? 'bg-indigo-50/20' : ''}`}>
                                <td className="px-5 py-4 font-bold">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-slate-900 text-sm font-black">
                                      {ver.effective_date}
                                    </span>
                                    {isBaseRule && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                                        <i className="fa-solid fa-shield-halved text-indigo-600"></i>
                                        System Default / Basis-Regelwerk
                                      </span>
                                    )}
                                    {isCurrent && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Aktuell Gültig
                                      </span>
                                    )}
                                    {isFuture && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                        Geplant
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  {(() => {
                                    const leagueObj = availableLeagues.find((l) => l.id === ver.leagueId);
                                    return leagueObj ? (
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${
                                        isBaseRule
                                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      }`}>
                                        <i className={`fa-solid fa-trophy text-[9px] ${isBaseRule ? "text-indigo-600" : "text-emerald-600"}`}></i>
                                        {leagueObj.name}
                                      </span>
                                    ) : ver.leagueId ? (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                        {ver.leagueId}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                        Alle Ligen
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-5 py-4 text-center font-mono font-bold text-slate-800">
                                  <span className="text-emerald-700">+{ver.base_points_win ?? 5}</span>
                                  <span className="text-slate-400 mx-1">/</span>
                                  <span className="text-emerald-700">+{ver.base_points_loss ?? 5} Pkt.</span>
                                </td>
                                <td className="px-5 py-4 text-center font-mono font-bold text-amber-700">
                                  +{ver.max_bonus} Pkt.
                                </td>
                                <td className="px-5 py-4 text-center font-mono font-bold text-indigo-700">
                                  {ver.logistic_factor}
                                </td>
                                <td className="px-5 py-4 text-center font-mono font-bold text-rose-700">
                                  -{ver.inactivity_deduction_per_week} Pkt.
                                </td>
                                <td className="px-5 py-4 text-slate-500 font-medium text-[11px]">
                                  {isBaseRule ? (
                                    <>
                                      <span className="font-semibold text-slate-600">01.01.2000</span>
                                      <br />
                                      <span className="text-indigo-600 font-bold">System Default</span>
                                    </>
                                  ) : (
                                    <>
                                      {ver.created_at ? new Date(ver.created_at).toLocaleDateString('de-DE') : '-'}
                                      <br />
                                      <span className="text-slate-400">von {ver.created_by || 'Super-Admin'}</span>
                                    </>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenEditConfigModal(ver)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                                    >
                                      Bearbeiten
                                    </button>
                                    {isBaseRule ? (
                                      <span
                                        title="Das Basis-Regelwerk (01.01.2000) ist unveränderlich und kann nicht gelöscht werden."
                                        className="px-2.5 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-bold border border-slate-200 select-none flex items-center gap-1"
                                      >
                                        <i className="fa-solid fa-lock text-[10px]"></i>
                                        Fixiert
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setDeleteTargetConfigId(ver.id);
                                          setShowConfigConfirmModal("delete");
                                        }}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                                      >
                                        Löschen
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "accounts" ? (
              <SuperAdminUserPurgeTab
                allPersons={allPersons}
                clubs={clubs}
                allMemberships={allMemberships}
                allLeagueMatches={allLeagueMatches}
                globalBackups={globalBackups}
                onLoginAs={onLoginAs}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {showNewClubModal && (
        <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-sm p-8 border border-slate-200/80">
            <h2 className="text-xl font-bold text-[#1b4332] uppercase tracking-tighter flex items-center justify-between mb-6">
              Neuen Verein anlegen
              <button
                onClick={() => {
                  setShowNewClubModal(false);
                  setCreateClubError(null);
                  setShowOverwriteConflict(null);
                }}
                className="text-slate-400 hover:text-rose-600 transition-colors text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </h2>

            {showOverwriteConflict ? (
              <div className="space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 space-y-3">
                  <p className="font-extrabold flex items-center gap-2 text-base text-amber-900">
                    <i className="fa-solid fa-circle-exclamation text-lg"></i>
                    Vereins-ID im Papierkorb gefunden!
                  </p>
                  <p className="text-xs leading-relaxed font-semibold">
                    Der Verein{" "}
                    <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-950">
                      "{showOverwriteConflict.vereinsId}"
                    </span>{" "}
                    (
                    <span className="italic">
                      "
                      {showOverwriteConflict.clubName ||
                        showOverwriteConflict.vereinsName}
                      "
                    </span>
                    ) wurde im Papierkorb gefunden und ist noch nicht endgültig
                    gelöscht.
                  </p>
                  <p className="text-xs font-medium">
                    Mit welchen Optionen fortfahren?
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={isCreatingProgress}
                    onClick={() =>
                      handleResolveConflictRestore(
                        showOverwriteConflict.vereinsId,
                      )
                    }
                    className="w-full py-3 bg-[#1b4332] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingProgress
                      ? "Wiederherstellen..."
                      : "Wiederherstellen & Aktivieren"}
                  </button>

                  <button
                    type="button"
                    disabled={isCreatingProgress}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Möchtest du "${showOverwriteConflict.vereinsId}" und alle zugehörigen Daten wirklich unwiderruflich löschen, um den Verein komplett frisch neu anzulegen?`,
                        )
                      ) {
                        handleResolveConflictOverwrite(
                          showOverwriteConflict.vereinsId,
                        );
                      }
                    }}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingProgress
                      ? "Überschreiben..."
                      : "Komplett überschreiben & Neu anlegen"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOverwriteConflict(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-slate-200 cursor-pointer"
                  >
                    Abbrechen / Andere ID wählen
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateClub} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                    Mandanten-ID (slug)
                  </label>
                  <input 
                    autoFocus
                    required
                    pattern="[a-zA-Z0-9\-]+"
                    value={newClubForm.vereinsId}
                    onChange={(e) =>
                      setNewClubForm({
                        ...newClubForm,
                        vereinsId: e.target.value.toLowerCase(),
                      })
                    }
                    placeholder="z.b. tennis-club"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-[#1b4332] transition-colors py-2"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 ml-1 font-medium">
                    Nur Buchstaben, Zahlen und Bindestriche.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                    Vereinsname
                  </label>
                  <input 
                    required
                    value={newClubForm.vereinsName}
                    onChange={(e) =>
                      setNewClubForm({
                        ...newClubForm,
                        vereinsName: e.target.value,
                      })
                    }
                    placeholder="z.B. Tennis-Club"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-[#1b4332] transition-colors py-2"
                  />
                </div>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <input
                    type="checkbox"
                    id="enableLeague"
                    checked={newClubForm.enableLeague}
                    onChange={(e) =>
                      setNewClubForm({
                        ...newClubForm,
                        enableLeague: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-[#1b4332] shrink-0"
                  />
                  <div>
                    <label htmlFor="enableLeague" className="block text-sm font-bold text-slate-700 cursor-pointer">
                      Hobbyliga aktivieren
                    </label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Schaltet das Modul für die vereinsübergreifende Hobbyliga frei.
                    </p>
                  </div>
                </div>

                {createClubError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                    {createClubError}
                  </p>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClubModal(false);
                      setCreateClubError(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border border-slate-200"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingProgress}
                    className="flex-1 bg-[#1b4332] hover:bg-black text-white rounded-xl uppercase tracking-widest shadow-lg shadow-[#1b4332]/25 transition-all active:scale-95 border border-[#1b4332] disabled:opacity-50 items-center py-2.5 text-sm font-medium"
                  >
                    {isCreatingProgress ? "Wird erstellt..." : "Erstellen"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteModalClub &&
        (() => {
          const clubPlayers = (
            usersByClub[deleteModalClub.vereinsId] || []
          ).filter((u) => u.role !== Role.ADMIN && u.role !== Role.SUPER_ADMIN);
          const hasPlayers = clubPlayers.length > 0;
          const isBlocked = hasPlayers;

          return (
            <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-sm p-8 border border-slate-200/80">
                <h2 className="text-xl font-bold text-rose-600 uppercase tracking-tighter flex items-center justify-between mb-2">
                  Verein löschen
                  <button
                    onClick={() => setDeleteModalClub(null)}
                    className="text-slate-400 hover:text-slate-700 transition-colors text-base"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-6">
                  Mandant:{" "}
                  <span className="font-mono text-slate-600">
                    {deleteModalClub.vereinsId}
                  </span>
                </p>

                {isBlocked ? (
                  <div className="space-y-4">
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs font-semibold text-rose-700 space-y-2">
                      <p className="font-extrabold text-[13px] text-rose-800 flex items-center gap-1.5">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        Löschen blockiert
                      </p>
                      <p>
                        Dieser Verein kann zur Sicherheit nicht gelöscht werden,
                        da noch sensible Daten vorhanden sind:
                      </p>
                      <ul className="list-disc list-inside space-y-1 pl-1 mt-2">
                        {hasPlayers && (
                          <li>
                            <strong>{clubPlayers.length}</strong>{" "}
                            Spieler/Mitglied(er) vorhanden
                          </li>
                        )}
                      </ul>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Bitte melde dich in der Vereinsverwaltung von{" "}
                      <span className="font-bold">
                        "{deleteModalClub.clubName}"
                      </span>{" "}
                      an, und lösche dort zuerst alle Buchungen und
                      Spieler/Mitglieder.
                    </p>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => setDeleteModalClub(null)}
                        className="w-full py-3 bg-[#1b4332] hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border border-[#1b4332]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-[#1b4332] font-semibold flex items-start gap-2">
                      <i className="fa-solid fa-circle-check text-base mt-0.5"></i>
                      <div>
                        <p className="font-extrabold text-[13px]">
                          Bedingungen erfüllt
                        </p>
                        <p className="mt-1">
                          Keine aktiven Spieler gefunden. Der Verein kann sicher
                          gelöscht werden.
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Möchtest du den Verein{" "}
                      <strong className="text-slate-800">
                        "{deleteModalClub.clubName}"
                      </strong>{" "}
                      wirklich unwiderruflich löschen? Alle verbleibenden
                      Einstellungen und der Systemzugang für Administratoren
                      gehen verloren.
                    </p>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                        Bestätigung eintippen
                      </label>
                      <input 
                        type="text"
                        required
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="löschen"
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rose-500 transition-colors placeholder:text-slate-300 placeholder:font-normal font-mono py-2"
                      />
                      <p className="text-[10px] text-slate-400 mt-1.5 ml-1 font-medium">
                        Bitte tippe exakt{" "}
                        <strong className="text-rose-600 font-mono">
                          löschen
                        </strong>{" "}
                        ein, um fortzufahren.
                      </p>
                    </div>

                    {deleteError && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-3 py-2">
                        {deleteError}
                      </p>
                    )}

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setDeleteModalClub(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border border-slate-200"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={
                          deleteConfirmText.toLowerCase().trim() !== "löschen"
                        }
                        onClick={() =>
                          handleConfirmDelete(deleteModalClub.vereinsId)
                        }
                        className={`flex-1 py-3 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all border shadow-md active:scale-95 ${
                          deleteConfirmText.toLowerCase().trim() === "löschen"
                            ? "bg-rose-600 hover:bg-rose-700 border-rose-600 shadow-rose-600/20"
                            : "bg-slate-300 border-slate-300 cursor-not-allowed shadow-none"
                        }`}
                      >
                        Verein löschen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {editClubModalClub && (
        <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-sm p-8 border border-slate-200/80 overflow-y-auto max-h-[92vh]">
            <h2 className="text-xl font-bold text-[#1b4332] uppercase tracking-tighter flex items-center justify-between mb-6">
              Vereinsdaten bearbeiten
              <button
                onClick={() => setEditClubModalClub(null)}
                className="text-slate-400 hover:text-rose-600 transition-colors text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </h2>
            <form onSubmit={handleEditClub} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                  Mandanten-ID (Nicht direkt editierbar)
                </label>
                <input
                  disabled
                  value={editClubForm.vereinsId}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-4 text-slate-400 cursor-not-allowed p-2 text-sm font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1 font-medium">
                  Die ID ist Standard-ID zur Anmeldung dieses Vereins.
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                  Vereinsname
                </label>
                <input 
                  required
                  value={editClubForm.vereinsName}
                  onChange={(e) =>
                    setEditClubForm({
                      ...editClubForm,
                      vereinsName: e.target.value,
                    })
                  }
                  placeholder="z.B. Tennis-Club"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-[#1b4332] transition-colors py-2"
                />
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <input
                  type="checkbox"
                  id="editEnableLeague"
                  checked={editClubForm.enableLeague}
                  onChange={(e) =>
                    setEditClubForm({
                      ...editClubForm,
                      enableLeague: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-[#1b4332] shrink-0"
                />
                <div>
                  <label htmlFor="editEnableLeague" className="block text-sm font-bold text-slate-700 cursor-pointer">
                    Hobbyliga aktivieren
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Schaltet das Modul für die vereinsübergreifende Hobbyliga frei.
                  </p>
                </div>
              </div>

              {editClubError && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-3 py-2">
                  {editClubError}
                </p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditClubModalClub(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors border border-slate-200"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#117154] hover:bg-[#0c4a37] text-white rounded-xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border border-[#117154] items-center py-2.5 text-sm font-medium"
                >
                  Speichern
                </button>
              </div>

              {/* Advanced Section: Change ID / Migrate */}
              <div className="border-t border-slate-200 pt-5 mt-5 space-y-4">
                <h3 className="text-xs font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5 ml-1">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Erweiterte Funktion: Vereins-ID ändern
                </h3>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-[11px] text-amber-800 leading-relaxed font-semibold">
                  Dies migriert alle Mitglieder, Spieler-Dokumente, Buchungen,
                  Turniere und Einstellungen sicher auf eine neue ID und löscht
                  die alte ID anschließend.
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                    Neue Vereins-ID (bspw. djk-furth)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      pattern="[a-zA-Z0-9\-]+"
                      value={newClubIdInput}
                      onChange={(e) =>
                        setNewClubIdInput(
                          e.target.value.toLowerCase().replace(/\s/g, ""),
                        )
                      }
                      placeholder="z.B. djk-furth"
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors py-2"
                    />
                    <button
                      type="button"
                      disabled={migrationLoading}
                      onClick={() => {
                        if (
                          window.confirm(
                            `MÖCHTEST DU DIE VEREINS-ID WIRKLICH ANDERN?\n\nVon: "${editClubForm.vereinsId}"\nNach: "${newClubIdInput}"\n\nDies verschiebt dauerhaft alle zugehörigen Daten wie Buchungen, Turnierdaten, Platzbelegungen und Spieler.`,
                          )
                        ) {
                          handleMigrateId();
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-amber-600 cursor-pointer whitespace-nowrap"
                    >
                      {migrationLoading ? "Wandelt..." : "ID ändern"}
                    </button>
                  </div>
                </div>

                {migrationError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {migrationError}
                  </p>
                )}

                {migrationSuccess && (
                  <p className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-check"></i>
                    {migrationSuccess}
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {resetPasswordModalUser && (
        <div className="fixed inset-0 bg-[#1b4332]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-sm p-8 border border-slate-200/80">
            <h2 className="text-xl font-bold text-[#1b4332] uppercase tracking-tighter flex items-center justify-between mb-2">
              Passwort setzen
              <button
                onClick={() => {
                  setResetPasswordModalUser(null);
                  setResetPasswordNewPassword("");
                  setResetPasswordError(null);
                  setClubForReset(null);
                  setShowResetPasswordInput(false);
                }}
                className="text-slate-400 hover:text-rose-600 transition-colors text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Neues Passwort für Admin{" "}
              <strong className="text-slate-700">
                {resetPasswordModalUser.klarname || resetPasswordModalUser.name}
              </strong>{" "}
              festlegen.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 ml-1 tracking-wider">
                  Neues Passwort
                </label>
                <div className="relative">
                  <input 
                    type={showResetPasswordInput ? "text" : "password"}
                    required
                    minLength={4}
                    value={resetPasswordNewPassword}
                    onChange={(e) =>
                      setResetPasswordNewPassword(e.target.value)
                    }
                    placeholder="********"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-4 pr-12 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-colors py-2"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowResetPasswordInput(!showResetPasswordInput)
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1.5 cursor-pointer select-none transition-colors"
                    title={
                      showResetPasswordInput
                        ? "Passwort verbergen"
                        : "Passwort anzeigen"
                    }
                  >
                    <i
                      className={`fa-solid ${showResetPasswordInput ? "fa-eye-slash" : "fa-eye"} text-sm`}
                    ></i>
                  </button>
                </div>
              </div>

              {resetPasswordError && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-3 py-2">
                  {resetPasswordError}
                </p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordModalUser(null);
                    setResetPasswordNewPassword("");
                    setResetPasswordError(null);
                    setClubForReset(null);
                    setShowResetPasswordInput(false);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border border-slate-200"
                  disabled={resetPasswordLoading}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed items-center py-2.5 text-sm font-medium"
                >
                  {resetPasswordLoading ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    "Zurücksetzen"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Duplicate Pair Merge Confirmation Modal */}
      {mergeConfirmData && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 space-y-0">
            {/* Modal Header */}
            <div className="bg-[#1b4332] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 text-lg shrink-0">
                  <i className="fa-solid fa-code-merge"></i>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">
                    Personen-Zusammenführung
                  </h3>
                  <p className="text-xs text-emerald-200 font-medium">
                    Duplikate vereinen & Vereins-Mitgliedschaften bündeln
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMergeConfirmData(null)}
                className="text-emerald-200 hover:text-white transition-colors text-lg p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {(() => {
                const { pair, targetId, conflictCount } = mergeConfirmData;
                const targetPerson = pair.personA.id === targetId ? pair.personA : pair.personB;
                const sourcePerson = pair.personA.id === targetId ? pair.personB : pair.personA;
                const mergedClubRoles = getMergedClubsAndRolesForPair(pair);

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                          Ziel-Account (Wird behalten)
                        </span>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {targetPerson.firstName || targetPerson.lastName
                            ? `${targetPerson.firstName || ""} ${targetPerson.lastName || ""}`.trim()
                            : targetPerson.name}
                        </p>
                        <p className="text-slate-500 text-[11px] font-mono">ID: {targetPerson.id}</p>
                      </div>

                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                          Quelle (Wird zusammengeführt)
                        </span>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {sourcePerson.firstName || sourcePerson.lastName
                            ? `${sourcePerson.firstName || ""} ${sourcePerson.lastName || ""}`.trim()
                            : sourcePerson.name}
                        </p>
                        <p className="text-slate-500 text-[11px] font-mono">ID: {sourcePerson.id}</p>
                      </div>
                    </div>

                    {/* Requirement 4: Clear representation of bundled clubs and roles after merge */}
                    <div className="bg-blue-50/80 border-2 border-blue-200 rounded-xl p-4 text-xs space-y-2.5">
                      <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs uppercase tracking-wide">
                        <i className="fa-solid fa-building-columns text-blue-600 text-sm"></i>
                        Nach dem Merge verknüpft in:
                      </div>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {mergedClubRoles.map((item, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg shadow-2xs font-bold text-slate-800 text-xs">
                            <span className="font-extrabold text-blue-950">{item.clubName}:</span>
                            <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                              item.role === "Admin" 
                                ? "bg-amber-100 text-amber-800 border border-amber-300" 
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}>
                              {item.role}
                            </span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                        Alle vereinsspezifischen Spielerprofile, Match-Historien, Berechtigungen und Buchungen beider Accounts werden vollständig zusammengeführt.
                      </p>
                    </div>

                    {/* Conflict Warning if direct match conflict */}
                    {conflictCount > 0 && (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 text-base shrink-0 mt-0.5"></i>
                        <div className="space-y-1">
                          <p className="font-extrabold text-amber-900">
                            Achtung: {conflictCount} direkte Hobbyliga-Match-Konflikte
                          </p>
                          <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                            Diese beiden Personen haben in der Vergangenheit gegeneinander gespielt. Diese direkten Duelle werden storniert, damit das Konto nicht gegen sich selbst gewertet wird.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setMergeConfirmData(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer text-center"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={mergeLoadingId === pair.id}
                        onClick={async () => {
                          const p = mergeConfirmData.pair;
                          const tId = mergeConfirmData.targetId;
                          setMergeConfirmData(null);
                          await handleExecuteMerge(p, tId);
                        }}
                        className="flex-1 bg-[#1b4332] hover:bg-[#153326] disabled:opacity-50 text-white rounded-xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border border-[#1b4332] py-3 text-xs font-black flex items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        {mergeLoadingId === pair.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            Führe zusammen...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <i className="fa-solid fa-check text-sm"></i>
                            Zusammenführung bestätigen
                          </span>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Batch Duplicate Pairs Merge Confirmation Modal */}
      {batchConfirmData && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 space-y-0">
            <div className="bg-[#1b4332] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 text-lg shrink-0">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">
                    Stapel-Zusammenführung Bestätigen
                  </h3>
                  <p className="text-xs text-emerald-200 font-medium">
                    {batchConfirmData.pairs.length} Personenpaare verarbeiten
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchConfirmData(null)}
                className="text-emerald-200 hover:text-white transition-colors text-lg p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs uppercase tracking-wide">
                  <i className="fa-solid fa-building-columns text-blue-600 text-sm"></i>
                  Tenant & Mitgliedschaften
                </div>
                <p className="text-slate-800 font-bold leading-relaxed">
                  Für alle {batchConfirmData.pairs.length} ausgewählten Paarungen werden die Vereinsmitgliedschaften (Set-Union aller Tenants) und lokalen Daten (Match-Historie, Buchungen, Arbeitseinsätze) vollständig im jeweiligen Ziel-Account gebündelt.
                </p>
              </div>

              {batchConfirmData.totalConflicts > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-3">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600 text-base shrink-0 mt-0.5"></i>
                  <div className="space-y-1">
                    <p className="font-extrabold text-amber-900">
                      Insgesamt {batchConfirmData.totalConflicts} direkte Match-Konflikte
                    </p>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      Direkte Duelle zwischen zusammengeführten Konten werden storniert, um Selbstduelle zu verhindern.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchConfirmData(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer text-center"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const pairs = batchConfirmData.pairs;
                    setBatchConfirmData(null);
                    await executeBatchMerge(pairs);
                  }}
                  className="flex-1 bg-[#1b4332] hover:bg-[#153326] text-white rounded-xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border border-[#1b4332] py-3 text-xs font-black flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <i className="fa-solid fa-check text-sm"></i>
                  Alle {batchConfirmData.pairs.length} Paarungen zusammenführen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic League Create / Edit Modal */}
      {isLeagueModalOpen && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                  <i className="fa-solid fa-trophy"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {editingLeague ? "Liga bearbeiten" : "Neue Liga anlegen"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {editingLeague ? "Passe den Namen und die Beschreibung an." : "Erstelle eine neue Wettbewerbs-Kategorie."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeagueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleSaveLeague} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Ligen-Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Herren, Damen, Herren Einzel"
                  value={leagueFormData.name}
                  onChange={(e) => setLeagueFormData({ ...leagueFormData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Beschreibung <span className="text-slate-400 font-normal text-[11px]">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Optionale Details zur Kategorie..."
                  value={leagueFormData.description}
                  onChange={(e) => setLeagueFormData({ ...leagueFormData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1b4332] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Status
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={leagueFormData.active}
                    onChange={(e) => setLeagueFormData({ ...leagueFormData, active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {leagueFormData.active ? "Status: Aktiv" : "Status: Inaktiv"}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {leagueFormData.active
                        ? "Spieler können an dieser Liga teilnehmen und Matches eintragen."
                        : "Liga ist für neue Spiele deaktiviert, historische Matches bleiben erhalten."}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingLeague}
                  onClick={() => setIsLeagueModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingLeague || !leagueFormData.name.trim()}
                  className="flex-1 py-2.5 bg-[#1b4332] hover:bg-black disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingLeague ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Speichern...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>{editingLeague ? "Änderungen speichern" : "Liga anlegen"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfigConfirmModal && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-amber-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Neuberechnung Bestätigen
              </h3>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-amber-950 space-y-2 leading-relaxed">
              <p className="font-extrabold text-amber-900 text-sm">
                Achtung: Dies löst eine automatische Neuberechnung aller Spiele ab dem{" "}
                <span className="underline decoration-2">
                  {(() => {
                    const rawDate = showConfigConfirmModal === "save"
                      ? configFormData.effective_date
                      : configVersions.find((v) => v.id === deleteTargetConfigId)?.effective_date;
                    if (!rawDate) return "Stichtag";
                    const parts = rawDate.split("-");
                    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : rawDate;
                  })()}
                </span>{" "}
                aus.
              </p>
              <p className="text-slate-600 font-normal">
                {showConfigConfirmModal === "save"
                  ? "Alle ab einschließlich diesem Stichtag ausgetragenen Matches werden in der Datenbank chronologisch mit den neuen Parametern neu ausgewertet. Die Punktestände der Spieler verändern sich entsprechend in Echtzeit."
                  : "Die ausgewählte Konfiguration wird entfernt. Alle betroffenen Matches werden mit dem davor gültigen Regelwerk neu berechnet."}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={recalculatingConfig}
                onClick={() => setShowConfigConfirmModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer text-center flex items-center justify-center"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={recalculatingConfig}
                onClick={showConfigConfirmModal === "save" ? handleConfirmSaveConfig : handleConfirmDeleteConfig}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border border-amber-600 py-3 px-4 text-xs font-black cursor-pointer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "auto", minWidth: "max-content" }}
              >
                {recalculatingConfig ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Berechne neu...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-sm"></i>
                    <span>Bestätigen & Neuberechnen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* League Rule Editor Modal */}
      {managingRulesLeague && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl">
            <LeagueRuleEditor
              leagueId={managingRulesLeague.id}
              leagueName={managingRulesLeague.name}
              onClose={() => setManagingRulesLeague(null)}
              onSaved={() => {
                loadConfigVersions();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
