import React, { useState, useEffect } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getLeagueConfigVersions, saveLeagueConfigVersion, recalculateLeaguePointsFrom, LEAGUE_CONFIG_VERSIONS_COLLECTION } from "../services/league";
import { LeagueConfigVersion } from "../types";

export interface LeagueRuleEditorProps {
  leagueId: string;
  leagueName?: string;
  onClose?: () => void;
  onSaved?: () => void;
}

export const LeagueRuleEditor: React.FC<LeagueRuleEditorProps> = (props) => {
  const [formData, setFormData] = useState({
    leagueId: props.leagueId,
    system_status: 'active',
    effective_date: new Date().toISOString().split('T')[0],
    base_points_win: 5,
    base_points_loss: 1,
    max_bonus: 25,
    logistic_factor: 0.05,
    inactivity_deduction_per_week: 1
  });

  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [existingVersions, setExistingVersions] = useState<LeagueConfigVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync props.leagueId if it changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      leagueId: props.leagueId,
    }));
    loadVersions();
  }, [props.leagueId]);

  const loadVersions = async () => {
    setIsLoadingVersions(true);
    try {
      const all = await getLeagueConfigVersions(props.leagueId);
      const relevant = all.filter(v => v.leagueId === props.leagueId);
      setExistingVersions(relevant);
    } catch (err) {
      console.error("Fehler beim Laden der Regelwerke:", err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleSelectExisting = (ver: LeagueConfigVersion) => {
    if (ver.is_base_rule || ver.effective_date === '2000-01-01') {
      // Create a new rule based on default values
      setEditingVersionId(null);
      setFormData({
        leagueId: props.leagueId,
        system_status: 'active',
        effective_date: new Date().toISOString().split('T')[0],
        base_points_win: ver.base_points_win ?? 5,
        base_points_loss: ver.base_points_loss ?? 1,
        max_bonus: ver.max_bonus ?? 25,
        logistic_factor: ver.logistic_factor ?? 0.05,
        inactivity_deduction_per_week: ver.inactivity_deduction_per_week ?? 1,
      });
      return;
    }

    setEditingVersionId(ver.id);
    setFormData({
      leagueId: props.leagueId,
      system_status: ver.system_status || 'active',
      effective_date: ver.effective_date || new Date().toISOString().split('T')[0],
      base_points_win: ver.base_points_win ?? 5,
      base_points_loss: ver.base_points_loss ?? 1,
      max_bonus: ver.max_bonus ?? 25,
      logistic_factor: ver.logistic_factor ?? 0.05,
      inactivity_deduction_per_week: ver.inactivity_deduction_per_week ?? 1,
    });
  };

  const handleResetToNew = () => {
    setEditingVersionId(null);
    setFormData({
      leagueId: props.leagueId,
      system_status: 'active',
      effective_date: new Date().toISOString().split('T')[0],
      base_points_win: 5,
      base_points_loss: 1,
      max_bonus: 25,
      logistic_factor: 0.05,
      inactivity_deduction_per_week: 1
    });
    setStatusMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const cleanPayload = {
        id: editingVersionId || undefined,
        leagueId: props.leagueId,
        effective_date: String(formData.effective_date || new Date().toISOString().split('T')[0]),
        base_points_win: Number(formData.base_points_win),
        base_points_loss: Number(formData.base_points_loss),
        max_bonus: Number(formData.max_bonus),
        logistic_factor: Number(formData.logistic_factor),
        inactivity_deduction_per_week: Number(formData.inactivity_deduction_per_week),
        created_by: 'super-admin',
      };

      // All rule writes now use the same validated service.  It omits optional
      // values instead of sending undefined fields to Firestore.
      await saveLeagueConfigVersion(cleanPayload);

      setStatusMessage({
        type: 'success',
        text: `Regelwerk für Liga "${props.leagueName || props.leagueId}" ab ${cleanPayload.effective_date} erfolgreich gespeichert!`
      });

      await loadVersions();
      if (props.onSaved) {
        props.onSaved();
      }
    } catch (err: any) {
      console.error("Fehler beim Speichern des Regelwerks:", err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Fehler beim Speichern des Regelwerks. Bitte Eingaben prüfen.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!window.confirm("Möchten Sie dieses Regelwerk wirklich löschen?")) return;
    try {
      const docRef = doc(db, LEAGUE_CONFIG_VERSIONS_COLLECTION, versionId);
      await deleteDoc(docRef);
      await recalculateLeaguePointsFrom("2026-01-01");
      if (editingVersionId === versionId) {
        handleResetToNew();
      }
      await loadVersions();
      if (props.onSaved) props.onSaved();
    } catch (err: any) {
      console.error("Fehler beim Löschen:", err);
      alert("Fehler beim Löschen: " + (err?.message || "Unbekannter Fehler"));
    }
  };

  // Live-Berechnung Simulation
  const calcWinPoints = (p1: number, p2: number) => {
    const baseWin = Number(formData.base_points_win) || 5;
    const maxBonus = Number(formData.max_bonus) || 25;
    const k = Number(formData.logistic_factor) || 0.05;
    const diff = p2 - p1;
    const bonus = maxBonus / (1 + Math.exp(-k * diff));
    return {
      base: baseWin,
      bonus: Number(bonus.toFixed(1)),
      total: Number((baseWin + bonus).toFixed(1)),
    };
  };

  const simUnderdog = calcWinPoints(80, 120);
  const simEven = calcWinPoints(100, 100);
  const simFavorite = calcWinPoints(120, 80);
  const lossPoints = Number(formData.base_points_loss) || 1;
  const decay4Weeks = (Number(formData.inactivity_deduction_per_week) || 1) * 4;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden text-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1b4332] via-[#245a43] to-[#1b4332] text-white px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-amber-300 text-lg">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Stichtag-Regelwerk Editor
            </div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Liga: {props.leagueName || props.leagueId}
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/10 text-white font-normal">
                ID: {props.leagueId}
              </span>
            </h2>
          </div>
        </div>

        {props.onClose && (
          <button
            type="button"
            onClick={props.onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Schließen"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <i className={`fa-solid ${statusMessage.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Existing Versions Overview */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
              Gültige Regelwerke für diese Liga ({existingVersions.length})
            </h3>
            {editingVersionId && (
              <button
                type="button"
                onClick={handleResetToNew}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-[10px]"></i>
                Neues Stichtag-Regelwerk anlegen
              </button>
            )}
          </div>

          {isLoadingVersions ? (
            <div className="text-xs text-slate-500 py-3 flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin"></i> Lade Regelwerke...
            </div>
          ) : existingVersions.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              Noch kein spezifisches Regelwerk für diese Liga hinterlegt. Das System verwendet das Basis-Regelwerk oder Fallback-Werte.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {existingVersions.map((v) => {
                const isSelected = editingVersionId === v.id;
                const isBase = v.is_base_rule || v.effective_date === '2000-01-01';
                return (
                  <div
                    key={v.id}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-black text-slate-900">
                        ab {v.effective_date}
                      </span>
                      {isBase ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-800">
                          Basis
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSelectExisting(v)}
                            className="text-[10px] text-slate-600 hover:text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50"
                          >
                            Laden
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id)}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100"
                            title="Löschen"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>Sieg: <strong className="text-emerald-700">+{v.base_points_win}</strong> / Ndlg: <strong className="text-slate-700">+{v.base_points_loss}</strong> Pkt.</div>
                      <div>Max. Bonus: <strong className="text-amber-700">+{v.max_bonus}</strong> | k: <strong className="text-indigo-700">{v.logistic_factor}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-pen-ruler text-emerald-700"></i>
                {editingVersionId ? "Regelwerk bearbeiten" : "Neues Regelwerk definieren"}
              </h3>
              {editingVersionId && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Modus: Bestehendes Regelwerk ändern
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Effective Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Gültig ab Stichtag (YYYY-MM-DD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Regel gilt für alle Spiele ab diesem Datum.
                </p>
              </div>

              {/* Base Points Win */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Basis-Punkte Sieg <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  required
                  value={formData.base_points_win}
                  onChange={(e) => setFormData({ ...formData, base_points_win: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Garantierte Punkte bei Sieg (z. B. 5).
                </p>
              </div>

              {/* Base Points Loss */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Basis-Punkte Niederlage <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  required
                  value={formData.base_points_loss}
                  onChange={(e) => setFormData({ ...formData, base_points_loss: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Teilnahmepunkte bei Niederlage (z. B. 1).
                </p>
              </div>

              {/* Max Bonus */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Maximaler Bonus (B_max) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="200"
                  required
                  value={formData.max_bonus}
                  onChange={(e) => setFormData({ ...formData, max_bonus: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Maximaler Zusatzbonus bei Überraschungssieg (z. B. 25).
                </p>
              </div>

              {/* Logistic Steepness Factor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Steigungsfaktor k (Logistisch) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.005"
                  min="0.001"
                  max="1"
                  required
                  value={formData.logistic_factor}
                  onChange={(e) => setFormData({ ...formData, logistic_factor: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Sensitivität auf Ranglisten-Differenz (z. B. 0.05).
                </p>
              </div>

              {/* Inactivity Deduction */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Inaktivitätsabzug / Woche <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  required
                  value={formData.inactivity_deduction_per_week}
                  onChange={(e) => setFormData({ ...formData, inactivity_deduction_per_week: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Punkteverlust pro inaktiver Woche (z. B. 1).
                </p>
              </div>
            </div>
          </div>

          {/* Live Simulation Matrix */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4">
            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="fa-solid fa-calculator text-emerald-700"></i>
              Live-Vorschau der Punktevergabe (Mathematische Simulation)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Underdog-Sieg</div>
                <div className="text-[11px] text-slate-600">80 Pkt. schlägt 120 Pkt.</div>
                <div className="text-lg font-black text-emerald-700 mt-1">
                  +{simUnderdog.total} <span className="text-xs font-semibold text-slate-500">Pkt.</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  (Basis: +{simUnderdog.base} / Bonus: +{simUnderdog.bonus})
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Ausgeglichen</div>
                <div className="text-[11px] text-slate-600">100 Pkt. vs 100 Pkt.</div>
                <div className="text-lg font-black text-emerald-700 mt-1">
                  +{simEven.total} <span className="text-xs font-semibold text-slate-500">Pkt.</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  (Basis: +{simEven.base} / Bonus: +{simEven.bonus})
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Favoritensieg</div>
                <div className="text-[11px] text-slate-600">120 Pkt. schlägt 80 Pkt.</div>
                <div className="text-lg font-black text-emerald-700 mt-1">
                  +{simFavorite.total} <span className="text-xs font-semibold text-slate-500">Pkt.</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  (Basis: +{simFavorite.base} / Bonus: +{simFavorite.bonus})
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Niederlage / Inaktivität</div>
                <div className="text-[11px] text-slate-600">Niederlage: <strong className="text-slate-800">+{lossPoints} Pkt.</strong></div>
                <div className="text-sm font-black text-rose-700 mt-1">
                  -{decay4Weeks} Pkt. <span className="text-[10px] font-normal text-slate-500">(nach 4 Wo.)</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Abzug: -{formData.inactivity_deduction_per_week} Pkt. / Woche
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {props.onClose && (
              <button
                type="button"
                onClick={props.onClose}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] hover:from-[#143225] hover:to-[#1b4332] text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Speichere & berechne neu...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  {editingVersionId ? "Änderungen speichern" : "Regelwerk aktivieren"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
