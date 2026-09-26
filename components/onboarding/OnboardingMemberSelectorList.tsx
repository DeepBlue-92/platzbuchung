import React from "react";
import { User } from "../../types";
import { Clock, CheckCircle2, RotateCcw, Check, Users } from "lucide-react";

interface OnboardingMemberSelectorListProps {
  members: User[];
  selectedKeys: Set<string>;
  onToggleMember: (key: string) => void;
  onToggleAllFiltered: () => void;
  isAllSelected: boolean;
  onToggleSingleStatus: (user: User) => void;
  updatingUserId: string | null;
  disabled?: boolean;
}

export const OnboardingMemberSelectorList: React.FC<OnboardingMemberSelectorListProps> = ({
  members,
  selectedKeys,
  onToggleMember,
  onToggleAllFiltered,
  isAllSelected,
  onToggleSingleStatus,
  updatingUserId,
  disabled = false,
}) => {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
      {/* Table Header with Select-All Checkbox */}
      <div className="bg-slate-100/80 px-3 sm:px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 select-none">
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected && members.length > 0}
              onChange={onToggleAllFiltered}
              disabled={disabled || members.length === 0}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
              aria-label="Alle sichtbaren Mitglieder auswählen oder abwählen"
            />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Mitglied ({members.length})
            </span>
          </label>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <span className="hidden sm:inline">Status</span>
          <span className="w-24 text-right">Aktion</span>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
        {members.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-1.5 text-slate-400">
            <Users className="w-6 h-6 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">
              Keine Mitglieder gefunden
            </p>
            <p className="text-[11px] text-slate-400">
              Passe den Suchbegriff oder den Filter an.
            </p>
          </div>
        ) : (
          members.map((user) => {
            const userKey = user.id || user.name;
            const isSelected = selectedKeys.has(userKey);
            const isPending = !!(user.onboarding_pending ?? user.onboardingPending);
            const isUpdating = updatingUserId === userKey;

            // Compute display name
            const fullName =
              user.firstName && user.lastName
                ? `${user.lastName}, ${user.firstName}`
                : user.name || "Unbenannt";

            const subInfo = user.email || user.username || "";

            return (
              <div
                key={userKey}
                className={`px-3 sm:px-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                  isSelected
                    ? "bg-amber-50/60"
                    : "hover:bg-slate-100/70"
                }`}
              >
                {/* Left: Checkbox + Name & Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleMember(userKey)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 disabled:opacity-40"
                    aria-label={`Auswählen: ${fullName}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 text-xs sm:text-sm truncate">
                      {fullName}
                    </div>
                    {subInfo && (
                      <div className="text-[10px] text-slate-400 truncate font-normal">
                        {subInfo}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Status Badge & Quick-Toggle Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Badge */}
                  {isPending ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>Ausstehend</span>
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Erledigt</span>
                    </span>
                  )}

                  {/* Schnell-Toggle / Button ganz rechts */}
                  <button
                    type="button"
                    onClick={() => onToggleSingleStatus(user)}
                    disabled={disabled || isUpdating}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                      isPending
                        ? "border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-slate-600"
                        : "border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 text-slate-600"
                    }`}
                    title={
                      isPending
                        ? "Als erledigt markieren (Onboarding abschließen)"
                        : "Onboarding wieder aktivieren (ausstehend)"
                    }
                  >
                    {isUpdating ? (
                      <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    ) : isPending ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="hidden sm:inline">Erledigt</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3 h-3 text-amber-600" />
                        <span className="hidden sm:inline">Aktivieren</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
