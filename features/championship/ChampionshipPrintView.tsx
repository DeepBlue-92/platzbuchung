import React from 'react';
import { TournamentInstance } from '../../types/championship';
import { User, RankingState } from '../../types';
import { calculateGroupStandings } from '../../utils/championshipCalculator';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { formatScoreString } from '../../utils/championshipExport';
import { Trophy, Medal, Award, Calendar, CheckCircle2 } from 'lucide-react';

interface ChampionshipPrintViewProps {
  tournament: TournamentInstance;
  users: Record<string, User>;
  clubName?: string;
  logoUrl?: string;
  rankings?: RankingState | null;
  previewMode?: boolean;
}

export const ChampionshipPrintView: React.FC<ChampionshipPrintViewProps> = ({
  tournament,
  users,
  clubName = 'Tennis-Club',
  logoUrl,
  previewMode = false,
}) => {
  if (!tournament) return null;

  const todayStr = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const year = tournament.startDate
    ? new Date(tournament.startDate).getFullYear()
    : tournament.createdAt
    ? new Date(tournament.createdAt).getFullYear()
    : new Date().getFullYear();

  // Filter KO stages
  const koMatches = (tournament.matches || []).filter((m) => {
    const stage = tournament.stages?.find((s) => s.id === m.stageId);
    return !m.groupId && (stage?.type === 'knockout' || stage?.type === 'finals_day' || stage?.isFinalsDay);
  });

  // Filter Finals vs Semis
  const grandFinal = koMatches.find(
    (m) =>
      (m.roundLabel || '').toLowerCase().includes('großes') ||
      m.roundLabel === 'Finale' ||
      ((m.roundLabel || '').toLowerCase().includes('finale') && !(m.roundLabel || '').toLowerCase().includes('klein') && !(m.roundLabel || '').toLowerCase().includes('halb'))
  );

  const smallFinal = koMatches.find(
    (m) =>
      (m.roundLabel || '').toLowerCase().includes('kleines') ||
      (m.roundLabel || '').toLowerCase().includes('platz 3') ||
      (m.roundLabel || '').toLowerCase().includes('spiel um platz 3')
  );

  const semiFinals = koMatches.filter(
    (m) =>
      (m.roundLabel || '').toLowerCase().includes('halb') ||
      (m.roundLabel || '').toLowerCase().startsWith('hf') ||
      (m.roundLabel || '').toLowerCase().includes('semi')
  );

  const groupMatches = (tournament.matches || []).filter((m) => !!m.groupId);

  return (
    <div className={`${previewMode ? 'block' : 'hidden print:block'} w-full bg-white text-slate-900 font-sans p-2 sm:p-4 text-xs`}>
      {/* ===================================================================== */}
      {/* DRUCK-HEADER (Logo, Vereinsname, Turniertitel, Erstellungsdatum)     */}
      {/* ===================================================================== */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Vereinswappen"
                className="w-16 h-16 object-contain shrink-0"
              />
            ) : (
              <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg shrink-0">
                <Trophy className="w-7 h-7 text-amber-400" />
              </div>
            )}
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block">
                {clubName}
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                {tournament.title}
              </h1>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                Abschlussbericht & Offizielle Turnierergebnisse {year}
              </p>
            </div>
          </div>

          <div className="text-right border border-slate-300 rounded-lg p-2.5 bg-slate-50 shrink-0">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Druckdatum
            </span>
            <span className="block text-sm font-bold text-slate-900 mt-0.5">
              {todayStr}
            </span>
            <span className="block text-[10px] text-slate-600 mt-1">
              Disziplin: <strong className="text-slate-900">{tournament.discipline === 'doubles' ? 'Doppel' : 'Einzel'}</strong>
            </span>
          </div>
        </div>

        {/* Turniermodus & Metadaten */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200 text-[10px]">
          <div>
            <span className="text-slate-500 font-medium">Modus:</span>{' '}
            <strong className="text-slate-800">
              {tournament.matchFormat.setsToWin === 2 ? 'Best of 3 Sätze' : `${tournament.matchFormat.setsToWin} Gewinnsätze`}
              {tournament.matchFormat.championsTiebreakFinalSet ? ' (3. Satz Match-Tiebreak)' : ''}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Teilnehmer:</span>{' '}
            <strong className="text-slate-800">{(tournament.participants || []).length} Spieler / Teams</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Status:</span>{' '}
            <strong className="text-slate-800">
              {tournament.status === 'archived' ? 'Abgeschlossen' : 'Offizieller Spielbetrieb'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Tiebreak-Regel:</span>{' '}
            <strong className="text-slate-800">
              {tournament.tieBreakRule === 'head_to_head' ? 'Direkter Vergleich' : 'Satzdifferenz'}
            </strong>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ABSCHNITT 1: K.-O.-ENDRUNDE (GROSSES FINALE, KLEINES FINALE, HALBFINALE)*/}
      {/* ===================================================================== */}
      {koMatches.length > 0 && (
        <section className="mb-6 break-inside-avoid print:break-inside-avoid">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5 mb-3">
            <Trophy className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              K.-o.-Endrunde & Platzierungen
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Großes Finale (Platz 1 & 2) */}
            {grandFinal && (
              <div className="border-2 border-slate-900 rounded-xl p-3.5 bg-slate-50/60 break-inside-avoid">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                  <div className="flex items-center gap-1.5 text-amber-700 font-black text-[11px] uppercase tracking-wider">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Großes Finale (Platz 1 & 2)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    {grandFinal.status === 'completed' ? 'Beendet' : grandFinal.status === 'walkover' ? 'w/o' : 'Ausstehend'}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Spieler 1 */}
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs ${grandFinal.result?.winnerParticipantId === grandFinal.participant1Id ? 'font-black text-slate-900 underline' : 'text-slate-700'}`}>
                      {formatParticipantById(grandFinal.participant1Id, tournament.participants, users)}
                    </span>
                    {grandFinal.result?.winnerParticipantId === grandFinal.participant1Id && (
                      <span className="text-[9px] font-bold text-amber-700 uppercase bg-amber-100 px-1.5 py-0.5 rounded">
                        1. Platz (Meister)
                      </span>
                    )}
                  </div>

                  {/* Spieler 2 */}
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs ${grandFinal.result?.winnerParticipantId === grandFinal.participant2Id ? 'font-black text-slate-900 underline' : 'text-slate-700'}`}>
                      {formatParticipantById(grandFinal.participant2Id, tournament.participants, users)}
                    </span>
                    {grandFinal.result?.winnerParticipantId === grandFinal.participant2Id && (
                      <span className="text-[9px] font-bold text-amber-700 uppercase bg-amber-100 px-1.5 py-0.5 rounded">
                        1. Platz (Meister)
                      </span>
                    )}
                  </div>

                  {/* Ergebnis */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono font-bold text-xs text-slate-900">
                    <span className="text-[10px] font-sans font-semibold text-slate-500">Ergebnis:</span>
                    <span>{formatScoreString(grandFinal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Kleines Finale (Spiel um Platz 3) */}
            {smallFinal && (
              <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/40 break-inside-avoid">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                    <Medal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Kleines Finale (Spiel um Platz 3)</span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {smallFinal.status === 'completed' ? 'Beendet' : smallFinal.status === 'walkover' ? 'w/o' : 'Ausstehend'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs ${smallFinal.result?.winnerParticipantId === smallFinal.participant1Id ? 'font-black text-slate-900 underline' : 'text-slate-700'}`}>
                      {formatParticipantById(smallFinal.participant1Id, tournament.participants, users)}
                    </span>
                    {smallFinal.result?.winnerParticipantId === smallFinal.participant1Id && (
                      <span className="text-[9px] font-bold text-slate-700 uppercase bg-slate-200 px-1.5 py-0.5 rounded">
                        3. Platz
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs ${smallFinal.result?.winnerParticipantId === smallFinal.participant2Id ? 'font-black text-slate-900 underline' : 'text-slate-700'}`}>
                      {formatParticipantById(smallFinal.participant2Id, tournament.participants, users)}
                    </span>
                    {smallFinal.result?.winnerParticipantId === smallFinal.participant2Id && (
                      <span className="text-[9px] font-bold text-slate-700 uppercase bg-slate-200 px-1.5 py-0.5 rounded">
                        3. Platz
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono font-bold text-xs text-slate-900">
                    <span className="text-[10px] font-sans font-semibold text-slate-500">Ergebnis:</span>
                    <span>{formatScoreString(smallFinal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Halbfinals Übersicht */}
          {semiFinals.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Halbfinal-Begegnungen
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {semiFinals.map((hf, idx) => (
                  <div key={hf.id} className="border border-slate-200 rounded-lg p-2.5 bg-white flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        {hf.roundLabel || `Halbfinale ${idx + 1}`}
                      </span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {formatParticipantById(hf.participant1Id, tournament.participants, users)}
                        <span className="text-slate-400 mx-1.5">vs.</span>
                        {formatParticipantById(hf.participant2Id, tournament.participants, users)}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-800">
                      {formatScoreString(hf)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* ABSCHNITT 2: GRUPPENTABELLEN (ENDSTAND GRUPPENPHASE)                   */}
      {/* ===================================================================== */}
      {(tournament.groups || []).length > 0 && (
        <section className="mb-6 break-inside-avoid print:break-inside-avoid">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5 mb-3">
            <Award className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Gruppenphase – Tabellen & Endstand
            </h2>
          </div>

          <div className="space-y-4">
            {(tournament.groups || []).map((group) => {
              const advancingCount = tournament.stages?.find((s) => s.type === 'group')?.advancingPerGroup || 2;
              const standings = calculateGroupStandings(
                group,
                tournament.matches || [],
                tournament.participants || [],
                tournament.tieBreakRule,
                advancingCount
              );

              return (
                <div key={group.id} className="border border-slate-300 rounded-xl overflow-hidden break-inside-avoid">
                  {/* Gruppen-Header */}
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 flex items-center justify-between">
                    <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      {group.name}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Top {advancingCount} qualifiziert für die K.-o.-Phase
                    </span>
                  </div>

                  {/* Tabelle */}
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-50/80 font-bold text-slate-600 uppercase">
                        <th className="py-1.5 px-2.5 text-center w-8">#</th>
                        <th className="py-1.5 px-3">Spieler / Paarung</th>
                        <th className="py-1.5 px-2 text-center">Sp</th>
                        <th className="py-1.5 px-2 text-center">S</th>
                        <th className="py-1.5 px-2 text-center">N</th>
                        <th className="py-1.5 px-2.5 text-center">Sätze</th>
                        <th className="py-1.5 px-2 text-center">Diff</th>
                        <th className="py-1.5 px-2.5 text-center">Spiele</th>
                        <th className="py-1.5 px-2 text-center">Diff</th>
                        <th className="py-1.5 px-3 text-center font-black text-slate-900">Punkte</th>
                        <th className="py-1.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {standings.map((row) => {
                        const playerName = formatParticipantById(row.participantId, tournament.participants, users);
                        const isTop = row.rank <= advancingCount;

                        return (
                          <tr
                            key={row.participantId}
                            className={isTop ? 'bg-emerald-50/40 font-medium' : 'bg-white'}
                          >
                            <td className="py-1.5 px-2.5 text-center font-bold text-slate-800">
                              {row.rank}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-slate-900">
                              {playerName}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-600">{row.matchesPlayed}</td>
                            <td className="py-1.5 px-2 text-center font-bold text-emerald-800">{row.wins}</td>
                            <td className="py-1.5 px-2 text-center text-slate-500">{row.losses}</td>
                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-700">
                              {row.setsWon}:{row.setsLost}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                              {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-700">
                              {row.gamesWon}:{row.gamesLost}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                              {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                            </td>
                            <td className="py-1.5 px-3 text-center font-black text-slate-900 text-xs">
                              {row.points}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              {isTop ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  K.-o.-Qualifikation
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400">
                                  Gruppenphase
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* ABSCHNITT 3: ALLE BEGEGNUNGEN & ERGEBNISSE                             */}
      {/* ===================================================================== */}
      {(tournament.matches || []).length > 0 && (
        <section className="mb-6 break-inside-avoid print:break-inside-avoid">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5 mb-3">
            <Calendar className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Spielplan & Partien-Übersicht
            </h2>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 font-bold text-slate-600 uppercase">
                  <th className="py-1.5 px-2 text-center w-7">#</th>
                  <th className="py-1.5 px-3">Phase / Gruppe</th>
                  <th className="py-1.5 px-3">Runde</th>
                  <th className="py-1.5 px-3">Begegnung (Spieler 1 vs. Spieler 2)</th>
                  <th className="py-1.5 px-3 text-center">Ergebnis</th>
                  <th className="py-1.5 px-3">Gewinner</th>
                  <th className="py-1.5 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(tournament.matches || []).map((match, idx) => {
                  let phaseName = 'K.-o.-Runde';
                  if (match.groupId) {
                    const g = tournament.groups?.find((grp) => grp.id === match.groupId);
                    phaseName = g ? g.name : 'Gruppe';
                  } else {
                    const s = tournament.stages?.find((stg) => stg.id === match.stageId);
                    if (s) phaseName = s.name;
                  }

                  const p1 = formatParticipantById(match.participant1Id, tournament.participants, users);
                  const p2 = formatParticipantById(match.participant2Id, tournament.participants, users);
                  const score = formatScoreString(match);
                  const winner = match.result?.winnerParticipantId
                    ? formatParticipantById(match.result.winnerParticipantId, tournament.participants, users)
                    : '-';
                  const isDone = match.status === 'completed' || match.status === 'walkover';

                  return (
                    <tr key={match.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">
                        {phaseName}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {match.roundLabel || `Runde ${match.roundIndex + 1}`}
                      </td>
                      <td className="py-1.5 px-3 font-medium text-slate-900">
                        <span className={match.result?.winnerParticipantId === match.participant1Id ? 'font-bold text-emerald-900' : ''}>
                          {p1}
                        </span>
                        <span className="text-slate-400 mx-1.5">vs.</span>
                        <span className={match.result?.winnerParticipantId === match.participant2Id ? 'font-bold text-emerald-900' : ''}>
                          {p2}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-900">
                        {score}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">
                        {winner}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            match.status === 'completed'
                              ? 'bg-slate-100 text-slate-800'
                              : match.status === 'walkover'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-50 text-slate-400'
                          }`}
                        >
                          {isDone ? 'Beendet' : 'Offen'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* DRUCK-FUSSZEILE                                                       */}
      {/* ===================================================================== */}
      <footer className="pt-3 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
        <div>
          {clubName} &bull; Vereinsmeisterschafts-System
        </div>
        <div>
          Offizieller Abschlussbericht &bull; Gedruckt am {todayStr}
        </div>
      </footer>
    </div>
  );
};
