import React, { useState } from 'react';
import { LeagueMatch, User } from '../../types';
import { isMatchProvisional, getProvisionalRemainingText, canUserEditOrCancelResult } from '../../utils/leagueMatchHelper';
import { UserAvatar } from '../UserAvatar';

interface HobbyligaNaechstesSpielProps {
  upcomingMatches: LeagueMatch[];
  currentUser?: User;
  getUserName: (userId: string) => string;
  getUserObject?: (userId: string) => User | null;
  formatDate: (dateStr?: string) => string;
  onEnterResult: (match: LeagueMatch) => void;
  onEditMatch?: (match: LeagueMatch) => void;
  onCancelMatch?: (match: LeagueMatch) => void;
}

export const HobbyligaNaechstesSpiel: React.FC<HobbyligaNaechstesSpielProps> = ({
  upcomingMatches,
  currentUser,
  getUserName,
  getUserObject,
  formatDate,
  onEnterResult,
  onEditMatch,
  onCancelMatch,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const validUpcoming = (upcomingMatches || []).filter(m => m.status !== 'cancelled' && m.status !== 'aborted');

  if (!validUpcoming || validUpcoming.length === 0) {
    return null; // Hide if empty
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validUpcoming.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < validUpcoming.length - 1 ? prev + 1 : 0));
  };

  const currentMatch = validUpcoming[currentIndex] || validUpcoming[0];
  if (!currentMatch) return null;

  const isProvisional = isMatchProvisional(currentMatch);
  const provisionalText = getProvisionalRemainingText(currentMatch);
  const editAuth = canUserEditOrCancelResult(currentMatch, currentUser?.id, currentUser?.role);

  const p1User = getUserObject ? getUserObject(currentMatch.player1UserId) : null;
  const p2User = getUserObject ? getUserObject(currentMatch.player2UserId) : null;

  const p1Name = getUserName(currentMatch.player1UserId) || currentMatch.player1?.name || 'Spieler 1';
  const p2Name = getUserName(currentMatch.player2UserId) || currentMatch.player2?.name || 'Spieler 2';
  
  const isP1Winner = currentMatch.result?.winnerId === currentMatch.player1UserId;
  const isP2Winner = currentMatch.result?.winnerId === currentMatch.player2UserId;

  const p1IsUser = currentUser ? currentMatch.player1UserId === currentUser.id : false;
  const p2IsUser = currentUser ? currentMatch.player2UserId === currentUser.id : false;

  const isCompleted = currentMatch.status === 'completed' || !!currentMatch.result;

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-5 md:p-6 space-y-4 relative">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-regular fa-calendar-check text-[var(--color-primary)]"></i> {isCompleted ? "Zuletzt Gespielt" : "Nächstes Spiel"}
        </h3>
        {validUpcoming.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <span className="text-[10px] font-bold text-slate-400 min-w-[24px] text-center">
              {currentIndex + 1}/{validUpcoming.length}
            </span>
            <button
              onClick={handleNext}
              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3.5">
        {/* Date / Time */}
        <div className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 flex justify-between items-center">
          <span>{currentMatch.scheduledDate ? formatDate(currentMatch.scheduledDate + 'T' + (currentMatch.scheduledStartTime || '00:00')) : "Termin ausstehend"}</span>
          {currentMatch.scheduledStartTime && <span>{currentMatch.scheduledStartTime} {currentMatch.scheduledEndTime ? `- ${currentMatch.scheduledEndTime}` : ''}</span>}
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
                user={currentMatch.player1 || p1User}
                avatarUrl={currentMatch.player1?.avatarUrl || p1User?.avatarUrl}
                avatarIcon={currentMatch.player1?.avatarIcon || p1User?.avatarIcon}
                initials={currentMatch.player1?.initials}
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
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Sieger</span>
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
                <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Sieger</span>
              ) : p2IsUser ? (
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Du</span>
              ) : null}
            </div>
            <div className="relative shrink-0">
              <UserAvatar
                user={currentMatch.player2 || p2User}
                avatarUrl={currentMatch.player2?.avatarUrl || p2User?.avatarUrl}
                avatarIcon={currentMatch.player2?.avatarIcon || p2User?.avatarIcon}
                initials={currentMatch.player2?.initials}
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

        {/* Stats summary if completed */}
        {isCompleted && currentMatch.result && (
          <div className="flex items-center justify-between text-xs pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium text-[11px]">Sätze:</span>
              <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                {currentMatch.result.sets.map(s => `${s.p1}:${s.p2}`).join(', ')}
              </span>
            </div>
            
            {(() => {
              const winnerDelta = isP1Winner ? currentMatch.pointsAwarded?.player1 : (isP2Winner ? currentMatch.pointsAwarded?.player2 : undefined);
              if (typeof winnerDelta === 'number' && !isNaN(winnerDelta)) {
                return (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-medium text-[11px]">Punkte:</span>
                    <span className="font-black text-[var(--color-primary)]">
                      +{Math.abs(winnerDelta).toFixed(1)} Pkt.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          {!isCompleted ? (
            <button
              onClick={() => onEnterResult(currentMatch)}
              className="flex-1 py-2.5 px-3 bg-[var(--color-primary)] hover:opacity-90 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <i className="fa-solid fa-pen-to-square text-[11px]" /> Ergebnis eintragen
            </button>
          ) : (
            editAuth.canEdit && (
              <>
                <button
                  onClick={() => onEditMatch && onEditMatch(currentMatch)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-pen text-[10px]" /> Korrigieren
                </button>
                <button
                  onClick={() => onCancelMatch && onCancelMatch(currentMatch)}
                  className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Match-Ergebnis stornieren und Punkte zurücksetzen"
                >
                  <i className="fa-solid fa-rotate-left text-[10px]" /> Stornieren
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
