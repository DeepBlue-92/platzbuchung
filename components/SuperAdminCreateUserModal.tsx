import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Role } from "../types";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Props {
  onClose: () => void;
  clubs: any[];
  onUserCreated: () => void;
}

export default function SuperAdminCreateUserModal({ onClose, clubs, onUserCreated }: Props) {
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    passwordConfirm: "",
    email: "",
    phone: "",
    gender: "m",
    birthDate: "",
    showContactInfo: true,
    clubAssignments: {} as Record<string, Role>,
    mustChangePassword: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, password: pwd, mustChangePassword: true });
  };

  const toggleClub = (id: string) => {
    const newAssignments = { ...form.clubAssignments };
    if (newAssignments[id]) {
      delete newAssignments[id];
    } else {
      newAssignments[id] = Role.MITGLIED;
    }
    setForm({ ...form, clubAssignments: newAssignments });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Vorname und Nachname sind Pflichtfelder.");
      return;
    }
    if (!form.username.trim() || !form.password.trim()) {
      setError("Benutzername und Passwort sind Pflichtfelder.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    const selectedClubIds = Object.keys(form.clubAssignments);
    if (selectedClubIds.length === 0) {
      setError("Bitte weise dem Benutzer mindestens einen Verein zu.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rawUsername = form.username.trim();
      const normalizedUsername = rawUsername.toLowerCase().replace(/\s/g, "");
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || rawUsername;
      const klarname = fullName || rawUsername;
      
      // Erster gewählter Verein als primärer Tenant
      const primaryTenant = selectedClubIds[0];
      const primaryRole = form.clubAssignments[primaryTenant];
      const docId = `${normalizedUsername}_${primaryTenant}`;

      const backendRole = primaryRole === Role.ADMIN ? "admin" : "spieler";

      const userData: any = {
        id: docId,
        username: normalizedUsername,
        name: displayName,
        displayName: displayName,
        klarname: klarname,
        firstName: firstName,
        lastName: lastName,
        gender: form.gender,
        birthDate: form.birthDate || null,
        showContactInfo: form.showContactInfo,
        role: backendRole,
        tenantId: primaryTenant,
        vereinsId: primaryTenant, // Fallback/Legacy
        password: form.password,
        passwort: form.password,
        email: form.email.trim(),
        phone: form.phone.trim(),
        mustChangePassword: form.mustChangePassword,
        createdAt: new Date().toISOString(),
        clubs: selectedClubIds.map(cId => {
          const club = clubs.find(c => c.vereinsId === cId);
          return {
            id: cId,
            vereinsId: cId,
            clubName: club ? (club.vereinsName || club.name || cId) : cId,
            role: form.clubAssignments[cId]
          };
        }),
      };

      await setDoc(doc(db, "users", docId), userData);

      // Create membership records for all assigned clubs
      for (const cId of selectedClubIds) {
        try {
          const memRole = form.clubAssignments[cId];
          const memDocRef = doc(db, "clubs", cId, "memberships", `${docId}_${cId}`);
          await setDoc(memDocRef, {
            personId: docId,
            userId: normalizedUsername,
            vereinId: cId,
            role: memRole,
            email: form.email.trim(),
            createdAt: new Date().toISOString(),
          });
        } catch (memErr) {
          console.warn(`Could not create membership record in club ${cId}:`, memErr);
        }
      }

      onUserCreated();
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Erstellen des Benutzers.");
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div 
        className="border-none outline-none bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto -200 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1b4332] font-bold text-lg shrink-0">
              <i className="fa-solid fa-user-plus"></i>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">
                Neuen Benutzer anlegen
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Erstelle ein neues Benutzerkonto und weise Vereine zu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Schließen"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. PERSÖNLICHE DATEN */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Persönliche Daten
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Vorname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  placeholder="Vorname"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Nachname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  placeholder="Nachname"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Geschlecht
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none appearance-none cursor-pointer font-sans font-medium"
                >
                  <option value="m">männlich</option>
                  <option value="w">weiblich</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Geburtsdatum
                </label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="2099-12-31"
                  value={form.birthDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= 10) {
                      setForm({ ...form, birthDate: val });
                    }
                  }}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none font-sans font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. KONTAKTINFORMATIONEN */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              2. Kontaktinformationen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  E-Mail-Adresse <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  placeholder="name@beispiel.de"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Telefonnummer <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  placeholder="+49 ..."
                />
              </div>
            </div>
          </div>

          {/* 3. ZUGANGSDATEN & PASSWORT */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              3. Zugangsdaten & Passwort
            </h3>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                Benutzername <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                placeholder="z. B. max.mustermann oder mmustermann"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Passwort <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value, mustChangePassword: false })}
                    className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none font-mono placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                    placeholder="Passwort..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                      let pwd = "";
                      for (let i = 0; i < 8; i++) {
                        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setForm({ ...form, password: pwd, passwordConfirm: pwd, mustChangePassword: true });
                    }}
                    className="px-4 py-2.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary)]/20 transition-colors font-bold text-xs shrink-0 flex items-center justify-center cursor-pointer"
                    title="Passwort generieren"
                  >
                    <i className="fa-solid fa-key"></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Passwort bestätigen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.passwordConfirm}
                  onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                  className="w-full h-8 px-3 py-1 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none font-mono placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  placeholder="Passwort wiederholen..."
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. PRIVATSPHÄRE & APP-ANZEIGE */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              4. Privatsphäre & App-Anzeige
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={form.showContactInfo}
                  onChange={(e) => setForm({ ...form, showContactInfo: e.target.checked })}
                  className="w-4 h-4 rounded text-[#1b4332] focus:ring-[#1b4332] accent-[#1b4332] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">
                  Kontaktdaten freigeben (E-Mail / Telefon in Börse anzeigen)
                </span>
              </label>
            </div>
          </div>

          {/* 5. VEREINS- & ROLLENZUORDNUNG */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
              5. Vereine & Rollen <span className="text-red-500">*</span>
            </h3>
            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto p-1">
              {clubs.map((c) => {
                const isSelected = !!form.clubAssignments[c.vereinsId];
                return (
                  <div
                    key={c.vereinsId}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-[#1b4332] bg-[#1b4332]/5 shadow-2xs"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleClub(c.vereinsId)}
                        className="w-4 h-4 accent-[#1b4332] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                      <span className="text-sm font-bold text-slate-700 truncate">
                        {c.vereinsName || c.name || c.vereinsId}
                      </span>
                    </label>

                    {isSelected && (
                      <div className="flex items-center gap-2 pl-7 sm:pl-0">
                        <select
                          value={form.clubAssignments[c.vereinsId]}
                          onChange={(e) => setForm({
                            ...form,
                            clubAssignments: {
                              ...form.clubAssignments,
                              [c.vereinsId]: e.target.value as Role
                            }
                          })}
                          className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1b4332] focus:ring-1 focus:ring-[#1b4332] font-sans font-medium"
                        >
                          <option value={Role.MITGLIED}>Spieler (Standard)</option>
                          <option value={Role.ADMIN}>Vereins-Admin</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#1b4332] hover:bg-emerald-900 shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <i className="fa-solid fa-check"></i>
              )}
              Benutzer erstellen
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
