import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { User, LeaguePlayer, LeagueMatch, Person, LeaguePartnerSearch, DynamicLeague } from '../types';
import { 
  getLeagueProfile, 
  createLeagueProfile, 
  getAllLeagueProfiles,
  getPlayerMatches,
  getAllLeagueMatches,
  createLeagueMatch,
  updateLeagueMatchResult,
  getLeaguePartnerSearches,
  saveLeaguePartnerSearch,
  renewLeaguePartnerSearch,
  deleteLeaguePartnerSearch,
  getLeagueConfigVersions
} from '../services/league';
import { 
  applyDecay, 
  calculatePoints, 
  getConfigForDate,
  LeaguePointConfig 
} from '../services/leagueEngine';
import { PlayerContactModal } from './PlayerContactModal';
import { PointsHistoryModal } from './PointsHistoryModal';
import { PartnerSearchModal } from './PartnerSearchModal';
import { LeagueResultDrawer } from './LeagueResultDrawer';
import { PointsRankChart } from './PointsRankChart';
import { LeaguePointsDetail } from './LeaguePointsDetail';
import { ClubSettings, DEFAULT_DYNAMIC_LEAGUES } from '../services/db';
import { useAuth } from '../App'; // Or wherever auth is

// Mock context for config, we should pass this in or fetch it
const defaultConfig: LeaguePointConfig = {
  initialRankingPoints: 100,
  participationPoints: 5,
  maxBonusPoints: 45,
  logisticSteepnessK: 0.05,
  decayPointsPerWeek: 5,
};

interface Props {
  currentUser: User;
  clubId: string;
  users: Record<string, User>; // All users to display names
  settings?: ClubSettings;
}

export function LeagueDashboard({ currentUser, clubId, users, settings }: Props) {
  const [profile, setProfile] = useState<LeaguePlayer | null>(null);
  const [allProfiles, setAllProfiles] = useState<LeaguePlayer[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [allClubMatches, setAllClubMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeConfig, setActiveConfig] = useState<LeaguePointConfig>(defaultConfig);

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

  // Spielpartner-Börse State
  const [partnerSearches, setPartnerSearches] = useState<LeaguePartnerSearch[]>([]);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isResultDrawerOpen, setIsResultDrawerOpen] = useState(false);
  const [searchToEdit, setSearchToEdit] = useState<LeaguePartnerSearch | null>(null);

  // Dynamic Leagues Configuration
  const dynamicLeagues: DynamicLeague[] = useMemo(() => {
    const list = settings?.leagueSettings?.leagues;
    if (list && list.length > 0) return list;
    return DEFAULT_DYNAMIC_LEAGUES;
  }, [settings]);

  // Only active leagues are available to players
  const activeLeagues: DynamicLeague[] = useMemo(() => {
    const active = dynamicLeagues.filter((l) => l.active);
    return active.length > 0 ? active : DEFAULT_DYNAMIC_LEAGUES.filter((l) => l.active);
  }, [dynamicLeagues]);

  // Active League Filter State (Decoupled from gender icons)
  const [activeLeagueId, setActiveLeagueId] = useState<string>(() => {
    if (currentUser.leagueId && activeLeagues.some((l) => l.id === currentUser.leagueId)) {
      return currentUser.leagueId;
    }
    if (currentUser.gender === "w" && activeLeagues.some((l) => l.id === "damen_einzel")) {
      return "damen_einzel";
    }
    if (currentUser.gender === "m" && activeLeagues.some((l) => l.id === "herren_einzel")) {
      return "herren_einzel";
    }
    return activeLeagues[0]?.id || "open_mixed";
  });

  // Ensure activeLeagueId points to a valid active league
  useEffect(() => {
    if (activeLeagues.length > 0 && !activeLeagues.some((l) => l.id === activeLeagueId)) {
      setActiveLeagueId(activeLeagues[0].id);
    }
  }, [activeLeagues, activeLeagueId]);

  // Modal states for player contact and points history
  const [selectedContactUser, setSelectedContactUser] = useState<User | Person | null>(null);
  const [selectedContactRank, setSelectedContactRank] = useState<number | undefined>(undefined);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<User | Person | null>(null);

  useEffect(() => {
    loadData();

    const handleResultAdded = () => loadData();
    window.addEventListener('league-result-added', handleResultAdded);
    return () => window.removeEventListener('league-result-added', handleResultAdded);
  }, [currentUser.id]);

  async function loadData() {
    setLoading(true);
    try {
      let userProfile = await getLeagueProfile(currentUser.id);
      if (!userProfile) {
        userProfile = await createLeagueProfile(currentUser.id, clubId, defaultConfig.initialRankingPoints);
      }
      setProfile(userProfile);
      
      const [profiles, userMatches, clubMatches, searches, configVersions] = await Promise.all([
        getAllLeagueProfiles(),
        getPlayerMatches(currentUser.id),
        getAllLeagueMatches(),
        getLeaguePartnerSearches(),
        getLeagueConfigVersions()
      ]);

      const currentConfig = getConfigForDate(configVersions, new Date().toISOString(), userProfile.leagueId);
      setActiveConfig(currentConfig);
      
      // Ensure current user's profile is in the allProfiles list if it was just created
      if (!profiles.find(p => p.userId === currentUser.id)) {
        profiles.push(userProfile);
      }
      
      setAllProfiles(profiles);
      setMatches(userMatches);
      setAllClubMatches(clubMatches);
      setPartnerSearches(searches);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function refreshPartnerSearches() {
    try {
      const searches = await getLeaguePartnerSearches();
      setPartnerSearches(searches);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSavePartnerSearch(availabilityText: string, expiresAt: string) {
    const userRank = getUserRank(currentUser.id);
    const userName = getUserName(currentUser.id);
    const clubName = currentUser.vereinsId || clubId || 'Verein';
    await saveLeaguePartnerSearch(currentUser.id, clubId, availabilityText, expiresAt, userName, clubName);
    await refreshPartnerSearches();
  }

  async function handleRenewPartnerSearch(userId: string) {
    await renewLeaguePartnerSearch(userId, 14);
    await refreshPartnerSearches();
  }

  async function handleDeletePartnerSearch(userId: string) {
    try {
      await deleteLeaguePartnerSearch(userId);
      setPartnerSearches(prev => prev.filter(s => s.userId !== userId));
      setSearchToEdit(null);
      setIsPartnerModalOpen(false);
      await refreshPartnerSearches();
    } catch (e) {
      console.error('Fehler beim Löschen der Spielanzeige:', e);
      throw e;
    }
  }

  async function handleJoinLeague() {
    try {
      const newProfile = await createLeagueProfile(currentUser.id, clubId, defaultConfig.initialRankingPoints);
      setProfile(newProfile);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Beitritt zur Liga.');
    }
  }

  function getUserObject(userId: string): User | null {
    if (!userId) return null;
    const trimmed = userId.trim();

    if (currentUser && (currentUser.id === trimmed || currentUser.name.toLowerCase() === trimmed.toLowerCase())) {
      return currentUser;
    }

    if (users[trimmed]) {
      return users[trimmed];
    }

    return (
      Object.values(users).find((u) => {
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
      }) || null
    );
  }

  function getUserName(userId: string): string {
    const u = getUserObject(userId);
    if (u) {
      const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      if (full) return full;
      return u.klarname || u.name;
    }
    return userId || "Spieler";
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Profil wird geladen...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-slate-500">Profil wird geladen...</div>;
  }

  function isPlayerActive(p: LeaguePlayer) {
    if (p.matchesCount && p.matchesCount > 0) return true;
    if (p.createdAt && p.lastMatchDate && p.lastMatchDate !== p.createdAt) return true;
    if (p.basePoints !== activeConfig.initialRankingPoints) return true;
    return false;
  }

  // Calculate live points (with decay)
  const mappedProfiles = allProfiles.map(p => {
    const active = isPlayerActive(p);
    const livePoints = applyDecay(p.basePoints, p.lastMatchDate, activeConfig, active ? 1 : 0);
    return { ...p, livePoints, active, userName: getUserName(p.userId) };
  });

  // Helper to determine if a player belongs to activeLeagueId
  const isUserInActiveLeague = (userId: string, pLeagueId?: string): boolean => {
    const u = getUserObject(userId);
    const assignedLeagueId = pLeagueId || u?.leagueId;
    
    if (assignedLeagueId) {
      return assignedLeagueId === activeLeagueId;
    }
    
    // Default fallback when user has no explicit league assigned:
    if (activeLeagueId === "damen_einzel") {
      return (u?.gender || "m") === "w";
    }
    if (activeLeagueId === "herren_einzel") {
      return (u?.gender || "m") === "m";
    }
    if (activeLeagueId === "open_mixed") {
      return true;
    }
    return false;
  };

  // Filter profiles for current active league
  const currentLeagueProfiles = mappedProfiles.filter(p => isUserInActiveLeague(p.userId, p.leagueId));

  const activeProfiles = currentLeagueProfiles.filter(p => p.active).sort((a, b) => {
    if (b.livePoints !== a.livePoints) {
      return b.livePoints - a.livePoints; // highest points first
    }
    return new Date(b.lastMatchDate).getTime() - new Date(a.lastMatchDate).getTime(); // younger date wins
  });

  const inactiveProfiles = currentLeagueProfiles.filter(p => !p.active).sort((a, b) => {
    return a.userName.localeCompare(b.userName, 'de', { sensitivity: 'base' });
  });

  const filteredSortedProfiles = [...activeProfiles, ...inactiveProfiles];

  function getUserRank(userId: string): number | undefined {
    const idx = activeProfiles.findIndex(p => p.userId === userId);
    return idx !== -1 ? idx + 1 : undefined;
  }

  function formatRelativeDate(dateStr?: string): string {
    if (!dateStr) return 'k. A.';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return 'heute';
    } else if (diffDays === 1) {
      return 'gestern';
    } else if (diffDays < 7) {
      return `vor ${diffDays} Tagen`;
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getDaysRemaining(expiresAt?: string): number {
    if (!expiresAt) return 99;
    const expiry = new Date(expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  const currentUserSearch = partnerSearches.find(s => s.userId === currentUser.id);


  const activeScheduledMatch = matches.find(m => {
    if (m.status !== 'scheduled') return false;
    if (!m.scheduledDate) return false;
    const dateStr = m.scheduledDate + (m.scheduledStartTime ? 'T' + m.scheduledStartTime + ':00' : 'T00:00:00');
    const matchTime = new Date(dateStr);
    return matchTime <= new Date();
  });

  const pendingUpcomingMatch = matches.find(m => {
    if (m.status !== 'scheduled') return false;
    if (!m.scheduledDate) return false;
    const dateStr = m.scheduledDate + (m.scheduledStartTime ? 'T' + m.scheduledStartTime + ':00' : 'T00:00:00');
    const matchTime = new Date(dateStr);
    return matchTime > new Date();
  });

  const latestCompletedMatch = (allClubMatches.length > 0 ? allClubMatches : matches)
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];

  const effectiveConfig: LeaguePointConfig = activeConfig;

  // Personal status and match history metrics for dashboard
  const userLivePoints = profile
    ? applyDecay(
        profile.basePoints,
        profile.lastMatchDate,
        effectiveConfig,
        isPlayerActive(profile) ? 1 : 0
      )
    : effectiveConfig.initialRankingPoints;

  const userRank = getUserRank(currentUser.id);

  const allMatchesList = allClubMatches.length > 0 ? allClubMatches : matches;
  const userCompletedMatches = allMatchesList
    .filter(
      m =>
        m.status === 'completed' &&
        (m.player1UserId === currentUser.id || m.player2UserId === currentUser.id)
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );

  let userWins = 0;
  let userLosses = 0;
  userCompletedMatches.forEach(m => {
    if (m.result?.winnerId === currentUser.id) userWins++;
    else if (m.result?.winnerId) userLosses++;
  });

  // Reconstruct point timeline bounds
  let runningPts = effectiveConfig.initialRankingPoints;
  let userHighestPts = userLivePoints;
  let userLowestPts = userLivePoints;
  const chronUserMatches = [...userCompletedMatches].reverse();
  chronUserMatches.forEach(m => {
    const isP1 = m.player1UserId === currentUser.id;
    const delta = m.pointsAwarded
      ? isP1
        ? m.pointsAwarded.player1
        : m.pointsAwarded.player2
      : 0;
    if (delta !== undefined) {
      runningPts += delta;
      userHighestPts = Math.max(userHighestPts, runningPts);
      userLowestPts = Math.min(userLowestPts, runningPts);
    }
  });
  userHighestPts = Math.max(userHighestPts, userLivePoints);
  userLowestPts = Math.min(userLowestPts, userLivePoints);

  // Inactivity countdown logic
  const lastMatchDateObj = profile?.lastMatchDate
    ? new Date(profile.lastMatchDate)
    : null;
  const now = new Date();
  let inactivityDaysElapsed = 0;
  let nextInactivityCheckStr = '';

  if (lastMatchDateObj && profile?.matchesCount && profile.matchesCount > 0) {
    const diffTime = Math.abs(now.getTime() - lastMatchDateObj.getTime());
    inactivityDaysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const nextCheckDate = new Date(lastMatchDateObj);
    const weeksPassed = Math.floor(inactivityDaysElapsed / 7);
    nextCheckDate.setDate(nextCheckDate.getDate() + (weeksPassed + 1) * 7);

    nextInactivityCheckStr = nextCheckDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const isDecayActive =
    inactivityDaysElapsed >= 7 && (profile?.matchesCount || 0) > 0;

  if (showPointsDetail) {
    return (
      <LeaguePointsDetail
        currentUser={currentUser}
        profile={profile}
        allProfiles={allProfiles}
        matches={allClubMatches.length > 0 ? allClubMatches : matches}
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

  return (
    <div className="w-full flex-grow flex flex-col min-h-0 space-y-4 lg:space-y-6 lg:animate-in lg:fade-in lg:duration-500">
      
      {/* 1. BANNER-HERO-HEADER */}
      <div className="relative w-full h-[140px] md:h-[160px] rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex items-center bg-slate-900 border border-slate-200">
        <img 
          src="/images/banner_hobbyliga.png" 
          onError={(e) => {
            // Fallback if local path is not yet cached
            (e.target as HTMLImageElement).src = "https://raw.githubusercontent.com/DeepBlue-92/platzbuchung/1c29075035a74e2f9cd41da137c369e940da066e/banner_hobbyliga.png";
          }}
          alt="Hobbyliga Tennis Match" 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/50 to-transparent"></div>
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between w-full h-full gap-4">
          <div className="text-white space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider leading-tight">Hobbyliga</h2>
            
            {/* Stylish Badge / KPI combination for Points and Rank */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-sm">
              <span className="font-black text-sm md:text-base tracking-wide flex items-center gap-1.5">
                {(profile ? (applyDecay(profile.basePoints ?? 100, profile.lastMatchDate, defaultConfig, isPlayerActive(profile) ? 1 : 0) || 0) : 100).toFixed(1)} Pkt.
              </span>
              <span className="text-white/40 font-light">|</span>
              <span className="font-bold text-xs md:text-sm text-slate-200 tracking-wider">
                {isPlayerActive(profile) && getUserRank(profile.userId) ? `Rang #${getUserRank(profile.userId)}` : 'Unplatziert'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeScheduledMatch && (
              <button 
                onClick={() => setIsResultDrawerOpen(true)}
                className="px-4 py-2.5 bg-white text-slate-900 font-bold text-xs md:text-sm uppercase tracking-wider rounded-xl hover:bg-slate-50 transition shadow-md flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-trophy text-[var(--color-primary)]"></i> Ergebnis eintragen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. DASHBOARD LAYOUT (2-SPALTEN) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Pending Match Banner if any */}
          {pendingUpcomingMatch && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <i className="fa-regular fa-calendar-check text-lg"></i>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">Anstehendes Match</h4>
                  <p className="text-blue-700 text-xs mt-0.5">
                    Am {formatRelativeDate(pendingUpcomingMatch.scheduledDate)} 
                    {pendingUpcomingMatch.scheduledStartTime ? " um " + pendingUpcomingMatch.scheduledStartTime + " Uhr" : ""} 
                    &nbsp;gegen {getUserName(pendingUpcomingMatch.player1UserId === currentUser.id ? pendingUpcomingMatch.player2UserId : pendingUpcomingMatch.player1UserId)}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Spielpartner-Börse */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
                    <i className="fa-solid fa-bullhorn text-lg"></i>
                  </span>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    Spielpartner-Börse
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Signalisiere deine Verfügbarkeit für Hobbyliga-Einzelspiele und fordere Gegner heraus!
                </p>
              </div>
              <div>
                {currentUserSearch ? (
                  <button
                    onClick={() => {
                      setSearchToEdit(currentUserSearch);
                      setIsPartnerModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-pen-to-square text-slate-300"></i> Meine Anzeige verwalten
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSearchToEdit(null);
                      setIsPartnerModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[var(--color-primary)] hover:bg-opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Spielanzeige aufgeben
                  </button>
                )}
              </div>
            </div>

            {/* Renewal Banner if expiring soon */}
            {currentUserSearch && getDaysRemaining(currentUserSearch.expiresAt) <= 3 && new Date(currentUserSearch.expiresAt).getFullYear() <= 2050 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <i className="fa-solid fa-clock text-amber-600 text-sm"></i>
                  <span>
                    Deine Anzeige läuft {getDaysRemaining(currentUserSearch.expiresAt) <= 0 ? "heute" : "in " + getDaysRemaining(currentUserSearch.expiresAt) + " Tagen"} ab!
                  </span>
                </div>
                <button
                  onClick={() => handleRenewPartnerSearch(currentUser.id)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg transition shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate"></i> 14 Tage verlängern
                </button>
              </div>
            )}

            {/* Grid of Partner Search Cards */}
            {partnerSearches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partnerSearches.map((search) => {
                  const targetUser = getUserObject(search.userId);
                  const isOwner = currentUser.id === search.userId;
                  const userRank = getUserRank(search.userId);
                  const daysLeft = getDaysRemaining(search.expiresAt);
                  const displayName = search.userName || (targetUser ? (targetUser.firstName || "") + " " + (targetUser.lastName || "") : "Spieler").trim();
                  const displayClub = search.clubName || (targetUser ? targetUser.vereinsId : search.clubId) || "Verein";

                  return (
                    <div
                      key={search.id}
                      className={"bg-[var(--bg-surface,white)] rounded-2xl border " + (isOwner ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : "border-slate-200 hover:border-slate-300") + " p-5 shadow-sm flex flex-col justify-between transition-all space-y-4"}
                    >
                      <div>
                        {/* Header: User Avatar, Name, Rank, Club */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                              <i className="fa-solid fa-user text-slate-400 text-sm"></i>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">
                                {displayName}
                                {isOwner && (
                                  <span className="ml-1.5 text-[10px] bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-1.5 py-0.5 rounded font-black">
                                    DU
                                  </span>
                                )}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                <i className="fa-solid fa-building-columns text-[10px] text-slate-400"></i>
                                <span className="truncate">{displayClub}</span>
                              </div>
                            </div>
                          </div>
                          {/* Rank Badge */}
                          {userRank ? (
                            <span className="px-2.5 py-1 bg-[var(--color-primary)]/10 text-slate-800 text-xs font-black rounded-lg border border-[var(--color-primary)]/20 shrink-0">
                              Rang {userRank}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg shrink-0">
                              Neu
                            </span>
                          )}
                        </div>

                        {/* Availability Info */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-700 text-xs font-medium leading-relaxed italic">
                          "{search.availabilityText}"
                        </div>
                      </div>

                      {/* Footer: Date & Contact */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                        <div className="text-[11px] font-medium text-slate-500">
                          {new Date(search.expiresAt).getFullYear() > 2050 || daysLeft > 365 ? (
                            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <i className="fa-solid fa-infinity text-[var(--color-primary)] text-xs" />
                              Daueranzeige
                            </span>
                          ) : daysLeft <= 3 ? (
                            <span className="text-amber-600 font-bold flex items-center gap-1">
                              <i className="fa-solid fa-clock text-amber-500"></i> {daysLeft <= 0 ? "Läuft heute ab" : "Läuft in " + daysLeft + " Tagen ab"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <i className="fa-regular fa-calendar text-slate-400 text-xs" />
                              Gültig bis: <strong className="text-slate-700 font-semibold">{new Date(search.expiresAt).toLocaleDateString("de-DE")}</strong>
                            </span>
                          )}
                        </div>
                        
                        {isOwner ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeletePartnerSearch(search.userId)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg transition flex items-center gap-1"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (targetUser) {
                                setSelectedContactUser(targetUser);
                                setSelectedContactRank(userRank);
                              } else {
                                // Create a mock user object from search data
                                const mockUser = {
                                  id: search.userId,
                                  firstName: search.userName ? search.userName.split(" ")[0] : "Spieler",
                                  lastName: search.userName ? search.userName.split(" ").slice(1).join(" ") : "",
                                  showContactInfo: true,
                                } as Person;
                                setSelectedContactUser(mockUser);
                                setSelectedContactRank(userRank);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-envelope text-[var(--color-primary)]"></i> Anfragen
                          </button>
                        )}
                      </div>
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
                  onClick={() => {
                    setSearchToEdit(null);
                    setIsPartnerModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm inline-flex items-center gap-2 hover:bg-opacity-90"
                >
                  <i className="fa-solid fa-plus"></i> Anzeige aufgeben
                </button>
              </div>
            )}
          </div>

          {/* Points & Rank History Dual-Axis Chart */}
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

          {/* MATCH-HISTORIE & FORMEL-AUFSCHLÜSSELUNG */}
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
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Sätze: <strong className="text-slate-700 font-semibold">{setsFormatted}</strong></span>
                            <span>&bull;</span>
                            <span>{new Date(m.updatedAt || m.createdAt).toLocaleDateString('de-DE')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Transparent Formula Breakdown */}
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


        </div>

        {/* RIGHT COLUMN: Letztes Ergebnis & Rangliste */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card: Letztes Ergebnis */}
          <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-[var(--color-primary)]"></i> Letztes Ergebnis
              </h3>
              {latestCompletedMatch && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                  {formatRelativeDate(latestCompletedMatch.updatedAt || latestCompletedMatch.createdAt)}
                </span>
              )}
            </div>

            {latestCompletedMatch ? (
              (() => {
                const p1Name = getUserName(latestCompletedMatch.player1UserId);
                const p2Name = getUserName(latestCompletedMatch.player2UserId);
                const isP1Winner = latestCompletedMatch.result?.winnerId === latestCompletedMatch.player1UserId;
                const isP2Winner = latestCompletedMatch.result?.winnerId === latestCompletedMatch.player2UserId;

                const setsFormatted = latestCompletedMatch.result?.sets
                  ? latestCompletedMatch.result.sets.map(s => `${s.p1}:${s.p2}`).join(', ')
                  : '6:4, 6:3';

                const winnerDelta = isP1Winner
                  ? latestCompletedMatch.pointsAwarded?.player1
                  : (isP2Winner ? latestCompletedMatch.pointsAwarded?.player2 : undefined);

                return (
                  <div className="space-y-3.5">
                    {/* Players Matchup */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {/* Player 1 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isP1Winner ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500/30" : "bg-slate-200 text-slate-600"
                        }`}>
                          {isP1Winner ? <i className="fa-solid fa-crown text-[10px] text-amber-500" /> : <i className="fa-solid fa-user text-[10px]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isP1Winner ? "text-slate-900 font-black" : "text-slate-600"}`}>
                            {p1Name}
                          </div>
                          {isP1Winner && (
                            <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Sieger</span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">VS</span>

                      {/* Player 2 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isP2Winner ? "text-slate-900 font-black" : "text-slate-600"}`}>
                            {p2Name}
                          </div>
                          {isP2Winner && (
                            <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Sieger</span>
                          )}
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isP2Winner ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500/30" : "bg-slate-200 text-slate-600"
                        }`}>
                          {isP2Winner ? <i className="fa-solid fa-crown text-[10px] text-amber-500" /> : <i className="fa-solid fa-user text-[10px]" />}
                        </div>
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium text-[11px]">Sätze:</span>
                        <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                          {setsFormatted}
                        </span>
                      </div>

                      {typeof winnerDelta === 'number' && !isNaN(winnerDelta) && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-medium text-[11px]">Punkte:</span>
                          <span className="font-black text-[var(--color-primary)]">
                            +{Math.abs(winnerDelta).toFixed(1)} Pkt.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Empty state */
              <div className="p-4 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xs">
                  <i className="fa-regular fa-calendar-xmark" />
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                  Noch keine absolvierten Matches in der Hobbyliga. Trage das erste Spiel ein!
                </p>
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              {activeLeagues.length <= 1 ? (
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <i className="fa-solid fa-ranking-star text-[var(--color-primary)]"></i> Rangliste
                  </h3>
                  {activeLeagues[0] && (
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
                      {activeLeagues[0].name}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <i className="fa-solid fa-ranking-star text-[var(--color-primary)]"></i> Rangliste
                    </h3>
                  </div>

                  {/* League Switcher (Decoupled of gender icons, purely dynamic names) */}
                  {activeLeagues.length <= 3 ? (
                    <div className="relative flex items-center bg-slate-100 p-1 rounded-xl w-full">
                      {activeLeagues.map((league) => {
                        const isSelected = activeLeagueId === league.id;
                        return (
                          <button
                            key={league.id}
                            type="button"
                            onClick={() => setActiveLeagueId(league.id)}
                            className={
                              "relative z-10 flex-1 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 " +
                              (isSelected ? "text-slate-900 font-black" : "text-slate-500 hover:text-slate-700")
                            }
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="rankLeagueTabIndicator"
                                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/60"
                                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                              />
                            )}
                            <span className="relative z-10">{league.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="relative w-full">
                      <select
                        value={activeLeagueId}
                        onChange={(e) => setActiveLeagueId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                      >
                        {activeLeagues.map((league) => (
                          <option key={league.id} value={league.id}>
                            {league.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="p-3 w-12 text-center">Rang</th>
                    <th className="p-3">Spieler</th>
                    <th className="p-3 text-right">Punkte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSortedProfiles.map((p, index) => {
                    const isCurrentUser = p.userId === currentUser.id;
                    const rankNum = getUserRank(p.userId);
                    const isActivePlayer = p.active;
                    
                    return (
                      <tr 
                        key={p.userId} 
                        className={"border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors " + (isCurrentUser ? "bg-[var(--color-primary)]/5 " : "") + (!isActivePlayer ? "opacity-60" : "")}
                        onClick={() => {
                          if (p.userId === currentUser.id) {
                            setSelectedHistoryUser(currentUser);
                          } else {
                            const u = getUserObject(p.userId);
                            if (u) {
                              setSelectedContactUser(u);
                              setSelectedContactRank(rankNum);
                            }
                          }
                        }}
                      >
                        <td className="p-3 text-center">
                          {rankNum ? (
                            <span className="font-black text-slate-800 text-sm">{rankNum}</span>
                          ) : (
                            <span className="font-bold text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className={"font-bold " + (isActivePlayer ? "text-slate-800" : "text-slate-400")}>
                            {p.userName} {isCurrentUser && <span className="ml-1 text-[9px] bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-1 rounded uppercase tracking-wider font-black">DU</span>}
                          </div>
                          {isActivePlayer && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {p.matchesCount} {p.matchesCount === 1 ? "Match" : "Matches"}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className={"font-black " + (isActivePlayer ? "text-[var(--color-primary)]" : "text-slate-300")}>
                            {(p.livePoints ?? 0).toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {filteredSortedProfiles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 text-xs font-medium">Keine Spieler gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <LeagueResultDrawer
        isOpen={isResultDrawerOpen}
        onClose={() => setIsResultDrawerOpen(false)}
        currentUser={currentUser}
        profile={profile}
        allProfiles={allProfiles}
        defaultConfig={defaultConfig}
        prefilledMatchId={activeScheduledMatch ? activeScheduledMatch.id : undefined}
        prefilledOpponentId={activeScheduledMatch ? (activeScheduledMatch.player1UserId === currentUser.id ? activeScheduledMatch.player2UserId : activeScheduledMatch.player1UserId) : undefined}
        prefilledDate={activeScheduledMatch ? activeScheduledMatch.scheduledDate : undefined}
        onSuccess={() => {
          window.dispatchEvent(new Event('league-result-added'));
        }}
        getUserName={getUserName}
        leagueId={activeLeagueId}
      />
      {isPartnerModalOpen && (
        <PartnerSearchModal
          currentUser={currentUser}
          userRank={getUserRank(currentUser.id)}
          existingSearch={searchToEdit || currentUserSearch}
          onClose={() => {
            setIsPartnerModalOpen(false);
            setSearchToEdit(null);
          }}
          onSave={handleSavePartnerSearch}
          onDelete={() => handleDeletePartnerSearch(currentUser.id)}
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
    </div>
  );
}
