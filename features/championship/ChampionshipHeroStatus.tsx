import React from 'react';
import { Trophy, Calendar, CheckCircle2, AlertCircle, ArrowRight, Clock, Award } from 'lucide-react';
import { TournamentInstance, Match, Participant } from '../../types/championship';
import { User } from '../../types';

interface ChampionshipHeroStatusProps {
  currentUser: User | null;
  currentTournament: TournamentInstance | null;
  onEnterResult: (match: Match) => void;
  onBookCourt: () => void;
  users: Record<string, User>;
}

export const ChampionshipHeroStatus: React.FC<ChampionshipHeroStatusProps> = ({
  currentUser,
  currentTournament,
  onEnterResult,
  onBookCourt,
  users,
}) => {
  if (!currentUser || !currentTournament) {
    return null;
  }

  // Find if current user is a participant in this tournament
  const myParticipant = currentTournament.participants.find((p) =>
    p.playerIds.includes(currentUser.id) || p.playerIds.includes(currentUser.name)
  );

  const getPlayerDisplayName = (playerId: string): string => {
    const u = users[playerId.toLowerCase().replace(/\s/g, '')] || users[playerId];
    if (u) {
      const first = u.firstName || '';
      const last = u.lastName || '';
      if (first && last) return `${first} ${last}`;
      return u.name || playerId;
    }
    return playerId;
  };

  const formatParticipant = (pId: string | null): string => {
    if (!pId) return 'Noch offen (TBD)';
    const p = currentTournament.participants.find((x) => x.id === pId);
    if (!p) return pId;
    return p.playerIds.map(getPlayerDisplayName).join(' / ');
  };

  // Find next pending match for this participant
  const myMatches = myParticipant
    ? currentTournament.matches.filter(
        (m) =>
          (m.participant1Id === myParticipant.id || m.participant2Id === myParticipant.id)
      )
    : [];

  const pendingMatches = myMatches.filter(
    (m) => m.status === 'scheduled' || m.status === 'in_progress'
  );

  const nextMatch = pendingMatches[0] || null;
  const completedMatches = myMatches.filter(
    (m) => m.status === 'completed' || m.status === 'walkover'
  );

  const winsCount = completedMatches.filter(
    (m) => m.result?.winnerParticipantId === myParticipant?.id
  ).length;

  const currentStage = nextMatch
    ? currentTournament.stages.find((s) => s.id === nextMatch.stageId)
    : null;

  const stageDeadline = currentStage
    ? currentTournament.stageDeadlines?.[currentStage.id]
    : null;

  const isFinalsDay = currentStage?.type === 'finals_day' || currentStage?.isFinalsDay;
  const deadlineMode = (currentStage && currentTournament.stageDeadlineTypes?.[currentStage.id]) ||
    currentStage?.deadlineType ||
    (isFinalsDay ? 'date' : 'deadline');
  const isFixedDate = deadlineMode === 'date';

  const opponentId = nextMatch
    ? nextMatch.participant1Id === myParticipant?.id
      ? nextMatch.participant2Id
      : nextMatch.participant1Id
    : null;

  const opponentName = formatParticipant(opponentId);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/60 p-4 sm:p-6 text-white shadow-lg relative overflow-hidden mb-6">
      {/* Decorative background tennis element */}
      <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
      <div className="absolute right-6 top-6 text-white/5 pointer-events-none">
        <Trophy className="w-24 h-24" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              Mein Meisterschafts-Status
            </span>
            {myParticipant && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold">
                {winsCount} {winsCount === 1 ? 'Sieg' : 'Siege'} in {completedMatches.length} {completedMatches.length === 1 ? 'Spiel' : 'Spielen'}
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {myParticipant ? (
              nextMatch ? (
                <>
                  Nächste Partie: <span className="text-emerald-400">{opponentName}</span>
                </>
              ) : (
                'Alle bisherigen Partien abgeschlossen!'
              )
            ) : (
              'Du nimmst an diesem Turnier als Beobachter teil'
            )}
          </h3>

          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            {myParticipant ? (
              nextMatch ? (
                <>
                  Phase: <strong className="text-white">{currentStage?.name || nextMatch.roundLabel}</strong>
                  {stageDeadline && (
                    <>
                      {' '}· {isFixedDate ? (isFinalsDay ? 'Finaltag' : 'Spieltag') : 'Zu spielen bis'}:{' '}
                      <span className="text-amber-300 font-bold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 inline" />
                        {new Date(stageDeadline).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </>
                  )}
                </>
              ) : (
                'Aktuell stehen keine offenen Matches aus. Beobachte den Turnierbaum und die Gruppenstände.'
              )
            ) : (
              'Als Vereinsmitglied kannst du alle Begegnungen, Zwischenstände und K.-o.-Bäume in Echtzeit verfolgen.'
            )}
          </p>
        </div>

        {/* Quick actions for participant */}
        {myParticipant && nextMatch && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 pt-2 md:pt-0">
            <button
              type="button"
              onClick={() => onEnterResult(nextMatch)}
              className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Ergebnis eintragen</span>
            </button>

            <button
              type="button"
              onClick={onBookCourt}
              className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
              title="Zur Platzreservierung wechseln"
            >
              <Calendar className="w-4 h-4 text-white/80" />
              <span>Platz buchen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
