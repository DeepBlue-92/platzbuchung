import React, { useState } from "react";
import { User } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Props {
  currentUser: User;
  onPasswordChanged: (newPassword: string) => void;
}

export default function ChangePasswordModal({ currentUser, onPasswordChanged }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Update in Firestore
      const userRef = doc(db, "users", currentUser.id);
      await updateDoc(userRef, {
        password: newPassword,
        passwort: newPassword,
        mustChangePassword: false,
      });
      // Optionally could re-auth to Firebase Auth here, but without old password we can't.
      // The patched login logic will recreate Auth user if needed later, or we just rely on DB check.
      
      onPasswordChanged(newPassword);
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Ändern des Passworts.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col items-center justify-center p-4 z-[9999] font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h1 className="text-xl font-black text-slate-800 mb-2">Sicherheitshinweis</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Dein Administrator hat ein temporäres Einmal-Passwort für dich generiert. 
            Bitte lege nun ein neues, persönliches Passwort fest, um fortzufahren.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold rounded-xl flex items-start gap-3">
            <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">
              Neues Passwort
            </label>
            <div className="relative">
              <i className="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-amber-500 focus:bg-white outline-none text-sm transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="Mindestens 6 Zeichen"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">
              Passwort bestätigen
            </label>
            <div className="relative">
              <i className="fa-solid fa-check-double absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-amber-500 focus:bg-white outline-none text-sm transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                placeholder="Passwort wiederholen"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            Passwort speichern
          </button>
        </form>
      </div>
    </div>
  );
}
