import React, { useState, useEffect } from "react";
import { updateEmail, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { saveUser, isUsernameTakenGlobally, ClubSettings, DEFAULT_ONBOARDING_SETTINGS } from "../services/db";
import { User, Gender } from "../types";
import { parseDateToYYYYMMDD } from "../utils/playerHelper";
import { AvatarUploader } from "./AvatarUploader";


interface ProfileModalProps {
  currentUser: User;
  loggedInUser?: User | null;
  allUsers: Record<string, User>;
  onClose: () => void;
  onCloseStart?: () => void;
  onSuccess: (updatedUser: User) => void;
  primaryColor?: string;
  settings?: ClubSettings;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  loggedInUser,
  allUsers,
  onClose,
  onCloseStart,
  onSuccess,
  primaryColor = "var(--color-primary)",
  settings,
}) => {
  const [username, setUsername] = useState(currentUser.name);
  const [firstName, setFirstName] = useState(currentUser.firstName || "");
  const [lastName, setLastName] = useState(currentUser.lastName || "");
  const [email, setEmail] = useState(() => {
    const e = currentUser.email || "";
    if (e.endsWith(".system.local")) return "";
    return e;
  });
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [gender, setGender] = useState<Gender>(currentUser.gender || "m");
  const [birthDate, setBirthDate] = useState(() => parseDateToYYYYMMDD(currentUser.birthDate));
  const [showContactInfo, setShowContactInfo] = useState(
    currentUser.showContactInfo !== false
  );
  const [showOnboardingHints, setShowOnboardingHints] = useState(
    currentUser.show_onboarding_hints !== false
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl || null);
  const [avatarIcon, setAvatarIcon] = useState<string | null>(currentUser.avatarIcon || "initials");

  useEffect(() => {
    setAvatarUrl(currentUser.avatarUrl || null);
    setAvatarIcon(currentUser.avatarIcon || "initials");
  }, [currentUser.avatarUrl, currentUser.avatarIcon]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const activeUser = loggedInUser || currentUser;
  const isAdmin = activeUser.role === "admin" || activeUser.role === "super-admin";

  const onboardingConfig = {
    ...DEFAULT_ONBOARDING_SETTINGS,
    ...(settings?.club_onboarding_settings || {}),
  };

  const fieldNamePermission = onboardingConfig.field_name || "EDITABLE";
  const fieldBirthdatePermission = onboardingConfig.field_birthdate || onboardingConfig.field_demographics || "READ_ONLY";
  const fieldGenderPermission = onboardingConfig.field_gender || onboardingConfig.field_demographics || "READ_ONLY";

  const isNameDisabled = !isAdmin && fieldNamePermission === "READ_ONLY";
  const isBirthdateDisabled = !isAdmin && fieldBirthdatePermission === "READ_ONLY";
  const isGenderDisabled = !isAdmin && fieldGenderPermission === "READ_ONLY";

  const showSection1 =
    fieldNamePermission !== "HIDDEN" || fieldBirthdatePermission !== "HIDDEN" || fieldGenderPermission !== "HIDDEN";

  // Info notice is shown ONLY if at least one displayed field in this section is set to 'READ_ONLY'
  const hasDisplayedReadOnlyField =
    (fieldNamePermission !== "HIDDEN" && fieldNamePermission === "READ_ONLY") ||
    (fieldBirthdatePermission !== "HIDDEN" && fieldBirthdatePermission === "READ_ONLY") ||
    (fieldGenderPermission !== "HIDDEN" && fieldGenderPermission === "READ_ONLY");

  const showAdminNotice = !isAdmin && hasDisplayedReadOnlyField;

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimatingIn(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setIsAnimatingIn(false);
    if (onCloseStart) {
      onCloseStart();
    }
    setTimeout(() => {
      onClose();
    }, 200);
  };

  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError("Kein aktiver Benutzer gefunden.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("Vorname und Nachname sind Pflichtfelder.");
      return;
    }

    if (!username.trim()) {
      setError("Der Benutzername darf nicht leer sein.");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setError("Das neue Passwort muss mindestens 4 Zeichen lang sein.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
    }

    const normalizedNewUsername = username.trim();

    const isTakenLocally = Object.values(allUsers).some(
      (u: User) =>
        u.id !== currentUser.id &&
        u.name.toLowerCase() === normalizedNewUsername.toLowerCase()
    );
    if (isTakenLocally) {
      setError("Dieser Benutzername ist in diesem Verein bereits vergeben.");
      return;
    }

    const isTakenGlobally = await isUsernameTakenGlobally(normalizedNewUsername, currentUser.id);
    if (isTakenGlobally) {
      setError("Dieser Benutzername ist systemweit bereits vergeben.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      if (newPassword) {
        const authPwd =
          newPassword.length < 6 ? `${newPassword}-tennis` : newPassword;
        await updatePassword(auth.currentUser, authPwd);
      }

      const oldEmail = currentUser.email || "";
      let finalEmail = email.trim();
      const isSystemAdmin =
        currentUser.role === "admin" &&
        currentUser.name.toLowerCase() === "system admin";

      const usernameChanged =
        normalizedNewUsername.toLowerCase() !== currentUser.name.toLowerCase();

      const effectiveVereinsId = (settings?.vereinsId || settings?.id || currentUser.vereinsId || "sv-neuhausen")
        .toLowerCase()
        .trim();

      if (usernameChanged && !isSystemAdmin && !finalEmail) {
        const emailSlug = normalizedNewUsername
          .toLowerCase()
          .replace(/\s/g, "");
        finalEmail = `${emailSlug}@${effectiveVereinsId}.system.local`;
      }

      if (finalEmail && finalEmail.toLowerCase() !== oldEmail.toLowerCase()) {
        try {
          await updateEmail(auth.currentUser, finalEmail);
        } catch (emailErr: any) {
          console.warn(
            "Could not update Firebase Auth email:",
            emailErr
          );
        }
      }

      const updatedUser: User = {
        ...currentUser,
        name: normalizedNewUsername,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: finalEmail,
        phone: phone.trim(),
        gender,
        birthDate: birthDate ? birthDate.trim() : null,
        showContactInfo,
        show_onboarding_hints: showOnboardingHints,
        avatarUrl: avatarUrl || null,
        avatarIcon: avatarIcon || "initials",
        ...(newPassword ? { password: newPassword } : {}),
      };

      await saveUser(effectiveVereinsId, updatedUser);
      onSuccess(updatedUser);
      setSuccessMessage("Daten / Icon erfolgreich gespeichert.");
    } catch (err: any) {
      console.error("Profile update error:", err);
      setSuccessMessage("");
      let errMsg = "Fehler beim Speichern des Profils.";
      if (err.code === "auth/requires-recent-login") {
        errMsg =
          "Aus Sicherheitsgründen musst du dein Passwort oder deine Logindaten ändern, indem du dich kurz aus- und wieder einloggst.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex justify-end lg:bg-slate-900/60 lg:backdrop-blur-[2px] bg-slate-100 transition-opacity"
      onClick={handleClose}
      style={{
        opacity: !isAnimatingIn || isClosing ? 0 : 1,
        transitionDuration: isClosing ? "200ms" : "250ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: isClosing ? "none" : "auto",
      }}
    >
      <div
        className="w-full lg:w-[450px] h-[100vh] bg-slate-100 lg:bg-white lg:shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform:
            !isAnimatingIn || isClosing ? "translateX(100%)" : "translateX(0)",
          transitionDuration: isClosing ? "200ms" : "250ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          className="bg-[var(--color-primary)] px-4 h-12 flex items-center justify-between text-white shadow-md relative shrink-0 select-none rounded-none font-sans"
          style={{ backgroundColor: primaryColor }}
        >
          <h3 className="text-white font-black tracking-widest uppercase text-xs flex items-center gap-2">
            <i className="fa-solid fa-user-pen text-sm"></i>
            Profil bearbeiten
          </h3>

          <button
            type="button"
            onClick={handleClose}
            className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all flex items-center gap-1.5 font-black uppercase text-[9px] tracking-wider cursor-pointer outline-none border border-white/15 text-white"
            title="Schließen"
          >
            <i className="fa-solid fa-xmark text-[9px]"></i> Schließen
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto flex flex-col justify-between select-text"
        >
          <div className="flex-1 lg:p-6 p-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 lg:p-0 lg:border-none lg:bg-transparent lg:rounded-none lg:shadow-none space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold leading-relaxed flex gap-2 items-start animate-pulse">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 text-red-600"></i>
                  <p>{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold leading-relaxed flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
                  <i className="fa-solid fa-circle-check text-emerald-600 text-sm shrink-0"></i>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Avatar-Uploader mit Hard-Bandwidth-Protection (WebP <= 25 KB & 0-Byte Vektor Fallback) */}
              <AvatarUploader
                user={currentUser}
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

              {/* Section 1: Realer Name & Geschlecht */}
              {showSection1 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <i className="fa-solid fa-address-card text-[11px]"></i>
                    Persönliche Daten {fieldNamePermission !== "HIDDEN" ? "(Pflichtfelder)" : ""}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {fieldNamePermission !== "HIDDEN" && (
                      <>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                            Vorname <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Max"
                            required
                            disabled={isNameDisabled}
                            className={`w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium ${
                              isNameDisabled
                                ? "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                            Nachname <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Mustermann"
                            required
                            disabled={isNameDisabled}
                            className={`w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium ${
                              isNameDisabled
                                ? "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </div>
                      </>
                    )}
                    {fieldGenderPermission !== "HIDDEN" && (
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Geschlecht
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          disabled={isGenderDisabled}
                          className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer font-sans font-medium"
                        >
                          <option value="m">männlich</option>
                          <option value="w">weiblich</option>
                        </select>
                      </div>
                    )}
                    {fieldBirthdatePermission !== "HIDDEN" && (
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Geburtsdatum
                        </label>
                        <input 
                          type="date"
                          min="1900-01-01"
                          max="2099-12-31"
                          value={birthDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.length <= 10) {
                              setBirthDate(val);
                            }
                          }}
                          disabled={isBirthdateDisabled}
                          className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed font-sans font-medium"
                        />
                      </div>
                    )}
                  </div>
                  {showAdminNotice && (
                    <div className="mt-2 text-[10px] text-slate-400 font-medium px-1 flex items-start gap-1.5">
                      <i className="fa-solid fa-circle-info mt-0.5 text-blue-400"></i>
                      Stammdaten zur Liga-Zuordnung. Änderungen bitte über den Administrator anfragen.
                    </div>
                  )}
                </div>
              )}

              {/* Section 1.5: Kontaktdaten & WhatsApp Link */}
              <div className="space-y-4 pt-1">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-address-book text-[11px]"></i>
                  Kontaktinformationen (Optional)
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      E-Mail Adresse
                    </label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@beispiel.de"
                      className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      TELEFONNUMMER
                    </label>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+49 170 1234567"
                      className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Account Login Settings */}
              <div className="space-y-4 pt-1">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-key text-[11px]"></i>
                  Zugangsdaten & Passwort
                </h4>

                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Benutzername (Login)
                  </label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Benutzername"
                    className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-8 px-3 pr-9 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Bestätigen
                    </label>
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: App Hilfen & Privatsphäre */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-sliders text-[11px]"></i>
                  Privatsphäre & App-Anzeige
                </h4>
                <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showContactInfo}
                    onChange={(e) => setShowContactInfo(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Kontaktdaten freigeben</span>
                    <span className="text-[10px] text-slate-500 font-medium">Meine E-Mail und Telefonnummer in Börse/Rangliste anzeigen</span>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showOnboardingHints}
                    onChange={(e) => setShowOnboardingHints(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Tipps anzeigen</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6 bg-white border-t border-slate-100 shrink-0 sticky bottom-0 z-10">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full text-white rounded-2xl uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium whitespace-nowrap"
              style={{ backgroundColor: primaryColor }}
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin text-sm"></i>
                  <span>Wird gespeichert...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk text-sm"></i>
                  <span>Profil speichern</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
