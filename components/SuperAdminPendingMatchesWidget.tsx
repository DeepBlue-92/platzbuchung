import React, { useState, useMemo } from 'react';
import { LeagueMatch, Person, User } from '../types';
import { isMatchExpired } from '../utils/leagueMatchHelper';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { recalculateLeaguePointsFrom } from '../services/league';
import { formatRelativeDate } from '../utils/date';
import { resolveClubName } from '../services/clubHelper';

export interface SuperAdminPendingMatchesWidgetProps {
  allMatches: LeagueMatch[];
  allPersons: (Person | User)[];
  currentUser: User;
}

export default function SuperAdminPendingMatchesWidget({
  allMatches,
  allPersons,
  currentUser,
}: SuperAdminPendingMatchesWidgetProps) {
  const [selectedMatch, setSelectedMatch] = useState<LeagueMatch | null>(null);
  const [cancellingMatch, setCancellingMatch] = useState<LeagueMatch | null>(null);

  const pendingMatches = useMemo(() => {
    return allMatches
      .filter((m) => m.status !== 'cancelled' && m.status !== 'aborted')
      .filter((m) => m.status === 'scheduled' || (!m.result && m.scheduledDate))
      .filter((m) => isMatchExpired(m))
      .sort((a, b) => {
        const aDate = new Date(`${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`).getTime();
        const bDate = new Date(`${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`).getTime();
        return aDate - bDate; // Oldest first
      });
  }, [allMatches]);

  const getUserName = (userId: string) => {
    const person = allPersons.find((p) => p.id === userId);
    if (!person) return 'Unbekannt';
    return person.firstName && person.lastName 
      ? `${person.firstName} ${person.lastName}`
      : (person as any).name || (person as any).klarname || 'Unbekannt';
  };

  if (pendingMatches.length === 0) return null;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-lg shrink-0">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Offene Ergebnis-Eingaben
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                {pendingMatches.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
              Spiele, deren Termin bereits in der Vergangenheit liegt, für die aber noch kein Ergebnis eingetragen wurde.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-widest font-black">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Termin</th>
              <th className="py-2.5 px-3">Spieler 1</th>
              <th className="py-2.5 px-3">Spieler 2</th>
              <th className="py-2.5 px-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="text-xs font-semibold text-slate-700">
            {pendingMatches.map((match) => {
              const p1Name = getUserName(match.player1UserId || match.player1Id);
              const p2Name = getUserName(match.player2UserId || match.player2Id);
              const matchDate = match.scheduledDate ? `${match.scheduledDate}T${match.scheduledStartTime || '00:00'}` : null;
              
              const isOlderThan24h = matchDate 
                ? (Date.now() - new Date(matchDate).getTime() > 24 * 60 * 60 * 1000)
                : false;

              return (
                <tr key={match.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOlderThan24h ? 'bg-rose-50/30' : ''}`}>
                  <td className="py-3 px-3">
                    {isOlderThan24h ? (
                      <span className="text-[9px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full uppercase font-black border border-rose-200">
                        &gt; 24H ÜBERFÄLLIG
                      </span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase font-black border border-amber-200">
                        OFFEN
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {match.scheduledDate ? formatRelativeDate(match.scheduledDate) : 'Unbekannt'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {match.scheduledStartTime || '00:00'} Uhr
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-3">{p1Name}</td>
                  <td className="py-3 px-3">{p2Name}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setCancellingMatch(match)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-rose-200 transition-colors"
                      >
                        Stornieren
                      </button>
                      <button
                        onClick={() => setSelectedMatch(match)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors"
                      >
                        Ergebnis eintragen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedMatch && (
        <AdminResultModal 
          match={selectedMatch} 
          p1Name={getUserName(selectedMatch.player1UserId || selectedMatch.player1Id)}
          p2Name={getUserName(selectedMatch.player2UserId || selectedMatch.player2Id)}
          currentUser={currentUser}
          onClose={() => setSelectedMatch(null)} 
        />
      )}

      {cancellingMatch && (
        <CancelMatchModal
          match={cancellingMatch}
          p1Name={getUserName(cancellingMatch.player1UserId || cancellingMatch.player1Id)}
          p2Name={getUserName(cancellingMatch.player2UserId || cancellingMatch.player2Id)}
          onClose={() => setCancellingMatch(null)}
        />
      )}
    </div>
  );
}

function CancelMatchModal({
  match,
  p1Name,
  p2Name,
  onClose
}: {
  match: LeagueMatch;
  p1Name: string;
  p2Name: string;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (confirmText !== 'Stornieren') return;
    setLoading(true);
    try {
      const matchRef = doc(db, 'league_matches', match.id);
      await updateDoc(matchRef, {
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });
      window.dispatchEvent(new CustomEvent('league-result-added'));
      onClose();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Stornieren.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="border-none outline-none bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4">
        <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest">Match Stornieren</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Soll das Spiel zwischen <strong>{p1Name}</strong> und <strong>{p2Name}</strong> wirklich unwiderruflich storniert werden? Es wird aus der Warteschlange entfernt.
        </p>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
            Bitte 'Stornieren' eingeben
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Stornieren"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-rose-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="h-10 px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Abbrechen</button>
          <button
            onClick={handleCancel}
            disabled={confirmText !== 'Stornieren' || loading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm"
          >
            {loading ? 'Storniere...' : 'Stornieren'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminResultModal({ 
  match, 
  p1Name, 
  p2Name, 
  currentUser,
  onClose 
}: { 
  match: LeagueMatch; 
  p1Name: string;
  p2Name: string;
  currentUser: User;
  onClose: () => void;
}) {
  const [completionType, setCompletionType] = useState<'regular' | 'retired' | 'aborted'>('regular');
  const [sets, setSets] = useState<{p1: number | '', p2: number | '', tb1?: number | null | '', tb2?: number | null | ''}[]>([{p1: '', p2: ''}, {p1: '', p2: ''}]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [retiredPlayerId, setRetiredPlayerId] = useState<string>('');
  const [abandonmentReason, setAbandonmentReason] = useState<string>(match.abandonmentReason || match.result?.abandonmentReason || '');

  const p1Id = match.player1UserId || match.player1Id;
  const p2Id = match.player2UserId || match.player2Id;

  const getSetWinner = (p1: number, p2: number) => {
    if (p1 > p2) return 'p1';
    if (p2 > p1) return 'p2';
    return null;
  };

  const handleSetChange = (index: number, field: 'p1' | 'p2' | 'tb1' | 'tb2', val: string) => {
    const newSets = [...sets];
    newSets[index][field] = val === '' ? '' : parseInt(val, 10);
    
    if (index < 2) {
      const s1p1 = index === 0 && field === 'p1' ? parseInt(val) : (newSets[0]?.p1 as number);
      const s1p2 = index === 0 && field === 'p2' ? parseInt(val) : (newSets[0]?.p2 as number);
      const s2p1 = index === 1 && field === 'p1' ? parseInt(val) : (newSets[1]?.p1 as number);
      const s2p2 = index === 1 && field === 'p2' ? parseInt(val) : (newSets[1]?.p2 as number);
      
      const w1 = getSetWinner(s1p1, s1p2);
      const w2 = getSetWinner(s2p1, s2p2);
      
      if (w1 && w2 && w1 !== w2) {
        if (newSets.length === 2) {
          newSets.push({p1: '', p2: ''});
        }
      } else {
        if (newSets.length > 2) {
          newSets.splice(2, newSets.length - 2);
        }
      }
    }
    
    setSets(newSets);
  };

  const handleSave = async () => {
    setError('');
    let calculatedWinnerId = '';
    let validatedSets: {p1: number, p2: number, tb1?: number | null, tb2?: number | null}[] = [];
    const scheduledDate = match.scheduledDate || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    if (completionType === 'aborted') {
      const finalReason = abandonmentReason.trim();
      if (!finalReason) {
        setError('Bitte gib den Grund für den Spielabbruch an.');
        return;
      }
      for (let i = 0; i < sets.length; i++) {
        const p1 = typeof sets[i].p1 === 'number' ? sets[i].p1 as number : NaN;
        const p2 = typeof sets[i].p2 === 'number' ? sets[i].p2 as number : NaN;
        if (!isNaN(p1) && !isNaN(p2)) {
          const tb1 = typeof sets[i].tb1 === 'number' ? sets[i].tb1 as number : null;
          const tb2 = typeof sets[i].tb2 === 'number' ? sets[i].tb2 as number : null;
          validatedSets.push({p1, p2, tb1, tb2});
        }
      }

      setLoading(true);
      try {
        const matchRef = doc(db, 'league_matches', match.id);
        await updateDoc(matchRef, {
          status: 'aborted',
          completionType: 'aborted',
          abandonmentReason: finalReason,
          result: {
            sets: validatedSets,
            reportedBy: currentUser.id,
            reportedAt: now,
            played_at: scheduledDate,
            completionType: 'aborted',
            abandonmentReason: finalReason,
          },
          played_at: scheduledDate,
          isProvisional: false,
          updatedAt: now
        });

        // Recalculate league points (this match will not award any win or points)
        await recalculateLeaguePointsFrom(scheduledDate);
        window.dispatchEvent(new CustomEvent('league-result-added'));
        onClose();
      } catch (err) {
        console.error(err);
        setError("Fehler beim Speichern des Spielabbruchs.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (completionType === 'retired') {
      if (!retiredPlayerId) {
        setError('Bitte wähle den aufgebenden Spieler aus.');
        return;
      }
      calculatedWinnerId = retiredPlayerId === p1Id ? p2Id! : p1Id!;
      for (let i = 0; i < sets.length; i++) {
        const p1 = typeof sets[i].p1 === 'number' ? sets[i].p1 as number : NaN;
        const p2 = typeof sets[i].p2 === 'number' ? sets[i].p2 as number : NaN;
        if (!isNaN(p1) && !isNaN(p2)) {
          const tb1 = typeof sets[i].tb1 === 'number' ? sets[i].tb1 as number : null;
          const tb2 = typeof sets[i].tb2 === 'number' ? sets[i].tb2 as number : null;
          validatedSets.push({p1, p2, tb1, tb2});
        }
      }
    } else {
      // Regular
      if (sets.length < 2) {
        setError("Bitte mindestens 2 Sätze eingeben.");
        return;
      }
      
      let p1Wins = 0;
      let p2Wins = 0;

      for (let i = 0; i < sets.length; i++) {
        const p1 = typeof sets[i].p1 === 'number' ? sets[i].p1 as number : NaN;
        const p2 = typeof sets[i].p2 === 'number' ? sets[i].p2 as number : NaN;
        if (isNaN(p1) || isNaN(p2)) {
          setError(`Ergebnis in Satz ${i+1} unvollständig.`);
          return;
        }

        if (i < 2) {
          if ((p1 === 6 && p2 <= 4) || (p2 === 6 && p1 <= 4) || (p1 === 7 && p2 === 5) || (p2 === 7 && p1 === 5)) {
            if (p1 > p2) p1Wins++; else p2Wins++;
            validatedSets.push({p1, p2});
          } else if (p1 === 7 && p2 === 6) {
            const tb1 = typeof sets[i].tb1 === 'number' ? sets[i].tb1 as number : NaN;
            const tb2 = typeof sets[i].tb2 === 'number' ? sets[i].tb2 as number : NaN;
            if (isNaN(tb1) || isNaN(tb2)) {
              setError(`Tiebreak-Ergebnis in Satz ${i+1} fehlt.`);
              return;
            }
            if (tb1 < 7 || tb1 - tb2 < 2) {
              setError(`Ungültiges Tiebreak-Ergebnis in Satz ${i+1} (p1).`);
              return;
            }
            p1Wins++;
            validatedSets.push({p1, p2, tb1, tb2});
          } else if (p2 === 7 && p1 === 6) {
            const tb1 = typeof sets[i].tb1 === 'number' ? sets[i].tb1 as number : NaN;
            const tb2 = typeof sets[i].tb2 === 'number' ? sets[i].tb2 as number : NaN;
            if (isNaN(tb1) || isNaN(tb2)) {
              setError(`Tiebreak-Ergebnis in Satz ${i+1} fehlt.`);
              return;
            }
            if (tb2 < 7 || tb2 - tb1 < 2) {
              setError(`Ungültiges Tiebreak-Ergebnis in Satz ${i+1} (p2).`);
              return;
            }
            p2Wins++;
            validatedSets.push({p1, p2, tb1, tb2});
          } else {
            setError(`Ungültiges Ergebnis in Satz ${i+1} (${p1}:${p2}). Erlaubt sind z.B. 6:4, 7:5 oder 7:6.`);
            return;
          }
        } else {
          // Satz 3 (Match-Tiebreak)
          if (p1 < 10 && p2 < 10) {
            setError(`Der Match-Tiebreak (Satz 3) muss bis mindestens 10 Punkte gespielt werden.`);
            return;
          }
          if (Math.abs(p1 - p2) < 2) {
            setError(`Der Match-Tiebreak (Satz 3) erfordert 2 Punkte Vorsprung.`);
            return;
          }
          if ((p1 > p2 && p1 > 10 && p1 - p2 > 2) || (p2 > p1 && p2 > 10 && p2 - p1 > 2)) {
            setError(`Ungültiges Ergebnis im Match-Tiebreak (Satz 3).`);
            return;
          }
          if (p1 > p2) p1Wins++; else p2Wins++;
          validatedSets.push({p1, p2});
        }
      }

      calculatedWinnerId = p1Wins > p2Wins ? p1Id! : p2Id!;
    }

    setLoading(true);
    try {
      const matchRef = doc(db, 'league_matches', match.id);

      await updateDoc(matchRef, {
        status: 'completed',
        completionType,
        result: {
          winnerId: calculatedWinnerId,
          sets: validatedSets,
          reportedBy: currentUser.id,
          reportedAt: now,
          played_at: scheduledDate,
          retiredPlayerId: completionType === 'retired' ? retiredPlayerId : null,
          completionType,
        },
        played_at: scheduledDate,
        isProvisional: false, // Admin inputs are final
        updatedAt: now
      });

      // Recalculate points globally
      await recalculateLeaguePointsFrom(scheduledDate);
      window.dispatchEvent(new CustomEvent('league-result-added'));
      onClose();
    } catch (err) {
      console.error(err);
      setError("Fehler beim Speichern des Ergebnisses.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="border-none outline-none bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            Admin Ergebnis-Override
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500 pb-1">
            <div className="flex-1 truncate">{p1Name}</div>
            <div className="px-3 text-slate-300">vs</div>
            <div className="flex-1 text-right truncate">{p2Name}</div>
          </div>

          {/* Completion Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Ausgang des Spiels
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCompletionType('regular')}
                className={`px-2.5 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center ${
                  completionType === 'regular'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <i className="fa-solid fa-trophy text-sm"></i>
                <span className="text-[11px] leading-tight">Regulär beendet</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletionType('retired')}
                className={`px-2.5 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center ${
                  completionType === 'retired'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <i className="fa-solid fa-user-injured text-sm"></i>
                <span className="text-[11px] leading-tight">Aufgabe (w.o.)</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletionType('aborted')}
                className={`px-2.5 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition text-center ${
                  completionType === 'aborted'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <i className="fa-solid fa-ban text-sm"></i>
                <span className="text-[11px] leading-tight">Spielabbruch</span>
              </button>
            </div>
          </div>

          {/* Conditional Retirement Block */}
          {completionType === 'retired' && (
            <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-circle-info text-amber-600 text-sm mt-0.5 shrink-0"></i>
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong className="font-bold">Aufgabe / Walkover:</strong> Der nicht-aufgebende Spieler erhält automatisch den Sieg und Ranglistenpunkte.
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Welcher Spieler hat aufgegeben? <span className="text-red-500">*</span>
                </label>
                <select
                  value={retiredPlayerId}
                  onChange={(e) => setRetiredPlayerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl h-8 px-3 py-1 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-sans font-medium"
                >
                  <option value="">-- Bitte wählen --</option>
                  <option value={p1Id}>{p1Name}</option>
                  <option value={p2Id}>{p2Name}</option>
                </select>
              </div>
            </div>
          )}

          {/* Conditional Abort Block */}
          {completionType === 'aborted' && (
            <div className="space-y-3 p-4 bg-rose-50/50 border border-rose-200 rounded-xl">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm mt-0.5 shrink-0"></i>
                <div className="text-xs text-rose-800 leading-relaxed">
                  <strong className="font-bold">Hinweis Spielabbruch:</strong> Das Spiel wird als abgebrochen markiert. Es werden <strong>weder Sieger noch Ranglistenpunkte</strong> vergeben.
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Grund des Abbruchs <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="z. B. Regen / Unwetter, Dunkelheit, Verletzung..."
                  value={abandonmentReason}
                  onChange={(e) => setAbandonmentReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl h-8 px-3 py-1 text-xs text-slate-800 focus:outline-none focus:border-rose-500 placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                />
              </div>
            </div>
          )}

          {/* Sets Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {completionType === 'aborted' ? 'Gespielte Sätze (optional)' : completionType === 'retired' ? 'Gespielte Sätze bis zur Aufgabe (optional)' : 'Sätze / Spielergebnis'}
              </label>
              {completionType === 'regular' && (
                <span className="text-[10px] font-medium text-slate-400">Best-of-3</span>
              )}
            </div>

            <div className="space-y-3">
              {sets.map((set, i) => (
                <div key={i} className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 w-24">{i === 2 ? 'Match-Tie-Break' : `Satz ${i + 1}`}</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={set.p1 === '' ? '' : set.p1}
                      onChange={e => handleSetChange(i, 'p1', e.target.value)}
                      className="w-14 h-10 text-center text-lg border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                    <span className="text-slate-300 font-black">:</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={set.p2 === '' ? '' : set.p2}
                      onChange={e => handleSetChange(i, 'p2', e.target.value)}
                      className="w-14 h-10 text-center text-lg border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  {i < 2 && (set.p1 === 7 && set.p2 === 6 || set.p1 === 6 && set.p2 === 7) && (
                    <div className="flex items-center justify-center gap-3 pl-24">
                      <span className="text-[10px] font-bold text-slate-400 w-6">TB:</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={set.tb1 ?? ''}
                        onChange={(e) => handleSetChange(i, 'tb1', e.target.value)}
                        className="w-10 h-8 bg-slate-50 border border-slate-200 rounded-md text-center text-[11px] text-slate-600 focus:outline-none focus:border-emerald-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                      <span className="text-slate-300 font-black text-[10px]">:</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={set.tb2 ?? ''}
                        onChange={(e) => handleSetChange(i, 'tb2', e.target.value)}
                        className="w-10 h-8 bg-slate-50 border border-slate-200 rounded-md text-center text-[11px] text-slate-600 focus:outline-none focus:border-emerald-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="h-10 px-4 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={`px-6 py-2 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
              completionType === 'aborted'
                ? 'bg-rose-600 hover:bg-rose-700'
                : completionType === 'retired'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {loading ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> Speichern...</>
            ) : completionType === 'aborted' ? (
              'Spielabbruch speichern'
            ) : completionType === 'retired' ? (
              'Aufgabe & Sieg speichern'
            ) : (
              'Ergebnis sichern'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
