import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  ListOrdered,
  Settings,
  Plus,
  Calendar,
  AlertCircle,
  FileText,
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
import { propagateWinnersInTournament } from '../../utils/championshipCalculator';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { determineActiveChampionshipTab } from '../../utils/championshipScheduling';
import { ChampionshipGroupView } from './ChampionshipGroupView';
import { ChampionshipBracketView } from './ChampionshipBracketView';
import { ChampionshipMatchList } from './ChampionshipMatchList';
import { ChampionshipResultModal } from './ChampionshipResultModal';
import { ChampionshipAdmin } from './ChampionshipAdmin';
import { ChampionshipBentoHeader } from './ChampionshipBentoHeader';
import { ChampionshipAuditLogView } from './ChampionshipAuditLogView';
import { User, Role } from '../../types';

interface ChampionshipHubProps {
  currentUser: User | null;
  clubId: string;
  users: Record<string, User>;
  onNavigateToReservations: () => void;
  onNavigateToAdmin?: () => void;
  initialAdminView?: boolean;
}

export const ChampionshipHub: React.FC<ChampionshipHubProps> = ({
  currentUser,
  clubId,
  users,
  onNavigateToReservations,
  onNavigateToAdmin,
  initialAdminView = false,
}) => {
  const [tournaments, setTournaments] = useState<TournamentInstance[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'groups' | 'bracket' | 'matches' | 'admin'>(
    initialAdminView ? 'admin' : 'groups'
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedParticipantFilter, setSelectedParticipantFilter] = useState<string | null>(null);

  // Result entry modal
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);

  const isAdmin =
    currentUser?.role === Role.ADMIN ||
    currentUser?.role === ('superadmin' as any) ||
    currentUser?.role === ('super-admin' as any);

  // Listen to Firestore
  useEffect(() => {
    if (!clubId) return;

    const unsubTemplates = listenToChampionshipTemplates(clubId, (tpls) => {
      setTemplates(tpls);
    });

    const unsubTournaments = listenToChampionshipTournaments(clubId, (tourns) => {
      setTournaments(tourns);
      // Auto-purge trash older than 30 days
      purgeExpiredTrashTournaments(clubId, tourns);

      // Default selected tournament to first active
      if (tourns.length > 0) {
        setSelectedTournamentId((prev) => {
          if (prev && tourns.some((t) => t.id === prev && t.status !== 'trash')) {
            return prev;
          }
          const active = tourns.find((t) => t.status !== 'trash');
          return active?.id || tourns[0].id;
        });
      }
    });

    return () => {
      unsubTemplates();
      unsubTournaments();
    };
  }, [clubId]);

  const activeTournaments = tournaments.filter((t) => t.status !== 'trash');
  const currentTournament =
    activeTournaments.find((t) => t.id === selectedTournamentId) ||
    activeTournaments[0] ||
    null;

  // Automatically switch to the active tournament phase based on maintained dates/deadlines
  const prevEvaluatedTournamentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTournament || initialAdminView) return;

    if (prevEvaluatedTournamentIdRef.current !== currentTournament.id) {
      prevEvaluatedTournamentIdRef.current = currentTournament.id;
      const activePhase = determineActiveChampionshipTab(currentTournament);
      setActiveTab((prev) => {
        // Do not kick out of admin or audit-log if administrator is managing
        if (prev === 'admin' || prev === 'audit-log') return prev;
        return activePhase;
      });
    }
  }, [currentTournament?.id, currentTournament?.stageDeadlines, initialAdminView]);

  // Save match result with transaction audit log
  const handleSaveResult = async (matchId: string, result: MatchResult) => {
    if (!currentTournament) return;

    const existingMatch = currentTournament.matches.find((m) => m.id === matchId);

    // Format scores for readable transaction history
    const formatScoreSummary = (res?: MatchResult | null) => {
      if (!res) return null;
      if (res.isWalkover) {
        if (!res.walkoverReason || res.walkoverReason === 'Verletzung / Aufgabe' || res.walkoverReason === 'Aufgabe') {
          return 'w/o (Aufgabe)';
        }
        return `w/o (${res.walkoverReason})`;
      }
      if (!res.sets || res.sets.length === 0) return 'Ergebnis erfasst';
      return res.sets
        .map((s) => {
          if (s.isChampionsTiebreak) {
            return `${s.player1Games}:${s.player2Games} (MTB)`;
          }
          return `${s.player1Games}:${s.player2Games}`;
        })
        .join(', ');
    };

    const previousResultSummary = formatScoreSummary(existingMatch?.result);
    const newResultSummary = formatScoreSummary(result) || 'Ergebnis erfasst';

    const stage = currentTournament.stages.find((s) => s.id === existingMatch?.stageId);
    const stageName = stage?.name || existingMatch?.roundLabel || 'Begegnung';

    const p1Name = formatParticipantById(
      existingMatch?.participant1Id,
      currentTournament.participants,
      users
    );
    const p2Name = formatParticipantById(
      existingMatch?.participant2Id,
      currentTournament.participants,
      users
    );
    const wName = formatParticipantById(
      result.winnerParticipantId,
      currentTournament.participants,
      users
    );

    const submitterName =
      (currentUser?.firstName && currentUser?.lastName
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser?.name) ||
      result.enteredByUserName ||
      'Benutzer';

    const actionType: ChampionshipAuditLogEntry['action'] = result.isWalkover
      ? 'walkover'
      : existingMatch?.result
      ? 'update_result'
      : 'create_result';

    const newAuditEntry: ChampionshipAuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || result.enteredByUserId || 'unknown',
      userName: submitterName,
      userRole: (currentUser?.role as string) || 'user',
      action: actionType,
      matchId,
      roundLabel: existingMatch?.roundLabel || 'Begegnung',
      stageName,
      participant1Name: p1Name,
      participant2Name: p2Name,
      previousResultSummary,
      newResultSummary,
      winnerName: wName,
      isWalkover: !!result.isWalkover,
      walkoverReason: result.walkoverReason,
    };

    const updatedMatches = currentTournament.matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          result,
          status: result.isWalkover ? ('walkover' as const) : ('completed' as const),
        };
      }
      return m;
    });

    // Auto propagate winners into downstream KO rounds
    const propagatedMatches = propagateWinnersInTournament(
      updatedMatches,
      currentTournament.stages
    );

    const updatedAuditLog = [newAuditEntry, ...(currentTournament.auditLog || [])];

    const updatedTournament: TournamentInstance = {
      ...currentTournament,
      matches: propagatedMatches,
      auditLog: updatedAuditLog,
      updatedAt: new Date().toISOString(),
    };

    await saveChampionshipTournament(clubId, updatedTournament);
  };

  const handleOpenResultModal = (match: Match) => {
    setModalMatch(match);
    setIsResultModalOpen(true);
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Unified Hero Bento Header (Title, Tournament Progress, and Integrated Navigation) */}
      {currentTournament && (
        <ChampionshipBentoHeader
          tournament={currentTournament}
          activeTournaments={activeTournaments}
          selectedTournamentId={selectedTournamentId}
          onSelectTournamentId={(nextId) => {
            setSelectedTournamentId(nextId);
            const nextTourn = activeTournaments.find((t) => t.id === nextId);
            if (nextTourn && activeTab !== 'admin') {
              setActiveTab(determineActiveChampionshipTab(nextTourn));
            }
          }}
          isAdmin={isAdmin}
          onNavigateToAdmin={onNavigateToAdmin}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setSelectedStageId(null);
          }}
          selectedStageId={
            selectedStageId ||
            (activeTab === 'groups'
              ? currentTournament.stages?.find((s) => s.type === 'group')?.id
              : currentTournament.stages?.find(
                  (s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay
                )?.id)
          }
          onSelectStage={(stageId, stageType) => {
            setSelectedStageId(stageId);
            if (stageType === 'group') {
              setActiveTab('groups');
            } else {
              setActiveTab('bracket');
            }
          }}
        />
      )}

      {/* Main Tab Content */}
      {activeTab === 'admin' && isAdmin ? (
        <ChampionshipAdmin
          tournaments={tournaments}
          templates={templates}
          clubId={clubId}
          currentUser={currentUser}
          users={users}
          onSelectTournament={(id) => {
            setSelectedTournamentId(id);
            setActiveTab('groups');
          }}
          activeTournamentId={selectedTournamentId}
        />
      ) : currentTournament ? (
        <div>
          {activeTab === 'groups' && (
            <ChampionshipGroupView
              tournament={currentTournament}
              selectedParticipantId={selectedParticipantFilter}
              onSelectParticipant={(pId) => {
                setSelectedParticipantFilter(pId);
              }}
              onEnterResult={handleOpenResultModal}
              currentUser={currentUser}
              users={users}
            />
          )}

          {activeTab === 'bracket' && (
            <ChampionshipBracketView
              tournament={currentTournament}
              onMatchClick={handleOpenResultModal}
              users={users}
              currentUser={currentUser}
              isAdmin={isAdmin}
              selectedStageId={selectedStageId}
            />
          )}

          {activeTab === 'matches' && (
            <ChampionshipMatchList
              tournament={currentTournament}
              currentUser={currentUser}
              onEnterResult={handleOpenResultModal}
              filterParticipantId={selectedParticipantFilter}
              onClearParticipantFilter={() => setSelectedParticipantFilter(null)}
              users={users}
            />
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center space-y-3">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">Aktuell keine Meisterschaft aktiv</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Die Vereinsleitung hat noch kein Turnier gestartet. Sobald die Meisterschaft eröffnet wird, findest du hier alle Spielpläne.
          </p>
        </div>
      )}

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
    </div>
  );
};
