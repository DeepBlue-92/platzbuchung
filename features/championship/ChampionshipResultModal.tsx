import React, { useState, useEffect } from 'react';
import { X, Trophy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Match, MatchResult, MatchSetScore, TournamentInstance } from '../../types/championship';
import { User } from '../../types';

interface ChampionshipResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  tournament: TournamentInstance;
  currentUser: User | null;
  onSaveResult: (matchId: string, result: MatchResult) => Promise<void>;
  users: Record<string, User>;
}

export const ChampionshipResultModal: React.FC<ChampionshipResultModalProps> = ({
  isOpen,
  onClose,
  match,
  tournament,
  currentUser,
  onSaveResult,
  users,
}) => {
  const [set1P1, setSet1P1] = useState<number>(6);
  const [set1P2, setSet1P2] = useState<number>(4);
  const [set2P1, setSet2P1] = useState<number>(6);
  const [set2P2, setSet2P2] = useState<number>(3);
  const [set3Active, setSet3Active] = useState<boolean>(false);
  const [set3P1, setSet3P1] = useState<number>(10);
  const [set3P2, setSet3P2] = useState<number>(7);
  const [isWalkover, setIsWalkover] = useState<boolean>(false);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<string>('');
  const [walkoverReason, setWalkoverReason] = useState<string>('Verletzung / Aufgabe');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!match) return;

    if (match.result) {
      const sets = match.result.sets || [];
      if (sets[0]) {
        setSet1P1(sets[0].player1Games ?? 6);
        setSet1P2(sets[0].player2Games ?? 0);
      }
      if (sets[1]) {
        setSet2P1(sets[1].player1Games ?? 6);
        setSet2P2(sets[1].player2Games ?? 0);
      }
      if (sets[2]) {
        setSet3Active(true);
        setSet3P1(sets[2].player1Games ?? 10);
        setSet3P2(sets[2].player2Games ?? 7);
      } else {
        setSet3Active(false);
      }
      setIsWalkover(!!match.result.isWalkover);
      setWalkoverWinnerId(match.result.winnerParticipantId || match.participant1Id || '');
      setWalkoverReason(match.result.walkoverReason || 'Verletzung / Aufgabe');
    } else {
      // Default initial states
      setSet1P1(6);
      setSet1P2(4);
      setSet2P1(6);
      setSet2P2(3);
      setSet3Active(false);
      setSet3P1(10);
      setSet3P2(8);
      setIsWalkover(false);
      setWalkoverWinnerId(match.participant1Id || '');
      setWalkoverReason('Verletzung / Aufgabe');
    }
    setErrorMessage(null);
  }, [match]);

  if (!isOpen || !match) return null;

  const getPlayerDisplayName = (playerId: string): string => {
    const u = users[playerId.toLowerCase().replace(/\s/g, '')] || users[playerId];
    if (u) {
      const first = u.firstName || '';
      const last = u.lastName || '';
      if (first && last) return `${first} ${last}`;
      return u.name || playerId;
    }
    return playerId;
  };

  const formatParticipant = (pId: string | null): string => {
    if (!pId) return 'Noch offen (TBD)';
    const p = tournament.participants.find((x) => x.id === pId);
    if (!p) return pId;
    return p.playerIds.map(getPlayerDisplayName).join(' / ');
  };

  const p1Name = formatParticipant(match.participant1Id);
  const p2Name = formatParticipant(match.participant2Id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match.participant1Id || !match.participant2Id) {
      setErrorMessage('Partie kann noch nicht gewertet werden, da noch Teilnehmer fehlen.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      let winnerId = '';
      const sets: MatchSetScore[] = [];

      if (isWalkover) {
        winnerId = walkoverWinnerId || match.participant1Id;
        const isP1Winner = winnerId === match.participant1Id;
        sets.push(
          { setNumber: 1, player1Games: isP1Winner ? 6 : 0, player2Games: isP1Winner ? 0 : 6 },
          { setNumber: 2, player1Games: isP1Winner ? 6 : 0, player2Games: isP1Winner ? 0 : 6 }
        );
      } else {
        // Evaluate winner based on sets won
        let p1Sets = 0;
        let p2Sets = 0;

        if (set1P1 > set1P2) p1Sets++;
        else if (set1P2 > set1P1) p2Sets++;

        if (set2P1 > set2P2) p1Sets++;
        else if (set2P2 > set2P1) p2Sets++;

        sets.push(
          { setNumber: 1, player1Games: set1P1, player2Games: set1P2 },
          { setNumber: 2, player1Games: set2P1, player2Games: set2P2 }
        );

        if (set3Active || (p1Sets === 1 && p2Sets === 1)) {
          if (set3P1 > set3P2) p1Sets++;
          else if (set3P2 > set3P1) p2Sets++;

          sets.push({
            setNumber: 3,
            player1Games: set3P1,
            player2Games: set3P2,
            isChampionsTiebreak: tournament.matchFormat?.championsTiebreakFinalSet ?? true,
          });
        }

        if (p1Sets === p2Sets) {
          setErrorMessage('Es muss einen eindeutigen Sieger geben (kein Unentschieden im Tennis).');
          setSaving(false);
          return;
        }

        winnerId = p1Sets > p2Sets ? match.participant1Id : match.participant2Id;
      }

      const resultPayload: MatchResult = {
        winnerParticipantId: winnerId,
        sets,
        isWalkover,
        walkoverReason: isWalkover ? walkoverReason : undefined,
        enteredByUserId: currentUser?.id || 'anonymous',
        enteredByUserName: currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || 'Benutzer',
        enteredAt: new Date().toISOString(),
      };

      await onSaveResult(match.id, resultPayload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Fehler beim Speichern des Ergebnisses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-[var(--color-primary)] rounded-xl">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Spielergebnis eintragen</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {match.roundLabel} · {tournament.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Match Participants Header */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <div className="p-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Spieler 1</span>
              <strong className="text-xs font-bold text-slate-900 block truncate">{p1Name}</strong>
            </div>
            <div className="p-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Spieler 2</span>
              <strong className="text-xs font-bold text-slate-900 block truncate">{p2Name}</strong>
            </div>
          </div>

          {/* Walkover / Aufgabe Switch */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-slate-800">Aufgabe / Walkover (6:0, 6:0)</span>
              <input
                type="checkbox"
                checked={!!isWalkover}
                onChange={(e) => setIsWalkover(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-primary)] rounded"
              />
            </label>
            {isWalkover && (
              <div className="mt-3 space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600">Gewinner durch Walkover:</label>
                <select
                  value={walkoverWinnerId || ''}
                  onChange={(e) => setWalkoverWinnerId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value={match.participant1Id || ''}>{p1Name}</option>
                  <option value={match.participant2Id || ''}>{p2Name}</option>
                </select>
                <input
                  type="text"
                  placeholder="Grund (z. B. Verletzung im Vorfeld)"
                  value={walkoverReason || ''}
                  onChange={(e) => setWalkoverReason(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 placeholder:text-slate-400"
                />
              </div>
            )}
          </div>

          {/* Regular Score Inputs */}
          {!isWalkover && (
            <div className="space-y-3">
              {/* Set 1 */}
              <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-700 w-16">1. Satz</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set1P1 ?? 0}
                    onChange={(e) => setSet1P1(parseInt(e.target.value) || 0)}
                    className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <span className="text-slate-400 font-bold">:</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set1P2 ?? 0}
                    onChange={(e) => setSet1P2(parseInt(e.target.value) || 0)}
                    className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Set 2 */}
              <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-700 w-16">2. Satz</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set2P1 ?? 0}
                    onChange={(e) => setSet2P1(parseInt(e.target.value) || 0)}
                    className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <span className="text-slate-400 font-bold">:</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={set2P2 ?? 0}
                    onChange={(e) => setSet2P2(parseInt(e.target.value) || 0)}
                    className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Set 3 / Champions Tiebreak */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={set3Active}
                      onChange={(e) => setSet3Active(e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-primary)] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      3. Satz {tournament.matchFormat?.championsTiebreakFinalSet ? '(Champions Tiebreak bis 10)' : ''}
                    </span>
                  </label>
                  {set3Active && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={set3P1 ?? 10}
                        onChange={(e) => setSet3P1(parseInt(e.target.value) || 0)}
                        className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                      />
                      <span className="text-slate-400 font-bold">:</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={set3P2 ?? 8}
                        onChange={(e) => setSet3P2(parseInt(e.target.value) || 0)}
                        className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Audit Submitter Notice */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span>
                Ergebnis wird transparent unter deinem Namen erfasst (keine Bestätigungspflicht; Administratoren können jederzeit korrigieren).
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Speichern...' : 'Ergebnis speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
