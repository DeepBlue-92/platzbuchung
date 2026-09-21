import React, { useState } from 'react';
import { Trophy, CheckCircle2, Clock, Calendar, Edit3, Filter, AlertCircle, Flag, MapPin } from 'lucide-react';
import { Match, Participant, TournamentInstance } from '../../types/championship';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { ChampionshipMatchCard } from './ChampionshipMatchCard';
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

  const formatParticipant = (pId: string | null): string => {
    return formatParticipantById(pId, tournament.participants, users);
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

      {/* Matches List (Single Column, matching Group & KO view) */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center">
          <p className="text-sm font-semibold text-slate-500">
            Keine Begegnungen für den ausgewählten Filter gefunden.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredMatches.map((match) => {
            const stage = tournament.stages.find((s) => s.id === match.stageId);
            const roundLabel = stage ? `${stage.name} · ${match.roundLabel || 'Spiel'}` : match.roundLabel;
            return (
              <ChampionshipMatchCard
                key={match.id}
                match={match}
                tournament={tournament}
                users={users}
                currentUser={currentUser}
                isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'superadmin'}
                onEnterResult={onEnterResult}
                roundLabelOverride={roundLabel}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
