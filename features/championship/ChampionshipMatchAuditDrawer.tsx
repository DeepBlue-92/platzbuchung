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
        {/* Drawer Header matching ChampionshipResultModal exactly */}
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
            {/* Match Overview Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Partie
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2 bg-white rounded-lg border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Spieler 1
                  </span>
                  <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                    {p1Name}
                  </strong>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Spieler 2
                  </span>
                  <strong className="text-xs font-bold text-slate-900 block truncate mt-0.5">
                    {p2Name}
                  </strong>
                </div>
              </div>

              {match.result && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Aktuelles Ergebnis:</span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200/70">
                    {match.result.isWalkover
                      ? 'w/o (Aufgabe)'
                      : match.result.sets?.map((s) => `${s.player1Games}:${s.player2Games}`).join(', ') || 'Erfasst'}
                  </span>
                </div>
              )}
            </div>

            {/* Audit Log Entries List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Änderungsverlauf
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {auditLogs.length} {auditLogs.length === 1 ? 'Eintrag' : 'Einträge'}
                </span>
              </div>

              {auditLogs.length > 0 ? (
                <div className="space-y-3">
                  {auditLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      {/* Meta: Who and When */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                            <UserIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-tight">
                              {entry.userName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {entry.userRole === 'admin' || entry.userRole === 'superadmin' ? 'Administrator' : 'Mitglied'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatAuditDateTime(entry.timestamp)}</span>
                        </div>
                      </div>

                      {/* Action & Result Changed */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          <span className="font-semibold text-slate-600">
                            {entry.action === 'walkover'
                              ? 'w/o (Aufgabe) eingetragen:'
                              : entry.action === 'update_result'
                              ? 'Ergebnis korrigiert:'
                              : 'Ergebnis eingetragen:'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.previousResultSummary && entry.action === 'update_result' && (
                            <>
                              <span className="line-through text-slate-400 font-mono text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {entry.previousResultSummary}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            </>
                          )}
                          <span className="font-mono font-bold text-xs text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/80">
                            {entry.newResultSummary || 'Ergebnis erfasst'}
                          </span>
                          {entry.winnerName && (
                            <span className="text-[11px] text-slate-500">
                              (Sieger: <strong className="text-slate-800">{entry.winnerName}</strong>)
                            </span>
                          )}
                        </div>

                        {entry.isWalkover && entry.walkoverReason && (
                          <div className="text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70 font-medium mt-1">
                            Grund: {entry.walkoverReason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : match.result?.enteredByUserName || match.result?.enteredAt ? (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-xs text-slate-900">
                        {match.result.enteredByUserName || 'Benutzer'}
                      </span>
                    </div>
                    {match.result.enteredAt && (
                      <span className="text-[11px] text-slate-400">
                        {formatAuditDateTime(match.result.enteredAt)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    Ergebnis erfasst:{' '}
                    <strong className="font-mono text-slate-900">
                      {match.result.isWalkover
                        ? 'w/o (Aufgabe)'
                        : match.result.sets?.map((s) => `${s.player1Games}:${s.player2Games}`).join(', ')}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200/80 text-slate-500 text-xs flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-slate-400" />
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
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
