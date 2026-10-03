import React, { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { User } from "../../types";
import {
  NotificationEventKey,
  UserNotificationSettings,
  SystemwideNotificationSettings,
  EmailTemplate,
  EmailTemplateAssignments,
} from "../../types/notifications";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  DEFAULT_USER_NOTIFICATION_SETTINGS,
  DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS,
} from "../../services/notificationTemplates";
import {
  loadClubEmailTemplatesData,
  saveClubEmailTemplatesData,
} from "../../services/emailTemplateStorage";
import { EmailTemplateManager } from "./EmailTemplateManager";
import { GlobalEmailSettingsCard } from "./emailDesigner/GlobalEmailSettingsCard";
import { MemberNotificationsMatrix } from "./emailDesigner/MemberNotificationsMatrix";

interface AdminNotificationsManagementProps {
  users: Record<string, User>;
  currentUser?: User | null;
  currentClubId?: string;
  clubName?: string;
  onUpdateUsers?: (updated: Record<string, User>) => void;
  tenantColors?: string[];
}

export const AdminNotificationsManagement: React.FC<AdminNotificationsManagementProps> = ({
  users,
  currentUser,
  currentClubId = "sv-neuhausen",
  clubName = "Tennis-Club e.V.",
  onUpdateUsers,
  tenantColors,
}) => {
  // Tab-Reihenfolge: 1. E-Mail-Einstellungen (standardmäßig aktiv), 2. Nachrichtenvorlagen
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "templates">("settings");

  // Shared Email Templates & 1:1 Event-Zuweisung
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateAssignments, setTemplateAssignments] = useState<EmailTemplateAssignments>({});
  const [systemwideActive, setSystemwideActive] = useState<SystemwideNotificationSettings>(
    DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS
  );
  const [onboardingDefaults, setOnboardingDefaults] = useState<UserNotificationSettings>(
    DEFAULT_USER_NOTIFICATION_SETTINGS
  );
  const [isGlobalEmailPaused, setIsGlobalEmailPaused] = useState(false);
  const [activeEditingTemplateId, setActiveEditingTemplateId] = useState<string | null>(null);

  // Feedback Banner / Toast
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Load all club configurations
  useEffect(() => {
    let isMounted = true;
    loadClubEmailTemplatesData(currentClubId).then((data) => {
      if (isMounted) {
        setTemplates(data.templates);
        setTemplateAssignments(data.assignments);
        if (data.systemwideActive) {
          setSystemwideActive(data.systemwideActive);
        }
        if (data.onboardingDefaults) {
          setOnboardingDefaults(data.onboardingDefaults);
        }
        setIsGlobalEmailPaused(data.isGlobalEmailPaused === true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentClubId]);

  const handleUpdateTemplates = async (newTemplates: EmailTemplate[]) => {
    setTemplates(newTemplates);
    await saveClubEmailTemplatesData(
      currentClubId,
      newTemplates,
      templateAssignments,
      systemwideActive,
      onboardingDefaults,
      isGlobalEmailPaused
    );
  };

  const handleUpdateAssignments = async (newAssignments: EmailTemplateAssignments) => {
    setTemplateAssignments(newAssignments);
    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      newAssignments,
      systemwideActive,
      onboardingDefaults,
      isGlobalEmailPaused
    );
  };

  const handleUpdateSingleAssignment = async (
    eventKey: NotificationEventKey,
    templateId: string
  ) => {
    const next = { ...templateAssignments, [eventKey]: templateId };
    setTemplateAssignments(next);
    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      next,
      systemwideActive,
      onboardingDefaults,
      isGlobalEmailPaused
    );
    const def = NOTIFICATION_EVENT_DEFINITIONS.find((d) => d.key === eventKey);
    setFeedback({
      type: "success",
      text: `Aktive Vorlage für „${def?.label || eventKey}“ gespeichert.`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleSystemwide = async (
    eventKey: NotificationEventKey,
    enabled: boolean
  ) => {
    const next = { ...systemwideActive, [eventKey]: enabled };
    setSystemwideActive(next);
    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      templateAssignments,
      next,
      onboardingDefaults,
      isGlobalEmailPaused
    );

    const def = NOTIFICATION_EVENT_DEFINITIONS.find((d) => d.key === eventKey);
    const eventName = def?.label || eventKey;
    setFeedback({
      type: enabled ? "success" : "info",
      text: enabled
        ? `Versand für „${eventName}“ ist systemweit AKTIV.`
        : `E-Mail-Versand für „${eventName}“ klubweit DEAKTIVIERT.`,
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggleOnboardingDefault = async (
    eventKey: NotificationEventKey,
    enabled: boolean
  ) => {
    const next = { ...onboardingDefaults, [eventKey]: enabled };
    setOnboardingDefaults(next);
    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      templateAssignments,
      systemwideActive,
      next,
      isGlobalEmailPaused
    );

    const def = NOTIFICATION_EVENT_DEFINITIONS.find((d) => d.key === eventKey);
    setFeedback({
      type: "success",
      text: `Onboarding-Standard für „${def?.label || eventKey}“ aktualisiert (${
        enabled ? "Aktiv" : "Aus"
      }).`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveAllGlobalSettings = async (nextSettings: {
    assignments: EmailTemplateAssignments;
    systemwideActive: SystemwideNotificationSettings;
    onboardingDefaults: UserNotificationSettings;
  }) => {
    setTemplateAssignments(nextSettings.assignments);
    setSystemwideActive(nextSettings.systemwideActive);
    setOnboardingDefaults(nextSettings.onboardingDefaults);

    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      nextSettings.assignments,
      nextSettings.systemwideActive,
      nextSettings.onboardingDefaults,
      isGlobalEmailPaused
    );

    setFeedback({
      type: "success",
      text: "Globale E-Mail-Einstellungen erfolgreich gespeichert.",
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggleGlobalEmergencyStop = async (paused: boolean) => {
    setIsGlobalEmailPaused(paused);
    await saveClubEmailTemplatesData(
      currentClubId,
      templates,
      templateAssignments,
      systemwideActive,
      onboardingDefaults,
      paused
    );

    setFeedback({
      type: paused ? "error" : "success",
      text: paused
        ? "Not-Aus aktiviert: Der gesamte E-Mail-Versand des Vereins ist nun global pausiert."
        : "E-Mail-Versand wieder reaktiviert: System-Mails werden normal versendet.",
    });
    setTimeout(() => setFeedback(null), 4000);
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
                <span>Benachrichtigungen</span>
              </h2>
              <p className="text-xs text-slate-500">
                Nachrichtenvorlagen und E-Mail-Einstellungen
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar: E-Mail-Einstellungen zuerst, dann Nachrichtenvorlagen */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("settings")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "settings"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>E-Mail-Einstellungen</span>
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
          <span>Nachrichtenvorlagen</span>
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

      {/* REITER 1: E-MAIL-EINSTELLUNGEN (Zwei Bento-Bereiche) */}
      {activeSubTab === "settings" && (
        <div className="space-y-6">
          {/* Bereich 1 (oben): Globale E-Mail-Einstellungen */}
          <GlobalEmailSettingsCard
            templates={templates}
            assignments={templateAssignments}
            systemwideActive={systemwideActive}
            onboardingDefaults={onboardingDefaults}
            isGlobalEmailPaused={isGlobalEmailPaused}
            onSaveAllGlobalSettings={handleSaveAllGlobalSettings}
            onUpdateAssignment={handleUpdateSingleAssignment}
            onToggleSystemwide={handleToggleSystemwide}
            onToggleOnboardingDefault={handleToggleOnboardingDefault}
            onToggleGlobalEmergencyStop={handleToggleGlobalEmergencyStop}
            onNavigateToEditor={(templateId) => {
              setActiveEditingTemplateId(templateId);
              setActiveSubTab("templates");
            }}
          />

          {/* Bereich 2 (darunter): Individuelle Spieler-Benachrichtigungen (Massenverwaltung) */}
          <MemberNotificationsMatrix
            users={users}
            systemwideActive={systemwideActive}
            isGlobalEmailPaused={isGlobalEmailPaused}
            currentClubId={currentClubId}
            onUpdateUsers={onUpdateUsers}
          />
        </div>
      )}

      {/* REITER 2: NACHRICHTENVORLAGEN */}
      {activeSubTab === "templates" && (
        <EmailTemplateManager
          currentUser={currentUser}
          clubName={clubName}
          currentClubId={currentClubId}
          templates={templates}
          assignments={templateAssignments}
          activeEditingId={activeEditingTemplateId}
          setActiveEditingId={setActiveEditingTemplateId}
          onUpdateTemplates={handleUpdateTemplates}
          onUpdateAssignments={handleUpdateAssignments}
          tenantColors={tenantColors}
        />
      )}
    </div>
  );
};
