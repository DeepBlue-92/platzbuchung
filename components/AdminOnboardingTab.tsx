import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  ClubSettings,
  DEFAULT_ONBOARDING_SETTINGS,
  saveSettings,
  saveUser,
} from "../services/db";
import {
  User,
  ClubOnboardingSettings,
  OnboardingFieldPermission,
  OnboardingPasswordFieldPermission,
} from "../types";
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Users,
  Eye,
  Lock,
  Edit3,
  Sliders,
  Type,
  AlignLeft,
  RotateCcw,
  Save,
  HelpCircle,
  AlertTriangle,
  Play,
  Film,
  KeyRound,
  Calendar,
  UserCheck,
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
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResettingBatch, setIsResettingBatch] = useState(false);
  const [resetSuccessCount, setResetSuccessCount] = useState<number | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
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

  const handleBatchReset = async () => {
    setIsResettingBatch(true);
    setResetError(null);
    try {
      const userList = Object.values(users);
      let count = 0;
      const updatedUsersMap: Record<string, User> = { ...users };

      for (const u of userList) {
        // Only reset for real member users
        const updated: User = {
          ...u,
          onboarding_pending: true,
        };
        await saveUser(currentClubId, updated);
        const key = u.id || u.name;
        updatedUsersMap[key] = updated;
        count++;
      }

      if (onUpdateUsers) {
        onUpdateUsers(updatedUsersMap);
      }
      setResetSuccessCount(count);
      setShowResetConfirmModal(false);
      setTimeout(() => setResetSuccessCount(null), 5000);
    } catch (err: any) {
      console.error("Failed to batch reset onboarding:", err);
      setResetError(err.message || "Fehler beim Zurücksetzen des Onboardings.");
      setTimeout(() => setResetError(null), 6000);
    } finally {
      setIsResettingBatch(false);
    }
  };

  const usersList = Object.values(users);
  const pendingCount = usersList.filter((u) => u.onboarding_pending).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header card with status overview */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Mitglieder-Onboarding System
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Konfiguriere den Begrüßungs- und Datenüberprüfungs-Dialog für eure Vereinsmitglieder beim ersten oder nächsten Login.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="admin-onboarding-preview-btn"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>{previewOpen ? "Vorschau schließen" : "Vorschau anzeigen"}</span>
            </button>

            <button
              type="button"
              id="admin-onboarding-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[var(--color-primary,#1b4332)] hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Änderungen speichern</span>
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
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
              Onboarding: {config.enable_onboarding ? "Aktiviert (Master Switch AN)" : "Deaktiviert (Master Switch AUS)"}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium">
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

          {resetSuccessCount !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Onboarding für {resetSuccessCount} Mitglieder aktiviert!</span>
            </div>
          )}

          {resetError && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{resetError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Preview Drawer / Accordion */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-slate-900/5 border-2 border-dashed border-slate-300 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Live-Vorschau des Onboarding-Modals</span>
              </div>
              <span className="text-xs text-slate-500">
                Schriftart Überschrift: <strong>Playfair Display (Serif)</strong>
              </span>
            </div>

            {/* Modal Mockup Preview */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl mx-auto overflow-hidden p-6 sm:p-8">
              {config.show_animation && (
                <div className="flex justify-center mb-2">
                  <div className="w-24 h-24 flex items-center justify-center">
                    <DotLottieReact
                      src="/assets/animations/tennis-welcome.json"
                      loop
                      autoplay
                    />
                  </div>
                </div>
              )}

              <h3 className="font-serif text-2xl font-bold text-slate-900 text-center tracking-tight">
                {config.welcome_title || "Willkommen in unserem Tennis-Club!"}
              </h3>
              <p className="font-sans text-xs sm:text-sm text-slate-600 text-center mt-2 leading-relaxed max-w-md mx-auto">
                {config.welcome_description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {config.field_name !== "HIDDEN" && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-2">
                      <span>Name</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {config.field_name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400">
                        Max
                      </div>
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400">
                        Mustermann
                      </div>
                    </div>
                  </div>
                )}

                {config.field_demographics !== "HIDDEN" && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-2">
                      <span>Demographie</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {config.field_demographics}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400">
                        15.06.1988
                      </div>
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400">
                        Männlich
                      </div>
                    </div>
                    {config.field_demographics === "READ_ONLY" && (
                      <div className="mt-2 text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <i className="fa-solid fa-circle-info text-blue-400"></i>
                        <span>Stammdaten zur Liga-Zuordnung. Änderungen bitte über den Administrator anfragen.</span>
                      </div>
                    )}
                  </div>
                )}

                {config.field_avatar !== "HIDDEN" && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:col-span-2">
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                      <span>Profilbild & Avatar</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {config.field_avatar}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Avatar-Auswahl oder Upload (&lt; 25 KB)</p>
                  </div>
                )}

                {config.field_password !== "HIDDEN" && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:col-span-2">
                    <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                      <span>Passwort festlegen</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {config.field_password}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400 font-mono">
                        ••••••••
                      </div>
                      <div className="h-8 bg-white border border-slate-200 rounded-lg px-2 flex items-center text-slate-400 font-mono">
                        ••••••••
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Activation & Defaults */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Aktivierung & Standard-Verhalten
            </h3>
          </div>

          {/* Master Switch */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label
                htmlFor="toggle-enable-onboarding"
                className="text-sm font-bold text-slate-900 cursor-pointer block"
              >
                Onboarding für Club aktivieren (Master Switch)
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ist dieser Schalter aktiv, erscheint das Onboarding-Modal automatisch bei jedem Mitglied, das die Markierung "onboarding_pending" besitzt.
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
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label
                htmlFor="toggle-auto-new-users"
                className="text-sm font-bold text-slate-900 cursor-pointer block"
              >
                Automatisch für neu erstellte Benutzer aktivieren
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Neu angelegte Mitglieder erhalten automatisch die Kennzeichnung "Onboarding ausstehend", sodass sie beim Erst-Login direkt begrüßt werden.
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

          {/* Show Animation Switch */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label
                htmlFor="toggle-show-animation"
                className="text-sm font-bold text-slate-900 cursor-pointer block flex items-center gap-2"
              >
                <Film className="w-4 h-4 text-emerald-600" />
                <span>Tennis Lottie-Animation anzeigen</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Zeigt im Kopfbereich des Modals die lokale Vektor-Animation{" "}
                <code className="bg-slate-200/70 text-[11px] px-1 py-0.5 rounded font-mono">
                  public/assets/animations/tennis-welcome.json
                </code>
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                id="toggle-show-animation"
                type="checkbox"
                checked={config.show_animation}
                onChange={(e) =>
                  setConfig({ ...config, show_animation: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>
        </div>

        {/* Section 2: Visual & Text Customization */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Type className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Texte & Begrüßung
            </h3>
          </div>

          <div>
            <label
              htmlFor="welcome-title-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
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
              className="w-full h-11 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 font-serif font-bold transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Wird im Modal mit der eleganten Vereins-Serifenschrift (Playfair Display) dargestellt.
            </p>
          </div>

          <div>
            <label
              htmlFor="welcome-desc-textarea"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
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
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 leading-relaxed font-sans transition-all resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Erklärt dem Mitglied den Zweck der Überprüfung der Stammdaten.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Field Permission Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Feld-Berechtigungsmatrix (Admin Matrix)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Bestimmt, wie jedes Bento-Feld dem Mitglied dargestellt wird
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Field 1: Name */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Vorname & Nachname
                </h4>
                <p className="text-[11px] text-slate-500">
                  Klarname des Mitglieds
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
              {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
                (perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => setConfig({ ...config, field_name: perm })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      config.field_name === perm
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {perm === "HIDDEN"
                      ? "Ausgeblendet"
                      : perm === "READ_ONLY"
                      ? "Nur Lesen"
                      : "Bearbeitbar"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Field 2: Demographics */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Demographie
                </h4>
                <p className="text-[11px] text-slate-500">
                  Geburtsdatum und Geschlecht
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
              {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
                (perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, field_demographics: perm })
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      config.field_demographics === perm
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {perm === "HIDDEN"
                      ? "Ausgeblendet"
                      : perm === "READ_ONLY"
                      ? "Nur Lesen"
                      : "Bearbeitbar"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Field 3: Avatar */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Profilbild & Avatar-Icon
                </h4>
                <p className="text-[11px] text-slate-500">
                  Avatar-Uploader oder Vektor-Icon
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
              {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
                (perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => setConfig({ ...config, field_avatar: perm })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      config.field_avatar === perm
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {perm === "HIDDEN"
                      ? "Ausgeblendet"
                      : perm === "READ_ONLY"
                      ? "Nur Lesen"
                      : "Bearbeitbar"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Field 4: Password */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Passwort festlegen
                </h4>
                <p className="text-[11px] text-slate-500">
                  Optionale Passwortänderung im Onboarding
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
              {(["HIDDEN", "EDITABLE"] as OnboardingPasswordFieldPermission[]).map(
                (perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, field_password: perm })
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      config.field_password === perm
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {perm === "HIDDEN" ? "Ausgeblendet" : "Bearbeitbar (Aktiv)"}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Batch Action */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-amber-700" />
            <span>Stapelverarbeitung: Onboarding für alle Mitglieder erzwingen</span>
          </div>
          <p className="text-xs text-amber-800/80 leading-relaxed max-w-xl">
            Setzt den Status aller {usersList.length} Mitglieder dieses Vereins auf{" "}
            <strong>onboarding_pending = true</strong>. Dadurch werden alle Mitglieder bei ihrem nächsten Login aufgefordert, den Bestätigungs-Dialog zu durchlaufen.
          </p>
        </div>

        <button
          type="button"
          id="admin-batch-reset-onboarding-btn"
          onClick={() => setShowResetConfirmModal(true)}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all active:scale-98 shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Für alle Mitglieder zurücksetzen</span>
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Onboarding für alle zurücksetzen?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Möchtest du das Onboarding wirklich für alle{" "}
                  <strong>{usersList.length} Mitglieder</strong> des Vereins zurücksetzen?
                  Jedes Mitglied wird beim nächsten Login das Begrüßungsfenster sehen und seine Daten bestätigen müssen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  disabled={isResettingBatch}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  id="confirm-batch-reset-btn"
                  onClick={handleBatchReset}
                  disabled={isResettingBatch}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isResettingBatch ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Ja, zurücksetzen</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOnboardingTab;
