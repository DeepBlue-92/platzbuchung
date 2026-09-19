import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  LEAGUE_MATCHES_COLLECTION, 
  LEAGUE_PROFILES_COLLECTION, 
  LEAGUE_CONFIG_VERSIONS_COLLECTION,
  DYNAMIC_LEAGUES_COLLECTION,
  LEAGUES_COLLECTION,
  getLeagueConfigVersions
} from './league';
import { 
  getConfigForDate, 
  applyDecay, 
  calculatePoints, 
  LeaguePointConfig 
} from './leagueEngine';
import { LeagueMatch, LeaguePlayer, LeagueConfigVersion, DynamicLeague, User } from '../types';
import { resolvePlayerDisplayName } from '../utils/playerHelper';
import { resolveClubName } from './clubHelper';

export interface LeagueExportOptions {
  leagueId: string;
  leagueName?: string;
  usersMap?: Record<string, any>;
  includeAllLeagues?: boolean;
}

/**
 * Formats an ISO date string to German readable format DD.MM.YYYY HH:mm
 */
function formatDateTimeDe(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return isoStr || "-";
  }
}

/**
 * Formats an ISO date string to German readable format DD.MM.YYYY
 */
function formatDateDe(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return isoStr || "-";
  }
}

/**
 * Computes descriptive text of differences between two config versions
 */
function describeConfigChanges(current: LeagueConfigVersion, previous?: LeagueConfigVersion): string {
  if (!previous) {
    return "Initiales Basis-Regelwerk / Startkonfiguration";
  }

  const changes: string[] = [];

  const curWin = current.base_points_win ?? 5;
  const prevWin = previous.base_points_win ?? 5;
  if (curWin !== prevWin) {
    changes.push(`Basispunkte Sieg: ${prevWin} → ${curWin}`);
  }

  const curLoss = current.base_points_loss ?? 5;
  const prevLoss = previous.base_points_loss ?? 5;
  if (curLoss !== prevLoss) {
    changes.push(`Basispunkte Niederlage: ${prevLoss} → ${curLoss}`);
  }

  const curBonus = current.max_bonus ?? 45;
  const prevBonus = previous.max_bonus ?? 45;
  if (curBonus !== prevBonus) {
    changes.push(`Max. Bonus: ${prevBonus} → ${curBonus}`);
  }

  const curK = current.logistic_factor ?? 0.05;
  const prevK = previous.logistic_factor ?? 0.05;
  if (curK !== prevK) {
    changes.push(`k-Faktor (Steilheit): ${prevK} → ${curK}`);
  }

  const curDecay = current.inactivity_deduction_per_week ?? 5;
  const prevDecay = previous.inactivity_deduction_per_week ?? 5;
  if (curDecay !== prevDecay) {
    changes.push(`Inaktivitätsabzug/Woche: ${prevDecay} Pkt. → ${curDecay} Pkt.`);
  }

  return changes.length > 0 ? changes.join(" | ") : "Keine Parameteränderungen (Stichtags-Bestätigung)";
}

/**
 * Generates and downloads an Excel (.xlsx) file containing:
 * 1. Abschlusstabelle & Rangliste
 * 2. Spiele & Punkte-Historie (mit nachvollziehbarem Rechenweg je Match)
 * 3. Regelwerk & Parameter-Historie (inkl. deutlicher Darstellung von Parameter-Änderungen)
 * 4. Berechnungs-Anleitung & Formeln
 */
export async function exportLeagueToExcel(options: LeagueExportOptions): Promise<void> {
  const { leagueId, leagueName: customLeagueName, usersMap } = options;

  // 1. Fetch necessary data
  const [
    matchesSnap,
    profilesSnap,
    configVersionsList,
    leaguesSnap,
    dynamicLeaguesSnap
  ] = await Promise.all([
    getDocs(collection(db, LEAGUE_MATCHES_COLLECTION)),
    getDocs(collection(db, LEAGUE_PROFILES_COLLECTION)),
    getLeagueConfigVersions(),
    getDocs(collection(db, LEAGUES_COLLECTION)).catch(() => null),
    getDocs(collection(db, DYNAMIC_LEAGUES_COLLECTION)).catch(() => null),
  ]);

  // Resolve League Name
  let resolvedLeagueName = customLeagueName || leagueId;
  const findLeagueName = (id: string) => {
    let name = id;
    if (dynamicLeaguesSnap) {
      dynamicLeaguesSnap.forEach((d) => {
        if (d.id === id) name = d.data().name || name;
      });
    }
    if (leaguesSnap) {
      leaguesSnap.forEach((d) => {
        if (d.id === id) name = d.data().name || name;
      });
    }
    return name;
  };
  if (!customLeagueName) {
    resolvedLeagueName = findLeagueName(leagueId);
  }

  // Parse all matches
  const allMatches: (LeagueMatch & { id: string })[] = [];
  matchesSnap.forEach((d) => {
    allMatches.push({ id: d.id, ...(d.data() as LeagueMatch) });
  });

  // Filter matches for this league (or default to open_mixed if unassigned)
  const isTargetLeague = (mLeagueId?: string) => {
    if (!mLeagueId || mLeagueId === "open_mixed") {
      return leagueId === "open_mixed" || leagueId === "all";
    }
    return leagueId === "all" || mLeagueId === leagueId;
  };

  const leagueMatches = allMatches.filter((m) => isTargetLeague(m.leagueId));

  // Parse all profiles
  const allProfiles: LeaguePlayer[] = [];
  profilesSnap.forEach((d) => {
    allProfiles.push(d.data() as LeaguePlayer);
  });

  const leagueProfiles = allProfiles.filter((p) => {
    if (leagueId === "all") return true;
    const pLId = p.leagueId || "open_mixed";
    return pLId === leagueId;
  });

  // Build a fast user resolver
  const resolveUserName = (userId?: string, fallbackName?: string) => {
    if (!userId) return fallbackName || "Unbekannt";
    const u = usersMap ? usersMap[userId] : null;
    return resolvePlayerDisplayName(u, userId);
  };

  const resolveUserClub = (userId?: string) => {
    if (!userId) return "-";
    const u = usersMap ? usersMap[userId] : null;
    const prof = allProfiles.find(p => p.userId === userId);
    const rawClub = (prof?.clubId || u?.vereinsId || "").toLowerCase().trim();
    return resolveClubName(rawClub, rawClub ? rawClub.toUpperCase() : "-");
  };

  // Replay chronological matches to get precise point steps for this league
  const completedMatches = leagueMatches
    .filter((m) => m.status === 'completed' && (m.result || m.isManualAdjustment))
    .sort((a, b) => {
      const dateA = a.played_at || a.result?.played_at || a.scheduledDate || a.result?.reportedAt || a.createdAt || "";
      const dateB = b.played_at || b.result?.played_at || b.scheduledDate || b.result?.reportedAt || b.createdAt || "";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  // Simulation state to capture exact pre- and post-match points and stats
  const runningPoints: Record<string, number> = {};
  const lastMatchDates: Record<string, string> = {};
  const matchesCountMap: Record<string, number> = {};
  const winsMap: Record<string, number> = {};
  const lossesMap: Record<string, number> = {};
  const setsWonMap: Record<string, number> = {};
  const setsLostMap: Record<string, number> = {};
  const gamesWonMap: Record<string, number> = {};
  const gamesLostMap: Record<string, number> = {};
  const totalEarnedPointsMap: Record<string, number> = {};

  // Initialize profiles
  for (const p of leagueProfiles) {
    runningPoints[p.userId] = 100;
    lastMatchDates[p.userId] = p.createdAt || "2026-01-01T00:00:00.000Z";
    matchesCountMap[p.userId] = 0;
    winsMap[p.userId] = 0;
    lossesMap[p.userId] = 0;
    setsWonMap[p.userId] = 0;
    setsLostMap[p.userId] = 0;
    gamesWonMap[p.userId] = 0;
    gamesLostMap[p.userId] = 0;
    totalEarnedPointsMap[p.userId] = 0;
  }

  // Row data for "Spiele & Punkte-Historie"
  const matchesSheetRows: any[] = [];

  let matchIndex = 1;
  for (const match of completedMatches) {
    const matchDateIso = match.played_at || match.result?.played_at || match.scheduledDate || match.result?.reportedAt || match.createdAt || new Date().toISOString();
    const config = getConfigForDate(configVersionsList, matchDateIso, match.leagueId || leagueId);

    const p1Id = match.player1UserId;
    const p2Id = match.player2UserId;

    if (runningPoints[p1Id] === undefined) {
      runningPoints[p1Id] = 100;
      lastMatchDates[p1Id] = matchDateIso;
      matchesCountMap[p1Id] = 0;
      winsMap[p1Id] = 0;
      lossesMap[p1Id] = 0;
      setsWonMap[p1Id] = 0;
      setsLostMap[p1Id] = 0;
      gamesWonMap[p1Id] = 0;
      gamesLostMap[p1Id] = 0;
      totalEarnedPointsMap[p1Id] = 0;
    }
    if (runningPoints[p2Id] === undefined) {
      runningPoints[p2Id] = 100;
      lastMatchDates[p2Id] = matchDateIso;
      matchesCountMap[p2Id] = 0;
      winsMap[p2Id] = 0;
      lossesMap[p2Id] = 0;
      setsWonMap[p2Id] = 0;
      setsLostMap[p2Id] = 0;
      gamesWonMap[p2Id] = 0;
      gamesLostMap[p2Id] = 0;
      totalEarnedPointsMap[p2Id] = 0;
    }

    // Apply any inactivity decay prior to this match
    const p1PrePoints = applyDecay(runningPoints[p1Id], lastMatchDates[p1Id], config, matchesCountMap[p1Id], matchDateIso);
    const p2PrePoints = applyDecay(runningPoints[p2Id], lastMatchDates[p2Id], config, matchesCountMap[p2Id], matchDateIso);

    let p1PostPoints = p1PrePoints;
    let p2PostPoints = p2PrePoints;
    let p1Awarded = 0;
    let p2Awarded = 0;
    let winnerBonus = 0;
    let p1SetsWon = 0;
    let p1SetsLost = 0;
    let p1GamesWon = 0;
    let p1GamesLost = 0;

    let resultString = "-";
    let winnerName = "-";

    if (match.isManualAdjustment) {
      if (match.manualPointsValue !== undefined) {
        p1PostPoints = match.manualPointsValue;
      }
      p1Awarded = Number((p1PostPoints - p1PrePoints).toFixed(1));
      p2Awarded = 0;
      resultString = "Manuelle Anpassung";
      winnerName = resolveUserName(p1Id);
    } else {
      const isP1Winner = match.result?.winnerId === p1Id;
      p1PostPoints = calculatePoints(p1PrePoints, p2PrePoints, isP1Winner, config);
      p2PostPoints = calculatePoints(p2PrePoints, p1PrePoints, !isP1Winner, config);

      p1Awarded = Number((p1PostPoints - p1PrePoints).toFixed(1));
      p2Awarded = Number((p2PostPoints - p2PrePoints).toFixed(1));

      // Calculate the pure bonus portion for transparency
      const winnerPre = isP1Winner ? p1PrePoints : p2PrePoints;
      const loserPre = isP1Winner ? p2PrePoints : p1PrePoints;
      const diff = loserPre - winnerPre;
      winnerBonus = Number((config.maxBonusPoints / (1 + Math.exp(-config.logisticSteepnessK * diff))).toFixed(1));

      winnerName = isP1Winner ? resolveUserName(p1Id) : resolveUserName(p2Id);

      // Score breakdown
      if (match.result?.sets && Array.isArray(match.result.sets)) {
        resultString = match.result.sets.map((s) => `${s.gamesPlayer1}:${s.gamesPlayer2}`).join(", ");
        match.result.sets.forEach((s) => {
          p1GamesWon += (s.gamesPlayer1 || 0);
          p1GamesLost += (s.gamesPlayer2 || 0);
          if ((s.gamesPlayer1 || 0) > (s.gamesPlayer2 || 0)) {
            p1SetsWon++;
          } else if ((s.gamesPlayer2 || 0) > (s.gamesPlayer1 || 0)) {
            p1SetsLost++;
          }
        });
      }

      // Update win/loss and set/game stats
      if (isP1Winner) {
        winsMap[p1Id] = (winsMap[p1Id] || 0) + 1;
        lossesMap[p2Id] = (lossesMap[p2Id] || 0) + 1;
      } else {
        lossesMap[p1Id] = (lossesMap[p1Id] || 0) + 1;
        winsMap[p2Id] = (winsMap[p2Id] || 0) + 1;
      }

      setsWonMap[p1Id] = (setsWonMap[p1Id] || 0) + p1SetsWon;
      setsLostMap[p1Id] = (setsLostMap[p1Id] || 0) + p1SetsLost;
      setsWonMap[p2Id] = (setsWonMap[p2Id] || 0) + p1SetsLost;
      setsLostMap[p2Id] = (setsLostMap[p2Id] || 0) + p1SetsWon;

      gamesWonMap[p1Id] = (gamesWonMap[p1Id] || 0) + p1GamesWon;
      gamesLostMap[p1Id] = (gamesLostMap[p1Id] || 0) + p1GamesLost;
      gamesWonMap[p2Id] = (gamesWonMap[p2Id] || 0) + p1GamesLost;
      gamesLostMap[p2Id] = (gamesLostMap[p2Id] || 0) + p1GamesWon;

      totalEarnedPointsMap[p1Id] = (totalEarnedPointsMap[p1Id] || 0) + p1Awarded;
      totalEarnedPointsMap[p2Id] = (totalEarnedPointsMap[p2Id] || 0) + p2Awarded;
    }

    // Find the version applied
    const appliedVersion = configVersionsList.find(v => {
      if (v.leagueId && v.leagueId !== (match.leagueId || leagueId)) return false;
      return (v.effective_date || "").split('T')[0] <= matchDateIso.split('T')[0];
    }) || configVersionsList.find(v => v.is_base_rule || v.effective_date === '2000-01-01');

    matchesSheetRows.push({
      "Match-Nr.": matchIndex++,
      "Spieldatum": formatDateTimeDe(matchDateIso),
      "Spieler 1 (Heim)": resolveUserName(p1Id),
      "Verein Sp. 1": resolveUserClub(p1Id),
      "Punkte Sp. 1 (Vor Spiel)": Number(p1PrePoints.toFixed(1)),
      "Spieler 2 (Gast)": match.isManualAdjustment ? "(System)" : resolveUserName(p2Id),
      "Verein Sp. 2": match.isManualAdjustment ? "-" : resolveUserClub(p2Id),
      "Punkte Sp. 2 (Vor Spiel)": match.isManualAdjustment ? "-" : Number(p2PrePoints.toFixed(1)),
      "Ergebnis (Sätze)": resultString,
      "Sieger": winnerName,
      "Punkte-Zuwachs Sp. 1": (p1Awarded >= 0 ? `+${p1Awarded}` : `${p1Awarded}`),
      "Punkte-Zuwachs Sp. 2": match.isManualAdjustment ? "-" : (p2Awarded >= 0 ? `+${p2Awarded}` : `${p2Awarded}`),
      "Punkte Sp. 1 (Nach Spiel)": Number(p1PostPoints.toFixed(1)),
      "Punkte Sp. 2 (Nach Spiel)": match.isManualAdjustment ? "-" : Number(p2PostPoints.toFixed(1)),
      "Gültiges Regelwerk (Stichtag)": appliedVersion?.effective_date ? formatDateDe(appliedVersion.effective_date) : "Basis-Regelwerk",
      "Angew. Basispunkte (Sieg/Nied.)": `${config.base_points_win ?? 5} / ${config.base_points_loss ?? 5}`,
      "Angew. Max-Bonus": config.maxBonusPoints,
      "Angew. k-Faktor": config.logisticSteepnessK,
      "Erzielter Sieger-Bonus": match.isManualAdjustment ? "-" : `+${winnerBonus} Pkt.`,
      "Bemerkung / Begründung": match.isManualAdjustment 
        ? (match.manualAdjustmentReason || "Admin-Korrektur") 
        : (match.result?.notes || "Reguläres Spiel")
    });

    // Update state for next chronological matches
    runningPoints[p1Id] = p1PostPoints;
    lastMatchDates[p1Id] = matchDateIso;
    if (!match.isManualAdjustment) {
      matchesCountMap[p1Id] = (matchesCountMap[p1Id] || 0) + 1;
      runningPoints[p2Id] = p2PostPoints;
      lastMatchDates[p2Id] = matchDateIso;
      matchesCountMap[p2Id] = (matchesCountMap[p2Id] || 0) + 1;
    }
  }

  // Build "Abschlusstabelle & Rangliste" Sheet
  const nowIso = new Date().toISOString();
  const standingsRows: any[] = [];

  const allActiveUserIds = Array.from(new Set([
    ...leagueProfiles.map(p => p.userId),
    ...Object.keys(runningPoints)
  ])).filter(Boolean);

  const calculatedPlayers = allActiveUserIds.map((userId) => {
    const rawBase = runningPoints[userId] !== undefined ? runningPoints[userId] : 100;
    const lastDate = lastMatchDates[userId] || nowIso;
    const mCount = matchesCountMap[userId] || 0;
    const currentConfig = getConfigForDate(configVersionsList, nowIso, leagueId);
    
    const finalPoints = applyDecay(rawBase, lastDate, currentConfig, mCount, nowIso);
    const decayLost = Number((rawBase - finalPoints).toFixed(1));

    // Calculate inactive weeks
    let inactiveWeeks = 0;
    if (mCount > 0 && lastDate) {
      const diffMs = new Date(nowIso).getTime() - new Date(lastDate).getTime();
      if (diffMs > 0) {
        inactiveWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      }
    }

    const wins = winsMap[userId] || 0;
    const losses = lossesMap[userId] || 0;
    const winRate = mCount > 0 ? Number(((wins / mCount) * 100).toFixed(1)) : 0;
    const setsWon = setsWonMap[userId] || 0;
    const setsLost = setsLostMap[userId] || 0;
    const gamesWon = gamesWonMap[userId] || 0;
    const gamesLost = gamesLostMap[userId] || 0;
    const earnedPts = totalEarnedPointsMap[userId] || 0;

    return {
      userId,
      name: resolveUserName(userId),
      club: resolveUserClub(userId),
      points: Number(finalPoints.toFixed(1)),
      startPoints: 100,
      earnedPoints: Number(earnedPts.toFixed(1)),
      decayPoints: decayLost > 0 ? -decayLost : 0,
      inactiveWeeks,
      matchesCount: mCount,
      wins,
      losses,
      winRate,
      setsWon,
      setsLost,
      setDiff: setsWon - setsLost,
      gamesWon,
      gamesLost,
      gameDiff: gamesWon - gamesLost,
      lastMatchDate: mCount > 0 ? formatDateDe(lastDate) : "Kein Spiel",
    };
  });

  // Sort descending by points, then winRate, then matchesCount
  calculatedPlayers.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    return a.name.localeCompare(b.name, 'de');
  });

  let exportCurrentRank = 1;
  calculatedPlayers.forEach((p, idx) => {
    let assignedRank = 1;
    if (idx === 0) {
      assignedRank = 1;
      exportCurrentRank = 1;
    } else {
      const prev = calculatedPlayers[idx - 1];
      if (Math.abs(p.points - prev.points) < 0.01) {
        assignedRank = exportCurrentRank;
      } else {
        assignedRank = idx + 1;
        exportCurrentRank = assignedRank;
      }
    }

    standingsRows.push({
      "Rang": `#${assignedRank}`,
      "Spieler Name": p.name,
      "Verein": p.club,
      "Gesamtpunkte (Aktuell)": p.points,
      "Startguthaben": p.startPoints,
      "Erspielte Matchpunkte": p.earnedPoints >= 0 ? `+${p.earnedPoints}` : `${p.earnedPoints}`,
      "Inaktivitäts-Abzug": p.decayPoints !== 0 ? `${p.decayPoints} Pkt.` : "0 Pkt.",
      "Inaktive Wochen": p.inactiveWeeks,
      "Spiele Gesamt": p.matchesCount,
      "Siege": p.wins,
      "Niederlagen": p.losses,
      "Siegquote": `${p.winRate} %`,
      "Sätze": `${p.setsWon} : ${p.setsLost} (${p.setDiff >= 0 ? `+${p.setDiff}` : p.setDiff})`,
      "Games (Spiele)": `${p.gamesWon} : ${p.gamesLost} (${p.gameDiff >= 0 ? `+${p.gameDiff}` : p.gameDiff})`,
      "Letztes Match": p.lastMatchDate
    });
  });

  // Build "Regelwerk & Parameter-Historie" Sheet
  // Filter versions for this league
  const relevantVersions = configVersionsList.filter(v => {
    if (leagueId === "all") return true;
    return !v.leagueId || v.leagueId === leagueId || v.is_base_rule;
  }).sort((a, b) => {
    const aDate = (a.effective_date || "2000-01-01").split('T')[0];
    const bDate = (b.effective_date || "2000-01-01").split('T')[0];
    return aDate.localeCompare(bDate);
  });

  const rulesSheetRows: any[] = [];
  for (let i = 0; i < relevantVersions.length; i++) {
    const cur = relevantVersions[i];
    const prev = i > 0 ? relevantVersions[i - 1] : undefined;
    const effDate = cur.effective_date ? formatDateDe(cur.effective_date) : "01.01.2000";
    
    // Count how many matches fell under this rule version
    const nextVer = i < relevantVersions.length - 1 ? relevantVersions[i + 1] : null;
    const curEffRaw = (cur.effective_date || "2000-01-01").split('T')[0];
    const nextEffRaw = nextVer ? (nextVer.effective_date || "").split('T')[0] : "9999-12-31";

    const matchesUnderThisRule = completedMatches.filter(m => {
      const mDate = (m.played_at || m.result?.played_at || m.createdAt || "").split('T')[0];
      return mDate >= curEffRaw && mDate < nextEffRaw;
    }).length;

    rulesSheetRows.push({
      "Version #": i + 1,
      "Gültig ab (Stichtag)": effDate,
      "Status / Typ": cur.is_base_rule ? "System Basis-Regelwerk" : "Stichtag-Regelwerk",
      "Basispunkte Sieg": cur.base_points_win ?? 5,
      "Basispunkte Niederlage": cur.base_points_loss ?? 5,
      "Max. Match-Bonus (B_max)": cur.max_bonus ?? 45,
      "Logistischer Faktor (k)": cur.logistic_factor ?? 0.05,
      "Inaktivitätsabzug pro Woche": `${cur.inactivity_deduction_per_week ?? 5} Pkt.`,
      "Austragene Matches unter dieser Regel": `${matchesUnderThisRule} Spiel(e)`,
      "Änderungen & Dokumentation": describeConfigChanges(cur, prev)
    });
  }

  // Build "Berechnungs-Anleitung & Formeln" Sheet
  const guideRows = [
    ["Hobbyliga Punkte- & Auswertungssystem - Mathematische Dokumentation"],
    [""],
    ["1. GRUNDPRINZIP DER PUNKTEBERECHNUNG:"],
    ["Jeder Spieler startet mit 100 Initialpunkten."],
    ["Bei jedem ausgetragenen Spiel erhalten beide Spieler eine garantierte Basis-Punktzahl für ihren Einsatz (Teilnahmepunkte)."],
    ["Der Sieger erhält zusätzlich einen leistungsabhängigen Bonus, der mit einer logistischen Funktion (Elo-Prinzip) berechnet wird."],
    [""],
    ["2. DIE FORMELN IM DETAIL:"],
    ["A) Punkte bei Sieg:"],
    ["   Neue_Punkte = Eigene_Punkte + Basispunkte_Sieg + Bonus"],
    ["   wobei: Bonus = B_max / (1 + exp(-k * (Punkte_Gegner - Eigene_Punkte)))"],
    ["   - B_max: Maximal möglicher Bonus (Standard: 45 Punkte)"],
    ["   - k: Logistische Steilheit (Standard: 0.05)"],
    ["   - Ist der Gegner stärker, steigt der Bonus in Richtung B_max."],
    ["   - Ist der Gegner schwächer, fällt der Bonus in Richtung 0."],
    [""],
    ["B) Punkte bei Niederlage:"],
    ["   Neue_Punkte = Eigene_Punkte + Basispunkte_Niederlage (Standard: +5 Punkte, kein Punktabzug bei Niederlagen)"],
    [""],
    ["C) Inaktivitäts-Abzug (Decay):"],
    ["   Wird über mehr als 1 Woche kein Spiel ausgetragen, werden pro voller inaktiver Woche Punkte abgezogen:"],
    ["   Abzug = Ganze_Wochen_Inaktiv * Inaktivitätsabzug_pro_Woche"],
    ["   (Der Punktestand kann durch Inaktivität nicht unter 0 fallen.)"],
    [""],
    ["3. STICHTAGS-REGELWERKE & HISTORISCHE NACHVOLLZIEHBARKEIT:"],
    ["Wann immer ein Administrator Parameter (z.B. Basispunkte oder k-Faktor) anpasst, wird ein neuer Stichtag festgelegt."],
    ["Alle Spiele, die vor diesem Stichtag stattfanden, behalten exakt ihre damalige historische Bewertung."],
    ["Alle Spiele ab einschließlich dem Stichtag werden mit den neuen Parametern berechnet."],
    ["Die Reiter 'Spiele & Punkte' und 'Regelwerk & Historie' dokumentieren jeden dieser Schritte lückenlos."],
    [""],
    ["Exportiert am:", formatDateTimeDe(nowIso)],
    ["Liga:", resolvedLeagueName],
    ["Liga-ID:", leagueId],
  ];

  // 2. Create Workbook and Sheets
  const wb = XLSX.utils.book_new();

  const wsStandings = XLSX.utils.json_to_sheet(standingsRows);
  const wsMatches = XLSX.utils.json_to_sheet(matchesSheetRows);
  const wsRules = XLSX.utils.json_to_sheet(rulesSheetRows);
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);

  // Set nice column widths
  wsStandings['!cols'] = [
    { wch: 8 },  // Rang
    { wch: 26 }, // Name
    { wch: 22 }, // Verein
    { wch: 22 }, // Gesamtpunkte
    { wch: 14 }, // Start
    { wch: 22 }, // Erspielte
    { wch: 20 }, // Decay
    { wch: 16 }, // Inaktive Wochen
    { wch: 14 }, // Spiele
    { wch: 10 }, // Siege
    { wch: 14 }, // Niederlagen
    { wch: 12 }, // Quote
    { wch: 18 }, // Sätze
    { wch: 22 }, // Games
    { wch: 16 }  // Letztes Match
  ];

  wsMatches['!cols'] = [
    { wch: 10 }, // Match-Nr
    { wch: 18 }, // Spieldatum
    { wch: 24 }, // Sp 1
    { wch: 18 }, // Club 1
    { wch: 22 }, // Sp 1 Vor
    { wch: 24 }, // Sp 2
    { wch: 18 }, // Club 2
    { wch: 22 }, // Sp 2 Vor
    { wch: 16 }, // Ergebnis
    { wch: 22 }, // Sieger
    { wch: 20 }, // Zuwachs Sp 1
    { wch: 20 }, // Zuwachs Sp 2
    { wch: 24 }, // Sp 1 Nach
    { wch: 24 }, // Sp 2 Nach
    { wch: 28 }, // Gültiges Regelwerk
    { wch: 28 }, // Angew Basispunkte
    { wch: 18 }, // Angew Max Bonus
    { wch: 16 }, // Angew k
    { wch: 22 }, // Erzielter Bonus
    { wch: 35 }  // Bemerkung
  ];

  wsRules['!cols'] = [
    { wch: 10 }, // Version
    { wch: 20 }, // Stichtag
    { wch: 24 }, // Typ
    { wch: 18 }, // Win
    { wch: 24 }, // Loss
    { wch: 24 }, // Max Bonus
    { wch: 22 }, // k
    { wch: 26 }, // Decay
    { wch: 34 }, // Matches
    { wch: 65 }  // Changes
  ];

  wsGuide['!cols'] = [
    { wch: 85 }
  ];

  // Append Sheets to Workbook
  XLSX.utils.book_append_sheet(wb, wsStandings, "Abschlusstabelle");
  XLSX.utils.book_append_sheet(wb, wsMatches, "Spiele & Punkte");
  XLSX.utils.book_append_sheet(wb, wsRules, "Regelwerk & Historie");
  XLSX.utils.book_append_sheet(wb, wsGuide, "Berechnungs-Anleitung");

  // 3. Trigger Download
  const safeLeagueName = resolvedLeagueName.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `Hobbyliga_${safeLeagueName}_${dateStamp}.xlsx`;

  XLSX.writeFile(wb, filename);
}
