import React from 'react';
import { Trophy, HelpCircle, UserCheck, AlertCircle, Calendar } from 'lucide-react';
import { Group, Match, Participant, TournamentInstance } from '../../types/championship';
import { calculateGroupStandings } from '../../utils/championshipCalculator';
import { getDeadlineCountdownInfo } from '../../utils/championshipScheduling';
import { User } from '../../types';

interface ChampionshipGroupViewProps {
  tournament: TournamentInstance;
  onSelectParticipant?: (participantId: string | null) => void;
  selectedParticipantId?: string | null;
  users: Record<string, User>;
}

export const ChampionshipGroupView: React.FC<ChampionshipGroupViewProps> = ({
  tournament,
  onSelectParticipant,
  selectedParticipantId,
  users,
}) => {
  const groupStage = tournament.stages.find((s) => s.type === 'group');
  const advancingSlots = groupStage?.advancingPerGroup ?? 2;

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

  const formatParticipant = (p: Participant): string => {
    return p.playerIds.map(getPlayerDisplayName).join(' / ');
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

  const groupDeadline = groupStage?.deadlineDate || tournament.stageDeadlines?.[groupStage?.id || ''];
  const countdownInfo = groupDeadline ? getDeadlineCountdownInfo(groupDeadline) : null;

  return (
    <div className="space-y-6">
      {countdownInfo && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Frist für alle Gruppenphase-Matches
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Alle Gruppenspiele müssen bis zum Stichtag ausgetragen und eingetragen sein.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="text-xs font-black text-slate-800">
              Bis {countdownInfo.formattedDate}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                countdownInfo.isOverdue
                  ? 'bg-rose-100 text-rose-800'
                  : countdownInfo.isUrgent
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {countdownInfo.daysRemainingText}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                  <h4 className="font-bold text-slate-900 text-sm tracking-tight">{group.name}</h4>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Top {advancingSlots} qualifizieren sich
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Spieler / Team</th>
                      <th className="py-2.5 px-2 text-center" title="Gespielte Matches">Sp</th>
                      <th className="py-2.5 px-2 text-center text-emerald-700" title="Siege">S</th>
                      <th className="py-2.5 px-2 text-center text-rose-600" title="Niederlagen">N</th>
                      <th className="py-2.5 px-2 text-center hidden sm:table-cell" title="Satzverhältnis">Sätze</th>
                      <th className="py-2.5 px-2 text-center font-bold" title="Satzdifferenz">SDiff</th>
                      <th className="py-2.5 px-2 text-center hidden md:table-cell" title="Spieleverhältnis">Spiele</th>
                      <th className="py-2.5 px-2 text-center font-bold" title="Gamedifferenz">GDiff</th>
                      <th className="py-2.5 px-3 text-center font-black text-slate-900" title="Punkte">Pkt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {standings.map((row) => {
                      const isSelected = selectedParticipantId === row.participantId;
                      const displayName = formatParticipant(row.participant);

                      return (
                        <tr
                          key={row.participantId}
                          onClick={() =>
                            onSelectParticipant?.(
                              isSelected ? null : row.participantId
                            )
                          }
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/80 font-bold'
                              : row.isAdvancing
                              ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black ${
                                row.isAdvancing
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'text-slate-400'
                              }`}
                            >
                              {row.rank}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[150px] sm:max-w-[200px] text-slate-800 font-bold">
                                {displayName}
                              </span>
                              {row.participant.withdrawn && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  Ausgeschieden
                                </span>
                              )}
                              {row.participant.seed && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  [{row.participant.seed}]
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center text-slate-500">{row.matchesPlayed}</td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-600">{row.wins}</td>
                          <td className="py-3 px-2 text-center text-slate-400">{row.losses}</td>
                          <td className="py-3 px-2 text-center text-slate-500 hidden sm:table-cell">
                            {row.setsWon}:{row.setsLost}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-700">
                            {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-500 hidden md:table-cell">
                            {row.gamesWon}:{row.gamesLost}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-700">
                            {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                          </td>
                          <td className="py-3 px-3 text-center font-black text-slate-900 text-sm">
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

      {/* Tie Break rule hint */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 font-medium">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          <strong>Kriterium bei Punktgleichheit:</strong>{' '}
          {tournament.tieBreakRule === 'head_to_head'
            ? 'Direkter Vergleich (bei 2 Spielern), danach Satzdifferenz und Gamedifferenz.'
            : 'Satzdifferenz, danach Gamedifferenz.'}
          {' '}Klicke auf einen Spieler, um nur seine Spiele anzuzeigen.
        </span>
      </div>
    </div>
  );
};
