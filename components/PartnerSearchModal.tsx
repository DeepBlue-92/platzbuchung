import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, LeaguePartnerSearch } from '../types';

interface PartnerSearchModalProps {
  currentUser: User;
  userRank?: number;
  existingSearch?: LeaguePartnerSearch | null;
  onClose: () => void;
  onSave: (availabilityText: string, expiresAt: string, showContactInfo: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const PartnerSearchModal: React.FC<PartnerSearchModalProps> = ({
  currentUser,
  userRank,
  existingSearch,
  onClose,
  onSave,
  onDelete,
}) => {
  const [availabilityText, setAvailabilityText] = useState(existingSearch?.availabilityText || '');
  const [showContactInfo, setShowContactInfo] = useState<boolean>(currentUser.showContactInfo || false);
  
  // Calculate default expiration (14 days from today)
  const getDefaultExpiry = (days: number) => {
    if (days >= 36500) return '2099-12-31';
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const isUnlimited = (expDate?: string) => {
    if (!expDate) return false;
    const year = new Date(expDate).getFullYear();
    return year > 2050;
  };

  const [expiresAt, setExpiresAt] = useState<string>(
    existingSearch?.expiresAt ? existingSearch.expiresAt.split('T')[0] : getDefaultExpiry(14)
  );

  const [presetDays, setPresetDays] = useState<number>(
    existingSearch?.expiresAt && isUnlimited(existingSearch.expiresAt) ? 36500 : 14
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName =
    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
    currentUser.klarname ||
    currentUser.name ||
    'Spieler';

  const handleApplyPreset = (days: number) => {
    setPresetDays(days);
    if (days >= 36500) {
      setExpiresAt('2099-12-31');
    } else {
      setExpiresAt(getDefaultExpiry(days));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availabilityText.trim()) {
      setError('Bitte gib deine Verfügbarkeit an.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(availabilityText.trim(), expiresAt, showContactInfo);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern der Anzeige.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen der Anzeige.');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full md:w-[450px] md:max-w-[100vw] h-[100dvh] bg-white shadow-2xl flex flex-col animate-in slide-in-from-bottom md:slide-in-from-right duration-300 pointer-events-auto z-10 text-left overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header (Matching Court Booking Drawer style) */}
        <div className="bg-[var(--color-primary)] p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden">
          {/* Background Relief Watermark */}
          <div className="absolute -bottom-8 -right-4 text-white opacity-[0.08] z-0 pointer-events-none transform -rotate-12">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[130px] h-[130px]"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
              <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 text-white/80 text-[10px] font-black uppercase tracking-widest mb-1">
              <i className="fa-solid fa-bullhorn text-amber-300"></i>
              <span>Hobbyliga Schwarzes Brett</span>
            </div>
            <h3 className="text-xl font-black tracking-tight leading-tight">
              {existingSearch ? 'Anzeige bearbeiten' : 'Anzeige aufgeben'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-base font-medium"
            title="Schließen"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Form Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-700 flex flex-col justify-between">
          <div className="space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-pulse">
                <i className="fa-solid fa-circle-exclamation text-rose-500 text-base"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Automatic Information Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Automatisch aus deinem Profil übernommen
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-user text-slate-400 text-xs"></i>
                  <span className="font-bold text-slate-800 text-sm">{fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {userRank ? (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-lg border border-amber-200">
                      <i className="fa-solid fa-trophy mr-1 text-amber-600"></i>
                      Rang {userRank}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                      In der Liga
                    </span>
                  )}
                  {currentUser.vereinsId && (
                    <span className="px-2.5 py-1 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded-lg">
                      <i className="fa-solid fa-building-columns mr-1 text-slate-400"></i>
                      {currentUser.vereinsId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Availability Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Wann passt es dir normalerweise? <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={availabilityText}
                onChange={(e) => setAvailabilityText(e.target.value)}
                placeholder="z. B. Meistens Samstagvormittag oder unter der Woche ab 18 Uhr."
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition resize-none"
                required
              />
              <p className="text-[11px] font-medium text-slate-400">
                Beschreibe deine zeitliche Flexibilität oder gewünschte Spieltage.
              </p>
            </div>

            {/* Expiration Date */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Sichtbar bis (Ablaufdatum)
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { days: 7, label: '7 Tage' },
                  { days: 14, label: '14 Tage' },
                  { days: 30, label: '30 Tage' },
                  { days: 36500, label: 'Unbegrenzt' },
                ].map((p) => {
                  const isSelected =
                    (presetDays === p.days) ||
                    (p.days === 36500 && isUnlimited(expiresAt)) ||
                    (expiresAt === getDefaultExpiry(p.days));
                  return (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => handleApplyPreset(p.days)}
                      className={`py-2 px-2.5 text-xs font-bold rounded-xl border transition ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-emerald-50 text-[var(--color-primary)] font-black shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {isUnlimited(expiresAt) ? (
                <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-infinity text-[var(--color-primary)] text-sm" />
                  <span>Daueranzeige aktiv (kein verfallsdatum)</span>
                </div>
              ) : (
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => {
                    setExpiresAt(e.target.value);
                    setPresetDays(0);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-[var(--color-primary)]"
                />
              )}
              <p className="text-[11px] font-medium text-slate-400">
                Anzeigen verschwinden nach dem Ablaufdatum automatisch oder können verlängert werden.
              </p>
            </div>

            {/* Contact Info Toggle */}
            <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showContactInfo}
                    onChange={(e) => setShowContactInfo(e.target.checked)}
                  />
                  <div className="w-5 h-5 bg-white border-2 border-slate-300 rounded-md peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] transition"></div>
                  <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 transition"></i>
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-bold text-slate-800 leading-snug">
                    Meine Kontaktdaten (Telefon & E-Mail) in dieser Anzeige für Match-Absprachen anzeigen
                  </span>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">
                    Wenn aktiviert, sehen andere Spieler direkt deine Kontaktinfos in der Anzeige. 
                    Diese Einstellung wird in deinem Profil gespeichert.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
            {existingSearch && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3.5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    {deleting ? (
                      <i className="fa-solid fa-spinner fa-spin" />
                    ) : (
                      <i className="fa-solid fa-trash-can" />
                    )}
                    Ja, löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-trash"></i>
                  Löschen
                </button>
              )
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[var(--color-primary)] hover:bg-opacity-90 rounded-xl transition shadow-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Speichern...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    {existingSearch ? 'Speichern' : 'Veröffentlichen'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
