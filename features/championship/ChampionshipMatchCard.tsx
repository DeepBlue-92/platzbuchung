import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  ShieldCheck,
  Flag,
  Trophy,
  Medal,
} from 'lucide-react';
import { Match, TournamentInstance, ChampionshipAuditLogEntry } from '../../types/championship';
import { User, RankingState } from '../../types';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { formatEventDate } from '../../utils/championshipScheduling';
import { canUserEditChampionshipMatch, isChampionshipAdmin } from '../../utils/championshipPermissions';
import { getParticipantRanking } from '../../utils/championshipRankings';
import { ChampionshipMatchAuditDrawer } from './ChampionshipMatchAuditDrawer';

interface ChampionshipMatchCardProps {
  match: Match;
  tournament: TournamentInstance;
  users: Record<string, User>;
  currentUser?: User | null;
  isAdmin?: boolean;
  onEnterResult?: (match: Match) => void;
  rankings?: RankingState | null;
  /**
   * Optional custom label or prefix for round (defaults to match.roundLabel or 'Spiel')
   */
  roundLabelOverride?: string;
  /**
   * Optional stage info override if not directly matched by match.stageId
   */
  stageNameOverride?: string;
}

export const ChampionshipMatchCard: React.FC<ChampionshipMatchCardProps> = ({
  match,
  tournament,
  users,
  currentUser,
  isAdmin = false,
  onEnterResult,
  rankings,
  roundLabelOverride,
  stageNameOverride,
}) => {
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState<boolean>(false);

  const effectiveIsAdmin = isAdmin || isChampionshipAdmin(currentUser);

  // Check if current user is authorized to edit / enter results for this match
  const canEdit = useMemo(() => {
    return canUserEditChampionshipMatch(match, tournament, currentUser);
  }, [match, tournament, currentUser]);

  const isCompleted = match.status === 'completed' || match.status === 'walkover' || !!match.result;
  const p1Name = formatParticipantById(match.participant1Id, tournament.participants, users);
  const p2Name = formatParticipantById(match.participant2Id, tournament.participants, users);

  const p1Rank = tournament.useRankings
    ? getParticipantRanking(match.participant1Id, tournament, rankings, users)
    : null;
  const p2Rank = tournament.useRankings
    ? getParticipantRanking(match.participant2Id, tournament, rankings, users)
    : null;

  const isP1Winner = isCompleted && match.result?.winnerParticipantId === match.participant1Id;
  const isP2Winner = isCompleted && match.result?.winnerParticipantId === match.participant2Id;

  // Dynamische Typografie nach Spielstatus (Sieger-Hervorhebung)
  const p1TextClasses = isCompleted
    ? isP1Winner
      ? 'font-semibold text-slate-900'
      : isP2Winner
      ? 'font-normal text-slate-400'
      : 'font-normal text-slate-700'
    : 'font-normal text-slate-700';

  const p2TextClasses = isCompleted
    ? isP2Winner
      ? 'font-semibold text-slate-900'
      : isP1Winner
      ? 'font-normal text-slate-400'
      : 'font-normal text-slate-700'
    : 'font-normal text-slate-700';

  const p1RankBadgeClasses = isCompleted
    ? isP1Winner
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold'
      : isP2Winner
      ? 'bg-slate-50 text-slate-400 border-slate-200/60 font-normal'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-semibold'
    : 'bg-slate-50 text-slate-600 border-slate-200/80 font-normal';

  const p2RankBadgeClasses = isCompleted
    ? isP2Winner
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold'
      : isP1Winner
      ? 'bg-slate-50 text-slate-400 border-slate-200/60 font-normal'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-semibold'
    : 'bg-slate-50 text-slate-600 border-slate-200/80 font-normal';

  const sets = match.result?.sets || [];
  const setsDisplay = sets
    .map((s) => `${s.player1Games}:${s.player2Games}`)
    .join(', ');

  const scoreDisplay = match.result?.isWalkover
    ? !match.result.walkoverReason ||
      match.result.walkoverReason === 'Verletzung / Aufgabe' ||
      match.result.walkoverReason === 'Aufgabe'
      ? 'w/o (Aufgabe)'
      : `w/o (${match.result.walkoverReason})`
    : setsDisplay || 'Sieg';

  const stage = tournament.stages?.find((s) => s.id === match.stageId);
  const isFinalsDay = stage?.type === 'finals_day' || stage?.isFinalsDay;
  const isGrandFinal = match.roundLabel?.toLowerCase().includes('großes finale') || match.roundLabel === 'Finale';
  const isThirdPlace =
    match.roundLabel?.toLowerCase().includes('platz 3') ||
    match.roundLabel?.toLowerCase().includes('kleines finale');

  const group = match.groupId ? tournament.groups?.find((g) => g.id === match.groupId) : null;
  const fallbackRound = group
    ? `${group.name}${match.matchNumberInStage ? ` - Spiel ${match.matchNumberInStage}` : ''}`
    : stage?.name || 'Partie';
  const displayRound = roundLabelOverride || match.roundLabel || stageNameOverride || fallbackRound;

  // Find audit logs specifically for this match
  const matchAuditLogs: ChampionshipAuditLogEntry[] = (tournament.auditLog || [])
    .filter((entry) => entry.matchId === match.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatAuditDateTime = (iso?: string | null) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return (
        new Intl.DateTimeFormat('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d) + ' Uhr'
      );
    } catch {
      return iso;
    }
  };

  const handleCardClick = () => {
    if (canEdit && onEnterResult) {
      onEnterResult(match);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      title={
        canEdit && onEnterResult
          ? isCompleted
            ? 'Klicken, um Ergebnis zu korrigieren'
            : 'Klicken, um Ergebnis einzutragen'
          : undefined
      }
      className={`bg-white border rounded-xl overflow-hidden transition-all shadow-xs ${
        isGrandFinal
          ? 'border-amber-300 ring-1 ring-amber-200/50'
          : isThirdPlace
          ? 'border-orange-200'
          : 'border-slate-200/90'
      } ${
        canEdit && onEnterResult
          ? 'cursor-pointer hover:border-emerald-500 hover:shadow-md'
          : 'cursor-default'
      }`}
    >
      {/* ======================================================== */}
      {/* MOBILE COMPACT ROW (< sm:)                               */}
      {/* Symmetrisches 3-Spalten-Layout mit zentriertem "vs."      */}
      {/* ======================================================== */}
      <div className="sm:hidden p-2.5 space-y-2">
        {/* Äußere Kanten: Links Phasen-Badge & Rechts Ergebnis/Aktion */}
        <div className="flex items-center justify-between gap-2">
          {/* Links: Phasen-Badge */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 truncate min-w-0">
            {isGrandFinal ? (
              <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
            ) : isThirdPlace ? (
              <Medal className="w-3 h-3 text-orange-600 shrink-0" />
            ) : null}
            <span className="truncate">{displayRound}</span>
            {(match.startTime || match.courtId) && (
              <span className="text-slate-400 shrink-0 font-normal text-[10px]">
                · {match.courtId ? `P${match.courtId.replace('court-', '')}` : ''}
                {match.startTime ? ` ${match.startTime}` : ''}
              </span>
            )}
          </div>

          {/* Rechts: Ergebnis-Badge bzw. Aktions-Button */}
          <div className="shrink-0 flex items-center gap-1">
            {isCompleted ? (
              <div className="flex items-center gap-1">
                <span className="tabular-nums font-bold text-xs px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70 whitespace-nowrap">
                  {scoreDisplay}
                </span>

                {onEnterResult && canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterResult(match);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Ergebnis korrigieren"
                    aria-label="Ergebnis korrigieren"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : onEnterResult && canEdit ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEnterResult(match);
                }}
                className="h-7 px-2.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] hover:opacity-90 text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3 h-3" />
                <span>Ergebnis</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-normal">
                Noch nicht gespielt
              </span>
            )}

            {/* Admin Audit Button on Mobile */}
            {effectiveIsAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAuditDrawerOpen(true);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                title="Audit-Protokoll dieser Partie anzeigen"
                aria-label="Audit-Protokoll anzeigen"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/80" />
              </button>
            )}
          </div>
        </div>

        {/* Mittelteil: Symmetrisches 3-Spalten-Layout mit zentriertem "vs." */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full pt-0.5">
          {/* Spieler 1: Muss zwingend rechtsbündig sein */}
          <div className="text-right pr-3 truncate">
            {tournament.useRankings && p1Rank && (
              <span className={`inline-flex items-center px-1.5 py-0.2 mr-1 rounded text-[9.5px] border align-middle shrink-0 ${p1RankBadgeClasses}`}>
                #{p1Rank}
              </span>
            )}
            <span className={`text-xs ${p1TextClasses}`} title={p1Name}>
              {p1Name}
            </span>
          </div>

          {/* Trenner ("vs."): Exakt im geometrischen Zentrum fixiert */}
          <div className="w-10 text-center text-xs font-normal text-slate-400 select-none shrink-0">
            vs.
          </div>

          {/* Spieler 2: Muss zwingend linksbündig sein */}
          <div className="text-left pl-3 truncate">
            <span className={`text-xs ${p2TextClasses}`} title={p2Name}>
              {p2Name}
            </span>
            {tournament.useRankings && p2Rank && (
              <span className={`inline-flex items-center px-1.5 py-0.2 ml-1 rounded text-[9.5px] border align-middle shrink-0 ${p2RankBadgeClasses}`}>
                #{p2Rank}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP ROW (>= sm:)                                     */}
      {/* Symmetrisches 3-Spalten-Layout mit zentriertem "vs."      */}
      {/* ======================================================== */}
      <div className="hidden sm:flex items-center justify-between p-3">
        {/* Bereich 1 (Links): Das Runden-Badge mit fixer/stabiler Breite */}
        <div className="w-36 shrink-0 flex items-center gap-1.5 min-w-0">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] tracking-tight flex items-center gap-1 truncate max-w-full" title={displayRound}>
            {isGrandFinal ? (
              <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
            ) : isThirdPlace ? (
              <Medal className="w-3 h-3 text-orange-600 shrink-0" />
            ) : null}
            <span className="truncate">{displayRound}</span>
          </span>

          {(match.startTime || match.courtId) && (
            <span
              className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
              title={`${match.courtId ? `Platz ${match.courtId.replace('court-', '')}` : ''}${match.courtId && match.startTime ? ' · ' : ''}${match.startTime ? `${match.startTime} Uhr` : ''}`}
            >
              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {match.courtId ? `P${match.courtId.replace('court-', '')}` : ''}
                {match.startTime ? ` ${match.startTime}` : ''}
              </span>
            </span>
          )}
        </div>

        {/* Bereich 2 (Mitte): Nimmt den gesamten restlichen Platz ein als 3-Spalten-Grid */}
        <div className="flex-1 mx-4 min-w-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
            {/* Spieler 1: Muss zwingend rechtsbündig sein */}
            <div className="text-right pr-3 truncate">
              {tournament.useRankings && p1Rank && (
                <span className={`inline-flex items-center px-1.5 py-0.2 mr-1.5 rounded text-[10px] border align-middle shrink-0 ${p1RankBadgeClasses}`}>
                  #{p1Rank}
                </span>
              )}
              <span className={`text-sm ${p1TextClasses}`} title={p1Name}>
                {p1Name}
              </span>
            </div>

            {/* "vs.": Muss eine feste Breite haben und exakt zentriert sein */}
            <div className="w-10 text-center text-xs font-normal text-slate-400 select-none shrink-0">
              vs.
            </div>

            {/* Spieler 2: Muss zwingend linksbündig sein */}
            <div className="text-left pl-3 truncate">
              <span className={`text-sm ${p2TextClasses}`} title={p2Name}>
                {p2Name}
              </span>
              {tournament.useRankings && p2Rank && (
                <span className={`inline-flex items-center px-1.5 py-0.2 ml-1.5 rounded text-[10px] border align-middle shrink-0 ${p2RankBadgeClasses}`}>
                  #{p2Rank}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bereich 3 (Rechts): Ergebnis-Badge bzw. Aktions-Button rechtsbündig fixiert */}
        <div className="w-48 flex items-center justify-end gap-1.5 shrink-0">
          {isCompleted ? (
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70 whitespace-nowrap">
                {scoreDisplay}
              </span>

              {onEnterResult && canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterResult(match);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ergebnis korrigieren"
                  aria-label="Ergebnis korrigieren"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : onEnterResult && canEdit ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnterResult(match);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-primary)] hover:opacity-90 text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ergebnis eintragen</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-normal whitespace-nowrap">
              Noch nicht gespielt
            </span>
          )}

          {/* Admin Audit Button - dezentes Icon ohne Text */}
          {effectiveIsAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAuditDrawerOpen(true);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-transparent hover:border-emerald-200/60 shrink-0"
              title="Audit-Protokoll dieser Partie anzeigen"
              aria-label="Audit-Protokoll anzeigen"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600/80" />
            </button>
          )}
        </div>
      </div>

      {/* Admin Audit Log Drawer (Slide-Over like ChampionshipResultModal) */}
      {effectiveIsAdmin && (
        <ChampionshipMatchAuditDrawer
          isOpen={isAuditDrawerOpen}
          onClose={() => setIsAuditDrawerOpen(false)}
          match={match}
          tournament={tournament}
          auditLogs={matchAuditLogs}
          users={users}
        />
      )}
    </div>
  );
};
