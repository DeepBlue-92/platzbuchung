import { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  LeaguePlayer, 
  LeagueMatch, 
  LeaguePartnerSearch, 
  DynamicLeague 
} from '../types';
import { 
  getLeagueProfile, 
  createLeagueProfile, 
  getAllLeagueProfiles,
  getPlayerMatches,
  getAllLeagueMatches,
  getLeaguePartnerSearches,
  getLeagueConfigVersions,
  joinDynamicLeague,
  listenToDynamicLeagues,
  isLeagueActiveDoc
} from '../services/league';
import { 
  getConfigForDate,
  LeaguePointConfig 
} from '../services/leagueEngine';
import { DEFAULT_DYNAMIC_LEAGUES, ClubSettings } from '../services/db';
import { getWaterfallAssignedLeague } from '../utils/playerHelper';

export const defaultLeagueConfig: LeaguePointConfig = {
  initialRankingPoints: 100,
  participationPoints: 5,
  maxBonusPoints: 45,
  logisticSteepnessK: 0.05,
  decayPointsPerWeek: 5,
};

export function useLeagueData(currentUser: User, clubId: string, settings?: ClubSettings) {
  const [profile, setProfile] = useState<LeaguePlayer | null>(null);
  const [allProfiles, setAllProfiles] = useState<LeaguePlayer[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [allClubMatches, setAllClubMatches] = useState<LeagueMatch[]>([]);
  const [partnerSearches, setPartnerSearches] = useState<LeaguePartnerSearch[]>([]);
  const [activeConfig, setActiveConfig] = useState<LeaguePointConfig>(defaultLeagueConfig);
  const [loading, setLoading] = useState(true);
  const [hasOptedIn, setHasOptedIn] = useState<boolean>(true);

  // Dynamic Leagues Configuration from DB/Firestore & settings fallback
  const [dynamicLeagues, setDynamicLeagues] = useState<DynamicLeague[]>(() => {
    if (settings?.leagueSettings?.leagues && settings.leagueSettings.leagues.length > 0) {
      return settings.leagueSettings.leagues;
    }
    return DEFAULT_DYNAMIC_LEAGUES;
  });

  useEffect(() => {
    const unsub = listenToDynamicLeagues((leagues) => {
      if (leagues && leagues.length > 0) {
        setDynamicLeagues(leagues);
      } else if (settings?.leagueSettings?.leagues && settings.leagueSettings.leagues.length > 0) {
        setDynamicLeagues(settings.leagueSettings.leagues);
      } else {
        setDynamicLeagues(DEFAULT_DYNAMIC_LEAGUES);
      }
    });
    return () => unsub();
  }, [settings]);

  // Only active leagues are available to players (status === 'active' or isActive === true / active === true)
  const activeLeagues: DynamicLeague[] = useMemo(() => {
    const active = dynamicLeagues.filter((l) => isLeagueActiveDoc(l));
    return active.length > 0 ? active : dynamicLeagues.filter((l) => isLeagueActiveDoc(l));
  }, [dynamicLeagues]);

  // Determine the waterfall-assigned league for the current user
  const waterfallLeague = useMemo(() => {
    return getWaterfallAssignedLeague(currentUser, activeLeagues);
  }, [currentUser, activeLeagues]);

  const [activeLeagueId, setActiveLeagueId] = useState<string>(() => {
    if (waterfallLeague?.id) return waterfallLeague.id;
    if (currentUser.leagueId && activeLeagues.some((l) => l.id === currentUser.leagueId)) {
      return currentUser.leagueId;
    }
    return activeLeagues[0]?.id || "open_mixed";
  });

  // Ensure activeLeagueId points to waterfall assigned league or valid active league
  useEffect(() => {
    if (waterfallLeague?.id) {
      setActiveLeagueId(waterfallLeague.id);
    } else if (activeLeagues.length > 0 && !activeLeagues.some((l) => l.id === activeLeagueId)) {
      setActiveLeagueId(activeLeagues[0].id);
    }
  }, [waterfallLeague?.id, activeLeagues]);

  const loadData = async () => {
    setLoading(true);
    try {
      const assignedTargetLeague = getWaterfallAssignedLeague(currentUser, activeLeagues);
      const targetLeagueId = assignedTargetLeague?.id || activeLeagues[0]?.id || "open_mixed";

      const executeWithTimeout = async <T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> => {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout fetching league data after ${timeoutMs}ms`)), timeoutMs)
        );
        return Promise.race([promise, timeoutPromise]);
      };

      let userProfile = await executeWithTimeout(getLeagueProfile(currentUser.id));
      if (!userProfile) {
        userProfile = await executeWithTimeout(createLeagueProfile(currentUser.id, clubId, defaultLeagueConfig.initialRankingPoints, targetLeagueId));
      } else if (!userProfile.leagueId || userProfile.leagueId !== targetLeagueId) {
        userProfile.leagueId = targetLeagueId;
        await executeWithTimeout(joinDynamicLeague(currentUser.id, targetLeagueId));
      }
      setProfile(userProfile);
      setHasOptedIn(true);
      setActiveLeagueId(targetLeagueId);
      
      const [profiles, userMatches, clubMatches, searches, configVersions] = await executeWithTimeout(Promise.all([
        getAllLeagueProfiles(),
        getPlayerMatches(currentUser.id),
        getAllLeagueMatches(),
        getLeaguePartnerSearches(),
        getLeagueConfigVersions()
      ]));

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
  };

  useEffect(() => {
    loadData();

    const handleResultAdded = () => loadData();
    window.addEventListener('league-result-added', handleResultAdded);
    return () => window.removeEventListener('league-result-added', handleResultAdded);
  }, [currentUser.id, clubId, activeLeagues]);

  const refreshPartnerSearches = async () => {
    try {
      const searches = await getLeaguePartnerSearches();
      setPartnerSearches(searches);
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinLeague = async (leagueId: string) => {
    try {
      await joinDynamicLeague(currentUser.id, leagueId);
      setActiveLeagueId(leagueId);
      setHasOptedIn(true);
      if (profile) {
        setProfile({ ...profile, leagueId });
      } else {
        const newProfile = await createLeagueProfile(currentUser.id, clubId, defaultLeagueConfig.initialRankingPoints, leagueId);
        setProfile(newProfile);
      }
      loadData();
    } catch (e) {
      console.error(e);
      alert('Fehler beim Beitritt zur Liga.');
    }
  };

  return {
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
    setPartnerSearches
  };
}
