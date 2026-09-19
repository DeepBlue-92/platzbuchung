import React from 'react';
import { User, LeaguePartnerSearch } from '../../types';
import { resolveClubName } from '../../services/clubHelper';
import { resolvePlayerDisplayName } from '../../utils/playerHelper';

interface SpielpartnerBoerseProps {
  currentUser: User;
  partnerSearches: LeaguePartnerSearch[];
  currentUserSearch: LeaguePartnerSearch | undefined;
  getUserObject: (userId: string) => User | undefined;
  getUserRank: (userId: string) => number | null | undefined;
  getUserPoints?: (userId: string) => number | undefined;
  currentUserPoints?: number;
  onOpenModal: (searchToEdit: LeaguePartnerSearch | null) => void;
  onRenew: (userId: string) => void;
  onDelete: (userId: string) => void;
  onChallenge?: (targetUserId: string, targetUserName?: string) => void;
}

export const SpielpartnerBoerse: React.FC<SpielpartnerBoerseProps> = ({
  currentUser,
  partnerSearches,
  currentUserSearch,
  getUserObject,
  getUserRank,
  getUserPoints,
  currentUserPoints,
  onOpenModal,
  onRenew,
  onDelete,
  onChallenge
}) => {
  function getDaysRemaining(expiresAt?: string): number {
    if (!expiresAt) return 99;
    const expiry = new Date(expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
              <i className="fa-solid fa-bullhorn text-base"></i>
            </span>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Spielpartner-Börse
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Signalisiere deine Verfügbarkeit für Hobbyliga-Einzelspiele und fordere Gegner heraus!
          </p>
        </div>
        <div>
          {currentUserSearch ? (
            <button
              onClick={() => onOpenModal(currentUserSearch)}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-pen-to-square text-slate-300"></i> Meine Anzeige verwalten
            </button>
          ) : (
            <button
              onClick={() => onOpenModal(null)}
              className="w-full sm:w-auto px-3.5 py-2 bg-[var(--color-primary)] hover:bg-opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Spielanzeige aufgeben
            </button>
          )}
        </div>
      </div>

      {/* Renewal Banner if expiring soon */}
      {currentUserSearch && getDaysRemaining(currentUserSearch.expiresAt) <= 3 && new Date(currentUserSearch.expiresAt).getFullYear() <= 2050 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <i className="fa-solid fa-clock text-amber-600"></i>
            <span>
              Deine Anzeige läuft {getDaysRemaining(currentUserSearch.expiresAt) <= 0 ? "heute" : "in " + getDaysRemaining(currentUserSearch.expiresAt) + " Tagen"} ab!
            </span>
          </div>
          <button
            onClick={() => onRenew(currentUser.id)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-lg transition shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <i className="fa-solid fa-rotate"></i> 14 Tage verlängern
          </button>
        </div>
      )}

      {/* Grid of Partner Search Cards */}
      {partnerSearches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {partnerSearches.map((search) => {
            const targetUser = getUserObject(search.userId);
            const isOwner =
              currentUser.id === search.userId ||
              currentUser.id === search.id ||
              (currentUser.name && search.userId && currentUser.name.toLowerCase() === search.userId.toLowerCase()) ||
              (currentUser.name && search.userName && currentUser.name.toLowerCase() === search.userName.toLowerCase()) ||
              (targetUser && (targetUser.id === currentUser.id || (targetUser.name && currentUser.name && targetUser.name.toLowerCase() === currentUser.name.toLowerCase())));

            const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super-admin' || !!currentUser.hauptAdmin;
            const canDelete = isOwner || isAdmin;
            const userRank = getUserRank(search.userId);
            const userPoints = isOwner
              ? (currentUserPoints ?? getUserPoints?.(currentUser.id) ?? getUserPoints?.(search.userId))
              : getUserPoints?.(search.userId);
            const daysLeft = getDaysRemaining(search.expiresAt);
            const displayName = resolvePlayerDisplayName(targetUser, search.userName || search.userId);
            const rawClubId = targetUser ? targetUser.vereinsId : search.clubId;
            const displayClub = search.clubName || resolveClubName(rawClubId);

            return (
              <div
                key={search.id || search.userId}
                className={"group bg-[var(--bg-surface,white)] rounded-2xl border " + (isOwner ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : "border-slate-200 hover:border-slate-300") + " p-3.5 sm:p-4 shadow-2xs hover:shadow-xs flex flex-col justify-between transition-all space-y-2.5 relative"}
              >
                <div>
                  {/* Header: User Avatar, Name, Rank & Points, Club */}
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        <i className="fa-solid fa-user text-slate-400 text-xs"></i>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                          {displayName}
                          {isOwner && (
                            <span className="ml-1.5 text-[9px] bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-1.5 py-0.5 rounded font-black">
                              DU
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <i className="fa-solid fa-building-columns text-[9px] text-slate-400"></i>
                          <span className="truncate">{displayClub}</span>
                        </div>
                      </div>
                    </div>
                    {/* Rank & Points Badge */}
                    {(() => {
                      const hasPoints = typeof userPoints === 'number' && userPoints > 0.0;
                      const hasRank = typeof userRank === 'number' && userRank > 0;

                      if (hasPoints && hasRank) {
                        return (
                          <span className="px-2 py-0.5 bg-[var(--color-primary)]/10 text-slate-800 text-[11px] font-black rounded-lg border border-[var(--color-primary)]/20 shrink-0 flex items-center">
                            <span className="text-slate-600 font-semibold">{userPoints.toFixed(1)} Pkt.</span>
                            <span className="mx-1 text-slate-300 font-normal">•</span>
                            <span>Rang {userRank}</span>
                          </span>
                        );
                      } else if (hasPoints) {
                        return (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg shrink-0 flex items-center">
                            <span className="text-slate-600 font-semibold">{userPoints.toFixed(1)} Pkt.</span>
                            <span className="mx-1 text-slate-300 font-normal">•</span>
                            <span className="text-slate-500 font-medium text-[10px]">Unplatziert</span>
                          </span>
                        );
                      } else {
                        return (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg shrink-0">
                            Unplatziert
                          </span>
                        );
                      }
                    })()}
                  </div>

                  {/* Availability Info (compact padding & tight spacing) */}
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2 text-slate-700 text-xs font-medium leading-relaxed italic">
                    "{search.availabilityText}"
                  </div>

                  {/* Complete Contact Details (E-Mail & Phone) */}
                  {(() => {
                    if (!targetUser) return null;
                    
                    const hasEmail = !!(targetUser.email && !targetUser.email.endsWith('.system.local') && !targetUser.is_placeholder_email);
                    const hasPhone = !!targetUser.phone;
                    const isGlobalAllowed = targetUser.showContactInfo !== false;
                    
                    const showMail = hasEmail && search.showContactInfo && isGlobalAllowed;
                    const showPhone = hasPhone && search.showContactInfo && isGlobalAllowed;

                    if (!showMail && !showPhone) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        {showMail && (
                          <a
                            href={`mailto:${targetUser.email}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/60 text-[11px] font-semibold transition-colors max-w-full truncate group/mail"
                            title={`E-Mail senden an ${displayName}: ${targetUser.email}`}
                          >
                            <i className="fa-solid fa-envelope text-blue-500 shrink-0 text-[10px]" />
                            <span className="truncate">{targetUser.email}</span>
                          </a>
                        )}
                        {showPhone && (
                          <a
                            href={`tel:${targetUser.phone!.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-[11px] font-semibold transition-colors group/tel"
                            title={`Anrufen: ${targetUser.phone}`}
                          >
                            <i className="fa-solid fa-phone text-emerald-500 shrink-0 text-[10px]" />
                            <span>{targetUser.phone}</span>
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer: Actions for Owner & Admin only (Dauer wird hier nicht öffentlich angezeigt, sondern nur beim Bearbeiten im Modal) */}
                {(isOwner || canDelete) && (
                  <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-1.5">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => onOpenModal(search)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity duration-150"
                        title="Anzeige bearbeiten"
                      >
                        <i className="fa-solid fa-pen-to-square text-slate-500"></i>
                        <span className="hidden md:inline">Bearbeiten</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(search.id || search.userId)}
                        className="p-1 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-transparent hover:border-red-200 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity duration-150"
                        title={isAdmin && !isOwner ? "Als Admin Anzeige löschen" : "Anzeige löschen"}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                        <span className="hidden md:inline">Löschen</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 text-xl">
            <i className="fa-regular fa-comment-dots"></i>
          </div>
          <h4 className="font-bold text-slate-700 text-sm">Noch keine Spielpartner-Anzeigen online</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Sei der Erste, der eine Anzeige schaltet und signalisiere deine Verfügbarkeit für das nächste Match.
          </p>
          <button
            onClick={() => onOpenModal(null)}
            className="px-4 py-2 bg-[var(--color-primary)] text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm inline-flex items-center gap-2 hover:bg-opacity-90"
          >
            <i className="fa-solid fa-plus"></i> Anzeige aufgeben
          </button>
        </div>
      )}
    </div>
  );
};
