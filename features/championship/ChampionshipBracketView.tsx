import React, { useState } from 'react';
import { Trophy, CheckCircle2, ChevronRight, User, Calendar, Flag, Clock } from 'lucide-react';
import { Match, Participant, TournamentInstance, TournamentStageConfig } from '../../types/championship';
import { getDeadlineCountdownInfo, formatEventDate } from '../../utils/championshipScheduling';
import { User as AppUser } from '../../types';

interface ChampionshipBracketViewProps {
  tournament: TournamentInstance;
  onMatchClick: (match: Match) => void;
  users: Record<string, AppUser>;
}

export const ChampionshipBracketView: React.FC<ChampionshipBracketViewProps> = ({
  tournament,
  onMatchClick,
  users,
}) => {
  // Support both knockout and finals_day stages in bracket view
  const koStages = tournament.stages
    .filter((s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay)
    .sort((a, b) => a.order - b.order);

  const [activeMobileStageId, setActiveMobileStageId] = useState<string>(
    koStages[0]?.id || ''
  );

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

  if (koStages.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center">
        <p className="text-sm font-semibold text-slate-500">
          Dieses Turnier besitzt keine K.-o.-Phase.
        </p>
      </div>
    );
  }

  const renderMatchCard = (match: Match) => {
    const p1 = tournament.participants.find((p) => p.id === match.participant1Id);
    const p2 = tournament.participants.find((p) => p.id === match.participant2Id);
    const p1Name = formatParticipant(match.participant1Id);
    const p2Name = formatParticipant(match.participant2Id);

    const isCompleted = match.status === 'completed' || match.status === 'walkover';
    const isP1Winner = match.result?.winnerParticipantId === match.participant1Id;
    const isP2Winner = match.result?.winnerParticipantId === match.participant2Id;

    const sets = match.result?.sets || [];
    const setsDisplay = sets
      .map((s) => `${s.player1Games}:${s.player2Games}`)
      .join(', ');

    const stage = tournament.stages.find((s) => s.id === match.stageId);
    const isFinalsDay = stage?.type === 'finals_day' || stage?.isFinalsDay;
    const deadlineMode = (stage && tournament.stageDeadlineTypes?.[stage.id]) ||
      stage?.deadlineType ||
      (isFinalsDay ? 'date' : 'deadline');
    const isFixedDate = deadlineMode === 'date';
    const stageDeadline = stage ? tournament.stageDeadlines?.[stage.id] : undefined;
    const eventDate = match.scheduledDate || (isFixedDate ? stageDeadline : undefined);
    const deadline = match.deadlineDate || (!isFixedDate ? stageDeadline : undefined);

    return (
      <div
        key={match.id}
        onClick={() => onMatchClick(match)}
        className={`bg-white rounded-xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-[var(--color-primary)] overflow-hidden ${
          isCompleted ? 'border-slate-200' : 'border-slate-300'
        }`}
      >
        {/* Match Header */}
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
          <span className="truncate">{match.roundLabel}</span>
          {isCompleted ? (
            <span className="text-emerald-600 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" />
              Beendet
            </span>
          ) : (
            <span className="text-amber-600 font-bold">Offen</span>
          )}
        </div>

        {/* Finals Day & Time Tag (if available) */}
        {isFinalsDay && (match.startTime || match.courtId) && (
          <div className="px-3 py-1 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between text-[10px] font-medium text-amber-900">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-700" />
              {match.startTime ? `${match.startTime} Uhr` : 'Finaltag'}
            </span>
            {match.courtId && (
              <span className="font-bold">
                Platz {match.courtId.replace('court-', '')}
              </span>
            )}
          </div>
        )}

        {/* Participants & Scores */}
        <div className="p-3 space-y-2">
          {/* Player 1 */}
          <div
            className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded-lg ${
              isCompleted && isP1Winner
                ? 'bg-emerald-50 text-emerald-950 font-black'
                : 'text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {p1?.seed && (
                <span className="text-[9px] font-bold px-1 bg-slate-200 text-slate-700 rounded">
                  {p1.seed}
                </span>
              )}
              <span className={`truncate ${!match.participant1Id ? 'text-slate-400 italic' : ''}`}>
                {p1Name}
              </span>
            </div>
            {isCompleted && isP1Winner && (
              <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
          </div>

          {/* Player 2 */}
          <div
            className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded-lg ${
              isCompleted && isP2Winner
                ? 'bg-emerald-50 text-emerald-950 font-black'
                : 'text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {p2?.seed && (
                <span className="text-[9px] font-bold px-1 bg-slate-200 text-slate-700 rounded">
                  {p2.seed}
                </span>
              )}
              <span className={`truncate ${!match.participant2Id ? 'text-slate-400 italic' : ''}`}>
                {p2Name}
              </span>
            </div>
            {isCompleted && isP2Winner && (
              <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
          </div>

          {/* Result Score Pill */}
          {isCompleted && (
            <div className="pt-1 text-center border-t border-slate-100">
              <span className="inline-block text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {match.result?.isWalkover ? 'Walkover (w/o)' : setsDisplay}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Stage Selector */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
        {koStages.map((stage) => {
          const isActive = activeMobileStageId === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveMobileStageId(stage.id)}
              className={`flex-1 min-w-[120px] py-2 px-3 text-xs font-bold rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white text-[var(--color-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {stage.name}
            </button>
          );
        })}
      </div>

      {/* Desktop Multi-column Bracket Tree */}
      <div className="hidden lg:grid grid-flow-col auto-cols-fr gap-6 items-center overflow-x-auto pb-4">
        {koStages.map((stage, sIdx) => {
          const stageMatches = tournament.matches.filter((m) => m.stageId === stage.id);
          const deadline = tournament.stageDeadlines?.[stage.id];

          return (
            <div key={stage.id} className="space-y-4 min-w-[240px]">
              {/* Stage Header */}
              <div
                className={`p-3 border rounded-xl text-center ${
                  stage.type === 'finals_day' || stage.isFinalsDay
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {(stage.type === 'finals_day' || stage.isFinalsDay) && (
                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {stage.name}
                  </h4>
                </div>
                {(() => {
                  const isFinals = stage.type === 'finals_day' || stage.isFinalsDay;
                  const mode = tournament.stageDeadlineTypes?.[stage.id] ||
                    stage.deadlineType ||
                    (isFinals ? 'date' : 'deadline');
                  const isDateMode = mode === 'date';

                  if (isDateMode) {
                    return deadline ? (
                      <span className="text-[10px] text-amber-800 font-bold block mt-1">
                        {isFinals ? 'Finaltag' : 'Spieltag'}: {formatEventDate(deadline)}
                      </span>
                    ) : null;
                  }

                  return deadline ? (() => {
                    const cd = getDeadlineCountdownInfo(deadline);
                    return (
                      <span
                        className={`text-[10px] font-bold inline-block mt-1 px-1.5 py-0.5 rounded ${
                          cd.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : cd.isUrgent
                            ? 'bg-amber-100 text-amber-800'
                            : 'text-slate-500 bg-white/70 border border-slate-200/60'
                        }`}
                      >
                        Bis {cd.formattedDate} ({cd.daysRemainingText})
                      </span>
                    );
                  })() : null;
                })()}
              </div>

              {/* Matches column with vertical centering */}
              <div className="space-y-6 flex flex-col justify-around min-h-[360px]">
                {stageMatches.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center italic">Noch keine Spiele</p>
                ) : (
                  stageMatches.map((m) => renderMatchCard(m))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Selected Stage View */}
      <div className="lg:hidden space-y-3">
        {(() => {
          const curStage =
            koStages.find((s) => s.id === activeMobileStageId) || koStages[0];
          if (!curStage) return null;

          const stageMatches = tournament.matches.filter((m) => m.stageId === curStage.id);

          return (
            <div className="space-y-3">
              {stageMatches.map((m) => renderMatchCard(m))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
