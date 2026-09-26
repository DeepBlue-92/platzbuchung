import * as XLSX from 'xlsx';
import { TournamentInstance, Match } from '../types/championship';
import { User } from '../types';
import { calculateGroupStandings } from './championshipCalculator';
import { formatParticipantById } from './championshipNameResolver';

/**
 * Formats a match score into human readable string e.g. "6:3, 6:4" or "w/o (Aufgabe)"
 */
export function formatScoreString(match?: Match | null): string {
  if (!match || !match.result) return 'Ausstehend';
  if (match.result.isWalkover) {
    const reason = match.result.walkoverReason || 'Aufgabe';
    return `w/o (${reason})`;
  }
  if (!match.result.sets || match.result.sets.length === 0) {
    return 'Beendet';
  }
  return match.result.sets
    .map((s) => {
      let score = `${s.player1Games}:${s.player2Games}`;
      if (s.player1TiebreakPoints !== null && s.player1TiebreakPoints !== undefined &&
          s.player2TiebreakPoints !== null && s.player2TiebreakPoints !== undefined) {
        score += ` (${s.player1TiebreakPoints}:${s.player2TiebreakPoints})`;
      }
      return score;
    })
    .join(', ');
}

/**
 * Client-side export of tournament data to a formatted Excel file (.xlsx)
 * Filename format: `${turnier_name}_Ergebnisse_${jahr}.xlsx`
 */
export function exportChampionshipToExcel(
  tournament: TournamentInstance,
  users: Record<string, User> = {},
  clubName = 'Tennis-Club'
): void {
  if (!tournament) return;

  const year = tournament.startDate
    ? new Date(tournament.startDate).getFullYear()
    : tournament.createdAt
    ? new Date(tournament.createdAt).getFullYear()
    : new Date().getFullYear();

  const safeTitle = (tournament.title || 'Meisterschaft')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const filename = `${safeTitle}_Ergebnisse_${year}.xlsx`;

  const wb = XLSX.utils.book_new();

  // =========================================================================
  // Blatt 1: "Endstand & Gruppen"
  // =========================================================================
  const sheet1Rows: any[][] = [];

  // Titel-Header
  sheet1Rows.push([`${tournament.title} - Endstand & Gruppenübersicht`]);
  sheet1Rows.push([
    'Verein:',
    clubName,
    'Disziplin:',
    tournament.discipline === 'doubles' ? 'Doppel' : 'Einzel',
    'Erstellt am:',
    new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  ]);
  sheet1Rows.push([]); // Leerzeile

  // 1. K.-o.-Endrunde / Platzierungen (falls K.-o.-Spiele vorhanden)
  const koMatches = (tournament.matches || []).filter((m) => {
    const stage = tournament.stages?.find((s) => s.id === m.stageId);
    return !m.groupId && (stage?.type === 'knockout' || stage?.type === 'finals_day' || stage?.isFinalsDay);
  });

  if (koMatches.length > 0) {
    sheet1Rows.push(['K.-O.-ENDRUNDE / FINALSPIELE']);
    sheet1Rows.push([
      'Runde',
      'Spieler 1',
      'Spieler 2',
      'Ergebnis',
      'Gewinner',
      'Status',
    ]);

    for (const match of koMatches) {
      const p1 = formatParticipantById(match.participant1Id, tournament.participants, users);
      const p2 = formatParticipantById(match.participant2Id, tournament.participants, users);
      const score = formatScoreString(match);
      const winner = match.result?.winnerParticipantId
        ? formatParticipantById(match.result.winnerParticipantId, tournament.participants, users)
        : '-';
      const status = match.status === 'completed' ? 'Beendet' : match.status === 'walkover' ? 'w/o' : 'Ausstehend';

      sheet1Rows.push([
        match.roundLabel || 'K.-o.-Match',
        p1,
        p2,
        score,
        winner,
        status,
      ]);
    }
    sheet1Rows.push([]); // Leerzeile
  }

  // 2. Gruppen-Tabellen
  const groups = tournament.groups || [];
  if (groups.length > 0) {
    sheet1Rows.push(['GRUPPENPHASE - TABELLEN']);

    for (const group of groups) {
      sheet1Rows.push([]);
      sheet1Rows.push([`Gruppe: ${group.name}`]);
      sheet1Rows.push([
        'Rang',
        'Spieler / Paarung',
        'Spiele',
        'Siege',
        'Niederlagen',
        'Satzverhältnis',
        'Satzdiff.',
        'Spielverhältnis',
        'Spieldiff.',
        'Punkte',
        'Status',
      ]);

      const advancingCount = tournament.stages?.find((s) => s.type === 'group')?.advancingPerGroup || 2;
      const standings = calculateGroupStandings(
        group,
        tournament.matches || [],
        tournament.participants || [],
        tournament.tieBreakRule,
        advancingCount
      );

      for (const row of standings) {
        const playerName = formatParticipantById(row.participantId, tournament.participants, users);
        const setRatio = `${row.setsWon}:${row.setsLost}`;
        const setDiff = row.setDiff > 0 ? `+${row.setDiff}` : String(row.setDiff);
        const gameRatio = `${row.gamesWon}:${row.gamesLost}`;
        const gameDiff = row.gameDiff > 0 ? `+${row.gameDiff}` : String(row.gameDiff);
        const statusText = row.isAdvancing ? 'Qualifiziert für K.-o.' : (row.rank <= advancingCount ? 'Aufsteiger' : 'Gruppenphase');

        sheet1Rows.push([
          row.rank,
          playerName,
          row.matchesPlayed,
          row.wins,
          row.losses,
          setRatio,
          setDiff,
          gameRatio,
          gameDiff,
          row.points,
          statusText,
        ]);
      }
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  ws1['!cols'] = [
    { wch: 8 },  // Rang
    { wch: 28 }, // Spieler / Paarung
    { wch: 9 },  // Spiele
    { wch: 8 },  // Siege
    { wch: 13 }, // Niederlagen
    { wch: 15 }, // Satzverhältnis
    { wch: 11 }, // Satzdiff.
    { wch: 16 }, // Spielverhältnis
    { wch: 12 }, // Spieldiff.
    { wch: 9 },  // Punkte
    { wch: 24 }, // Status
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Endstand & Gruppen');

  // =========================================================================
  // Blatt 2: "Begegnungen"
  // =========================================================================
  const sheet2Rows: any[][] = [];

  sheet2Rows.push([`${tournament.title} - Alle Begegnungen`]);
  sheet2Rows.push([
    'Verein:',
    clubName,
    'Gesamtspiele:',
    (tournament.matches || []).length,
    'Erstellt am:',
    new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  ]);
  sheet2Rows.push([]); // Leerzeile

  sheet2Rows.push([
    'Nr.',
    'Phase / Gruppe',
    'Runde',
    'Spieler 1',
    'Spieler 2',
    'Satzergebnis',
    'Gewinner',
    'Status',
    'Frist / Termin',
    'Platz',
  ]);

  const allMatches = tournament.matches || [];
  allMatches.forEach((match, index) => {
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
    const status = match.status === 'completed'
      ? 'Beendet'
      : match.status === 'walkover'
      ? 'Wertung (w/o)'
      : 'Ausstehend';
    const deadline = match.scheduledDate || match.deadlineDate || '-';
    const court = match.courtName || match.courtId || '-';

    sheet2Rows.push([
      index + 1,
      phaseName,
      match.roundLabel || `Runde ${match.roundIndex + 1}`,
      p1,
      p2,
      score,
      winner,
      status,
      deadline,
      court,
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  ws2['!cols'] = [
    { wch: 6 },  // Nr.
    { wch: 18 }, // Phase / Gruppe
    { wch: 18 }, // Runde
    { wch: 25 }, // Spieler 1
    { wch: 25 }, // Spieler 2
    { wch: 18 }, // Satzergebnis
    { wch: 25 }, // Gewinner
    { wch: 14 }, // Status
    { wch: 16 }, // Frist / Termin
    { wch: 14 }, // Platz
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Begegnungen');

  // Trigger File Download
  XLSX.writeFile(wb, filename);
}
