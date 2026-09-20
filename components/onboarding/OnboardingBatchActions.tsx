import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
} from "lucide-react";
import { User } from "../../types";
import {
  batchResetMemberOnboarding,
  batchCompleteMemberOnboarding,
  saveUser,
} from "../../services/db";

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
  const [modalType, setModalType] = useState<"enable" | "disable" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const usersList = Object.values(users);
  const pendingCount = usersList.filter((u) => u.onboarding_pending).length;

  const handleBatchAction = async (action: "enable" | "disable") => {
    setIsProcessing(true);
    setFeedback(null);
    const targetPendingState = action === "enable";

    try {
      let count = 0;
      const updatedUsersMap: Record<string, User> = { ...users };

      try {
        if (targetPendingState) {
          count = await batchResetMemberOnboarding(currentClubId);
        } else {
          count = await batchCompleteMemberOnboarding(currentClubId);
        }
      } catch (directErr) {
        console.warn(
          `Direct batch ${action} encountered an issue, falling back to individual updates:`,
          directErr
        );
        // Fallback to safe individual saveUser
        for (const u of usersList) {
          const updated: User = {
            ...u,
            onboarding_pending: targetPendingState,
          };
          await saveUser(currentClubId, updated);
          count++;
        }
      }

      // Update local state map
      for (const u of usersList) {
        const key = u.id || u.name;
        updatedUsersMap[key] = {
          ...u,
          onboarding_pending: targetPendingState,
        };
      }

      if (onUpdateUsers) {
        onUpdateUsers(updatedUsersMap);
      }

      setFeedback({
        type: "success",
        message:
          action === "enable"
            ? `Onboarding erfolgreich für alle ${count || usersList.length} Mitglieder eingeschaltet (ausstehend).`
            : `Onboarding erfolgreich für alle ${count || usersList.length} Mitglieder ausgeschaltet (abgeschlossen).`,
      });
      setModalType(null);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      console.error(`Failed to batch ${action} onboarding:`, err);
      setFeedback({
        type: "error",
        message:
          err.message ||
          `Fehler bei der Stapelverarbeitung zum ${action === "enable" ? "Einschalten" : "Ausschalten"}.`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="admin-onboarding-batch-card"
      className="bg-slate-50 border border-slate-200/80 p-6 sm:p-8 rounded-[1rem] space-y-6 shadow-sm"
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <span>Stapelverarbeitung: Onboarding für alle Mitglieder</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Verwalte den Onboarding-Status aller <strong>{usersList.length} Mitglieder</strong> zentral:
            Schalte das Begrüßungsfenster für alle ein (z. B. nach Saisonbeginn oder bei neuen Pflichtfeldern) oder schalte es für alle aus (als erledigt markieren).
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 pt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Aktuell ausstehend: <strong>{pendingCount}</strong> von <strong>{usersList.length}</strong> Mitgliedern</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <button
            type="button"
            id="admin-batch-reset-onboarding-btn"
            onClick={() => setModalType("enable")}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Für alle einschalten</span>
          </button>

          <button
            type="button"
            id="admin-batch-disable-onboarding-btn"
            onClick={() => setModalType("disable")}
            className="bg-slate-700 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Für alle ausschalten</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
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

      {/* Confirmation Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {modalType && (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                      modalType === "enable"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {modalType === "enable" ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {modalType === "enable"
                        ? "Onboarding für alle einschalten?"
                        : "Onboarding für alle ausschalten?"}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {modalType === "enable" ? (
                        <>
                          Möchtest du das Onboarding wirklich für alle{" "}
                          <strong>{usersList.length} Mitglieder</strong> des Vereins einschalten?
                          Jedes Mitglied wird beim nächsten Login das Begrüßungsfenster sehen und seine Daten bestätigen müssen.
                        </>
                      ) : (
                        <>
                          Möchtest du das Onboarding wirklich für alle{" "}
                          <strong>{usersList.length} Mitglieder</strong> des Vereins ausschalten?
                          Alle Mitglieder werden als abgeschlossen markiert und sehen beim nächsten Login kein Begrüßungsfenster mehr.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      disabled={isProcessing}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      id={
                        modalType === "enable"
                          ? "confirm-batch-enable-btn"
                          : "confirm-batch-disable-btn"
                      }
                      onClick={() => handleBatchAction(modalType)}
                      disabled={isProcessing}
                      className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                        modalType === "enable"
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-slate-800 hover:bg-slate-900"
                      }`}
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>
                        {modalType === "enable"
                          ? "Ja, für alle einschalten"
                          : "Ja, für alle ausschalten"}
                      </span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
