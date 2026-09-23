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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lock body and html scroll when modal is active to completely prevent background page movement
  React.useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // Non-passive wheel handler on the window or backdrop to cancel any background scroll attempts
    const preventBackgroundWheel = (e: WheelEvent) => {
      const modalEl = document.getElementById("member-onboarding-modal");
      if (!modalEl) {
        e.preventDefault();
        return;
      }
      // If the wheel event target is outside the modal card, prevent default
      if (!modalEl.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }

      // If inside the modal, only allow scrolling inside scrollable containers
      let target = e.target as HTMLElement | null;
      let canScroll = false;
      while (target && target !== modalEl) {
        if (target.scrollHeight > target.clientHeight) {
          const style = window.getComputedStyle(target);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            // Check if scrolling up at top or scrolling down at bottom
            const isAtTop = target.scrollTop <= 0 && e.deltaY < 0;
            const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1 && e.deltaY > 0;
            if (!isAtTop && !isAtBottom) {
              canScroll = true;
              break;
            }
          }
        }
        target = target.parentElement;
      }

      if (!canScroll) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventBackgroundWheel, { passive: false });
    window.addEventListener("touchmove", preventBackgroundWheel, { passive: false });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("wheel", preventBackgroundWheel);
      window.removeEventListener("touchmove", preventBackgroundWheel);
    };
  }, []);

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
      if (newPassword.length < 8) {
        setErrorMessage("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
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
        // By confirming, onboarding is marked as completed
        onboarding_pending: false,
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

  const handleRemindLater = () => {
    if (onClose) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
      onWheel={(e) => {
        // Prevent mouse wheel outside the modal card from scrolling anything behind
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        id="member-onboarding-modal"
        className="w-full md:max-w-4xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto flex flex-col max-h-[95vh] md:max-h-[90vh]"
      >
        <div className="flex flex-col md:grid md:grid-cols-12 md:gap-7 lg:gap-8 items-stretch p-4 sm:p-6 lg:p-7 overflow-y-auto md:overflow-hidden h-full">
          {/* LEFT COLUMN (Hero / Welcome - md:col-span-5) */}
          <div className="w-full md:col-span-5 mb-4 md:mb-0 shrink-0 flex flex-col justify-center">
            <OnboardingHero
              welcomeTitle={onboardingConfig.welcome_title}
              welcomeDescription={onboardingConfig.welcome_description}
              primaryColor={primaryColor}
              showAnimation={true}
            />
          </div>

          {/* RIGHT COLUMN (Form & Bento Cards - md:col-span-7) */}
          <form
            onSubmit={handleSubmit}
            className="w-full md:col-span-7 flex flex-col h-full overflow-hidden"
          >
            {errorMessage && (
              <div className="mb-2.5 p-2.5 bg-red-50/90 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Scrollable form container with customized smooth scrolling (auto overflow for smaller laptop screens) */}
            <div className="overflow-y-auto max-h-[55vh] md:max-h-[calc(90vh-110px)] pr-1 md:pr-1.5 py-0.5 overscroll-contain">
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

            {/* Footer with "Später anzeigen" textlink and green CTA button */}
            <div className="pt-3 mt-2 sm:mt-auto flex items-center justify-end gap-3 sm:gap-4 bg-white shrink-0">
              <button
                type="button"
                id="onboarding-remind-later-button"
                onClick={handleRemindLater}
                title="Das Onboarding wird für diese Sitzung ausgeblendet und beim nächsten Anmelden erneut angezeigt."
                className="text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Später anzeigen
              </button>

              <button
                type="submit"
                id="onboarding-submit-button"
                disabled={isSubmitting}
                className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[var(--color-primary,#1b4332)] hover:bg-black text-white font-bold text-xs sm:text-sm tracking-wide shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Wird gespeichert...</span>
                  </>
                ) : (
                  <>
                    <span>Bestätigen</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
