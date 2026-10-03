import React, { useState, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import {
  UserNotificationSettings,
  SystemwideNotificationSettings,
  NotificationEventKey,
} from "../../types/notifications";
import {
  DEFAULT_USER_NOTIFICATION_SETTINGS,
  DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS,
} from "../../services/notificationTemplates";
import {
  loadClubEmailTemplatesData,
  isEventGloballyActiveSync,
  isGlobalEmailPausedSync,
} from "../../services/emailTemplateStorage";

interface UserNotificationAccordionProps {
  settings?: UserNotificationSettings;
  onChange: (updatedSettings: UserNotificationSettings) => void;
  clubId?: string;
  primaryColor?: string;
}

interface EventItemConfig {
  key: NotificationEventKey;
  label: string;
  description: string;
}

// 5 Events in the exact order requested by user:
// 1. Buchungsbestätigung
// 2. Buchungsstornierung
// 3. Buchungsänderung
// 4. Neuer Hobbyligabeitrag
// 5. Matchergebnis eingetragen
const ORDERED_EVENT_ITEMS: EventItemConfig[] = [
  {
    key: "RESERVATION_CONFIRMED",
    label: "Buchungsbestätigung",
    description: "E-Mail unmittelbar nach erfolgreicher Platzreservierung erhalten.",
  },
  {
    key: "RESERVATION_CANCELLED",
    label: "Buchungsstornierung",
    description: "Benachrichtigung per E-Mail, wenn eine Buchung storniert wird.",
  },
  {
    key: "RESERVATION_MODIFIED",
    label: "Buchungsänderung",
    description: "E-Mail bei Änderungen an bestehenden Buchungen (Uhrzeit, Platz, Mitspieler).",
  },
  {
    key: "HOBBYLIGA_NEW_POST",
    label: "Neuer Hobbyligabeitrag",
    description: "Benachrichtigung bei neuen Beiträgen auf der Pinnwand der Hobbyliga.",
  },
  {
    key: "MATCH_RESULT_SUBMITTED",
    label: "Matchergebnis eingetragen",
    description: "Ergebnismitteilung, wenn dein Spielpartner ein Matchergebnis erfasst hat.",
  },
];

export const UserNotificationAccordion: React.FC<UserNotificationAccordionProps> = ({
  settings,
  onChange,
  clubId = "sv-neuhausen",
}) => {
  // Collapsed by default as requested
  const [isOpen, setIsOpen] = useState(false);

  // Club systemwide master status & emergency stop status
  const [systemwideActive, setSystemwideActive] = useState<SystemwideNotificationSettings>(() => {
    const initial: SystemwideNotificationSettings = { ...DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS };
    for (const item of ORDERED_EVENT_ITEMS) {
      initial[item.key] = isEventGloballyActiveSync(clubId, item.key);
    }
    return initial;
  });

  const [isGlobalEmailPaused, setIsGlobalEmailPaused] = useState<boolean>(() => {
    return isGlobalEmailPausedSync(clubId);
  });

  useEffect(() => {
    let isMounted = true;
    loadClubEmailTemplatesData(clubId).then((data) => {
      if (isMounted) {
        if (data.systemwideActive) {
          setSystemwideActive(data.systemwideActive);
        }
        setIsGlobalEmailPaused(data.isGlobalEmailPaused === true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [clubId]);

  // Current user preferences (default is true for all unless explicitly false)
  const currentSettings: UserNotificationSettings = {
    ...DEFAULT_USER_NOTIFICATION_SETTINGS,
    ...(settings || {}),
  };

  const handleToggle = (key: NotificationEventKey) => {
    // If deactivated globally by admin or paused, cannot toggle
    if (isGlobalEmailPaused || systemwideActive[key] === false) {
      return;
    }
    const currentVal = currentSettings[key] !== false;
    const updated = {
      ...currentSettings,
      [key]: !currentVal,
    };
    onChange(updated);
  };

  // Active count for indicator
  const activeCount = isGlobalEmailPaused
    ? 0
    : ORDERED_EVENT_ITEMS.filter((item) => {
        const isGlobal = systemwideActive[item.key] !== false;
        const isUser = currentSettings[item.key] !== false;
        return isGlobal && isUser;
      }).length;

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs transition-all">
      {/* Accordion Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 block truncate">
              Benachrichtigungen
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {isGlobalEmailPaused
                ? "E-Mail-Versand klubweit pausiert"
                : `${activeCount} von ${ORDERED_EVENT_ITEMS.length} E-Mailkategorien aktiv`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {isOpen ? "Zuklappen" : "Aufklappen"}
          </span>
          <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5 transition-transform" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 transition-transform" />
            )}
          </div>
        </div>
      </button>

      {/* Accordion Body Content */}
      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {isGlobalEmailPaused ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Der E-Mail-Versand ist vom Verein derzeit vollständig pausiert.</span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-snug">
              Wähle aus, für welche Ereignisse du E-Mails erhalten möchtest. Ist ein Typ vom Verein global deaktiviert, wird keine E-Mail versendet.
            </p>
          )}

          <div className="space-y-2">
            {ORDERED_EVENT_ITEMS.map((item) => {
              const isGloballyDisabled = isGlobalEmailPaused || systemwideActive[item.key] === false;
              const isUserEnabled = currentSettings[item.key] !== false;
              const isEffectiveActive = !isGloballyDisabled && isUserEnabled;

              return (
                <div
                  key={item.key}
                  onClick={() => !isGloballyDisabled && handleToggle(item.key)}
                  className={`p-3 rounded-xl border transition-all select-none ${
                    isGloballyDisabled
                      ? "bg-slate-50/70 border-slate-200/80 opacity-70 cursor-not-allowed"
                      : isUserEnabled
                      ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70 cursor-pointer"
                      : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isEffectiveActive}
                        disabled={isGloballyDisabled}
                        onChange={() => handleToggle(item.key)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold leading-tight ${
                            isGloballyDisabled ? "text-slate-500 line-through" : "text-slate-900"
                          }`}
                        >
                          {item.label}
                        </span>

                        {/* Admin Global Warning Badge */}
                        {isGlobalEmailPaused ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.2 rounded-md">
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            <span>(Der E-Mail-Versand ist vom Verein derzeit vollständig pausiert)</span>
                          </span>
                        ) : isGloballyDisabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.2 rounded-md">
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            <span>(Vom Verein derzeit global deaktiviert)</span>
                          </span>
                        ) : null}

                        {!isGloballyDisabled && isUserEnabled && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                            <Check className="w-2.5 h-2.5" />
                            Aktiv
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
