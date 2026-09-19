import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  User,
  Gender,
  ClubOnboardingSettings,
} from "../types";
import { saveUser, ClubSettings } from "../services/db";
import { AvatarUploader } from "./AvatarUploader";
import { UserAvatar } from "./UserAvatar";
import {
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Calendar,
  Sparkles,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface MemberOnboardingModalProps {
  currentUser: User;
  settings: ClubSettings;
  currentClubId: string;
  onSuccess: (updatedUser: User) => void;
  onClose?: () => void;
}

export const MemberOnboardingModal: React.FC<MemberOnboardingModalProps> = ({
  currentUser,
  settings,
  currentClubId,
  onSuccess,
  onClose,
}) => {
  const onboardingConfig: ClubOnboardingSettings = settings.club_onboarding_settings || {
    enable_onboarding: false,
    auto_enable_for_new_users: true,
    welcome_title: "Willkommen in unserem Tennis-Club!",
    welcome_description:
      "Wir freuen uns, dich auf unserer modernen Plattform zu begrüßen. Bitte nimm dir kurz Zeit, deine Stammdaten zu überprüfen und bei Bedarf zu aktualisieren.",
    show_animation: true,
    field_name: "EDITABLE",
    field_demographics: "READ_ONLY",
    field_avatar: "EDITABLE",
    field_password: "EDITABLE",
  };

  // Form states initialized with currentUser data
  const [firstName, setFirstName] = useState(currentUser.firstName || "");
  const [lastName, setLastName] = useState(currentUser.lastName || "");
  const [gender, setGender] = useState<Gender>(currentUser.gender || "m");
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl || null);
  const [avatarIcon, setAvatarIcon] = useState<string | null>(currentUser.avatarIcon || "initials");

  // Password fields (only relevant if field_password === 'EDITABLE')
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Checkbox: "Angaben bestätigt – diesen Hinweis nicht mehr anzeigen"
  const [confirmChecked, setConfirmChecked] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lottieFailed, setLottieFailed] = useState(false);

  const primaryColor = settings.primaryColor || "var(--color-primary, #1b4332)";

  // Field permissions
  const fieldName = onboardingConfig.field_name;
  const fieldDemographics = onboardingConfig.field_demographics;
  const fieldAvatar = onboardingConfig.field_avatar;
  const fieldPassword = onboardingConfig.field_password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate passwords if password reset is allowed and user entered one
    if (fieldPassword === "EDITABLE" && (newPassword || confirmPassword)) {
      if (newPassword.length < 6) {
        setErrorMessage("Das neue Passwort muss mindestens 6 Zeichen lang sein.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("Die Passwörter stimmen nicht überein.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updatedUser: User = {
        ...currentUser,
        ...(fieldName === "EDITABLE"
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              klarname: `${firstName.trim()} ${lastName.trim()}`.trim() || currentUser.name,
            }
          : {}),
        ...(fieldDemographics === "EDITABLE"
          ? {
              gender,
              birthDate: birthDate ? birthDate.trim() : null,
            }
          : {}),
        ...(fieldAvatar === "EDITABLE"
          ? {
              avatarUrl: avatarUrl || null,
              avatarIcon: avatarIcon || "initials",
            }
          : {}),
        ...(fieldPassword === "EDITABLE" && newPassword
          ? {
              password: newPassword,
              mustChangePassword: false,
            }
          : {}),
        // If checkbox is checked, disable further onboarding
        onboarding_pending: !confirmChecked,
      };

      await saveUser(currentClubId, updatedUser);
      onSuccess(updatedUser);
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Fehler beim Speichern der Onboarding-Daten. Bitte versuche es erneut."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="member-onboarding-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        id="member-onboarding-modal"
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="pt-7 pb-5 px-6 sm:px-8 bg-gradient-to-b from-slate-50/90 to-white border-b border-slate-100 flex-shrink-0 text-center">
          {/* Lottie Animation Header */}
          {onboardingConfig.show_animation && (
            <div className="flex justify-center mb-1">
              {!lottieFailed ? (
                <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                  <DotLottieReact
                    src="/assets/animations/tennis-welcome.json"
                    loop
                    autoplay
                    onError={() => setLottieFailed(true)}
                  />
                </div>
              ) : (
                /* Elegant vector fallback if Lottie file fails to load */
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner mb-2"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Sparkles
                    className="w-10 h-10"
                    style={{ color: primaryColor }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Welcome Headline in Signature Serif Font */}
          <h2
            id="onboarding-welcome-title"
            className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight mt-1"
          >
            {onboardingConfig.welcome_title || "Willkommen in unserem Tennis-Club!"}
          </h2>

          {/* Introductory Body Text in Clean Sans Font */}
          <p
            id="onboarding-welcome-desc"
            className="font-sans text-sm sm:text-base text-slate-600 leading-relaxed mt-2 max-w-xl mx-auto"
          >
            {onboardingConfig.welcome_description ||
              "Wir freuen uns, dich auf unserer modernen Buchungsplattform zu begrüßen. Bitte nimm dir kurz Zeit, deine Stammdaten zu überprüfen und bei Bedarf zu aktualisieren."}
          </p>
        </div>

        {/* Scrollable Bento Grid Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6"
        >
          {errorMessage && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bento-Grid Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bento Card 1: Name */}
            {fieldName !== "HIDDEN" && (
              <div
                id="bento-card-name"
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  fieldName === "READ_ONLY"
                    ? "bg-slate-50/80 border-slate-200/80"
                    : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>Persönlicher Name</span>
                  </div>
                  {fieldName === "READ_ONLY" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />
                      Schreibgeschützt
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Vorname
                    </label>
                    <input
                      type="text"
                      disabled={fieldName === "READ_ONLY"}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Vorname"
                      className={`w-full h-10 px-3 py-2 rounded-xl text-sm transition-all outline-none ${
                        fieldName === "READ_ONLY"
                          ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium"
                          : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nachname
                    </label>
                    <input
                      type="text"
                      disabled={fieldName === "READ_ONLY"}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Nachname"
                      className={`w-full h-10 px-3 py-2 rounded-xl text-sm transition-all outline-none ${
                        fieldName === "READ_ONLY"
                          ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium"
                          : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                      }`}
                    />
                  </div>
                </div>
                {fieldName === "READ_ONLY" && (
                  <div className="mt-3 text-[11px] text-slate-500 font-medium px-1 flex items-start gap-1.5">
                    <i className="fa-solid fa-circle-info mt-0.5 text-blue-500"></i>
                    <span>Stammdaten zur Liga-Zuordnung. Änderungen bitte über den Administrator anfragen.</span>
                  </div>
                )}
              </div>
            )}

            {/* Bento Card 2: Demographics */}
            {fieldDemographics !== "HIDDEN" && (
              <div
                id="bento-card-demographics"
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  fieldDemographics === "READ_ONLY"
                    ? "bg-slate-50/80 border-slate-200/80"
                    : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>Demographie</span>
                  </div>
                  {fieldDemographics === "READ_ONLY" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />
                      Schreibgeschützt
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Geburtsdatum
                    </label>
                    <input
                      type="date"
                      disabled={fieldDemographics === "READ_ONLY"}
                      value={birthDate || ""}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className={`w-full h-10 px-3 py-2 rounded-xl text-sm transition-all outline-none ${
                        fieldDemographics === "READ_ONLY"
                          ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium"
                          : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Geschlecht
                    </label>
                    <select
                      disabled={fieldDemographics === "READ_ONLY"}
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className={`w-full h-10 px-3 py-2 rounded-xl text-sm transition-all outline-none ${
                        fieldDemographics === "READ_ONLY"
                          ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium"
                          : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium cursor-pointer"
                      }`}
                    >
                      <option value="m">männlich</option>
                      <option value="w">weiblich</option>
                    </select>
                  </div>
                </div>

                {fieldDemographics === "READ_ONLY" && (
                  <div className="mt-3 text-[11px] text-slate-500 font-medium px-1 flex items-start gap-1.5">
                    <i className="fa-solid fa-circle-info mt-0.5 text-blue-500"></i>
                    <span>Stammdaten zur Liga-Zuordnung. Änderungen bitte über den Administrator anfragen.</span>
                  </div>
                )}
              </div>
            )}

            {/* Bento Card 3: Avatar / Profilbild */}
            {fieldAvatar !== "HIDDEN" && (
              <div
                id="bento-card-avatar"
                className={`p-5 rounded-2xl border md:col-span-2 transition-all duration-200 ${
                  fieldAvatar === "READ_ONLY"
                    ? "bg-slate-50/80 border-slate-200/80"
                    : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-slate-500" />
                    <span>Profilbild & Avatar-Icon</span>
                  </div>
                  {fieldAvatar === "READ_ONLY" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />
                      Schreibgeschützt
                    </span>
                  )}
                </div>

                {fieldAvatar === "READ_ONLY" ? (
                  <div className="flex items-center gap-4 py-2">
                    <UserAvatar
                      user={{
                        name: currentUser.name,
                        klarname: currentUser.klarname,
                        avatarUrl: currentUser.avatarUrl,
                        avatarIcon: currentUser.avatarIcon,
                      }}
                      size="lg"
                    />
                    <div className="text-xs text-slate-500">
                      <p className="font-bold text-slate-700">Aktuelles Profilbild</p>
                      <p>Änderungen können vom Club-Administrator verwaltet werden.</p>
                    </div>
                  </div>
                ) : (
                  <AvatarUploader
                    user={{
                      ...currentUser,
                      avatarUrl,
                      avatarIcon,
                    }}
                    userId={currentUser.id || currentUser.name}
                    avatarUrl={avatarUrl}
                    avatarIcon={avatarIcon}
                    onChange={({ avatarUrl: newUrl, avatarIcon: newIcon }) => {
                      if (newUrl !== undefined) {
                        setAvatarUrl(newUrl);
                        if (newUrl) setAvatarIcon(null);
                      }
                      if (newIcon !== undefined) {
                        setAvatarIcon(newIcon);
                        if (newIcon) setAvatarUrl(null);
                      }
                    }}
                    primaryColor={primaryColor}
                  />
                )}
              </div>
            )}

            {/* Bento Card 4: Password Reset */}
            {fieldPassword !== "HIDDEN" && (
              <div
                id="bento-card-password"
                className="p-5 rounded-2xl border bg-white border-slate-200 shadow-sm md:col-span-2 hover:border-slate-300 transition-all duration-200"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-slate-500" />
                    <span>Passwort festlegen (Optional)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Nur ausfüllen, wenn du dein Passwort ändern möchtest
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 font-mono transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Passwort wiederholen
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-sm text-slate-900 font-mono transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Section with Checkbox and Action CTA */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none group w-full sm:w-auto">
              <input
                type="checkbox"
                id="onboarding-confirm-checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 group-hover:text-slate-900">
                Angaben bestätigt – diesen Hinweis nicht mehr anzeigen
              </span>
            </label>

            <button
              type="submit"
              id="onboarding-submit-button"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[var(--color-primary,#1b4332)] hover:bg-black text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Wird gespeichert...</span>
                </>
              ) : (
                <>
                  <span>Bestätigen & Weiter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default MemberOnboardingModal;
