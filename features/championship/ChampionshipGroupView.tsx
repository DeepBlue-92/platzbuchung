import React, { useState, useEffect } from 'react';
import { Trophy, HelpCircle, Calendar, CheckCircle2, Clock, X, Edit3, ArrowRight, UserCheck, ListOrdered } from 'lucide-react';
import { Group, Match, Participant, TournamentInstance } from '../../types/championship';
import { calculateGroupStandings } from '../../utils/championshipCalculator';
import { resolveParticipantDisplayName } from '../../utils/championshipNameResolver';
import { getParticipantRanking } from '../../utils/championshipRankings';
import { ChampionshipMatchCard } from './ChampionshipMatchCard';
import { isChampionshipAdmin } from '../../utils/championshipPermissions';
import { User, RankingState } from '../../types';

interface ChampionshipGroupViewProps {
  tournament: TournamentInstance;
  onSelectParticipant?: (participantId: string | null) => void;
  selectedParticipantId?: string | null;
  onEnterResult?: (match: Match) => void;
  currentUser?: User | null;
  users: Record<string, User>;
  rankings?: RankingState | null;
  onViewAllMatches?: () => void;
  selectedStageId?: string | null;
}

export const ChampionshipGroupView: React.FC<ChampionshipGroupViewProps> = ({
  tournament,
  onSelectParticipant,
  selectedParticipantId,
  onEnterResult,
  currentUser,
  users,
  rankings,
  onViewAllMatches,
  selectedStageId,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedParticipantId || null
  );

  useEffect(() => {
    if (selectedParticipantId !== undefined) {
      setInternalSelectedId(selectedParticipantId);
    }
  }, [selectedParticipantId]);

  const groupStage =
    (selectedStageId ? tournament.stages?.find((s) => s.id === selectedStageId) : null) ||
    tournament.stages?.find((s) => s.type === 'group');
  const phaseName = groupStage?.name || 'Gruppenphase';
  const advancingSlots = groupStage?.advancingPerGroup ?? 2;

  const handleRowClick = (participantId: string) => {
    const next = internalSelectedId === participantId ? null : participantId;
    setInternalSelectedId(next);
    onSelectParticipant?.(next);
  };

  const handleResetFilter = () => {
    setInternalSelectedId(null);
    onSelectParticipant?.(null);
  };

  if (!tournament.groups || tournament.groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center">
        <p className="text-sm font-semibold text-slate-500">
          Dieses Turnier enthält keine Gruppenphase oder die Gruppen wurden noch nicht ausgelost.
        </p>
      </div>
    );
  }

  // All matches belonging to the group stage
  const allGroupMatches = tournament.matches.filter(
    (m) => !groupStage || m.stageId === groupStage.id
  );

  // Filter matches based on selected player or show all group matches
  const displayedMatches = internalSelectedId
    ? allGroupMatches.filter(
        (m) =>
          m.participant1Id === internalSelectedId ||
          m.participant2Id === internalSelectedId
      )
    : allGroupMatches;

  // Selected player name for header badge
  const participants = tournament.participants || [];
  const selectedParticipant = internalSelectedId
    ? participants.find((p) => p.id === internalSelectedId)
    : null;
  const selectedParticipantName = selectedParticipant
    ? resolveParticipantDisplayName(selectedParticipant, users)
    : null;

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Group Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {tournament.groups.map((group) => {
          const standings = calculateGroupStandings(
            group,
            tournament.matches,
            tournament.participants,
            tournament.tieBreakRule,
            advancingSlots
          );

          return (
            <div
              key={group.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              {/* Group Header */}
              <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm tracking-tight">{group.name}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Top {advancingSlots} qualifizieren sich
                  </span>
                  <div className="relative group/tooltip inline-flex items-center">
                    <button
                      type="button"
                      aria-label="Kriterium bei Punktgleichheit"
                      className="text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none flex items-center"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute right-0 top-full mt-1.5 w-64 p-2.5 bg-slate-900 text-white text-[11px] font-normal rounded-lg shadow-lg pointer-events-none z-50 invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 transition-all duration-150 leading-snug">
                      Kriterium bei Punktgleichheit: Direkter Vergleich (bei 2 Spielern), danach Satzdifferenz und Spieldifferenz.
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto sm:overflow-visible">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs sm:text-[13px] font-normal uppercase tracking-wider text-slate-600 bg-slate-50/80">
                      <th className="py-2.5 px-2 sm:px-3 w-8 sm:w-10 text-center font-normal text-slate-600">#</th>
                      <th className="py-2.5 px-2 sm:px-3 min-w-[120px] sm:min-w-[140px] font-normal text-slate-600">
                        <span>Spieler / Team</span>
                        <span className="text-[10px] font-normal text-slate-400 ml-1">(Klick filtert)</span>
                      </th>
                      
                      {/* Mobile-only Bilanz (S:N) */}
                      <th className="py-2.5 px-1.5 w-16 text-center font-normal text-slate-600 table-cell sm:hidden" title="Bilanz (Siege : Niederlagen)">
                        Bilanz
                      </th>

                      {/* Desktop-only full stat columns */}
                      <th className="py-2.5 px-1.5 w-11 text-center font-normal text-slate-600 hidden sm:table-cell" title="Gespielte Partien">SP</th>
                      <th className="py-2.5 px-1.5 w-10 text-center font-normal text-slate-600 hidden sm:table-cell" title="Siege">S</th>
                      <th className="py-2.5 px-1.5 w-10 text-center font-normal text-slate-600 hidden sm:table-cell" title="Niederlagen">N</th>
                      <th className="py-2.5 px-2 min-w-[80px] text-center font-normal text-slate-600 hidden sm:table-cell" title="Gewonnene und verlorene Sätze">SÄTZE</th>
                      <th className="py-2.5 px-2 min-w-[88px] text-center font-normal text-slate-600 hidden md:table-cell" title="Gewonnene und verlorene Spiele">SPIELE</th>
                      
                      {/* Points (visible on mobile and desktop) */}
                      <th className="py-2.5 px-2 w-12 text-center font-normal text-slate-600" title="Punkte">PKT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {standings.map((row) => {
                      const isSelected = internalSelectedId === row.participantId;
                      const displayName = resolveParticipantDisplayName(row.participant, users);
                      const rankPos = tournament.useRankings
                        ? getParticipantRanking(row.participantId, tournament, rankings, users)
                        : null;

                      return (
                        <tr
                          key={row.participantId}
                          onClick={() => handleRowClick(row.participantId)}
                          className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                            isSelected
                              ? 'bg-emerald-100/70 border-l-4 border-emerald-600 shadow-xs'
                              : row.isAdvancing
                              ? 'bg-emerald-50/40'
                              : ''
                          }`}
                          title={`Spiele von ${displayName} anzeigen`}
                        >
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center">
                            <div className="flex items-center justify-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 min-w-[24px] min-h-[24px] rounded-full text-[13px] sm:text-sm font-normal transition-colors ${
                                  row.isAdvancing
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : isSelected
                                    ? 'text-slate-800'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.rank}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 sm:py-3 px-2 sm:px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[130px] sm:max-w-[200px] text-slate-800 font-normal text-[13.5px] sm:text-[14px]">
                                {displayName}
                              </span>
                              {tournament.useRankings && rankPos && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                                  #{rankPos}
                                </span>
                              )}
                              {row.participant.withdrawn && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-amber-100 text-amber-800 border border-amber-300">
                                  Ausgeschieden
                                </span>
                              )}
                              {row.participant.seed && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">
                                  [{row.participant.seed}]
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Mobile-only Bilanz (S:N) */}
                          <td className="py-2.5 sm:py-3 px-1.5 w-16 text-center tabular-nums text-slate-700 table-cell sm:hidden whitespace-nowrap text-[13.5px]">
                            <span className="text-emerald-700">{row.wins}</span>
                            <span className="text-slate-400 font-normal mx-0.5">:</span>
                            <span className="text-rose-600">{row.losses}</span>
                          </td>

                          {/* Desktop columns */}
                          <td className="py-3 px-1.5 w-11 text-center tabular-nums text-slate-500 hidden sm:table-cell text-[13.5px]">
                            {row.matchesPlayed}
                          </td>
                          <td className="py-3 px-1.5 w-10 text-center tabular-nums text-emerald-600 hidden sm:table-cell text-[13.5px]">
                            {row.wins}
                          </td>
                          <td className="py-3 px-1.5 w-10 text-center tabular-nums text-slate-400 hidden sm:table-cell text-[13.5px]">
                            {row.losses}
                          </td>
                          <td className="py-3 px-2 text-center tabular-nums text-slate-700 hidden sm:table-cell whitespace-nowrap text-[13.5px]">
                            <span>{row.setsWon}:{row.setsLost}</span>
                            <span className="text-xs text-slate-400 ml-1.5 font-normal">
                              ({row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff})
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center tabular-nums text-slate-700 hidden md:table-cell whitespace-nowrap text-[13.5px]">
                            <span>{row.gamesWon}:{row.gamesLost}</span>
                            <span className="text-xs text-slate-400 ml-1.5 font-normal">
                              ({row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff})
                            </span>
                          </td>

                          {/* Points */}
                          <td className="py-2.5 sm:py-3 px-2 w-12 text-center tabular-nums text-slate-800 font-normal text-[13.5px] sm:text-[14px]">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Embedded Match List below groups */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 sm:p-5 space-y-3 sm:space-y-4">
        {/* Header with Title, Filter Reset, and Alle Begegnungen Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-2.5 sm:pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                {internalSelectedId
                  ? `Spiele von: ${selectedParticipantName}`
                  : `Begegnungen ${phaseName}`}
              </h3>
              {internalSelectedId && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                  Gefiltert
                </span>
              )}
            </div>
            {internalSelectedId && (
              <p className="text-xs text-slate-500 font-medium">
                Zeigt alle Partien mit Beteiligung von {selectedParticipantName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {internalSelectedId && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Filter zurücksetzen</span>
              </button>
            )}

            {onViewAllMatches && (
              <button
                type="button"
                onClick={onViewAllMatches}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100/90 hover:bg-slate-200/90 rounded-xl transition-all cursor-pointer border border-slate-200/70 shadow-2xs"
                title="Alle Begegnungen über alle Phasen hinweg ansehen"
              >
                <ListOrdered className="w-3.5 h-3.5 text-slate-500" />
                <span>Alle Begegnungen</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Single-Column Match List */}
        {displayedMatches.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">
            Keine Begegnungen für diesen Filter gefunden.
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {displayedMatches.map((match) => (
              <ChampionshipMatchCard
                key={match.id}
                match={match}
                tournament={tournament}
                users={users}
                currentUser={currentUser}
                isAdmin={isChampionshipAdmin(currentUser)}
                onEnterResult={onEnterResult}
                rankings={rankings}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
