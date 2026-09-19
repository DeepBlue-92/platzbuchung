import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Person, DynamicLeague, User, LeaguePlayer, LeagueMatch } from '../types';
import { applyAdminPointsCorrection } from '../services/league';

interface Props {
  allPersons: Person[];
  dynamicLeagues: DynamicLeague[];
  currentUser: User;
}

interface PlayerRowItem {
  userId: string;
  name: string;
  email: string;
  clubId: string;
  clubName: string;
  leagueId: string;
  leagueName: string;
  currentPoints: number;
  matchCount: number;
  lastActive: string | null;
  person?: Person;
}

export default function SuperAdminPointsManagement({
  allPersons,
  dynamicLeagues,
  currentUser,
}: Props) {
  const [leagueProfiles, setLeagueProfiles] = useState<Record<string, LeaguePlayer>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState('all');
  const [selectedClubFilter, setSelectedClubFilter] = useState('all');

  // Selection states
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetPlayers, setTargetPlayers] = useState<PlayerRowItem[]>([]);
  const [adjustmentMode, setAdjustmentMode] = useState<'relative' | 'absolute'>('relative');
  const [adjustmentValue, setAdjustmentValue] = useState<string>('10.0');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Listen to league profiles in real-time
  useEffect(() => {
    setLoadingProfiles(true);
    const q = query(collection(db, 'league_profiles'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const map: Record<string, LeaguePlayer> = {};
        snapshot.docs.forEach((docSnap) => {
          map[docSnap.id] = { id: docSnap.id, ...(docSnap.data() as any) };
        });
        setLeagueProfiles(map);
        setLoadingProfiles(false);
      },
      (err) => {
        console.error('Error loading league profiles:', err);
        setLoadingProfiles(false);
      }
    );

    return () => unsub();
  }, []);

  // Build rows combining all persons and their league profile
  const playerRows: PlayerRowItem[] = useMemo(() => {
    return allPersons.map((p) => {
      const pId = p.id;
      const profile = leagueProfiles[pId];
      const name = p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : p.name || pId;
      const email = p.email || '';
      const clubId = profile?.clubId || p.vereinsId || 'sv-neuhausen';
      const leagueId = profile?.leagueId || '';
      
      const leagueObj = dynamicLeagues.find((l) => l.id === leagueId);
      const leagueName = leagueObj ? leagueObj.name : leagueId ? leagueId : 'Nicht zugeordnet';

      const currentPoints = profile && typeof profile.basePoints === 'number' && !isNaN(profile.basePoints)
        ? profile.basePoints
        : 0;

      const matchCount = profile?.matchesCount || 0;
      const lastActive = profile?.lastMatchDate || profile?.updatedAt || null;

      let clubName = clubId;
      if (clubId === 'sv-neuhausen') clubName = 'SV Neuhausen';
      else if (clubId === 'djk-furth') clubName = 'DJK Furth';

      return {
        userId: pId,
        name,
        email,
        clubId,
        clubName,
        leagueId,
        leagueName,
        currentPoints,
        matchCount,
        lastActive,
        person: p,
      };
    });
  }, [allPersons, leagueProfiles, dynamicLeagues]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return playerRows
      .filter((row) => {
        if (selectedLeagueFilter !== 'all') {
          if (row.leagueId !== selectedLeagueFilter) return false;
        }
        if (selectedClubFilter !== 'all') {
          if (row.clubId !== selectedClubFilter) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = row.name.toLowerCase().includes(q);
          const matchEmail = row.email.toLowerCase().includes(q);
          const matchClub = row.clubName.toLowerCase().includes(q);
          const matchId = row.userId.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchClub && !matchId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by points desc, then name asc
        if (b.currentPoints !== a.currentPoints) {
          return b.currentPoints - a.currentPoints;
        }
        return a.name.localeCompare(b.name);
      });
  }, [playerRows, selectedLeagueFilter, selectedClubFilter, searchQuery]);

  // Available clubs in filter
  const uniqueClubs = useMemo(() => {
    const s = new Set<string>();
    playerRows.forEach((r) => {
      if (r.clubId) s.add(r.clubId);
    });
    return Array.from(s);
  }, [playerRows]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredRows.map((r) => r.userId));
      setSelectedUserIds(allIds);
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleRowClick = (userId: string, index: number, event: React.MouseEvent) => {
    const isShift = event.shiftKey;
    const newSet = new Set(selectedUserIds);

    if (isShift && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      for (let i = start; i <= end; i++) {
        const item = filteredRows[i];
        if (item) newSet.add(item.userId);
      }
      setSelectedUserIds(newSet);
    } else {
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      setSelectedUserIds(newSet);
      lastClickedIndexRef.current = index;
    }
  };

  const openAdjustmentModal = (players: PlayerRowItem[]) => {
    setTargetPlayers(players);
    setAdjustmentMode('relative');
    setAdjustmentValue('10.0');
    setCorrectionReason('');
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleSingleAdjust = (player: PlayerRowItem, e: React.MouseEvent) => {
    e.stopPropagation();
    openAdjustmentModal([player]);
  };

  const handleBatchAdjust = () => {
    const selected = filteredRows.filter((r) => selectedUserIds.has(r.userId));
    if (selected.length === 0) return;
    openAdjustmentModal(selected);
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPlayers.length === 0) return;
    if (!correctionReason.trim()) {
      setActionError('Bitte gib einen aussagekräftigen Grund für die Punkte-Korrektur an (z. B. "Manuelle Admin-Korrektur").');
      return;
    }

    const numVal = parseFloat(adjustmentValue.replace(',', '.'));
    if (isNaN(numVal)) {
      setActionError('Bitte gib einen gültigen Zahlenwert ein.');
      return;
    }

    if (adjustmentMode === 'absolute' && numVal < 0) {
      setActionError('Der absolute Punktestand darf nicht negativ sein (Startwert >= 0.0).');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const playerIds = targetPlayers.map((p) => p.userId);
      const res = await applyAdminPointsCorrection({
        playerIds,
        mode: adjustmentMode,
        value: numVal,
        reason: correctionReason.trim(),
        adminUser: {
          id: currentUser.id,
          name: currentUser.name || (currentUser as any).firstName ? `${(currentUser as any).firstName || ''} ${(currentUser as any).lastName || ''}`.trim() : 'Super-Admin',
          email: currentUser.email,
        },
      });

      setIsModalOpen(false);
      setSelectedUserIds(new Set());
      setNotification({
        text: `Punkte für ${res.count} Spieler erfolgreich ${adjustmentMode === 'absolute' ? `auf ${numVal.toFixed(1)} Pkt. gesetzt` : `angepasst (${numVal >= 0 ? `+${numVal.toFixed(1)}` : numVal.toFixed(1)} Pkt.)`} inklusive Audit-Trail-Eintrag.`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      console.error('Error applying points correction:', err);
      setActionError(`Fehler beim Speichern: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedUserIds.has(r.userId));
  const isPartiallySelected = filteredRows.some((r) => selectedUserIds.has(r.userId)) && !isAllSelected;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 text-lg shrink-0">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Spieler-Punkteverwaltung & Korrektur-Tool
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                {playerRows.length} {playerRows.length === 1 ? 'Spieler' : 'Spieler'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
              Übersicht aller Liga-Teilnehmer mit Multi-Selektion. Setze absolute Werte oder addiere/subtrahiere Punkte mit transparentem Audit-Trail für den Spieler.
            </p>
          </div>
        </div>

        {/* Batch Action Button */}
        {selectedUserIds.size > 0 && (
          <button
            type="button"
            onClick={handleBatchAdjust}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 animate-in fade-in"
          >
            <i className="fa-solid fa-pen-to-square"></i>
            <span>Punkte anpassen ({selectedUserIds.size})</span>
          </button>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
            }`}
          ></i>
          <span>{notification.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
            Suche (Name / E-Mail / ID)
          </label>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Spieler suchen..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
            Liga-Filter
          </label>
          <select
            value={selectedLeagueFilter}
            onChange={(e) => setSelectedLeagueFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans font-medium"
          >
            <option value="all">Alle Ligen</option>
            {dynamicLeagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.active ? '' : '(Inaktiv)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
            Vereins-Filter
          </label>
          <select
            value={selectedClubFilter}
            onChange={(e) => setSelectedClubFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-sans font-medium"
          >
            <option value="all">Alle Vereine</option>
            {uniqueClubs.map((c) => (
              <option key={c} value={c}>
                {c === 'sv-neuhausen' ? 'SV Neuhausen' : c === 'djk-furth' ? 'DJK Furth' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Multi-Selection Control Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
        <div className="flex items-center gap-2">
          <span>{filteredRows.length} Spieler gelistet</span>
          {selectedUserIds.size > 0 && (
            <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
              {selectedUserIds.size} ausgewählt
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400">Tipp: Halte <strong>Shift</strong> gedrückt für Bereichs-Auswahl</span>
          {selectedUserIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedUserIds(new Set())}
              className="text-rose-600 hover:underline font-bold cursor-pointer"
            >
              Auswahl aufheben
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loadingProfiles ? (
        <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
          <i className="fa-solid fa-circle-notch fa-spin text-xl text-indigo-600"></i>
          <span className="text-xs">Lade Spieler & Punktestände...</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs font-medium">
          Keine passenden Spieler für die aktuellen Filterkriterien gefunden.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="table-fixed w-full text-left border-collapse select-none">
            <colgroup>
              <col className="w-12" />
              <col className="w-auto min-w-[180px]" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="px-3 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    title="Alle auswählen"
                  />
                </th>
                <th className="h-8 px-3 py-1 text-slate-700 font-sans font-medium">Spieler / Name</th>
                <th className="h-8 px-3 py-1 text-slate-700 font-sans font-medium">Verein</th>
                <th className="h-8 px-3 py-1 text-slate-700 font-sans font-medium">Liga</th>
                <th className="h-8 px-3 py-1 text-slate-700 text-center font-sans font-medium">Spiele</th>
                <th className="h-8 px-3 py-1 text-slate-700 text-right font-sans font-medium">Aktuelle Punkte</th>
                <th className="h-8 px-3 py-1 text-slate-700 text-right font-sans font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRows.map((row, idx) => {
                const isSelected = selectedUserIds.has(row.userId);
                return (
                  <tr
                    key={row.userId}
                    onClick={(e) => handleRowClick(row.userId, idx, e)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedUserIds);
                          if (e.target.checked) newSet.add(row.userId);
                          else newSet.delete(row.userId);
                          setSelectedUserIds(newSet);
                          lastClickedIndexRef.current = idx;
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </td>
                    <td className="h-8 px-3 py-1 overflow-hidden font-sans font-medium">
                      <div className="font-bold text-slate-900 flex items-center gap-2 truncate">
                        <span className="truncate">{row.name}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal truncate">
                        {row.email || <span className="italic">Keine E-Mail</span>}
                      </div>
                    </td>
                    <td className="h-8 px-3 py-1 overflow-hidden font-sans font-medium">
                      <span className="text-slate-600 truncate block text-xs">
                        {row.clubName}
                      </span>
                    </td>
                    <td className="h-8 px-3 py-1 overflow-hidden font-sans font-medium">
                      <span className="text-slate-600 truncate block text-xs">
                        {row.leagueName}
                      </span>
                    </td>
                    <td className="h-8 px-3 py-1 text-center text-slate-700 text-xs font-sans font-medium">
                      {row.matchCount}
                    </td>
                    <td className="h-8 px-3 py-1 text-right font-sans font-medium">
                      <span className="text-slate-800 text-xs font-normal font-mono">
                        {row.currentPoints.toFixed(1)} Pkt.
                      </span>
                    </td>
                    <td className="h-8 px-3 py-1 text-right font-sans font-medium" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleSingleAdjust(row, e)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5 ml-auto"
                        title="Punkte für diesen Spieler korrigieren"
                      >
                        <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                        <span>Anpassen</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Points Adjustment */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl w-full max-w-lg shadow-2xl -200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <i className="fa-solid fa-sliders text-sm"></i>
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">
                    {targetPlayers.length === 1
                      ? 'Punkte-Korrektur (Einzelspieler)'
                      : `Batch-Korrektur (${targetPlayers.length} Spieler)`}
                  </h3>
                  <p className="text-[11px] text-indigo-100 font-medium">
                    {targetPlayers.length === 1
                      ? targetPlayers[0].name
                      : `${targetPlayers.slice(0, 3).map((p) => p.name).join(', ')}${targetPlayers.length > 3 ? ` und ${targetPlayers.length - 3} weitere` : ''}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white transition p-1 text-base cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleApplyAdjustment} className="p-6 space-y-5">
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                  <span>{actionError}</span>
                </div>
              )}

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Korrektur-Modus auswählen
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('relative');
                      setAdjustmentValue('10.0');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                      adjustmentMode === 'relative'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase">Relativer Wert</span>
                      <i className="fa-solid fa-plus-minus text-indigo-600"></i>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Punkte aufaddieren oder abziehen (z. B. +10 oder -5)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('absolute');
                      setAdjustmentValue(targetPlayers.length === 1 ? targetPlayers[0].currentPoints.toFixed(1) : '100.0');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                      adjustmentMode === 'absolute'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase">Absoluter Wert</span>
                      <i className="fa-solid fa-equals text-indigo-600"></i>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Fester Punktestand setzen (z. B. 100.0)
                    </span>
                  </button>
                </div>
              </div>

              {/* Value Input and Presets */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{adjustmentMode === 'relative' ? 'Punktveränderung (+ / -)' : 'Neuer absoluter Punktestand'}</span>
                  <span className="text-[10px] text-slate-400 font-bold">Startwert: 0.0</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    required
                    min={adjustmentMode === 'absolute' ? 0 : -9999}
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl h-8 px-3 py-1 text-base text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Schnellwahl:</span>
                  {adjustmentMode === 'relative' ? (
                    <>
                      {['+5.0', '+10.0', '+25.0', '+50.0', '-5.0', '-10.0'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAdjustmentValue(p.replace('+', ''))}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                        >
                          {p}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {['0.0', '50.0', '100.0', '150.0', '200.0'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAdjustmentValue(p)}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                        >
                          {p}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-calculator text-slate-400"></i>
                  Vorschau der Punkteberechnung
                </div>
                {targetPlayers.length === 1 ? (
                  (() => {
                    const p = targetPlayers[0];
                    const val = parseFloat(adjustmentValue.replace(',', '.')) || 0;
                    const newTot = adjustmentMode === 'absolute' ? val : Math.max(0, p.currentPoints + val);
                    const delta = newTot - p.currentPoints;
                    return (
                      <div className="flex items-center justify-between text-xs bg-white h-8 px-3 py-1 rounded-lg border border-slate-200 font-sans font-medium">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Bisher</span>
                          <strong className="font-mono text-slate-700">{p.currentPoints.toFixed(1)} Pkt.</strong>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-300"></i>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Delta</span>
                          <strong
                            className={`font-mono ${
                              delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-700'
                            }`}
                          >
                            {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} Pkt.
                          </strong>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-300"></i>
                        <div>
                          <span className="text-indigo-600 font-bold block text-[10px]">Neuer Gesamtstand</span>
                          <strong className="font-mono text-indigo-950 font-black text-sm bg-indigo-50 px-2 py-0.5 rounded">
                            {newTot.toFixed(1)} Pkt.
                          </strong>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-slate-600">
                    Wird für alle <strong>{targetPlayers.length} ausgewählten Spieler</strong> angewendet.
                    Startwerte werden mit {adjustmentMode === 'absolute' ? `genau ${parseFloat(adjustmentValue || '0').toFixed(1)} Pkt.` : `${parseFloat(adjustmentValue || '0') >= 0 ? '+' : ''}${parseFloat(adjustmentValue || '0').toFixed(1)} Pkt.`} aktualisiert.
                  </div>
                )}
              </div>

              {/* Reason Input (MANDATORY) */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Korrekturgrund (Pflichtfeld für Audit Trail) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-indigo-600 font-bold">Wird für Spieler transparent sichtbar</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Manuelle Admin-Korrektur, Saison-Ausgleich, Test..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      <span>Speichern...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Korrektur ausführen</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
