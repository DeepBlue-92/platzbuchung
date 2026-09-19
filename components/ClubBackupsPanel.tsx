import React, { useState, useEffect } from "react";
import {
  listenToGlobalBackups,
  createGlobalBackup,
  restoreGlobalBackup,
  GlobalSystemBackup,
} from "../services/db";

interface ClubBackupsPanelProps {
  vereinsId?: string;
}

export default function ClubBackupsPanel({}: ClubBackupsPanelProps) {
  const [backups, setBackups] = useState<GlobalSystemBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rollback Modal State
  const [rollbackModalBackup, setRollbackModalBackup] = useState<GlobalSystemBackup | null>(null);
  const [rollbackConfirmInput, setRollbackConfirmInput] = useState("");
  const [isPerformingRollback, setIsPerformingRollback] = useState(false);

  useEffect(() => {
    const unsub = listenToGlobalBackups(setBackups);
    return () => unsub();
  }, []);

  const handleCreateBackup = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await createGlobalBackup("super-admin");
      setSuccessMsg("Globales System-Backup erfolgreich manuell erstellt.");
    } catch (err: any) {
      setErrorMsg("Fehler beim Erstellen des System-Backups: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRollbackModal = (backup: GlobalSystemBackup) => {
    setRollbackModalBackup(backup);
    setRollbackConfirmInput("");
    setErrorMsg(null);
  };

  const handleCloseRollbackModal = () => {
    if (isPerformingRollback) return;
    setRollbackModalBackup(null);
    setRollbackConfirmInput("");
  };

  const handleExecuteRollback = async () => {
    if (!rollbackModalBackup || rollbackConfirmInput !== "ROLLBACK") return;

    setIsPerformingRollback(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetBackupName = rollbackModalBackup.name;
    const targetBackupId = rollbackModalBackup.id;

    try {
      // 1. Create safety backup of the active live state
      await createGlobalBackup("rollback-auto");

      // 2. Perform the actual global database restore
      await restoreGlobalBackup(targetBackupId);

      setSuccessMsg(
        `Systemweites Rollback erfolgreich ausgeführt! Das gesamte System wurde auf den Stand von "${targetBackupName}" zurückgesetzt. Zur Sicherheit wurde zuvor ein automatisches Backup des bisherigen Systemzustands angelegt.`
      );
      setRollbackModalBackup(null);
      setRollbackConfirmInput("");
    } catch (err: any) {
      setErrorMsg("Fehler bei der System-Wiederherstellung: " + (err?.message || err));
    } finally {
      setIsPerformingRollback(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-sm">
              <i className="fa-solid fa-database"></i>
            </span>
            <h3 className="text-sm font-black uppercase text-[var(--color-primary)] tracking-wider">
              Globales System-Backup &amp; Rollback
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-3xl">
            Verwalten Sie globale System-Sicherungspunkte der gesamten Datenbank. Ein Sicherungspunkt umfasst alle Vereine, Benutzerkonten, Ligaspiele, Platzbuchungen, Turniere und Systemeinstellungen.
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={loading || isPerformingRollback}
          className="bg-[var(--color-primary)] hover:bg-[#153326] disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-sm hover:shadow-md active:scale-95 border border-[var(--color-primary)] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-xs font-black shrink-0"
        >
          <i className="fa-solid fa-plus-circle text-sm"></i>
          Neues System-Backup sichern
        </button>
      </div>

      {/* Loading Indicator */}
      {(loading || isPerformingRollback) && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-center justify-center gap-3 shadow-xs">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-[var(--color-primary)]"></div>
          <span className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider animate-pulse">
            {isPerformingRollback
              ? "Systemweites Rollback wird ausgeführt... Bitte warten..."
              : "System-Backup wird erstellt... Bitte warten..."}
          </span>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="text-emerald-600 mt-0.5">
            <i className="fa-solid fa-circle-check text-lg"></i>
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
              Erfolgreich abgeschlossen
            </h4>
            <p className="text-xs text-emerald-700 font-semibold mt-0.5 leading-relaxed">
              {successMsg}
            </p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 text-sm p-1"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="text-rose-600 mt-0.5">
            <i className="fa-solid fa-circle-xmark text-lg"></i>
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black uppercase text-rose-800 tracking-wider">
              Fehler aufgetreten
            </h4>
            <p className="text-xs text-rose-700 font-semibold mt-0.5 leading-relaxed">
              {errorMsg}
            </p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 text-sm p-1"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Global Backups Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
        <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
            Backup &amp; Rollback-Historie (Globale Snapshots)
          </h4>
          <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
            {backups.length} {backups.length === 1 ? "Sicherungspunkt" : "Sicherungspunkte"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="px-5 py-3 font-black">Sicherungspunkt</th>
                <th className="px-5 py-3 font-black text-center">Erstellt von / Typ</th>
                <th className="px-5 py-3 font-black text-center">Inhalt &amp; Umfang</th>
                <th className="px-5 py-3 font-black text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {backups.map((backup) => {
                const dateObj = new Date(backup.timestamp);
                const formattedDate = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : backup.timestamp;

                // Fallback stats computation
                const clubsCount = backup.stats?.clubsCount ?? (backup.clubs?.length || 0);
                const usersCount = backup.stats?.usersCount ?? (backup.users?.length || 0);
                const bookingsCount = backup.stats?.bookingsCount ?? (
                  backup.clubs
                    ? backup.clubs.reduce((acc: number, c: any) => acc + (c.bookings?.length || 0), 0)
                    : 0
                );
                const matchesCount = backup.stats?.matchesCount ?? (backup.leagueMatches?.length || 0);

                return (
                  <tr
                    key={backup.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 text-xs">
                        {backup.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-medium flex items-center gap-1.5">
                        <i className="fa-regular fa-clock text-[10px]"></i>
                        {formattedDate} Uhr
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">
                      {backup.creator === "system" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                          Wöchentlich (Auto)
                        </span>
                      ) : backup.creator === "rollback-auto" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <i className="fa-solid fa-shield text-[10px]"></i>
                          Sicherheits-Backup
                        </span>
                      ) : backup.creator === "league-reset" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          <i className="fa-solid fa-shield-halved text-[10px] text-purple-600"></i>
                          Snapshot (Vor Reset)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <i className="fa-solid fa-user-shield text-[10px]"></i>
                          Super-Admin
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-slate-600 font-medium">
                      {clubsCount} {clubsCount === 1 ? "Verein" : "Vereine"} · {usersCount} User · {bookingsCount} Buchungen · {matchesCount} Matches
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenRollbackModal(backup)}
                        disabled={loading || isPerformingRollback}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-rose-200 shadow-xs active:scale-95 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="Gesamtes System auf diesen Sicherungspunkt zurücksetzen"
                      >
                        <i className="fa-solid fa-arrow-rotate-left text-[11px]"></i>
                        Rollback
                      </button>
                    </td>
                  </tr>
                );
              })}

              {backups.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-slate-400 font-semibold italic"
                  >
                    Bisher wurden keine globalen System-Backups gesichert. Klicken Sie oben auf &bdquo;Neues System-Backup sichern&ldquo;, um einen Snapshot zu erstellen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-Week Auto Cleanup Info Notice */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="w-8 h-8 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5">
          <i className="fa-solid fa-circle-info"></i>
        </div>
        <div className="text-xs text-slate-600 leading-relaxed font-semibold">
          <strong className="text-amber-900">Automatische Bereinigung &amp; Sicherheit:</strong> Wöchentliche globale System-Backups bleiben aus Gründen der Kapazitäts- und Performanceoptimierung exakt{" "}
          <strong className="text-amber-900">4 Wochen (28 Tage)</strong> lang gespeichert. Nach Ablauf dieses Zeitraums werden sie automatisch bereinigt. Manuelle System-Backups, die Sie über &bdquo;Neues System-Backup sichern&ldquo; anlegen, sowie automatische Sicherheits-Backups vor Rollbacks bleiben dauerhaft erhalten.
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROLLBACK CONFIRMATION DIALOG (SUPERADMIN-SAFETY)                           */}
      {/* ========================================================================= */}
      {rollbackModalBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="border-none outline-none bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl -200 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-900 uppercase tracking-tight">
                    SYSTEMWEITES ROLLBACK AUSFÜHREN
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Globaler System-Wiederherstellungspunkt
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseRollbackModal}
                disabled={isPerformingRollback}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Warning-Banner (Rot/Orange) */}
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
              <div className="text-rose-600 text-xl shrink-0 mt-0.5">
                <i className="fa-solid fa-circle-exclamation"></i>
              </div>
              <div className="text-xs text-rose-950 font-bold leading-relaxed space-y-1">
                <p>
                  Achtung: Dies ist eine globale Systemoperation! Das Zurücksetzen setzt <span className="underline font-black">ALLE</span> Vereine, Benutzerkonten, Ligaspiele und Platzbuchungen auf den Stand vom{" "}
                  <span className="font-black bg-rose-200/80 px-1 py-0.5 rounded text-rose-900">
                    {new Date(rollbackModalBackup.timestamp).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })} Uhr
                  </span>{" "}
                  zurück.
                </p>
                <p className="text-rose-800 font-medium">
                  Alle nach diesem Zeitpunkt getätigten Aktionen im <span className="font-black uppercase text-rose-900">GESAMTEN</span> System gehen verloren.
                </p>
              </div>
            </div>

            {/* Snapshot Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold text-slate-500">Ziel-Sicherungspunkt:</span>
                <span className="font-bold text-slate-900">{rollbackModalBackup.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold text-slate-500">Erstellungsart:</span>
                <span className="font-bold">
                  {rollbackModalBackup.creator === "system"
                    ? "Wöchentlich (System)"
                    : rollbackModalBackup.creator === "rollback-auto"
                    ? "Sicherheits-Backup"
                    : "Super-Admin"}
                </span>
              </div>
            </div>

            {/* Safety Note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <div className="text-emerald-700 text-sm shrink-0 mt-0.5">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <p className="text-[11px] text-emerald-800 font-semibold leading-relaxed">
                <strong>Automatische Sicherheitskopie:</strong> Vor der Durchführung wird automatisch ein Snapshot des <em>aktuellen</em> Systemzustands gespeichert. Sie können diesen Vorgang im Notfall jederzeit rückgängig machen.
              </p>
            </div>

            {/* Sicherheitsabfrage (Admin must type ROLLBACK) */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                Sicherheitsabfrage: Tippe <span className="text-rose-600 font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">ROLLBACK</span> zur Bestätigung ein:
              </label>
              <input
                type="text"
                value={rollbackConfirmInput}
                onChange={(e) => setRollbackConfirmInput(e.target.value.toUpperCase())}
                placeholder="ROLLBACK"
                disabled={isPerformingRollback}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-sm font-mono tracking-widest uppercase text-slate-900 outline-none transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                autoFocus
              />
              <p className="text-[10px] text-slate-400 font-semibold">
                Der Button wird erst freigeschaltet, wenn das Wort exakt übereinstimmt.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseRollbackModal}
                disabled={isPerformingRollback}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleExecuteRollback}
                disabled={rollbackConfirmInput !== "ROLLBACK" || isPerformingRollback}
                className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isPerformingRollback ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white"></div>
                    Rollback läuft...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrow-rotate-left"></i>
                    Rollback jetzt ausführen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
