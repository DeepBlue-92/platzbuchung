import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LeaguePlayer, User, LeagueMatch } from '../types';
import { createLeagueMatch, updateLeagueMatchResult, editLeagueMatchResult, abortLeagueMatch, getLeagueConfigVersions } from '../services/league';
import { calculatePoints, applyDecay, LeaguePointConfig, getConfigForDate } from '../services/leagueEngine';
import { KNOWN_CLUBS_STAMMDATEN } from '../lib/userUtils';

interface LeagueResultDrawerProps {
  match?: LeagueMatch | null;
  prefilledMatchId?: string;
  prefilledOpponentId?: string;
  prefilledDate?: string;
  editingMatch?: LeagueMatch | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  profile: LeaguePlayer;
  allProfiles: LeaguePlayer[];
  defaultConfig: LeaguePointConfig;
  onSuccess: () => void;
  getUserName: (userId: string) => string;
  leagueId?: string;
  primaryColor?: string;
}

export function LeagueResultDrawer({
  match,
  prefilledMatchId,
  prefilledOpponentId,
  prefilledDate,
  editingMatch,
  isOpen,
  onClose,
  currentUser,
  profile,
  allProfiles,
  defaultConfig,
  onSuccess,
  getUserName,
  leagueId,
  primaryColor = 'var(--color-primary)'
}: LeagueResultDrawerProps) {
  const [opponentId, setOpponentId] = useState<string>(prefilledOpponentId || '');
  const [date, setDate] = useState<string>(prefilledDate || new Date().toISOString().split('T')[0]);
  const [winnerId, setWinnerId] = useState<string>('');
  const [completionType, setCompletionType] = useState<'regular' | 'retired' | 'aborted'>('regular');
  const [retiredPlayerId, setRetiredPlayerId] = useState<string>('');
  const [abandonmentReason, setAbandonmentReason] = useState<string>('');
  
  // Set scores
  type SetInput = { p1: number | ''; p2: number | ''; tb1?: number | null | ''; tb2?: number | null | '' };
  const [sets, setSets] = useState<SetInput[]>([{p1: '', p2: ''}, {p1: '', p2: ''}]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Lock body & html scroll when open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const activeMatch = editingMatch || match;

  // Effective immutable match date
  const effectiveDate = useMemo(() => {
    return (
      activeMatch?.scheduledDate ||
      activeMatch?.played_at ||
      activeMatch?.result?.played_at ||
      prefilledDate ||
      date ||
      new Date().toISOString().split('T')[0]
    );
  }, [activeMatch, prefilledDate, date]);

  // Formatted date string in German: z. B. "Sonntag, 27.09.2026"
  const formattedDate = useMemo(() => {
    if (!effectiveDate) return 'Datum nicht festgelegt';
    const parts = effectiveDate.split('-');
    let d: Date;
    if (parts.length === 3) {
      const [yr, mon, day] = parts.map(Number);
      d = new Date(yr, mon - 1, day);
    } else {
      d = new Date(effectiveDate);
    }
    if (isNaN(d.getTime())) return effectiveDate;
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [effectiveDate]);

  // Formatted time range: z. B. "15:00 - 17:00 Uhr"
  const displayTimeRange = useMemo(() => {
    const start = activeMatch?.scheduledStartTime;
    const end = activeMatch?.scheduledEndTime;
    if (start && end) {
      return `${start} - ${end} Uhr`;
    }
    if (start) {
      return `${start} Uhr`;
    }
    return '15:00 - 17:00 Uhr';
  }, [activeMatch?.scheduledStartTime, activeMatch?.scheduledEndTime]);

  // Venue / Club display: z. B. "DJK Fürth"
  const displayVenue = useMemo(() => {
    if (activeMatch?.facilityName) return activeMatch.facilityName;
    if (activeMatch?.clubName) return activeMatch.clubName;
    if (activeMatch?.clubId && KNOWN_CLUBS_STAMMDATEN[activeMatch.clubId]?.clubName) {
      return KNOWN_CLUBS_STAMMDATEN[activeMatch.clubId].clubName;
    }
    return 'Vereinsanlage';
  }, [activeMatch?.facilityName, activeMatch?.clubName, activeMatch?.clubId]);

  // Court display: z. B. "Platz 1"
  const displayCourt = useMemo(() => {
    if (activeMatch?.court) return activeMatch.court;
    return 'Platz 1';
  }, [activeMatch?.court]);

  React.useEffect(() => {
    if (isOpen) {
      setError('');
      if (editingMatch) {
        const oppId = editingMatch.player1UserId === currentUser.id ? editingMatch.player2UserId : editingMatch.player1UserId;
        setOpponentId(oppId);
        setDate(editingMatch.played_at || editingMatch.result?.played_at || editingMatch.scheduledDate || new Date().toISOString().split('T')[0]);
        setWinnerId(editingMatch.result?.winnerId || '');

        if (editingMatch.status === 'aborted' || editingMatch.completionType === 'aborted' || editingMatch.result?.completionType === 'aborted') {
          setCompletionType('aborted');
          setAbandonmentReason(editingMatch.abandonmentReason || editingMatch.result?.abandonmentReason || '');
          setRetiredPlayerId('');
        } else if (editingMatch.result?.retiredPlayerId || editingMatch.completionType === 'retired') {
          setCompletionType('retired');
          setRetiredPlayerId(editingMatch.result?.retiredPlayerId || '');
        } else {
          setCompletionType('regular');
          setRetiredPlayerId('');
        }

        if (editingMatch.result?.sets && editingMatch.result.sets.length > 0) {
          setSets(editingMatch.result.sets.map(s => ({
            p1: s.p1, p2: s.p2, tb1: s.tb1, tb2: s.tb2
          })));
        } else {
          setSets([{p1: '', p2: ''}, {p1: '', p2: ''}]);
        }
      } else {
        if (match) {
          const oppId = match.player1UserId === currentUser.id ? match.player2UserId : match.player1UserId;
          if (oppId) setOpponentId(oppId);
          if (match.scheduledDate || match.played_at) {
            setDate(match.scheduledDate || match.played_at || '');
          }
        }
        if (prefilledOpponentId) setOpponentId(prefilledOpponentId);
        if (prefilledDate) setDate(prefilledDate);
        setWinnerId('');
        setCompletionType('regular');
        setRetiredPlayerId('');
        setAbandonmentReason('');
        setSets([{p1: '', p2: ''}, {p1: '', p2: ''}]);
      }
    }
  }, [isOpen, prefilledOpponentId, prefilledDate, editingMatch, match, currentUser.id]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const opponents = allProfiles.filter(p => p.userId !== currentUser.id);

  const currentUserName = useMemo(() => {
    return getUserName(currentUser.id) || currentUser.name || (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Ich');
  }, [getUserName, currentUser]);

  const opponentName = useMemo(() => {
    if (!opponentId) return 'Gegner';
    return getUserName(opponentId) || 'Gegner';
  }, [getUserName, opponentId]);

  const getSetWinner = (p1: number, p2: number) => {
    if (p1 > p2) return 'p1';
    if (p2 > p1) return 'p2';
    return null;
  };

  const handleSetChange = (index: number, field: 'p1' | 'p2' | 'tb1' | 'tb2', value: string) => {
    const newSets = [...sets];
    newSets[index][field] = value === '' ? '' : parseInt(value);
    
    // Dynamically add/remove 3rd set based on sets 1 and 2
    if (index < 2) {
      const s1p1 = index === 0 && field === 'p1' ? parseInt(value) : (newSets[0]?.p1 as number);
      const s1p2 = index === 0 && field === 'p2' ? parseInt(value) : (newSets[0]?.p2 as number);
      const s2p1 = index === 1 && field === 'p1' ? parseInt(value) : (newSets[1]?.p1 as number);
      const s2p2 = index === 1 && field === 'p2' ? parseInt(value) : (newSets[1]?.p2 as number);
      
      const w1 = getSetWinner(s1p1, s1p2);
      const w2 = getSetWinner(s2p1, s2p2);
      
      if (w1 && w2 && w1 !== w2) {
        if (newSets.length === 2) {
          newSets.push({p1: '', p2: ''});
        }
      } else {
        if (newSets.length > 2) {
          // Remove 3rd set if not needed
          newSets.splice(2, newSets.length - 2);
        }
      }
    }
    
    setSets(newSets);
  };

  const isEditMode = !!editingMatch;
  const isOpponentLocked = !!prefilledOpponentId || isEditMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!opponentId) {
      setError('Bitte wähle einen Gegner aus.');
      return;
    }

    const opponentProfile = allProfiles.find(p => p.userId === opponentId);
    if (!opponentProfile) {
      setError('Gegner nicht gefunden.');
      return;
    }

    let calculatedWinnerId = winnerId;
    let validatedSets: {p1: number, p2: number, tb1?: number | null, tb2?: number | null}[] = [];

    // 1. SPIELABBRUCH (ABANDONMENT)
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

      setIsSubmitting(true);
      try {
        let matchIdToAbort = editingMatch ? editingMatch.id : prefilledMatchId;
        if (!matchIdToAbort) {
          const newMatch = await createLeagueMatch({
            clubId: profile.clubId,
            leagueId: leagueId || profile.leagueId,
            player1Id: currentUser.id,
            player2Id: opponentId,
            player1UserId: currentUser.id,
            player2UserId: opponentId,
            status: 'scheduled',
            scheduledDate: effectiveDate,
            played_at: effectiveDate
          });
          matchIdToAbort = newMatch.id;
        }

        await abortLeagueMatch(
          matchIdToAbort,
          {
            sets: validatedSets,
            abandonmentReason: finalReason,
            played_at: effectiveDate,
          },
          currentUser.id
        );

        window.dispatchEvent(new CustomEvent('league-result-added'));
        onSuccess();
        onClose();
        setOpponentId('');
        setWinnerId('');
        setSets([{p1: '', p2: ''}, {p1: '', p2: ''}]);
      } catch (err: any) {
        console.error(err);
        setError('Fehler beim Speichern des Spielabbruchs: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. AUFGABE (RETIREMENT/W.O.)
    if (completionType === 'retired') {
      if (!retiredPlayerId) {
        setError('Bitte wähle den aufgebenden Spieler aus (Walkover/Aufgabe).');
        return;
      }
      calculatedWinnerId = retiredPlayerId === currentUser.id ? opponentId : currentUser.id;
      
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
      // 3. REGULÄR BEENDET
      if (!winnerId) {
        setError('Bitte wähle den Gewinner aus.');
        return;
      }

      // Validation of tennis match points
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
          // Satz 1 & 2
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

      calculatedWinnerId = p1Wins > p2Wins ? currentUser.id : opponentId;
      if (winnerId !== calculatedWinnerId) {
        setError(`Der gewählte Gewinner passt nicht zum eingegebenen Satzergebnis (${currentUserName}: ${p1Wins}, ${opponentName}: ${p2Wins}).`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && editingMatch) {
        // Edit mode within 24h provisional window
        await editLeagueMatchResult(
          editingMatch.id,
          {
            winnerId: calculatedWinnerId || null,
            sets: validatedSets,
            played_at: effectiveDate,
            retiredPlayerId: completionType === 'retired' ? (retiredPlayerId || null) : null,
            completionType,
            abandonmentReason: completionType === 'aborted' ? (abandonmentReason.trim() || null) : null,
          } as any,
          currentUser.id
        );
      } else {
        // Fetch dynamic effective date configuration for the match date
        const versions = await getLeagueConfigVersions();
        const activeConfig = getConfigForDate(versions, effectiveDate, profile.leagueId);

        // 1. Calculate decayed points first for accurate new points
        const p1Live = applyDecay(profile.basePoints, profile.lastMatchDate, activeConfig, profile.matchesCount || 1);
        const p2Live = applyDecay(opponentProfile.basePoints, opponentProfile.lastMatchDate, activeConfig, opponentProfile.matchesCount || 1);

        const isP1Winner = calculatedWinnerId === currentUser.id;

        // 2. Calculate new points
        const p1New = calculatePoints(p1Live, p2Live, isP1Winner, activeConfig);
        const p2New = calculatePoints(p2Live, p1Live, !isP1Winner, activeConfig);

        // Points awarded = new points - live points
        const pointsAwarded = {
          player1: p1New - p1Live,
          player2: p2New - p2Live
        };

        // 3. Create match first or use prefilled scheduled match
        let matchIdToUpdate = prefilledMatchId;
        if (!matchIdToUpdate) {
          const newMatch = await createLeagueMatch({
            clubId: profile.clubId,
            leagueId: leagueId || profile.leagueId,
            player1Id: currentUser.id,
            player2Id: opponentId,
            player1UserId: currentUser.id,
            player2UserId: opponentId,
            status: 'scheduled',
            scheduledDate: effectiveDate,
            played_at: effectiveDate
          });
          matchIdToUpdate = newMatch.id;
        }

        const now = new Date().toISOString();
        const provisionalUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // 4. Update it with result and mark provisional (24h window)
        await updateLeagueMatchResult(
          matchIdToUpdate,
          {
            winnerId: calculatedWinnerId || null,
            sets: validatedSets,
            reportedBy: currentUser.id,
            reportedAt: now,
            played_at: effectiveDate,
            retiredPlayerId: completionType === 'retired' ? (retiredPlayerId || null) : null,
            completionType,
            abandonmentReason: completionType === 'aborted' ? (abandonmentReason.trim() || null) : null,
          } as any,
          pointsAwarded,
          p1New,
          p2New,
          currentUser.id,
          opponentId,
          {
            reportedByUserId: currentUser.id,
            isProvisional: true,
            provisionalUntil,
          }
        );
      }

      window.dispatchEvent(new CustomEvent('league-result-added'));
      onSuccess();
      onClose();
      // Reset form
      setOpponentId('');
      setWinnerId('');
      setSets([{p1: '', p2: ''}, {p1: '', p2: ''}]);
      setCompletionType('regular');
      setRetiredPlayerId('');
      setAbandonmentReason('');
    } catch (err: any) {
      console.error(err);
      setError('Fehler beim Speichern des Ergebnisses. ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99998]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 right-0 h-[100dvh] w-full max-w-md bg-white shadow-2xl z-[99999] flex flex-col border-none outline-none overflow-hidden"
          >
            {/* Header with primary color (Grün) */}
            <div
              className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden"
              style={{ backgroundColor: primaryColor || 'var(--color-primary)' }}
            >
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
                  <i className="fa-solid fa-trophy text-amber-300"></i>
                  {isEditMode ? 'Ergebnis bearbeiten' : 'Ergebnis eintragen'}
                </div>
                <div className="text-lg font-black flex items-center gap-2 mt-0.5 text-white truncate">
                  <span>{formattedDate || 'Hobbyliga-Match'}</span>
                  {displayCourt && (
                    <>
                      <span>•</span>
                      <span className="truncate">{displayCourt}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-white/80 mt-0.5 font-medium">
                  {isEditMode ? 'Korrektur innerhalb der 24h-Frist' : 'Hobbyliga-Match erfassen'}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-base font-medium cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="resultForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* 24h Notice Badge */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 flex items-start gap-2.5 leading-relaxed shadow-sm">
                  <i className="fa-solid fa-shield-halved text-slate-500 mt-0.5 shrink-0 text-base"></i>
                  <div>
                    <span className="font-bold">24h-Validierungsphase:</span> Nach dem Speichern wird das Ergebnis sofort eingerechnet und bleibt 24 Stunden lang für beide Spieler korrigier- und stornierbar.
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-200">
                    {error}
                  </div>
                )}

                {/* Readonly Match-Metadaten Display Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-info text-slate-400"></i>
                      Match-Rahmendaten
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Datum */}
                    <div className="flex items-start gap-2 min-w-0">
                      <i className="fa-regular fa-calendar text-slate-500 text-xs mt-0.5 shrink-0"></i>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Datum</div>
                        <div className="text-xs font-bold text-slate-800 truncate" title={formattedDate}>
                          {formattedDate}
                        </div>
                      </div>
                    </div>

                    {/* Uhrzeit / Zeitraum */}
                    <div className="flex items-start gap-2 min-w-0">
                      <i className="fa-regular fa-clock text-slate-500 text-xs mt-0.5 shrink-0"></i>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Zeitraum</div>
                        <div className="text-xs font-bold text-slate-800 truncate" title={displayTimeRange}>
                          {displayTimeRange}
                        </div>
                      </div>
                    </div>

                    {/* Spielort / Anlage */}
                    <div className="flex items-start gap-2 min-w-0">
                      <i className="fa-solid fa-location-dot text-slate-500 text-xs mt-0.5 shrink-0"></i>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Spielort / Anlage</div>
                        <div className="text-xs font-bold text-slate-800 truncate" title={displayVenue}>
                          {displayVenue}
                        </div>
                      </div>
                    </div>

                    {/* Platz */}
                    <div className="flex items-start gap-2 min-w-0">
                      <i className="fa-solid fa-table-tennis-paddle-ball text-slate-500 text-xs mt-0.5 shrink-0"></i>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Platz</div>
                        <div className="text-xs font-bold text-slate-800 truncate" title={displayCourt}>
                          {displayCourt}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gegner Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Gegner
                  </label>
                  {isOpponentLocked ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl h-8 flex items-center px-3 py-1 text-sm text-slate-800 font-sans font-medium">
                      {getUserName(opponentId)}
                    </div>
                  ) : (
                    <select
                      value={opponentId}
                      onChange={(e) => setOpponentId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl h-8 px-3 py-1 text-sm text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition font-sans font-medium"
                    >
                      <option value="">-- Bitte wählen --</option>
                      {opponents.map(p => (
                        <option key={p.userId} value={p.userId}>
                          {getUserName(p.userId)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Status Selection (Ausgang des Spiels) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
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

                {/* Regular: Gewinner Buttons */}
                {completionType === 'regular' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gewinner</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setWinnerId(currentUser.id)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center text-center leading-snug ${
                          winnerId === currentUser.id 
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm' 
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                        title={currentUserName}
                      >
                        <span className="truncate">{currentUserName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWinnerId(opponentId)}
                        disabled={!opponentId}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center text-center leading-snug ${
                          !opponentId ? 'opacity-50 cursor-not-allowed' :
                          winnerId === opponentId 
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm' 
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                        title={opponentName}
                      >
                        <span className="truncate">{opponentName}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Retired: Walkover Block */}
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
                        className="w-full bg-white border border-slate-200 rounded-xl h-8 px-3 py-1 text-sm text-slate-800 focus:outline-none focus:border-amber-500 font-sans font-medium"
                      >
                        <option value="">-- Bitte wählen --</option>
                        <option value={currentUser.id}>{currentUserName} (Ich)</option>
                        {opponentId && <option value={opponentId}>{opponentName} (Gegner)</option>}
                      </select>
                    </div>
                  </div>
                )}

                {/* Aborted: Spielabbruch Block */}
                {completionType === 'aborted' && (
                  <div className="space-y-3 p-4 bg-rose-50/50 border border-rose-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm mt-0.5 shrink-0"></i>
                      <div className="text-xs text-rose-800 leading-relaxed">
                        <strong className="font-bold">Hinweis Spielabbruch:</strong> Das Match wird als abgebrochen gewertet. Es werden <strong>weder ein Sieger noch Ranglisten-Punkte</strong> vergeben.
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
                        className="w-full bg-white border border-slate-200 rounded-xl h-8 px-3 py-1 text-sm text-slate-800 focus:outline-none focus:border-rose-500 placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Sätze Input */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {completionType === 'aborted'
                        ? 'Gespielte Sätze bis zum Abbruch (optional)'
                        : completionType === 'retired'
                        ? 'Gespielte Sätze bis zur Aufgabe (optional)'
                        : <>Sätze / Spielergebnis <span className="text-red-500">*</span></>}
                    </label>
                    {completionType === 'regular' && (
                      <span className="text-[10px] font-medium text-slate-400">Best-of-3</span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {sets.map((set, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-20">
                            {i === 2 ? 'Match-TB' : `Satz ${i + 1}`}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={set.p1}
                            onChange={(e) => handleSetChange(i, 'p1', e.target.value)}
                            placeholder={i === 2 ? "10" : "0"}
                            className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:border-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span className="text-slate-400 font-bold">:</span>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={set.p2}
                            onChange={(e) => handleSetChange(i, 'p2', e.target.value)}
                            placeholder={i === 2 ? "8" : "0"}
                            className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:border-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        {/* Tiebreak Inputs if 7:6 or 6:7 */}
                        {i < 2 && (set.p1 === 7 && set.p2 === 6 || set.p1 === 6 && set.p2 === 7) && (
                          <div className="flex items-center gap-3 pl-[92px]">
                            <span className="text-[10px] font-bold text-slate-400">TB:</span>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={set.tb1 ?? ''}
                              onChange={(e) => handleSetChange(i, 'tb1', e.target.value)}
                              placeholder="7"
                              className="w-12 h-8 bg-slate-50 border border-slate-200 rounded-md px-1 py-1 text-center text-[11px] text-slate-600 focus:outline-none focus:border-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                            <span className="text-slate-400 font-bold text-[10px]">:</span>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={set.tb2 ?? ''}
                              onChange={(e) => handleSetChange(i, 'tb2', e.target.value)}
                              placeholder="5"
                              className="w-12 h-8 bg-slate-50 border border-slate-200 rounded-md px-1 py-1 text-center text-[11px] text-slate-600 focus:outline-none focus:border-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{currentUserName} : {opponentName}</p>
                </div>
              </form>
            </div>

            <div className="sticky bottom-0 z-20 p-6 border-t border-slate-200 bg-white flex items-center gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                form="resultForm"
                disabled={isSubmitting}
                style={completionType === 'regular' ? { backgroundColor: primaryColor || 'var(--color-primary)' } : undefined}
                className={`flex-1 h-10 px-3 py-1.5 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm disabled:opacity-70 flex items-center justify-center gap-2 text-white ${
                  completionType === 'aborted'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : completionType === 'retired'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[var(--color-primary)] hover:brightness-95'
                }`}
              >
                {isSubmitting ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Speichere...</>
                ) : completionType === 'aborted' ? (
                  <><i className="fa-solid fa-ban"></i> Spielabbruch speichern</>
                ) : completionType === 'retired' ? (
                  <><i className="fa-solid fa-check"></i> Aufgabe & Sieg speichern</>
                ) : (
                  <><i className="fa-solid fa-check"></i> {isEditMode ? 'Änderungen speichern' : 'Ergebnis speichern'}</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

