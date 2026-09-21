import React, { useState } from 'react';
import { Trophy, CheckCircle2, Clock, Calendar, Edit3, Filter, AlertCircle, Flag, MapPin } from 'lucide-react';
import { Match, Participant, TournamentInstance } from '../../types/championship';
import { getDeadlineCountdownInfo, formatEventDate } from '../../utils/championshipScheduling';
import { User } from '../../types';

interface ChampionshipMatchListProps {
  tournament: TournamentInstance;
  currentUser: User | null;
  onEnterResult: (match: Match) => void;
  filterParticipantId?: string | null;
  onClearParticipantFilter?: () => void;
  users: Record<string, User>;
}

export const ChampionshipMatchList: React.FC<ChampionshipMatchListProps> = ({
  tournament,
  currentUser,
  onEnterResult,
  filterParticipantId,
  onClearParticipantFilter,
  users,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

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

  // Filter matches
  const filteredMatches = tournament.matches.filter((m) => {
    // Participant filter (e.g. clicked on table row)
    if (filterParticipantId) {
      if (m.participant1Id !== filterParticipantId && m.participant2Id !== filterParticipantId) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'pending') {
      if (m.status === 'completed' || m.status === 'walkover') return false;
    }
    if (statusFilter === 'completed') {
      if (m.status !== 'completed' && m.status !== 'walkover') return false;
    }

    // Stage filter
    if (stageFilter !== 'all') {
      if (m.stageId !== stageFilter) return false;
    }

    return true;
  });

  const participantFilterName = filterParticipantId
    ? formatParticipant(filterParticipantId)
    : null;

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-[var(--color-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alle Spiele ({tournament.matches.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white text-[var(--color-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Offen ({tournament.matches.filter((m) => m.status === 'scheduled' || m.status === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-white text-[var(--color-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Beendet ({tournament.matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length})
            </button>
          </div>

          {/* Stage Dropdown */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/70 border-none rounded-xl px-3 py-2 cursor-pointer focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            <option value="all">Alle Phasen</option>
            {tournament.stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active Participant Filter Chip */}
        {filterParticipantId && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
            <span>Gefiltert nach: {participantFilterName}</span>
            <button
              type="button"
              onClick={onClearParticipantFilter}
              className="text-emerald-600 hover:text-emerald-950 font-black ml-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center">
          <p className="text-sm font-semibold text-slate-500">
            Keine Begegnungen für den ausgewählten Filter gefunden.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const isCompleted = match.status === 'completed' || match.status === 'walkover';
            const p1Name = formatParticipant(match.participant1Id);
            const p2Name = formatParticipant(match.participant2Id);
            const stage = tournament.stages.find((s) => s.id === match.stageId);

            const isP1Winner = match.result?.winnerParticipantId === match.participant1Id;
            const isP2Winner = match.result?.winnerParticipantId === match.participant2Id;

            const sets = match.result?.sets || [];
            const setsDisplay = sets
              .map((s) => `${s.player1Games}:${s.player2Games}`)
              .join(', ');

            return (
              <div
                key={match.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-[var(--color-primary)] transition-all"
              >
                <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 pb-2 border-b border-slate-100">
                    <span>
                      {stage?.name || 'Turnier'} · {match.roundLabel}
                    </span>
                    {isCompleted ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Abgeschlossen
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        Ausstehend
                      </span>
                    )}
                  </div>

                  {/* Scheduling / Deadline / Finalstag Badge */}
                  {(() => {
                    const isFinalsDay = stage?.type === 'finals_day' || stage?.isFinalsDay;
                    const mode = (stage && tournament.stageDeadlineTypes?.[stage.id]) ||
                      stage?.deadlineType ||
                      (isFinalsDay ? 'date' : 'deadline');
                    const isFixedDate = mode === 'date';
                    const stageDeadline = stage ? tournament.stageDeadlines?.[stage.id] : undefined;
                    const eventDate = match.scheduledDate || (isFixedDate ? stageDeadline : undefined);
                    const deadline = match.deadlineDate || (!isFixedDate ? stageDeadline : undefined);

                    if (isFixedDate && eventDate) {
                      const label = isFinalsDay ? 'Finaltag' : 'Spieltag';
                      return (
                        <div className="mb-3 px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center justify-between text-xs text-amber-900 font-medium">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Flag className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            {label}: {formatEventDate(eventDate)}
                          </span>
                          {(match.startTime || match.courtId) && (
                            <span className="text-[11px] text-amber-800 font-semibold bg-white/80 px-2 py-0.5 rounded-md border border-amber-200/50">
                              {match.startTime ? `${match.startTime} Uhr` : ''}
                              {match.startTime && match.courtId ? ' · ' : ''}
                              {match.courtId ? `Platz ${match.courtId.replace('court-', '')}` : ''}
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (deadline && !isCompleted) {
                      const countdown = getDeadlineCountdownInfo(deadline);
                      return (
                        <div className="mb-3 px-2.5 py-1.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-slate-700">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            Zu spielen bis {countdown.formattedDate}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              countdown.isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : countdown.isUrgent
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {countdown.daysRemainingText}
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Players Display */}
                  <div className="space-y-2 mb-4">
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                        isCompleted && isP1Winner
                          ? 'bg-emerald-50 text-emerald-950 font-black'
                          : 'text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate">{p1Name}</span>
                      {isCompleted && isP1Winner && (
                        <Trophy className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                    </div>

                    <div
                      className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                        isCompleted && isP2Winner
                          ? 'bg-emerald-50 text-emerald-950 font-black'
                          : 'text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate">{p2Name}</span>
                      {isCompleted && isP2Winner && (
                        <Trophy className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer with score and action button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    {isCompleted ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                          {match.result?.isWalkover ? 'Walkover (w/o)' : setsDisplay}
                        </span>
                        {match.result?.enteredByUserName && (
                          <span className="text-[10px] text-slate-400 block">
                            von {match.result.enteredByUserName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Noch kein Ergebnis</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onEnterResult(match)}
                    disabled={!match.participant1Id || !match.participant2Id}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-[var(--color-primary)] hover:text-white text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isCompleted ? 'Korrigieren' : 'Erfassen'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
