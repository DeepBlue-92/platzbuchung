import React, { useState, useEffect } from "react";
import { updateEmail, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { saveUser, ClubSettings } from "../services/db";
import { User, Gender } from "../types";


interface ProfileModalProps {
  currentUser: User;
  allUsers: Record<string, User>;
  onClose: () => void;
  onCloseStart?: () => void;
  onSuccess: (updatedUser: User) => void;
  primaryColor?: string;
  settings?: ClubSettings;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
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
  const [email, setEmail] = useState(currentUser.email || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [gender, setGender] = useState<Gender>(currentUser.gender || "m");
  const [showContactInfo, setShowContactInfo] = useState<boolean>(
    currentUser.showContactInfo !== false
  );
  const [showOnboardingHints, setShowOnboardingHints] = useState(
    currentUser.show_onboarding_hints !== false
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

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

  
  const getWhatsAppLink = (phone: string) => {
    if (!phone) return '';
    return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
  };
  const whatsAppUrl = getWhatsAppLink(phone);


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

    const isTaken = Object.values(allUsers).some(
      (u: User) =>
        u.id !== currentUser.id &&
        u.name.toLowerCase() === normalizedNewUsername.toLowerCase()
    );
    if (isTaken) {
      setError("Dieser Benutzername ist bereits vergeben.");
      return;
    }

    setIsSaving(true);
    setError("");

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

      if (usernameChanged && !isSystemAdmin && !finalEmail) {
        const emailSlug = normalizedNewUsername
          .toLowerCase()
          .replace(/\s/g, "");
        const vId = (currentUser.vereinsId || "sv-neuhausen")
          .toLowerCase()
          .trim();
        finalEmail = `${emailSlug}@${vId}.system.local`;
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
        showContactInfo,
        show_onboarding_hints: showOnboardingHints,
        ...(newPassword ? { password: newPassword } : {}),
      };

      await saveUser(currentUser.vereinsId || "sv-neuhausen", updatedUser);
      onSuccess(updatedUser);
      handleClose();
    } catch (err: any) {
      console.error("Profile update error:", err);
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

              {/* Status Banner / Member Info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Verein</span>
                  <span className="text-xs font-bold text-slate-800 uppercase">{currentUser.vereinsId || "SV Neuhausen"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Ranglisten-Kategorie</span>
                  <span className="text-xs font-bold text-[var(--color-primary)] uppercase">
                    {gender === "w" ? "Damen" : "Herren"}
                  </span>
                </div>
              </div>

              {/* Section 1: Realer Name & Geschlecht */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-address-card text-[11px]"></i>
                  Persönliche Daten (Pflichtfelder)
                </h4>
                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
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
                      className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Geschlecht <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender("m")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        gender === "m"
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <i className="fa-solid fa-mars"></i> Herren ('m')
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("w")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        gender === "w"
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <i className="fa-solid fa-venus"></i> Damen ('w')
                    </button>
                  </div>
                </div>
              </div>

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
                      placeholder="max@beispiel.de"
                      className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Telefonnummer (für Spielvereinbarungen)
                    </label>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+49 170 1234567"
                      className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
                    />
                  </div>
                </div>

                {/* Privacy Toggle (Kontaktfreigabe) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showContactInfo}
                      onChange={(e) => setShowContactInfo(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Kontaktinformationen sichtbar: {showContactInfo ? "Ja" : "Nein"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block leading-tight mt-0.5">
                        Wenn aktiviert, können Spieler deiner Regio-Rangliste deine Telefonnummer und E-Mail sehen, um Forderungsspiele zu vereinbaren.
                      </span>
                    </div>
                  </label>

                  {/* WhatsApp Button Preview */}
                  {phone.trim() && showContactInfo && whatsAppUrl && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1.5">
                        <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i> WhatsApp-Link bereit
                      </span>
                      <a
                        href={whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-emerald-700 transition"
                      >
                        <i className="fa-brands fa-whatsapp"></i> Chat Starten
                      </a>
                    </div>
                  )}
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
                    className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
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
                        className="w-full text-xs px-3 pr-9 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
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
                      className="w-full text-xs px-3 border-2 border-slate-200 rounded-xl font-bold bg-white focus:border-[var(--color-primary)] outline-none transition-all py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: App Hilfen */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-sliders text-[11px]"></i>
                  App-Anzeige
                </h4>
                <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showOnboardingHints}
                    onChange={(e) => setShowOnboardingHints(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Onboarding-Tipps anzeigen</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6 bg-white border-t border-slate-100 shrink-0 sticky bottom-0 z-10">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full text-white rounded-2xl uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
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
