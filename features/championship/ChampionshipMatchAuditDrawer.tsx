import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Clock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';
import { Match, TournamentInstance, ChampionshipAuditLogEntry } from '../../types/championship';
import { formatParticipantById } from '../../utils/championshipNameResolver';
import { User } from '../../types';

interface ChampionshipMatchAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  tournament: TournamentInstance;
  auditLogs: ChampionshipAuditLogEntry[];
  users: Record<string, User>;
}

export const ChampionshipMatchAuditDrawer: React.FC<ChampionshipMatchAuditDrawerProps> = ({
  isOpen,
  onClose,
  match,
  tournament,
  auditLogs,
  users,
}) => {
  const [isAnimatingIn, setIsAnimatingIn] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      const timer = setTimeout(() => setIsAnimatingIn(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsAnimatingIn(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 220);
  };

  if (!isOpen || !match) {
    return null;
  }

  const p1Name = formatParticipantById(match.participant1Id, tournament?.participants || [], users);
  const p2Name = formatParticipantById(match.participant2Id, tournament?.participants || [], users);

  const formatAuditDateTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      return (
        d.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        }) +
        ' Uhr'
      );
    } catch {
      return timestamp;
    }
  };

  const resolveEntryUser = (entry: ChampionshipAuditLogEntry) => {
    if (entry.userName) return entry.userName;
    if (entry.actorName) return entry.actorName;
    if (entry.userId && users[entry.userId]) {
      const u = users[entry.userId];
      return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name || 'Benutzer';
    }
    return 'Benutzer';
  };

  const resolveEntryRole = (entry: ChampionshipAuditLogEntry) => {
    const role = entry.userRole || entry.actorRole;
    return role === 'admin' || role === 'superadmin' ? 'Administrator' : 'Mitglied';
  };

  const resolveScoreSummary = (entry: ChampionshipAuditLogEntry): string | null => {
    if (entry.newResultSummary && entry.newResultSummary !== 'Ergebnis erfasst') {
      return entry.newResultSummary;
    }
    if (entry.details?.newScoreSummary && entry.details.newScoreSummary !== 'Ergebnis erfasst') {
      return entry.details.newScoreSummary;
    }
    if (entry.details?.newResult?.sets && Array.isArray(entry.details.newResult.sets) && entry.details.newResult.sets.length > 0) {
      return entry.details.newResult.sets
        .map((s: any) => `${s.player1Games}:${s.player2Games}`)
        .join(', ');
    }
    if (match?.result?.sets && match.result.sets.length > 0) {
      return match.result.sets
        .map((s: any) => `${s.player1Games}:${s.player2Games}`)
        .join(', ');
    }
    return entry.newResultSummary || null;
  };

  const resolvePreviousScoreSummary = (entry: ChampionshipAuditLogEntry): string | null => {
    if (entry.previousResultSummary) {
      return entry.previousResultSummary;
    }
    if (entry.details?.oldScoreSummary) {
      return entry.details.oldScoreSummary;
    }
    if (entry.details?.oldResult?.sets && Array.isArray(entry.details.oldResult.sets) && entry.details.oldResult.sets.length > 0) {
      return entry.details.oldResult.sets
        .map((s: any) => `${s.player1Games}:${s.player2Games}`)
        .join(', ');
    }
    return null;
  };

  const drawerContent = (
    <div
      className="fixed inset-0 z-[99999] top-0 left-0 right-0 bottom-0 m-0 p-0 flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
      onClick={handleClose}
      style={{
        opacity: !isAnimatingIn || isClosing ? 0 : 1,
        transitionDuration: isClosing ? '200ms' : '250ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isClosing ? 'none' : 'auto',
      }}
    >
      <div
        className="w-full sm:w-[480px] max-w-[100vw] h-full h-screen top-0 bottom-0 m-0 bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform:
            !isAnimatingIn || isClosing
              ? 'translateX(100%)'
              : 'translateX(0)',
          transitionDuration: isClosing ? '200ms' : '250ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header matching ChampionshipResultModal */}
        <div className="bg-[var(--color-primary)] p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden top-0">
          {/* Background Tennis Ball Relief Watermark */}
          <div className="absolute -bottom-8 -right-4 text-white opacity-[0.08] z-0 pointer-events-none transform -rotate-12">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[130px] h-[130px]"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
              <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
            </svg>
          </div>

          <div className="relative z-10 min-w-0 pr-4">
            <div className="text-[11px] uppercase font-black tracking-widest text-white/80 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-white/90" />
              <span className="truncate">{tournament.title}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white mt-1">
              Audit-Protokoll
            </h2>
            <p className="text-xs text-white/80 font-medium mt-0.5 truncate">
              {match.roundLabel || 'Begegnung'} · {p1Name} vs. {p2Name}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="relative z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Match Overview Box (clean, un-nested flat view) */}
            <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Partie
                </span>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {p1Name} <span className="text-slate-400 font-normal mx-1">vs.</span> {p2Name}
                </div>
              </div>

              {match.result && (
                <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Aktuelles Ergebnis
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {match.result.isWalkover
                      ? 'w/o (Aufgabe)'
                      : match.result.sets?.map((s) => `${s.player1Games}:${s.player2Games}`).join(', ') || 'Erfasst'}
                  </span>
                </div>
              )}
            </div>

            {/* Audit Log Entries Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Änderungsverlauf
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {auditLogs.length > 0
                    ? `${auditLogs.length} ${auditLogs.length === 1 ? 'Eintrag' : 'Einträge'}`
                    : match.result
                    ? '1 Eintrag'
                    : '0 Einträge'}
                </span>
              </div>

              {auditLogs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((entry, idx) => {
                    const userName = resolveEntryUser(entry);
                    const roleName = resolveEntryRole(entry);
                    const score = resolveScoreSummary(entry);
                    const prevScore = resolvePreviousScoreSummary(entry);
                    const isEdit =
                      entry.action === 'update_result' ||
                      entry.action === 'edit_result' ||
                      Boolean(prevScore && prevScore !== score);
                    const isWalkover = Boolean(
                      entry.isWalkover ||
                      entry.action === 'walkover' ||
                      entry.details?.isWalkover
                    );
                    const walkoverReason =
                      entry.walkoverReason || entry.details?.walkoverReason;

                    return (
                      <div
                        key={entry.id || idx}
                        className="py-3.5 first:pt-2 last:pb-2 space-y-1.5"
                      >
                        {/* Meta: Who and When */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                              <UserIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex items-baseline gap-1.5 truncate">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {userName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                · {roleName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium shrink-0">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <span>{formatAuditDateTime(entry.timestamp)}</span>
                          </div>
                        </div>

                        {/* Action & Result Content (border-free, clean badge / inline typography) */}
                        <div className="pl-8 text-xs text-slate-600">
                          {isWalkover ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-500">w/o (Aufgabe) eingetragen:</span>
                              <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {entry.winnerName ? `Sieger: ${entry.winnerName}` : 'Aufgabe'}
                              </span>
                            </div>
                          ) : isEdit ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-500">Geändert:</span>
                              {prevScore && (
                                <>
                                  <span className="line-through text-slate-400 font-mono text-xs">
                                    {prevScore}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-0.5" />
                                </>
                              )}
                              <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {score || 'Ergebnis erfasst'}
                              </span>
                              {entry.winnerName && (
                                <span className="text-[11px] text-slate-400">
                                  (Sieger: <strong className="text-slate-700 font-medium">{entry.winnerName}</strong>)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-500">Ergebnis erfasst:</span>
                              <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {score || 'Ergebnis erfasst'}
                              </span>
                              {entry.winnerName && (
                                <span className="text-[11px] text-slate-400">
                                  (Sieger: <strong className="text-slate-700 font-medium">{entry.winnerName}</strong>)
                                </span>
                              )}
                            </div>
                          )}

                          {isWalkover && walkoverReason && (
                            <div className="text-[11px] text-amber-800 mt-1">
                              Grund: {walkoverReason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : match.result ? (
                <div className="divide-y divide-slate-100">
                  <div className="py-3.5 first:pt-2 last:pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <UserIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-baseline gap-1.5 truncate">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {match.result.enteredByUserName || 'Benutzer'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            · Erfasser
                          </span>
                        </div>
                      </div>

                      {match.result.enteredAt && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium shrink-0">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span>{formatAuditDateTime(match.result.enteredAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="pl-8 text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500">Ergebnis erfasst:</span>
                      <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {match.result.isWalkover
                          ? 'w/o (Aufgabe)'
                          : match.result.sets?.map((s) => `${s.player1Games}:${s.player2Games}`).join(', ') || 'Erfasst'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-slate-300" />
                  <span>Für diese Partie liegen noch keine Audit-Einträge vor.</span>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};
