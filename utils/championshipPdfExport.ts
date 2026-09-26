import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TournamentInstance } from '../types/championship';
import { User } from '../types';
import { calculateGroupStandings } from './championshipCalculator';
import { formatParticipantById } from './championshipNameResolver';
import { formatScoreString } from './championshipExport';

/**
 * Generates a clean, professional DIN A4 tournament PDF report
 * and triggers immediate client-side download.
 * Filename: `${turnier_name}_Abschlussbericht_${jahr}.pdf`
 */
export function exportChampionshipToPdf(
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

  const todayStr = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const safeTitle = (tournament.title || 'Meisterschaft')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const filename = `${safeTitle}_Abschlussbericht_${year}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // Primary Theme Colors (Forest / Emerald & Slate)
  const primaryColor: [number, number, number] = [27, 67, 50]; // #1b4332
  const darkSlate: [number, number, number] = [15, 23, 42]; // #0f172a
  const subtextColor: [number, number, number] = [100, 116, 139]; // #64748b
  const amberColor: [number, number, number] = [180, 83, 9]; // #b45309

  // Helper to check for page break
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = margin;
      drawHeaderSmall();
    }
  };

  const drawHeaderSmall = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...subtextColor);
    doc.text(`${clubName} • ${tournament.title}`, margin, currentY);
    doc.text(`Stand: ${todayStr}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
  };

  // =========================================================================
  // 1. MAIN COVER / HEADER SECTION
  // =========================================================================
  // Top Badge / Club Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text(clubName.toUpperCase(), margin, currentY);
  currentY += 5;

  // Tournament Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...darkSlate);
  const titleLines = doc.splitTextToSize(tournament.title || 'Vereinsmeisterschaft', pageWidth - 2 * margin);
  doc.text(titleLines, margin, currentY);
  currentY += titleLines.length * 7;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...subtextColor);
  doc.text(`Offizieller Abschlussbericht & Turnierergebnisse ${year}`, margin, currentY);
  currentY += 6;

  // Meta Info Box (Grid)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 16, 2, 2, 'FD');

  const colWidth = (pageWidth - 2 * margin) / 4;
  const metaY = currentY + 5;

  // Col 1: Disziplin
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...subtextColor);
  doc.text('DISZIPLIN', margin + 3, metaY);
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text(tournament.discipline === 'doubles' ? 'Doppel' : 'Einzel', margin + 3, metaY + 5);

  // Col 2: Format
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...subtextColor);
  doc.text('MODUS', margin + colWidth + 3, metaY);
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  const formatStr = tournament.matchFormat.setsToWin === 2 ? 'Best of 3' : `${tournament.matchFormat.setsToWin} Gewinnsätze`;
  doc.text(formatStr, margin + colWidth + 3, metaY + 5);

  // Col 3: Teilnehmer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...subtextColor);
  doc.text('TEILNEHMER', margin + colWidth * 2 + 3, metaY);
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text(`${(tournament.participants || []).length} Spieler/Teams`, margin + colWidth * 2 + 3, metaY + 5);

  // Col 4: Druckdatum
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...subtextColor);
  doc.text('STAND / DATUM', margin + colWidth * 3 + 3, metaY);
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text(todayStr, margin + colWidth * 3 + 3, metaY + 5);

  currentY += 22;

  // =========================================================================
  // 2. K.-O.-ENDRUNDE & PODIUM (Falls vorhanden)
  // =========================================================================
  const koMatches = (tournament.matches || []).filter((m) => {
    const stage = tournament.stages?.find((s) => s.id === m.stageId);
    return !m.groupId && (stage?.type === 'knockout' || stage?.type === 'finals_day' || stage?.isFinalsDay);
  });

  const grandFinal = koMatches.find(
    (m) =>
      (m.roundLabel || '').toLowerCase().includes('großes') ||
      m.roundLabel === 'Finale' ||
      ((m.roundLabel || '').toLowerCase().includes('finale') &&
        !(m.roundLabel || '').toLowerCase().includes('klein') &&
        !(m.roundLabel || '').toLowerCase().includes('halb'))
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

  if (koMatches.length > 0) {
    ensureSpace(35);

    // Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('K.-O.-ENDRUNDE & PLATZIERUNGEN', margin, currentY);
    currentY += 4;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    // Podium Boxen (Großes Finale & Kleines Finale nebeneinander oder gestaffelt)
    const boxWidth = (pageWidth - 2 * margin - 6) / 2;

    if (grandFinal || smallFinal) {
      const gfWinner = grandFinal?.result?.winnerParticipantId;
      const gfP1 = formatParticipantById(grandFinal?.participant1Id, tournament.participants, users);
      const gfP2 = formatParticipantById(grandFinal?.participant2Id, tournament.participants, users);
      const gfScore = formatScoreString(grandFinal);

      // Box 1: Großes Finale
      doc.setFillColor(254, 252, 232); // Amber light
      doc.setDrawColor(245, 158, 11); // Amber border
      doc.roundedRect(margin, currentY, boxWidth, 26, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...amberColor);
      doc.text('🏆 GROSSES FINALE (PLATZ 1 & 2)', margin + 3, currentY + 5);

      doc.setFont('helvetica', gfWinner === grandFinal?.participant1Id ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...darkSlate);
      doc.text(`${gfWinner === grandFinal?.participant1Id ? '1. ' : ''}${gfP1}`, margin + 3, currentY + 11);

      doc.setFont('helvetica', gfWinner === grandFinal?.participant2Id ? 'bold' : 'normal');
      doc.text(`${gfWinner === grandFinal?.participant2Id ? '1. ' : ''}${gfP2}`, margin + 3, currentY + 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...primaryColor);
      doc.text(`Ergebnis: ${gfScore}`, margin + 3, currentY + 22);

      // Box 2: Kleines Finale
      if (smallFinal) {
        const sfWinner = smallFinal?.result?.winnerParticipantId;
        const sfP1 = formatParticipantById(smallFinal?.participant1Id, tournament.participants, users);
        const sfP2 = formatParticipantById(smallFinal?.participant2Id, tournament.participants, users);
        const sfScore = formatScoreString(smallFinal);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin + boxWidth + 6, currentY, boxWidth, 26, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...darkSlate);
        doc.text('🥉 KLEINES FINALE (SPIEL UM PLATZ 3)', margin + boxWidth + 9, currentY + 5);

        doc.setFont('helvetica', sfWinner === smallFinal?.participant1Id ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        doc.text(`${sfWinner === smallFinal?.participant1Id ? '3. ' : ''}${sfP1}`, margin + boxWidth + 9, currentY + 11);

        doc.setFont('helvetica', sfWinner === smallFinal?.participant2Id ? 'bold' : 'normal');
        doc.text(`${sfWinner === smallFinal?.participant2Id ? '3. ' : ''}${sfP2}`, margin + boxWidth + 9, currentY + 16);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...subtextColor);
        doc.text(`Ergebnis: ${sfScore}`, margin + boxWidth + 9, currentY + 22);
      }

      currentY += 31;
    }

    // Halbfinals Tabelle
    if (semiFinals.length > 0) {
      const hfRows = semiFinals.map((hf, i) => {
        const p1 = formatParticipantById(hf.participant1Id, tournament.participants, users);
        const p2 = formatParticipantById(hf.participant2Id, tournament.participants, users);
        const score = formatScoreString(hf);
        const winner = hf.result?.winnerParticipantId
          ? formatParticipantById(hf.result.winnerParticipantId, tournament.participants, users)
          : '-';
        return [
          hf.roundLabel || `Halbfinale ${i + 1}`,
          `${p1} vs. ${p2}`,
          score,
          winner,
          hf.status === 'completed' ? 'Beendet' : hf.status === 'walkover' ? 'w/o' : 'Offen',
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Halbfinal-Partie', 'Begegnung', 'Ergebnis', 'Sieger / Finalist', 'Status']],
        body: hfRows,
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: margin, right: margin },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // =========================================================================
  // 3. GRUPPENPHASE – TABELLEN & ENDSTAND
  // =========================================================================
  const groups = tournament.groups || [];
  if (groups.length > 0) {
    ensureSpace(35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('GRUPPENPHASE – TABELLEN & ENDSTAND', margin, currentY);
    currentY += 4;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    for (const group of groups) {
      ensureSpace(30);

      const advancingCount = tournament.stages?.find((s) => s.type === 'group')?.advancingPerGroup || 2;
      const standings = calculateGroupStandings(
        group,
        tournament.matches || [],
        tournament.participants || [],
        tournament.tieBreakRule,
        advancingCount
      );

      // Group Subheading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...darkSlate);
      doc.text(`Gruppe: ${group.name}`, margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...subtextColor);
      doc.text(`(Top ${advancingCount} qualifiziert für die K.-o.-Phase)`, margin + 45, currentY);
      currentY += 3;

      const groupTableRows = standings.map((row) => {
        const playerName = formatParticipantById(row.participantId, tournament.participants, users);
        const setRatio = `${row.setsWon}:${row.setsLost}`;
        const setDiff = row.setDiff > 0 ? `+${row.setDiff}` : String(row.setDiff);
        const gameRatio = `${row.gamesWon}:${row.gamesLost}`;
        const gameDiff = row.gameDiff > 0 ? `+${row.gameDiff}` : String(row.gameDiff);
        const statusText = row.rank <= advancingCount ? 'Qualifiziert' : 'Gruppenphase';

        return [
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
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Spieler / Paarung', 'Sp', 'S', 'N', 'Sätze', 'Diff', 'Spiele', 'Diff', 'Pkt', 'Status']],
        body: groupTableRows,
        theme: 'grid',
        styles: {
          fontSize: 7.2,
          cellPadding: 1.5,
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 7.2,
          fontStyle: 'bold',
          cellPadding: 1.8,
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center' },
          8: { halign: 'center' },
          9: { halign: 'center', fontStyle: 'bold' },
          10: { halign: 'center' },
        },
        didParseCell: (data) => {
          // Highlight advancing rows
          if (data.section === 'body') {
            const rowIndex = data.row.index;
            if (rowIndex < advancingCount) {
              data.cell.styles.fillColor = [236, 253, 245]; // light emerald
              if (data.column.index === 10) {
                data.cell.styles.textColor = [5, 150, 105]; // emerald green
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        },
        margin: { left: margin, right: margin },
      });

      currentY = (doc as any).lastAutoTable.finalY + 7;
    }
  }

  // =========================================================================
  // 4. ALLE BEGEGNUNGEN & ERGEBNISSE
  // =========================================================================
  const allMatches = tournament.matches || [];
  if (allMatches.length > 0) {
    ensureSpace(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('SPIELPLAN & ALLE BEGEGNUNGEN', margin, currentY);
    currentY += 4;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    const matchesRows = allMatches.map((match, idx) => {
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
        ? 'w/o'
        : 'Offen';

      return [
        idx + 1,
        phaseName,
        match.roundLabel || `Runde ${match.roundIndex + 1}`,
        `${p1} vs. ${p2}`,
        score,
        winner,
        status,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Phase / Gruppe', 'Runde', 'Begegnung', 'Ergebnis', 'Gewinner', 'Status']],
      body: matchesRows,
      theme: 'striped',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 7.2,
        fontStyle: 'bold',
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { halign: 'center' },
        3: { fontStyle: 'bold' },
        4: { halign: 'center', fontStyle: 'bold' },
        6: { halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
    });
  }

  // =========================================================================
  // 5. FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...subtextColor);
    doc.text(`${clubName} • Offizieller Turnierbericht • Stand: ${todayStr}`, margin, pageHeight - 7);
    doc.text(`Seite ${i} von ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Trigger Client-Side Download
  doc.save(filename);
}
