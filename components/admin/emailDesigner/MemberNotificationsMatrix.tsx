import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { User } from "../../../types";
import {
  NotificationEventKey,
  SystemwideNotificationSettings,
  UserNotificationSettings,
} from "../../../types/notifications";
import { bulkUpdateUserNotificationSettingsMap } from "../../../services/db";

interface MemberNotificationsMatrixProps {
  users: Record<string, User>;
  systemwideActive: SystemwideNotificationSettings;
  isGlobalEmailPaused: boolean;
  currentClubId: string;
  onUpdateUsers?: (updated: Record<string, User>) => void;
}

// 5 Columns in requested order
const MATRIX_COLUMNS: Array<{ key: NotificationEventKey; label: string }> = [
  { key: "RESERVATION_CONFIRMED", label: "Buchung erstellt" },
  { key: "RESERVATION_CANCELLED", label: "Stornierung" },
  { key: "RESERVATION_MODIFIED", label: "Umbuchung" },
  { key: "HOBBYLIGA_NEW_POST", label: "Hobbyliga Post" },
  { key: "MATCH_RESULT_SUBMITTED", label: "Match-Ergebnis" },
];

const ITEMS_PER_PAGE = 30;

export const MemberNotificationsMatrix: React.FC<MemberNotificationsMatrixProps> = ({
  users,
  systemwideActive,
  isGlobalEmailPaused,
  currentClubId,
  onUpdateUsers,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Local state for instant UI responsiveness and staging before save
  const [localSettingsMap, setLocalSettingsMap] = useState<Record<string, UserNotificationSettings>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Initialize local settings from incoming users prop
  useEffect(() => {
    const map: Record<string, UserNotificationSettings> = {};
    for (const [key, user] of Object.entries(users)) {
      const memberKey = user.id || key || user.name;
      const settings = user.notification_settings || user.notificationSettings || user.notificationPreferences || {};
      map[memberKey] = { ...settings };
    }
    setLocalSettingsMap(map);
    setHasUnsavedChanges(false);
  }, [users]);

  // Reset to page 1 on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Sorted list of all members with stable key
  const usersList = useMemo(() => {
    return Object.entries(users)
      .map(([dictKey, user]) => {
        const memberKey = user.id || dictKey || user.name;
        const displayName =
          user.lastName && user.firstName
            ? `${user.lastName}, ${user.firstName}`
            : user.name || "Unbenannt";
        return {
          dictKey,
          memberKey,
          user,
          displayName,
          email: user.email || "",
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" }));
  }, [users]);

  // Filtered members by search query
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter((item) => {
      const full = `${item.displayName} ${item.user.firstName || ""} ${item.user.lastName || ""} ${item.user.name || ""}`.toLowerCase();
      const email = item.email.toLowerCase();
      return full.includes(q) || email.includes(q);
    });
  }, [usersList, searchQuery]);

  // Paginierung: max. 30 Spieler je Seite
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // "Alle auswählen"-Checkbox status for visible/filtered users
  const isAllSelected = useMemo(() => {
    if (paginatedUsers.length === 0) return false;
    return paginatedUsers.every((item) => selectedUserIds.has(item.memberKey));
  }, [paginatedUsers, selectedUserIds]);

  const handleToggleSelectAll = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        paginatedUsers.forEach((item) => next.delete(item.memberKey));
      } else {
        paginatedUsers.forEach((item) => next.add(item.memberKey));
      }
      return next;
    });
  };

  const handleToggleSingleSelect = (memberKey: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberKey)) {
        next.delete(memberKey);
      } else {
        next.add(memberKey);
      }
      return next;
    });
  };

  // Immediate toggle of user event in local state
  const handleToggleUserEvent = (memberKey: string, eventKey: NotificationEventKey) => {
    if (systemwideActive[eventKey] === false || isGlobalEmailPaused) return;

    const currentSettings = localSettingsMap[memberKey] || {};
    const currentVal = currentSettings[eventKey] !== false; // default true
    const newVal = !currentVal;

    setLocalSettingsMap((prev) => ({
      ...prev,
      [memberKey]: {
        ...prev[memberKey],
        [eventKey]: newVal,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  // Save changes to Firestore and parent state
  const handleSaveUserSettings = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      // 1. Build updated user objects
      const updatedUsers: Record<string, User> = { ...users };
      const changedEntries: Array<{ id: string; settings: UserNotificationSettings }> = [];

      for (const [key, user] of Object.entries(users)) {
        const memberKey = user.id || key || user.name;
        const modifiedSettings = localSettingsMap[memberKey];
        if (modifiedSettings) {
          const safeSettings: UserNotificationSettings = { ...modifiedSettings };
          updatedUsers[key] = {
            ...user,
            notification_settings: safeSettings,
            notificationSettings: safeSettings,
            notificationPreferences: safeSettings,
          };
          changedEntries.push({
            id: user.id || key,
            settings: safeSettings,
          });
        }
      }

      // 2. Update parent state
      if (onUpdateUsers) {
        await onUpdateUsers(updatedUsers);
      }

      // 3. Persist directly to Firestore
      await bulkUpdateUserNotificationSettingsMap(currentClubId, changedEntries);

      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setFeedback({
        type: "success",
        text: "Änderungen an den Spieler-Benachrichtigungen erfolgreich gespeichert.",
      });
      setTimeout(() => {
        setSaveSuccess(false);
        setFeedback(null);
      }, 3500);
    } catch (err: any) {
      console.error("Error saving member notifications:", err);
      setFeedback({
        type: "error",
        text: err.message || "Fehler beim Speichern der Einstellungen.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header: Ohne (Massenverwaltung), ohne Untertitel */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-2xs">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Individuelle Spieler-Benachrichtigungen
          </h3>
        </div>

        <div className="text-xs font-bold text-slate-400">
          {filteredUsers.length} {filteredUsers.length === 1 ? "Spieler" : "Spieler"}
          {searchQuery.trim() && usersList.length !== filteredUsers.length && (
            <span className="ml-1 text-slate-400 font-normal">
              (von {usersList.length})
            </span>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Suchleiste & Speichern-Button */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        {/* Modernes, vergrößertes Suchfeld (h-11) mit schnellem Clear-Button */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Spieler nach Name oder E-Mail filtern..."
            className="w-full h-11 pl-11 pr-10 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Suche leeren"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Zähler-Info & Speichern-Button */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <span className="text-xs sm:text-sm font-bold text-slate-600 whitespace-nowrap">
            {selectedUserIds.size} von {filteredUsers.length} markiert
          </span>

          <button
            type="button"
            onClick={handleSaveUserSettings}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
              hasUnsavedChanges
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
            title={hasUnsavedChanges ? "Änderungen an den Spieler-Einstellungen speichern" : "Keine ungespeicherten Änderungen"}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccess ? "Gespeichert" : "Speichern"}</span>
          </button>
        </div>
      </div>

      {/* Spieler-Matrix Tabelle */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 select-none">
              <tr className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Alle sichtbar gefilterten Spieler an- oder abwählen"
                  />
                </th>
                <th className="py-2.5 px-3 min-w-[200px]">Mitglied</th>
                {MATRIX_COLUMNS.map((col) => {
                  const isGloballyOff = systemwideActive[col.key] === false || isGlobalEmailPaused;
                  return (
                    <th key={col.key} className="py-2.5 px-3 text-center min-w-[110px]">
                      <div className="flex flex-col items-center">
                        <span className={isGloballyOff ? "text-slate-400 line-through" : "text-slate-800"}>
                          {col.label}
                        </span>
                        {isGloballyOff && (
                          <span className="text-[9px] font-bold text-red-600 tracking-normal capitalize">
                            Global aus
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-6 h-6 text-slate-300" />
                      <span>Keine Spieler passend zu „{searchQuery}“ gefunden.</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="mt-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold text-[11px] cursor-pointer"
                      >
                        Suche zurücksetzen
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((item) => {
                  const isSelected = selectedUserIds.has(item.memberKey);
                  const settings = localSettingsMap[item.memberKey] || {};

                  return (
                    <tr
                      key={item.memberKey}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-amber-50/60" : ""
                      }`}
                    >
                      {/* Checkbox Spalte zur Selektion */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSingleSelect(item.memberKey)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Spieler markieren"
                        />
                      </td>

                      {/* Mitglied Spalte */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 text-xs truncate max-w-xs">
                          {item.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {item.email || "Keine E-Mail"}
                        </div>
                      </td>

                      {/* 5 E-Mail Spalten mit schlichten, klickbaren Checkboxen */}
                      {MATRIX_COLUMNS.map((col) => {
                        const isGloballyOff = systemwideActive[col.key] === false || isGlobalEmailPaused;
                        const isUserOn = settings[col.key] !== false; // default true

                        return (
                          <td key={col.key} className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!isGloballyOff && isUserOn}
                              disabled={isGloballyOff}
                              onChange={() => handleToggleUserEvent(item.memberKey, col.key)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              title={
                                isGloballyOff
                                  ? "Global deaktiviert"
                                  : isUserOn
                                  ? "Aktiviert – Klicken zum Deaktivieren"
                                  : "Deaktiviert – Klicken zum Aktivieren"
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginierungs-Leiste: erscheint nur, wenn mehr als 30 Spieler vorhanden sind */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold">
              Seite {currentPage} von {totalPages} ({filteredUsers.length} Spieler gesamt)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Zurück</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Weiter</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
