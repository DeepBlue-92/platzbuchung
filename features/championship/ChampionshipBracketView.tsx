import React from 'react';
import {
  Trophy,
  Clock,
} from 'lucide-react';
import { Match, TournamentInstance } from '../../types/championship';
import { isChampionshipAdmin } from '../../utils/championshipPermissions';
import { ChampionshipMatchCard } from './ChampionshipMatchCard';
import { User as AppUser, RankingState } from '../../types';

interface ChampionshipBracketViewProps {
  tournament: TournamentInstance;
  onMatchClick: (match: Match) => void;
  users: Record<string, AppUser>;
  currentUser?: AppUser | null;
  isAdmin?: boolean;
  selectedStageId?: string | null;
  rankings?: RankingState | null;
}

export const ChampionshipBracketView: React.FC<ChampionshipBracketViewProps> = ({
  tournament,
  onMatchClick,
  users,
  currentUser,
  isAdmin,
  selectedStageId,
  rankings,
}) => {
  // Support all knockout, finals_day and non-group stages
  const koStages = (tournament.stages || [])
    .filter((s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay)
    .sort((a, b) => a.order - b.order);

  // All planned matches in KO phase & finals
  const koStageIds = new Set(koStages.map((s) => s.id));
  const allKoMatches = (tournament.matches || []).filter((m) => {
    if (m.stageId && koStageIds.has(m.stageId)) return true;
    const stage = tournament.stages?.find((s) => s.id === m.stageId);
    return stage ? stage.type !== 'group' : !m.groupId;
  });

  if (koStages.length === 0 && allKoMatches.length === 0) {
    return (
      <div className="mt-6 bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2">
        <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
        <h4 className="font-bold text-slate-800 text-sm">Keine K.-o.-Phase geplant</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Dieses Turnier wird rein im Gruppenmodus ausgetragen.
        </p>
      </div>
    );
  }

  // Determine active stage strictly from selectedStageId, defaulting to first KO stage
  const activeStage =
    koStages.find((s) => s.id === selectedStageId) ||
    koStages[0] ||
    null;

  // Filter matches strictly for the active stage (e.g. only Halbfinale OR only Finaltag)
  const stageMatches = activeStage
    ? allKoMatches.filter(
        (m) => m.stageId === activeStage.id || (!m.stageId && koStages.length === 1)
      )
    : allKoMatches;

  const renderMatchCard = (match: Match) => {
    return (
      <ChampionshipMatchCard
        key={match.id}
        match={match}
        tournament={tournament}
        users={users}
        currentUser={currentUser}
        isAdmin={isAdmin ?? isChampionshipAdmin(currentUser)}
        onEnterResult={onMatchClick}
        rankings={rankings}
      />
    );
  };

  return (
    <div className="mt-6 space-y-3.5">
      {stageMatches.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2">
          <Clock className="w-9 h-9 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800 text-sm">
            {activeStage ? `Noch keine Partien für „${activeStage.name}“ eingeteilt` : 'Keine Partien geplant'}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Die Paarungen werden nach Abschluss der vorangegangenen Phase automatisch ermittelt und freigeschaltet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeStage && (
            <div className="pb-1">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                Begegnungen {activeStage.name}
              </h3>
            </div>
          )}
          {stageMatches.map((m) => renderMatchCard(m))}
        </div>
      )}
    </div>
  );
};
