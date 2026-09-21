import React from 'react';
import {
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import { TournamentStageConfig, Match } from '../../types/championship';
import {
  getDeadlineCountdownInfo,
  formatEventDate,
} from '../../utils/championshipScheduling';

export type StageProgressStatus = 'completed' | 'active' | 'future';

export interface StageProgressItem {
  stage: TournamentStageConfig;
  status: StageProgressStatus;
  totalMatches: number;
  completedMatches: number;
  completionPercent: number;
  deadlineInfo: ReturnType<typeof getDeadlineCountdownInfo>;
  isFinalsDay: boolean;
  isDateMode?: boolean;
  stageDeadline?: string;
  deadlineText?: string;
  isDeadlineOverdue?: boolean;
  isDeadlineUrgent?: boolean;
}

interface ChampionshipTournamentJourneyProps {
  stages: TournamentStageConfig[];
  matches: Match[];
  stageDeadlines?: Record<string, string>;
  stageDeadlineTypes?: Record<string, 'deadline' | 'date'>;
  selectedStageId?: string | null;
  activeTab?: 'groups' | 'bracket' | 'matches' | 'admin';
  onSelectStage?: (stageId: string, stageType: 'group' | 'knockout' | 'finals_day') => void;
}

export const ChampionshipTournamentJourney: React.FC<ChampionshipTournamentJourneyProps> = ({
  stages,
  matches,
  stageDeadlines = {},
  stageDeadlineTypes = {},
  selectedStageId,
  activeTab,
  onSelectStage,
}) => {
  if (!stages || stages.length === 0) {
    return null;
  }

  // Sort stages chronologically
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  // Overall tournament progress
  const totalTournamentMatches = matches.length;
  const totalCompletedMatches = matches.filter(
    (m) => m.status === 'completed' || m.status === 'walkover'
  ).length;

  // Determine active phase in tournament progression
  let previousStageCompleted = true;

  const stageProgressList: StageProgressItem[] = sortedStages.map((stage, idx) => {
    const stageMatches = matches.filter((m) => m.stageId === stage.id);
    const totalMatches = stageMatches.length;
    const completedMatches = stageMatches.filter(
      (m) => m.status === 'completed' || m.status === 'walkover'
    ).length;

    const isCompleted = totalMatches > 0 && completedMatches === totalMatches;
    const hasStarted =
      completedMatches > 0 ||
      (totalMatches > 0 && stageMatches.some((m) => m.participant1Id && m.participant2Id));

    let status: StageProgressStatus = 'future';
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
    const completionPercent =
      totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

    // Check if this step is selected in the UI
    const isStageSelected =
      selectedStageId === stage.id ||
      (!selectedStageId && activeTab === 'groups' && stage.type === 'group') ||
      (!selectedStageId &&
        activeTab === 'bracket' &&
        (stage.type === 'knockout' || stage.type === 'finals_day'));

    // Compute compact deadline / hint text
    let deadlineText = '';
    let isDeadlineOverdue = false;
    let isDeadlineUrgent = false;

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
        // Active format: e.g. "Bis 12.10. (noch 21 Tage)"
        if (deadlineInfo.isOverdue) {
          deadlineText = `Bis ${shortDate} (abgelaufen)`;
          isDeadlineOverdue = true;
        } else if (deadlineInfo.daysRemainingText) {
          deadlineText = `Bis ${shortDate} (${deadlineInfo.daysRemainingText})`;
          isDeadlineUrgent = deadlineInfo.isUrgent ?? false;
        } else {
          deadlineText = `Bis ${shortDate}`;
        }
      } else {
        // Planned/Future format: e.g. "Bis 02.11."
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
      completionPercent,
      deadlineInfo,
      isFinalsDay,
      isDateMode,
      stageDeadline,
      deadlineText,
      isDeadlineOverdue,
      isDeadlineUrgent,
    };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs space-y-2">
      {/* 4. Gesamt-Fortschritt integrieren (Rechtsbündig in der Stepper-Kopfzeile) */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
            Turnier-Fortschritt
          </h3>
        </div>

        {totalTournamentMatches > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">
              {totalCompletedMatches} / {totalTournamentMatches} Spiele abgeschlossen
            </span>
            <div className="w-16 sm:w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/70 hidden xs:block">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(
                    (totalCompletedMatches / totalTournamentMatches) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. & 2. Schlanker, kompakter horizontaler Stepper */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
        {stageProgressList.map((item, idx) => {
          const isSelected =
            selectedStageId === item.stage.id ||
            (!selectedStageId && activeTab === 'groups' && item.stage.type === 'group') ||
            (!selectedStageId &&
              activeTab === 'bracket' &&
              (item.stage.type === 'knockout' || item.stage.type === 'finals_day'));

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
                  if (onSelectStage) {
                    onSelectStage(item.stage.id, item.stage.type);
                  }
                }}
                className={`flex items-center gap-2.5 px-3 py-1.5 sm:py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 flex-1 min-w-[170px] sm:min-w-[200px] ${
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
                    {/* Status: e.g. "1/12 gespielt" if matches exist, or planned */}
                    {item.totalMatches > 0 ? (
                      <span
                        className={
                          isSelected
                            ? 'text-emerald-800 font-bold'
                            : 'text-slate-600 font-semibold'
                        }
                      >
                        {item.completedMatches}/{item.totalMatches} gespielt
                      </span>
                    ) : null}

                    {item.totalMatches > 0 && item.deadlineText && (
                      <span className="text-slate-300">·</span>
                    )}

                    {item.deadlineText && (
                      <span
                        className={
                          item.isDeadlineOverdue
                            ? 'text-rose-600 font-bold'
                            : item.isDeadlineUrgent
                            ? 'text-amber-700 font-bold'
                            : 'text-slate-500'
                        }
                      >
                        {item.deadlineText}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Connecting arrow/divider between steps */}
              {idx < stageProgressList.length - 1 && (
                <div className="flex items-center justify-center text-slate-300 shrink-0 px-0.5">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
