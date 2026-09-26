import React, { useState, useMemo, useEffect } from "react";
import {
  Bell,
  Users,
  Search,
  Filter,
  CheckSquare,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  MessageSquare,
  Trophy,
  Shield,
  Sliders,
  Check,
  X,
  Loader2,
  Info,
  Calendar,
} from "lucide-react";
import { User } from "../../types";
import {
  NotificationEventKey,
  UserNotificationSettings,
} from "../../types/notifications";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  DEFAULT_USER_NOTIFICATION_SETTINGS,
} from "../../services/notificationTemplates";
import {
  bulkUpdateNotificationsApi,
  broadcastHobbyligaPostApi,
  notifyMatchResultApi,
  loadNotificationDefaultsApi,
  saveNotificationDefaultsApi,
} from "../../services/notificationClient";
import { EmailTemplateManager } from "./EmailTemplateManager";

interface AdminNotificationsManagementProps {
  users: Record<string, User>;
  currentUser?: User | null;
  currentClubId?: string;
  clubName?: string;
  onUpdateUsers?: (updated: Record<string, User>) => void;
}

export const AdminNotificationsManagement: React.FC<AdminNotificationsManagementProps> = ({
  users,
  currentUser,
  currentClubId = "sv-neuhausen",
  clubName = "Tennis-Club e.V.",
  onUpdateUsers,
}) => {
  // Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<"bulk" | "templates" | "simulate">("bulk");

  // 1. Onboarding Defaults State
  const [onboardingDefaults, setOnboardingDefaults] = useState<UserNotificationSettings>(
    DEFAULT_USER_NOTIFICATION_SETTINGS
  );
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [defaultsSavedNotice, setDefaultsSavedNotice] = useState(false);

  // Load defaults on mount
  useEffect(() => {
    loadNotificationDefaultsApi(currentClubId).then((loaded) => {
      if (loaded) {
        setOnboardingDefaults({
          ...DEFAULT_USER_NOTIFICATION_SETTINGS,
          ...loaded,
        });
      }
    });
  }, [currentClubId]);

  // 2. Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<"all" | "hobby" | "non-hobby">("all");
  const [eventFilterKey, setEventFilterKey] = useState<NotificationEventKey | "all">("all");
  const [eventFilterStatus, setEventFilterStatus] = useState<"all" | "enabled" | "disabled">("all");

  // Selection Set
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Bulk Action Controls
  const [selectedEventForBulk, setSelectedEventForBulk] = useState<NotificationEventKey>("HOBBYLIGA_NEW_POST");
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);

  // General Notification / Feedback Banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // 3. Simulation Test Bench State
  const [simPostTitle, setSimPostTitle] = useState("Trainingspartner für Samstagvormittag gesucht");
  const [simPostContent, setSimPostContent] = useState("Hallo zusammen! Wer hat Zeit und Lust am Samstag um 10:30 Uhr auf Platz 1 zu spielen?");
  const [simAuthorId, setSimAuthorId] = useState<string>(currentUser?.id || currentUser?.name || "");
  const [isSimulatingBroadcast, setIsSimulatingBroadcast] = useState(false);
  const [broadcastSimResult, setBroadcastSimResult] = useState<any>(null);

  const [simSubmitterId, setSimSubmitterId] = useState<string>(currentUser?.id || currentUser?.name || "");
  const [simOpponentId, setSimOpponentId] = useState<string>("");
  const [simScore, setSimScore] = useState("6:4, 7:5");
  const [isSimulatingMatch, setIsSimulatingMatch] = useState(false);
  const [matchSimResult, setMatchSimResult] = useState<any>(null);

  // Sorted full list of members
  const usersList: User[] = useMemo(() => {
    return Object.values(users).sort((a, b) => {
      const nameA = (a.lastName || a.name || "").toLowerCase();
      const nameB = (b.lastName || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersList.filter((user) => {
      // 1. Search Query
      if (q) {
        const fullName = `${user.firstName || ""} ${user.lastName || ""} ${user.name || ""}`.toLowerCase();
        const email = (user.email || "").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q)) {
          return false;
        }
      }

      // 2. League Filter
      const isHobby = user.hobbyLeagueOptIn === true || (user.hobbyLeagueOptIn as any) === "true";
      if (leagueFilter === "hobby" && !isHobby) return false;
      if (leagueFilter === "non-hobby" && isHobby) return false;

      // 3. Event Status Filter
      if (eventFilterKey !== "all" && eventFilterStatus !== "all") {
        const settings = user.notification_settings || user.notificationSettings;
        const isEnabled = settings?.[eventFilterKey] !== false; // default true
        if (eventFilterStatus === "enabled" && !isEnabled) return false;
        if (eventFilterStatus === "disabled" && isEnabled) return false;
      }

      return true;
    });
  }, [usersList, searchQuery, leagueFilter, eventFilterKey, eventFilterStatus]);

  // Overall Statistics
  const totalCount = usersList.length;
  const hobbyParticipantsCount = useMemo(
    () => usersList.filter((u) => u.hobbyLeagueOptIn === true || (u.hobbyLeagueOptIn as any) === "true").length,
    [usersList]
  );

  // Set default opponent for simulation once users are available
  useEffect(() => {
    if (!simOpponentId && usersList.length > 1) {
      const other = usersList.find((u) => (u.id || u.name) !== (currentUser?.id || currentUser?.name));
      if (other) {
        setSimOpponentId(other.id || other.name);
      }
    }
    if (!simAuthorId && currentUser) {
      setSimAuthorId(currentUser.id || currentUser.name);
    }
  }, [usersList, currentUser, simOpponentId, simAuthorId]);

  // Master Select All / Deselect All
  const isAllFilteredSelected = useMemo(() => {
    if (filteredMembers.length === 0) return false;
    return filteredMembers.every((u) => selectedUserIds.has(u.id || u.name));
  }, [filteredMembers, selectedUserIds]);

  const handleToggleSelectAll = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredMembers.forEach((u) => next.delete(u.id || u.name));
      } else {
        filteredMembers.forEach((u) => next.add(u.id || u.name));
      }
      return next;
    });
  };

  const handleToggleSingleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Execute Bulk Action (Activate / Deactivate selected event)
  const handleExecuteBulkAction = async (enabled: boolean) => {
    const targetUserIds = Array.from(selectedUserIds);
    if (targetUserIds.length === 0) return;

    setIsExecutingBulk(true);
    setFeedback(null);

    const eventDef = NOTIFICATION_EVENT_DEFINITIONS.find((e) => e.key === selectedEventForBulk);
    const eventLabel = eventDef?.label || selectedEventForBulk;

    try {
      const result = await bulkUpdateNotificationsApi({
        userIds: targetUserIds,
        eventKey: selectedEventForBulk,
        enabled,
        vereinsId: currentClubId,
      });

      // Update parent state optimistically
      const updatedMap: Record<string, User> = { ...users };
      for (const id of targetUserIds) {
        const u = updatedMap[id];
        if (u) {
          const currentSettings = u.notification_settings || u.notificationSettings || {};
          const nextSettings = { ...currentSettings, [selectedEventForBulk]: enabled };
          updatedMap[id] = {
            ...u,
            notification_settings: nextSettings,
            notificationSettings: nextSettings,
          };
        }
      }

      if (onUpdateUsers) {
        onUpdateUsers(updatedMap);
      }

      setFeedback({
        type: "success",
        text: `Erfolgreich: „${eventLabel}“ für ${result.updatedCount || targetUserIds.length} Spieler ${
          enabled ? "aktiviert (eingeschaltet)" : "deaktiviert (ausgeschaltet)"
        }.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      console.error("Bulk action failed:", err);
      setFeedback({
        type: "error",
        text: err.message || "Fehler bei der Durchführung der Massenbearbeitung.",
      });
    } finally {
      setIsExecutingBulk(false);
    }
  };

  // Toggle single user single event directly
  const handleToggleSingleEvent = async (user: User, eventKey: NotificationEventKey) => {
    const userId = user.id || user.name;
    const currentSettings = user.notification_settings || user.notificationSettings || {};
    const nextState = currentSettings[eventKey] === false ? true : false;

    // Optimistic local update
    const updatedMap: Record<string, User> = {
      ...users,
      [userId]: {
        ...user,
        notification_settings: {
          ...currentSettings,
          [eventKey]: nextState,
        },
        notificationSettings: {
          ...currentSettings,
          [eventKey]: nextState,
        },
      },
    };
    if (onUpdateUsers) {
      onUpdateUsers(updatedMap);
    }

    try {
      await bulkUpdateNotificationsApi({
        userIds: [userId],
        eventKey,
        enabled: nextState,
        vereinsId: currentClubId,
      });
    } catch (err) {
      console.error("Single toggle failed:", err);
    }
  };

  // Save Onboarding Defaults
  const handleSaveDefaults = async () => {
    setIsSavingDefaults(true);
    try {
      await saveNotificationDefaultsApi(currentClubId, onboardingDefaults);
      setDefaultsSavedNotice(true);
      setTimeout(() => setDefaultsSavedNotice(false), 3500);
      setFeedback({
        type: "success",
        text: "Onboarding-Standardeinstellungen für neue Mitglieder erfolgreich gespeichert!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: "Fehler beim Speichern der Onboarding-Standards.",
      });
    } finally {
      setIsSavingDefaults(false);
    }
  };

  // Run Hobbyliga Broadcast Test
  const handleRunBroadcastSimulation = async () => {
    setIsSimulatingBroadcast(true);
    setBroadcastSimResult(null);
    try {
      const authorObj = usersList.find((u) => (u.id || u.name) === simAuthorId);
      const authorName = authorObj?.firstName && authorObj?.lastName
        ? `${authorObj.firstName} ${authorObj.lastName}`
        : authorObj?.name || "Autor";

      const res = await broadcastHobbyligaPostApi({
        authorId: simAuthorId,
        authorName,
        postTitle: simPostTitle,
        postContent: simPostContent,
        leagueName: "Hobbyliga Herren & Damen",
        vereinsId: currentClubId,
        clubName,
        users,
      });

      setBroadcastSimResult(res);
      setFeedback({
        type: "info",
        text: `Hobbyliga-Broadcast ausgeführt: ${res.sentCount} E-Mails vorbereitet/versendet (${res.skippedAuthor} Verfasser ausgeschlossen, ${res.skippedOptOut} Abmeldungen).`,
      });
    } catch (err: any) {
      console.error("Broadcast simulation failed:", err);
      setFeedback({
        type: "error",
        text: err.message || "Fehler bei der Broadcast-Simulation.",
      });
    } finally {
      setIsSimulatingBroadcast(false);
    }
  };

  // Run Match Result Opponent Notification Test
  const handleRunMatchSimulation = async () => {
    if (!simOpponentId) {
      setFeedback({ type: "error", text: "Bitte wähle einen gegnerischen Spieler aus." });
      return;
    }
    if (simOpponentId === simSubmitterId) {
      setFeedback({ type: "error", text: "Eintragender Spieler und Gegner dürfen nicht identisch sein." });
      return;
    }

    setIsSimulatingMatch(true);
    setMatchSimResult(null);

    try {
      const submitterObj = usersList.find((u) => (u.id || u.name) === simSubmitterId);
      const submitterName = submitterObj?.firstName && submitterObj?.lastName
        ? `${submitterObj.firstName} ${submitterObj.lastName}`
        : submitterObj?.name || "Spieler 1";

      const opponentObj = usersList.find((u) => (u.id || u.name) === simOpponentId);
      const opponentName = opponentObj?.firstName && opponentObj?.lastName
        ? `${opponentObj.firstName} ${opponentObj.lastName}`
        : opponentObj?.name || "Spieler 2";

      const res = await notifyMatchResultApi({
        submitterId: simSubmitterId,
        submitterName,
        opponentId: simOpponentId,
        opponentName,
        resultScore: simScore,
        matchDate: new Date().toLocaleDateString("de-DE"),
        leagueName: "Hobbyliga",
        clubName,
        users,
      });

      setMatchSimResult(res);
      setFeedback({
        type: res.sent ? "success" : "info",
        text: res.reason || (res.sent ? `Ergebnis erfolgreich an Gegner ${opponentName} versendet!` : "Match-Ergebnis verarbeitet."),
      });
    } catch (err: any) {
      console.error("Match result simulation failed:", err);
      setFeedback({
        type: "error",
        text: err.message || "Fehler beim Test der Match-Ergebnis-Benachrichtigung.",
      });
    } finally {
      setIsSimulatingMatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Benachrichtigungs-System & Massenverwaltung</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Bulk Actions
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Gezielte Steuerung aller E-Mail-Abonnements, Massenaktivierung für Hobbyliga & Matches sowie Onboarding-Vorgaben.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-800">{totalCount}</span>
            <span className="text-slate-500">Mitglieder</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-bold text-emerald-800">{hobbyParticipantsCount}</span>
            <span className="text-emerald-700">Hobbyliga</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("bulk")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "bulk"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Spieler-Einstellungen & Bulk-Aktionen</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("simulate")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "simulate"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Event-Testbench (Broadcast & Match)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("templates")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "templates"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>E-Mail-Vorlagen & Editor</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : feedback.type === "error"
              ? "bg-red-50 text-red-900 border border-red-200"
              : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : feedback.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: BULK ACTIONS & MEMBER SETTINGS */}
      {activeSubTab === "bulk" && (
        <div className="space-y-6">
          {/* 1. Onboarding Defaults Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ONBOARDING-DEFAULTS: STANDARD-BENACHRICHTIGUNGEN FÜR NEUE MITGLIEDER</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Definiere, welche Events bei neu registrierten Mitgliedern automatisch voreingestellt sind:
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveDefaults}
                disabled={isSavingDefaults}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSavingDefaults ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : defaultsSavedNotice ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{defaultsSavedNotice ? "Gespeichert!" : "Defaults speichern"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {NOTIFICATION_EVENT_DEFINITIONS.map((eventDef) => {
                const isEnabled = onboardingDefaults[eventDef.key] !== false;
                return (
                  <div
                    key={eventDef.key}
                    onClick={() =>
                      setOnboardingDefaults((prev) => ({
                        ...prev,
                        [eventDef.key]: !isEnabled,
                      }))
                    }
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none ${
                      isEnabled
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold leading-tight">{eventDef.label}</span>
                      <div
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors shrink-0 ${
                          isEnabled ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white transition-transform ${
                            isEnabled ? "translate-x-3" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 line-clamp-2">
                      {eventDef.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Filter Bar */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Search Query */}
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Spieler nach Name oder E-Mail suchen..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                />
              </div>

              {/* League Filter */}
              <div className="sm:col-span-4">
                <select
                  value={leagueFilter}
                  onChange={(e) => setLeagueFilter(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                >
                  <option value="all">Alle Gruppen & Ligen ({totalCount})</option>
                  <option value="hobby">🛡️ Nur Hobbyliga aktiv ({hobbyParticipantsCount})</option>
                  <option value="non-hobby">Keine Hobbyliga ({totalCount - hobbyParticipantsCount})</option>
                </select>
              </div>

              {/* Event Key Filter */}
              <div className="sm:col-span-3">
                <select
                  value={eventFilterKey}
                  onChange={(e) => setEventFilterKey(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                >
                  <option value="all">Alle Benachrichtigungen</option>
                  <option value="HOBBYLIGA_NEW_POST">Event: Hobbyliga-Post</option>
                  <option value="MATCH_RESULT_SUBMITTED">Event: Match-Ergebnis</option>
                  <option value="RESERVATION_CONFIRMED">Event: Buchung</option>
                  <option value="RESERVATION_CANCELLED">Event: Stornierung</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Contextual Bulk Action Bar */}
          {selectedUserIds.size > 0 && (
            <div
              id="bulk-notification-action-bar"
              className="bg-emerald-50 border border-emerald-200 p-3.5 sm:px-5 sm:py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-2xs">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-emerald-950">
                    {selectedUserIds.size} {selectedUserIds.size === 1 ? "Spieler markiert" : "Spieler markiert"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds(new Set())}
                    className="text-[11px] text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                  >
                    Auswahl aufheben
                  </button>
                </div>
              </div>

              {/* Bulk Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-900 hidden sm:inline">Event:</span>
                <select
                  value={selectedEventForBulk}
                  onChange={(e) => setSelectedEventForBulk(e.target.value as NotificationEventKey)}
                  className="bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="HOBBYLIGA_NEW_POST">Hobbyliga: Neuer Beitrag</option>
                  <option value="MATCH_RESULT_SUBMITTED">Match-Ergebnis eingetragen</option>
                  <option value="RESERVATION_CONFIRMED">Buchungsbestätigung</option>
                  <option value="RESERVATION_CANCELLED">Buchungsstornierung</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleExecuteBulkAction(true)}
                  disabled={isExecutingBulk}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isExecutingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Aktivieren (Einschalten)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteBulkAction(false)}
                  disabled={isExecutingBulk}
                  className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isExecutingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  <span>Deaktivieren (Ausschalten)</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Selectable Member List */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Table Header */}
            <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 select-none">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected && filteredMembers.length > 0}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  {isAllFilteredSelected
                    ? `Alle ${filteredMembers.length} abwählen`
                    : `Alle auswählen (${filteredMembers.length} Spieler)`}
                </span>
              </label>

              <div className="hidden sm:flex items-center gap-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span>Liga-Status</span>
                <span className="w-36 text-center">Hobbyliga-Post</span>
                <span className="w-36 text-center">Match-Ergebnis</span>
              </div>
            </div>

            {/* Scrollable Members Body */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/40">
              {filteredMembers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-1">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">Keine Spieler gefunden</p>
                  <p className="text-[11px] text-slate-400">Passe deine Suchbegriffe oder Filterkriterien an.</p>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const memberId = member.id || member.name;
                  const isSelected = selectedUserIds.has(memberId);
                  const isHobby = member.hobbyLeagueOptIn === true || (member.hobbyLeagueOptIn as any) === "true";
                  const settings = member.notification_settings || member.notificationSettings || {};

                  const isHobbyPostOn = settings.HOBBYLIGA_NEW_POST !== false;
                  const isMatchResultOn = settings.MATCH_RESULT_SUBMITTED !== false;

                  const displayName =
                    member.firstName && member.lastName
                      ? `${member.lastName}, ${member.firstName}`
                      : member.name || "Unbenannt";

                  return (
                    <div
                      key={memberId}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected ? "bg-amber-50/70" : "hover:bg-slate-100/70"
                      }`}
                    >
                      {/* Left: Checkbox & Member Identity */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSingleUser(memberId)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                            <span>{member.email || "Keine E-Mail"}</span>
                            {member.role === "admin" && (
                              <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle: League Badge */}
                      <div className="hidden sm:block shrink-0">
                        {isHobby ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            <span>Hobbyliga aktiv</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Inaktiv
                          </span>
                        )}
                      </div>

                      {/* Right: Quick Toggles for the two main events */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* HOBBYLIGA_NEW_POST Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleSingleEvent(member, "HOBBYLIGA_NEW_POST")}
                          className={`w-28 sm:w-36 py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            isHobbyPostOn
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Hobbyliga-Pinnwand-Benachrichtigung umschalten"
                        >
                          {isHobbyPostOn ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                          <span className="text-[11px]">{isHobbyPostOn ? "Post: Aktiv" : "Post: Aus"}</span>
                        </button>

                        {/* MATCH_RESULT_SUBMITTED Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleSingleEvent(member, "MATCH_RESULT_SUBMITTED")}
                          className={`w-28 sm:w-36 py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            isMatchResultOn
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Match-Ergebnis-Benachrichtigung umschalten"
                        >
                          {isMatchResultOn ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                          <span className="text-[11px]">{isMatchResultOn ? "Ergebnis: Aktiv" : "Ergebnis: Aus"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMULATION & EVENT TESTBENCH */}
      {activeSubTab === "simulate" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Simulation 1: HOBBYLIGA_NEW_POST */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>EVENT: 'HOBBYLIGA_NEW_POST' (BROADCAST)</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sendet an alle aktiven Hobbyliga-Teilnehmer mit aktiviertem Empfang – schließt den Verfasser strikt aus.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Verfasser des Beitrags (wird ausgeschlossen):</label>
                <select
                  value={simAuthorId}
                  onChange={(e) => setSimAuthorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  {usersList.map((u) => (
                    <option key={u.id || u.name} value={u.id || u.name}>
                      {u.lastName ? `${u.lastName}, ${u.firstName}` : u.name} ({u.email || "keine Mail"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Titel des Pinnwand-Beitrags:</label>
                <input
                  type="text"
                  value={simPostTitle}
                  onChange={(e) => setSimPostTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nachrichtentext:</label>
                <textarea
                  value={simPostContent}
                  onChange={(e) => setSimPostContent(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRunBroadcastSimulation}
                disabled={isSimulatingBroadcast}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSimulatingBroadcast ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Broadcast an Liga senden / simulieren</span>
              </button>

              {/* Broadcast Result Box */}
              {broadcastSimResult && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Ergebnis des Broadcasts:</span>
                    <span className="text-emerald-700 font-bold">{broadcastSimResult.sentCount} versendet</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-600">
                    <div>Verfasser ignoriert: <strong>{broadcastSimResult.skippedAuthor}</strong></div>
                    <div>Abmeldungen (Opt-out): <strong>{broadcastSimResult.skippedOptOut}</strong></div>
                    <div>Ohne E-Mail: <strong>{broadcastSimResult.skippedNoEmail}</strong></div>
                  </div>
                  {broadcastSimResult.recipients?.length > 0 && (
                    <div className="pt-1 max-h-32 overflow-y-auto divide-y divide-slate-200/60 text-[10px] text-slate-500">
                      {broadcastSimResult.recipients.map((r: any, idx: number) => (
                        <div key={idx} className="py-1 flex items-center justify-between">
                          <span>{r.name} ({r.email})</span>
                          <span className="font-bold text-emerald-700">{r.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Simulation 2: MATCH_RESULT_SUBMITTED */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-700" />
                <span>EVENT: 'MATCH_RESULT_SUBMITTED' (STRIKT GEGNER)</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Wird strikt gefiltert: Sendet ausschließlich an den gegnerischen Spieler, niemals an den Eintragenden.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Eintragender Spieler (Submitter):</label>
                <select
                  value={simSubmitterId}
                  onChange={(e) => setSimSubmitterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  {usersList.map((u) => (
                    <option key={u.id || u.name} value={u.id || u.name}>
                      {u.lastName ? `${u.lastName}, ${u.firstName}` : u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Gegnerischer Spieler (erhält die E-Mail):</label>
                <select
                  value={simOpponentId}
                  onChange={(e) => setSimOpponentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  {usersList
                    .filter((u) => (u.id || u.name) !== simSubmitterId)
                    .map((u) => (
                      <option key={u.id || u.name} value={u.id || u.name}>
                        {u.lastName ? `${u.lastName}, ${u.firstName}` : u.name} ({u.email || "keine Mail"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Ergebnis (Sätze / Spiele):</label>
                <input
                  type="text"
                  value={simScore}
                  onChange={(e) => setSimScore(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleRunMatchSimulation}
                disabled={isSimulatingMatch}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSimulatingMatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Ergebnis-Mail an Gegner senden / testen</span>
              </button>

              {/* Match Result Box */}
              {matchSimResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    matchSimResult.sent
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {matchSimResult.sent ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <span>{matchSimResult.sent ? "E-Mail an Gegner ausgelöst" : "Nicht versendet"}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{matchSimResult.reason}</p>
                  {matchSimResult.opponentEmail && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      Empfänger: {matchSimResult.opponentEmail}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATES & LAYOUT EDITOR */}
      {activeSubTab === "templates" && (
        <EmailTemplateManager currentUser={currentUser} clubName={clubName} />
      )}
    </div>
  );
};
