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
      className="flex flex-col space-y-2.5 sm:space-y-3"
    >
      {/* 1. Bento Card: Persönlicher Name */}
      {fieldName !== "HIDDEN" && (
        <div
          id="bento-card-name"
          className={`p-3.5 sm:p-4 rounded-xl border ${
            fieldName === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Persönlicher Name</span>
            </div>
            {fieldName === "READ_ONLY" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[9px] font-bold">
                <Lock className="w-2.5 h-2.5" />
                Schreibgeschützt
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Vorname
              </label>
              <input
                type="text"
                disabled={fieldName === "READ_ONLY"}
                readOnly={fieldName === "READ_ONLY"}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Vorname"
                className={`w-full h-8.5 px-3 py-1.5 rounded-lg text-xs transition-all outline-none ${
                  fieldName === "READ_ONLY"
                    ? "bg-slate-100/90 text-slate-500 border border-slate-200 cursor-not-allowed font-medium select-none"
                    : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Nachname
              </label>
              <input
                type="text"
                disabled={fieldName === "READ_ONLY"}
                readOnly={fieldName === "READ_ONLY"}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
                className={`w-full h-8.5 px-3 py-1.5 rounded-lg text-xs transition-all outline-none ${
                  fieldName === "READ_ONLY"
                    ? "bg-slate-100/90 text-slate-500 border border-slate-200 cursor-not-allowed font-medium select-none"
                    : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                }`}
              />
            </div>
          </div>
          {fieldName === "READ_ONLY" && (
            <p className="mt-1.5 text-[9px] text-slate-500 font-medium">
              Änderungen bitte über den Administrator anfragen.
            </p>
          )}
        </div>
      )}

      {/* 2. Bento Card: Demographie (Volle Breite für unbeschnittenes Datum) */}
      {fieldDemographics !== "HIDDEN" && (
        <div
          id="bento-card-demographics"
          className={`p-3.5 sm:p-4 rounded-xl border ${
            fieldDemographics === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Demographie</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Geburtsdatum
              </label>
              <input
                type="date"
                disabled={fieldDemographics === "READ_ONLY"}
                readOnly={fieldDemographics === "READ_ONLY"}
                value={birthDate || ""}
                onChange={(e) => setBirthDate(e.target.value)}
                className={`w-full h-8.5 px-3 py-1.5 rounded-lg text-xs transition-all outline-none ${
                  fieldDemographics === "READ_ONLY"
                    ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium select-none"
                    : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium"
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Geschlecht
              </label>
              <select
                disabled={fieldDemographics === "READ_ONLY"}
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className={`w-full h-8.5 px-3 py-1.5 rounded-lg text-xs transition-all outline-none ${
                  fieldDemographics === "READ_ONLY"
                    ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed font-medium select-none"
                    : "bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] text-slate-900 font-medium cursor-pointer"
                }`}
              >
                <option value="m">männlich</option>
                <option value="w">weiblich</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bento Card: Passwort festlegen (Optional) - Sicherheitsrelevante Einstellung vor Personalisierung */}
      {fieldPassword !== "HIDDEN" && (
        <div
          id="bento-card-password"
          className="p-3.5 sm:p-4 rounded-xl border bg-white border-slate-200/90 shadow-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Passwort festlegen (Optional)</span>
            </div>
            <span className="text-[9px] text-slate-400 font-normal">
              Nur bei Bedarf ausfüllen
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  className="w-full h-8.5 px-3 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs text-slate-900 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-[9px] text-slate-500 font-medium">
                Mindestens 8 Zeichen empfohlen.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Passwort wiederholen
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Wiederholung"
                className="w-full h-8.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs text-slate-900 font-mono transition-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Bento Card: Profilbild & Avatar - Kosmetische Personalisierung vor dem Footer */}
      {fieldAvatar !== "HIDDEN" && (
        <div
          id="bento-card-avatar"
          className={`p-3.5 sm:p-4 rounded-xl border ${
            fieldAvatar === "READ_ONLY"
              ? "bg-slate-50/80 border-slate-200/80"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>Profilbild & Avatar</span>
            </div>
            {fieldAvatar === "READ_ONLY" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[9px] font-bold">
                <Lock className="w-2.5 h-2.5" />
                Schreibgeschützt
              </span>
            )}
          </div>

          {fieldAvatar === "READ_ONLY" ? (
            <div className="flex items-center gap-3 py-0.5">
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
                <p className="text-[10px]">Vom Club-Administrator verwaltet.</p>
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
              hideTitle={true}
              compact={true}
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
    </div>
  );
};

export default OnboardingBentoCards;
