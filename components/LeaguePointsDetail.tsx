import React, { useState, useEffect } from 'react';
import { User, LeaguePlayer, LeagueMatch, LeagueConfigVersion } from '../types';
import { LeaguePointConfig, applyDecay } from '../services/leagueEngine';
import { getLeagueConfigVersions } from '../services/league';
import { resolvePlayerDisplayName } from '../utils/playerHelper';

interface Props {
  currentUser: User;
  profile: LeaguePlayer | null;
  allProfiles: LeaguePlayer[];
  matches: LeagueMatch[];
  users: Record<string, User>;
  config: LeaguePointConfig;
  onBack: () => void;
}

export function LeaguePointsDetail({
  currentUser,
  profile,
  allProfiles,
  matches,
  users,
  config: defaultConfig,
  onBack,
}: Props) {
  // State for interactive match simulator
  const [simulatedDiff, setSimulatedDiff] = useState<number>(0);
  
  const [configVersions, setConfigVersions] = useState<LeagueConfigVersion[]>([]);
  const [simConfig, setSimConfig] = useState<LeaguePointConfig | null>(null);
  
  useEffect(() => {
    getLeagueConfigVersions().then(versions => {
      // Sort descending by effective_date
      versions.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
      setConfigVersions(versions);
    }).catch(console.error);
  }, []);

  const config = simConfig || defaultConfig;

  const maxB = config.maxBonusPoints;
  const steepK = config.logisticSteepnessK;

  // Calculate live bonus B(D) for slider
  const simBonus = maxB / (1 + Math.exp(-steepK * simulatedDiff));

  // SVG dimensions & mapping helpers
  // viewBox: 0 0 500 220
  // X range: -100 to +100 mapped to pixel range [45, 480] (width = 435)
  // Y range: 0 to maxB mapped to pixel range [185, 25] (height = 160)
  const svgX = (d: number) => 45 + ((d + 100) / 200) * 435;
  const svgY = (b: number) => 185 - (b / Math.max(1, maxB)) * 160;

  // Generate curve path
  const curvePoints: string[] = [];
  for (let d = -100; d <= 100; d += 2) {
    const b = maxB / (1 + Math.exp(-steepK * d));
    const px = svgX(d);
    const py = svgY(b);
    curvePoints.push(`${d === -100 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  const curvePathD = curvePoints.join(' ');
  const areaPathD = `${curvePathD} L ${svgX(100).toFixed(1)} 185 L ${svgX(-100).toFixed(1)} 185 Z`;

  // Key marker coordinates
  const markerX = svgX(simulatedDiff);
  const markerY = svgY(simBonus);

  const neutralX = svgX(0);
  const neutralY = svgY(maxB / 2);
  // Helper to resolve name
  const getUserName = (userId: string) => {
    const u = users[userId];
    return resolvePlayerDisplayName(u, userId);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-6 py-6 space-y-4 lg:space-y-6 min-h-screen text-slate-800">
      {/* HEADER & NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs md:text-sm transition-all active:scale-95 cursor-pointer mb-3"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Zurück zum Dashboard</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide text-slate-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-lg shrink-0">
              <i className="fa-solid fa-calculator" />
            </span>
            Hobbyliga-Punkteberechnung
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium">
            Transparente Übersicht und mathematische Formeln deines Hobbyliga-Rankings
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System-Status: Aktiv
          </span>
        </div>
      </div>

      {/* DYNAMISCHE SYSTEM-ERKLÄRUNG (SUPERADMIN-INTEGRATION) & MATCH-SIMULATOR */}
      <section className="space-y-6 pt-2">
        <div>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
            <i className="fa-solid fa-square-root-variable text-[var(--color-primary)]" />
            Dynamisches Regelwerk & Mathematische Formeln
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            Alle Parameter werden in Echtzeit aus den Superadmin-Einstellungen deines Vereins geladen.
          </p>
        </div>

        {/* Dynamic Parameter Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Teilnahme-Basis
            </span>
            <span className="text-xl font-mono font-black text-emerald-400">
              +{config.participationPoints} Pkt.
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Max. Gegner-Bonus
            </span>
            <span className="text-xl font-mono font-black text-emerald-400">
              +{config.maxBonusPoints} Pkt.
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Skalierungsfaktor (k)
            </span>
            <span className="text-xl font-mono font-black text-emerald-400">
              {config.logisticSteepnessK}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Inaktivität / Woche
            </span>
            <span className="text-xl font-mono font-black text-amber-400">
              -{config.decayPointsPerWeek} Pkt.
            </span>
          </div>
        </div>

        {/* 4 Structured Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {/* SECTION 1: SIEG & NIEDERLAGE */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0">
                1
              </span>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Sieg & Niederlage (Erwartungswert)
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Jedes absolvierte Match wird in der Hobbyliga belohnt. Unabhängig vom Ausgang erhält der Gewinner eine **Teilnahme-Basis von +{config.participationPoints} Punkten**. Der zusätzliche Gegner-Bonus richtet sich nach dem Ranking-Unterschied.
            </p>

            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside font-medium">
              <li>Siege gegen höher eingestufte Gegner bringen den höchsten Bonus.</li>
              <li>Siege gegen schwächere Gegner vergeben moderate Bonuspunkte.</li>
              <li>Niederlagen führen nicht zu Punktabzug, fördern aber die Match-Aktivität.</li>
            </ul>

            {/* Formula Box */}
            <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 font-mono text-xs space-y-1 border border-slate-800">
              <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-400">
                Formel Gewinner-Punkte:
              </div>
              <div className="text-emerald-300 font-bold">
                P<sub>neu</sub> = P<sub>alt</sub> + {config.participationPoints} + B(D)
              </div>
            </div>
          </div>

          {/* SECTION 2: LOGISTISCHE FUNKTION & INTERAKTIVE S-KURVE */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-5 md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 font-black text-sm flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                  Logistische Funktion (Glättung & Inflationsschutz)
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 self-start sm:self-auto flex items-center gap-1.5">
                <i className="fa-solid fa-chart-line" /> Dynamische S-Kurve & Simulator
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Zur Berechnung des Gegner-Bonus nutzt das System eine <strong>S-förmige logistische Kurve</strong>. Dies glättet extrem große Punkteunterschiede und verhindert unfaire Punkte-Sprünge ("Runaway Inflation").
            </p>

            {/* Formula Box & Dynamic Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-1.5 border border-slate-800 flex flex-col justify-center">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-indigo-300">
                  Gegner-Bonus B(D) Formel:
                </div>
                <div className="text-indigo-200 font-bold text-sm overflow-x-auto py-1">
                  B(D) = {config.maxBonusPoints} / (1 + e<sup>-{config.logisticSteepnessK} &times; D</sup>)
                </div>
                <div className="text-[10px] text-slate-400 font-sans">
                  wobei D = Punkte<sub>Gegner</sub> &minus; Punkte<sub>Spieler</sub>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2 text-xs font-medium text-slate-700 flex flex-col justify-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  S-Kurven Parameter
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Max. Bonus (L):</span>
                  <span className="font-mono font-bold text-indigo-950">+{config.maxBonusPoints} Pkt.</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Steilheit (k):</span>
                  <span className="font-mono font-bold text-indigo-950">{config.logisticSteepnessK}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/80">
                  <span className="text-slate-500">Bonus bei D = 0:</span>
                  <span className="font-mono font-bold text-emerald-700">+{(config.maxBonusPoints / 2).toFixed(1)} Pkt.</span>
                </div>
              </div>
            </div>

            {/* SVG CHART CONTAINER */}
            <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-chart-area text-indigo-400 text-sm" />
                  <span className="text-xs font-bold text-slate-200">
                    S-Kurven Diagramm: Gegner-Bonus B(D)
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[var(--color-primary,#10b981)] rounded" />
                    B(D) Kurve
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    Live Marker
                  </span>
                </div>
              </div>

              {/* SVG GRAPHIC */}
              <div className="w-full relative overflow-hidden pt-1">
                <svg
                  viewBox="0 0 500 220"
                  className="w-full h-auto overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary, #10b981)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--color-primary, #10b981)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid / Axis Lines */}
                  {/* Y=0 Base Line */}
                  <line x1="45" y1="185" x2="480" y2="185" stroke="#334155" strokeWidth="1" />
                  {/* Y = Max Bonus (Cap) Dashed Line */}
                  <line x1="45" y1="25" x2="480" y2="25" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
                  {/* Y = Mid (L/2) Dashed Line */}
                  <line x1="45" y1="105" x2="480" y2="105" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                  {/* X = 0 Center Axis Line */}
                  <line x1="262.5" y1="25" x2="262.5" y2="185" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

                  {/* Axis Numeric Labels */}
                  <text x="40" y="29" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {config.maxBonusPoints}
                  </text>
                  <text x="40" y="109" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {(config.maxBonusPoints / 2).toFixed(1)}
                  </text>
                  <text x="40" y="189" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    0
                  </text>

                  {/* Max Cap Highlight Text */}
                  <text x="475" y="16" fill="#94a3b8" fontSize="10" fontWeight="400" textAnchor="end">
                    Max. Bonus: {config.maxBonusPoints} Pkt. (Sättigung)
                  </text>

                  {/* X Axis Labels */}
                  <text x="45" y="200" fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    -100
                  </text>
                  <text x="262.5" y="200" fill="#94a3b8" fontSize="10" fontWeight="400" textAnchor="middle" fontFamily="monospace">
                    0 (Gleich stark)
                  </text>
                  <text x="480" y="200" fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    +100
                  </text>

                  {/* X Axis Title */}
                  <text x="262.5" y="215" fill="#64748b" fontSize="10" textAnchor="middle">
                    Punktedifferenz D (Gegner − Spieler)
                  </text>

                  {/* Area under S-curve */}
                  <path d={areaPathD} fill="url(#curveGradient)" />

                  {/* S-curve Path */}
                  <path
                    d={curvePathD}
                    fill="none"
                    stroke="var(--color-primary, #10b981)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Neutral point marker D=0 */}
                  <circle cx={neutralX} cy={neutralY} r="3" fill="#a5b4fc" />
                  <text x={neutralX + 6} y={neutralY - 5} fill="#a5b4fc" fontSize="10" fontWeight="400">
                    D=0 &rarr; +{(config.maxBonusPoints / 2).toFixed(1)} Pkt.
                  </text>

                  {/* Live Interactive Marker Guide Lines */}
                  <line
                    x1={markerX}
                    y1={markerY}
                    x2={markerX}
                    y2="185"
                    stroke="#f59e0b"
                    strokeWidth="1.25"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1="45"
                    y1={markerY}
                    x2={markerX}
                    y2={markerY}
                    stroke="#f59e0b"
                    strokeWidth="1.25"
                    strokeDasharray="2 2"
                  />

                  {/* Marker Outer Ring Pulsing */}
                  <circle cx={markerX} cy={markerY} r="6" fill="#f59e0b" opacity="0.3" className="animate-ping" />
                  {/* Marker Solid Point */}
                  <circle cx={markerX} cy={markerY} r="4.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />

                  {/* Tooltip Badge inside SVG with dynamic non-overlapping position */}
                  {(() => {
                    let tooltipY = markerY - 18;
                    if (markerY < 75) {
                      tooltipY = markerY + 22; // Place below point if near upper boundary
                    }
                    let tooltipX = markerX;
                    if (markerX > 360) {
                      tooltipX = markerX - 35;
                    } else if (markerX < 120) {
                      tooltipX = markerX + 35;
                    }
                    tooltipX = Math.max(55, Math.min(tooltipX, 425));

                    return (
                      <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                        <rect
                          x="-38"
                          y="-10"
                          width="76"
                          height="18"
                          rx="4"
                          fill="#0f172a"
                          stroke="#f59e0b"
                          strokeWidth="1"
                        />
                        <text x="0" y="3" fill="#fbbf24" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="monospace">
                          +{simBonus.toFixed(1)} Pkt.
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* INTERACTIVE MATCH SIMULATOR SLIDER */}
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-amber-400" />
                    Match-Simulator: Punktedifferenz D verschieben
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded-md">
                    D = {simulatedDiff > 0 ? `+${simulatedDiff}` : simulatedDiff} Pkt.
                  </span>
                </div>

                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={simulatedDiff}
                  onChange={(e) => setSimulatedDiff(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 focus:outline-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />

                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>-100 (Gegner viel schwächer)</span>
                  <span className="text-slate-300 font-semibold">0 (Gleich stark)</span>
                  <span>+100 (Gegner viel stäker)</span>
                </div>

                {/* Live Simulation Result Display Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex flex-col justify-between space-y-1">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Teilnahme-Basis</span>
                    <span className="text-lg sm:text-xl font-mono font-extrabold text-emerald-400">+{config.participationPoints} Pkt.</span>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-3 border border-amber-900/40 flex flex-col justify-between space-y-1">
                    <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Gegner-Bonus B(D)</span>
                    <span className="text-lg sm:text-xl font-mono font-extrabold text-amber-400">+{simBonus.toFixed(1)} Pkt.</span>
                  </div>

                  <div className="bg-[#081c15] rounded-xl p-3 border border-[#2d6a4f]/60 flex flex-col justify-between space-y-1">
                    <span className="text-xs font-semibold text-[#52b788] uppercase tracking-wider">Gewinn bei Sieg</span>
                    <span className="text-lg sm:text-xl font-mono font-extrabold text-white">
                      +{(config.participationPoints + simBonus).toFixed(1)} Pkt.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: INAKTIVITÄTS-ABZUG */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-black text-sm flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Inaktivitäts-Abzug (Dynamische Rangliste)
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Um zu verhindern, dass ruhende Punkte die Rangliste dauerhaft blockieren, greift nach **7 Tagen** ohne Match ein wöchentlicher Abzug.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1 font-medium">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <i className="fa-solid fa-circle-info text-amber-600" />
                Schutz für Neueinsteiger:
              </div>
              <p className="text-amber-800">
                Der Abzug greift <strong>erst ab dem 1. absolvierten Match</strong>! Inaktive Spieler ohne absolvierte Spiele behalten ihre Startpunkte ({config.initialRankingPoints} Pkt.).
              </p>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 font-mono text-xs border border-slate-800">
              <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-400">
                Abzug pro inaktive Woche:
              </div>
              <div className="text-amber-300 font-bold">
                Abzug = Inaktive_Wochen &times; {config.decayPointsPerWeek} Pkt.
              </div>
            </div>
          </div>

          {/* SECTION 4: ANREIZ-SYSTEM & PHILOSOPHIE */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-sm flex items-center justify-center shrink-0">
                4
              </span>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Anreiz-System & Philosophie
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Das Hobbyliga-System kombiniert drei zentrale Werte für eine motivierende Vereinssaison:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <i className="fa-solid fa-bolt text-[var(--color-primary)] mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 block">Aktivität belohnen</strong>
                  <span className="text-slate-500 font-medium">Wer oft spielt, sammelt kontinuierlich Basispunkte.</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <i className="fa-solid fa-scale-balanced text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 block">Faire Aufholchancen</strong>
                  <span className="text-slate-500 font-medium">Herausforderungen gegen Führende bieten die höchsten Bonuspunkte.</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <i className="fa-solid fa-shield-halved text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 block">Dynamik im Feld</strong>
                  <span className="text-slate-500 font-medium">Der Inaktivitätsabzug hält das Klassement lebendig und fair.</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: CHANGELOG & HISTORIE DER REGELWERKE */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-black text-sm flex items-center justify-center shrink-0">
                5
              </span>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide flex-1">
                Changelog & Historie der Regelwerke
              </h3>
              {simConfig && (
                <button
                  onClick={() => setSimConfig(null)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-rotate-left"></i>
                  Simulator zurücksetzen
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Übersicht der zeitgesteuerten Parameter für die Punkteberechnung der Hobbyliga. 
              Die Parameter der <strong>aktuell aktiven</strong> Version werden standardmäßig für den obigen interaktiven Match-Simulator herangezogen.
            </p>

            <div className="space-y-3 mt-4">
              {configVersions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-bold border-2 border-dashed border-slate-100 rounded-xl">
                  Lade Regelwerk-Historie...
                </div>
              ) : (
                configVersions.map((ver, idx) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  // A version is current if its effective date is in the past/today, AND it's the latest such version
                  const isCurrent = ver.effective_date <= todayStr && (
                    idx === 0 || configVersions[idx - 1].effective_date > todayStr
                  );
                  const isFuture = ver.effective_date > todayStr;
                  const isArchived = !isCurrent && !isFuture;
                  
                  const isSimulated = simConfig && simConfig.initialRankingPoints !== undefined && simConfig.maxBonusPoints === ver.max_bonus && simConfig.participationPoints === ver.base_points_win && simConfig.decayPointsPerWeek === ver.inactivity_deduction_per_week && simConfig.logisticSteepnessK === ver.logistic_factor;

                  return (
                    <div 
                      key={ver.id}
                      className={`relative overflow-hidden rounded-xl border ${
                        isCurrent 
                          ? "bg-emerald-50/30 border-emerald-200" 
                          : isFuture
                          ? "bg-blue-50/30 border-blue-200"
                          : "bg-slate-50 border-slate-200"
                      } p-4 transition-all`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-black text-slate-800">
                            Gültig ab {new Date(ver.effective_date).toLocaleDateString('de-DE')}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Aktuell Aktiv
                            </span>
                          )}
                          {isFuture && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                              Geplant
                            </span>
                          )}
                          {isArchived && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 border border-slate-300">
                              Archiviert
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={() => {
                            setSimConfig({
                              initialRankingPoints: defaultConfig.initialRankingPoints, // Keep default for this purely as it's not in the version
                              participationPoints: ver.base_points_win,
                              maxBonusPoints: ver.max_bonus,
                              logisticSteepnessK: ver.logistic_factor,
                              decayPointsPerWeek: ver.inactivity_deduction_per_week
                            });
                            // Scroll to top
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isSimulated || (!simConfig && isCurrent)
                              ? "bg-slate-800 text-white border-slate-800 shadow-md"
                              : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <i className={`fa-solid ${isSimulated || (!simConfig && isCurrent) ? 'fa-check' : 'fa-flask'}`}></i>
                          {isSimulated || (!simConfig && isCurrent) ? "Im Simulator aktiv" : "Im Simulator testen"}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sieg / Niederlage</span>
                          <span className="font-mono font-black text-slate-700">+{ver.base_points_win} / +{ver.base_points_loss}</span>
                        </div>
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Max. Bonus</span>
                          <span className="font-mono font-black text-amber-600">+{ver.max_bonus} Pkt.</span>
                        </div>
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Inaktivitätsabzug</span>
                          <span className="font-mono font-black text-rose-600">-{ver.inactivity_deduction_per_week} / Woche</span>
                        </div>
                        <div className="bg-white/60 p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Skalierung (k)</span>
                          <span className="font-mono font-black text-indigo-600">{ver.logistic_factor}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
