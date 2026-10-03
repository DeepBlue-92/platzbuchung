import React, { useState, useEffect } from "react";

interface TokenPasswordSetupModalProps {
  token: string;
  userId: string;
  initialType?: "activation" | "reset";
  onSuccess: (username: string) => void;
  onClose: () => void;
}

export default function TokenPasswordSetupModal({
  token,
  userId,
  initialType = "activation",
  onSuccess,
  onClose,
}: TokenPasswordSetupModalProps) {
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<"activation" | "reset">(initialType);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    klarname?: string;
    email?: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      try {
        setVerifying(true);
        setVerifyError(null);
        const res = await fetch(
          `/api/auth/verify-token?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`
        );
        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.valid) {
          setVerifyError(
            data.message ||
              "Dieser Sicherheits-Link ist ungültig, abgelaufen oder wurde bereits verwendet."
          );
          setVerifying(false);
          return;
        }

        setTokenType(data.type === "reset" ? "reset" : "activation");
        setUserInfo(data.user);
        setVerifying(false);
      } catch (err: any) {
        if (!isMounted) return;
        setVerifyError("Verbindungsfehler bei der Token-Prüfung. Bitte versuche es erneut.");
        setVerifying(false);
      }
    }

    if (token && userId) {
      verify();
    } else {
      setVerifyError("Ungültiger Aufruf: Sicherheits-Token oder Benutzerkennung fehlt.");
      setVerifying(false);
    }

    return () => {
      isMounted = false;
    };
  }, [token, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setSubmitError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          userId,
          newPassword: password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || "Fehler beim Speichern des neuen Passworts.");
        setSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setSubmitting(false);
    } catch (err: any) {
      setSubmitError("Netzwerkfehler beim Speichern des neuen Passworts.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1b4332]/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div
          className={`p-6 text-center text-white ${
            tokenType === "activation"
              ? "bg-gradient-to-br from-emerald-600 to-[#1b4332]"
              : "bg-gradient-to-br from-blue-600 to-indigo-800"
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            <i
              className={`fa-solid ${
                tokenType === "activation" ? "fa-user-check" : "fa-shield-halved"
              }`}
            ></i>
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {tokenType === "activation" ? "Konto aktivieren" : "Passwort zurücksetzen"}
          </h2>
          <p className="text-xs text-white/80 font-medium mt-1">
            {tokenType === "activation"
              ? "Erstelle dein persönliches Passwort für den Zugang zum Tennisclub"
              : "Vergib ein neues, sicheres Passwort für dein Benutzerkonto"}
          </p>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Loading State */}
          {verifying && (
            <div className="py-8 text-center space-y-3">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Sicherheits-Token wird geprüft...
              </p>
            </div>
          )}

          {/* Verification Error */}
          {!verifying && verifyError && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Link nicht gültig</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{verifyError}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Zurück zum Login
              </button>
            </div>
          )}

          {/* Success State */}
          {!verifying && !verifyError && isSuccess && (
            <div className="space-y-4 text-center py-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                <i className="fa-solid fa-check"></i>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Passwort gespeichert!</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {tokenType === "activation"
                    ? "Dein Konto wurde erfolgreich aktiviert. Du kannst dich jetzt direkt mit deinen neuen Zugangsdaten anmelden."
                    : "Dein Passwort wurde erfolgreich geändert. Melde dich jetzt mit deinem neuen Passwort an."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (userInfo?.name) {
                    onSuccess(userInfo.name);
                  } else {
                    onClose();
                  }
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-right-to-bracket text-xs"></i>
                <span>Jetzt anmelden</span>
              </button>
            </div>
          )}

          {/* Form State */}
          {!verifying && !verifyError && !isSuccess && userInfo && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Member Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Mitgliedskonto
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {userInfo.klarname || userInfo.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Benutzername
                  </span>
                  <span className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-xs">
                    {userInfo.name}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Neues persönliches Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1"
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Passwort wiederholen
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort erneut eingeben"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  required
                  minLength={6}
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                    tokenType === "activation"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  }`}
                >
                  {submitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      <span>Speichern...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Passwort festlegen</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
