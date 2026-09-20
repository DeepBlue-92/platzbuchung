import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Table,
  GitFork,
  ListOrdered,
  Settings,
  Plus,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  TournamentInstance,
  TournamentTemplate,
  Match,
  MatchResult,
} from '../../types/championship';
import {
  listenToChampionshipTemplates,
  listenToChampionshipTournaments,
  saveChampionshipTournament,
  purgeExpiredTrashTournaments,
} from '../../services/championshipService';
import { propagateWinnersInTournament } from '../../utils/championshipCalculator';
import { ChampionshipHeroStatus } from './ChampionshipHeroStatus';
import { ChampionshipGroupView } from './ChampionshipGroupView';
import { ChampionshipBracketView } from './ChampionshipBracketView';
import { ChampionshipMatchList } from './ChampionshipMatchList';
import { ChampionshipResultModal } from './ChampionshipResultModal';
import { ChampionshipAdmin } from './ChampionshipAdmin';
import { ChampionshipTournamentJourney } from './ChampionshipTournamentJourney';
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

  // Save match result
  const handleSaveResult = async (matchId: string, result: MatchResult) => {
    if (!currentTournament) return;

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

    const updatedTournament: TournamentInstance = {
      ...currentTournament,
      matches: propagatedMatches,
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
      {/* Header & Tournament Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Vereinsmeisterschaft
              </h2>
              {currentTournament && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {currentTournament.discipline === 'singles' ? 'Einzel' : 'Doppel'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Gruppenspiele, Live-Tabellen, K.-o.-Endrunde & Vereinsmeister
            </p>
          </div>
        </div>

        {/* Tournament Switcher */}
        {activeTournaments.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Turnier:</span>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer"
            >
              {activeTournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Dynamic "Mein Status" Hero Section */}
      <ChampionshipHeroStatus
        currentUser={currentUser}
        currentTournament={currentTournament}
        onEnterResult={handleOpenResultModal}
        onBookCourt={onNavigateToReservations}
        users={users}
      />

      {/* Visual Tournament Progress Stepper ("Tournament Journey") */}
      {currentTournament && currentTournament.stages && currentTournament.stages.length > 0 && (
        <ChampionshipTournamentJourney
          stages={currentTournament.stages}
          matches={currentTournament.matches || []}
          onSelectStage={(stageId, stageType) => {
            if (stageType === 'group') {
              setActiveTab('groups');
            } else {
              setActiveTab('bracket');
            }
          }}
        />
      )}

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Gruppenphase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bracket')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bracket'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 rotate-90" />
            <span>K.-o.-Baum</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Alle Begegnungen</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateToAdmin) {
                  onNavigateToAdmin();
                } else {
                  setActiveTab('admin');
                }
              }}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Turnier-Verwaltung</span>
            </button>
          )}
        </div>
      </div>

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
                if (pId) {
                  setActiveTab('matches');
                }
              }}
              users={users}
            />
          )}

          {activeTab === 'bracket' && (
            <ChampionshipBracketView
              tournament={currentTournament}
              onMatchClick={handleOpenResultModal}
              users={users}
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
