import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Person, LeaguePartnerSearch, LeagueMatch, Booking, UserClub } from '../types';
import {
  saveLeaguePartnerSearch,
  renewLeaguePartnerSearch,
  deleteLeaguePartnerSearch,
  cancelLeagueMatchResult,
} from '../services/league';
import { applyDecay } from '../services/leagueEngine';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PlayerContactModal } from './PlayerContactModal';
import { PointsHistoryModal } from './PointsHistoryModal';
import { CreateAdModal } from './hobbyliga/CreateAdModal';
import { LeagueResultDrawer } from './LeagueResultDrawer';
import { PointsRankChart } from './PointsRankChart';
import { LeaguePointsDetail } from './LeaguePointsDetail';
import {
  HobbyligaBanner,
  BannerClubItem,
  DEFAULT_BANNER_CREST_1,
  DEFAULT_BANNER_CREST_2,
  DEFAULT_BANNER_CREST_3,
} from './hobbyliga/HobbyligaBanner';
import { SpielpartnerBoerse } from './hobbyliga/SpielpartnerBoerse';
import { HobbyligaMiniKalender } from './hobbyliga/HobbyligaMiniKalender';
import { HobbyligaBookingDrawer } from './hobbyliga/HobbyligaBookingDrawer';
import { HobbyligaKompaktRangliste } from './hobbyliga/HobbyligaKompaktRangliste';
import { formatRelativeDate } from '../utils/date';
import { isMatchExpired } from '../utils/leagueMatchHelper';
import { HobbyligaWillkommen } from './hobbyliga/HobbyligaWillkommen';
import { HobbyligaNaechstesSpiel } from './hobbyliga/HobbyligaNaechstesSpiel';
import { HobbyligaLetztesErgebnis } from './hobbyliga/HobbyligaLetztesErgebnis';
import { HobbyligaCombinedMatchFeed } from './hobbyliga/HobbyligaCombinedMatchFeed';
import { HobbyligaMatchHistorie } from './hobbyliga/HobbyligaMatchHistorie';
import { ClubSettings, listenToClubs } from '../services/db';
import { useLeagueData, defaultLeagueConfig } from '../hooks/useLeagueData';
import {
  resolvePlayerDisplayName,
  isPlayerEligibleForLeague,
  calculateLeaguePlayerLivePoints,
} from '../utils/playerHelper';

interface Props {
  currentUser: User;
  clubId: string;
  users: Record<string, User>;
  settings?: ClubSettings;
  bookings?: Booking[];
  userClubs?: UserClub[];
  onSwitchClub?: (clubId: string) => void;
  allClubs?: any[];
  onBook?: (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    players: string[],
    hasBallMachine: boolean,
    guestCount: number,
    editingId?: string,
    comment?: string
  ) => Promise<string | null>;
}

export function LeagueDashboard({ currentUser, clubId, users, settings, bookings = [], userClubs, onSwitchClub, allClubs, onBook }: Props) {
  const {
    profile,
    allProfiles,
    matches,
    allClubMatches,
    partnerSearches,
    activeConfig,
    loading,
    hasOptedIn,
    activeLeagues,
    activeLeagueId,
    setActiveLeagueId,
    refreshPartnerSearches,
    handleJoinLeague,
    setPartnerSearches,
  } = useLeagueData(currentUser, clubId, settings);

  // Systemweite Vereine für dynamische Wappenanzeige im Banner
  const [systemClubs, setSystemClubs] = useState<any[]>(() => {
    if (allClubs && allClubs.length > 0) return allClubs;
    try {
      const cached = localStorage.getItem('v2_clubs_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (allClubs && allClubs.length > 0) {
      setSystemClubs(allClubs);
      return;
    }
    const unsub = listenToClubs((clubs) => {
      if (clubs && clubs.length > 0) {
        setSystemClubs(clubs);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [allClubs]);

  // Hilfsfunktion: Strikte Prüfung, ob das Liga-Modul für einen Verein in den Systemeinstellungen aktiv ist
  const isClubLigaActive = (c: any): boolean => {
    if (!c) return false;
    if (c.aktiv === false || c.geloescht === true) return false;
    const rawId = String(c.vereinsId || c.id || '').toLowerCase().trim();
    if (rawId === 'super-admin' || rawId === 'system') return false;

    const modules = c.modules || {};
    // 1. Wenn Modul Liga explizit deaktiviert ist, strikt ausschließen
    if (
      modules.liga === false ||
      modules.league === false ||
      c.isLigaActive === false ||
      c.enableLeague === false
    ) {
      return false;
    }

    // 2. Aktiv-Kriterien prüfen
    const isActive =
      modules.liga === true ||
      modules.league === true ||
      c.isLigaActive === true ||
      c.enableLeague === true ||
      c.leagueSettings?.enabled === true;

    return isActive === true;
  };

  // Berechnung aller teilnehmenden Vereine mit aktivierter Hobbyliga (participatingClubs)
  const participatingClubs = useMemo<BannerClubItem[]>(() => {
    const clubsMap = new Map<string, any>();

    const getCanonicalClubKey = (raw?: string): string => {
      if (!raw) return '';
      const clean = raw.toLowerCase().trim();
      if (clean.includes('neuhausen')) return 'sv-neuhausen';
      if (clean.includes('furth')) return 'djk-furth';
      if (clean.includes('sportsgeist')) return 'tcsportsgeist';
      return clean.replace(/[^a-z0-9]/g, '');
    };

    // 1. Vereine aus systemClubs hinzufügen, NUR WENN das Liga-Modul aktiv ist
    (systemClubs || []).forEach((c) => {
      if (!isClubLigaActive(c)) {
        return;
      }
      const canonicalKey = getCanonicalClubKey(c.vereinsId || c.id || c.clubName);
      if (canonicalKey) {
        clubsMap.set(canonicalKey, c);
      }
    });

    // 2. Aktuelle Club-Einstellungen prüfen & mergen (oder entfernen, falls Liga deaktiviert)
    const currentCanonicalKey = getCanonicalClubKey(clubId || settings?.clubName || 'sv-neuhausen');
    if (settings && currentCanonicalKey) {
      const currentIsActive = isClubLigaActive({
        ...settings,
        vereinsId: clubId || currentCanonicalKey,
      });
      if (!currentIsActive) {
        clubsMap.delete(currentCanonicalKey);
      } else {
        const existing = clubsMap.get(currentCanonicalKey);
        clubsMap.set(currentCanonicalKey, {
          ...(existing || {}),
          vereinsId: clubId || currentCanonicalKey,
          clubName: settings.clubName || existing?.clubName || clubId,
          customLogoUrl: settings.customLogoUrl || existing?.customLogoUrl,
          logoUrl: settings.logoUrl || existing?.logoUrl,
          modules: settings.modules || existing?.modules,
          aktiv: true,
        });
      }
    }

    // 3. Fallback: Falls systemClubs noch gar nicht geladen wurde (leere Map),
    // stellen wir nur sicher, dass die dauerhaft aktiven Vereine (SV Neuhausen, DJK Furth) vorhanden sind.
    // Vereine mit deaktiviertem Liga-Modul (wie TC Sportsgeist) werden hier NIEMALS hinzugefügt.
    if (clubsMap.size === 0) {
      clubsMap.set('sv-neuhausen', {
        vereinsId: 'sv-neuhausen',
        clubName: 'SV Neuhausen',
        customLogoUrl: DEFAULT_BANNER_CREST_1,
        modules: { league: true, liga: true },
        aktiv: true,
      });
      clubsMap.set('djk-furth', {
        vereinsId: 'djk-furth',
        clubName: 'DJK Furth',
        customLogoUrl: DEFAULT_BANNER_CREST_2,
        modules: { league: true, liga: true },
        aktiv: true,
      });
    }

    // 4. Strikte Filterung: Nur Vereine behalten, deren Liga-Modul aktiv ist
    const filteredClubs = Array.from(clubsMap.values()).filter((c) => isClubLigaActive(c));

    // Sortierung: Bekannte Reihenfolge oder alphabetisch
    const knownLeagueOrder = ['sv-neuhausen', 'djk-furth'];
    const sortedList = filteredClubs.sort((a, b) => {
      const idA = getCanonicalClubKey(a.vereinsId || a.id || a.clubName);
      const idB = getCanonicalClubKey(b.vereinsId || b.id || b.clubName);
      const idxA = knownLeagueOrder.indexOf(idA);
      const idxB = knownLeagueOrder.indexOf(idB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.clubName || '').localeCompare(b.clubName || '');
    });

    return sortedList.map((c, idx) => {
      const canonicalKey = getCanonicalClubKey(c.vereinsId || c.id || c.clubName);
      const isNeuhausen = canonicalKey === 'sv-neuhausen';
      const isFurth = canonicalKey === 'djk-furth';
      const isSportsgeist = canonicalKey === 'tcsportsgeist';

      // Benutzer-Anforderung:
      // "verwende im banner das logo vom anmelde und ladebildschirm des jeweiligen vereins und nichts das aus der kopfzeiel"
      // -> customLogoUrl || logoUrl (NIEMALS customHeaderLogoUrl oder headerLogoUrl)
      let logo = c.customLogoUrl || c.logoUrl;
      let fallbackSrc: string | undefined = undefined;
      let scale = 1;

      if (isNeuhausen) {
        if (!logo || logo.includes('wappen_svn.png') || logo.includes('Wappen-1920w')) {
          logo = DEFAULT_BANNER_CREST_1;
        }
        fallbackSrc = '/images/wappen_svn_login.png';
      } else if (isFurth) {
        if (!logo) {
          logo = DEFAULT_BANNER_CREST_2;
        }
        fallbackSrc = '/images/wappen_djk_furth_login.png';
      } else if (isSportsgeist) {
        if (!logo || logo.includes('DEFAULT_SETTINGS')) {
          logo = DEFAULT_BANNER_CREST_3;
        }
        fallbackSrc = '/images/wappen_tc_sportsgeist_login.png';
        if (logo && (logo.includes('rAaAABXRUJQ') || logo.length < 11000)) {
          scale = 1.08;
        }
      }

      return {
        id: c.vereinsId || c.id || `club-${idx}`,
        name: c.clubName || c.vereinsName || c.vereinsId || 'Verein',
        logoUrl: logo,
        fallbackSrc,
        alt: `${c.clubName || c.vereinsId || 'Verein'} Wappen`,
        variant: (isNeuhausen ? 1 : isFurth ? 2 : 3) as 1 | 2 | 3,
        scale,
      };
    });
  }, [systemClubs, settings, clubId]);

  const leagueBannerClubs = participatingClubs;

  // Detail view state for points system
  const [showPointsDetail, setShowPointsDetail] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      return hash.includes('punkte-system') || hash.includes('rules') || hash.includes('punkte-details');
    }
    return false;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('punkte-system') || hash.includes('rules') || hash.includes('punkte-details')) {
        setShowPointsDetail(true);
      } else if (hash.includes('league') || hash === '' || hash === '#/') {
        setShowPointsDetail(false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Modal states
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isResultDrawerOpen, setIsResultDrawerOpen] = useState(false);
  const [selectedMatchForEdit, setSelectedMatchForEdit] = useState<LeagueMatch | null>(null);
  const [selectedMatchForEntry, setSelectedMatchForEntry] = useState<LeagueMatch | null>(null);
  const [searchToEdit, setSearchToEdit] = useState<LeaguePartnerSearch | null>(null);
  
  const [selectedContactUser, setSelectedContactUser] = useState<User | Person | null>(null);
  const [selectedContactRank, setSelectedContactRank] = useState<number | undefined>(undefined);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<User | Person | null>(null);

  // League Booking States (for Mini-Kalender & Specialized Booking Drawer)
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<{
    date: string;
    court: string;
    startTime: string;
  } | null>(null);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [pendingChallengedUser, setPendingChallengedUser] = useState<{
    userId: string;
    name?: string;
  } | null>(null);

  const handleChallengePlayer = (userId: string, userName?: string) => {
    setPendingChallengedUser({ userId, name: userName });
    // Smooth scroll to mini calendar
    setTimeout(() => {
      const el = document.getElementById('mini-kalender-liga-slots');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  const handleSelectSlot = (date: string, court: string, startTime: string) => {
    setSelectedSlotForBooking({ date, court, startTime });
    setIsBookingDrawerOpen(true);
  };

  // Fetch missing users from global collection if they are not in the local club `users` map
  const [extendedUsers, setExtendedUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!allProfiles || allProfiles.length === 0) return;

    const missingIds = Array.from(new Set(allProfiles
      .map(p => p.userId)
      .filter(id => !users[id] && id !== currentUser.id && !extendedUsers[id])));

    if (missingIds.length === 0) return;

    const fetchMissingUsers = async () => {
      const fetched: Record<string, User> = {};
      const chunkSize = 30;
      for (let i = 0; i < missingIds.length; i += chunkSize) {
        const chunk = missingIds.slice(i, i + chunkSize);
        const q = query(collection(db, "users"), where("__name__", "in", chunk));
        const snap = await getDocs(q);
        snap.forEach(doc => {
          fetched[doc.id] = doc.data() as User;
        });
      }
      setExtendedUsers(prev => ({ ...prev, ...fetched }));
    };

    fetchMissingUsers().catch(console.error);
  }, [allProfiles, users, currentUser.id]);

  async function handleSavePartnerSearch(availabilityText: string, expiresAt: string, showContactInfo: boolean) {
    const userName = getUserName(currentUser.id);
    const clubName = currentUser.vereinsId || clubId || 'Verein';
    await saveLeaguePartnerSearch(currentUser.id, clubId, availabilityText, expiresAt, userName, clubName, showContactInfo);
    await refreshPartnerSearches();
  }

  async function handleRenewPartnerSearch(userId: string) {
    await renewLeaguePartnerSearch(userId, 14);
    await refreshPartnerSearches();
  }

  async function handleDeletePartnerSearch(searchIdOrUserId: string) {
    try {
      await deleteLeaguePartnerSearch(searchIdOrUserId);
      setPartnerSearches(prev => prev.filter(s => s.id !== searchIdOrUserId && s.userId !== searchIdOrUserId));
      setSearchToEdit(null);
      setIsPartnerModalOpen(false);
      await refreshPartnerSearches();
    } catch (e) {
      console.error('Fehler beim Löschen der Spielanzeige:', e);
      throw e;
    }
  }

  const handleEditMatch = (match: LeagueMatch) => {
    setSelectedMatchForEdit(match);
    setSelectedMatchForEntry(null);
    setIsResultDrawerOpen(true);
  };

  const handleEnterScheduledMatchResult = (match: LeagueMatch) => {
    setSelectedMatchForEdit(null);
    setSelectedMatchForEntry(match);
    setIsResultDrawerOpen(true);
  };

  const handleCancelMatchResult = async (match: LeagueMatch) => {
    if (!window.confirm("Möchtest du dieses Match-Ergebnis wirklich stornieren? Die vergebenen Ranglisten-Punkte werden zurückgesetzt und das Spiel wird wieder als geplantes Match markiert.")) {
      return;
    }
    try {
      await cancelLeagueMatchResult(match.id, currentUser.id);
      window.dispatchEvent(new Event('league-result-added'));
    } catch (err: any) {
      console.error('Fehler beim Stornieren:', err);
      alert('Fehler beim Stornieren des Matches: ' + (err?.message || err));
    }
  };

  function getUserObject(userId: string): User | null {
    if (!userId) return null;
    const trimmed = userId.trim();

    if (currentUser && (currentUser.id === trimmed || currentUser.name.toLowerCase() === trimmed.toLowerCase())) {
      return currentUser;
    }

    if (users[trimmed]) {
      return users[trimmed];
    }
    
    if (extendedUsers[trimmed]) {
      return extendedUsers[trimmed];
    }

    const foundInUsers = Object.values(users).find((u) => {
      const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`
        .trim()
        .replace(/^, |,$/, "");
      return (
        u.id === trimmed ||
        u.name.toLowerCase() === trimmed.toLowerCase() ||
        (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
        (full && full.toLowerCase() === trimmed.toLowerCase()) ||
        (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
      );
    });
    
    if (foundInUsers) return foundInUsers;
    
    const foundInExtended = Object.values(extendedUsers).find((u) => {
      const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`
        .trim()
        .replace(/^, |,$/, "");
      return (
        u.id === trimmed ||
        u.name.toLowerCase() === trimmed.toLowerCase() ||
        (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
        (full && full.toLowerCase() === trimmed.toLowerCase()) ||
        (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
      );
    });

    return foundInExtended || null;
  }

  function getUserName(userId: string): string {
    const u = getUserObject(userId);
    return resolvePlayerDisplayName(u, userId);
  }

  // Determine effective configuration
  const effectiveConfig = activeConfig || defaultLeagueConfig;

  // Find active league definition
  const currentLeague = activeLeagues.find((l) => l.id === activeLeagueId);

  // Map & filter profiles for current active league with real livePoints calculation
  const currentLeagueProfiles = useMemo(() => {
    return allProfiles
      .map((p) => {
        const u = getUserObject(p.userId);
        const isEligible = isPlayerEligibleForLeague(u, currentLeague, activeLeagueId, p.leagueId);
        if (!isEligible) return null;

        const livePoints = calculateLeaguePlayerLivePoints(p, effectiveConfig);
        const matchesCount = p.matchesCount || 0;
        const userName = resolvePlayerDisplayName(u, p.userId);

        return {
          ...p,
          userName,
          livePoints,
          matchesCount,
          active: true,
          hasPlayedMatches: matchesCount > 0,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [allProfiles, users, extendedUsers, currentLeague, activeLeagueId, effectiveConfig]);

  // Sorted rankings: High points first, then matchesCount / recent match, then alphabetical
  const filteredSortedProfiles = useMemo(() => {
    return [...currentLeagueProfiles].sort((a, b) => {
      if (Math.abs(b.livePoints - a.livePoints) > 0.01) {
        return b.livePoints - a.livePoints;
      }
      if (b.matchesCount !== a.matchesCount) {
        return b.matchesCount - a.matchesCount;
      }
      if (b.matchesCount > 0 && a.matchesCount > 0 && a.lastMatchDate && b.lastMatchDate) {
        return new Date(b.lastMatchDate).getTime() - new Date(a.lastMatchDate).getTime();
      }
      return a.userName.localeCompare(b.userName, 'de', { sensitivity: 'base' });
    });
  }, [currentLeagueProfiles]);

  // Calculate standard competition ranks (1224 ranking / Gleichstand):
  // Players with identical points get the exact same rank.
  // The next rank reflects the actual count of players with higher points + 1.
  const userRankMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredSortedProfiles.forEach((profile, index) => {
      if (index === 0) {
        map.set(profile.userId, 1);
      } else {
        const prevProfile = filteredSortedProfiles[index - 1];
        const isTie = Math.abs((profile.livePoints ?? 0) - (prevProfile.livePoints ?? 0)) < 0.01;
        if (isTie) {
          map.set(profile.userId, map.get(prevProfile.userId) || 1);
        } else {
          map.set(profile.userId, index + 1);
        }
      }
    });
    return map;
  }, [filteredSortedProfiles]);

  function getUserRank(userId: string): number | undefined {
    return userRankMap.get(userId);
  }

  // Live points map across the league profiles
  const userPointsMap = useMemo(() => {
    const map = new Map<string, number>();
    currentLeagueProfiles.forEach((p) => {
      map.set(p.userId, p.livePoints);
    });
    return map;
  }, [currentLeagueProfiles]);

  const getUserPoints = useCallback((userId: string): number | undefined => {
    if (userPointsMap.has(userId)) {
      return userPointsMap.get(userId);
    }
    const foundProfile = allProfiles.find((p) => p.userId === userId || p.id === userId);
    if (foundProfile) {
      return calculateLeaguePlayerLivePoints(foundProfile, effectiveConfig);
    }
    if (userId === currentUser.id && profile) {
      return calculateLeaguePlayerLivePoints(profile, effectiveConfig);
    }
    return undefined;
  }, [userPointsMap, allProfiles, effectiveConfig, currentUser.id, profile]);

  const currentUserLivePoints = useMemo(() => {
    return getUserPoints(currentUser.id) ?? (profile ? calculateLeaguePlayerLivePoints(profile, effectiveConfig) : undefined);
  }, [getUserPoints, currentUser.id, profile, effectiveConfig]);

  const currentUserSearch = partnerSearches.find(
    s =>
      s.userId === currentUser.id ||
      s.id === currentUser.id ||
      (currentUser.name && s.userId && currentUser.name.toLowerCase() === s.userId.toLowerCase()) ||
      (currentUser.name && s.userName && currentUser.name.toLowerCase() === s.userName.toLowerCase()) ||
      (currentUser.klarname && s.userName && currentUser.klarname.toLowerCase() === s.userName.toLowerCase())
  );

  const isPlayerActive = (p: { active?: boolean } | null) => {
    if (!p) return false;
    return true;
  };

  const currentActiveLeagueMatches = allClubMatches.filter(m => {
    return m.leagueId === activeLeagueId || (!m.leagueId && activeLeagueId === "open_mixed");
  });

  const currentActiveLeagueUserMatches = matches.filter(m => {
    return m.leagueId === activeLeagueId || (!m.leagueId && activeLeagueId === "open_mixed");
  });

  const userCompletedMatches = currentActiveLeagueUserMatches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.played_at || b.result?.reportedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.played_at || a.result?.reportedAt || a.updatedAt || a.createdAt).getTime());

  // Cross-club matches for history
  const allUserCompletedMatches = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.played_at || b.result?.reportedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.played_at || a.result?.reportedAt || a.updatedAt || a.createdAt).getTime());

  const now = new Date();
  const upcomingAndRecentMatches = currentActiveLeagueUserMatches
    .filter((m) => {
      if (m.status === 'scheduled') return true;
      if (m.status === 'completed' && m.scheduledDate) {
        const startTime = new Date(m.scheduledDate + 'T' + (m.scheduledStartTime || '00:00'));
        const diffHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
      }
      return false;
    })
    .sort((a, b) => {
      const aTime = new Date(a.scheduledDate + 'T' + (a.scheduledStartTime || '00:00')).getTime();
      const bTime = new Date(b.scheduledDate + 'T' + (b.scheduledStartTime || '00:00')).getTime();
      return aTime - bTime;
    });

  // Unified League Matches (combining allClubMatches and user matches, avoiding duplicates)
  const combinedLeagueMatches = useMemo(() => {
    const map = new Map<string, LeagueMatch>();
    currentActiveLeagueMatches.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    currentActiveLeagueUserMatches.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    return Array.from(map.values());
  }, [currentActiveLeagueMatches, currentActiveLeagueUserMatches]);

  // Upcoming scheduled matches across the league (Community Feed)
  const upcomingFeedMatches = useMemo(() => {
    return combinedLeagueMatches
      .filter((m) => m.status !== 'cancelled' && m.status !== 'aborted')
      .filter((m) => m.status === 'scheduled' || (!m.result && m.scheduledDate))
      .filter((m) => !isMatchExpired(m)) // Exclude expired matches
      .sort((a, b) => {
        const aDate = `${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`;
        const bDate = `${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`;
        return aDate.localeCompare(bDate);
      });
  }, [combinedLeagueMatches]);

  // Pending user matches (Past matches without results for the current user)
  const pendingUserMatches = useMemo(() => {
    return combinedLeagueMatches
      .filter((m) => m.status !== 'cancelled' && m.status !== 'aborted')
      .filter((m) => m.status === 'scheduled' || (!m.result && m.scheduledDate))
      .filter((m) => isMatchExpired(m)) // Only expired matches
      .filter((m) => m.player1UserId === currentUser?.id || m.player2UserId === currentUser?.id)
      .sort((a, b) => {
        const aDate = `${a.scheduledDate || '9999-99-99'}T${a.scheduledStartTime || '00:00'}`;
        const bDate = `${b.scheduledDate || '9999-99-99'}T${b.scheduledStartTime || '00:00'}`;
        return bDate.localeCompare(aDate); // descending, latest first
      });
  }, [combinedLeagueMatches, currentUser?.id]);

  // Completed matches across the league (for recent results feed)
  const completedFeedMatches = useMemo(() => {
    const list = combinedLeagueMatches
      .filter((m) => m.status === 'completed' || !!m.result)
      .sort((a, b) => {
        const timeA = new Date(a.played_at || a.result?.reportedAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.played_at || b.result?.reportedAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    return list.length > 0 ? list : allUserCompletedMatches;
  }, [combinedLeagueMatches, allUserCompletedMatches]);

  const activeScheduledMatch = upcomingAndRecentMatches.find(m => m.status === 'scheduled') || null;

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Profil wird geladen...</div>;
  }

  if (showPointsDetail) {
    return (
      <LeaguePointsDetail
        currentUser={currentUser}
        profile={profile}
        allProfiles={allProfiles}
        matches={currentActiveLeagueMatches.length > 0 ? currentActiveLeagueMatches : matches}
        users={users}
        config={effectiveConfig}
        onBack={() => {
          setShowPointsDetail(false);
          if (window.location.hash.includes('punkte-system') || window.location.hash.includes('rules')) {
            window.location.hash = '#/league';
          }
        }}
      />
    );
  }

  const currentUserPoints = calculateLeaguePlayerLivePoints(profile, effectiveConfig);
  const currentUserRank = getUserRank(currentUser.id);

  return (
    <div className="w-full flex-grow flex flex-col min-h-0 space-y-4 lg:space-y-6 lg:animate-in lg:fade-in lg:duration-500">
      
      {/* 1. BANNER-HERO-HEADER */}
      <HobbyligaBanner
        pointsText={`${currentUserPoints.toFixed(1)} Pkt.`}
        rankText={currentUserRank ? `Rang #${currentUserRank}` : 'Unplatziert'}
        hasActiveScheduledMatch={!!activeScheduledMatch}
        clubs={participatingClubs}
        onOpenResultDrawer={() => {
          setSelectedMatchForEdit(null);
          setSelectedMatchForEntry(activeScheduledMatch);
          setIsResultDrawerOpen(true);
        }}
      />

      {/* 6. DASHBOARD BENTO-GRID LAYOUT */}
      
      {/* OBERER ABSCHNITT: BÖRSE, MINI-KALENDER & STATUS-KARTEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch">
        {/* LEFT COLUMN: Börse & Kalender */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <SpielpartnerBoerse
            currentUser={currentUser}
            partnerSearches={partnerSearches}
            currentUserSearch={currentUserSearch}
            getUserObject={getUserObject}
            getUserRank={getUserRank}
            getUserPoints={getUserPoints}
            currentUserPoints={currentUserLivePoints}
            onOpenModal={(search) => {
              setSearchToEdit(search);
              setIsPartnerModalOpen(true);
            }}
            onRenew={handleRenewPartnerSearch}
            onDelete={handleDeletePartnerSearch}
            onChallenge={handleChallengePlayer}
          />

          {/* MINI-KALENDER: SCHNELLVORSCHAU FREIE LIGA-SLOTS (2H+) */}
          <HobbyligaMiniKalender
            currentUser={currentUser}
            clubId={clubId}
            userClubs={userClubs}
            onSwitchClub={onSwitchClub}
            bookings={bookings || []}
            settings={settings}
            courts={settings?.courts}
            pendingChallengedUser={pendingChallengedUser}
            onClearChallengedUser={() => setPendingChallengedUser(null)}
            onSelectSlot={handleSelectSlot}
          />
        </div>

        {/* RIGHT COLUMN: Kombinierter Match-Feed (Anstehende Matches & Letzte Ergebnisse) & Rangliste */}
        <div className="lg:col-span-1 flex flex-col space-y-4 lg:space-y-6 h-full">
          <div className="shrink-0">
            <HobbyligaCombinedMatchFeed
              pendingMatches={pendingUserMatches}
              upcomingMatches={upcomingFeedMatches}
              completedMatches={completedFeedMatches}
              currentUser={currentUser}
              getUserName={getUserName}
              getUserObject={getUserObject}
              getUserRank={getUserRank}
              formatDate={formatRelativeDate}
              onEnterResult={(match) => {
                setSelectedMatchForEntry(match);
                setIsResultDrawerOpen(true);
              }}
              onEditMatch={handleEditMatch}
              onCancelMatch={handleCancelMatchResult}
              onRebook={(match) => {
                const opponentId =
                  match.player1UserId === currentUser.id
                    ? match.player2UserId
                    : match.player1UserId;
                handleChallengePlayer(opponentId, getUserName(opponentId));
              }}
            />
          </div>
          
          <HobbyligaKompaktRangliste
            className="flex-1 min-h-[380px]"
            filteredSortedProfiles={filteredSortedProfiles}
            currentUser={currentUser}
            clubId={clubId}
            getUserObject={getUserObject}
            getUserRank={getUserRank}
            participatingClubs={participatingClubs}
            matches={allClubMatches}
            allProfiles={allProfiles}
            getUserName={getUserName}
          />
        </div>
      </div>

      {/* BENTO-HERO: MEIN PUNKTE- & RANGVERLAUF (100% GRID-BREITE) */}
      <div className="w-full col-span-full">
        <PointsRankChart
          currentUser={currentUser}
          profile={profile}
          allProfiles={allProfiles}
          matches={matches}
          users={users}
          onNavigateToRules={() => {
            window.location.hash = '#/hobbyliga/punkte-system';
            setShowPointsDetail(true);
          }}
        />
      </div>

      {/* UNTERER ABSCHNITT: MATCH-HISTORIE */}
      <div className="w-full space-y-6">
        

        {/* MATCH-HISTORIE & FORMEL-AUFSCHLÜSSELUNG */}
        <HobbyligaMatchHistorie
          currentUser={currentUser}
          userCompletedMatches={userCompletedMatches}
          effectiveConfig={effectiveConfig}
          getUserName={getUserName}
          onEditMatch={handleEditMatch}
          onCancelMatch={handleCancelMatchResult}
        />
      </div>
      {/* Modals */}
      <LeagueResultDrawer
        isOpen={isResultDrawerOpen}
        onClose={() => {
          setIsResultDrawerOpen(false);
          setSelectedMatchForEdit(null);
          setSelectedMatchForEntry(null);
        }}
        currentUser={currentUser}
        profile={profile}
        allProfiles={allProfiles}
        defaultConfig={defaultLeagueConfig}
        editingMatch={selectedMatchForEdit}
        match={selectedMatchForEdit || selectedMatchForEntry || activeScheduledMatch}
        prefilledMatchId={
          selectedMatchForEdit
            ? selectedMatchForEdit.id
            : (selectedMatchForEntry ? selectedMatchForEntry.id : (activeScheduledMatch ? activeScheduledMatch.id : undefined))
        }
        prefilledOpponentId={
          selectedMatchForEdit
            ? (selectedMatchForEdit.player1UserId === currentUser.id ? selectedMatchForEdit.player2UserId : selectedMatchForEdit.player1UserId)
            : (selectedMatchForEntry
                ? (selectedMatchForEntry.player1UserId === currentUser.id ? selectedMatchForEntry.player2UserId : selectedMatchForEntry.player1UserId)
                : (activeScheduledMatch ? (activeScheduledMatch.player1UserId === currentUser.id ? activeScheduledMatch.player2UserId : activeScheduledMatch.player1UserId) : undefined))
        }
        prefilledDate={
          selectedMatchForEdit
            ? selectedMatchForEdit.scheduledDate
            : (selectedMatchForEntry ? selectedMatchForEntry.scheduledDate : (activeScheduledMatch ? activeScheduledMatch.scheduledDate : undefined))
        }
        onSuccess={() => {
          window.dispatchEvent(new Event('league-result-added'));
          setIsResultDrawerOpen(false);
          setSelectedMatchForEdit(null);
          setSelectedMatchForEntry(null);
        }}
        getUserName={getUserName}
        leagueId={activeLeagueId}
        primaryColor={settings?.primaryColor}
      />
      {isPartnerModalOpen && (
        <CreateAdModal
          currentUser={currentUser}
          userRank={getUserRank(currentUser.id)}
          existingSearch={searchToEdit || currentUserSearch}
          onClose={() => {
            setIsPartnerModalOpen(false);
            setSearchToEdit(null);
          }}
          onSave={handleSavePartnerSearch}
          onDelete={() => {
            const target = searchToEdit || currentUserSearch;
            const targetId = target?.id || target?.userId || currentUser.id;
            return handleDeletePartnerSearch(targetId);
          }}
        />
      )}
      {selectedContactUser && (
        <PlayerContactModal
          targetUser={selectedContactUser}
          currentUser={currentUser}
          onClose={() => {
            setSelectedContactUser(null);
            setSelectedContactRank(undefined);
          }}
          rankPosition={selectedContactRank}
        />
      )}
      {selectedHistoryUser && (
        <PointsHistoryModal
          targetUser={selectedHistoryUser}
          allUsers={users}
          onClose={() => setSelectedHistoryUser(null)}
        />
      )}
      {/* SPECIALIZED HOBBYLIGA BOOKING DRAWER */}
      <HobbyligaBookingDrawer
        isOpen={isBookingDrawerOpen}
        onClose={() => {
          setIsBookingDrawerOpen(false);
          setSelectedSlotForBooking(null);
        }}
        slot={selectedSlotForBooking}
        currentUser={currentUser}
        clubId={clubId}
        users={users}
        settings={settings}
        userClubs={userClubs}
        onSwitchClub={onSwitchClub}
        activeLeagueId={activeLeagueId}
        prefilledOpponent={pendingChallengedUser}
        onBook={onBook}
        onSuccess={() => {
          setPendingChallengedUser(null);
          setSelectedSlotForBooking(null);
          setIsBookingDrawerOpen(false);
        }}
      />
    </div>
  );
}
