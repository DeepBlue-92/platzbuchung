import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { User } from "../../types";
import { updateMembersOnboardingStatus } from "../../services/db";
import { OnboardingMemberSelectorList } from "./OnboardingMemberSelectorList";
import { OnboardingBulkActionBar } from "./OnboardingBulkActionBar";

interface OnboardingBatchActionsProps {
  currentClubId: string;
  users: Record<string, User>;
  onUpdateUsers?: (updated: Record<string, User>) => void;
}

export const OnboardingBatchActions: React.FC<OnboardingBatchActionsProps> = ({
  currentClubId,
  users,
  onUpdateUsers,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(new Set());

  // Prepare user list sorted by name
  const usersList = useMemo(() => {
    return Object.values(users).sort((a, b) => {
      const nameA = (a.lastName || a.name || "").toLowerCase();
      const nameB = (b.lastName || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  // Overall statistics
  const totalCount = usersList.length;
  const pendingCount = useMemo(
    () => usersList.filter((u) => !!(u.onboarding_pending ?? u.onboardingPending)).length,
    [usersList]
  );
  const completedCount = totalCount - pendingCount;

  // Filtered members by search query and status filter
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersList.filter((user) => {
      const isPending = !!(user.onboarding_pending ?? user.onboardingPending);

      // Status Filter
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "completed" && isPending) return false;

      // Search Query
      if (q) {
        const fullName = `${user.firstName || ""} ${user.lastName || ""} ${user.name || ""}`.toLowerCase();
        const email = (user.email || "").toLowerCase();
        const username = (user.username || "").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !username.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [usersList, searchQuery, statusFilter]);

  // Selection helpers
  const handleToggleMember = (key: string) => {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredMembers.length === 0) return false;
    return filteredMembers.every((u) => selectedUserKeys.has(u.id || u.name));
  }, [filteredMembers, selectedUserKeys]);

  const handleToggleAllFiltered = () => {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        // Deselect all filtered
        filteredMembers.forEach((u) => next.delete(u.id || u.name));
      } else {
        // Select all filtered
        filteredMembers.forEach((u) => next.add(u.id || u.name));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedUserKeys(new Set());
  };

  // Bulk actions for selected users
  const handleBulkSetStatus = async (targetPending: boolean) => {
    const selectedUsers = usersList.filter((u) => selectedUserKeys.has(u.id || u.name));
    if (selectedUsers.length === 0) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const updatedCount = await updateMembersOnboardingStatus(
        currentClubId,
        selectedUsers,
        targetPending
      );

      // Update parent state
      const updatedUsersMap: Record<string, User> = { ...users };
      for (const u of selectedUsers) {
        const key = u.id || u.name;
        updatedUsersMap[key] = {
          ...u,
          onboarding_pending: targetPending,
          onboardingPending: targetPending,
        };
      }
      if (onUpdateUsers) {
        onUpdateUsers(updatedUsersMap);
      }

      setFeedback({
        type: "success",
        message: targetPending
          ? `Onboarding für ${updatedCount} ausgewählte Mitglieder erfolgreich aktiviert (ausstehend).`
          : `Onboarding für ${updatedCount} ausgewählte Mitglieder als erledigt markiert.`,
      });
      setSelectedUserKeys(new Set());
      setTimeout(() => setFeedback(null), 4500);
    } catch (err: any) {
      console.error("Bulk onboarding update error:", err);
      setFeedback({
        type: "error",
        message: err.message || "Fehler beim Aktualisieren der ausgewählten Mitglieder.",
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle single member status
  const handleToggleSingleStatus = async (user: User) => {
    const userKey = user.id || user.name;
    const currentPending = !!(user.onboarding_pending ?? user.onboardingPending);
    const nextPending = !currentPending;

    setUpdatingUserId(userKey);
    setFeedback(null);

    try {
      await updateMembersOnboardingStatus(currentClubId, [user], nextPending);

      const updatedUsersMap: Record<string, User> = {
        ...users,
        [userKey]: {
          ...user,
          onboarding_pending: nextPending,
          onboardingPending: nextPending,
        },
      };
      if (onUpdateUsers) {
        onUpdateUsers(updatedUsersMap);
      }

      setFeedback({
        type: "success",
        message: `Onboarding für „${user.name || userKey}“ auf ${
          nextPending ? "„Ausstehend“" : "„Erledigt“"
        } gesetzt.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      console.error("Toggle single member onboarding error:", err);
      setFeedback({
        type: "error",
        message: err.message || "Fehler beim Umschalten des Onboarding-Status.",
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div
      id="admin-onboarding-batch-card"
      className="bg-slate-50 border border-slate-200/80 p-5 sm:p-7 rounded-[1rem] space-y-4 sm:space-y-5 shadow-sm"
    >
      {/* 1. Header & Title */}
      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-700" />
          <span>STAPELVERARBEITUNG: ONBOARDING-STATUS</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Gezielte Steuerung des Begrüßungsfensters per Schnellsuche, Filter und Mehrfachauswahl:
        </p>
      </div>

      {/* 2. Such- und Filterleiste */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Suchfeld mit Lupe */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mitglied suchen..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 transition-colors shadow-2xs"
          />
        </div>

        {/* Schnellfilter Segment-Pills */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl shrink-0 text-xs select-none">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Alle ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === "pending"
                ? "bg-amber-100/90 text-amber-900 font-bold shadow-2xs"
                : "text-amber-800/80 hover:text-amber-950"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            <span>Ausstehend ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === "completed"
                ? "bg-emerald-100/90 text-emerald-950 font-bold shadow-2xs"
                : "text-emerald-800/80 hover:text-emerald-950"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Erledigt ({completedCount})</span>
          </button>
        </div>
      </div>

      {/* 3. Kontextuelle Aktionsleiste bei selektierten Mitgliedern */}
      <OnboardingBulkActionBar
        selectedCount={selectedUserKeys.size}
        isProcessing={isProcessing}
        onActivateSelected={() => handleBulkSetStatus(true)}
        onCompleteSelected={() => handleBulkSetStatus(false)}
        onClearSelection={handleClearSelection}
      />

      {/* 4. Selektierbare Mitglieder-Liste */}
      <OnboardingMemberSelectorList
        members={filteredMembers}
        selectedKeys={selectedUserKeys}
        onToggleMember={handleToggleMember}
        onToggleAllFiltered={handleToggleAllFiltered}
        isAllSelected={isAllFilteredSelected}
        onToggleSingleStatus={handleToggleSingleStatus}
        updatingUserId={updatingUserId}
        disabled={isProcessing}
      />

      {/* 5. Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
