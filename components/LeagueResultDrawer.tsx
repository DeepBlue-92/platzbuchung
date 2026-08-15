import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LeaguePlayer, User } from '../types';
import { createLeagueMatch, updateLeagueMatchResult, getLeagueConfigVersions } from '../services/league';
import { calculatePoints, applyDecay, LeaguePointConfig, getConfigForDate } from '../services/leagueEngine';

interface LeagueResultDrawerProps {
  prefilledMatchId?: string;
  prefilledOpponentId?: string;
  prefilledDate?: string;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  profile: LeaguePlayer;
  allProfiles: LeaguePlayer[];
  defaultConfig: LeaguePointConfig;
  onSuccess: () => void;
  getUserName: (userId: string) => string;
  leagueId?: string;
}

export function LeagueResultDrawer({
  prefilledMatchId,
  prefilledOpponentId,
  prefilledDate,
  isOpen,
  onClose,
  currentUser,
  profile,
  allProfiles,
  defaultConfig,
  onSuccess,
  getUserName,
  leagueId
}: LeagueResultDrawerProps) {
  const [opponentId, setOpponentId] = useState<string>(prefilledOpponentId || '');
  const [date, setDate] = useState<string>(prefilledDate || new Date().toISOString().split('T')[0]);
  const [winnerId, setWinnerId] = useState<string>('');
  
  // Set scores (optional for now, but good to have)
  const [sets, setSets] = useState<{p1: number, p2: number}[]>([{p1: 0, p2: 0}]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (prefilledOpponentId) setOpponentId(prefilledOpponentId);
      if (prefilledDate) setDate(prefilledDate);
    }
  }, [isOpen, prefilledOpponentId, prefilledDate]);

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

  const handleAddSet = () => {
    if (sets.length < 5) {
      setSets([...sets, {p1: 0, p2: 0}]);
    }
  };

  const handleSetChange = (index: number, player: 'p1' | 'p2', value: string) => {
    const newSets = [...sets];
    newSets[index][player] = parseInt(value) || 0;
    setSets(newSets);
  };

  const handleRemoveSet = (index: number) => {
    const newSets = sets.filter((_, i) => i !== index);
    setSets(newSets);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!opponentId) {
      setError('Bitte wähle einen Gegner aus.');
      return;
    }
    if (!winnerId) {
      setError('Bitte wähle den Gewinner aus.');
      return;
    }

    const opponentProfile = allProfiles.find(p => p.userId === opponentId);
    if (!opponentProfile) {
      setError('Gegner nicht gefunden.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch dynamic effective date configuration for the match date
      const versions = await getLeagueConfigVersions();
      const activeConfig = getConfigForDate(versions, date, profile.leagueId);

      // 1. Calculate decayed points first for accurate new points
      const p1Live = applyDecay(profile.basePoints, profile.lastMatchDate, activeConfig, profile.matchesCount || 1); // treat as active
      const p2Live = applyDecay(opponentProfile.basePoints, opponentProfile.lastMatchDate, activeConfig, opponentProfile.matchesCount || 1);

      const isP1Winner = winnerId === currentUser.id;

      // 2. Calculate new points
      const p1New = calculatePoints(p1Live, p2Live, isP1Winner, activeConfig);
      const p2New = calculatePoints(p2Live, p1Live, !isP1Winner, activeConfig);

      // Points awarded = new points - live points
      const pointsAwarded = {
        player1: p1New - p1Live,
        player2: p2New - p2Live
      };

      // 3. Create dummy match first or use prefilled
      let matchIdToUpdate = prefilledMatchId;
      if (!matchIdToUpdate) {
        const newMatch = await createLeagueMatch({
          clubId: profile.clubId,
          leagueId: leagueId || profile.leagueId,
          player1Id: currentUser.id, // using userId for simplicity
          player2Id: opponentId,
          player1UserId: currentUser.id,
          player2UserId: opponentId,
          status: 'scheduled',
          scheduledDate: date,
          played_at: date
        });
        matchIdToUpdate = newMatch.id;
      }

      // 4. Update it with result
      await updateLeagueMatchResult(
        matchIdToUpdate,
        {
          winnerId,
          sets,
          reportedBy: currentUser.id,
          reportedAt: new Date().toISOString()
        },
        pointsAwarded,
        p1New,
        p2New,
        currentUser.id,
        opponentId
      );

      onSuccess();
      onClose();
      // Reset form
      setOpponentId('');
      setWinnerId('');
      setSets([{p1: 0, p2: 0}]);
      setDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      console.error(err);
      setError('Fehler beim Speichern des Ergebnisses. ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Ergebnis eintragen</h2>
                <p className="text-xs text-slate-500 mt-1">Hobbyliga-Match erfassen</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="resultForm" onSubmit={handleSubmit} className="space-y-6">
                
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-200">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Datum des Matches</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gegner wählen</label>
                  <select
                    value={opponentId}
                    onChange={(e) => setOpponentId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition"
                  >
                    <option value="">-- Bitte wählen --</option>
                    {opponents.map(p => (
                      <option key={p.userId} value={p.userId}>
                        {getUserName(p.userId)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gewinner</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWinnerId(currentUser.id)}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition flex items-center justify-center gap-2 ${
                        winnerId === currentUser.id 
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <i className="fa-solid fa-trophy"></i> Ich
                    </button>
                    <button
                      type="button"
                      onClick={() => setWinnerId(opponentId)}
                      disabled={!opponentId}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition flex items-center justify-center gap-2 ${
                        !opponentId ? 'opacity-50 cursor-not-allowed' :
                        winnerId === opponentId 
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <i className="fa-solid fa-trophy"></i> Gegner
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sätze (Optional)</label>
                    <button 
                      type="button"
                      onClick={handleAddSet}
                      disabled={sets.length >= 5}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold uppercase tracking-wide transition disabled:opacity-50"
                    >
                      + Satz
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {sets.map((set, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-12">Satz {i + 1}</span>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={set.p1 === 0 && set.p2 === 0 && sets.length === 1 && i === 0 ? '' : set.p1}
                          onChange={(e) => handleSetChange(i, 'p1', e.target.value)}
                          placeholder="0"
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-2 text-center text-sm font-bold text-slate-800 focus:outline-none focus:border-[var(--color-primary)]"
                        />
                        <span className="text-slate-400 font-bold">:</span>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={set.p1 === 0 && set.p2 === 0 && sets.length === 1 && i === 0 ? '' : set.p2}
                          onChange={(e) => handleSetChange(i, 'p2', e.target.value)}
                          placeholder="0"
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-2 text-center text-sm font-bold text-slate-800 focus:outline-none focus:border-[var(--color-primary)]"
                        />
                        {sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSet(i)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">Du (Ich) : Gegner</p>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                form="resultForm"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-[var(--color-primary)] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-opacity-90 transition shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Speichere...</>
                ) : (
                  <><i className="fa-solid fa-check"></i> Speichern</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
