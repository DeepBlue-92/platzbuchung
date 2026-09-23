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
import { User } from '../../types';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { formatEventDate } from '../../utils/championshipScheduling';
import { canUserEditChampionshipMatch, isChampionshipAdmin } from '../../utils/championshipPermissions';
import { ChampionshipMatchAuditDrawer } from './ChampionshipMatchAuditDrawer';

interface ChampionshipMatchCardProps {
  match: Match;
  tournament: TournamentInstance;
  users: Record<string, User>;
  currentUser?: User | null;
  isAdmin?: boolean;
  onEnterResult?: (match: Match) => void;
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
  roundLabelOverride,
  stageNameOverride,
}) => {
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState<boolean>(false);

  const effectiveIsAdmin = isAdmin || isChampionshipAdmin(currentUser);

  // Check if current user is authorized to edit / enter results for this match
  const canEdit = useMemo(() => {
    return canUserEditChampionshipMatch(match, tournament, currentUser);
  }, [match, tournament, currentUser]);

  const isCompleted = match.status === 'completed' || match.status === 'walkover';
  const p1Name = formatParticipantById(match.participant1Id, tournament.participants, users);
  const p2Name = formatParticipantById(match.participant2Id, tournament.participants, users);

  const isP1Winner = match.result?.winnerParticipantId === match.participant1Id;
  const isP2Winner = match.result?.winnerParticipantId === match.participant2Id;

  const sets = match.result?.sets || [];
  const setsDisplay = sets
    .map((s) => (s.isChampionsTiebreak ? `${s.player1Games}:${s.player2Games} (MTB)` : `${s.player1Games}:${s.player2Games}`))
    .join(', ');

  const stage = tournament.stages?.find((s) => s.id === match.stageId);
  const isFinalsDay = stage?.type === 'finals_day' || stage?.isFinalsDay;
  const isGrandFinal = match.roundLabel?.toLowerCase().includes('großes finale') || match.roundLabel === 'Finale';
  const isThirdPlace =
    match.roundLabel?.toLowerCase().includes('platz 3') ||
    match.roundLabel?.toLowerCase().includes('kleines finale');

  const displayRound = roundLabelOverride || match.roundLabel || stageNameOverride || stage?.name || 'Partie';

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

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition-all shadow-xs ${
        isGrandFinal
          ? 'border-amber-300 ring-1 ring-amber-200/50'
          : isThirdPlace
          ? 'border-orange-200'
          : isCompleted
          ? 'border-slate-200/90 hover:border-slate-300'
          : 'border-slate-200/90 hover:border-emerald-300'
      }`}
    >
      {/* ======================================================== */}
      {/* MOBILE COMPACT ROW (< sm:)                               */}
      {/* Super-compact card: 3-4 matches visible at once          */}
      {/* ======================================================== */}
      <div className="sm:hidden p-2.5 flex items-center justify-between gap-2.5">
        {/* Links: Runden-Vorzeile + Spieler 1 vs. Spieler 2 */}
        <div className="min-w-0 flex-1">
          {/* Vorzeile: Runden-Badge dezent über den Namen */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 truncate mb-1">
            {isGrandFinal ? (
              <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
            ) : isThirdPlace ? (
              <Medal className="w-3 h-3 text-orange-600 shrink-0" />
            ) : null}
            <span className="truncate">{displayRound}</span>
            {(match.startTime || match.courtId) && (
              <span className="text-slate-400 shrink-0 font-normal">
                · {match.courtId ? `Platz ${match.courtId.replace('court-', '')}` : ''}
                {match.startTime ? ` ${match.startTime} Uhr` : ''}
              </span>
            )}
          </div>

          {/* Spieler 1 & Spieler 2 (untereinander, 13-14px) */}
          <div className="space-y-0.5 min-w-0">
            <div
              className={`truncate text-[13px] leading-tight ${
                isP1Winner
                  ? 'font-black text-emerald-950'
                  : 'font-semibold text-slate-800'
              }`}
            >
              {p1Name}
            </div>
            <div
              className={`truncate text-[13px] leading-tight ${
                isP2Winner
                  ? 'font-black text-emerald-950'
                  : 'font-semibold text-slate-800'
              }`}
            >
              {p2Name}
            </div>
          </div>
        </div>

        {/* Rechts: Eingetragenes Ergebnis ODER kompakter Button "Ergebnis" (h-8) */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isCompleted ? (
            <div className="flex items-center gap-1">
              <span className="tabular-nums font-bold text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70 whitespace-nowrap">
                {match.result?.isWalkover
                  ? !match.result.walkoverReason ||
                    match.result.walkoverReason === 'Verletzung / Aufgabe' ||
                    match.result.walkoverReason === 'Aufgabe'
                    ? 'w/o (Aufgabe)'
                    : `w/o (${match.result.walkoverReason})`
                  : setsDisplay || 'Sieg'}
              </span>

              {onEnterResult && canEdit && (
                <button
                  type="button"
                  onClick={() => onEnterResult(match)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ergebnis korrigieren"
                  aria-label="Ergebnis korrigieren"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            onEnterResult && canEdit ? (
              <button
                type="button"
                onClick={() => onEnterResult(match)}
                className="h-8 px-2.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] hover:opacity-90 text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ergebnis</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium px-1">
                Offen
              </span>
            )
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
              <ShieldCheck className="w-4 h-4 text-emerald-600/80" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP ROW (>= sm:) - 100% UNCHANGED                     */}
      {/* ======================================================== */}
      <div className="hidden sm:flex p-2.5 sm:p-3 sm:items-center justify-between gap-4">
        {/* Left: Round & Scheduled Tag directly followed by Matchup without huge void */}
        <div className="flex sm:items-center gap-3.5 min-w-0 flex-1">
          {/* Round Tag */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] tracking-tight flex items-center gap-1 shrink-0">
              {isGrandFinal ? (
                <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
              ) : isThirdPlace ? (
                <Medal className="w-3 h-3 text-orange-600 shrink-0" />
              ) : null}
              <span>{displayRound}</span>
            </span>

            {/* Finals Day or Scheduled Time Tag */}
            {(match.startTime || match.courtId) && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-slate-400" />
                {match.courtId ? `Platz ${match.courtId.replace('court-', '')}` : ''}
                {match.courtId && match.startTime ? ' · ' : ''}
                {match.startTime ? `${match.startTime} Uhr` : ''}
              </span>
            )}
          </div>

          {/* Matchup (Player 1 vs Player 2) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`truncate text-sm ${
                isP1Winner
                  ? 'font-black text-emerald-950'
                  : 'font-semibold text-slate-800'
              }`}
            >
              {p1Name}
            </span>

            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
              vs.
            </span>

            <span
              className={`truncate text-sm ${
                isP2Winner
                  ? 'font-black text-emerald-950'
                  : 'font-semibold text-slate-800'
              }`}
            >
              {p2Name}
            </span>
          </div>
        </div>

        {/* Right: Score / Actions (Desktop wide row) */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* Score display (if completed) or status text */}
          {isCompleted ? (
            <span className="tabular-nums font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70 whitespace-nowrap">
              {match.result?.isWalkover
                ? !match.result.walkoverReason ||
                  match.result.walkoverReason === 'Verletzung / Aufgabe' ||
                  match.result.walkoverReason === 'Aufgabe'
                  ? 'w/o (Aufgabe)'
                  : `w/o (${match.result.walkoverReason})`
                : setsDisplay || 'Sieg'}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-transparent hover:border-emerald-200/60"
              title="Audit-Protokoll dieser Partie anzeigen"
              aria-label="Audit-Protokoll anzeigen"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600/80" />
            </button>
          )}

          {/* Enter Result / Korrigieren Button - nur für Superadmin/Admins oder beteiligte Spieler in der aktuellen Turnierphase */}
          {onEnterResult && canEdit && (
            isCompleted ? (
              <button
                type="button"
                onClick={() => onEnterResult(match)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Korrigieren</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onEnterResult(match)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:opacity-90 text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ergebnis eintragen</span>
              </button>
            )
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
