import React from "react";
import { User, Gender } from "../../types";
import { AvatarUploader } from "../AvatarUploader";
import { UserAvatar } from "../UserAvatar";
import {
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Calendar,
  Sparkles,
  KeyRound,
} from "lucide-react";

interface OnboardingBentoCardsProps {
  currentUser: User;
  fieldName: "EDITABLE" | "READ_ONLY" | "HIDDEN";
  fieldDemographics: "EDITABLE" | "READ_ONLY" | "HIDDEN";
  fieldAvatar: "EDITABLE" | "READ_ONLY" | "HIDDEN";
  fieldPassword: "EDITABLE" | "READ_ONLY" | "HIDDEN";
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  gender: Gender;
  setGender: (val: Gender) => void;
  birthDate: string;
  setBirthDate: (val: string) => void;
  avatarUrl: string | null;
  setAvatarUrl: (val: string | null) => void;
  avatarIcon: string | null;
  setAvatarIcon: (val: string | null) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  primaryColor: string;
}

export const OnboardingBentoCards: React.FC<OnboardingBentoCardsProps> = ({
  currentUser,
  fieldName,
  fieldDemographics,
  fieldAvatar,
  fieldPassword,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  gender,
  setGender,
  birthDate,
  setBirthDate,
  avatarUrl,
  setAvatarUrl,
  avatarIcon,
  setAvatarIcon,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  primaryColor,
}) => {
  return (
    <div
      id="onboarding-bento-grid"
      className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
    >
      {/* Bento Card 1: Name */}
      {fieldName !== "HIDDEN" && (
        <div
          id="bento-card-name"
          className={`p-4 rounded-2xl border transition-all duration-200 ${
            fieldName === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Persönlicher Name</span>
            </div>
            {fieldName === "READ_ONLY" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                <Lock className="w-3 h-3" />
                Schreibgeschützt
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                className={`w-full h-9 px-3 py-1.5 rounded-xl text-xs sm:text-sm transition-all outline-none ${
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
                className={`w-full h-9 px-3 py-1.5 rounded-xl text-xs sm:text-sm transition-all outline-none ${
                  fieldName === "READ_ONLY"
                    ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium"
                    : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                }`}
              />
            </div>
          </div>
          {fieldName === "READ_ONLY" && (
            <p className="mt-2 text-[10px] text-slate-500 font-medium">
              Änderungen bitte über den Administrator anfragen.
            </p>
          )}
        </div>
      )}

      {/* Bento Card 2: Demographics */}
      {fieldDemographics !== "HIDDEN" && (
        <div
          id="bento-card-demographics"
          className={`p-4 rounded-2xl border transition-all duration-200 ${
            fieldDemographics === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Demographie</span>
            </div>
            {fieldDemographics === "READ_ONLY" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                <Lock className="w-3 h-3" />
                Schreibgeschützt
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Geburtsdatum
              </label>
              <input
                type="date"
                disabled={fieldDemographics === "READ_ONLY"}
                value={birthDate || ""}
                onChange={(e) => setBirthDate(e.target.value)}
                className={`w-full h-9 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all outline-none ${
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
                className={`w-full h-9 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all outline-none ${
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
            <p className="mt-2 text-[10px] text-slate-500 font-medium">
              Stammdaten zur Liga-Zuordnung.
            </p>
          )}
        </div>
      )}

      {/* Bento Card 3: Avatar / Profilbild (Span 2) */}
      {fieldAvatar !== "HIDDEN" && (
        <div
          id="bento-card-avatar"
          className={`p-4 rounded-2xl border md:col-span-2 transition-all duration-200 ${
            fieldAvatar === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>Profilbild & Avatar</span>
            </div>
            {fieldAvatar === "READ_ONLY" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                <Lock className="w-3 h-3" />
                Schreibgeschützt
              </span>
            )}
          </div>

          {fieldAvatar === "READ_ONLY" ? (
            <div className="flex items-center gap-3 py-1">
              <UserAvatar
                user={{
                  name: currentUser.name,
                  klarname: currentUser.klarname,
                  avatarUrl: currentUser.avatarUrl,
                  avatarIcon: currentUser.avatarIcon,
                }}
                size="md"
              />
              <div className="text-xs text-slate-500">
                <p className="font-bold text-slate-700">Aktuelles Profilbild</p>
                <p className="text-[11px]">Vom Club-Administrator verwaltet.</p>
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

      {/* Bento Card 4: Password (Span 2) */}
      {fieldPassword !== "HIDDEN" && (
        <div
          id="bento-card-password"
          className="p-4 rounded-2xl border bg-white border-slate-200 shadow-sm md:col-span-2 hover:border-slate-300 transition-all duration-200"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Passwort festlegen (Optional)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">
              Nur bei Bedarf ausfüllen
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full h-9 px-3 pr-9 py-1.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs sm:text-sm text-slate-900 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
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
                placeholder="Wiederholung"
                className="w-full h-9 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs sm:text-sm text-slate-900 font-mono transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingBentoCards;
