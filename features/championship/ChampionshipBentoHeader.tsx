import React, { useMemo } from 'react';
import { Settings } from 'lucide-react';
import { TournamentInstance } from '../../types/championship';
import { formatEventDate } from '../../utils/championshipScheduling';

export type ChampionshipPhaseKey = 'groups' | 'semis' | 'finals' | 'admin';

interface ChampionshipBentoHeaderProps {
  tournament: TournamentInstance;
  activeTournaments: TournamentInstance[];
  selectedTournamentId: string;
  onSelectTournamentId: (id: string) => void;
  activePhase: ChampionshipPhaseKey;
  onSelectPhase: (phase: 'groups' | 'semis' | 'finals') => void;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
  onSelectAdmin?: () => void;
}

export const ChampionshipBentoHeader: React.FC<ChampionshipBentoHeaderProps> = ({
  tournament,
  activeTournaments,
  selectedTournamentId,
  onSelectTournamentId,
  activePhase,
  onSelectPhase,
  isAdmin = false,
  onNavigateToAdmin,
  onSelectAdmin,
}) => {
  // Slim subline: Zeitraum / Saison
  const subline = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (tournament.startDate && tournament.endDate) {
      return `${formatEventDate(tournament.startDate, false)} – ${formatEventDate(tournament.endDate, false)}`;
    }
    if (tournament.startDate) {
      return `Start: ${formatEventDate(tournament.startDate, false)}`;
    }
    return `Saison ${currentYear} · ${tournament.discipline === 'doubles' ? 'Doppel' : 'Einzel'}`;
  }, [tournament.startDate, tournament.endDate, tournament.discipline]);

  const phases: Array<{ key: 'groups' | 'semis' | 'finals'; num: number; label: string }> = [
    { key: 'groups', num: 1, label: 'Gruppenphase' },
    { key: 'semis', num: 2, label: 'Halbfinale' },
    { key: 'finals', num: 3, label: 'Endrunde' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* ======================================================== */}
      {/* 1. OBEN: Horizontale Leiste mit Pill-Tabs für Turniere   */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {activeTournaments.map((t) => {
            const isActive = t.id === selectedTournamentId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTournamentId(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.title}
              </button>
            );
          })}
        </div>

        {/* Optional Admin Management Shortcut */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              if (onNavigateToAdmin) {
                onNavigateToAdmin();
              } else if (onSelectAdmin) {
                onSelectAdmin();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activePhase === 'admin'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            title="Turnier-Einstellungen & Verwaltung"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Turnier-Verwaltung</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. MITTE: Titel & schlanker Untertitel (Zeitraum/Saison) */}
      {/* ======================================================== */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {tournament.title}
        </h2>
        <p className="font-normal text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
          {subline}
        </p>
      </div>

      {/* ======================================================== */}
      {/* 3. UNTEN: Phasen-Navigation (1: Gruppe, 2: HF, 3: Finale)*/}
      {/* ======================================================== */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
        {phases.map((phase) => {
          const isActive = activePhase === phase.key;
          return (
            <button
              key={phase.key}
              type="button"
              onClick={() => onSelectPhase(phase.key)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border text-xs sm:text-sm transition-all cursor-pointer text-center ${
                isActive
                  ? 'bg-emerald-50/80 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-500 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {phase.num}
              </span>
              <span className="truncate">{phase.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
