import React from 'react';
import { LeagueMatch, User } from '../../types';
import { canUserEnterResult, formatMatchCourtAndFacility, formatMatchTimeSpan } from '../../utils/leagueMatchHelper';

interface HobbyligaAnstehendePartienProps {
  matches: LeagueMatch[];
  currentUser: User;
  getUserName: (userId: string) => string;
  getUserRank: (userId: string) => number | null;
  formatDate: (dateStr?: string) => string;
  onEnterResult: (match: LeagueMatch) => void;
}

export const HobbyligaAnstehendePartien: React.FC<HobbyligaAnstehendePartienProps> = ({
  matches,
  currentUser,
  getUserName,
  getUserRank,
  formatDate,
  onEnterResult,
}) => {
  // Sort upcoming scheduled matches chronologically
  const upcomingMatches = [...matches]
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => {
      const aDate = `${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`;
      const bDate = `${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`;
      return aDate.localeCompare(bDate);
    });

  if (upcomingMatches.length === 0) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
            <i className="fa-regular fa-calendar-days" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
              Anstehende Begegnungen
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Öffentliche Spieltermine & Zuschauer-Infos
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">
          {upcomingMatches.length} {upcomingMatches.length === 1 ? 'Partie geplant' : 'Partien geplant'}
        </span>
      </div>

      <div className="divide-y divide-slate-100 -mx-5 -mb-5">
        {upcomingMatches.map((match) => {
          const isUserMatch = match.player1UserId === currentUser.id || match.player2UserId === currentUser.id;
          const p1Name = getUserName(match.player1UserId);
          const p2Name = getUserName(match.player2UserId);
          const p1Rank = getUserRank(match.player1UserId);
          const p2Rank = getUserRank(match.player2UserId);
          
          const courtLocation = formatMatchCourtAndFacility(match, "Vereinsanlage");
          const timeSpan = formatMatchTimeSpan(match);
          const resultAuth = canUserEnterResult(match, currentUser.id, currentUser.role);

          return (
            <div
              key={match.id}
              className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                isUserMatch ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-amber-500' : 'hover:bg-slate-50/70'
              }`}
            >
              {/* Left: Matchup & Location Details */}
              <div className="space-y-2 flex-1 min-w-0">
                {/* Meta Header: Date, Time & Court */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <i className="fa-regular fa-clock text-amber-500" />
                    {formatDate(match.scheduledDate)} · {timeSpan}
                  </span>
                  <span>&bull;</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                    <i className="fa-solid fa-location-dot text-[10px]" />
                    {courtLocation}
                  </span>
                  {isUserMatch && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                      Dein Spiel
                    </span>
                  )}
                </div>

                {/* Matchup Players */}
                <div className="flex items-center gap-3 py-1">
                  {/* Player 1 */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                      {p1Name.charAt(0)}
                    </div>
                    <div>
                      <span className={`text-sm font-bold block leading-tight ${match.player1UserId === currentUser.id ? 'text-amber-900 font-black' : 'text-slate-800'}`}>
                        {p1Name}
                      </span>
                      {p1Rank && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Rang #{p1Rank}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-black text-slate-400 px-1">VS</span>

                  {/* Player 2 */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                      {p2Name.charAt(0)}
                    </div>
                    <div>
                      <span className={`text-sm font-bold block leading-tight ${match.player2UserId === currentUser.id ? 'text-amber-900 font-black' : 'text-slate-800'}`}>
                        {p2Name}
                      </span>
                      {p2Rank && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Rang #{p2Rank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Actions / Spectator Info */}
              <div className="shrink-0 flex items-center gap-2">
                {isUserMatch || currentUser.role === 'admin' || (currentUser as any)?.role === 'SUPER_ADMIN' ? (
                  resultAuth.allowed ? (
                    <button
                      onClick={() => onEnterResult(match)}
                      className="w-full md:w-auto px-4 py-2.5 bg-[var(--color-primary)] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-opacity-90 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-trophy text-amber-300" />
                      Ergebnis eintragen
                    </button>
                  ) : (
                    <div className="flex flex-col items-end">
                      <button
                        disabled
                        className="w-full md:w-auto px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                        title={resultAuth.reason}
                      >
                        <i className="fa-solid fa-lock text-slate-400" />
                        Ergebnis gesperrt
                      </button>
                      {resultAuth.reason && (
                        <span className="text-[10px] font-semibold text-slate-500 mt-1 text-right">
                          {resultAuth.reason}
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <div className="px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold flex items-center gap-1.5">
                    <i className="fa-solid fa-eye text-slate-400" />
                    Zuschauer willkommen
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
