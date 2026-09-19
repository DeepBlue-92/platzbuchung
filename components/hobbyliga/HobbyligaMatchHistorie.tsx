import React from 'react';
import { LeagueMatch, User } from '../../types';
import { LeaguePointConfig } from '../../services/leagueEngine';
import { isMatchProvisional, getProvisionalRemainingText, canUserEditOrCancelResult } from '../../utils/leagueMatchHelper';

interface HobbyligaMatchHistorieProps {
  currentUser: User;
  userCompletedMatches: LeagueMatch[];
  effectiveConfig: LeaguePointConfig;
  getUserName: (userId: string) => string;
  onEditMatch?: (match: LeagueMatch) => void;
  onCancelMatch?: (match: LeagueMatch) => void;
}

export const HobbyligaMatchHistorie: React.FC<HobbyligaMatchHistorieProps> = ({
  currentUser,
  userCompletedMatches,
  effectiveConfig,
  getUserName,
  onEditMatch,
  onCancelMatch,
}) => {
  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-list-check text-[var(--color-primary)]" />
          Match-Historie & Formel-Aufschlüsselung
        </h3>
        <span className="text-xs text-slate-400 font-semibold">
          {userCompletedMatches.length} {userCompletedMatches.length === 1 ? 'Match' : 'Matches'} gewertet
        </span>
      </div>
      {userCompletedMatches.length > 0 ? (
        <div className="divide-y divide-slate-100 -mx-5 -mb-5">
          {userCompletedMatches.map((m) => {
            const isAdminCorrection = m.entryType === 'ADMIN_CORRECTION' || m.isManualAdjustment;

            if (isAdminCorrection) {
              const delta = typeof m.pointsDelta === 'number'
                ? m.pointsDelta
                : m.pointsAwarded
                ? (m.player1UserId === currentUser.id ? m.pointsAwarded.player1 : m.pointsAwarded.player2)
                : (m.manualPointsValue !== undefined ? m.manualPointsValue : 0);
              
              const newTotal = m.newTotalPoints ?? m.manualPointsValue;
              const reasonText = m.reason || m.manualAdjustmentReason || "Manuelle Anpassung durch Super-Admin";
              const adminLabel = m.adminName || (m.adminUserId ? `Admin (${m.adminUserId})` : "Super-Admin");
              const dateFormatted = new Date(m.played_at || m.reportedAt || m.createdAt || m.updatedAt).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={m.id}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/30 hover:bg-indigo-50/60 transition border-l-4 border-indigo-500"
                >
                  {/* Left: Admin Correction Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 bg-indigo-100 text-indigo-700 border border-indigo-200">
                      <i className="fa-solid fa-sliders text-xs" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          Manuelle Punkte-Korrektur
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                          ADMIN_CORRECTION
                        </span>
                        {m.correctionType && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700">
                            {m.correctionType === 'absolute' ? 'Absoluter Wert' : 'Relative Anpassung'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-800 font-semibold bg-white/80 px-2 py-0.5 rounded border border-indigo-100">
                          Grund: {reasonText}
                        </span>
                        <span>&bull;</span>
                        <span className="text-slate-500">Admin: <strong className="text-slate-700">{adminLabel}</strong></span>
                        <span>&bull;</span>
                        <span className="text-slate-400">{dateFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Point change and new total */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="bg-white rounded-xl p-2.5 md:p-3 border border-indigo-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs md:self-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Veränderung:</span>
                        <span
                          className={`font-mono text-sm font-black ${
                            delta > 0
                              ? 'text-emerald-700'
                              : delta < 0
                              ? 'text-rose-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} Pkt.
                        </span>
                      </div>
                      {newTotal !== undefined && (
                        <>
                          <span className="text-slate-300 font-bold">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-semibold">Neuer Punktestand:</span>
                            <span className="font-mono text-sm font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {Number(newTotal).toFixed(1)} Pkt.
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const isP1 = m.player1UserId === currentUser.id;
            const opponentUserId = isP1 ? m.player2UserId : m.player1UserId;
            const opponentName = getUserName(opponentUserId);
            const isWinner = m.result?.winnerId === currentUser.id;
            const delta = m.pointsAwarded
              ? isP1
                ? m.pointsAwarded.player1
                : m.pointsAwarded.player2
              : 0;
            const setsFormatted = m.result?.sets
              ? m.result.sets.map((s) => `${s.p1}:${s.p2}`).join(', ')
              : '6:4, 6:3';
            const basePart = effectiveConfig.participationPoints;
            const bonusPart = isWinner ? Math.max(0, delta - basePart) : 0;

            const isProvisional = isMatchProvisional(m);
            const provText = isProvisional ? getProvisionalRemainingText(m) : "";
            const editAuth = canUserEditOrCancelResult(m, currentUser.id, currentUser.role);

            return (
              <div
                key={m.id}
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
              >
                {/* Left: Opponent & Outcome */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isWinner
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {isWinner ? (
                      <i className="fa-solid fa-crown text-amber-500 text-xs" />
                    ) : (
                      <i className="fa-solid fa-user text-slate-400 text-xs" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm truncate">
                        vs. {opponentName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isWinner
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isWinner ? 'Sieg' : 'Niederlage'}
                      </span>
                      {isProvisional && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300/80 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <i className="fa-solid fa-clock text-[9px]" />
                          {provText || 'Vorläufig (24h)'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Sätze: <strong className="text-slate-700 font-semibold">{setsFormatted}</strong></span>
                      <span>&bull;</span>
                      <span>{new Date(m.played_at || m.result?.reportedAt || m.updatedAt || m.createdAt).toLocaleDateString('de-DE')}</span>
                      {m.lastModifiedBy && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-700 font-semibold italic text-[11px]">bearbeitet</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Transparent Formula Breakdown & Edit/Cancel Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="bg-slate-50 rounded-xl p-2.5 md:p-3 border border-slate-200/80 flex flex-wrap items-center gap-2.5 text-xs md:self-center">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-medium">Basis:</span>
                      <span className="font-mono font-bold text-slate-700">+{basePart.toFixed(1)}</span>
                    </div>
                    <span className="text-slate-300 font-bold">+</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-medium">Bonus:</span>
                      <span className="font-mono font-bold text-slate-700">
                        +{bonusPart.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-slate-300 font-bold">=</span>
                    <div className="flex items-center gap-1 font-bold">
                      <span className="text-slate-500">Gesamt:</span>
                      <span
                        className={`font-mono text-sm font-black ${
                          delta >= 0 ? 'text-[var(--color-primary)]' : 'text-slate-700'
                        }`}
                      >
                        {delta >= 0 ? '+' : ''}
                        {delta.toFixed(1)} Pkt.
                      </span>
                    </div>
                  </div>

                  {editAuth.canEdit && (
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        onClick={() => onEditMatch && onEditMatch(m)}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Ergebnis bearbeiten"
                      >
                        <i className="fa-solid fa-pen text-[10px]" />
                        <span className="hidden sm:inline">Korrektur</span>
                      </button>
                      <button
                        onClick={() => onCancelMatch && onCancelMatch(m)}
                        className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Ergebnis stornieren (setzt Match zurück)"
                      >
                        <i className="fa-solid fa-rotate-left text-[10px]" />
                        <span className="hidden sm:inline">Stornieren</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
          <p className="text-xs text-slate-500 font-medium">
            Noch keine gewerteten Matches. Sobald dein erstes Ergebnis eingetragen ist, wird hier die exakte Punkteberechnung aufgeschlüsselt.
          </p>
        </div>
      )}
    </div>
  );
};

