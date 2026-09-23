import React from 'react';
import {
  Trophy,
  Settings,
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

  const selectedStageItem = stageProgressList.find((item) => item.isStageSelected);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-6 space-y-3 sm:space-y-4">
      {/* ======================================================== */}
      {/* MOBILE COMPACT HEADER (< sm:) - EXACTLY 2 COMPACT LINES   */}
      {/* ======================================================== */}
      <div className="sm:hidden space-y-2">
        {/* Zeile 1: Titel links, Admin-Zahnrad rechts */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
              {mainTitle}
            </h2>
            {activeTournaments.length > 1 && (
              <select
                value={selectedTournamentId}
                onChange={(e) => onSelectTournamentId(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
              >
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

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
              className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Turnier-Einstellungen & Verwaltung"
              aria-label="Turnier-Einstellungen"
            >
              <Settings className="w-4 h-4 text-slate-600" />
            </button>
          )}
        </div>

        {/* Zeile 2: "3 / 15 gespielt" mit schlankem Fortschrittsbalken direkt daneben */}
        {totalTournamentMatches > 0 && (
          <div className="flex items-center gap-2.5 text-xs text-slate-600">
            <span className="shrink-0 font-medium text-slate-700">
              <strong className="text-slate-900 font-extrabold">{totalCompletedMatches}</strong> / {totalTournamentMatches} gespielt
            </span>
            <div className="flex-1 max-w-[130px] bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/80">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* DESKTOP HEADER (>= sm:) - 100% UNCHANGED                  */}
      {/* ======================================================== */}
      <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between gap-4">
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

      {/* ======================================================== */}
      {/* PHASENMODELL: MOBIL (Pills) vs. DESKTOP (Stepper)        */}
      {/* ======================================================== */}
      {stages.length > 0 && (
        <div className="border-t border-slate-100 pt-2.5 sm:pt-3.5">
          {/* 1. Mobile Pill-Tabs (< sm:) */}
          <div className="sm:hidden space-y-1.5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {stageProgressList.map((item, idx) => {
                const isSelected = item.isStageSelected;
                const isCompleted = item.status === 'completed';

                return (
                  <button
                    key={item.stage.id}
                    type="button"
                    onClick={() => onSelectStage(item.stage.id, item.stage.type)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-700 text-white font-bold shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 font-medium'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="opacity-75">{idx + 1}.</span>
                    )}
                    <span>
                      {item.stage.name}
                      {item.totalMatches > 0 ? ` (${item.completedMatches}/${item.totalMatches})` : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Deadline Subline (Frist kompakt unter den Pills) */}
            {selectedStageItem?.deadlineText && (
              <p className="text-[11px] text-slate-500 font-medium px-0.5">
                {selectedStageItem.stage.name}: {selectedStageItem.deadlineText}
              </p>
            )}
          </div>

          {/* 2. Desktop Stepper (>= sm:) - 100% UNCHANGED */}
          <div className="hidden sm:flex items-center overflow-x-auto snap-x snap-mandatory gap-2 no-scrollbar sm:overflow-visible py-0.5">
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
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 flex-1 min-w-[170px] sm:min-w-0 snap-start ${
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

                      <div className={`text-xs font-medium truncate flex items-center gap-1.5 mt-0.5 ${
                        isSelected ? 'text-emerald-800' : 'text-slate-600'
                      }`}>
                        {item.totalMatches > 0 && (
                          <span className={isSelected ? 'font-semibold text-emerald-900' : 'text-slate-700'}>
                            {item.completedMatches}/{item.totalMatches} gespielt
                          </span>
                        )}
                        {item.totalMatches > 0 && item.deadlineText && <span className="text-slate-400">·</span>}
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
          </div>
        </div>
      )}
    </div>
  );
};
