import React, { useState, useMemo } from 'react';
import { LeagueMatch, User } from '../../types';
import {
  isMatchProvisional,
  getProvisionalRemainingText,
  canUserEditOrCancelResult,
  isMatchStarted,
  formatMatchCourtAndFacility,
} from '../../utils/leagueMatchHelper';
import { resolveClubName } from '../../services/clubHelper';
import { UserAvatar } from '../UserAvatar';

export interface HobbyligaCombinedMatchFeedProps {
  pendingMatches?: LeagueMatch[];
  upcomingMatches: LeagueMatch[];
  completedMatches: LeagueMatch[];
  currentUser: User;
  getUserName: (userId: string) => string;
  getUserObject?: (userId: string) => User | null;
  getUserRank?: (userId: string) => number | undefined | null;
  formatDate: (dateStr?: string) => string;
  onEnterResult: (match: LeagueMatch) => void;
  onEditMatch?: (match: LeagueMatch) => void;
  onCancelMatch?: (match: LeagueMatch) => void;
  onRebook?: (match: LeagueMatch) => void;
}

export const HobbyligaCombinedMatchFeed: React.FC<HobbyligaCombinedMatchFeedProps> = ({
  pendingMatches,
  upcomingMatches,
  completedMatches,
  currentUser,
  getUserName,
  getUserObject,
  getUserRank,
  formatDate,
  onEnterResult,
  onEditMatch,
  onCancelMatch,
  onRebook,
}) => {
  // State for Section 0 (Pending matches carousel)
  const [pendingIndex, setPendingIndex] = useState(0);

  // State for Section 1 (Upcoming matches carousel)
  const [upcomingIndex, setUpcomingIndex] = useState(0);

  // State for Section 2 (Recent results carousel, up to 5 matches)
  const [resultsIndex, setResultsIndex] = useState(0);

  // 0. Prepare pending matches
  const sortedPending = useMemo(() => {
    return [...(pendingMatches || [])].sort((a, b) => {
      const aDate = `${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`;
      const bDate = `${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`;
      return bDate.localeCompare(aDate); // Latest first
    });
  }, [pendingMatches]);

  const currentPending = sortedPending[pendingIndex] || sortedPending[0] || null;

  const handlePrevPending = () => {
    setPendingIndex((prev) => (prev > 0 ? prev - 1 : sortedPending.length - 1));
  };

  const handleNextPending = () => {
    setPendingIndex((prev) => (prev < sortedPending.length - 1 ? prev + 1 : 0));
  };

  // 1. Prepare upcoming matches sorted chronologically
  const sortedUpcoming = useMemo(() => {
    return [...upcomingMatches].sort((a, b) => {
      const aDate = `${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`;
      const bDate = `${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`;
      return aDate.localeCompare(bDate);
    });
  }, [upcomingMatches]);

  // Keep upcomingIndex within valid bounds
  const currentUpcoming = sortedUpcoming[upcomingIndex] || sortedUpcoming[0] || null;

  const handlePrevUpcoming = () => {
    setUpcomingIndex((prev) => (prev > 0 ? prev - 1 : sortedUpcoming.length - 1));
  };

  const handleNextUpcoming = () => {
    setUpcomingIndex((prev) => (prev < sortedUpcoming.length - 1 ? prev + 1 : 0));
  };

  // 2. Prepare last 5 completed matches (most recent first)
  const last5Completed = useMemo(() => {
    const sorted = [...completedMatches].sort((a, b) => {
      const timeA = new Date(a.played_at || a.result?.reportedAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.played_at || b.result?.reportedAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return sorted.slice(0, 5);
  }, [completedMatches]);

  // Keep resultsIndex within valid bounds
  const currentCompleted = last5Completed[resultsIndex] || last5Completed[0] || null;

  const handlePrevResult = () => {
    setResultsIndex((prev) => (prev > 0 ? prev - 1 : last5Completed.length - 1));
  };

  const handleNextResult = () => {
    setResultsIndex((prev) => (prev < last5Completed.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* ========================================================================= */}
      {/* SECTION 0 (TOP): PENDING MATCHES (PARTICIPANT-SPECIFIC)                   */}
      {/* ========================================================================= */}
      {sortedPending.length > 0 && (
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 truncate">
                <i className="fa-regular fa-clock text-amber-500"></i>
                <span>Offene Ergebnisse</span>
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1 uppercase tracking-wider">
                Dein Match
              </span>

              {sortedPending.length > 1 && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={handlePrevPending}
                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                    title="Vorheriges offenes Spiel"
                  >
                    <i className="fa-solid fa-chevron-left text-[8px]" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-500 min-w-[20px] text-center">
                    {pendingIndex + 1}/{sortedPending.length}
                  </span>
                  <button
                    onClick={handleNextPending}
                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                    title="Nächstes offenes Spiel"
                  >
                    <i className="fa-solid fa-chevron-right text-[8px]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {currentPending && (
            (() => {
              const p1Id = currentPending.player1UserId || currentPending.player1Id || '';
              const p2Id = currentPending.player2UserId || currentPending.player2Id || '';
              const p1Name =
                (getUserName && getUserName(p1Id)) ||
                (currentPending.player1 as any)?.name ||
                'Spieler 1';
              const p2Name =
                (getUserName && getUserName(p2Id)) ||
                (currentPending.player2 as any)?.name ||
                'Spieler 2';

              const p1Obj = getUserObject ? getUserObject(p1Id) : null;
              const p2Obj = getUserObject ? getUserObject(p2Id) : null;
              const p1IsUser = p1Id === currentUser.id;
              const p2IsUser = p2Id === currentUser.id;

              const courtLocation = formatMatchCourtAndFacility(currentPending, resolveClubName(currentPending.clubId || ''));

              return (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <i className="fa-regular fa-calendar-days text-slate-400 shrink-0" />
                      <span className="truncate font-semibold text-slate-700">
                        {currentPending.scheduledDate && formatDate(currentPending.scheduledDate + 'T' + (currentPending.scheduledStartTime || '00:00'))}
                      </span>
                    </span>
                    {currentPending.scheduledStartTime && (
                      <span className="flex items-center gap-1 text-slate-500 shrink-0 font-medium text-[10.5px]">
                        <i className="fa-regular fa-clock text-[10px] text-slate-400" />
                        {currentPending.scheduledStartTime} Uhr
                      </span>
                    )}
                  </div>

                  {courtLocation && courtLocation !== 'Platz n.V.' && (
                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 px-1 -mt-1">
                      <i className="fa-solid fa-location-dot text-amber-500 text-[10px] shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{courtLocation}</span>
                    </div>
                  )}

                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <UserAvatar
                            user={p1Obj}
                            avatarUrl={p1Obj?.avatarUrl}
                            avatarIcon={p1Obj?.avatarIcon}
                            initials={(p1Obj as any)?.initials}
                            name={p1Name}
                            size="sm"
                            variant={p1IsUser ? "green" : "neutral"}
                            className={p1IsUser ? "ring-1 ring-emerald-400/50 shadow-2xs" : ""}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${p1IsUser ? 'text-emerald-950 font-black' : 'text-slate-700'}`}>
                            {p1Name}
                          </div>
                          {p1IsUser && <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Du</span>}
                        </div>
                      </div>

                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">VS</span>

                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${p2IsUser ? 'text-emerald-950 font-black' : 'text-slate-700'}`}>
                            {p2Name}
                          </div>
                          {p2IsUser && <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Du</span>}
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
                            className={p2IsUser ? "ring-1 ring-emerald-400/50 shadow-2xs" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() => onEnterResult(currentPending)}
                      className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-pen-to-square text-[11px]" />
                      Ergebnis eintragen
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1 (TOP): ANSTEHENDE MATCHES (COMMUNITY FEED)                       */}
      {/* ========================================================================= */}
      <div className="p-4 md:p-5 space-y-3">
        {/* Section 1 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5 truncate">
              <i className="fa-regular fa-calendar-check text-[var(--color-primary)]"></i>
              <span>Anstehendes Match</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUpcoming && (
              (() => {
                const isUserMatch =
                  currentUpcoming.player1UserId === currentUser.id ||
                  currentUpcoming.player2UserId === currentUser.id;

                return isUserMatch ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <i className="fa-solid fa-user-check text-[9px]"></i>
                    Dein Match
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/80 flex items-center gap-1">
                    <i className="fa-solid fa-trophy text-[9px] text-amber-500"></i>
                    Liga-Match
                  </span>
                );
              })()
            )}

            {sortedUpcoming.length > 1 && (
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={handlePrevUpcoming}
                  className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Vorheriges anstehendes Spiel"
                >
                  <i className="fa-solid fa-chevron-left text-[8px]" />
                </button>
                <span className="text-[10px] font-bold text-slate-400 min-w-[20px] text-center">
                  {upcomingIndex + 1}/{sortedUpcoming.length}
                </span>
                <button
                  onClick={handleNextUpcoming}
                  className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Nächstes anstehendes Spiel"
                >
                  <i className="fa-solid fa-chevron-right text-[8px]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 1 Content */}
        {currentUpcoming ? (
          (() => {
            const isUserMatch =
              currentUpcoming.player1UserId === currentUser.id ||
              currentUpcoming.player2UserId === currentUser.id;

            const p1Name = getUserName(currentUpcoming.player1UserId) || currentUpcoming.player1?.name || 'Spieler 1';
            const p2Name = getUserName(currentUpcoming.player2UserId) || currentUpcoming.player2?.name || 'Spieler 2';
            const p1Obj = currentUpcoming.player1 || (getUserObject ? getUserObject(currentUpcoming.player1UserId) : null);
            const p2Obj = currentUpcoming.player2 || (getUserObject ? getUserObject(currentUpcoming.player2UserId) : null);
            const p1ClubName = resolveClubName(p1Obj?.vereinsId || p1Obj?.clubName || currentUpcoming.clubId || '');
            const p2ClubName = resolveClubName(p2Obj?.vereinsId || p2Obj?.clubName || currentUpcoming.clubId || '');

            const p1IsUser = currentUpcoming.player1UserId === currentUser.id;
            const p2IsUser = currentUpcoming.player2UserId === currentUser.id;

            const courtLocation = formatMatchCourtAndFacility(currentUpcoming, resolveClubName(currentUpcoming.clubId || ''));
            const isStarted = isMatchStarted(currentUpcoming);

            return (
              <div className="space-y-2.5">
                {/* Date & Time pill */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <i className="fa-regular fa-calendar text-[var(--color-primary)] shrink-0" />
                    <span className="truncate">
                      {currentUpcoming.scheduledDate
                        ? formatDate(currentUpcoming.scheduledDate + 'T' + (currentUpcoming.scheduledStartTime || '00:00'))
                        : 'Termin offen'}
                    </span>
                  </span>
                  {currentUpcoming.scheduledStartTime && (
                    <span className="flex items-center gap-1 text-slate-500 shrink-0 font-semibold">
                      <i className="fa-regular fa-clock text-[10px]" />
                      {currentUpcoming.scheduledStartTime}
                      {currentUpcoming.scheduledEndTime ? ` – ${currentUpcoming.scheduledEndTime}` : ''}
                    </span>
                  )}
                </div>

                {/* Court Location */}
                {courtLocation && courtLocation !== 'Platz n.V.' && (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 px-1 -mt-1">
                    <i className="fa-solid fa-location-dot text-amber-500 text-[10px] shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">{courtLocation}</span>
                  </div>
                )}

                {/* Matchup Banner */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    isUserMatch
                      ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  {/* Clubs title if not user's match */}
                  {!isUserMatch && (p1ClubName || p2ClubName) && (
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="truncate max-w-[45%] text-slate-700">{p1ClubName || 'Verein 1'}</span>
                      <span className="text-slate-400 font-bold lowercase px-1">vs</span>
                      <span className="truncate max-w-[45%] text-right text-slate-700">{p2ClubName || 'Verein 2'}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    {/* Player 1 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          user={p1Obj}
                          avatarUrl={p1Obj?.avatarUrl}
                          avatarIcon={p1Obj?.avatarIcon}
                          initials={(p1Obj as any)?.initials}
                          name={p1Name}
                          size="sm"
                          variant={p1IsUser ? "green" : "neutral"}
                          className={p1IsUser ? "ring-2 ring-emerald-400/50 shadow-xs" : ""}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                          <span className={`truncate ${p1IsUser ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>{p1Name}</span>
                          {p1IsUser && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded shrink-0">
                              Du
                            </span>
                          )}
                        </div>
                        {isUserMatch && p1ClubName && (
                          <span className="text-[9.5px] text-slate-400 truncate block">{p1ClubName}</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">
                      VS
                    </span>

                    {/* Player 2 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center justify-end gap-1">
                          {p2IsUser && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded shrink-0">
                              Du
                            </span>
                          )}
                          <span className={`truncate ${p2IsUser ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>{p2Name}</span>
                        </div>
                        {isUserMatch && p2ClubName && (
                          <span className="text-[9.5px] text-slate-400 truncate block">{p2ClubName}</span>
                        )}
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
                          className={p2IsUser ? "ring-2 ring-emerald-400/50 shadow-xs" : ""}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons for own matches */}
                {isUserMatch && (
                  <div className="pt-1 flex items-center gap-2">
                    {isStarted ? (
                      <button
                        onClick={() => onEnterResult(currentUpcoming)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-pen-to-square text-[11px]" />
                        Ergebnis eintragen
                      </button>
                    ) : (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (onRebook) {
                              onRebook(currentUpcoming);
                            } else if (onEditMatch) {
                              onEditMatch(currentUpcoming);
                            } else {
                              onEnterResult(currentUpcoming);
                            }
                          }}
                          className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <i className="fa-regular fa-calendar-check text-[11px] text-[var(--color-primary)]" />
                          Details / Umbuchen
                        </button>
                        <button
                          onClick={() => onEnterResult(currentUpcoming)}
                          className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200/70 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="Ergebnis eintragen"
                        >
                          <i className="fa-solid fa-pen-to-square text-[10px]" />
                          Ergebnis
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* Empty state for upcoming matches */
          <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Aktuell kein anstehendes Liga-Spiel geplant.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DIVIDER                                                                   */}
      {/* ========================================================================= */}
      <div className="border-t border-slate-100 border-dashed" />

      {/* ========================================================================= */}
      {/* SECTION 2 (BOTTOM): LETZTE ERGEBNISSE (SLIDER / 5 MATCHES)                */}
      {/* ========================================================================= */}
      <div className="p-4 md:p-5 space-y-3 bg-slate-50/40">
        {/* Section 2 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
            <i className="fa-solid fa-clock-rotate-left text-[var(--color-primary)]"></i>
            <span>Letztes Ergebnis</span>
          </h3>

          {/* 5-Match Pagination (< 1 / 5 >) */}
          {last5Completed.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevResult}
                className="w-5 h-5 rounded-md bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Neuere Ergebnisse"
              >
                <i className="fa-solid fa-chevron-left text-[8px]" />
              </button>
              <span className="text-[10px] font-black text-slate-500 min-w-[28px] text-center">
                {resultsIndex + 1} / {last5Completed.length}
              </span>
              <button
                onClick={handleNextResult}
                className="w-5 h-5 rounded-md bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Ältere Ergebnisse"
              >
                <i className="fa-solid fa-chevron-right text-[8px]" />
              </button>
            </div>
          )}
        </div>

        {/* Section 2 Content */}
        {currentCompleted ? (
          (() => {
            const p1Name = getUserName(currentCompleted.player1UserId) || currentCompleted.player1?.name || 'Spieler 1';
            const p2Name = getUserName(currentCompleted.player2UserId) || currentCompleted.player2?.name || 'Spieler 2';
            const p1Obj = currentCompleted.player1 || (getUserObject ? getUserObject(currentCompleted.player1UserId) : null);
            const p2Obj = currentCompleted.player2 || (getUserObject ? getUserObject(currentCompleted.player2UserId) : null);
            const isAborted = currentCompleted.status === 'aborted' || currentCompleted.completionType === 'aborted' || currentCompleted.result?.completionType === 'aborted';
            const isRetired = currentCompleted.completionType === 'retired' || currentCompleted.result?.completionType === 'retired' || !!currentCompleted.result?.retiredPlayerId;
            const retiredPlayerId = currentCompleted.result?.retiredPlayerId;

            const isP1Winner = !isAborted && currentCompleted.result?.winnerId === currentCompleted.player1UserId;
            const isP2Winner = !isAborted && currentCompleted.result?.winnerId === currentCompleted.player2UserId;

            const isUserCompleted =
              currentCompleted.player1UserId === currentUser.id ||
              currentCompleted.player2UserId === currentUser.id;

            const didUserWin = !isAborted && isUserCompleted && currentCompleted.result?.winnerId === currentUser.id;

            const p1IsUser = currentCompleted.player1UserId === currentUser.id;
            const p2IsUser = currentCompleted.player2UserId === currentUser.id;

            const clubName = resolveClubName(currentCompleted.clubId || '');
            const rawSets = currentCompleted.result?.sets;
            const setsFormatted = rawSets && rawSets.length > 0
              ? rawSets.map((s) => `${s.p1}:${s.p2}`).join(', ')
              : (isAborted ? 'Keine Sätze gespielt' : 'Ergebnis eingetragen');

            const winnerDelta = isP1Winner
              ? currentCompleted.pointsAwarded?.player1
              : isP2Winner
              ? currentCompleted.pointsAwarded?.player2
              : undefined;

            const isProvisional = isMatchProvisional(currentCompleted);
            const provisionalText = getProvisionalRemainingText(currentCompleted);
            const editAuth = canUserEditOrCancelResult(currentCompleted, currentUser?.id, currentUser?.role);

            return (
              <div className="space-y-2.5">
                {/* Meta Header: Date, Club & User Badge */}
                <div className="flex items-center justify-between text-[10.5px] text-slate-500 flex-wrap gap-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1 truncate">
                    <i className="fa-regular fa-calendar-check text-[10px] text-slate-400" />
                    <span>
                      {formatDate(
                        currentCompleted.played_at ||
                          currentCompleted.result?.reportedAt ||
                          currentCompleted.updatedAt ||
                          currentCompleted.createdAt
                      )}
                    </span>
                    {clubName && <span className="text-slate-400">· {clubName}</span>}
                  </span>

                  {isAborted ? (
                    <span className="bg-rose-100 text-rose-800 font-bold text-[9px] px-2 py-0.5 rounded-full border border-rose-200 uppercase">
                      Abbruch: {currentCompleted.abandonmentReason || currentCompleted.result?.abandonmentReason || 'Spielabbruch'}
                    </span>
                  ) : isUserCompleted ? (
                    <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-300/80 uppercase shrink-0">
                      Dein Ergebnis
                    </span>
                  ) : isRetired ? (
                    <span className="bg-amber-100 text-amber-800 font-bold text-[9px] px-2 py-0.5 rounded-full border border-amber-200 uppercase">
                      Aufgabe (w.o.)
                    </span>
                  ) : null}
                </div>

                {/* 24h Provisional Status Pill if active */}
                {isProvisional && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
                    <span className="font-bold flex items-center gap-1 text-[10.5px]">
                      <i className="fa-solid fa-clock text-amber-600" />
                      {provisionalText}
                    </span>
                    <span className="text-[9px] bg-amber-200/60 font-black px-1.5 py-0.2 rounded uppercase">
                      24h
                    </span>
                  </div>
                )}

                {/* Matchup Players & Scores */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    isUserCompleted
                      ? didUserWin
                        ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs'
                        : 'bg-slate-50 border-slate-200/80'
                      : 'bg-white border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Player 1 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          user={p1Obj}
                          avatarUrl={p1Obj?.avatarUrl}
                          avatarIcon={p1Obj?.avatarIcon}
                          initials={(p1Obj as any)?.initials}
                          name={p1Name}
                          size="sm"
                          variant={p1IsUser ? "green" : "neutral"}
                          className={p1IsUser ? "ring-2 ring-emerald-400/50 shadow-xs" : ""}
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
                        <div
                          className={`text-xs font-bold truncate ${
                            isP1Winner ? 'text-slate-900 font-black' : p1IsUser ? 'text-emerald-900 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {p1Name}
                        </div>
                        {isP1Winner && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">
                            {isRetired ? 'Sieger (w.o.)' : 'Sieger'}
                          </span>
                        )}
                        {!isP1Winner && !isAborted && retiredPlayerId === currentCompleted.player1UserId && (
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">
                            Aufgabe (w.o.)
                          </span>
                        )}
                        {!isP1Winner && p1IsUser && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Du
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">
                      VS
                    </span>

                    {/* Player 2 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-bold truncate ${
                            isP2Winner ? 'text-slate-900 font-black' : p2IsUser ? 'text-emerald-900 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {p2Name}
                        </div>
                        {isP2Winner && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">
                            {isRetired ? 'Sieger (w.o.)' : 'Sieger'}
                          </span>
                        )}
                        {!isP2Winner && !isAborted && retiredPlayerId === currentCompleted.player2UserId && (
                          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">
                            Aufgabe (w.o.)
                          </span>
                        )}
                        {!isP2Winner && p2IsUser && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Du
                          </span>
                        )}
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
                          className={p2IsUser ? "ring-2 ring-emerald-400/50 shadow-xs" : ""}
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

                  {/* Set scores & Points summary */}
                  <div className="flex items-center justify-between text-xs pt-2.5 mt-2 border-t border-slate-100/80">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium text-[10.5px]">Sätze:</span>
                      <span className="font-black text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60 text-[11px]">
                        {setsFormatted}
                      </span>
                    </div>

                    {isAborted ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium text-[10.5px]">Wertung:</span>
                        <span className="font-bold text-slate-500 text-xs">
                          Keine Wertung (0 Pkt.)
                        </span>
                      </div>
                    ) : typeof winnerDelta === 'number' && !isNaN(winnerDelta) ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium text-[10.5px]">Punkte:</span>
                        <span className="font-black text-[var(--color-primary)] text-xs">
                          +{Math.abs(winnerDelta).toFixed(1)} Pkt.
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Participant 24h Action Buttons */}
                {editAuth.canEdit && (
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() => onEditMatch && onEditMatch(currentCompleted)}
                      className="flex-1 py-1.5 px-3 border border-slate-200 bg-white text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <i className="fa-solid fa-pen text-[10px]" /> Korrigieren
                    </button>
                    <button
                      onClick={() => onCancelMatch && onCancelMatch(currentCompleted)}
                      className="py-1.5 px-3 border border-slate-200 bg-white text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Match-Ergebnis stornieren und Punkte zurücksetzen"
                    >
                      <i className="fa-solid fa-rotate-left text-[10px]" /> Stornieren
                    </button>
                  </div>
                )}

                {/* 5-Dots Pagination Indicator */}
                {last5Completed.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {last5Completed.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setResultsIndex(idx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === resultsIndex
                            ? 'w-4 bg-[var(--color-primary)]'
                            : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                        title={`Ergebnis ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* Empty state for recent results */
          <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Noch keine absolvierten Matches in der Hobbyliga vorhanden.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
