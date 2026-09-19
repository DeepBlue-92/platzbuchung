import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  User,
  Gender,
  ClubOnboardingSettings,
} from "../types";
import { saveUser, ClubSettings } from "../services/db";
import { OnboardingHero } from "./onboarding/OnboardingHero";
import { OnboardingBentoCards } from "./onboarding/OnboardingBentoCards";
import { AlertCircle, ArrowRight } from "lucide-react";

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

  // Checkbox: "Diesen Hinweis nicht mehr anzeigen", default: unchecked (false)
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              klarname: `${firstName.trim()} ${lastName.trim()}`.trim() || currentUser.name,
            }
          : {}),
        ...(fieldDemographics === "EDITABLE"
          ? {
              gender: gender || "m",
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

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        id="member-onboarding-modal"
        className="w-full md:max-w-4xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto flex flex-col max-h-[92vh] md:max-h-[85vh]"
      >
        <div className="flex flex-col md:grid md:grid-cols-12 md:gap-8 items-center p-5 sm:p-7 lg:p-8 overflow-hidden h-full">
          {/* LEFT COLUMN (Hero / Welcome - md:col-span-5) */}
          <div className="w-full md:col-span-5 mb-4 md:mb-0">
            <OnboardingHero
              welcomeTitle={onboardingConfig.welcome_title}
              welcomeDescription={onboardingConfig.welcome_description}
              primaryColor={primaryColor}
              showAnimation={onboardingConfig.show_animation !== false}
            />
          </div>

          {/* RIGHT COLUMN (Form & Bento Cards - md:col-span-7) */}
          <form
            onSubmit={handleSubmit}
            className="w-full md:col-span-7 flex flex-col h-full overflow-hidden"
          >
            {errorMessage && (
              <div className="mb-3 p-3 bg-red-50/90 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Scrollable form container */}
            <div className="overflow-y-auto max-h-[calc(85vh-100px)] pr-2 py-1">
              <OnboardingBentoCards
                currentUser={currentUser}
                fieldName={fieldName}
                fieldDemographics={fieldDemographics}
                fieldAvatar={fieldAvatar}
                fieldPassword={fieldPassword}
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                gender={gender}
                setGender={setGender}
                birthDate={birthDate}
                setBirthDate={setBirthDate}
                avatarUrl={avatarUrl}
                setAvatarUrl={setAvatarUrl}
                avatarIcon={avatarIcon}
                setAvatarIcon={setAvatarIcon}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                primaryColor={primaryColor}
              />
            </div>

            {/* Footer with confirmation checkbox (default: unchecked) and CTA */}
            <div className="pt-3.5 mt-auto border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group w-full sm:w-auto">
                <input
                  type="checkbox"
                  id="onboarding-confirm-checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-700 group-hover:text-slate-900">
                  Diesen Hinweis nicht mehr anzeigen
                </span>
              </label>

              <button
                type="submit"
                id="onboarding-submit-button"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--color-primary,#1b4332)] hover:bg-black text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default MemberOnboardingModal;
