import React, { useState } from "react";
import {
  Mail,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Sparkles,
  Power,
  ShieldCheck,
  ShieldOff,
  UserCheck,
} from "lucide-react";
import {
  EmailTemplate,
  NotificationEventKey,
  EmailTemplateAssignments,
  SystemwideNotificationSettings,
  UserNotificationSettings,
} from "../../../types/notifications";
import { NOTIFICATION_EVENT_DEFINITIONS } from "../../../services/notificationTemplates";

interface EventTemplateAssignmentsProps {
  templates: EmailTemplate[];
  assignments: EmailTemplateAssignments;
  systemwideActive?: SystemwideNotificationSettings;
  onboardingDefaults?: UserNotificationSettings;
  onUpdateAssignment: (eventKey: NotificationEventKey, templateId: string) => Promise<void> | void;
  onToggleSystemwide?: (eventKey: NotificationEventKey, enabled: boolean) => Promise<void> | void;
  onToggleOnboardingDefault?: (eventKey: NotificationEventKey, enabled: boolean) => Promise<void> | void;
  onNavigateToEditor?: (templateId: string) => void;
  searchQuery?: string;
}

export const EventTemplateAssignments: React.FC<EventTemplateAssignmentsProps> = ({
  templates,
  assignments,
  systemwideActive = {},
  onboardingDefaults = {},
  onUpdateAssignment,
  onToggleSystemwide,
  onToggleOnboardingDefault,
  onNavigateToEditor,
  searchQuery = "",
}) => {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveSuccessKey, setSaveSuccessKey] = useState<string | null>(null);

  // Non-deleted templates
  const availableTemplates = templates.filter((t) => !t.deletedAt);

  const handleSelectChange = async (eventKey: NotificationEventKey, newTemplateId: string) => {
    setSavingKey(`assign_${eventKey}`);
    try {
      await onUpdateAssignment(eventKey, newTemplateId);
      setSaveSuccessKey(`assign_${eventKey}`);
      setTimeout(() => setSaveSuccessKey(null), 3000);
    } finally {
      setSavingKey(null);
    }
  };

  const handleMasterToggle = async (eventKey: NotificationEventKey, currentState: boolean) => {
    if (!onToggleSystemwide) return;
    const nextState = !currentState;
    setSavingKey(`master_${eventKey}`);
    try {
      await onToggleSystemwide(eventKey, nextState);
      setSaveSuccessKey(`master_${eventKey}`);
      setTimeout(() => setSaveSuccessKey(null), 3000);
    } finally {
      setSavingKey(null);
    }
  };

  const handleOnboardingToggle = async (eventKey: NotificationEventKey, currentState: boolean) => {
    if (!onToggleOnboardingDefault) return;
    const nextState = !currentState;
    setSavingKey(`onboarding_${eventKey}`);
    try {
      await onToggleOnboardingDefault(eventKey, nextState);
      setSaveSuccessKey(`onboarding_${eventKey}`);
      setTimeout(() => setSaveSuccessKey(null), 3000);
    } finally {
      setSavingKey(null);
    }
  };

  // Filter events by search query if provided
  const query = searchQuery.trim().toLowerCase();
  const filteredEvents = NOTIFICATION_EVENT_DEFINITIONS.filter((def) => {
    if (!query) return true;
    if (def.label.toLowerCase().includes(query)) return true;
    if (def.description.toLowerCase().includes(query)) return true;
    if (def.targetAudience.toLowerCase().includes(query)) return true;
    return false;
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              System-Events: E-Mail-Einstellungen & Kontroll-Matrix
            </h3>
            <p className="text-[11px] text-slate-600 font-medium">
              Zentrale Steuerung pro Event: Master-Kill-Switch (Systemweiter Versand), Onboarding-Standard für Neumitglieder und 1:1 Design-Zuweisung.
            </p>
          </div>
        </div>

        <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-3 py-1 rounded-xl self-start sm:self-auto flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Änderungen werden sofort gespeichert</span>
        </div>
      </div>

      {/* Event Rows */}
      <div className="divide-y divide-slate-100">
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Keine E-Mail-Typen passend zu „{searchQuery}“ gefunden.
          </div>
        ) : (
          filteredEvents.map((def) => {
            const matchingTemplates = availableTemplates.filter(
              (t) => t.eventType === def.key
            );
            const currentAssignedId = assignments[def.key] || "";
            const assignedTemplate = availableTemplates.find(
              (t) => t.id === currentAssignedId
            );

            const isMasterActive = systemwideActive[def.key] !== false;
            const isOnboardingDefault = onboardingDefaults[def.key] !== false;

            const isSavingAssign = savingKey === `assign_${def.key}`;
            const isSavingMaster = savingKey === `master_${def.key}`;
            const isSavingOnboarding = savingKey === `onboarding_${def.key}`;

            const isSuccessAssign = saveSuccessKey === `assign_${def.key}`;
            const isSuccessMaster = saveSuccessKey === `master_${def.key}`;
            const isSuccessOnboarding = saveSuccessKey === `onboarding_${def.key}`;

            return (
              <div
                key={def.key}
                className={`py-4 px-3 rounded-2xl transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                  !isMasterActive
                    ? "bg-slate-50/80 border border-slate-200/60 opacity-90"
                    : "hover:bg-slate-50/60"
                }`}
              >
                {/* 1. Event Info */}
                <div className="space-y-1 xl:max-w-xs shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {def.label}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {def.targetAudience}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {def.description}
                  </p>
                </div>

                {/* 2. Controls Grid / Container */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1 justify-start xl:justify-end">
                  {/* Master Kill-Switch Checkbox */}
                  <div
                    className={`flex items-center gap-2.5 p-2 sm:px-3 sm:py-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isMasterActive
                        ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-950"
                        : "bg-red-50/60 border-red-200 text-red-950"
                    }`}
                    onClick={() => handleMasterToggle(def.key, isMasterActive)}
                    title={
                      isMasterActive
                        ? "Klicken, um den E-Mail-Versand für dieses Event vereinsweit komplett abzuschalten (Master-Kill-Switch)"
                        : "Klicken, um den systemweiten E-Mail-Versand wieder einzuschalten"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isMasterActive}
                      onChange={() => {}} // handled by parent div
                      disabled={isSavingMaster}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                    />
                    <div className="text-left">
                      <div className="text-[11px] font-black flex items-center gap-1.5 leading-tight">
                        {isMasterActive ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Versand systemweit aktiv</span>
                          </>
                        ) : (
                          <>
                            <ShieldOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span className="text-red-700">Systemweit deaktiviert</span>
                          </>
                        )}
                        {isSavingMaster && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
                        {isSuccessMaster && <CheckCircle2 className="w-3 h-3 text-emerald-600 animate-in fade-in" />}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-500">
                        {isMasterActive ? "Master-Aktiv" : "Keine E-Mails klubweit"}
                      </div>
                    </div>
                  </div>

                  {/* Onboarding Default Toggle */}
                  {onToggleOnboardingDefault && (
                    <div
                      className={`flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl border transition-all cursor-pointer select-none ${
                        isOnboardingDefault
                          ? "bg-slate-50 border-slate-200/90 text-slate-800"
                          : "bg-slate-50/50 border-slate-200/50 text-slate-400"
                      }`}
                      onClick={() => handleOnboardingToggle(def.key, isOnboardingDefault)}
                      title="Legt fest, ob dieses Event bei neu registrierten Mitgliedern automatisch im Profil voreingestellt ist"
                    >
                      <UserCheck className={`w-3.5 h-3.5 ${isOnboardingDefault ? "text-emerald-600" : "text-slate-400"}`} />
                      <div className="text-left">
                        <div className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                          <span>Bei Neuregistrierung:</span>
                          <span className={`text-[10px] font-extrabold ${isOnboardingDefault ? "text-emerald-700" : "text-slate-500"}`}>
                            {isOnboardingDefault ? "Aktiv" : "Aus"}
                          </span>
                          {isSavingOnboarding && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
                          {isSuccessOnboarding && <CheckCircle2 className="w-3 h-3 text-emerald-600 animate-in fade-in" />}
                        </div>
                        <div className="text-[9px] text-slate-400">Onboarding-Default</div>
                      </div>
                    </div>
                  )}

                  {/* Active Template Selector */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <select
                        value={currentAssignedId}
                        disabled={isSavingAssign || matchingTemplates.length === 0}
                        onChange={(e) => handleSelectChange(def.key, e.target.value)}
                        className={`w-52 sm:w-60 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shadow-2xs cursor-pointer ${
                          isSavingAssign
                            ? "bg-slate-100 border-slate-300 text-slate-400"
                            : "bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                        }`}
                        title="Zugeordnete Vorlage auswählen"
                      >
                        {matchingTemplates.length === 0 ? (
                          <option value="">Keine Vorlage verfügbar</option>
                        ) : (
                          matchingTemplates.map((tmpl) => (
                            <option key={tmpl.id} value={tmpl.id}>
                              {tmpl.name}
                            </option>
                          ))
                        )}
                      </select>

                      {isSavingAssign && (
                        <div className="absolute right-2.5 top-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        </div>
                      )}
                    </div>

                    {/* Edit Link if navigation callback provided */}
                    {assignedTemplate && onNavigateToEditor && (
                      <button
                        type="button"
                        onClick={() => onNavigateToEditor(assignedTemplate.id)}
                        className="p-1.5 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                        title="Vorlage im visuellen Editor anpassen"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isSuccessAssign && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5 animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
