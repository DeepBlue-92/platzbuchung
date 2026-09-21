import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy, Check, AlertTriangle } from 'lucide-react';
import { Match, MatchResult, MatchSetScore, TournamentInstance } from '../../types/championship';
import { formatParticipantById } from '../../utils/championshipNameResolver';
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
  // Empty strings by default so inputs are never prefilled
  const [set1P1, setSet1P1] = useState<string>('');
  const [set1P2, setSet1P2] = useState<string>('');
  const [set2P1, setSet2P1] = useState<string>('');
  const [set2P2, setSet2P2] = useState<string>('');
  const [set3P1, setSet3P1] = useState<string>('');
  const [set3P2, setSet3P2] = useState<string>('');
  const [isWalkover, setIsWalkover] = useState<boolean>(false);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<string>('');
  const [walkoverReason, setWalkoverReason] = useState<string>('Aufgabe');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isAnimatingIn, setIsAnimatingIn] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      const timer = setTimeout(() => setIsAnimatingIn(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsAnimatingIn(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!match) return;

    if (match.result) {
      // Load existing result if match was already played
      const sets = match.result.sets || [];
      setSet1P1(sets[0]?.player1Games !== undefined ? String(sets[0].player1Games) : '');
      setSet1P2(sets[0]?.player2Games !== undefined ? String(sets[0].player2Games) : '');
      setSet2P1(sets[1]?.player1Games !== undefined ? String(sets[1].player1Games) : '');
      setSet2P2(sets[1]?.player2Games !== undefined ? String(sets[1].player2Games) : '');
      setSet3P1(sets[2]?.player1Games !== undefined ? String(sets[2].player1Games) : '');
      setSet3P2(sets[2]?.player2Games !== undefined ? String(sets[2].player2Games) : '');
      setIsWalkover(!!match.result.isWalkover);
      setWalkoverWinnerId(match.result.winnerParticipantId || match.participant1Id || '');
      setWalkoverReason(
        match.result.walkoverReason === 'Verletzung / Aufgabe'
          ? 'Aufgabe'
          : match.result.walkoverReason || 'Aufgabe'
      );
    } else {
      // Clean, completely unpopulated fields for new entries
      setSet1P1('');
      setSet1P2('');
      setSet2P1('');
      setSet2P2('');
      setSet3P1('');
      setSet3P2('');
      setIsWalkover(false);
      setWalkoverWinnerId(match.participant1Id || '');
      setWalkoverReason('Aufgabe');
    }
    setErrorMessage(null);
  }, [match]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Calculate live set evaluation
  const setStatus = useMemo(() => {
    const s1_1 = set1P1.trim() !== '' ? parseInt(set1P1, 10) : null;
    const s1_2 = set1P2.trim() !== '' ? parseInt(set1P2, 10) : null;
    const s2_1 = set2P1.trim() !== '' ? parseInt(set2P1, 10) : null;
    const s2_2 = set2P2.trim() !== '' ? parseInt(set2P2, 10) : null;

    let s1Winner: 1 | 2 | null = null;
    if (s1_1 !== null && s1_2 !== null && !isNaN(s1_1) && !isNaN(s1_2)) {
      if (s1_1 > s1_2) s1Winner = 1;
      else if (s1_2 > s1_1) s1Winner = 2;
    }

    let s2Winner: 1 | 2 | null = null;
    if (s2_1 !== null && s2_2 !== null && !isNaN(s2_1) && !isNaN(s2_2)) {
      if (s2_1 > s2_2) s2Winner = 1;
      else if (s2_2 > s2_1) s2Winner = 2;
    }

    const isTieBreakRequired = s1Winner !== null && s2Winner !== null && s1Winner !== s2Winner;
    const isStraightSetsWin = s1Winner !== null && s2Winner !== null && s1Winner === s2Winner;
    const straightWinner = isStraightSetsWin ? s1Winner : null;

    return {
      s1_1,
      s1_2,
      s2_1,
      s2_2,
      s1Winner,
      s2Winner,
      isTieBreakRequired,
      isStraightSetsWin,
      straightWinner,
    };
  }, [set1P1, set1P2, set2P1, set2P2]);

  if (!isOpen || !match) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 220);
  };

  const formatParticipant = (pId: string | null): string => {
    return formatParticipantById(pId, tournament.participants, users);
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
        if (!walkoverWinnerId) {
          setErrorMessage('Bitte wähle den Gewinner durch Walkover aus.');
          setSaving(false);
          return;
        }
        winnerId = walkoverWinnerId;
        const isP1Winner = winnerId === match.participant1Id;
        sets.push(
          { setNumber: 1, player1Games: isP1Winner ? 6 : 0, player2Games: isP1Winner ? 0 : 6 },
          { setNumber: 2, player1Games: isP1Winner ? 6 : 0, player2Games: isP1Winner ? 0 : 6 }
        );
      } else {
        // Validate set 1
        if (set1P1.trim() === '' || set1P2.trim() === '') {
          setErrorMessage('Bitte gib das vollständige Ergebnis für den 1. Satz ein.');
          setSaving(false);
          return;
        }
        const s1_1 = parseInt(set1P1, 10);
        const s1_2 = parseInt(set1P2, 10);
        if (isNaN(s1_1) || isNaN(s1_2) || s1_1 < 0 || s1_2 < 0) {
          setErrorMessage('Ungültige Spiele-Anzahl im 1. Satz.');
          setSaving(false);
          return;
        }
        if (s1_1 === s1_2) {
          setErrorMessage('Im 1. Satz kann es kein Unentschieden geben (z. B. 6:4, 7:6).');
          setSaving(false);
          return;
        }

        // Validate set 2
        if (set2P1.trim() === '' || set2P2.trim() === '') {
          setErrorMessage('Bitte gib das vollständige Ergebnis für den 2. Satz ein.');
          setSaving(false);
          return;
        }
        const s2_1 = parseInt(set2P1, 10);
        const s2_2 = parseInt(set2P2, 10);
        if (isNaN(s2_1) || isNaN(s2_2) || s2_1 < 0 || s2_2 < 0) {
          setErrorMessage('Ungültige Spiele-Anzahl im 2. Satz.');
          setSaving(false);
          return;
        }
        if (s2_1 === s2_2) {
          setErrorMessage('Im 2. Satz kann es kein Unentschieden geben (z. B. 6:4, 7:6).');
          setSaving(false);
          return;
        }

        sets.push(
          { setNumber: 1, player1Games: s1_1, player2Games: s1_2 },
          { setNumber: 2, player1Games: s2_1, player2Games: s2_2 }
        );

        let p1Sets = s1_1 > s1_2 ? 1 : 0;
        let p2Sets = s1_2 > s1_1 ? 1 : 0;
        if (s2_1 > s2_2) p1Sets++;
        else p2Sets++;

        // If 1:1, Match-Tiebreak is mandatory
        if (p1Sets === 1 && p2Sets === 1) {
          if (set3P1.trim() === '' || set3P2.trim() === '') {
            setErrorMessage('Bei Satzgleichstand (1:1) ist die Eingabe des Match-Tiebreaks verpflichtend.');
            setSaving(false);
            return;
          }

          const s3_1 = parseInt(set3P1, 10);
          const s3_2 = parseInt(set3P2, 10);
          if (isNaN(s3_1) || isNaN(s3_2) || s3_1 < 0 || s3_2 < 0) {
            setErrorMessage('Ungültige Punkte-Anzahl im Match-Tiebreak.');
            setSaving(false);
            return;
          }
          if (s3_1 === s3_2) {
            setErrorMessage('Im Match-Tiebreak kann es kein Unentschieden geben (z. B. 10:8, 12:10).');
            setSaving(false);
            return;
          }

          sets.push({
            setNumber: 3,
            player1Games: s3_1,
            player2Games: s3_2,
            isChampionsTiebreak: tournament.matchFormat?.championsTiebreakFinalSet ?? true,
          });

          if (s3_1 > s3_2) p1Sets++;
          else p2Sets++;
        }

        if (p1Sets === p2Sets) {
          setErrorMessage('Es muss einen eindeutigen Sieger geben.');
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
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Fehler beim Speichern des Ergebnisses.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] top-0 left-0 right-0 bottom-0 m-0 p-0 flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
      onClick={handleClose}
      style={{
        opacity: !isAnimatingIn || isClosing ? 0 : 1,
        transitionDuration: isClosing ? '200ms' : '250ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isClosing ? 'none' : 'auto',
      }}
    >
      <div
        className="w-full sm:w-[480px] max-w-[100vw] h-full h-screen top-0 bottom-0 m-0 bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform:
            !isAnimatingIn || isClosing
              ? 'translateX(100%)'
              : 'translateX(0)',
          transitionDuration: isClosing ? '200ms' : '250ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header matching Reservation Slider style exactly */}
        <div className="bg-[var(--color-primary)] p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden top-0">
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

          <div className="relative z-10 min-w-0 pr-4">
            <div className="text-[11px] uppercase font-black tracking-widest text-white/80 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-white/90" />
              <span className="truncate">{tournament.title}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white mt-1">
              Ergebnis eintragen
            </h2>
            <p className="text-xs text-white/80 font-medium mt-0.5">
              {match.roundLabel || 'Begegnung'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="relative z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Match Participants Header */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
              <div className="p-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Spieler 1
                </span>
                <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                  {p1Name}
                </strong>
              </div>
              <div className="p-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Spieler 2
                </span>
                <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                  {p2Name}
                </strong>
              </div>
            </div>

            {/* Regular Score Inputs */}
            {!isWalkover && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Satz-Ergebnisse
                </label>

                {/* Set 1 */}
                <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-24">
                    <span className="text-xs font-bold text-slate-700 block">1. Satz</span>
                    {setStatus.s1Winner && (
                      <span className="text-[10px] font-bold text-emerald-700 block">
                        Satz an {setStatus.s1Winner === 1 ? 'Spieler 1' : 'Spieler 2'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="0"
                      value={set1P1}
                      onChange={(e) => setSet1P1(e.target.value)}
                      className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-slate-400 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="0"
                      value={set1P2}
                      onChange={(e) => setSet1P2(e.target.value)}
                      className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                {/* Set 2 */}
                <div className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-24">
                    <span className="text-xs font-bold text-slate-700 block">2. Satz</span>
                    {setStatus.s2Winner && (
                      <span className="text-[10px] font-bold text-emerald-700 block">
                        Satz an {setStatus.s2Winner === 1 ? 'Spieler 1' : 'Spieler 2'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="0"
                      value={set2P1}
                      onChange={(e) => setSet2P1(e.target.value)}
                      className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-slate-400 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="0"
                      value={set2P2}
                      onChange={(e) => setSet2P2(e.target.value)}
                      className="w-14 text-center py-1.5 border border-slate-300 rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                {/* Straight set win banner */}
                {setStatus.isStraightSetsWin && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      2:0 Sätze für {setStatus.straightWinner === 1 ? p1Name : p2Name}. Kein Match-Tiebreak erforderlich.
                    </span>
                  </div>
                )}

                {/* Match-Tiebreak (Mandatory on 1:1 tie) */}
                {setStatus.isTieBreakRequired && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          3. Satz (Match-Tiebreak bis 10)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="35"
                          placeholder="z.B. 10"
                          value={set3P1}
                          onChange={(e) => setSet3P1(e.target.value)}
                          className="w-16 text-center py-1.5 border border-amber-300 bg-white rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                        <span className="text-amber-600 font-bold">:</span>
                        <input
                          type="number"
                          min="0"
                          max="35"
                          placeholder="z.B. 8"
                          value={set3P2}
                          onChange={(e) => setSet3P2(e.target.value)}
                          className="w-16 text-center py-1.5 border border-amber-300 bg-white rounded-lg text-sm font-black focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Walkover / Aufgabe Switch (Nach unten verschoben) */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">w/o (Aufgabe) – 6:0, 6:0</span>
                <input
                  type="checkbox"
                  checked={!!isWalkover}
                  onChange={(e) => setIsWalkover(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                />
              </label>
              {isWalkover && (
                <div className="mt-3 space-y-2 pt-2.5 border-t border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-600">Gewinner durch w/o:</label>
                  <select
                    value={walkoverWinnerId || ''}
                    onChange={(e) => setWalkoverWinnerId(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer"
                  >
                    <option value={match.participant1Id || ''}>{p1Name}</option>
                    <option value={match.participant2Id || ''}>{p2Name}</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Grund (z. B. Aufgabe, Verletzung)"
                    value={walkoverReason || ''}
                    onChange={(e) => setWalkoverReason(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions Bar at Bottom */}
          <div className="p-4 px-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
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
    </div>,
    document.body
  );
};
