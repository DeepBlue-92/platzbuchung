import React, { useState, useEffect } from "react";
import {
  Mail,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Power,
  AlertTriangle,
  Save,
  Check,
} from "lucide-react";
import {
  EmailTemplate,
  NotificationEventKey,
  EmailTemplateAssignments,
  SystemwideNotificationSettings,
  UserNotificationSettings,
} from "../../../types/notifications";
import { NOTIFICATION_EVENT_DEFINITIONS } from "../../../services/notificationTemplates";

interface GlobalEmailSettingsCardProps {
  templates: EmailTemplate[];
  assignments: EmailTemplateAssignments;
  systemwideActive: SystemwideNotificationSettings;
  onboardingDefaults: UserNotificationSettings;
  isGlobalEmailPaused: boolean;
  onUpdateAssignment?: (eventKey: NotificationEventKey, templateId: string) => Promise<void> | void;
  onToggleSystemwide?: (eventKey: NotificationEventKey, enabled: boolean) => Promise<void> | void;
  onToggleOnboardingDefault?: (eventKey: NotificationEventKey, enabled: boolean) => Promise<void> | void;
  onSaveAllGlobalSettings: (settings: {
    assignments: EmailTemplateAssignments;
    systemwideActive: SystemwideNotificationSettings;
    onboardingDefaults: UserNotificationSettings;
  }) => Promise<void> | void;
  onToggleGlobalEmergencyStop: (paused: boolean) => Promise<void> | void;
  onNavigateToEditor?: (templateId: string) => void;
}

export const GlobalEmailSettingsCard: React.FC<GlobalEmailSettingsCardProps> = ({
  templates,
  assignments,
  systemwideActive,
  onboardingDefaults,
  isGlobalEmailPaused,
  onSaveAllGlobalSettings,
  onToggleGlobalEmergencyStop,
  onNavigateToEditor,
}) => {
  // Staged local state for saving on click
  const [localAssignments, setLocalAssignments] = useState<EmailTemplateAssignments>(assignments);
  const [localSystemwideActive, setLocalSystemwideActive] = useState<SystemwideNotificationSettings>(systemwideActive);
  const [localOnboardingDefaults, setLocalOnboardingDefaults] = useState<UserNotificationSettings>(onboardingDefaults);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Confirmation modal: either "pause" or "resume"
  const [confirmModalType, setConfirmModalType] = useState<"pause" | "resume" | null>(null);
  const [isProcessingStop, setIsProcessingStop] = useState(false);

  // Sync from props if not dirty
  useEffect(() => {
    setLocalAssignments(assignments);
    setLocalSystemwideActive(systemwideActive);
    setLocalOnboardingDefaults(onboardingDefaults);
    setHasUnsavedChanges(false);
  }, [assignments, systemwideActive, onboardingDefaults]);

  // Available (non-deleted) templates
  const availableTemplates = templates.filter((t) => !t.deletedAt);

  const handleSelectChange = (eventKey: NotificationEventKey, newTemplateId: string) => {
    setLocalAssignments((prev) => ({ ...prev, [eventKey]: newTemplateId }));
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleToggleEvent = (eventKey: NotificationEventKey) => {
    if (isGlobalEmailPaused) return;
    const currentVal = localSystemwideActive[eventKey] !== false;
    setLocalSystemwideActive((prev) => ({ ...prev, [eventKey]: !currentVal }));
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleToggleDefault = (eventKey: NotificationEventKey) => {
    if (isGlobalEmailPaused) return;
    const currentVal = localOnboardingDefaults[eventKey] !== false;
    setLocalOnboardingDefaults((prev) => ({ ...prev, [eventKey]: !currentVal }));
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveAllGlobalSettings({
        assignments: localAssignments,
        systemwideActive: localSystemwideActive,
        onboardingDefaults: localOnboardingDefaults,
      });
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving global email settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmEmergencyAction = async () => {
    if (!confirmModalType) return;
    setIsProcessingStop(true);
    try {
      if (confirmModalType === "pause") {
        await onToggleGlobalEmergencyStop(true);
      } else {
        await onToggleGlobalEmergencyStop(false);
      }
      setConfirmModalType(null);
    } finally {
      setIsProcessingStop(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header: Title, Speichern & Global Not-Aus-Schalter */}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-2xs">
            <Mail className="w-4 h-4" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Globale E-Mail-Einstellungen
          </h3>
        </div>

        {/* Aktionen rechts: Speichern-Button & Globaler Not-Aus Schalter */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              hasUnsavedChanges
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/20"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
            title={hasUnsavedChanges ? "Änderungen an den globalen Einstellungen speichern" : "Keine ungespeicherten Änderungen"}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? "Gespeichert" : "Speichern"}</span>
          </button>

          {isGlobalEmailPaused ? (
            <button
              type="button"
              onClick={() => setConfirmModalType("resume")}
              disabled={isProcessingStop}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 animate-pulse"
              title="Klicken, um den E-Mail-Versand nach Bestätigung wieder zu aktivieren"
            >
              {isProcessingStop ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              <span>E-Mail-Versand pausiert (Reaktivieren)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmModalType("pause")}
              disabled={isProcessingStop}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 hover:border-red-200 border border-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Klicken, um den gesamten E-Mail-Versand des Vereins sofort zu stoppen (Not-Aus)"
            >
              <Power className="w-3.5 h-3.5 text-slate-500" />
              <span>E-Mail-Versand global pausieren</span>
            </button>
          )}
        </div>
      </div>

      {/* Pausierungs-Warnhinweis */}
      {isGlobalEmailPaused && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-900 flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            Der E-Mail-Versand ist derzeit klubweit vollständig pausiert (Not-Aus aktiv). Es werden keinerlei System-Mails versendet.
          </span>
        </div>
      )}

      {/* Bereinigte E-Mail Matrix */}
      <div className={`overflow-x-auto ${isGlobalEmailPaused ? "opacity-50 pointer-events-none" : ""}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/60">
              <th className="py-3 px-3 min-w-[200px]">E-Mail-Typ</th>
              <th className="py-3 px-3 text-center min-w-[170px]">Versand systemweit aktiv</th>
              <th className="py-3 px-3 text-center min-w-[170px]">Standard bei Registrierung</th>
              <th className="py-3 px-3 min-w-[240px]">Aktive Vorlage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NOTIFICATION_EVENT_DEFINITIONS.map((eventDef) => {
              const eventKey = eventDef.key;
              const isSysActive = localSystemwideActive[eventKey] !== false;
              const isOnbActive = localOnboardingDefaults[eventKey] !== false;
              const assignedTemplateId = localAssignments[eventKey] || "default_tmpl";

              return (
                <tr
                  key={eventKey}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    !isSysActive ? "bg-slate-50/40 text-slate-400" : ""
                  }`}
                >
                  {/* Spalte 1: E-Mail-Typ */}
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span className={!isSysActive ? "line-through text-slate-400" : ""}>
                        {eventDef.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {eventDef.description}
                    </div>
                  </td>

                  {/* Spalte 2: Versand systemweit aktiv (Schlichte Checkbox) */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSysActive}
                      disabled={isGlobalEmailPaused}
                      onChange={() => handleToggleEvent(eventKey)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                      title={
                        isSysActive
                          ? "Klicken zum systemweiten Deaktivieren"
                          : "Klicken zum systemweiten Aktivieren"
                      }
                    />
                  </td>

                  {/* Spalte 3: Standard bei Registrierung (Schlichte Checkbox) */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isOnbActive}
                      disabled={isGlobalEmailPaused || !isSysActive}
                      onChange={() => handleToggleDefault(eventKey)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        !isSysActive
                          ? "Inaktiv weil systemweit deaktiviert"
                          : isOnbActive
                          ? "Bei Neuanmeldung aktiv – Klicken zum Deaktivieren"
                          : "Bei Neuanmeldung inaktiv – Klicken zum Aktivieren"
                      }
                    />
                  </td>

                  {/* Spalte 4: Aktive Vorlage (Dropdown) */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2 max-w-sm">
                      <select
                        value={assignedTemplateId}
                        onChange={(e) => handleSelectChange(eventKey, e.target.value)}
                        disabled={isGlobalEmailPaused}
                        className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                      >
                        {availableTemplates.map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.name}
                          </option>
                        ))}
                      </select>

                      {onNavigateToEditor && (
                        <button
                          type="button"
                          onClick={() => onNavigateToEditor(assignedTemplateId)}
                          className="h-8 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title="Diese Vorlage im Designer bearbeiten"
                        >
                          <ExternalLink className="w-3 h-3" />
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

      {/* Unten: Ungespeicherte Änderungen Leiste */}
      {hasUnsavedChanges && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs animate-in fade-in">
          <span className="text-amber-600 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Ungespeicherte Änderungen an den globalen Einstellungen
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Änderungen speichern</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal für Not-Aus (Pause & Reaktivierung) */}
      {confirmModalType && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className={`flex items-center gap-3 ${confirmModalType === "pause" ? "text-red-600" : "text-emerald-700"}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${confirmModalType === "pause" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-800"}`}>
                {confirmModalType === "pause" ? <AlertTriangle className="w-5 h-5" /> : <Power className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  {confirmModalType === "pause"
                    ? "E-Mail-Versand global pausieren?"
                    : "E-Mail-Versand wieder aktivieren?"}
                </h4>
                <p className="text-xs text-slate-500">
                  {confirmModalType === "pause"
                    ? "Not-Aus für alle Benachrichtigungen"
                    : "Reaktivierung des Systemversands"}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModalType === "pause"
                ? "Möchtest du den gesamten E-Mail-Versand des Vereins wirklich pausieren? Es werden für kein einziges Ereignis (Buchungen, Stornierungen, Hobbyliga, Match-Ergebnisse) mehr E-Mails versendet, bis du die Funktion wieder reaktivierst."
                : "Möchtest du den E-Mail-Versand des Vereins wirklich wieder aktivieren? Alle System-E-Mails, deren Versand in der Matrix aktiv ist, werden ab sofort wieder regulär zugestellt."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModalType(null)}
                disabled={isProcessingStop}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmEmergencyAction}
                disabled={isProcessingStop}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  confirmModalType === "pause"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isProcessingStop && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmModalType === "pause"
                    ? "Ja, E-Mail-Versand pausieren"
                    : "Ja, E-Mail-Versand reaktivieren"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
