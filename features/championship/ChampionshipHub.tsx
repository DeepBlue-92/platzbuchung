import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Clock,
  Settings,
  AlertCircle,
} from 'lucide-react';
import {
  TournamentInstance,
  TournamentTemplate,
  Match,
  MatchResult,
  ChampionshipAuditLogEntry,
} from '../../types/championship';
import {
  listenToChampionshipTemplates,
  listenToChampionshipTournaments,
  saveChampionshipTournament,
  purgeExpiredTrashTournaments,
} from '../../services/championshipService';
import { listenToRankings } from '../../services/db';
import { propagateWinnersInTournament } from '../../utils/championshipCalculator';
import { canUserEditChampionshipMatch, isChampionshipAdmin } from '../../utils/championshipPermissions';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { ChampionshipGroupView } from './ChampionshipGroupView';
import { ChampionshipMatchCard } from './ChampionshipMatchCard';
import { ChampionshipResultModal } from './ChampionshipResultModal';
import { ChampionshipAdmin } from './ChampionshipAdmin';
import { ChampionshipBentoHeader, ChampionshipPhaseKey } from './ChampionshipBentoHeader';
import { ChampionshipPrintView } from './ChampionshipPrintView';
import { ChampionshipPrintModal } from './ChampionshipPrintModal';
import { User, RankingState } from '../../types';

interface ChampionshipHubProps {
  currentUser: User | null;
  clubId: string;
  users: Record<string, User>;
  rankings?: RankingState | null;
  onNavigateToReservations: () => void;
  onNavigateToAdmin?: () => void;
  initialAdminView?: boolean;
  clubName?: string;
  logoUrl?: string;
}

export const ChampionshipHub: React.FC<ChampionshipHubProps> = ({
  currentUser,
  clubId,
  users,
  rankings,
  onNavigateToReservations,
  onNavigateToAdmin,
  initialAdminView = false,
  clubName = 'Tennis-Club',
  logoUrl,
}) => {
  const [tournaments, setTournaments] = useState<TournamentInstance[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [activePhase, setActivePhase] = useState<ChampionshipPhaseKey>(
    initialAdminView ? 'admin' : 'groups'
  );
  const [selectedParticipantFilter, setSelectedParticipantFilter] = useState<string | null>(null);

  // Fallback real-time rankings listener if not provided as prop
  const [localRankings, setLocalRankings] = useState<RankingState | null>(null);

  // Result entry modal
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);

  // Print & PDF Preview modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const isAdmin = isChampionshipAdmin(currentUser);

  // Listen to Firestore
  useEffect(() => {
    if (!clubId) return;

    const unsubTemplates = listenToChampionshipTemplates(clubId, (tpls) => {
      setTemplates(tpls);
    });

    const unsubTournaments = listenToChampionshipTournaments(clubId, (tourns) => {
      setTournaments(tourns);
      purgeExpiredTrashTournaments(clubId, tourns);

      // Default selected tournament: first tournament on the far left
      if (tourns.length > 0) {
        const active = tourns.filter((t) => t.status !== 'trash');
        if (active.length > 0) {
          setSelectedTournamentId((prev) => {
            if (prev && active.some((t) => t.id === prev)) {
              return prev;
            }
            return active[0].id;
          });
        }
      }
    });

    const unsubRankings = listenToRankings(clubId, (r) => {
      setLocalRankings(r);
    });

    return () => {
      unsubTemplates();
      unsubTournaments();
      unsubRankings();
    };
  }, [clubId]);

  const effectiveRankings = rankings || localRankings;

  const activeTournaments = useMemo(
    () => tournaments.filter((t) => t.status !== 'trash'),
    [tournaments]
  );

  // Always default to first tournament on far left
  const currentTournament = useMemo(() => {
    if (activeTournaments.length === 0) return null;
    return activeTournaments.find((t) => t.id === selectedTournamentId) || activeTournaments[0];
  }, [activeTournaments, selectedTournamentId]);

  // Sync selectedTournamentId when tournaments arrive
  useEffect(() => {
    if (activeTournaments.length > 0) {
      if (!selectedTournamentId || !activeTournaments.some((t) => t.id === selectedTournamentId)) {
        setSelectedTournamentId(activeTournaments[0].id);
      }
    }
  }, [activeTournaments, selectedTournamentId]);

  // Filter Halbfinale 1 & 2 exclusively
  const semiMatches = useMemo(() => {
    if (!currentTournament?.matches) return [];
    const matches = currentTournament.matches;

    return matches.filter((m) => {
      const stage = currentTournament.stages?.find((s) => s.id === m.stageId);
      if (m.groupId || stage?.type === 'group') return false;

      const roundLower = (m.roundLabel || '').toLowerCase();
      const stageNameLower = (stage?.name || '').toLowerCase();
      const stageRoundLower = (stage?.roundName || '').toLowerCase();

      // Exclude finals & placement matches
      if (
        roundLower.includes('finale') &&
        !roundLower.includes('halb') &&
        !roundLower.includes('hf')
      ) {
        return false;
      }
      if (roundLower.includes('platz 3') || roundLower.includes('kleines')) {
        return false;
      }

      return (
        roundLower.includes('halb') ||
        roundLower.startsWith('hf') ||
        roundLower.includes('hf ') ||
        roundLower.includes('semi') ||
        stageNameLower.includes('halb') ||
        stageRoundLower.includes('halb') ||
        (stage?.type === 'knockout' && stage?.bracketSize === 4)
      );
    }).sort((a, b) => (a.matchNumberInStage || 0) - (b.matchNumberInStage || 0));
  }, [currentTournament]);

  // Filter Großes & Kleines Finale exclusively
  const finalMatches = useMemo(() => {
    if (!currentTournament?.matches) return [];
    const matches = currentTournament.matches;

    const finals = matches.filter((m) => {
      const stage = currentTournament.stages?.find((s) => s.id === m.stageId);
      if (m.groupId || stage?.type === 'group') return false;

      const roundLower = (m.roundLabel || '').toLowerCase();
      const stageNameLower = (stage?.name || '').toLowerCase();
      const stageRoundLower = (stage?.roundName || '').toLowerCase();

      // Exclude Halbfinale
      if (
        roundLower.includes('halb') ||
        roundLower.startsWith('hf') ||
        stageNameLower.includes('halb')
      ) {
        return false;
      }

      const isGrand =
        roundLower.includes('großes finale') ||
        roundLower === 'finale' ||
        stageRoundLower === 'finale' ||
        (roundLower.includes('finale') && !roundLower.includes('klein'));

      const isSmall =
        roundLower.includes('kleines finale') ||
        roundLower.includes('platz 3') ||
        roundLower.includes('spiel um platz 3');

      const isFinalStage = stage?.type === 'finals_day' || stage?.isFinalsDay;

      return isGrand || isSmall || (isFinalStage && !roundLower.includes('halb'));
    });

    // Sort: Großes Finale first, Kleines Finale second
    return finals.sort((a, b) => {
      const aGrand =
        (a.roundLabel || '').toLowerCase().includes('großes') || a.roundLabel === 'Finale';
      const bGrand =
        (b.roundLabel || '').toLowerCase().includes('großes') || b.roundLabel === 'Finale';
      if (aGrand && !bGrand) return -1;
      if (!aGrand && bGrand) return 1;
      return (a.matchNumberInStage || 0) - (b.matchNumberInStage || 0);
    });
  }, [currentTournament]);

  // Save match result with transaction audit log
  const handleSaveResult = async (matchId: string, result: MatchResult) => {
    if (!currentTournament) return;

    const existingMatch = currentTournament.matches.find((m) => m.id === matchId);
    if (!existingMatch || !canUserEditChampionshipMatch(existingMatch, currentTournament, currentUser)) {
      return;
    }

    const formatScoreSummary = (res?: MatchResult | null) => {
      if (!res) return null;
      if (res.isWalkover) {
        if (
          !res.walkoverReason ||
          res.walkoverReason === 'Verletzung / Aufgabe' ||
          res.walkoverReason === 'Aufgabe'
        ) {
          return 'w/o (Aufgabe)';
        }
        return `w/o (${res.walkoverReason})`;
      }
      return (res.sets || [])
        .map((s) => `${s.player1Games}:${s.player2Games}`)
        .join(', ');
    };

    const isCorrection = !!existingMatch.result;
    const oldScoreSummary = formatScoreSummary(existingMatch.result);
    const newScoreSummary = formatScoreSummary(result);

    const p1Name = formatParticipantById(existingMatch.participant1Id, currentTournament.participants || [], users);
    const p2Name = formatParticipantById(existingMatch.participant2Id, currentTournament.participants || [], users);
    const winnerName = formatParticipantById(result.winnerParticipantId, currentTournament.participants || [], users);
    const resolvedUserName = currentUser?.firstName && currentUser?.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser?.name || currentUser?.username || 'Unbekannt';

    const auditEntry: ChampionshipAuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      matchId,
      userId: currentUser?.id || 'unknown',
      userName: resolvedUserName,
      userRole: isAdmin ? 'admin' : 'player',
      actorId: currentUser?.id || 'unknown',
      actorName: resolvedUserName,
      actorRole: isAdmin ? 'admin' : 'player',
      action: result.isWalkover ? 'walkover' : (isCorrection ? 'update_result' : 'create_result'),
      roundLabel: existingMatch.roundLabel || 'Begegnung',
      stageName: currentTournament.stages?.find((s) => s.id === existingMatch.stageId)?.name || '',
      participant1Name: p1Name,
      participant2Name: p2Name,
      previousResultSummary: oldScoreSummary,
      newResultSummary: newScoreSummary || 'Ergebnis erfasst',
      winnerName: winnerName || (result.isWalkover ? 'Aufgabe' : ''),
      isWalkover: result.isWalkover,
      walkoverReason: result.walkoverReason,
      details: {
        roundLabel: existingMatch.roundLabel,
        participant1Id: existingMatch.participant1Id,
        participant2Id: existingMatch.participant2Id,
        participant1Name: p1Name,
        participant2Name: p2Name,
        winnerParticipantId: result.winnerParticipantId,
        winnerName,
        oldResult: existingMatch.result || null,
        newResult: result,
        oldScoreSummary,
        newScoreSummary,
        isWalkover: result.isWalkover,
        walkoverReason: result.walkoverReason,
      },
    };

    let updatedMatches = currentTournament.matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status: (result.isWalkover ? 'walkover' : 'completed') as Match['status'],
          result,
        };
      }
      return m;
    });

    updatedMatches = propagateWinnersInTournament(updatedMatches, currentTournament.stages || []);

    const updatedTournament: TournamentInstance = {
      ...currentTournament,
      matches: updatedMatches,
      auditLog: [...(currentTournament.auditLog || []), auditEntry],
      updatedAt: new Date().toISOString(),
    };

    await saveChampionshipTournament(clubId, updatedTournament);
    setIsResultModalOpen(false);
    setModalMatch(null);
  };

  const handleOpenResultModal = (match: Match) => {
    if (!canUserEditChampionshipMatch(match, currentTournament, currentUser)) {
      return;
    }
    setModalMatch(match);
    setIsResultModalOpen(true);
  };

  const phases: Array<{ key: 'groups' | 'semis' | 'finals'; num: number; label: string; mobileLabel: string }> = [
    { key: 'groups', num: 1, label: 'Gruppenphase', mobileLabel: 'Gruppen' },
    { key: 'semis', num: 2, label: 'Halbfinale', mobileLabel: 'Halbfinale' },
    { key: 'finals', num: 3, label: 'Endrunde', mobileLabel: 'Endrunde' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-3.5 sm:gap-4 w-full">
      {/* ======================================================== */}
      {/* BENTO-CARD 1: Globaler Steuerungs-Header (Oben)          */}
      {/* ======================================================== */}
      {currentTournament && (
        <ChampionshipBentoHeader
          tournament={currentTournament}
          activeTournaments={activeTournaments}
          selectedTournamentId={selectedTournamentId}
          onSelectTournamentId={(nextId) => {
            setSelectedTournamentId(nextId);
            setSelectedParticipantFilter(null);
          }}
          activePhase={activePhase}
          isAdmin={isAdmin}
          onNavigateToAdmin={onNavigateToAdmin}
          onSelectAdmin={() => setActivePhase('admin')}
          users={users}
          clubName={clubName}
          onOpenPrintPreview={() => setIsPrintModalOpen(true)}
        />
      )}

      {/* ======================================================== */}
      {/* BENTO-CARD 2: Dynamischer Inhalts-Container (Unten)      */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 min-h-[360px] space-y-4 sm:space-y-5 print:hidden">
        {/* Phasen-Navigation (1: Gruppe, 2: HF, 3: Finale) */}
        {currentTournament && (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            {phases.map((phase) => {
              const isActive = activePhase === phase.key;
              return (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => {
                    setActivePhase(phase.key);
                    setSelectedParticipantFilter(null);
                  }}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-emerald-50/80 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-500 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {phase.num}
                  </span>
                  <span className="hidden sm:inline whitespace-nowrap">{phase.label}</span>
                  <span className="inline sm:hidden whitespace-nowrap">{phase.mobileLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activePhase === 'admin' && isAdmin ? (
            <motion.div
              key="championship-admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeInOut' }}
            >
              <ChampionshipAdmin
                tournaments={tournaments}
                templates={templates}
                clubId={clubId}
                currentUser={currentUser}
                users={users}
                onSelectTournament={(id) => {
                  setSelectedTournamentId(id);
                  setActivePhase('groups');
                }}
                activeTournamentId={selectedTournamentId}
                clubName={clubName}
              />
            </motion.div>
          ) : currentTournament ? (
            <motion.div
              key={`${currentTournament.id}_${activePhase}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeInOut' }}
            >
              {/* ---------------------------------------------------- */}
              {/* PHASE 1: GRUPPENPHASE                                */}
              {/* ---------------------------------------------------- */}
              {activePhase === 'groups' && (
                <ChampionshipGroupView
                  tournament={currentTournament}
                  selectedParticipantId={selectedParticipantFilter}
                  onSelectParticipant={(pId) => {
                    setSelectedParticipantFilter(pId);
                  }}
                  onEnterResult={handleOpenResultModal}
                  currentUser={currentUser}
                  users={users}
                  rankings={effectiveRankings}
                />
              )}

              {/* ---------------------------------------------------- */}
              {/* PHASE 2: HALBFINALE (Ausschließlich HF 1 & 2)       */}
              {/* ---------------------------------------------------- */}
              {activePhase === 'semis' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Halbfinale
                      </h3>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        Ausschließlich Halbfinale 1 & 2
                      </p>
                    </div>
                  </div>

                  {semiMatches.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Clock className="w-9 h-9 text-slate-300 mx-auto" />
                      <h4 className="font-bold text-slate-800 text-sm">
                        Noch keine Halbfinal-Partien eingeteilt
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Die Halbfinal-Paarungen (Halbfinale 1 & 2) werden nach Abschluss der vorangegangenen Gruppenphase automatisch ermittelt.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {semiMatches.map((match) => (
                        <ChampionshipMatchCard
                          key={match.id}
                          match={match}
                          tournament={currentTournament}
                          users={users}
                          currentUser={currentUser}
                          isAdmin={isAdmin}
                          onEnterResult={handleOpenResultModal}
                          rankings={effectiveRankings}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* PHASE 3: ENDRUNDE (Ausschließlich Großes & Kleines) */}
              {/* ---------------------------------------------------- */}
              {activePhase === 'finals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Endrunde
                      </h3>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        Ausschließlich Großes & Kleines Finale
                      </p>
                    </div>
                  </div>

                  {finalMatches.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Trophy className="w-9 h-9 text-slate-300 mx-auto" />
                      <h4 className="font-bold text-slate-800 text-sm">
                        Noch keine Endrunden-Partien eingeteilt
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Großes Finale (Platz 1 & 2) und Kleines Finale (Platz 3) werden nach Abschluss der Halbfinals freigeschaltet.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {finalMatches.map((match) => (
                        <ChampionshipMatchCard
                          key={match.id}
                          match={match}
                          tournament={currentTournament}
                          users={users}
                          currentUser={currentUser}
                          isAdmin={isAdmin}
                          onEnterResult={handleOpenResultModal}
                          rankings={effectiveRankings}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="championship-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeInOut' }}
              className="py-12 text-center space-y-3"
            >
              <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Aktuell keine Meisterschaft aktiv</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Die Vereinsleitung hat noch kein Turnier gestartet. Sobald die Meisterschaft eröffnet wird, findest du hier alle Spielpläne.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result Entry Modal */}
      {currentTournament && (
        <ChampionshipResultModal
          isOpen={isResultModalOpen}
          onClose={() => {
            setIsResultModalOpen(false);
            setModalMatch(null);
          }}
          match={modalMatch}
          tournament={currentTournament}
          currentUser={currentUser}
          onSaveResult={handleSaveResult}
          users={users}
        />
      )}

      {/* Print & PDF Preview Modal */}
      {currentTournament && (
        <ChampionshipPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          tournament={currentTournament}
          users={users}
          clubName={clubName}
          logoUrl={logoUrl}
          rankings={effectiveRankings}
        />
      )}

      {/* Clean DIN A4 Print & PDF View */}
      {currentTournament && (
        <ChampionshipPrintView
          tournament={currentTournament}
          users={users}
          clubName={clubName}
          logoUrl={logoUrl}
          rankings={effectiveRankings}
        />
      )}
    </div>
  );
};
