import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, LeagueMatch } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { Trophy, Users, Shield, ChevronDown, Check, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import {
  getCanonicalClubId,
  getSanitizedClubDisplayName,
  getClubLogoUrl,
  isTechnicalClubId,
} from '../../services/clubHelper';
import { HobbyligaPlayerDrawer } from './HobbyligaPlayerDrawer';

interface ClubOption {
  canonicalId: string;
  displayName: string;
  logoUrl?: string;
}

interface HobbyligaKompaktRanglisteProps {
  filteredSortedProfiles: any[];
  currentUser: User;
  clubId?: string;
  getUserObject: (userId: string) => User | undefined | null;
  getUserRank: (userId: string) => number | undefined;
  participatingClubs?: any[];
  className?: string;
  matches?: LeagueMatch[];
  allProfiles?: any[];
  getUserName?: (userId: string) => string;
}

export const HobbyligaKompaktRangliste: React.FC<HobbyligaKompaktRanglisteProps> = ({
  filteredSortedProfiles,
  currentUser,
  clubId,
  getUserObject,
  getUserRank,
  participatingClubs = [],
  className = '',
  matches = [],
  allProfiles = [],
  getUserName,
}) => {
  // Filter states: Start unvoreingenommen auf 'all' (Gesamt) und 'all' (Alle)
  const [filterClub, setFilterClub] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isClubMenuOpen, setIsClubMenuOpen] = useState(false);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<any | null>(null);
  const clubMenuRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Dynamische Vermessung von Container- und Zeilenhöhe
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [itemHeight, setItemHeight] = useState<number>(50);

  // Swipe-Gesten Erkennung (Touch)
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Reset der aktuellen Seite auf Seite 1, sobald ein Vereins- oder Geschlechter-Filter geändert wird
  useEffect(() => {
    setCurrentPage(1);
  }, [filterClub, filterGender]);

  // Klick außerhalb oder Escape schließt das Vereins-Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clubMenuRef.current && !clubMenuRef.current.contains(event.target as Node)) {
        setIsClubMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsClubMenuOpen(false);
      }
    };
    if (isClubMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClubMenuOpen]);

  // Dynamische, deduplizierte & bereinigte Vereinsliste mit Wappen/Favicon-URLs
  const availableClubs = useMemo<ClubOption[]>(() => {
    const clubsMap = new Map<string, { displayName: string; logoUrl?: string }>();

    // 1. Primär: Offizielle Vereine aus participatingClubs (aus der clubs-Collection / System-Stammdaten)
    if (Array.isArray(participatingClubs)) {
      participatingClubs.forEach((c) => {
        const raw = c.vereinsId || c.id || c.clubName;
        if (!raw || isTechnicalClubId(raw)) return;
        const canonicalId = getCanonicalClubId(raw);
        const displayName = getSanitizedClubDisplayName(raw, participatingClubs);
        const logoUrl = c.customLogoUrl || c.logoUrl || getClubLogoUrl(raw, participatingClubs);
        if (canonicalId && displayName && !isTechnicalClubId(displayName)) {
          clubsMap.set(canonicalId, { displayName, logoUrl });
        }
      });
    }

    // 2. Sekundär: Saubere Vereins-Zuordnungen aus Profil- und Nutzerdaten
    filteredSortedProfiles.forEach((p) => {
      const u = getUserObject(p.userId);
      const candidates: string[] = [];

      if (u?.vereinsId) candidates.push(u.vereinsId);
      if (Array.isArray(u?.clubs)) {
        u.clubs.forEach((c) => {
          if (c.vereinsId) candidates.push(c.vereinsId);
          if (c.clubName) candidates.push(c.clubName);
        });
      }
      if (Array.isArray((u as any)?.clubIds)) {
        (u as any).clubIds.forEach((cId: string) => candidates.push(cId));
      }
      if (p.clubId) candidates.push(p.clubId);

      candidates.forEach((cand) => {
        if (!cand || isTechnicalClubId(cand)) return;
        const canonicalId = getCanonicalClubId(cand);
        if (!canonicalId || isTechnicalClubId(canonicalId)) return;
        if (!clubsMap.has(canonicalId)) {
          const displayName = getSanitizedClubDisplayName(cand, participatingClubs);
          const logoUrl = getClubLogoUrl(cand, participatingClubs);
          if (displayName && !isTechnicalClubId(displayName)) {
            clubsMap.set(canonicalId, { displayName, logoUrl });
          }
        }
      });
    });

    // 3. Fallback: Etablierte Vereine vorhalten mit Favicon/Wappen
    if (!clubsMap.has('sv-neuhausen')) {
      clubsMap.set('sv-neuhausen', {
        displayName: 'SV Neuhausen',
        logoUrl: getClubLogoUrl('sv-neuhausen'),
      });
    }
    if (!clubsMap.has('djk-furth')) {
      clubsMap.set('djk-furth', {
        displayName: 'DJK Furth',
        logoUrl: getClubLogoUrl('djk-furth'),
      });
    }

    // Alphabetisch nach DisplayName sortieren
    return Array.from(clubsMap.entries())
      .map(([canonicalId, data]) => ({
        canonicalId,
        displayName: data.displayName,
        logoUrl: data.logoUrl || getClubLogoUrl(canonicalId, participatingClubs),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  }, [participatingClubs, filteredSortedProfiles, getUserObject]);

  // Aktuell ausgewählter Verein
  const selectedClub = useMemo(() => {
    if (filterClub === 'all') return null;
    return availableClubs.find((c) => c.canonicalId === filterClub) || null;
  }, [availableClubs, filterClub]);

  // Gefilterte Liste anhand von Verein & Geschlecht (match-tolerant & strikt dedupliziert)
  const allFilteredProfiles = useMemo(() => {
    return filteredSortedProfiles.filter((profile) => {
      const u = getUserObject(profile.userId);

      // 1. Vereins-Filter: Match-tolerant über Canonical Club IDs
      if (filterClub !== 'all') {
        const userClubCanonicalIds = new Set<string>();

        if (u?.vereinsId) {
          const c = getCanonicalClubId(u.vereinsId);
          if (c) userClubCanonicalIds.add(c);
        }
        if (Array.isArray(u?.clubs)) {
          u.clubs.forEach((c) => {
            if (c.vereinsId) {
              const cid = getCanonicalClubId(c.vereinsId);
              if (cid) userClubCanonicalIds.add(cid);
            }
            if (c.clubName) {
              const cid = getCanonicalClubId(c.clubName);
              if (cid) userClubCanonicalIds.add(cid);
            }
          });
        }
        if (Array.isArray((u as any)?.clubIds)) {
          (u as any).clubIds.forEach((id: string) => {
            const cid = getCanonicalClubId(id);
            if (cid) userClubCanonicalIds.add(cid);
          });
        }
        if (profile.clubId) {
          const cid = getCanonicalClubId(profile.clubId);
          if (cid) userClubCanonicalIds.add(cid);
        }

        if (!userClubCanonicalIds.has(filterClub)) {
          return false;
        }
      }

      // 2. Geschlechter-Filter: Ausschließlich 3 Zustände: 'all', 'm' (Herren), 'w' (Damen)
      if (filterGender !== 'all') {
        const rawGender = (u?.gender || '').toLowerCase().trim();
        if (filterGender === 'm') {
          const isMale =
            rawGender === 'm' ||
            rawGender === 'male' ||
            rawGender === 'herren' ||
            rawGender === 'männer' ||
            rawGender === 'herr';
          if (!isMale) return false;
        } else if (filterGender === 'w') {
          const isFemale =
            rawGender === 'w' ||
            rawGender === 'female' ||
            rawGender === 'damen' ||
            rawGender === 'frauen' ||
            rawGender === 'frau';
          if (!isFemale) return false;
        }
      }

      return true;
    });
  }, [filteredSortedProfiles, filterClub, filterGender, getUserObject]);

  // Dynamische Vermessung der Container-Höhe und Zeilenhöhe via ResizeObserver
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const measure = () => {
      const h = container.clientHeight;
      if (h > 0) {
        setContainerHeight(h);
      }
      if (itemRef.current) {
        const ih = itemRef.current.offsetHeight;
        if (ih >= 36 && ih <= 90) {
          setItemHeight(ih);
        }
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === container) {
            const h = entry.contentRect.height;
            if (h > 0) {
              setContainerHeight(h);
            }
          }
        }
        if (itemRef.current) {
          const ih = itemRef.current.offsetHeight;
          if (ih >= 36 && ih <= 90) {
            setItemHeight(ih);
          }
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
  }, []);

  // Update itemHeight sobald gerenderte Zeilen verfügbar sind
  useEffect(() => {
    if (itemRef.current) {
      const ih = itemRef.current.offsetHeight;
      if (ih >= 36 && ih <= 90 && Math.abs(ih - itemHeight) > 1) {
        setItemHeight(ih);
      }
    }
  }, [allFilteredProfiles]);

  // Dynamische Berechnung der Elemente pro Seite (Auto-Page-Size)
  // Formel: Math.floor(containerHeight / itemHeight)
  const pageSize = useMemo(() => {
    if (!containerHeight || containerHeight <= 0) return 10;
    const computed = Math.floor(containerHeight / itemHeight);
    return Math.max(1, computed);
  }, [containerHeight, itemHeight]);

  // Dynamische Seitenberechnung
  const totalPages = Math.max(1, Math.ceil(allFilteredProfiles.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Clamping der aktuellen Seite
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Zurücksetzen des Scroll-Zustands bei Seitenwechsel (stets oberste Position fixiert)
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [safeCurrentPage]);

  // Auf dynamisch berechnete Anzahl pro Seite begrenzte Spielerliste
  const paginatedProfiles = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return allFilteredProfiles.slice(start, start + pageSize);
  }, [allFilteredProfiles, safeCurrentPage, pageSize]);

  // Index & Seitenzahl des aktuell angemeldeten Benutzers in der gefilterten Liste
  const currentUserRankIndex = useMemo(() => {
    if (!currentUser?.id) return -1;
    return allFilteredProfiles.findIndex((p) => p.userId === currentUser.id);
  }, [allFilteredProfiles, currentUser?.id]);

  const currentUserPage =
    currentUserRankIndex !== -1 ? Math.floor(currentUserRankIndex / pageSize) + 1 : null;

  // Touch Swipe Handlers: Sanftes horizontales Blättern ohne Blockierung des vertikalen Scrollens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Nur bei dominanter horizontaler Wischbewegung (mind. 45px und 1.4x vertikal) auslösen
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        // Wischen nach LINKS -> Nächste Seite
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
      } else {
        // Wischen nach RECHTS -> Vorherige Seite
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div
      className={`bg-[var(--bg-surface,white)] rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col h-full min-h-[380px] ${className}`}
    >
      {/* HEADER & FILTER-BAR (SHRINK-0) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Rangliste
          </h3>
          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {allFilteredProfiles.length}
          </span>
        </div>

        {/* 2 FILTER-DROPDOWNS: VEREIN (MIT FAVICON/ICON) & GESCHLECHT */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Custom Dropdown: Verein mit Favicon/Icon */}
          <div className="relative" ref={clubMenuRef}>
            <button
              type="button"
              onClick={() => setIsClubMenuOpen((prev) => !prev)}
              aria-label="Verein filtern"
              aria-haspopup="listbox"
              aria-expanded={isClubMenuOpen}
              className="text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors flex items-center gap-1.5 max-w-[150px] shadow-2xs"
            >
              {filterClub === 'all' ? (
                <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              ) : selectedClub?.logoUrl ? (
                <img
                  src={selectedClub.logoUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-contain rounded-full shrink-0 bg-white border border-slate-200/60"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Shield className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
              )}
              <span className="truncate">
                {filterClub === 'all' ? 'Gesamt' : selectedClub?.displayName}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 shrink-0 ml-0.5 transition-transform duration-150 ${
                  isClubMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isClubMenuOpen && (
              <div
                role="listbox"
                className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto subtle-scrollbar"
              >
                {/* Option: Gesamt */}
                <button
                  type="button"
                  role="option"
                  aria-selected={filterClub === 'all'}
                  onClick={() => {
                    setFilterClub('all');
                    setIsClubMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                    filterClub === 'all'
                      ? 'bg-slate-100/90 font-bold text-[var(--color-primary)]'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="truncate">Gesamt (Alle Vereine)</span>
                  </div>
                  {filterClub === 'all' && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ml-2" />
                  )}
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* Optionen: Alle Vereine mit Favicon/Wappen-Icon */}
                {availableClubs.map((club) => {
                  const isSelected = filterClub === club.canonicalId;
                  return (
                    <button
                      key={club.canonicalId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setFilterClub(club.canonicalId);
                        setIsClubMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100/90 font-bold text-[var(--color-primary)]'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                          {club.logoUrl ? (
                            <img
                              src={club.logoUrl}
                              alt=""
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Shield className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <span className="truncate">{club.displayName}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dropdown 2: Geschlecht (Ausschließlich 3 Optionen: Alle, Herren, Damen) */}
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            aria-label="Geschlecht filtern"
            className="text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors shadow-2xs font-sans font-medium"
          >
            <option value="all">Alle</option>
            <option value="m">Herren</option>
            <option value="w">Damen</option>
          </select>
        </div>
      </div>

      {/* FIXED PLAYER LIST WITH SWIPE SUPPORT (DYNAMIC AUTO-PAGE-SIZE & EQUAL SPACING) */}
      <div
        ref={listContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 min-h-0 overflow-hidden flex flex-col ${
          paginatedProfiles.length >= pageSize ? 'justify-between' : 'justify-start gap-1.5'
        } py-1 select-none touch-pan-y`}
      >
        {paginatedProfiles.length > 0 ? (
          paginatedProfiles.map((profile, idx) => {
            const isCurrentUser = profile.userId === currentUser.id;
            const rank =
              getUserRank(profile.userId) ?? (safeCurrentPage - 1) * pageSize + idx + 1;
            const userObj = getUserObject(profile.userId);

            // Größere, prägnantere Rang-Badge mit Top-3 Hervorhebung
            let rankClass = 'text-slate-600 bg-slate-100/90 border border-slate-200/80';
            if (rank === 1) {
              rankClass = 'text-amber-900 bg-amber-100/90 border border-amber-300 shadow-xs';
            } else if (rank === 2) {
              rankClass = 'text-slate-800 bg-slate-200/90 border border-slate-300 shadow-xs';
            } else if (rank === 3) {
              rankClass = 'text-orange-950 bg-orange-100/90 border border-orange-300/80 shadow-xs';
            }

            // Vereinsname für Untertitel (bereinigt & ohne technische System-Einträge)
            const rawClub = userObj?.vereinsId || profile.clubId;
            const displayClubName = rawClub
              ? getSanitizedClubDisplayName(rawClub, participatingClubs)
              : null;

            return (
              <div
                key={profile.userId}
                ref={idx === 0 ? itemRef : undefined}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlayerProfile(profile)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPlayerProfile(profile);
                  }
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer select-none shrink-0 ${
                  isCurrentUser
                    ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 shadow-xs hover:bg-[var(--color-primary)]/15 active:bg-[var(--color-primary)]/20'
                    : 'hover:bg-slate-100/70 border border-transparent hover:border-slate-200/60 active:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* LARGER RANK NUMBER */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-sm sm:text-base font-black shrink-0 tracking-tight select-none ${rankClass}`}
                  >
                    #{rank}
                  </div>

                  {/* DYNAMIC USER AVATAR (Photo -> Custom Icon -> Standard User-Outline, Keine Initialen) */}
                  <UserAvatar
                    user={userObj || { displayName: profile.userName }}
                    avatarUrl={userObj?.avatarUrl}
                    avatarIcon={userObj?.avatarIcon}
                    fallbackMode="icon"
                    size="sm"
                    className="shrink-0"
                  />

                  {/* SPIELER-DETAILS */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-sm font-bold truncate max-w-[140px] sm:max-w-[170px] ${
                          isCurrentUser ? 'text-[var(--color-primary)]' : 'text-slate-800'
                        }`}
                        title={profile.userName}
                      >
                        {profile.userName}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded-sm shrink-0">
                          Du
                        </span>
                      )}
                    </div>

                    {displayClubName && (
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[170px] sm:max-w-[200px] mt-0.5">
                        {displayClubName}
                      </span>
                    )}
                  </div>
                </div>

                {/* PUNKTE */}
                <div className="text-right shrink-0 pl-2">
                  <span className="text-sm font-black text-slate-800">
                    {profile.livePoints !== undefined
                      ? Number(profile.livePoints).toFixed(1)
                      : '0.0'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 ml-1">Pkt.</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600">Keine Spieler gefunden</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Für diese Filterkombination liegen keine Einträge vor.
            </p>
            {(filterClub !== 'all' || filterGender !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterClub('all');
                  setFilterGender('all');
                  setCurrentPage(1);
                }}
                className="mt-3 text-[11px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>

      {/* PAGINATION FOOTER (KOMPAKTE PAGINIERUNGS-LEISTE, FEST AM UNTEREN RAND MIT mt-auto) */}
      {allFilteredProfiles.length > pageSize && (
        <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0 select-none">
          {/* Quick Jump: Zu meinem Rang */}
          <div className="flex items-center">
            {currentUserPage ? (
              <button
                type="button"
                onClick={() => setCurrentPage(currentUserPage)}
                disabled={safeCurrentPage === currentUserPage}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  safeCurrentPage === currentUserPage
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-black cursor-default'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-[var(--color-primary)] border border-slate-200/80 active:scale-95'
                }`}
                title={
                  safeCurrentPage === currentUserPage
                    ? 'Du befindest dich bereits auf dieser Seite'
                    : `Springe zu Seite ${currentUserPage} (dein Rang)`
                }
              >
                <Target className="w-3.5 h-3.5 shrink-0 text-[var(--color-primary)]" />
                <span>Mein Rang</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                {allFilteredProfiles.length} Spieler
              </span>
            )}
          </div>

          {/* Navigation Controls: Zurück (<), Seitenanzeige, Weiter (>) */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              aria-label="Vorherige Seite"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed hover:border-slate-300 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg min-w-[70px] text-center shadow-2xs">
              <span className="font-black text-slate-800">{safeCurrentPage}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-slate-500">{totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              aria-label="Nächste Seite"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed hover:border-slate-300 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SLIDE-OVER DRAWER FÜR SPIELER-PROFIL & HEAD-TO-HEAD */}
      <HobbyligaPlayerDrawer
        isOpen={!!selectedPlayerProfile}
        onClose={() => setSelectedPlayerProfile(null)}
        playerProfile={selectedPlayerProfile}
        currentUser={currentUser}
        getUserObject={getUserObject}
        getUserRank={getUserRank}
        getUserName={getUserName}
        matches={matches}
        allProfiles={allProfiles}
        participatingClubs={participatingClubs}
      />
    </div>
  );
};
