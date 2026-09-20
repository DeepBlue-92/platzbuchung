import {
  Group,
  Match,
  Participant,
  TieBreakRuleType,
  GroupStandingRow,
  TournamentStageConfig,
  TournamentTemplate,
  MatchSetScore,
} from '../types/championship';

/**
 * Creates the default standard championship template requested:
 * Group phase with 4 players per group, advancing top 2 into Semi-Finals and Final (2 KO stages).
 */
export function createDefaultTemplate(tenantId: string): TournamentTemplate {
  const now = new Date().toISOString();
  return {
    id: `template_default_${Date.now()}`,
    tenantId,
    title: 'Klassische Meisterschaft (Gruppen + K.-o.)',
    discipline: 'singles',
    stages: [
      {
        id: 'stage_groups',
        name: 'Gruppenphase',
        type: 'group',
        order: 1,
        groupCount: 2,
        playersPerGroup: 4,
        advancingPerGroup: 2,
      },
      {
        id: 'stage_semis',
        name: 'Halbfinale',
        type: 'knockout',
        order: 2,
        bracketSize: 4,
        roundName: 'Halbfinale',
      },
      {
        id: 'stage_final',
        name: 'Finale',
        type: 'knockout',
        order: 3,
        bracketSize: 2,
        roundName: 'Finale',
      },
    ],
    tieBreakRule: 'head_to_head',
    matchFormat: {
      setsToWin: 2,
      tiebreakAt: 6,
      championsTiebreakFinalSet: true,
    },
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies walkover logic: if a participant has withdrawn = true,
 * any unplayed match involving them is treated as a 6:0, 6:0 walkover for the opponent.
 * Already completed matches remain unchanged.
 */
export function getEffectiveMatchesWithWalkovers(
  matches: Match[],
  participants: Participant[]
): Match[] {
  const withdrawnMap = new Map<string, Participant>();
  for (const p of participants) {
    if (p.withdrawn) {
      withdrawnMap.set(p.id, p);
    }
  }

  if (withdrawnMap.size === 0) {
    return matches;
  }

  return matches.map((match) => {
    // If match is already completed, do not alter its existing result
    if (match.status === 'completed' && match.result) {
      return match;
    }

    const p1Withdrawn = match.participant1Id ? withdrawnMap.has(match.participant1Id) : false;
    const p2Withdrawn = match.participant2Id ? withdrawnMap.has(match.participant2Id) : false;

    // Only apply if at least one participant is withdrawn and match has 2 participants
    if (match.participant1Id && match.participant2Id && (p1Withdrawn || p2Withdrawn)) {
      if (p1Withdrawn && !p2Withdrawn) {
        const sets: MatchSetScore[] = [
          { setNumber: 1, player1Games: 0, player2Games: 6 },
          { setNumber: 2, player1Games: 0, player2Games: 6 },
        ];
        return {
          ...match,
          status: 'walkover',
          result: {
            winnerParticipantId: match.participant2Id,
            sets,
            isWalkover: true,
            walkoverReason: 'Aufgabe / Verletzung (automatische 6:0, 6:0 Wertung)',
            enteredByUserId: 'system',
            enteredByUserName: 'Turnier-System',
            enteredAt: new Date().toISOString(),
          },
        };
      }

      if (!p1Withdrawn && p2Withdrawn) {
        const sets: MatchSetScore[] = [
          { setNumber: 1, player1Games: 6, player2Games: 0 },
          { setNumber: 2, player1Games: 6, player2Games: 0 },
        ];
        return {
          ...match,
          status: 'walkover',
          result: {
            winnerParticipantId: match.participant1Id,
            sets,
            isWalkover: true,
            walkoverReason: 'Aufgabe / Verletzung (automatische 6:0, 6:0 Wertung)',
            enteredByUserId: 'system',
            enteredByUserName: 'Turnier-System',
            enteredAt: new Date().toISOString(),
          },
        };
      }
    }

    return match;
  });
}

/**
 * Calculates standings for a specific group according to the rules:
 * Sort cascade:
 * 1. Wins (Siege)
 * 2. Head-to-Head (Direkter Vergleich) if exactly 2 participants tied and tieBreakRule === 'head_to_head'
 * 3. Set difference (Satzdifferenz)
 * 4. Game difference (Gamedifferenz)
 * 5. Games won (Meiste Spiele)
 */
export function calculateGroupStandings(
  group: Group,
  allMatches: Match[],
  participants: Participant[],
  tieBreakRule: TieBreakRuleType = 'head_to_head',
  advancingSlots = 2
): GroupStandingRow[] {
  const effectiveMatches = getEffectiveMatchesWithWalkovers(allMatches, participants);
  const groupMatches = effectiveMatches.filter((m) => m.groupId === group.id);
  const participantMap = new Map<string, Participant>(participants.map((p) => [p.id, p]));

  // Initialize stats for each participant in the group
  const rows: GroupStandingRow[] = group.participantIds.map((pId) => {
    const p = participantMap.get(pId) || { id: pId, playerIds: [pId] };
    return {
      participantId: pId,
      participant: p,
      rank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      points: 0,
      isAdvancing: false,
    };
  });

  const rowMap = new Map<string, GroupStandingRow>(rows.map((r) => [r.participantId, r]));

  // Process completed matches
  for (const match of groupMatches) {
    if (!match.result || (match.status !== 'completed' && match.status !== 'walkover')) {
      continue;
    }
    const r1 = match.participant1Id ? rowMap.get(match.participant1Id) : null;
    const r2 = match.participant2Id ? rowMap.get(match.participant2Id) : null;
    if (!r1 || !r2) continue;

    r1.matchesPlayed += 1;
    r2.matchesPlayed += 1;

    let p1Sets = 0;
    let p2Sets = 0;
    let p1Games = 0;
    let p2Games = 0;

    for (const set of match.result.sets || []) {
      p1Games += set.player1Games || 0;
      p2Games += set.player2Games || 0;
      if (set.player1Games > set.player2Games) {
        p1Sets += 1;
      } else if (set.player2Games > set.player1Games) {
        p2Sets += 1;
      }
    }

    r1.setsWon += p1Sets;
    r1.setsLost += p2Sets;
    r1.gamesWon += p1Games;
    r1.gamesLost += p2Games;

    r2.setsWon += p2Sets;
    r2.setsLost += p1Sets;
    r2.gamesWon += p2Games;
    r2.gamesLost += p1Games;

    if (match.result.winnerParticipantId === r1.participantId) {
      r1.wins += 1;
      r1.points += 1;
      r2.losses += 1;
    } else if (match.result.winnerParticipantId === r2.participantId) {
      r2.wins += 1;
      r2.points += 1;
      r1.losses += 1;
    }
  }

  // Update diffs
  for (const row of rows) {
    row.setDiff = row.setsWon - row.setsLost;
    row.gameDiff = row.gamesWon - row.gamesLost;
  }

  // Helper for Head-to-Head between two specific participants
  const getHeadToHeadWinner = (p1Id: string, p2Id: string): string | null => {
    const directMatch = groupMatches.find(
      (m) =>
        ((m.participant1Id === p1Id && m.participant2Id === p2Id) ||
          (m.participant1Id === p2Id && m.participant2Id === p1Id)) &&
        m.result &&
        (m.status === 'completed' || m.status === 'walkover')
    );
    return directMatch?.result?.winnerParticipantId || null;
  };

  // Group rows by points to check for 2-way ties
  const pointsMap = new Map<number, GroupStandingRow[]>();
  for (const row of rows) {
    const list = pointsMap.get(row.points) || [];
    list.push(row);
    pointsMap.set(row.points, list);
  }

  // Sort rows based on sort cascade
  rows.sort((a, b) => {
    // 1. Wins (Points)
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    // 2. Direct comparison if exactly 2 participants are tied on points and rule is head_to_head
    if (tieBreakRule === 'head_to_head') {
      const tiedGroup = pointsMap.get(a.points);
      if (tiedGroup && tiedGroup.length === 2) {
        const h2hWinner = getHeadToHeadWinner(a.participantId, b.participantId);
        if (h2hWinner === a.participantId) return -1;
        if (h2hWinner === b.participantId) return 1;
      }
    }

    // 3. Set difference
    if (b.setDiff !== a.setDiff) {
      return b.setDiff - a.setDiff;
    }

    // 4. Game difference
    if (b.gameDiff !== a.gameDiff) {
      return b.gameDiff - a.gameDiff;
    }

    // 5. Games won
    if (b.gamesWon !== a.gamesWon) {
      return b.gamesWon - a.gamesWon;
    }

    // Stable secondary sort by name
    return (a.participant.displayNames?.[0] || a.participantId).localeCompare(
      b.participant.displayNames?.[0] || b.participantId
    );
  });

  // Assign ranks & qualifying status
  rows.forEach((row, index) => {
    row.rank = index + 1;
    row.isAdvancing = row.rank <= advancingSlots;
  });

  return rows;
}

/**
 * Generates Round Robin matches for groups.
 */
export function generateGroupMatches(
  stageId: string,
  groups: Group[]
): Match[] {
  const matches: Match[] = [];
  let matchIndex = 1;

  for (const group of groups) {
    const pIds = group.participantIds;
    // Round robin pairings
    for (let i = 0; i < pIds.length; i++) {
      for (let j = i + 1; j < pIds.length; j++) {
        matches.push({
          id: `match_${stageId}_${group.id}_${i}_${j}_${Date.now()}_${matchIndex}`,
          stageId,
          groupId: group.id,
          roundIndex: 0,
          roundLabel: `${group.name} - Spiel ${matchIndex}`,
          matchNumberInStage: matchIndex,
          participant1Id: pIds[i],
          participant2Id: pIds[j],
          status: 'scheduled',
          result: null,
        });
        matchIndex++;
      }
    }
  }

  return matches;
}

/**
 * Generates a Knockout bracket for a given bracket size (e.g. 2 for Final, 4 for Semis + Final, 8 for Quarters).
 */
export function generateKnockoutMatches(
  stages: TournamentStageConfig[],
  qualifierMap?: Record<string, string> // e.g. "semi_1_p1" -> participantId
): Match[] {
  const matches: Match[] = [];
  const koAndFinalsStages = stages.filter((s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay).sort((a, b) => a.order - b.order);

  if (koAndFinalsStages.length === 0) return matches;

  for (let sIdx = 0; sIdx < koAndFinalsStages.length; sIdx++) {
    const stage = koAndFinalsStages[sIdx];

    if (stage.type === 'finals_day' || stage.isFinalsDay) {
      // Finals Day: Generate placement matches (Großes Finale, Kleines Finale, etc.)
      const maxRank = stage.placementMatchesMaxRank ?? (stage.bracketSize === 2 ? 2 : 4);
      const matchCount = Math.max(1, Math.floor(maxRank / 2));

      for (let m = 0; m < matchCount; m++) {
        const matchId = `match_${stage.id}_${m + 1}`;
        let roundLabel = 'Großes Finale (Platz 1 & 2)';
        if (m === 1) {
          roundLabel = 'Kleines Finale (Spiel um Platz 3)';
        } else if (m > 1) {
          const rankA = m * 2 + 1;
          roundLabel = `Spiel um Platz ${rankA}`;
        }

        matches.push({
          id: matchId,
          stageId: stage.id,
          roundIndex: sIdx,
          roundLabel,
          matchNumberInStage: m + 1,
          participant1Id: qualifierMap?.[`${stage.id}_m${m}_p1`] || null,
          participant2Id: qualifierMap?.[`${stage.id}_m${m}_p2`] || null,
          status: 'scheduled',
          result: null,
        });
      }
    } else {
      // Standard discrete knockout round
      const matchCount = Math.max(1, Math.floor((stage.bracketSize || 2) / 2));

      for (let m = 0; m < matchCount; m++) {
        const matchId = `match_${stage.id}_${m + 1}`;
        const roundLabel = stage.roundName || (matchCount === 1 ? 'Finale' : matchCount === 2 ? 'Halbfinale' : `Runde ${stage.order}`);
        
        matches.push({
          id: matchId,
          stageId: stage.id,
          roundIndex: sIdx,
          roundLabel: matchCount > 1 ? `${roundLabel} ${m + 1}` : roundLabel,
          matchNumberInStage: m + 1,
          participant1Id: qualifierMap?.[`${stage.id}_m${m}_p1`] || null,
          participant2Id: qualifierMap?.[`${stage.id}_m${m}_p2`] || null,
          status: 'scheduled',
          result: null,
        });
      }
    }
  }

  return matches;
}

/**
 * Automatically propagates winners from earlier KO rounds (or groups) to downstream matches.
 */
export function propagateWinnersInTournament(matches: Match[], stages: TournamentStageConfig[]): Match[] {
  const koStages = stages.filter((s) => s.type === 'knockout').sort((a, b) => a.order - b.order);
  if (koStages.length < 2) return matches;

  const updatedMatches = [...matches];

  for (let i = 0; i < koStages.length - 1; i++) {
    const currentStage = koStages[i];
    const nextStage = koStages[i + 1];

    const currentMatches = updatedMatches.filter((m) => m.stageId === currentStage.id);
    const nextMatches = updatedMatches.filter((m) => m.stageId === nextStage.id);

    // E.g. Semis (2 matches) -> Final (1 match)
    if (currentMatches.length === 2 && nextMatches.length === 1) {
      const semi1 = currentMatches[0];
      const semi2 = currentMatches[1];
      const finalMatch = nextMatches[0];

      const winner1 = semi1.result?.winnerParticipantId || null;
      const winner2 = semi2.result?.winnerParticipantId || null;

      if (finalMatch.participant1Id !== winner1 || finalMatch.participant2Id !== winner2) {
        const finalIdx = updatedMatches.findIndex((m) => m.id === finalMatch.id);
        if (finalIdx !== -1) {
          updatedMatches[finalIdx] = {
            ...finalMatch,
            participant1Id: winner1,
            participant2Id: winner2,
          };
        }
      }
    }
  }

  return updatedMatches;
}
