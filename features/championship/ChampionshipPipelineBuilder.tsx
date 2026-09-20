import React from 'react';
import { ArrowRight, Layers, HelpCircle, Calendar, ShieldAlert } from 'lucide-react';
import { TournamentStageConfig, TieBreakRuleType, MatchFormat } from '../../types/championship';

interface ChampionshipPipelineBuilderProps {
  stages: TournamentStageConfig[];
  onChangeStages: (stages: TournamentStageConfig[]) => void;
  tieBreakRule: TieBreakRuleType;
  onChangeTieBreakRule: (rule: TieBreakRuleType) => void;
  matchFormat: MatchFormat;
  onChangeMatchFormat: (format: MatchFormat) => void;
  stageDeadlines: Record<string, string>;
  onChangeDeadline: (stageId: string, deadline: string) => void;
  isReadOnly?: boolean;
}

export const ChampionshipPipelineBuilder: React.FC<ChampionshipPipelineBuilderProps> = ({
  stages,
  onChangeStages,
  tieBreakRule,
  onChangeTieBreakRule,
  matchFormat,
  onChangeMatchFormat,
  stageDeadlines,
  onChangeDeadline,
  isReadOnly = false,
}) => {
  return (
    <div className="space-y-6">
      {/* Visual Pipeline Flow Header */}
      <div>
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
          Turnier-Ablauf & Pipeline-Stufen
        </span>
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          {stages
            .sort((a, b) => a.order - b.order)
            .map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[11px] font-black flex items-center justify-center">
                    {stage.order}
                  </span>
                  <div>
                    <strong className="text-xs font-bold text-slate-900 block leading-tight">
                      {stage.name}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {stage.type === 'group'
                        ? `${stage.groupCount || 2} Gruppen à ${stage.playersPerGroup || 4} Spieler`
                        : `${stage.roundName || 'K.-o.-Runde'}`}
                    </span>
                  </div>
                </div>

                {idx < stages.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </React.Fragment>
            ))}
        </div>
      </div>

      {/* Deadlines per stage */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-xs">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
          Runden-Fristen (Deadlines)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {stages.map((stage) => (
            <div key={stage.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Frist: {stage.name}
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={stageDeadlines[stage.id] || ''}
                onChange={(e) => onChangeDeadline(stage.id, e.target.value)}
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 disabled:bg-slate-100 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rules & Format */}
      <div className="max-w-xl">
        {/* Tie-break rule configuration */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-xs">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Regel bei Punktgleichstand
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
              <input
                type="radio"
                name="tieBreakRule"
                disabled={isReadOnly}
                checked={tieBreakRule === 'head_to_head'}
                onChange={() => onChangeTieBreakRule('head_to_head')}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <div>
                <strong className="text-xs font-bold text-slate-900 block">
                  Direkter Vergleich
                </strong>
                <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Bei exakt 2 punktgleichen Spielern entscheidet das direkte Duell. Bei 3+ Spielern greift die Satzdifferenz.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
              <input
                type="radio"
                name="tieBreakRule"
                disabled={isReadOnly}
                checked={tieBreakRule === 'set_difference'}
                onChange={() => onChangeTieBreakRule('set_difference')}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <div>
                <strong className="text-xs font-bold text-slate-900 block">
                  Satzdifferenz vor direktem Duell
                </strong>
                <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Rangfolge bestimmt sich strikt nach Satzverhältnis (Sätze gewonnen minus verloren), danach Gamedifferenz.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Low-assumption rule transparency info card */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 space-y-1.5 font-medium leading-relaxed">
          <p className="font-bold text-slate-900">
            Transparenz & Fairness-Regeln der Vereinsmeisterschaft:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>
              <strong>Automatische Walkover-Wertung:</strong> Wenn ein Spieler verletzt ausfällt und im System auf „Ausgeschieden“ gesetzt wird, werden alle noch <em>offenen</em> Gruppenspiele automatisch als 6:0, 6:0 für den jeweiligen Kontrahenten gewertet. Bereits ausgetragene Matches behalten ihr echtes Ergebnis.
            </li>
            <li>
              <strong>Unabhängige Platzreservierung:</strong> Meisterschaftsspiele können zu beliebigen freien Zeiten auf der Anlage reserviert werden. Die Eingabe des Ergebnisses erfolgt direkt und unabhängig von der tatsächlichen Buchung.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
