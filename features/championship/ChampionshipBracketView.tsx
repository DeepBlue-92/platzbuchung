import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle2,
  ChevronRight,
  User,
  Calendar,
  Flag,
  Clock,
  GitFork,
  ListOrdered,
  Medal,
} from 'lucide-react';
import { Match, Participant, TournamentInstance, TournamentStageConfig } from '../../types/championship';
import { getDeadlineCountdownInfo, formatEventDate } from '../../utils/championshipScheduling';
import { isChampionshipAdmin } from '../../utils/championshipPermissions';
import { ChampionshipMatchCard } from './ChampionshipMatchCard';
import { User as AppUser } from '../../types';

interface ChampionshipBracketViewProps {
  tournament: TournamentInstance;
  onMatchClick: (match: Match) => void;
  users: Record<string, AppUser>;
  currentUser?: AppUser | null;
  isAdmin?: boolean;
  selectedStageId?: string | null;
}

export const ChampionshipBracketView: React.FC<ChampionshipBracketViewProps> = ({
  tournament,
  onMatchClick,
  users,
  currentUser,
  isAdmin,
  selectedStageId,
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

  const [viewMode, setViewMode] = useState<'bracket' | 'list'>('list');
  const [activeMobileStageId, setActiveMobileStageId] = useState<string>('all');

  // Sync selected stage from timeline stepper
  React.useEffect(() => {
    if (selectedStageId && koStages.some((s) => s.id === selectedStageId)) {
      setActiveMobileStageId(selectedStageId);
    }
  }, [selectedStageId, koStages]);

  const totalMatches = allKoMatches.length;
  const completedMatches = allKoMatches.filter(
    (m) => m.status === 'completed' || m.status === 'walkover'
  ).length;
  const openMatches = totalMatches - completedMatches;

  if (koStages.length === 0 && allKoMatches.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2">
        <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
        <h4 className="font-bold text-slate-800 text-sm">Keine K.-o.-Phase geplant</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Dieses Turnier wird rein im Gruppenmodus ausgetragen.
        </p>
      </div>
    );
  }

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
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar with Overview Stats & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider text-slate-900">
            K.-o.-Endrunde
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-slate-600">
            {totalMatches} {totalMatches === 1 ? 'Partie' : 'Partien'} geplant
          </span>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {completedMatches} beendet
          </span>
          {openMatches > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {openMatches} offen
            </span>
          )}
        </div>

        {/* View Mode Toggle (Desktop) */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('bracket')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'bracket'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 rotate-90" />
            <span>Turnierbaum</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Alle Partien ({totalMatches})</span>
          </button>
        </div>
      </div>

      {/* Mobile Stage Selector */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveMobileStageId('all')}
          className={`flex-1 min-w-[110px] py-2 px-3 text-xs font-bold rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
            activeMobileStageId === 'all'
              ? 'bg-white text-[var(--color-primary)] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Alle Partien ({totalMatches})
        </button>
        {koStages.map((stage) => {
          const isActive = activeMobileStageId === stage.id;
          const stageMatches = allKoMatches.filter((m) => m.stageId === stage.id);
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
              {stage.name} ({stageMatches.length})
            </button>
          );
        })}
      </div>

      {/* Desktop: Bracket Tree View */}
      {viewMode === 'bracket' && (
        <div className="hidden lg:grid grid-flow-col auto-cols-fr gap-6 items-center overflow-x-auto pb-4">
          {koStages.map((stage) => {
            const stageMatches = allKoMatches.filter((m) => m.stageId === stage.id);
            const deadline = tournament.stageDeadlines?.[stage.id];

            return (
              <div key={stage.id} className="space-y-4 min-w-[300px]">
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
                <div className="space-y-4 flex flex-col justify-around min-h-[360px]">
                  {stageMatches.length === 0 ? (
                    <div className="p-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-400 font-medium italic">
                        Paarungen werden ermittelt
                      </p>
                    </div>
                  ) : (
                    stageMatches.map((m) => renderMatchCard(m))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop: Consolidated Single-Column List of All Planned Matches */}
      {viewMode === 'list' && (
        <div className="hidden lg:block space-y-6">
          {koStages.map((stage) => {
            const stageMatches = allKoMatches.filter((m) => m.stageId === stage.id);
            if (stageMatches.length === 0) return null;

            return (
              <div key={stage.id} className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {stage.name}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    ({stageMatches.length} {stageMatches.length === 1 ? 'Partie' : 'Partien'})
                  </span>
                </div>
                <div className="space-y-2.5">
                  {stageMatches.map((m) => renderMatchCard(m))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile View: Either All Planned Matches or Selected Stage */}
      <div className="lg:hidden space-y-4">
        {activeMobileStageId === 'all' ? (
          <div className="space-y-4">
            {koStages.map((stage) => {
              const stageMatches = allKoMatches.filter((m) => m.stageId === stage.id);
              if (stageMatches.length === 0) return null;

              return (
                <div key={stage.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">
                      {stage.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({stageMatches.length})
                    </span>
                  </div>
                  {stageMatches.map((m) => renderMatchCard(m))}
                </div>
              );
            })}
          </div>
        ) : (
          (() => {
            const curStage = koStages.find((s) => s.id === activeMobileStageId) || koStages[0];
            if (!curStage) return null;

            const stageMatches = allKoMatches.filter((m) => m.stageId === curStage.id);

            return (
              <div className="space-y-2.5">
                {stageMatches.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center italic py-4">
                    Keine Partien in dieser Phase
                  </p>
                ) : (
                  stageMatches.map((m) => renderMatchCard(m))
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

