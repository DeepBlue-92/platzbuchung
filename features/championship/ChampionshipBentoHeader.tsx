import React from 'react';
import {
  Trophy,
  Settings,
  ListOrdered,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { TournamentInstance } from '../../types/championship';
import {
  getDeadlineCountdownInfo,
  formatEventDate,
} from '../../utils/championshipScheduling';

interface ChampionshipBentoHeaderProps {
  tournament: TournamentInstance;
  activeTournaments: TournamentInstance[];
  selectedTournamentId: string;
  onSelectTournamentId: (id: string) => void;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
  activeTab: 'groups' | 'bracket' | 'matches' | 'admin';
  onSelectTab: (tab: 'groups' | 'bracket' | 'matches' | 'admin') => void;
  selectedStageId?: string | null;
  onSelectStage: (stageId: string, stageType: 'group' | 'knockout' | 'finals_day') => void;
}

export const ChampionshipBentoHeader: React.FC<ChampionshipBentoHeaderProps> = ({
  tournament,
  activeTournaments,
  selectedTournamentId,
  onSelectTournamentId,
  isAdmin = false,
  onNavigateToAdmin,
  activeTab,
  onSelectTab,
  selectedStageId,
  onSelectStage,
}) => {
  const matches = tournament.matches || [];
  const stages = tournament.stages || [];
  const stageDeadlines = tournament.stageDeadlines || {};
  const stageDeadlineTypes = tournament.stageDeadlineTypes || {};

  // Overall tournament progress
  const totalTournamentMatches = matches.length;
  const totalCompletedMatches = matches.filter(
    (m) => m.status === 'completed' || m.status === 'walkover'
  ).length;
  const completionPercent =
    totalTournamentMatches > 0
      ? Math.round((totalCompletedMatches / totalTournamentMatches) * 100)
      : 0;

  // Title and Subline derivation
  const rawTitle = tournament.title || 'Clubmeisterschaft 2026';
  const mainTitle = rawTitle.replace(/\s*-\s*Einzel$/i, '').replace(/\s*-\s*Doppel$/i, '');
  const formatType =
    tournament.format?.type === 'double' || rawTitle.toLowerCase().includes('doppel')
      ? 'Doppel'
      : 'Einzel';
  const subline = `${formatType} · Gruppenphase & K.-o.-Endrunde`;

  // Sort stages chronologically
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  // Determine stage progress list
  let previousStageCompleted = true;
  const stageProgressList = sortedStages.map((stage, idx) => {
    const stageMatches = matches.filter((m) => m.stageId === stage.id);
    const totalMatches = stageMatches.length;
    const completedMatches = stageMatches.filter(
      (m) => m.status === 'completed' || m.status === 'walkover'
    ).length;

    const isCompleted = totalMatches > 0 && completedMatches === totalMatches;
    const hasStarted =
      completedMatches > 0 ||
      (totalMatches > 0 && stageMatches.some((m) => m.participant1Id && m.participant2Id));

    let status: 'completed' | 'active' | 'future' = 'future';
    if (isCompleted) {
      status = 'completed';
    } else if (hasStarted || previousStageCompleted || idx === 0) {
      status = 'active';
    } else {
      status = 'future';
    }

    if (!isCompleted) {
      previousStageCompleted = false;
    }

    const isFinalsDay = stage.type === 'finals_day' || !!stage.isFinalsDay;
    const mode =
      stageDeadlineTypes?.[stage.id] ||
      stage.deadlineType ||
      (isFinalsDay ? 'date' : 'deadline');
    const isDateMode = mode === 'date';
    const stageDeadline = stageDeadlines?.[stage.id];
    const deadlineInfo =
      !isDateMode && stageDeadline ? getDeadlineCountdownInfo(stageDeadline) : null;

    // Is this step selected/active in view?
    const isStageSelected =
      activeTab !== 'matches' &&
      activeTab !== 'admin' &&
      (selectedStageId === stage.id ||
        (!selectedStageId && activeTab === 'groups' && stage.type === 'group') ||
        (!selectedStageId &&
          activeTab === 'bracket' &&
          (stage.type === 'knockout' || stage.type === 'finals_day')));

    // Deadline hint string
    let deadlineText = '';
    if (isDateMode) {
      if (stageDeadline) {
        const shortDate = formatEventDate(stageDeadline, false);
        deadlineText = `${isFinalsDay ? 'Finaltag' : 'Spieltag'}: ${shortDate}`;
      } else {
        deadlineText = 'Termin offen';
      }
    } else if (deadlineInfo) {
      const shortDate = deadlineInfo.formattedDate.replace(/\.\d{4}$/, '');
      if (isStageSelected || status === 'active') {
        if (deadlineInfo.isOverdue) {
          deadlineText = `Bis ${shortDate} (abgelaufen)`;
        } else if (deadlineInfo.daysRemainingText) {
          deadlineText = `Bis ${shortDate} (${deadlineInfo.daysRemainingText})`;
        } else {
          deadlineText = `Bis ${shortDate}`;
        }
      } else {
        deadlineText = `Bis ${shortDate}`;
      }
    } else {
      deadlineText = isCompleted ? 'Beendet' : 'Frist offen';
    }

    return {
      stage,
      status,
      totalMatches,
      completedMatches,
      isStageSelected,
      deadlineText,
      isFinalsDay,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
      {/* 1. Header-Zeile der Bento-Karte */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Links: Trophäen-Icon, Haupttitel "Clubmeisterschaft 2026" und Subline */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)] shrink-0">
            <Trophy className="w-5 h-5 text-[var(--color-primary)]" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                {mainTitle}
              </h2>

              {/* Tournament Switcher if multiple tournaments exist */}
              {activeTournaments.length > 1 && (
                <select
                  value={selectedTournamentId}
                  onChange={(e) => onSelectTournamentId(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  {activeTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-500 font-semibold tracking-tight mt-0.5">
              {subline}
            </p>
          </div>
        </div>

        {/* Rechts: Status-Kennzahl "2 / 15 Spiele abgeschlossen" & Admin-Button */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {totalTournamentMatches > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-700">
                <strong className="text-slate-900 font-extrabold">{totalCompletedMatches}</strong> /{' '}
                {totalTournamentMatches} Spiele abgeschlossen
              </span>
              <div className="w-16 sm:w-20 bg-slate-200/80 h-2 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateToAdmin) {
                  onNavigateToAdmin();
                } else {
                  onSelectTab('admin');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs'
              }`}
              title="Turnier-Einstellungen & Verwaltung"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Turnier-Verwaltung</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Untere Zeile der Bento-Karte: Flacher 3-stufiger Stepper + Alle Begegnungen */}
      {stages.length > 0 && (
        <div className="border-t border-slate-100 pt-3.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {stageProgressList.map((item, idx) => {
              const isSelected = item.isStageSelected;
              const isCompleted = item.status === 'completed';
              const isFinalStage =
                item.isFinalsDay ||
                item.stage.type === 'finals_day' ||
                item.stage.name.toLowerCase().includes('finale');

              return (
                <React.Fragment key={item.stage.id}>
                  {/* Step Button */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStage(item.stage.id, item.stage.type);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 flex-1 min-w-[170px] sm:min-w-[190px] ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200/80 shadow-xs'
                        : isCompleted
                        ? 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Step Indicator (Badge/Circle) */}
                    <div
                      className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      ) : isFinalStage ? (
                        <Trophy className="w-3 h-3" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs truncate ${
                            isSelected
                              ? 'font-black text-emerald-950'
                              : 'font-bold text-slate-800'
                          }`}
                        >
                          {item.stage.name}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                        {item.totalMatches > 0 && (
                          <span
                            className={
                              isSelected ? 'font-bold text-emerald-800' : 'text-slate-600'
                            }
                          >
                            {item.completedMatches}/{item.totalMatches} gespielt
                          </span>
                        )}
                        {item.totalMatches > 0 && item.deadlineText && <span>·</span>}
                        {item.deadlineText && <span>{item.deadlineText}</span>}
                      </div>
                    </div>
                  </button>

                  {/* Step Connector */}
                  {idx < stageProgressList.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
                  )}
                </React.Fragment>
              );
            })}

            {/* Separator before "Alle Begegnungen" */}
            <div className="h-6 w-px bg-slate-200 shrink-0 hidden sm:block mx-1" />

            {/* Subtle Tab/Link for "Alle Begegnungen" */}
            <button
              type="button"
              onClick={() => {
                onSelectTab('matches');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'matches'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Alle Begegnungen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
