import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Trophy,
  Flag,
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
}

interface ChampionshipTournamentJourneyProps {
  stages: TournamentStageConfig[];
  matches: Match[];
  selectedStageId?: string | null;
  onSelectStage?: (stageId: string, stageType: 'group' | 'knockout' | 'finals_day') => void;
}

export const ChampionshipTournamentJourney: React.FC<ChampionshipTournamentJourneyProps> = ({
  stages,
  matches,
  selectedStageId,
  onSelectStage,
}) => {
  if (!stages || stages.length === 0) {
    return null;
  }

  // Sort stages chronologically
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  // Compute status and match progress per stage
  let previousStageCompleted = true;

  const stageProgressList: StageProgressItem[] = sortedStages.map((stage, idx) => {
    const stageMatches = matches.filter((m) => m.stageId === stage.id);
    const totalMatches = stageMatches.length;
    const completedMatches = stageMatches.filter(
      (m) => m.status === 'completed' || m.status === 'walkover'
    ).length;

    const isCompleted = totalMatches > 0 && completedMatches === totalMatches;
    const hasStarted = completedMatches > 0 || (totalMatches > 0 && stageMatches.some((m) => m.participant1Id && m.participant2Id));

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
    const mode = tournament.stageDeadlineTypes?.[stage.id] ||
      stage.deadlineType ||
      (isFinalsDay ? 'date' : 'deadline');
    const isDateMode = mode === 'date';
    const stageDeadline = tournament.stageDeadlines?.[stage.id];
    const deadlineInfo = !isDateMode && stageDeadline ? getDeadlineCountdownInfo(stageDeadline) : null;
    const completionPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

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
    };
  });

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
      {/* Header with Title & Overall Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-[var(--color-primary)] rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Turnier-Fortschritt
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Aktuelle Phase, Fristen und Event-Termine auf einen Blick
            </p>
          </div>
        </div>

        {/* Global Progress Pill */}
        {matches.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-bold text-slate-500">
              Gesamt: {matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length} / {matches.length} Spiele beendet
            </span>
            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(
                    (matches.filter((m) => m.status === 'completed' || m.status === 'walkover').length /
                      matches.length) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Stepper Timeline (Responsive with scroll-snap) */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto py-1 scroll-smooth snap-x snap-mandatory no-scrollbar">
        {stageProgressList.map((item, idx) => {
          const isSelected = selectedStageId === item.stage.id;
          const isCompleted = item.status === 'completed';
          const isActive = item.status === 'active';
          const isFuture = item.status === 'future';

          return (
            <React.Fragment key={item.stage.id}>
              {/* Step Card */}
              <button
                type="button"
                onClick={() => {
                  if (onSelectStage) {
                    onSelectStage(item.stage.id, item.stage.type);
                  }
                }}
                className={`flex-1 min-w-[220px] max-w-[280px] p-3.5 rounded-xl border text-left transition-all cursor-pointer snap-start relative flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)] bg-emerald-50/20 shadow-xs'
                    : isActive
                    ? 'border-emerald-300 bg-emerald-50/15 hover:border-emerald-400'
                    : isCompleted
                    ? 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    : 'border-slate-200/70 bg-white opacity-70 hover:opacity-100'
                }`}
              >
                {/* Top: Step Index & Status Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        item.isFinalsDay
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : item.stage.type === 'group'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {item.isFinalsDay ? 'Finaltag' : item.stage.type === 'group' ? 'Gruppen' : 'K.-o.'}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      Beendet
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      Aktiv
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      Geplant
                    </span>
                  )}
                </div>

                {/* Middle: Stage Name */}
                <div className="mb-2">
                  <strong className="text-xs font-bold text-slate-900 block truncate">
                    {item.stage.name}
                  </strong>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {item.totalMatches > 0
                      ? `${item.completedMatches} von ${item.totalMatches} Spielen abgeschlossen`
                      : 'Noch keine Matches zugewiesen'}
                  </span>
                </div>

                {/* Progress bar per stage */}
                {item.totalMatches > 0 && (
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'
                      }`}
                      style={{ width: `${item.completionPercent}%` }}
                    />
                  </div>
                )}

                {/* Bottom: Date / Deadline badge */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-bold">
                  {item.isDateMode ? (
                    <div className="text-amber-800 flex items-center gap-1.5 flex-wrap">
                      <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {item.stageDeadline
                          ? `${item.isFinalsDay ? 'Finaltag' : 'Spieltag'}: ${formatEventDate(item.stageDeadline, false)}`
                          : 'Datum noch offen'}
                      </span>
                    </div>
                  ) : item.deadlineInfo ? (
                    <div
                      className={`flex items-center gap-1.5 flex-wrap ${
                        item.deadlineInfo.isOverdue
                          ? 'text-rose-700'
                          : item.deadlineInfo.isToday
                          ? 'text-amber-700'
                          : 'text-slate-700'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span>Bis {item.deadlineInfo.formattedDate}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          item.deadlineInfo.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : item.deadlineInfo.isToday
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.deadlineInfo.text}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal italic flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Keine Frist hinterlegt
                    </span>
                  )}
                </div>
              </button>

              {/* Connecting arrow */}
              {idx < stageProgressList.length - 1 && (
                <div className="hidden sm:flex items-center text-slate-300 px-0.5 shrink-0 self-center">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
