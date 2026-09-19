import React, { useState, useMemo } from 'react';
import { LeagueMatch, User } from '../../types';
import { isMatchProvisional, getProvisionalRemainingText, canUserEditOrCancelResult } from '../../utils/leagueMatchHelper';
import { resolveClubName } from '../../services/clubHelper';
import { UserAvatar } from '../UserAvatar';

interface HobbyligaLetztesErgebnisProps {
  completedMatches: LeagueMatch[];
  currentUser?: User;
  clubId?: string;
  getUserName: (userId: string) => string;
  getUserObject?: (userId: string) => User | null;
  formatDate: (dateStr?: string) => string;
  onEditMatch?: (match: LeagueMatch) => void;
  onCancelMatch?: (match: LeagueMatch) => void;
}

export const HobbyligaLetztesErgebnis: React.FC<HobbyligaLetztesErgebnisProps> = ({
  completedMatches,
  currentUser,
  clubId,
  getUserName,
  getUserObject,
  formatDate,
  onEditMatch,
  onCancelMatch,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterClub, setFilterClub] = useState<string>('all'); // 'all' or 'current'

  const filteredMatches = useMemo(() => {
    if (filterClub === 'all' || !clubId) {
      return completedMatches;
    }
    return completedMatches.filter(m => m.clubId === clubId);
  }, [completedMatches, filterClub, clubId]);

  // Ensure index is within bounds when filter changes
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [filteredMatches.length]);

  const latestCompletedMatch = filteredMatches[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredMatches.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < filteredMatches.length - 1 ? prev + 1 : 0));
  };

  const isProvisional = latestCompletedMatch ? isMatchProvisional(latestCompletedMatch) : false;
  const provisionalText = latestCompletedMatch ? getProvisionalRemainingText(latestCompletedMatch) : "";
  const editAuth = latestCompletedMatch ? canUserEditOrCancelResult(latestCompletedMatch, currentUser?.id, currentUser?.role) : { canEdit: false, canCancel: false };

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-[var(--color-primary)]"></i> Match-Historie
        </h3>
        
        {/* Filter Dropdown */}
        <select
          value={filterClub}
          onChange={(e) => setFilterClub(e.target.value)}
          className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer font-sans font-medium"
        >
          <option value="all">Alle Vereine</option>
          {clubId && <option value="current">Nur Aktueller Verein</option>}
        </select>
      </div>

      {filteredMatches.length > 0 ? (
        (() => {
          const p1User = getUserObject ? getUserObject(latestCompletedMatch.player1UserId) : null;
          const p2User = getUserObject ? getUserObject(latestCompletedMatch.player2UserId) : null;
          const p1Obj = latestCompletedMatch.player1 || p1User;
          const p2Obj = latestCompletedMatch.player2 || p2User;

          const p1Name = getUserName(latestCompletedMatch.player1UserId) || p1Obj?.name || 'Spieler 1';
          const p2Name = getUserName(latestCompletedMatch.player2UserId) || p2Obj?.name || 'Spieler 2';
          const isAborted = latestCompletedMatch.status === 'aborted' || latestCompletedMatch.completionType === 'aborted' || latestCompletedMatch.result?.completionType === 'aborted';
          const isRetired = latestCompletedMatch.completionType === 'retired' || latestCompletedMatch.result?.completionType === 'retired' || !!latestCompletedMatch.result?.retiredPlayerId;
          const retiredPlayerId = latestCompletedMatch.result?.retiredPlayerId;

          const isP1Winner = !isAborted && latestCompletedMatch.result?.winnerId === latestCompletedMatch.player1UserId;
          const isP2Winner = !isAborted && latestCompletedMatch.result?.winnerId === latestCompletedMatch.player2UserId;

          const p1IsUser = currentUser ? latestCompletedMatch.player1UserId === currentUser.id : false;
          const p2IsUser = currentUser ? latestCompletedMatch.player2UserId === currentUser.id : false;

          const rawSets = latestCompletedMatch.result?.sets;
          const setsFormatted = rawSets && rawSets.length > 0
            ? rawSets.map(s => `${s.p1}:${s.p2}`).join(', ')
            : (isAborted ? 'Keine Sätze' : '6:4, 6:3');

          const winnerDelta = isP1Winner
            ? latestCompletedMatch.pointsAwarded?.player1
            : (isP2Winner ? latestCompletedMatch.pointsAwarded?.player2 : undefined);

          return (
            <div className="space-y-3.5 relative">
              {/* Pagination & Date */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-2 mb-2">
                <button
                  onClick={handlePrev}
                  className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400">
                    {currentIndex + 1} / {filteredMatches.length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200/60 mt-1">
                    {formatDate(latestCompletedMatch.played_at || latestCompletedMatch.result?.reportedAt || latestCompletedMatch.updatedAt || latestCompletedMatch.createdAt)}
                  </span>
                  {filterClub === 'all' && (
                    <span className="text-[9px] text-slate-400 mt-0.5 max-w-[120px] truncate" title={resolveClubName(latestCompletedMatch.clubId)}>
                      {resolveClubName(latestCompletedMatch.clubId)}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleNext}
                  className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              </div>

              {/* 24h Provisional Status Pill if active */}
              {isProvisional && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <span className="font-bold flex items-center gap-1.5 text-[11px]">
                    <i className="fa-solid fa-clock text-amber-600" />
                    {provisionalText}
                  </span>
                  <span className="text-[10px] bg-amber-200/60 font-black px-1.5 py-0.5 rounded uppercase">24h</span>
                </div>
              )}

              {/* Players Matchup */}
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {/* Player 1 */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <UserAvatar
                      user={p1Obj}
                      avatarUrl={p1Obj?.avatarUrl}
                      avatarIcon={p1Obj?.avatarIcon}
                      initials={(p1Obj as any)?.initials}
                      name={p1Name}
                      size="sm"
                      variant={p1IsUser ? "green" : "neutral"}
                      className={p1IsUser ? "ring-2 ring-emerald-500/40 shadow-xs" : ""}
                    />
                    {isP1Winner && (
                      <div
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs text-[8px]"
                        title="Sieger"
                      >
                        <i className="fa-solid fa-crown" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold truncate ${isP1Winner ? "text-slate-900 font-black" : p1IsUser ? "text-emerald-900 font-black" : "text-slate-700"}`}>
                      {p1Name}
                    </div>
                    {isP1Winner ? (
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">
                        {isRetired ? 'Sieger (w.o.)' : 'Sieger'}
                      </span>
                    ) : !isAborted && retiredPlayerId === latestCompletedMatch.player1UserId ? (
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Aufgabe (w.o.)</span>
                    ) : p1IsUser ? (
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Du</span>
                    ) : null}
                  </div>
                </div>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">VS</span>

                {/* Player 2 */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold truncate ${isP2Winner ? "text-slate-900 font-black" : p2IsUser ? "text-emerald-900 font-black" : "text-slate-700"}`}>
                      {p2Name}
                    </div>
                    {isP2Winner ? (
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">
                        {isRetired ? 'Sieger (w.o.)' : 'Sieger'}
                      </span>
                    ) : !isAborted && retiredPlayerId === latestCompletedMatch.player2UserId ? (
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Aufgabe (w.o.)</span>
                    ) : p2IsUser ? (
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Du</span>
                    ) : null}
                  </div>
                  <div className="relative shrink-0">
                    <UserAvatar
                      user={p2Obj}
                      avatarUrl={p2Obj?.avatarUrl}
                      avatarIcon={p2Obj?.avatarIcon}
                      initials={(p2Obj as any)?.initials}
                      name={p2Name}
                      size="sm"
                      variant={p2IsUser ? "green" : "neutral"}
                      className={p2IsUser ? "ring-2 ring-emerald-500/40 shadow-xs" : ""}
                    />
                    {isP2Winner && (
                      <div
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs text-[8px]"
                        title="Sieger"
                      >
                        <i className="fa-solid fa-crown" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats summary */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium text-[11px]">Sätze:</span>
                  <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                    {setsFormatted}
                  </span>
                </div>

                {isAborted ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-medium text-[11px]">Wertung:</span>
                    <span className="font-bold text-slate-500 text-xs">
                      Keine Wertung (0 Pkt.)
                    </span>
                  </div>
                ) : typeof winnerDelta === 'number' && !isNaN(winnerDelta) ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-medium text-[11px]">Punkte:</span>
                    <span className="font-black text-[var(--color-primary)]">
                      +{Math.abs(winnerDelta).toFixed(1)} Pkt.
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Participant 24h Action Buttons */}
              {editAuth.canEdit && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onEditMatch && onEditMatch(latestCompletedMatch)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-pen text-[10px]" /> Korrigieren
                  </button>
                  <button
                    onClick={() => onCancelMatch && onCancelMatch(latestCompletedMatch)}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Match-Ergebnis stornieren und Punkte zurücksetzen"
                  >
                    <i className="fa-solid fa-rotate-left text-[10px]" /> Stornieren
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* Empty state */
        <div className="p-4 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xs">
            <i className="fa-regular fa-calendar-xmark" />
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
            {filterClub === 'current' 
              ? "Noch keine absolvierten Matches in diesem Verein."
              : "Noch keine absolvierten Matches in der Hobbyliga. Trage das erste Spiel ein!"
            }
          </p>
        </div>
      )}
    </div>
  );
};

