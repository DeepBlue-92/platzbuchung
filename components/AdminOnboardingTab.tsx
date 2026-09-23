import React, { useState, useEffect } from "react";
import {
  ClubSettings,
  DEFAULT_ONBOARDING_SETTINGS,
  saveSettings,
} from "../services/db";
import {
  User,
  ClubOnboardingSettings,
} from "../types";
import { MemberOnboardingModal } from "./MemberOnboardingModal";
import { OnboardingFieldMatrix } from "./onboarding/OnboardingFieldMatrix";
import { OnboardingBatchActions } from "./onboarding/OnboardingBatchActions";
import {
  CheckCircle2,
  Users,
  Eye,
  Save,
  AlertTriangle,
} from "lucide-react";

interface AdminOnboardingTabProps {
  settings: ClubSettings;
  currentClubId: string;
  users: Record<string, User>;
  onUpdateSettings: (updated: ClubSettings) => void;
  onUpdateUsers?: (updated: Record<string, User>) => void;
  primaryColor?: string;
}

export const AdminOnboardingTab: React.FC<AdminOnboardingTabProps> = ({
  settings,
  currentClubId,
  users,
  onUpdateSettings,
  onUpdateUsers,
  primaryColor = "var(--color-primary, #1b4332)",
}) => {
  const initialConfig: ClubOnboardingSettings = {
    ...DEFAULT_ONBOARDING_SETTINGS,
    ...(settings.club_onboarding_settings || {}),
  };

  const [config, setConfig] = useState<ClubOnboardingSettings>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sync state if settings prop changes from external source
  useEffect(() => {
    if (settings.club_onboarding_settings) {
      setConfig((prev) => ({
        ...DEFAULT_ONBOARDING_SETTINGS,
        ...settings.club_onboarding_settings,
      }));
    }
  }, [settings.club_onboarding_settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const updatedSettings: ClubSettings = {
        ...settings,
        club_onboarding_settings: config,
      };
      await saveSettings(currentClubId, updatedSettings);
      onUpdateSettings(updatedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error("Failed to save onboarding settings:", err);
      setSaveError(err.message || "Fehler beim Speichern der Onboarding-Einstellungen.");
      setTimeout(() => setSaveError(null), 6000);
    } finally {
      setIsSaving(false);
    }
  };

  const usersList = Object.values(users);
  const pendingCount = usersList.filter((u) => u.onboarding_pending).length;

  return (
    <div className="w-full space-y-4 lg:space-y-6 animate-in fade-in duration-300 pb-8">
      {/* Header card with status overview */}
      <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div>
            <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2">
              <i className="fa-solid fa-user-check"></i>{" "}
              Mitglieder-Onboarding
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              Konfiguration des Begrüßungs- & Datenüberprüfungs-Dialogs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="admin-onboarding-preview-btn"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] uppercase tracking-widest px-5 py-3 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>{previewOpen ? "Vorschau schließen" : "Vorschau anzeigen"}</span>
            </button>

            <button
              type="button"
              id="admin-onboarding-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[var(--color-primary)] hover:bg-black text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Änderungen speichern</span>
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              config.enable_onboarding
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                config.enable_onboarding ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>
              Onboarding: {config.enable_onboarding ? "Aktiviert" : "Deaktiviert"}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-slate-600 border border-slate-200 text-xs font-bold shadow-2xs">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Ausstehend bei <strong>{pendingCount}</strong> von <strong>{usersList.length}</strong> Mitgliedern
            </span>
          </div>

          {saveSuccess && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Einstellungen erfolgreich gespeichert!</span>
            </div>
          )}

          {saveError && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Preview Modal Overlay */}
      {previewOpen && (
        <MemberOnboardingModal
          currentUser={{
            id: "preview-user-id",
            name: "Max Mustermann",
            firstName: "Max",
            lastName: "Mustermann",
            role: "USER" as any,
            gender: "m",
            birthDate: "1990-06-15",
            email: "max.mustermann@example.com",
            avatarIcon: "initials",
          }}
          settings={{
            ...settings,
            primaryColor: primaryColor || settings.primaryColor,
            club_onboarding_settings: config,
          }}
          currentClubId={currentClubId}
          onSuccess={() => setPreviewOpen(false)}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {/* Section 1: Activation & Defaults */}
        <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
          <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
            <i className="fa-solid fa-sliders"></i>{" "}
            Aktivierung & Standard-Verhalten
          </h3>

          {/* Master Switch */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-[var(--color-primary)] transition-colors shadow-2xs">
            <div>
              <label
                htmlFor="toggle-enable-onboarding"
                className="text-xs font-black text-slate-800 uppercase tracking-wide cursor-pointer block"
              >
                Onboarding für Club aktivieren
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ist dieser Schalter aktiv, erscheint das Onboarding-Modal automatisch bei jedem Mitglied, das die Markierung &quot;Onboarding ausstehend&quot; im Benutzerprofil besitzt.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                id="toggle-enable-onboarding"
                type="checkbox"
                checked={config.enable_onboarding}
                onChange={(e) =>
                  setConfig({ ...config, enable_onboarding: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>

          {/* Auto-enable for new users */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-[var(--color-primary)] transition-colors shadow-2xs">
            <div>
              <label
                htmlFor="toggle-auto-new-users"
                className="text-xs font-black text-slate-800 uppercase tracking-wide cursor-pointer block"
              >
                Automatisch für neu erstellte Benutzer aktivieren
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Neu angelegte Mitglieder erhalten automatisch die Kennzeichnung &quot;Onboarding ausstehend&quot;, sodass sie beim Erst-Login direkt begrüßt werden.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                id="toggle-auto-new-users"
                type="checkbox"
                checked={config.auto_enable_for_new_users}
                onChange={(e) =>
                  setConfig({ ...config, auto_enable_for_new_users: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>
        </div>

        {/* Section 2: Visual & Text Customization */}
        <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
          <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
            <i className="fa-solid fa-font"></i>{" "}
            Texte & Begrüßung
          </h3>

          <div>
            <label
              htmlFor="welcome-title-input"
              className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5"
            >
              Begrüßungs-Überschrift (Signatur-Serifenschrift)
            </label>
            <input
              type="text"
              id="welcome-title-input"
              value={config.welcome_title}
              onChange={(e) =>
                setConfig({ ...config, welcome_title: e.target.value })
              }
              placeholder="Willkommen in unserem Tennis-Club!"
              className="w-full h-11 px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 font-serif font-bold transition-all shadow-2xs"
            />
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Wird im Modal mit der eleganten Vereins-Serifenschrift (Playfair Display) dargestellt.
            </p>
          </div>

          <div>
            <label
              htmlFor="welcome-desc-textarea"
              className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5"
            >
              Begleittext / Einleitung
            </label>
            <textarea
              id="welcome-desc-textarea"
              rows={4}
              value={config.welcome_description}
              onChange={(e) =>
                setConfig({ ...config, welcome_description: e.target.value })
              }
              placeholder="Wir freuen uns, dich auf unserer modernen Plattform zu begrüßen..."
              className="w-full p-3.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 leading-relaxed font-sans transition-all resize-none shadow-2xs"
            />
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Erklärt dem Mitglied den Zweck der Überprüfung der Stammdaten.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Field Permission Matrix */}
      <OnboardingFieldMatrix
        config={config}
        onChange={(key, val) => setConfig((prev) => ({ ...prev, [key]: val }))}
      />

      {/* Section 4: Batch Actions */}
      <OnboardingBatchActions
        currentClubId={currentClubId}
        users={users}
        onUpdateUsers={onUpdateUsers}
      />
    </div>
  );
};

export default AdminOnboardingTab;
