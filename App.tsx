import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  PartyPopper,
  Medal,
  Trophy,
  UserPlus,
  Briefcase,
  BarChart3,
  Settings,
  ChevronDown,
  HelpCircle,
  Scale,
  ExternalLink,
  MoreHorizontal,
  CalendarRange,
  ArrowLeft,
  UserCog,
} from "lucide-react";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import AdminReports from "./components/AdminReports";
import AdminNews from "./components/AdminNews";
import AdminSettings from "./components/AdminSettings";
import AdminGuests from "./components/AdminGuests";
import Tournaments from "./components/Tournaments";
import RankingView from "./components/Ranking";
import Help from "./components/Help";
import Impressum from "./components/Impressum";
import Arbeitseinsaetze from "./components/Arbeitseinsaetze";
import ProfileModal from "./components/ProfileModal";
import MemberOnboardingModal from "./components/MemberOnboardingModal";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import { UserAvatar } from "./components/UserAvatar";
import ErrorBoundary from "./components/ErrorBoundary";
import { LeagueDashboard } from "./components/LeagueDashboard";
import { RichTextRenderer } from "./components/RichText";
import { User, Booking, Role, Tournament, RankingState, UserClub } from "./types";
import { getUserClubs, isClubAdmin, isSuperAdmin } from "./lib/userUtils";
import { calculateBookingFee, buildBookingFeeContext } from "./utils/guestFeeCalculator";
import { TIME_SLOTS } from "./constants";
import { loginWithUsername, logout, auth, db } from "./lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  listenToBookings,
  listenToPublicBookings,
  listenToTournaments,
  listenToSettings,
  listenToRankings,
  listenToUsers,
  listenToSystemUpdates,
  listenToClubs,
  ClubSettings,
  DEFAULT_SETTINGS,
  saveBooking,
  deleteBooking,
  saveTournament,
  updateTournament,
  deleteTournament,
  saveSettings,
  saveRankings,
  saveUser,
  deleteUserDoc,
  savePublicBookings,
  saveClearBookings,
} from "./services/db";
import { getVereinsIdByPublicToken } from "./services/db";
import { checkPlayerCollisionAsync } from "./services/collisionService";

const generateTestData = (): Booking[] => {
  return []; // We don't generate test data for Firebase automatically to avoid spamming
};

const App: React.FC = () => {
  const publicWochenplanToken = useMemo(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/public/calendar/")) {
      const remainder = path.split("/public/calendar/")[1] || "";
      const cleaned = remainder.replace(/^woche\//, "").split("/")[0].trim();
      return cleaned || null;
    }
    return null;
  }, []);
  
  const isPublicWochenplanRoute = !!publicWochenplanToken;

  const [publicTokenVereinsId, setPublicTokenVereinsId] = useState<string | null>(null);
  const [publicTokenError, setPublicTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (publicWochenplanToken) {
      getVereinsIdByPublicToken(publicWochenplanToken)
        .then(id => {
          if (id) {
            setPublicTokenVereinsId(id);
          } else {
            setPublicTokenError("Der eingegebene Token ist ungültig oder der Verein wurde nicht gefunden.");
            setIsLoading(false);
          }
        })
        .catch(err => {
          console.error("Error loading public token:", err);
          setPublicTokenError("Fehler beim Laden des öffentlichen Kalenders. Bitte versuchen Sie es später noch einmal.");
          setIsLoading(false);
        });
    } else {
      setPublicTokenError(null);
    }
  }, [publicWochenplanToken]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("v2_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
      if (!user) {
        setCurrentUser(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("v2_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("v2_current_user");
    }
  }, [currentUser]);

  const [users, setUsers] = useState<Record<string, User>>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [settings, setSettings] = useState<ClubSettings>(() => {
    try {
      const getInitVereinsId = (): string => {
        const params = new URLSearchParams(window.location.search);
        const tenantParam = params.get("tenant");
        if (tenantParam) return tenantParam.toLowerCase().replace(/\s/g, "");

        const segments = window.location.pathname.split("/").filter(Boolean);
        const rawPath = segments[0] || "";
        const path = decodeURIComponent(rawPath).toLowerCase().trim();
        if (
          path &&
          ![
            "api",
            "admin",
            "superadmin",
            "reservation",
            "reports",
            "tournaments",
            "ranking",
            "help",
            "guests",
            "adminsettings",
            "undefined",
            "null",
            "public",
            "assets",
            "static",
            "vite",
            "system",
            "super-admin",
          ].includes(path)
        ) {
          return path.replace(/\s/g, "");
        }

        const savedUserStr = localStorage.getItem("v2_current_user");
        if (savedUserStr) {
          const u = JSON.parse(savedUserStr);
          if (u?.vereinsId && u.vereinsId !== "super-admin" && u.vereinsId !== "system") {
            return u.vereinsId.toLowerCase().replace(/\s/g, "");
          }
        }
        return "sv-neuhausen";
      };

      const targetId = getInitVereinsId();
      const isNeuhausen = targetId.includes("neuhausen");

      // 1. Explicit switching target
      const switchingTargetStr = localStorage.getItem("v2_switching_target_club");
      if (switchingTargetStr) {
        const parsedTarget = JSON.parse(switchingTargetStr);
        if (parsedTarget?.vereinsId === targetId) {
          const clubCachedStr = localStorage.getItem(`v2_cached_settings_${targetId}`);
          const base = clubCachedStr ? JSON.parse(clubCachedStr) : DEFAULT_SETTINGS;
          return {
            ...base,
            ...parsedTarget,
            logoUrl: parsedTarget.logoUrl ?? (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : ""),
            headerLogoUrl: parsedTarget.logoUrl ?? (isNeuhausen ? DEFAULT_SETTINGS.headerLogoUrl : ""),
            clubName: parsedTarget.clubName || base.clubName,
            primaryColor: parsedTarget.primaryColor || base.primaryColor,
          };
        }
      }

      // 2. Scoped cached settings for this exact tenant
      const clubCachedStr = localStorage.getItem(`v2_cached_settings_${targetId}`);
      if (clubCachedStr) {
        const parsed = JSON.parse(clubCachedStr);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          logoUrl: parsed.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : ""),
          headerLogoUrl: parsed.headerLogoUrl || parsed.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.headerLogoUrl : ""),
        };
      }

      // 3. Scoped badge cache
      const cachedBadgeStr = localStorage.getItem(`v2_club_badge_${targetId}`);
      if (cachedBadgeStr) {
        const badgeObj = JSON.parse(cachedBadgeStr);
        return {
          ...DEFAULT_SETTINGS,
          vereinsId: targetId,
          clubName: badgeObj.clubName || (isNeuhausen ? "SV Neuhausen" : targetId),
          logoUrl: badgeObj.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : ""),
          headerLogoUrl: badgeObj.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.headerLogoUrl : ""),
          primaryColor: badgeObj.primaryColor || "#1b4332",
        };
      }

      // 4. Clubs cache
      const clubsCacheStr = localStorage.getItem("v2_clubs_cache");
      if (clubsCacheStr) {
        const clubsList = JSON.parse(clubsCacheStr);
        const matchedClub = clubsList.find((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "") === targetId);
        if (matchedClub) {
          const matchedLogo = matchedClub.customHeaderLogoUrl || matchedClub.headerLogoUrl || matchedClub.customLogoUrl || matchedClub.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : "");
          const matchedName = matchedClub.clubName || matchedClub.vereinsName || matchedClub.name || (isNeuhausen ? "SV Neuhausen" : targetId);
          return {
            ...DEFAULT_SETTINGS,
            vereinsId: targetId,
            clubName: matchedName,
            logoUrl: matchedLogo,
            headerLogoUrl: matchedLogo,
            primaryColor: matchedClub.primaryColor || "#1b4332",
          };
        }
      }

      // 5. General cached settings if matching
      const saved = localStorage.getItem("v2_cached_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.vereinsId === targetId || (!parsed?.vereinsId && isNeuhausen)) {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            logoUrl: parsed.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : ""),
            headerLogoUrl: parsed.headerLogoUrl || parsed.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.headerLogoUrl : ""),
          };
        }
      }

      return {
        ...DEFAULT_SETTINGS,
        vereinsId: targetId,
        clubName: isNeuhausen ? "SV Neuhausen" : targetId,
        logoUrl: isNeuhausen ? DEFAULT_SETTINGS.logoUrl : "",
        headerLogoUrl: isNeuhausen ? DEFAULT_SETTINGS.headerLogoUrl : "",
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [rankings, setRankings] = useState<RankingState | null>(null);

  const isLeagueEnabled = settings.modules?.league === true;

  const getInitialView = () => {
    let hash = window.location.hash.toLowerCase().replace("#", "") as any;
    if (!hash) {
      const params = new URLSearchParams(window.location.search);
      hash = params.get("view")?.toLowerCase() || "";
    }
    if (hash.startsWith("/events/") || hash.startsWith("events/") || hash.includes("events/")) {
      return "tournaments";
    }
    if (hash.includes("hobbyliga") || hash.includes("league") || hash.includes("punkte-system") || hash.includes("rules")) {
      return "league";
    }
    const allowedViews = [
      "reservation",
      "reports",
      "tournaments",
      "ranking",
      "help",
      "adminSettings",
      "guests",
      "league",
      "arbeitseinsaetze",
      "impressum",
    ];
    const cleanHash = hash.replace(/^\//, "");
    const matched = allowedViews.find((v) => v.toLowerCase() === cleanHash);
    if (matched) {
      return matched as any;
    }
    return "reservation";
  };

  const [highlightEventId, setHighlightEventId] = useState<string | null>(() => {
    const hash = window.location.hash;
    const match = hash.match(/#\/events\/([^?&]+)/) || hash.match(/events\/([^?&]+)/);
    return match ? match[1] : null;
  });
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const [view, setView] = useState<
    | "reservation"
    | "reports"
    | "tournaments"
    | "ranking"
    | "help"
    | "impressum"
    | "adminSettings"
    | "guests"
  >(getInitialView);
  const [mobileViewType, setMobileViewType] = useState<"day" | "week">(
    window.innerWidth < 1024 ? "day" : "week",
  );
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string>(() => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  });

  const getTodayStr = () => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  };

  const isMobileBackDisabled = (() => {
    const d = new Date(mobileSelectedDate);
    const step = mobileViewType === "day" ? 1 : 7;
    d.setDate(d.getDate() - step);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const targetDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 28);
    const minDateStr = `${minDate.getFullYear()}-${pad(minDate.getMonth() + 1)}-${pad(minDate.getDate())}`;

    return targetDateStr < minDateStr;
  })();

  const handleNavigateMobileDate = (amount: number) => {
    if (amount < 0 && isMobileBackDisabled) return;
    const d = new Date(mobileSelectedDate);
    const step = mobileViewType === "day" ? 1 : 7;
    d.setDate(d.getDate() + amount * step);
    const pad = (n: number) => n.toString().padStart(2, "0");
    setMobileSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  const getWeekDates = (dateStr: string) => {
    const dates: string[] = [];
    const curr = new Date(dateStr);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));
    const pad = (n: number) => n.toString().padStart(2, "0");
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      dates.push(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
    }
    return dates;
  };

  const [showMobileCalendar, setShowMobileCalendar] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] =
    useState<string>(mobileSelectedDate);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [adminSettingsDirty, setAdminSettingsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<
    | "reservation"
    | "reports"
    | "tournaments"
    | "ranking"
    | "help"
    | "impressum"
    | "adminSettings"
    | "guests"
    | null
  >(null);
  const [triggerAdminSave, setTriggerAdminSave] = useState(0);
  const [isWelcomeExpanded, setIsWelcomeExpanded] = useState(false);

  const handleSetView = (newView: typeof view) => {
    if (
      view === "adminSettings" &&
      adminSettingsDirty &&
      newView !== "adminSettings"
    ) {
      setPendingView(newView);
    } else {
      setView(newView);
    }
  };
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isMehrDropdownOpen, setIsMehrDropdownOpen] = useState(false);
  const mehrDropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMehrMouseEnter = () => {
    if (mehrDropdownTimeoutRef.current) {
      clearTimeout(mehrDropdownTimeoutRef.current);
      mehrDropdownTimeoutRef.current = null;
    }
    setIsMehrDropdownOpen(true);
  };

  const handleMehrMouseLeave = () => {
    if (mehrDropdownTimeoutRef.current) {
      clearTimeout(mehrDropdownTimeoutRef.current);
    }
    mehrDropdownTimeoutRef.current = setTimeout(() => {
      setIsMehrDropdownOpen(false);
    }, 200);
  };

  const closeMehrDropdown = () => {
    if (mehrDropdownTimeoutRef.current) {
      clearTimeout(mehrDropdownTimeoutRef.current);
      mehrDropdownTimeoutRef.current = null;
    }
    setIsMehrDropdownOpen(false);
  };

  useEffect(() => {
    return () => {
      if (mehrDropdownTimeoutRef.current) {
        clearTimeout(mehrDropdownTimeoutRef.current);
      }
    };
  }, []);
  const [showPublicHelp, setShowPublicHelp] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [superAdminContext, setSuperAdminContext] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("v2_superadmin_context");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [proxyUser, setProxyUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("v2_proxy_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (superAdminContext) {
      localStorage.setItem("v2_superadmin_context", JSON.stringify(superAdminContext));
    } else {
      localStorage.removeItem("v2_superadmin_context");
    }
  }, [superAdminContext]);

  useEffect(() => {
    if (proxyUser) {
      localStorage.setItem("v2_proxy_user", JSON.stringify(proxyUser));
    } else {
      localStorage.removeItem("v2_proxy_user");
    }
  }, [proxyUser]);

  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [userClubs, setUserClubs] = useState<UserClub[]>([]);
  const [isMobileClubDropdownOpen, setIsMobileClubDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isMoreMenuOpen) {
      setIsMobileClubDropdownOpen(false);
    }
  }, [isMoreMenuOpen]);

  // 1. Subscribe to active system clubs
  useEffect(() => {
    const unsub = listenToClubs((clubsList) => {
      const activeClubs = (clubsList || []).filter(
        (c) => c.aktiv !== false && c.vereinsId !== "super-admin" && c.vereinsId !== "system"
      );
      setAllClubs(activeClubs);
      try {
        localStorage.setItem("v2_clubs_cache", JSON.stringify(activeClubs));
        activeClubs.forEach((c) => {
          if (c.vereinsId) {
            const isNeuhausen = String(c.vereinsId).toLowerCase().includes("neuhausen");
            const logo = c.customHeaderLogoUrl || c.headerLogoUrl || c.customLogoUrl || c.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : "");
            const name = c.clubName || c.vereinsName || c.name || c.vereinsId;
            localStorage.setItem(`v2_club_badge_${c.vereinsId}`, JSON.stringify({
              vereinsId: c.vereinsId,
              clubName: name,
              logoUrl: logo,
              primaryColor: c.primaryColor || "#1b4332"
            }));
          }
        });
      } catch (e) {
        console.warn(e);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 2. Resolve user clubs when active user or system clubs change
  useEffect(() => {
    const activeUser = proxyUser || currentUser;
    if (!activeUser) {
      setUserClubs([]);
      return;
    }

    let isMounted = true;
    async function resolveClubs() {
      const clubMap = new Map<string, UserClub>();

      const resolveCleanName = (vId: string, matched: any, rawItem?: any): string => {
        const isUserDoc = rawItem && typeof rawItem === "object" && ('email' in rawItem || 'personId' in rawItem || 'username' in rawItem || 'firstName' in rawItem || ('role' in rawItem && !('clubName' in rawItem) && !('vereinsName' in rawItem)));
        
        const candidates = [
          matched?.name,
          matched?.shortName,
          matched?.abbreviation,
          matched?.clubName,
          matched?.vereinsName,
          typeof rawItem === "object" ? rawItem?.clubName : null,
          typeof rawItem === "object" ? rawItem?.vereinsName : null,
          (typeof rawItem === "object" && !isUserDoc) ? rawItem?.name : null,
          (typeof rawItem === "object" && !isUserDoc) ? rawItem?.shortName : null,
          (typeof rawItem === "object" && !isUserDoc) ? rawItem?.abbreviation : null,
        ];

        if (vId === currentVereinsId && settings?.clubName) {
          candidates.unshift(settings.clubName);
        }

        for (const cand of candidates) {
          if (typeof cand === "string" && cand.trim()) {
            const trimmed = cand.trim();
            if (!["api", "default", "system", "super-admin"].includes(trimmed.toLowerCase())) {
              return trimmed;
            }
          }
        }

        if (settings?.clubName && typeof settings.clubName === "string") {
          const trimmed = settings.clubName.trim();
          if (!["api", "default", "system", "super-admin"].includes(trimmed.toLowerCase())) {
            return trimmed;
          }
        }

        if (vId && typeof vId === "string" && !["api", "default", "system", "super-admin"].includes(vId.toLowerCase())) {
          return vId;
        }

        return "Verein";
      };

      const addClubToMap = (vId: string, matched: any, rawItem?: any, overrideRole?: Role) => {
        if (!vId) return;
        const normKey = String(vId).trim().toLowerCase().replace(/\s/g, "");
        if (!normKey || normKey === "super-admin" || normKey === "system") return;

        if (!clubMap.has(normKey)) {
          const isHomeClub = normKey === (activeUser.vereinsId || "").toLowerCase().replace(/\s/g, "");
          const resolvedRole = overrideRole || 
            (typeof rawItem === "object" ? rawItem?.role : undefined) || 
            (isHomeClub ? activeUser.role : Role.MITGLIED) || 
            Role.MITGLIED;

          clubMap.set(normKey, {
            id: vId,
            vereinsId: vId,
            clubName: resolveCleanName(vId, matched, rawItem),
            role: resolvedRole,
            is_tenant: !!matched,
            type: matched ? 'club' : 'unknown'
          });
        }
      };

      // A. Active user's current club
      if (activeUser.vereinsId && activeUser.vereinsId !== "super-admin" && activeUser.vereinsId !== "system") {
        const currentMatch = allClubs.find((c) => c.vereinsId === activeUser.vereinsId || c.id === activeUser.vereinsId);
        addClubToMap(activeUser.vereinsId, currentMatch, undefined, activeUser.role);
      }

      // B. Explicit user.clubs property
      if (Array.isArray(activeUser.clubs)) {
        activeUser.clubs.forEach((c: any) => {
          const vId = typeof c === "string" ? c : (c?.id || c?.vereinsId);
          if (vId) {
            const matched = allClubs.find((ac) => ac.vereinsId === vId || ac.id === vId);
            addClubToMap(vId, matched, c);
          }
        });
      }

      // B2. Explicit user.clubIds property (array of strings or objects)
      if (Array.isArray((activeUser as any).clubIds)) {
        (activeUser as any).clubIds.forEach((vId: any) => {
          const rawId = typeof vId === "string" ? vId : (vId?.id || vId?.vereinsId);
          if (rawId) {
            const matched = allClubs.find((ac) => ac.vereinsId === rawId || ac.id === rawId);
            addClubToMap(rawId, matched, typeof vId === "object" ? vId : undefined);
          }
        });
      }

      // C. Search Firestore 'users' and 'memberships' collections across all tenants
      try {
        const searchTasks = [];
        const normUsername = activeUser.name ? activeUser.name.toLowerCase().replace(/\s/g, "") : "";
        if (normUsername && normUsername !== "superadmin") {
          searchTasks.push(getDocs(query(collection(db, "users"), where("username", "==", normUsername))));
        }
        const cleanEmail = activeUser.email && !activeUser.is_placeholder_email && !activeUser.email.startsWith("no-email.") ? activeUser.email.trim() : "";
        if (cleanEmail) {
          searchTasks.push(getDocs(query(collection(db, "users"), where("email", "==", cleanEmail))));
          searchTasks.push(getDocs(query(collection(db, "memberships"), where("email", "==", cleanEmail))));
        }
        const pId = (activeUser as any).personId || activeUser.id;
        if (pId && !pId.includes("_")) {
          searchTasks.push(getDocs(query(collection(db, "users"), where("personId", "==", pId))));
          searchTasks.push(getDocs(query(collection(db, "memberships"), where("personId", "==", pId))));
          searchTasks.push(getDocs(query(collection(db, "memberships"), where("userId", "==", pId))));
        }

        if (searchTasks.length > 0) {
          const querySnaps = await Promise.all(searchTasks);
          querySnaps.forEach((snap) => {
            snap.docs.forEach((docSnap) => {
              const d = docSnap.data();
              const tenantId = d.tenantId || d.vereinsId || d.vereinId || d.clubId;
              if (tenantId) {
                const matched = allClubs.find((ac) => ac.vereinsId === tenantId || ac.id === tenantId);
                addClubToMap(tenantId, matched, d, d.role === "admin" ? Role.ADMIN : Role.MITGLIED);
              }
            });
          });
        }
      } catch (e) {
        console.warn("Error resolving multi-club user accounts:", e);
      }

      if (!isMounted) return;
      const resolvedList = Array.from(clubMap.values());
      setUserClubs(resolvedList);
    }

    resolveClubs();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.vereinsId, (currentUser as any)?.clubIds, proxyUser?.id, proxyUser?.name, proxyUser?.email, proxyUser?.vereinsId, (proxyUser as any)?.clubIds, allClubs]);

  const uniqueUserClubsRaw = useMemo(() => {
    const activeUser = proxyUser || currentUser;
    if (!activeUser) return [];

    const baseList = getUserClubs(activeUser, allClubs);

    // Merge any dynamically resolved clubs from Firestore queries
    if (userClubs && userClubs.length > 0) {
      userClubs.forEach((c) => {
        const cId = c.vereinsId || c.id;
        if (cId) {
          const normKey = String(cId).toLowerCase().replace(/\s/g, '');
          if (!baseList.some((existing) => String(existing.vereinsId).toLowerCase().replace(/\s/g, '') === normKey)) {
            baseList.push(c);
          }
        }
      });
    }

    return baseList.sort((a: any, b: any) => {
      const nameA = String(a.clubName || a.name || a.id || "").toLowerCase();
      const nameB = String(b.clubName || b.name || b.id || "").toLowerCase();
      return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
    });
  }, [userClubs, currentUser, proxyUser, allClubs]);

  const uniqueUserClubs = useMemo(() => {
    const isDirectSuperAdmin = !proxyUser && !superAdminContext && (
      currentUser?.role === Role.SUPER_ADMIN || 
      (currentUser as any)?.role === 'super-admin' || 
      currentUser?.vereinsId === 'super-admin'
    );

    // 1. Direct Super-Admin (when NOT in proxy mode): full access to ALL clubs in system
    if (isDirectSuperAdmin) {
      if (allClubs && allClubs.length > 0) {
        return allClubs.map((c) => {
          const vId = c.vereinsId || c.id;
          const cName = c.clubName || c.vereinsName || c.name || vId;
          const logo = c.customHeaderLogoUrl || c.headerLogoUrl || c.customLogoUrl || c.logoUrl;
          return {
            id: String(vId),
            vereinsId: String(vId),
            clubName: String(cName),
            logoUrl: logo,
            role: Role.SUPER_ADMIN,
            type: 'club',
            is_tenant: true,
          };
        }).sort((a, b) => a.clubName.localeCompare(b.clubName, 'de', { sensitivity: 'base' }));
      }
      return uniqueUserClubsRaw;
    }

    // 2. Normal user or Proxy User (Super-Admin impersonating a specific user):
    // In proxy mode, the app must strictly reflect the simulated user's actual clubs!
    return uniqueUserClubsRaw;
  }, [uniqueUserClubsRaw, currentUser, proxyUser, superAdminContext, allClubs]);

  const [loginForm, setLoginForm] = useState(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase() || "";
    const isSystemRoute = [
      "api",
      "admin",
      "superadmin",
      "reservation",
      "reports",
      "tournaments",
      "ranking",
      "help",
      "guests",
      "adminsettings",
      "undefined",
      "null",
      "public",
      "assets",
      "static",
      "vite",
      "system",
      "super-admin",
    ].includes(firstSegment);
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = urlParams.get("tenant");
    const resolvedVereinsId =
      firstSegment && !isSystemRoute
        ? firstSegment
        : tenantParam || "sv-neuhausen";
    return { username: "", password: "", vereinsId: resolvedVereinsId };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant") ? params.get("tenant")!.toLowerCase().replace(/\s/g, "") : null;
  });

  const isSuperadminRoute = useMemo(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const firstRoute = segments[0]?.toLowerCase();
    return firstRoute === "superadmin" || firstRoute === "admin";
  }, []);

  const anonymizedBookings = useMemo(() => {
    // Non-authenticated visitors strictly receive anonymized bookings (Option A)
    if (!currentUser) {
      return bookings.map((b) => ({
        ...b,
        title: "Belegt",
        players: Array.isArray(b.players) ? b.players.map(() => "Belegt") : ["Belegt"],
        comment: "",
        reason: "Belegt",
        type: "booking",
      }));
    }

    if (!isPublicWochenplanRoute) return bookings;
    if (settings?.publicCalendar?.showNames) return bookings;
    
    return bookings.map(b => ({
      ...b,
      title: "Belegt",
      players: Array.isArray(b.players) ? b.players.map(() => "Belegt") : ["Belegt"],
      comment: "",
      reason: "Belegt",
      type: "booking"
    }));
  }, [bookings, isPublicWochenplanRoute, settings?.publicCalendar?.showNames, currentUser]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateString = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push({
        day: d.getDate(),
        dateString,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateString = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push({
        day: i,
        dateString,
        isCurrentMonth: true,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateString = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push({
        day: i,
        dateString,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarMonth]);

  const currentVereinsId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = selectedTenantId || params.get("tenant");

    // If a regular user is logged in (not in SuperAdmin proxy session), ensure tenant matches user's clubs
    if (currentUser && currentUser.vereinsId && currentUser.vereinsId !== "super-admin" && !superAdminContext) {
      const userClubIds = (currentUser.clubs || []).map((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, ""));
      if (currentUser.vereinsId) {
        userClubIds.push(currentUser.vereinsId.toLowerCase().replace(/\s/g, ""));
      }
      if (tenantParam) {
        const cleanParam = tenantParam.toLowerCase().replace(/\s/g, "");
        if (userClubIds.includes(cleanParam)) {
          return cleanParam;
        }
      }
      return currentUser.vereinsId.toLowerCase().replace(/\s/g, "");
    }

    if (tenantParam) {
      return tenantParam.toLowerCase().replace(/\s/g, "");
    }

    if (publicWochenplanToken && publicTokenVereinsId) {
      return publicTokenVereinsId;
    }
    if (isPublicWochenplanRoute && !publicTokenVereinsId) {
      return ""; // Wait for token resolution
    }

    if (
      currentUser &&
      currentUser.vereinsId &&
      currentUser.vereinsId !== "super-admin"
    ) {
      return currentUser.vereinsId.toLowerCase().replace(/\s/g, "");
    }
    const segments = window.location.pathname.split("/").filter(Boolean);
    const rawPath = segments[0] || "";
    const path = decodeURIComponent(rawPath).toLowerCase().trim();
    if (
      path &&
      ![
        "api",
        "admin",
        "superadmin",
        "reservation",
        "reports",
        "tournaments",
        "ranking",
        "help",
        "guests",
        "adminsettings",
        "undefined",
        "null",
        "public",
        "assets",
        "static",
        "vite",
        "system",
        "super-admin",
      ].includes(path)
    ) {
      return path.replace(/\s/g, "");
    }
    return "sv-neuhausen";
  }, [currentUser, superAdminContext, publicWochenplanToken, publicTokenVereinsId, window.location.search]);

  const miniCalClubsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (allClubs && allClubs.length > 0) {
      allClubs.forEach((c) => {
        const cId = c.vereinsId || c.id;
        if (cId && !["super-admin", "system"].includes(String(cId).toLowerCase())) {
          map.set(String(cId).toLowerCase().replace(/\s/g, ""), {
            id: String(cId),
            name: c.clubName || c.vereinsName || c.name || String(cId),
          });
        }
      });
    }
    if (uniqueUserClubsRaw && uniqueUserClubsRaw.length > 0) {
      uniqueUserClubsRaw.forEach((c) => {
        const cId = c.vereinsId || c.id;
        if (cId && !["super-admin", "system"].includes(String(cId).toLowerCase())) {
          const key = String(cId).toLowerCase().replace(/\s/g, "");
          if (!map.has(key)) {
            map.set(key, {
              id: String(cId),
              name: c.clubName || c.vereinsName || c.name || String(cId),
            });
          }
        }
      });
    }
    if (currentVereinsId) {
      const key = currentVereinsId.toLowerCase().replace(/\s/g, "");
      if (!map.has(key)) {
        map.set(key, {
          id: currentVereinsId,
          name: settings?.clubName || currentVereinsId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [allClubs, uniqueUserClubsRaw, currentVereinsId, settings?.clubName]);

  const isAdmin = useMemo(() => {
    return isClubAdmin(currentUser, currentVereinsId, allClubs);
  }, [currentUser, currentVereinsId, allClubs]);

  // Initial Fallback
  useEffect(() => {
    if (!isPublicWochenplanRoute) {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("tenant") && currentVereinsId) {
        params.set("tenant", currentVereinsId);
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      }
    }
  }, [currentVereinsId, isPublicWochenplanRoute]);

  useEffect(() => {
    if (currentVereinsId && currentVereinsId !== "super-admin") {
      setMobileViewType(window.innerWidth < 1024 ? "day" : "week");
    }
  }, [currentVereinsId]);

  // Deep linking and Auth Guard Redirects
  useEffect(() => {
    const handleDeepLinking = () => {
      const hash = window.location.hash;
      const cleanHash = hash.replace("#", "").replace(/^\//, "");

      if (!currentUser) {
        // Redirection for guests
        if (cleanHash.startsWith("events/")) {
          window.location.hash = `/login?redirectTo=${encodeURIComponent("/" + cleanHash)}`;
        } else if (hash.includes("redirectTo=")) {
          const match = hash.match(/redirectTo=([^&]+)/);
          if (match) {
            setRedirectTo(decodeURIComponent(match[1]));
          }
        }
      } else {
        // Logged-in routing
        if (cleanHash.startsWith("events/")) {
          const match = cleanHash.match(/^events\/([^?&]+)/);
          if (match) {
            setHighlightEventId(match[1]);
          }
          setView((prev) => prev !== "tournaments" ? "tournaments" : prev);
        } else {
          const allowedViews = [
            "reservation",
            "reports",
            "tournaments",
            "ranking",
            "help",
            "adminSettings",
            "guests",
          ];
          const matched = allowedViews.find((v) => v.toLowerCase() === cleanHash.toLowerCase());
          if (matched) {
            setView((prev) => prev !== matched ? (matched as any) : prev);
          }
        }
      }
    };

    handleDeepLinking();
    window.addEventListener("hashchange", handleDeepLinking);
    return () => window.removeEventListener("hashchange", handleDeepLinking);
  }, [currentUser]);

  // Synchronise view changes with URL hash
  useEffect(() => {
    if (view) {
      if (view === "tournaments" && highlightEventId) {
        const expectedHash = `/events/${highlightEventId}`;
        const cleanHash = window.location.hash.replace("#", "");
        if (cleanHash !== expectedHash) {
          window.location.hash = expectedHash;
        }
      } else {
        const currentHash = window.location.hash.toLowerCase().replace("#", "").replace(/^\//, "");
        if (view === "league" && (currentHash.includes("hobbyliga") || currentHash.includes("punkte-system") || currentHash.includes("rules"))) {
          return;
        }
        if (currentHash !== view.toLowerCase() && !currentHash.startsWith("events/")) {
          // If view is reservation and hash is empty, keep URL clean without appending #reservation
          if (view === "reservation" && (currentHash === "" || currentHash === "#")) {
            return;
          }
          window.location.hash = view.toLowerCase();
        }
      }
    }
  }, [view, highlightEventId]);

  // Clear event highlight when leaving tournaments view
  useEffect(() => {
    if (view !== "tournaments") {
      setHighlightEventId(null);
    }
  }, [view]);

  // Fallback for guests module permission
  useEffect(() => {
    if (view === "guests") {
      if (!currentUser || (!isAdmin && settings.modules?.guests === false)) {
        setView("reservation");
      }
    }
  }, [view, currentUser, isAdmin, settings.modules]);

  useEffect(() => {
    if (
      currentUser &&
      currentUser.vereinsId &&
      currentUser.vereinsId !== "super-admin" &&
      currentUser.vereinsId !== "system" &&
      currentUser.role !== Role.SUPER_ADMIN &&
      (currentUser as any).role !== "super-admin" &&
      !superAdminContext
    ) {
      const path = window.location.pathname
        .replace(/^\/+/g, "")
        .replace(/\/+$/g, "")
        .trim()
        .toLowerCase();
      const isSystemRoute = [
        "api",
        "admin",
        "superadmin",
        "reservation",
        "reports",
        "tournaments",
        "ranking",
        "help",
        "guests",
        "adminsettings",
        "undefined",
        "null",
        "public",
        "assets",
        "static",
        "vite",
        "system",
        "super-admin",
        "",
      ].includes(path);

      // Check if user belongs to this path's club (multi-club membership)
      const userClubList = Array.isArray(userClubs) && userClubs.length > 0 ? userClubs : (currentUser.clubs || []);
      const isMemberOfPathClub = Array.isArray(userClubList) && userClubList.some((c: any) => {
        const v = typeof c === "string" ? c : (c.id || c.vereinsId);
        return v && String(v).toLowerCase().replace(/\s/g, "") === path;
      });

      if (
        path &&
        !isSystemRoute &&
        path !== currentUser.vereinsId.toLowerCase().trim() &&
        !isMemberOfPathClub
      ) {
        console.warn(
          `Tenant mismatch: Logged in as ${currentUser.vereinsId}, but URL is /${path}. Forcing logout.`,
        );
        logout()
          .then(() => {
            setProxyUser(null);
            setSuperAdminContext(null);
            setCurrentUser(null);
          })
          .catch((err) => {
            console.error(err);
            setCurrentUser(null);
          });
      }
    }
  }, [currentUser, superAdminContext, userClubs]);

  useEffect(() => {
    let unsubs: Array<() => void> = [];
    let isMounted = true;

    // Safety timeout: If Firebase takes too long to respond (e.g. offline or connectivity issue in sandbox),
    // stop showing the loader and render with default settings. It will update as soon as the connection resolves.
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 3500);

    if (currentVereinsId) {
      if (isPublicWochenplanRoute && isSettingsLoaded && settings) {
        const type = settings.publicCalendar?.showNames ? "klarnamen" : "anonymisiert";
        unsubs.push(listenToPublicBookings(currentVereinsId, type, setBookings));
      } else if (currentUser && isAuthReady && auth.currentUser) {
        unsubs.push(listenToBookings(currentVereinsId, setBookings));
        unsubs.push(listenToTournaments(currentVereinsId, setTournaments));
        unsubs.push(listenToRankings(currentVereinsId, (r) => setRankings(r)));
        unsubs.push(listenToUsers(currentVereinsId, setUsers));
      }

      unsubs.push(
        listenToSettings(currentVereinsId, (s) => {
          if (!isMounted) return;
          clearTimeout(safetyTimeout);
          setSettings(s);
          try {
            localStorage.setItem(`v2_cached_settings_${currentVereinsId}`, JSON.stringify(s));
            localStorage.setItem("v2_cached_settings", JSON.stringify(s));
            localStorage.removeItem("v2_switching_target_club");
          } catch (e) {
            console.error(e);
          }
          setIsSettingsLoaded(true);
          setIsLoading(false);

          // Update favicon and title dynamically
          const href = s.customFaviconUrl || s.faviconUrl || "/favicon.svg";
          let link = document.querySelector(
            "link[rel~='icon']",
          ) as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = href;
          document.title = s.clubName
            ? s.clubName + " Tennis"
            : "Platzreservierung";
        }),
      );
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubs.forEach((u) => u());
    };
  }, [currentUser, currentVereinsId, isPublicWochenplanRoute, isAuthReady, isSettingsLoaded, settings?.publicCalendar?.showNames]);

  // Keep the public anonymized and clear-name feeds synchronized in the background whenever bookings change
  useEffect(() => {
    if (currentUser && isAuthReady && auth.currentUser && bookings && settings) {
      const getSevenDaysAgoStr = () => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      const getAnonymizedBookingsList = () => {
        const sevenDaysAgo = getSevenDaysAgoStr();
        const filtered = bookings.filter((b) => b.date >= sevenDaysAgo);
        return filtered.map((b) => {
          const anonymizedPlayers = Array.isArray(b.players)
            ? b.players.map((_, idx) => `Spieler ${idx + 1}`)
            : [];
          return {
            id: b.id,
            date: b.date,
            time: b.time,
            court: b.court,
            isLocked: b.isLocked || false,
            hasBallMachine: b.hasBallMachine || false,
            players: anonymizedPlayers,
            reason: b.isLocked ? b.reason || "Sperre" : "Privatspiel",
          };
        });
      };

      const getClearBookingsList = () => {
        const sevenDaysAgo = getSevenDaysAgoStr();
        const filtered = bookings.filter((b) => b.date >= sevenDaysAgo);
        return filtered.map((b) => {
          return {
            id: b.id,
            date: b.date,
            time: b.time,
            court: b.court,
            isLocked: b.isLocked || false,
            hasBallMachine: b.hasBallMachine || false,
            players: Array.isArray(b.players) ? b.players : [],
            reason: b.isLocked ? b.reason || "Sperre" : "Privatspiel",
          };
        });
      };

      const syncPublicFeed = async () => {
        if (!auth.currentUser) return; // Prevent syncing if user logged out during timeout
        try {
          if (settings.feedAnonEnabled) {
            const list = getAnonymizedBookingsList();
            await savePublicBookings(currentVereinsId, list);
          } else {
            await savePublicBookings(currentVereinsId, []);
          }

          if (settings.feedRealEnabled) {
            const list = getClearBookingsList();
            await saveClearBookings(currentVereinsId, list);
          } else {
            await saveClearBookings(currentVereinsId, []);
          }
          console.log("Public feeds synchronized automatically.");
        } catch (err) {
          console.error("Failed to auto-sync public feeds:", err);
        }
      };

      const timer = setTimeout(() => {
        syncPublicFeed();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [bookings, currentUser, currentVereinsId, settings, isAuthReady]);

  const handleDismissOnboardingHints = async () => {
    if (!currentUser) return;
    const updatedUser: User = {
      ...currentUser,
      show_onboarding_hints: false,
    };
    setCurrentUser(updatedUser);
    if (currentVereinsId) {
      try {
        await saveUser(currentVereinsId, updatedUser);
      } catch (err) {
        console.error("Fehler beim Speichern der Onboarding-Einstellung:", err);
      }
    }
  };

  // Prevent body/html scrolling on the login page (mobile and desktop)
  useEffect(() => {
    if (!currentUser) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100vw";
      document.body.style.height = "100vh";
      document.body.style.height = "100dvh";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, [currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const u = await loginWithUsername(
        loginForm.username,
        loginForm.password,
        currentVereinsId,
      );
      setCurrentUser(u);
      setError("");
      setShowPublicHelp(false);

      // Synchronize tenant URL param with logged in user's club
      if (u.vereinsId && u.role !== Role.SUPER_ADMIN) {
        const params = new URLSearchParams(window.location.search);
        const currentParam = params.get("tenant");
        const userClubIds = (u.clubs || []).map((c: any) => (c.vereinsId || c.id || '').toLowerCase().replace(/\s/g, ""));
        const targetTenant = (currentParam && userClubIds.includes(currentParam.toLowerCase().replace(/\s/g, "")))
          ? currentParam.toLowerCase().replace(/\s/g, "")
          : u.vereinsId.toLowerCase().replace(/\s/g, "");
        
        if (params.get("tenant") !== targetTenant) {
          params.set("tenant", targetTenant);
          window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
        }
      }

      // Deep Link Redirection
      const hash = window.location.hash;
      let targetPath = redirectTo;
      if (!targetPath) {
        const match = hash.match(/redirectTo=([^&]+)/);
        if (match) {
          targetPath = decodeURIComponent(match[1]);
        }
      }

      if (targetPath && (targetPath.startsWith("/events/") || targetPath.startsWith("events/") || targetPath.includes("events/"))) {
        const eventId = targetPath.replace(/^\/?events\//, "");
        setHighlightEventId(eventId);
        setView("tournaments");
        window.location.hash = `#/events/${eventId}`;
      } else {
        setView("reservation");
        if (window.location.hash.includes("redirectTo=") || window.location.hash.includes("login")) {
          window.location.hash = "";
        }
      }
    } catch (err: any) {
      setError(err.message || "Benutzername oder Passwort falsch.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setProxyUser(null);
    setSuperAdminContext(null);
    setCurrentUser(null);
  };

  const handleSwitchClub = (newVereinsId: string) => {
    if (!newVereinsId || newVereinsId === currentVereinsId) return;

    const normNewId = newVereinsId.toLowerCase().replace(/\s/g, "");

    // Security check: In proxy mode or as regular user, strictly allow switching ONLY to assigned clubs!
    const isDirectSuperAdmin = !superAdminContext && !proxyUser && (
      currentUser?.role === Role.SUPER_ADMIN || 
      (currentUser as any)?.role === 'super-admin' || 
      currentUser?.vereinsId === 'super-admin'
    );

    if (!isDirectSuperAdmin) {
      const allowedClubs = (uniqueUserClubs || []).map((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, ""));
      const userObjClubs = (currentUser?.clubs || []).map((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, ""));
      if (currentUser?.vereinsId) {
        userObjClubs.push(currentUser.vereinsId.toLowerCase().replace(/\s/g, ""));
      }
      const allAllowed = Array.from(new Set([...allowedClubs, ...userObjClubs]));
      if (!allAllowed.includes(normNewId)) {
        console.warn("Blocked attempt to switch to unassigned club in proxy/user mode:", normNewId);
        return;
      }
    }

    const isNeuhausen = normNewId.includes("neuhausen");

    // Lookup target club metadata
    const targetClub = allClubs.find((c) => {
      const v = (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "");
      return v === normNewId;
    }) || userClubs.find((c) => {
      const v = (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "");
      return v === normNewId;
    });

    const targetLogo = targetClub?.customHeaderLogoUrl || targetClub?.headerLogoUrl || targetClub?.customLogoUrl || targetClub?.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : "");
    const targetName = targetClub?.clubName || targetClub?.vereinsName || targetClub?.name || resolveClubName(normNewId, isNeuhausen ? "SV Neuhausen" : undefined, allClubs);
    const targetColor = targetClub?.primaryColor || "#1b4332";

    try {
      const targetMeta = {
        vereinsId: normNewId,
        clubName: targetName,
        logoUrl: targetLogo,
        primaryColor: targetColor,
      };
      localStorage.setItem("v2_switching_target_club", JSON.stringify(targetMeta));
      localStorage.setItem(`v2_club_badge_${normNewId}`, JSON.stringify(targetMeta));

      const existingCached = localStorage.getItem(`v2_cached_settings_${normNewId}`);
      const baseObj = existingCached ? JSON.parse(existingCached) : {};
      const newCached = {
        ...DEFAULT_SETTINGS,
        ...baseObj,
        ...(targetClub || {}),
        clubName: targetName,
        vereinsId: normNewId,
        logoUrl: targetLogo,
        headerLogoUrl: targetLogo,
        primaryColor: targetColor,
      };
      localStorage.setItem(`v2_cached_settings_${normNewId}`, JSON.stringify(newCached));
      localStorage.setItem("v2_cached_settings", JSON.stringify(newCached));
    } catch (e) {
      console.warn("Error caching switch club:", e);
    }

    setSettings((prev) => ({
      ...prev,
      clubName: targetName,
      vereinsId: normNewId,
      logoUrl: targetLogo,
      headerLogoUrl: targetLogo,
      primaryColor: targetColor,
    }));
    setIsLoading(true);

    setSelectedTenantId(normNewId);
    const params = new URLSearchParams(window.location.search);
    params.set("tenant", normNewId);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    setIsLoading(false);
  };

  const handleSuperAdminLoginAs = (tenantAdmin: User, targetClubId?: string) => {
    setSuperAdminContext(currentUser);

    // Validate and sanitize targetClubId against user's actual database clubs
    const assignedClubIds = (tenantAdmin.clubs || []).map((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, ""));
    if (tenantAdmin.vereinsId) assignedClubIds.push(tenantAdmin.vereinsId.toLowerCase().replace(/\s/g, ""));

    let safeTargetClubId = targetClubId;
    if (safeTargetClubId) {
      const normSafe = safeTargetClubId.toLowerCase().replace(/\s/g, "");
      if (assignedClubIds.length > 0 && !assignedClubIds.includes(normSafe)) {
        safeTargetClubId = tenantAdmin.vereinsId || assignedClubIds[0];
      }
    } else {
      safeTargetClubId = tenantAdmin.vereinsId || assignedClubIds[0] || "sv-neuhausen";
    }

    const userToSet = safeTargetClubId ? { ...tenantAdmin, vereinsId: safeTargetClubId } : tenantAdmin;
    setCurrentUser(userToSet);
    
    // Clubs des Proxy-Users laden, damit das Header-Dropdown korrekt aktualisiert wird
    const resolvedProxyClubs = getUserClubs(userToSet, allClubs);
    setUserClubs(resolvedProxyClubs);

    setProxyUser(null);
    setView("reservation");

    // Synchronisiere Tenant State für Proxy-Sitzung
    const targetTenantId = safeTargetClubId || tenantAdmin.vereinsId;
    if (targetTenantId) {
      const normId = targetTenantId.toLowerCase().replace(/\s/g, "");
      const isNeuhausen = normId.includes("neuhausen");
      const targetClub = allClubs.find((c) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "") === normId);
      const targetLogo = targetClub?.customHeaderLogoUrl || targetClub?.headerLogoUrl || targetClub?.customLogoUrl || targetClub?.logoUrl || (isNeuhausen ? DEFAULT_SETTINGS.logoUrl : "");
      const targetName = targetClub?.clubName || targetClub?.vereinsName || targetClub?.name || resolveClubName(targetTenantId, isNeuhausen ? "SV Neuhausen" : undefined, allClubs);
      const targetColor = targetClub?.primaryColor || "#1b4332";

      try {
        const targetMeta = {
          vereinsId: normId,
          clubName: targetName,
          logoUrl: targetLogo,
          primaryColor: targetColor,
        };
        localStorage.setItem("v2_switching_target_club", JSON.stringify(targetMeta));
        localStorage.setItem(`v2_club_badge_${normId}`, JSON.stringify(targetMeta));
      } catch {}

      const params = new URLSearchParams(window.location.search);
      params.set("tenant", targetTenantId);
      window.location.search = params.toString();
    }
  };

  const handleBook = async (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    players: string[],
    hasBallMachine: boolean,
    guestCount?: number,
    deleteId?: string,
    comment?: string,
  ): Promise<string | null> => {
    const startIndex = TIME_SLOTS.indexOf(startTime);
    const endIndex = TIME_SLOTS.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex)
      return "Ungültiger Zeitraum.";
    const slotsToBook = TIME_SLOTS.slice(startIndex, endIndex);

    const bookingUser = proxyUser || currentUser;
    const editingBooking = deleteId ? bookings.find((b) => b.id === deleteId) : null;
    const editingGroupToken = editingBooking?.group_token;

    // -------------------------------------------------------------------------
    // Player-Level Collision Detection (Cross-Facility & Cross-League Overlap Check)
    // -------------------------------------------------------------------------
    const playerCollision = await checkPlayerCollisionAsync({
      date,
      startTime,
      endTime,
      players: [bookingUser, ...(players || [])].filter(Boolean),
      editingBookingId: deleteId,
      editingGroupToken,
      currentClubId: currentVereinsId,
      currentClubBookings: bookings,
      knownClubIds: (allClubs || []).map((c: any) => c.vereinsId || c.id).filter(Boolean),
    });

    if (playerCollision) {
      return playerCollision.errorMessage;
    }

    const getSlotDateTime = (dStr: string, tStr: string): Date => {
      const [yr, mon, day] = dStr.split("-").map(Number);
      const [hr, min] = tStr.split(":").map(Number);
      return new Date(yr, mon - 1, day, hr, min, 0, 0);
    };

    // Reservation Rules Checks
    const isPrivilegedUser =
      bookingUser?.role === Role.ADMIN ||
      bookingUser?.role === Role.SUPER_ADMIN ||
      bookingUser?.role === "super-admin" ||
      bookingUser?.hauptAdmin === true;
    if (!isPrivilegedUser) {
      if (settings.modules?.guests === false && guestCount && guestCount > 0) {
        return "Gastspieler sind derzeit nicht erlaubt.";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const now = new Date();

      // Check booking in the past
      const allowPast = settings.reservationRules?.allowPastBookings ?? true;
      if (!allowPast) {
        for (const time of slotsToBook) {
          if (getSlotDateTime(date, time) < now) {
            return "Buchungen dürfen nicht in der Vergangenheit getätigt werden.";
          }
        }

        // Check editing past booking
        if (deleteId) {
          const existing = bookings.find((b) => b.id === deleteId);
          if (existing) {
            const existingSlotTime = getSlotDateTime(
              existing.date,
              existing.time,
            );
            if (existingSlotTime < now) {
              return "Vergangene Buchungen dürfen nicht verschoben oder bearbeitet werden.";
            }
          }
        }
      }

      const isLeagueGame = comment?.includes("[Ligaspiel]");
      const bypassLimits = isLeagueGame && (settings.reservationRules.bypassRestrictionsForLeagueGames === true);

      // Check max weeks in advance
      const maxWeeks = settings.reservationRules?.maxAdvanceWeeks ?? 2;
      if (!bypassLimits && maxWeeks > 0) {
        const maxDaysInAdvance = maxWeeks * 7;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + maxDaysInAdvance);
        limitDate.setHours(23, 59, 59, 999);

        if (getSlotDateTime(date, startTime) > limitDate) {
          return `Buchungen als Spieler sind maximal ${maxWeeks} ${maxWeeks === 1 ? "Woche" : "Wochen"} im Voraus erlaubt.`;
        }
      }

      // Check opening hours for this day of the week
      const targetDateObj = new Date(date);
      const weekday = targetDateObj.getDay(); // 0 is Sunday, ..., 6 is Saturday
      const dayRule = settings.reservationRules?.openingHours?.[
        String(weekday)
      ] || { start: "08:00", end: "21:00", closed: false };

      if (dayRule.closed) {
        return `Buchungen am ${["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][weekday]} sind nicht möglich (geschlossen).`;
      }

      const ruleStartIdx = TIME_SLOTS.indexOf(dayRule.start || "08:00");
      const ruleEndIdx = TIME_SLOTS.indexOf(dayRule.end || "21:00");

      for (const slotTime of slotsToBook) {
        const slotIdx = TIME_SLOTS.indexOf(slotTime);
        if (slotIdx < ruleStartIdx || slotIdx >= ruleEndIdx) {
          return `Buchungen um ${slotTime} Uhr sind am ${["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][weekday]} außerhalb der Öffnungszeiten (${dayRule.start} bis ${dayRule.end} Uhr).`;
        }
      }

      const fullName = bookingUser
        ? bookingUser.firstName || bookingUser.lastName
          ? `${bookingUser.firstName || ""} ${bookingUser.lastName || ""}`.trim()
          : bookingUser.name
        : "";

      // Check active bookings count
      const activeUserBookings = bookings.filter((b) => {
        if (deleteId && b.id === deleteId) return false;
        if (editingGroupToken && b.group_token === editingGroupToken) return false;
        if (new Date(b.date) < today) return false;
        return (
          b.players.includes(bookingUser?.name || "") ||
          b.players.includes(fullName)
        );
      });

      const maxActive = settings.reservationRules.maxActiveBookings;
      if (
        !deleteId &&
        !bypassLimits &&
        maxActive > 0 &&
        activeUserBookings.length + slotsToBook.length > maxActive
      ) {
        return `Du hast bereits das Limit von ${maxActive} aktiven Buchungen (Slots) pro Woche erreicht.`;
      }

      // Check bookings count per day for the target date
      const bookingsOnTargetDay = bookings.filter((b) => {
        if (deleteId && b.id === deleteId) return false;
        if (editingGroupToken && b.group_token === editingGroupToken) return false;
        if (b.date !== date) return false;
        return (
          b.players.includes(bookingUser?.name || "") ||
          b.players.includes(fullName)
        );
      });

      const maxPerDay = settings.reservationRules.maxBookingsPerDay ?? 2;
      if (
        !deleteId &&
        !bypassLimits &&
        maxPerDay > 0 &&
        bookingsOnTargetDay.length + slotsToBook.length > maxPerDay
      ) {
        return `Du darfst maximal ${maxPerDay} Buchungen (Slots) pro Tag vornehmen.`;
      }

      // Check weekly booking limit for target week
      const maxPerWeek = settings.reservationRules.maxBookingsPerWeek ?? 0;
      if (!deleteId && !bypassLimits && maxPerWeek > 0) {
        // Calculate Monday and Sunday of target date's week
        const targetD = new Date(date);
        const dayOfWeek = targetD.getDay(); // 0 is Sunday, 1 is Monday...
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        const monday = new Date(targetD);
        monday.setDate(targetD.getDate() + daysToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const formatYMD = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dy}`;
        };
        const mondayStr = formatYMD(monday);
        const sundayStr = formatYMD(sunday);
        
        const bookingsOnTargetWeek = bookings.filter((b) => {
          if (deleteId && b.id === deleteId) return false;
          if (editingGroupToken && b.group_token === editingGroupToken) return false;
          if (b.date < mondayStr || b.date > sundayStr) return false;
          return (
            b.players.includes(bookingUser?.name || "") ||
            b.players.includes(fullName)
          );
        });

        if (bookingsOnTargetWeek.length + slotsToBook.length > maxPerWeek) {
          return `Du darfst maximal ${maxPerWeek} Buchungen (Slots) pro Woche vornehmen.`;
        }
      }
    }

    const rangeLocks = settings.rangeLocks || [];
    const recurringLocks = settings.recurringLocks || [];

    for (const time of slotsToBook) {
      if (isPrivilegedUser) {
        // 1. Check existing database bookings (excluding the one being updated via deleteId)
        const existingBooking = bookings.find(
          (b) =>
            b.id !== deleteId &&
            b.date === date &&
            b.time === time &&
            b.court === court,
        );
        if (existingBooking) {
          // If it's a regular booking OR if it is a lock but also an event (series booking), we cannot book over it.
          if (!existingBooking.isLocked || existingBooking.isEvent) {
            return `Besetzt um ${time} Uhr.`;
          }
        }

        // 2. Check Range Locks in settings. If there's an active range lock that is an event, we cannot overrides.
        const hasRangeEvent = rangeLocks.some((l) => {
          if (!l.courts.includes(court)) return false;
          if (date < l.startDate || date > l.endDate) return false;
          const sTime = l.startTime || "00:00";
          const eTime = l.endTime || "24:00";
          if (date === l.startDate && time < sTime) return false;
          if (date === l.endDate && time >= eTime) return false;
          return l.isEvent; // Occupied if it's an event (series booking)
        });
        if (hasRangeEvent) {
          return `Besetzt um ${time} Uhr (Serientermin).`;
        }

        // 3. Check Recurring Locks in settings. If there's an active recurring lock that is an event, we cannot overrides.
        const hasRecurringEvent = recurringLocks.some((l) => {
          const d = new Date(date);
          const day = d.getDay();
          if (day !== l.dayOfWeek) return false;
          if (!l.courts.includes(court)) return false;
          if (time < l.startTime || time >= l.endTime) return false;
          if (!l.isOngoing) {
            if (l.startDate && date < l.startDate) return false;
            if (l.endDate && date > l.endDate) return false;
          }
          return l.isEvent; // Occupied if it's an event (series booking)
        });
        if (hasRecurringEvent) {
          return `Besetzt um ${time} Uhr (Serientermin).`;
        }
      } else {
        // Standard user: any existing booking or manual lock blocks booking
        if (
          bookings.find(
            (b) =>
              b.id !== deleteId &&
              b.date === date &&
              b.time === time &&
              b.court === court,
          )
        ) {
          return `Besetzt um ${time} Uhr.`;
        }
      }

      if (hasBallMachine) {
        const ballMachinesInUse = bookings.filter(
          (b) =>
            b.id !== deleteId &&
            b.date === date &&
            b.time === time &&
            b.hasBallMachine,
        ).length;
        const maxMachines =
          settings.reservationRules.availableBallMachines ?? 1;
        if (ballMachinesInUse >= maxMachines) {
          return `Um ${time} Uhr sind bereits alle ${maxMachines} Ballmaschinen reserviert.`;
        }
      }
    }

    let updatedBookings = deleteId
      ? bookings.filter((b) => b.id !== deleteId && (!editingGroupToken || b.group_token !== editingGroupToken))
      : bookings;
    const groupToken = "group_" + Math.random().toString(36).substr(2, 9);
    const newBookings: Booking[] = slotsToBook.map((time) => {
      const isGuest =
        (guestCount && guestCount > 0) ||
        players.some(
          (p) =>
            p.toLowerCase().includes("gastspieler") ||
            p.toLowerCase().includes("gast"),
        );
      const b: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        date,
        time,
        court,
        players,
        guestCount,
        isLocked: false,
        hasBallMachine,
        bookedBy: bookingUser?.id,
        comment,
        group_token: groupToken,
      };
      if (isGuest) {
        const feeCtx = buildBookingFeeContext({
          court,
          players,
          guestCount,
          date,
          time,
          durationMinutes: 60,
        });
        const feeRes = calculateBookingFee(feeCtx, settings.feeSettings, settings.reservationRules);
        b.guestFee = feeRes.ratePerUnitEuro;
        b.guestBillingMode = feeRes.action.type === "PER_COURT_HOUR" ? "per_court" : "per_player";
        b.calculatedFeeCents = feeRes.totalCents;
        b.appliedFeeRuleId = feeRes.matchedRuleId;
        b.appliedFeeRuleName = feeRes.matchedRuleName;
        b.feeCalculationMode = feeRes.mode;
      }
      if (superAdminContext) {
        b.createdBy = bookingUser
          ? bookingUser.name || bookingUser.id
          : "unbekannt";
        b.actionPerformedBy = superAdminContext.name || "superadmin";
        b.impersonatedBy = superAdminContext.name || "superadmin";
      } else {
        b.createdBy = bookingUser
          ? bookingUser.name || bookingUser.id
          : "unbekannt";
        b.actionPerformedBy = bookingUser
          ? bookingUser.name || bookingUser.id
          : "unbekannt";
      }
      return b;
    });

    const savedNewBookingIds: string[] = [];
    try {
      // 1. Alle neuen Slots nacheinander speichern
      for (const b of newBookings) {
        await saveBooking(currentVereinsId, b);
        savedNewBookingIds.push(b.id);
      }

      // 2. Falls der Admin über manuell erstellte DB-Sperren drüber bucht, löschen wir diese manuellen Sperren aus der DB
      if (isPrivilegedUser) {
        const locksToDelete = bookings.filter(
          (b) =>
            b.date === date &&
            slotsToBook.includes(b.time) &&
            b.court === court &&
            b.isLocked &&
            !b.isEvent,
        );
        for (const l of locksToDelete) {
          await deleteBooking(currentVereinsId, l.id);
        }
      }

      // 3. Erst NACH erfolgreichem Speichern der neuen Slots die alte Buchung löschen (Transaktions- & Rollback-Sicherheit)
      if (deleteId) {
        if (editingGroupToken) {
          const groupToCancel = bookings.filter((b) => b.group_token === editingGroupToken);
          for (const b of groupToCancel) {
            await deleteBooking(currentVereinsId, b.id);
          }
        } else {
          await deleteBooking(currentVereinsId, deleteId);
        }
      }
    } catch (err: any) {
      // Rollback neu gespeicherter Buchungsslots im Fehlerfall
      for (const rollbackId of savedNewBookingIds) {
        try {
          await deleteBooking(currentVereinsId, rollbackId);
        } catch (_) {}
      }
      return (
        err.message ||
        "Die Buchung konnte wegen eines Konflikts nicht gespeichert werden."
      );
    }

    return null;
  };

  const handleCancel = async (id: string): Promise<string | null> => {
    const bookingToCancel = bookings.find((b) => b.id === id);
    if (!bookingToCancel) return "Buchung wurde nicht gefunden.";

    const bookingUser = proxyUser || currentUser;
    const isCancelPrivileged =
      bookingUser?.role === Role.ADMIN ||
      bookingUser?.role === Role.SUPER_ADMIN ||
      bookingUser?.role === "super-admin" ||
      bookingUser?.hauptAdmin === true;
    if (!isCancelPrivileged) {
      const getSlotDateTime = (dStr: string, tStr: string): Date => {
        const [yr, mon, day] = dStr.split("-").map(Number);
        const [hr, min] = tStr.split(":").map(Number);
        return new Date(yr, mon - 1, day, hr, min, 0, 0);
      };

      const slotTime = getSlotDateTime(
        bookingToCancel.date,
        bookingToCancel.time,
      );
      const now = new Date();

      const allowPast = settings.reservationRules?.allowPastBookings ?? true;
      if (slotTime < now && !allowPast) {
        return "Buchungen in der Vergangenheit dürfen nicht storniert werden.";
      }

      const cancelDeadline = settings.reservationRules.cancellationDeadlineMinutes ?? 30;
      if (cancelDeadline > 0) {
        const deadlineMs = cancelDeadline * 60 * 1000;
        if (now.getTime() > slotTime.getTime() - deadlineMs) {
          return `Stornierung fehlgeschlagen: Die Stornierungsfrist beträgt ${cancelDeadline} Minuten vor Spielbeginn. Bitte kontaktiere einen Administrator.`;
        }
      }
    }

    try {
      if (bookingToCancel.group_token) {
        const groupBookings = bookings.filter((b) => b.group_token === bookingToCancel.group_token);
        for (const b of groupBookings) {
          await deleteBooking(currentVereinsId, b.id);
        }
      } else {
        await deleteBooking(currentVereinsId, id);
      }
    } catch (err: any) {
      return err.message || "Fehler beim Stornieren.";
    }
    return null;
  };

  const handleLockRange = (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    reason: string,
    recurring: boolean,
    recurringUntil?: string,
  ) => {
    const startIndex = TIME_SLOTS.indexOf(startTime);
    const endIndex = TIME_SLOTS.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return;
    const slotsToLock = TIME_SLOTS.slice(startIndex, endIndex);

    let datesToLock: string[] = [];
    if (recurring) {
      if (recurringUntil) {
        const startD = new Date(date);
        const endD = new Date(recurringUntil);
        let w = 0;
        while (true) {
          const d = new Date(startD);
          d.setDate(d.getDate() + w * 7);
          if (d > endD) break;
          datesToLock.push(d.toISOString().split("T")[0]);
          w++;
          if (w > 100) break; // Safety limit
        }
      } else {
        for (let w = 0; w < 12; w++) {
          const d = new Date(date);
          d.setDate(d.getDate() + w * 7);
          datesToLock.push(d.toISOString().split("T")[0]);
        }
      }
    } else {
      datesToLock.push(date);
    }

    for (const dateStr of datesToLock) {
      for (const time of slotsToLock) {
        const booking: Booking = {
          id: Math.random().toString(36).substr(2, 9),
          date: dateStr,
          time,
          court,
          players: [],
          isLocked: true,
          reason,
          hasBallMachine: false,
          bookedBy: currentUser?.id,
        };
        if (superAdminContext) {
          booking.createdBy = currentUser
            ? currentUser.name || currentUser.id
            : "unbekannt";
          booking.actionPerformedBy = superAdminContext.name || "superadmin";
          booking.impersonatedBy = superAdminContext.name || "superadmin";
        } else {
          booking.createdBy = currentUser
            ? currentUser.name || currentUser.id
            : "unbekannt";
          booking.actionPerformedBy = currentUser
            ? currentUser.name || currentUser.id
            : "unbekannt";
        }
        saveBooking(currentVereinsId, booking);
      }
    }
  };

  const handleToggleRegistration = async (
    tournamentId: string,
    playerName?: string,
  ) => {
    if (!currentUser) return;
    const targetPlayer = playerName || currentUser.name;
    const t = tournaments.find((t) => t.id === tournamentId);
    if (t) {
      const isRegistered = t.participants.includes(targetPlayer);
      const newAuditLog = [...(t.auditLog || [])];
      newAuditLog.push({
        action: isRegistered ? "unregister" : "register",
        userName: targetPlayer,
        timestamp: new Date().toISOString(),
        actorName: currentUser.name,
      });
      await updateTournament(currentVereinsId, tournamentId, {
        participants: isRegistered
          ? t.participants.filter((p) => p !== targetPlayer)
          : [...t.participants, targetPlayer],
        auditLog: newAuditLog,
      });
    }
  };

  const handleAddTournament = (
    tournamentData: Omit<Tournament, "id" | "participants">,
  ) => {
    const defaultAudit = [
      {
        action: "create" as const,
        userName: currentUser?.name || "Admin",
        timestamp: new Date().toISOString(),
      },
    ];
    const t = {
      ...tournamentData,
      id: Math.random().toString(36).substr(2, 9),
      participants: [],
      auditLog: defaultAudit,
    };
    saveTournament(currentVereinsId, t);
  };

  const handleDeleteTournament = (id: string) =>
    deleteTournament(currentVereinsId, id);

  // Determine badge and club name for Splash Screen accurately
  const splashLogo = useMemo(() => {
    const isNeuhausen = currentVereinsId.includes("neuhausen");
    const explicitLogo = settings.customHeaderLogoUrl || settings.headerLogoUrl || settings.customLogoUrl || settings.logoUrl;
    if (explicitLogo && (isNeuhausen || explicitLogo !== DEFAULT_SETTINGS.logoUrl)) {
      return explicitLogo;
    }
    try {
      const switchingTargetStr = localStorage.getItem("v2_switching_target_club");
      if (switchingTargetStr) {
        const parsed = JSON.parse(switchingTargetStr);
        if (parsed?.vereinsId === currentVereinsId && parsed.logoUrl) {
          return parsed.logoUrl;
        }
      }
      const cachedBadgeStr = localStorage.getItem(`v2_club_badge_${currentVereinsId}`);
      if (cachedBadgeStr) {
        const cached = JSON.parse(cachedBadgeStr);
        if (cached?.logoUrl) return cached.logoUrl;
      }
      const clubsCacheStr = localStorage.getItem("v2_clubs_cache");
      if (clubsCacheStr) {
        const clubs = JSON.parse(clubsCacheStr);
        const match = clubs.find((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "") === currentVereinsId);
        const l = match?.customHeaderLogoUrl || match?.headerLogoUrl || match?.customLogoUrl || match?.logoUrl;
        if (l) return l;
      }
    } catch {}
    if (isNeuhausen) {
      return DEFAULT_SETTINGS.logoUrl;
    }
    return null;
  }, [settings.customHeaderLogoUrl, settings.headerLogoUrl, settings.customLogoUrl, settings.logoUrl, currentVereinsId]);

  const splashClubName = useMemo(() => {
    if (settings.clubName && !["Tennis-Club", "Tennis Club", "Verein"].includes(settings.clubName)) {
      return settings.clubName;
    }
    try {
      const cachedBadgeStr = localStorage.getItem(`v2_club_badge_${currentVereinsId}`);
      if (cachedBadgeStr) {
        const cached = JSON.parse(cachedBadgeStr);
        if (cached?.clubName) return cached.clubName;
      }
      const clubsCacheStr = localStorage.getItem("v2_clubs_cache");
      if (clubsCacheStr) {
        const clubs = JSON.parse(clubsCacheStr);
        const match = clubs.find((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "") === currentVereinsId);
        if (match?.clubName || match?.vereinsName || match?.name) {
          return match.clubName || match.vereinsName || match.name;
        }
      }
    } catch {}
    if (currentVereinsId.includes("neuhausen")) return "SV Neuhausen";
    return currentVereinsId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }, [settings.clubName, currentVereinsId]);

  const splashPrimaryColor = settings.primaryColor || "#1b4332";

  if (
    !isLoading &&
    settings.geloescht === true &&
    currentUser?.vereinsId !== "super-admin"
  ) {
    return (
      <div
        className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4 z-50 overflow-hidden animate-fade-in font-sans"
      >
        <div
          className="absolute inset-0 bg-cover bg-center select-none"
          style={{
            backgroundImage: `url(${settings.loginBannerUrl || settings.bannerUrl})`,
            filter: "blur(8px)",
            transform: "scale(1.05)",
            opacity: 0.85,
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-[#1b4332]/90 to-slate-900/40 z-0"></div>
        <div className="relative z-10 max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-md border border-rose-150">
            <i className="fa-solid fa-trash-can animate-bounce"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">
              Verein im Papierkorb
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-sans font-medium">
              Der Verein{" "}
              <strong className="text-slate-800">
                "{settings.clubName || currentVereinsId}"
              </strong>{" "}
              befindet sich im Papierkorb. Der reguläre Zugriff ist daher
              gesperrt.
            </p>
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-left space-y-2 shadow-sm">
            <p className="text-[10px] font-black uppercase text-rose-600 tracking-wider flex items-center gap-1.5 font-sans">
              <i className="fa-solid fa-circle-exclamation"></i>
              Papierkorb-Info
            </p>
            <p className="text-[11px] text-rose-800 font-semibold leading-relaxed font-sans">
              Der Verein wird nach Ablauf der 30-tägigen Backup-Frist
              unumkehrbar und unwiderruflich gelöscht. Bei Fragen wende dich
              direkt an das Admin-Team des übergeordneten Systems.
            </p>
          </div>

          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.delete("tenant");
              window.location.search = params.toString();
            }}
            className="w-full py-3.5 bg-[#1b4332] hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 border border-[#1b4332] cursor-pointer"
          >
            Anderen Verein wählen
          </button>
        </div>
      </div>
    );
  }

  if (isPublicWochenplanRoute && publicTokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-md border border-red-100">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">
              Fehler beim Laden
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-sans font-medium">
              {publicTokenError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isPublicWochenplanRoute && isSettingsLoaded && !settings?.publicCalendar?.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-md border border-red-100">
            <i className="fa-solid fa-lock"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">
              403 - Zugriff verweigert
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-sans font-medium">
              Der öffentliche Wochenplan ist für diesen Verein aktuell deaktiviert.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser && !isPublicWochenplanRoute) {
    if (showPublicHelp) {
      return (
        <>
          <style>{`
            :root {
              --color-primary: ${settings.primaryColor || "#1b4332"};
              --color-accent: ${settings.accentColor || "#c04d2b"};
              --color-accent-2: ${settings.accentColor2 || "#0f172a"};
              --color-accent-3: ${settings.accentColor3 || "#ccff00"};
            }
          `}</style>
          <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden p-4 sm:p-6 font-sans flex flex-col items-center justify-center select-none">
            <div
              className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat blur-[6px] scale-110"
              style={{
                backgroundImage: `url(${settings.loginBannerUrl || settings.bannerUrl})`,
              }}
            ></div>
            <div
              className="fixed inset-0 z-[1] bg-black/60 backdrop-brightness-50"
              style={{ backgroundColor: `${settings.primaryColor}90` }}
            ></div>
            <div className="z-10 w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl animate-in zoom-in duration-300 shadow-sm border border-white/20 select-text">
              <Help
                onBack={() => setShowPublicHelp(false)}
                isLoggedIn={false}
                helpText={settings.helpText}
              />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <style>{`
          :root {
            --color-primary: ${settings.primaryColor || "#1b4332"};
            --color-accent: ${settings.accentColor || "#c04d2b"};
            --color-accent-2: ${settings.accentColor2 || "#0f172a"};
            --color-accent-3: ${settings.accentColor3 || "#ccff00"};
          }
        `}</style>
        <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden flex items-center justify-center p-3 sm:p-6 md:p-10 text-slate-900 font-sans select-none">
          {/* Fixed Full Height Background Layers */}
          <div
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat blur-[6px] scale-105"
            style={{
              backgroundImage: isLoading
                ? "none"
                : `url(${isSuperadminRoute ? "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=2070&auto=format&fit=crop" : settings.loginBannerUrl || settings.bannerUrl})`,
            }}
          ></div>
          <div
            className="fixed inset-0 z-[1] backdrop-brightness-75"
            style={{
              backgroundColor: `${isSuperadminRoute ? "#1b4332" : settings.primaryColor}CC`,
            }}
          ></div>
          <div className="w-full max-w-5xl lg:max-w-4xl z-10 bg-white/10 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden flex flex-col lg:flex-row items-stretch lg:min-h-[500px] max-h-[95dvh] lg:max-h-[500px]">
            {/* Left Column: Login Form */}
            <div className="w-full lg:w-1/2 bg-white p-6 sm:p-10 md:p-12 lg:p-8 flex flex-col justify-start lg:justify-center relative shadow-sm overflow-y-auto max-h-[90dvh] lg:max-h-none rounded-none lg:rounded-none select-text">
              <div className="max-w-md mx-auto w-full">
                <div className="w-[50px] h-[50px] sm:w-20 sm:h-20 lg:w-[64px] lg:h-[64px] mx-auto flex items-center justify-center mb-3 sm:mb-5 lg:mb-4">
                  {isSuperadminRoute ? (
                    <i className="fa-solid fa-server text-2xl sm:text-4xl lg:text-3xl text-[#1b4332]"></i>
                  ) : !isSettingsLoaded ? (
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                  ) : (
                    <img
                      src={settings.logoUrl || settings.headerLogoUrl}
                      alt="Club Logo"
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                  )}
                </div>
                <h1
                  className="text-xl sm:text-3xl lg:text-3xl font-black tracking-tighter text-center leading-tight"
                  style={{
                    color: isSuperadminRoute
                      ? "#1b4332"
                      : settings.primaryColor,
                    fontFamily: isSuperadminRoute
                      ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                      : "Georgia, Cambria, 'Times New Roman', Times, serif",
                  }}
                >
                  {isSuperadminRoute
                    ? "Platzbuchung Administrator Login"
                    : isLoading
                      ? "Lädt..."
                      : settings.clubName}
                </h1>
                <p className="text-slate-400 text-[8px] sm:text-[9px] lg:text-[8.5px] font-black uppercase tracking-widest mt-1 sm:mt-1.5 lg:mt-1.5 text-center mb-4 sm:mb-7 lg:mb-5">
                  {isSuperadminRoute
                    ? "System-Wartung & Verwaltung"
                    : "Mitglieder-Login"}
                </p>

                {error && (
                  <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-xl text-xs font-black border-2 border-red-100 flex items-center gap-2 shadow-sm animate-pulse">
                    <i className="fa-solid fa-circle-exclamation"></i> {error}
                  </div>
                )}

                <form
                  onSubmit={handleLogin}
                  className="space-y-4 sm:space-y-5 lg:space-y-3.5"
                >
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">
                      Benutzername
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                      <input 
                        type="text"
                        value={loginForm.username}
                        onChange={(e) =>
                          setLoginForm({
                            ...loginForm,
                            username: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-4 border-2 border-slate-200 rounded-lg sm:rounded-xl lg:rounded-lg bg-slate-50 focus:border-[var(--color-accent)] outline-none font-bold text-xs sm:text-sm lg:text-xs transition-all py-1.5 sm:py-2 lg:py-1.5"
                        placeholder="Benutzername"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">
                      Passwort
                    </label>
                    <div className="relative">
                      <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm({
                            ...loginForm,
                            password: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-12 border-2 border-slate-200 rounded-lg sm:rounded-xl lg:rounded-lg bg-slate-50 focus:border-[var(--color-accent)] outline-none font-bold text-xs sm:text-sm lg:text-xs transition-all py-1.5 sm:py-2 lg:py-1.5"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1.5 cursor-pointer select-none transition-colors"
                        title={
                          showPassword
                            ? "Passwort verbergen"
                            : "Passwort anzeigen"
                        }
                      >
                        <i
                          className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} text-xs sm:text-sm`}
                        ></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2.5 mt-3 sm:mt-4 lg:mt-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="sm:col-span-2 w-full text-white rounded-xl shadow-md transition-all uppercase tracking-widest hover:text-white active:scale-95 flex items-center justify-center gap-2 cursor-pointer py-2.5 sm:py-2.5 lg:py-2 text-[11px] sm:text-xs font-black"
                      style={{
                        backgroundColor: isSuperadminRoute
                          ? "#1b4332"
                          : settings.primaryColor,
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      {isLoading ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fa-solid fa-right-to-bracket text-white"></i>
                          <span>Anmelden</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPublicHelp(true)}
                      className="sm:col-span-1 w-full text-slate-500 bg-transparent hover:bg-slate-50 border border-slate-200 hover:border-slate-300 font-bold py-2 sm:py-2.5 lg:py-2 rounded-xl transition-all uppercase tracking-widest text-[10.5px] sm:text-xs lg:text-[10px] active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-circle-question text-slate-400"></i>
                      <span>Hilfe</span>
                    </button>
                  </div>
                </form>

                {/* Mobile-only responsive Welcome Text */}
                {(() => {
                  const welcomeText = isSuperadminRoute
                    ? "Diese Seite dient ausschließlich der Systemwartung und Administration. Spieler und Mitglieder verwenden bitte den von ihrem Verein mitgeteilten Link zur Buchungsseite, um sich anzumelden."
                    : settings.welcomeMessage ||
                      `Herzlich willkommen im modernisierten Reservierungssystem des ${settings.clubName || "Vereins"}! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.`;
                  const isLongWelcomeText = welcomeText.length > 190;

                  let teaser = welcomeText;
                  let rest = "";

                  if (isLongWelcomeText) {
                    let splitIdx = 190;
                    const firstNewline = welcomeText.indexOf("\n");
                    if (firstNewline !== -1 && firstNewline < 190) {
                      splitIdx = firstNewline;
                    } else {
                      const nextSpace = welcomeText.indexOf(" ", 190);
                      if (nextSpace !== -1 && nextSpace - 190 < 25) {
                        splitIdx = nextSpace;
                      }
                    }
                    teaser = welcomeText.slice(0, splitIdx);
                    rest = welcomeText.slice(splitIdx);
                  }

                  return (
                    <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-slate-100 lg:hidden text-center">
                      <div className="text-slate-500 text-[10.5px] sm:text-xs font-bold leading-relaxed text-left">
                        <RichTextRenderer
                          text={
                            teaser +
                            (!isWelcomeExpanded && isLongWelcomeText
                              ? "..."
                              : "")
                          }
                        />
                        {isLongWelcomeText && (
                          <div
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out overflow-hidden
                            ${
                              isWelcomeExpanded
                                ? "grid-rows-[1fr] opacity-100 mt-1.5"
                                : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <div className="min-h-0">
                              <RichTextRenderer text={rest} />
                            </div>
                          </div>
                        )}
                      </div>
                      {isLongWelcomeText && (
                        <button
                          type="button"
                          onClick={() =>
                            setIsWelcomeExpanded(!isWelcomeExpanded)
                          }
                          className="mt-2 text-[10px] font-black text-[var(--color-primary)] hover:text-slate-800 uppercase tracking-widest flex items-center justify-center gap-1 mx-auto cursor-pointer outline-none active:scale-95 transition-all"
                        >
                          <span>
                            {isWelcomeExpanded
                              ? "Weniger anzeigen"
                              : "Mehr anzeigen"}
                          </span>
                          <i
                            className={`fa-solid ${isWelcomeExpanded ? "fa-chevron-up" : "fa-chevron-down"} text-[8px]`}
                          ></i>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: Dynamic decorative brand panel */}
            <div
              className="hidden lg:flex lg:w-1/2 relative flex-col justify-center p-6 sm:p-10 md:p-12 lg:p-8 overflow-hidden bg-cover bg-center select-text"
              style={{
                backgroundImage: isLoading
                  ? "none"
                  : `url(${isSuperadminRoute ? "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=2070&auto=format&fit=crop" : settings.loginBannerUrl || settings.bannerUrl})`,
              }}
            >
              <div className="absolute inset-x-0 bottom-0 top-1/4 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent z-0"></div>
              <div className="absolute inset-0 z-0 bg-black/10"></div>

              <div className="max-w-md mx-auto w-full relative z-10 lg:h-[340px] flex flex-col justify-end">
                <div>
                  <div className="text-white text-xs sm:text-sm lg:text-xs font-medium leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {isSuperadminRoute ? (
                      "Diese Seite dient ausschließlich der Systemwartung und Administration. Spieler und Mitglieder verwenden bitte den von ihrem Verein mitgeteilten Link zur Buchungsseite, um sich anzumelden."
                    ) : (
                      <RichTextRenderer
                        text={
                          settings.welcomeMessage ||
                          `Herzlich willkommen im modernisierten Reservierungssystem des ${settings.clubName || "Vereins"}! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.`
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (
    (!currentUser || (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.vereinsId !== "super-admin" &&
      currentUser.vereinsId !== "system"
    )) &&
    isLoading
  ) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 z-[9999] select-none">
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes tinderPulse {
            0% {
              transform: scale(1);
              opacity: 0.9;
            }
            50% {
              transform: scale(1.06);
              opacity: 1;
              filter: drop-shadow(0 10px 25px rgba(0,0,0,0.08));
            }
            100% {
              transform: scale(1);
              opacity: 0.9;
            }
          }
          .tinder-pulse-logo {
            animation: tinderPulse 2s ease-in-out infinite;
          }
        `,
          }}
        />
        <div className="flex flex-col items-center justify-center gap-3">
          {splashLogo ? (
            <img
              src={splashLogo}
              alt={splashClubName || "Club Logo"}
              className="max-h-36 max-w-[240px] object-contain tinder-pulse-logo p-2"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3">
              <i
                className="fa-solid fa-baseball text-[96px] tinder-pulse-logo"
                style={{ color: splashPrimaryColor }}
              ></i>
            </div>
          )}
          <div className="flex flex-col items-center gap-1 mt-4 text-center px-4">
            <span className="text-sm md:text-base font-medium text-slate-500 font-sans">
              Wechsle zu
            </span>
            <span 
              className="text-2xl md:text-3xl font-bold text-slate-800"
              style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
            >
              {splashClubName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser && currentUser.role === Role.SUPER_ADMIN) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 top-0 mt-0">
        <ErrorBoundary fallbackTitle="Super-Admin Dashboard Fehler" fallbackMessage="Beim Laden des Super-Admin Dashboards ist ein unerwarteter Fehler aufgetreten.">
          <SuperAdminDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onLoginAs={handleSuperAdminLoginAs}
          />
        </ErrorBoundary>
      </div>
    );
  }

  const desktopNavItems: Array<{
    id: string;
    label: string;
    IconComponent: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    show: boolean;
    barClass: string;
    dropdownClass: string;
  }> = [
    {
      id: "reservation",
      label: "Plätze",
      IconComponent: Calendar,
      show: true,
      barClass: "flex",
      dropdownClass: "hidden",
    },
    {
      id: "tournaments",
      label: "Veranstaltungen",
      IconComponent: PartyPopper,
      show: settings.modules?.events !== false,
      barClass: "flex",
      dropdownClass: "hidden",
    },
    {
      id: "ranking",
      label: "Rangliste",
      IconComponent: Medal,
      show: settings.modules?.ranking !== false,
      barClass: "flex",
      dropdownClass: "hidden",
    },
    {
      id: "league",
      label: "Liga",
      IconComponent: Trophy,
      show: isLeagueEnabled,
      barClass: "flex",
      dropdownClass: "hidden",
    },
    {
      id: "guests",
      label: "Gastspiele",
      IconComponent: UserPlus,
      show: isAdmin || (settings.modules?.guests !== false && !!currentUser),
      barClass: "hidden xl:flex",
      dropdownClass: "block xl:hidden",
    },
    {
      id: "arbeitseinsaetze",
      label: "Arbeitseinsätze",
      IconComponent: Briefcase,
      show: settings.modules?.arbeitseinsaetze === true,
      barClass: "hidden 2xl:flex",
      dropdownClass: "block 2xl:hidden",
    },
    {
      id: "reports",
      label: "Statistik",
      IconComponent: BarChart3,
      show: isAdmin,
      barClass: "hidden 2xl:flex",
      dropdownClass: "block 2xl:hidden",
    },
    {
      id: "adminSettings",
      label: "System",
      IconComponent: Settings,
      show: isAdmin,
      barClass: "hidden 2xl:flex",
      dropdownClass: "block 2xl:hidden",
    },
  ];

  const hasDropdownItems = desktopNavItems.some(
    (item) => item.show && item.dropdownClass !== "hidden"
  );

  const isDropdownActive = desktopNavItems.some(
    (item) => item.show && item.dropdownClass !== "hidden" && view === item.id
  );

  const desktopNav = (
    <motion.nav 
      layout 
      transition={{ layout: { duration: 0.3, ease: "easeInOut" } }} 
      className="hidden lg:flex bg-white/10 p-0.5 rounded-full shadow-sm gap-0.5 backdrop-blur-sm border border-white/10 relative items-center h-8 transition-all duration-300 ease-in-out"
    >
      {desktopNavItems
        .filter((item) => item.show)
        .map((item) => {
          const isActive = view === item.id;
          const IconComp = item.IconComponent;
          return (
            <button
              key={item.id}
              onClick={() => {
                handleSetView(item.id as typeof view);
                closeMehrDropdown();
              }}
              className={`relative flex items-center justify-center px-3 h-[26px] text-[10px] font-medium tracking-wide rounded-full transition-colors cursor-pointer outline-none shrink-0 ${
                isActive
                  ? "text-white font-bold"
                  : "text-white/70 hover:text-white/90 hover:bg-white/5"
              } ${item.barClass}`}
            >
              {isActive && (
                <motion.div
                  layoutId="desktopNavIndicatorMain"
                  className="absolute inset-0 bg-white/20 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 40 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <IconComp
                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-white/70"
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.8}
                />
                <span>{item.label}</span>
              </span>
            </button>
          );
        })}

      {hasDropdownItems && (
        <div
          className="relative"
          onMouseEnter={handleMehrMouseEnter}
          onMouseLeave={handleMehrMouseLeave}
        >
          <button
            onClick={() => {
              if (isMehrDropdownOpen) {
                closeMehrDropdown();
              } else {
                handleMehrMouseEnter();
              }
            }}
            className={`relative flex items-center justify-center px-3 h-[26px] text-[10px] font-medium tracking-wide rounded-full transition-colors cursor-pointer outline-none shrink-0 ${
              desktopNavItems.some(
                (i) => i.show && i.dropdownClass.includes("2xl:hidden")
              )
                ? "2xl:hidden"
                : "xl:hidden"
            } ${
              isDropdownActive
                ? "text-white font-bold"
                : "text-white/70 hover:text-white/90 hover:bg-white/5"
            }`}
          >
            {isDropdownActive && (
              <motion.div
                layoutId="desktopNavIndicatorDropdown"
                className="absolute inset-0 bg-white/20 rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <span>Mehr</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isMehrDropdownOpen ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
              />
            </span>
          </button>

          <AnimatePresence>
            {isMehrDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[90] bg-transparent"
                  onClick={closeMehrDropdown}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full pt-2 w-48 z-[100]"
                >
                  <div
                    className="rounded-xl shadow-xl p-1.5 border border-white/20 backdrop-blur-md flex flex-col gap-0.5"
                    style={{ backgroundColor: settings.primaryColor || "#1b4332" }}
                  >
                    {desktopNavItems
                      .filter((item) => item.show && item.dropdownClass !== "hidden")
                      .map((item) => {
                        const isActive = view === item.id;
                        const DropdownIconComp = item.IconComponent;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleSetView(item.id as typeof view);
                              closeMehrDropdown();
                            }}
                            className={`w-full text-left px-3 py-2 text-[10px] font-medium tracking-wide rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${item.dropdownClass} ${
                              isActive
                                ? "bg-white/20 text-white font-bold shadow-xs"
                                : "text-white/80 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            <DropdownIconComp
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? "text-white" : "text-white/70"
                              }`}
                              strokeWidth={isActive ? 2.25 : 1.8}
                            />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.nav>
  );

  let mobileHeaderTitle = "";
  let MobileHeaderIconComp: React.ComponentType<{ className?: string; strokeWidth?: number }> | null = null;
  if (view === "tournaments") { 
    mobileHeaderTitle = "Veranstaltungen"; 
    MobileHeaderIconComp = PartyPopper; 
  }
  else if (view === "ranking") { 
    mobileHeaderTitle = "Rangliste"; 
    MobileHeaderIconComp = Medal; 
  }
  else if (view === "arbeitseinsaetze") { 
    mobileHeaderTitle = "Arbeitseinsätze"; 
    MobileHeaderIconComp = Briefcase; 
  }
  else if (view === "league") { 
    mobileHeaderTitle = "Liga"; 
    MobileHeaderIconComp = Trophy; 
  }
  else if (view === "reports") { 
    mobileHeaderTitle = "Statistik"; 
    MobileHeaderIconComp = BarChart3; 
  }
  else if (view === "guests") { 
    mobileHeaderTitle = "Gastspiele"; 
    MobileHeaderIconComp = UserPlus; 
  }
  else if (view === "adminSettings") { 
    mobileHeaderTitle = "Einstellungen"; 
    MobileHeaderIconComp = Settings; 
  }
  else if (view === "help") { 
    mobileHeaderTitle = "Hilfe & FAQ"; 
    MobileHeaderIconComp = HelpCircle; 
  }
  else if (view === "impressum") { 
    mobileHeaderTitle = "Impressum"; 
    MobileHeaderIconComp = Scale; 
  }


  return (
    <>
      <style>{`
        html, body {
          scroll-behavior: smooth;
        }
        
        :root {
          --color-primary: ${settings.primaryColor || "#1b4332"};
          --color-accent: ${settings.accentColor || "#c04d2b"};
          --color-accent-2: ${settings.accentColor2 || "#0f172a"};
          --color-accent-3: ${settings.accentColor3 || "#ccff00"};
        }
      `}</style>
      <Layout
        user={currentUser}
        isPublicWochenplanRoute={isPublicWochenplanRoute && !currentUser}
        onLogout={handleLogout}
        onShowHelp={() => handleSetView("help")}
        onShowImpressum={() => handleSetView("impressum")}
        onShowProfile={() => setShowProfile(true)}
        news={settings.news}
        clubName={settings.clubName}
        logoUrl={settings.headerLogoUrl || settings.logoUrl}
        bannerUrl={settings.bannerUrl}
        bannerPosition={settings.bannerPosition}
        primaryColor={settings.primaryColor}
        websiteUrl={settings.websiteUrl}
        hideWebsiteLink={settings.hideWebsiteLink}
        impressum={settings.impressum}
        desktopNav={desktopNav}
        onLogoClick={() => handleSetView("reservation")}
        userClubs={uniqueUserClubs}
        currentVereinsId={currentVereinsId}
        onSwitchClub={handleSwitchClub}
      >
        <div className="w-full flex-grow flex flex-col min-h-0 space-y-3">
          {superAdminContext && !proxyUser && (
            <div className="bg-rose-50 border-2 border-rose-200 text-rose-900 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-3 duration-300 select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                  <i className="fa-solid fa-user-check text-lg"></i>
                </div>
                <div className="text-left">
                  <h4 className="font-black text-xs uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <span>⚠️ Proxy-Modus Aktiv (Super-Admin)</span>
                  </h4>
                  <p className="text-xs font-bold text-slate-700">
                    Du agierst aktuell als Proxy für:{" "}
                    <span className="font-black text-rose-600 underline">
                      {currentUser?.firstName || currentUser?.lastName
                        ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
                        : currentUser?.klarname || currentUser?.name}
                    </span>{" "}
                    im Verein{" "}
                    <span className="font-black text-slate-900">
                      {uniqueUserClubs.find((c) => (c.vereinsId || c.id) === currentVereinsId || String(c.vereinsId || c.id).toLowerCase().replace(/\s/g, "") === String(currentVereinsId).toLowerCase().replace(/\s/g, ""))?.clubName || settings?.clubName || currentVereinsId}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => {
                    setCurrentUser(superAdminContext);
                    
                    if (superAdminContext?.clubs) {
                      setUserClubs(superAdminContext.clubs);
                    } else {
                      setUserClubs([]);
                    }

                    setSuperAdminContext(null);
                    setProxyUser(null);
                    localStorage.setItem("superadmin_active_tab", "accounts");
                    setView("superadmin");

                    // Clean up Tenant State
                    if (superAdminContext?.vereinsId) {
                      const params = new URLSearchParams(window.location.search);
                      params.set("tenant", superAdminContext.vereinsId);
                      window.location.search = params.toString();
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-sm shrink-0 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-right-from-bracket"></i> Proxy-Sitzung beenden
                </button>
              </div>
            </div>
          )}
          {proxyUser && (
            <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-3 duration-300 select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                  <i className="fa-solid fa-user-secret text-lg"></i>
                </div>
                <div className="text-left">
                  <h4 className="font-black text-xs uppercase tracking-wider text-amber-800">
                    Proxy-Modus Aktiv
                  </h4>
                  <p className="text-xs font-bold text-slate-700">
                    Du agierst aktuell als{" "}
                    <span className="font-black text-amber-600 underline">
                      {proxyUser.lastName || proxyUser.firstName
                        ? `${proxyUser.firstName || ""} ${proxyUser.lastName || ""}`.trim()
                        : proxyUser.name}
                    </span>{" "}
                    (Login: {proxyUser.name}).
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (currentUser?.vereinsId) {
                    setActiveTenantId(currentUser.vereinsId);
                  }
                  setProxyUser(null);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-black text-white font-black uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-sm shrink-0 active:scale-95 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-left-long"></i> Proxy beenden
              </button>
            </div>
          )}

          
          {window.innerWidth < 1024 && view !== "reservation" && !isMoreMenuOpen && mobileHeaderTitle && (
            <div className="lg:hidden bg-[var(--color-primary)] px-4 h-12 flex items-center justify-between text-white shadow-md relative shrink-0 select-none mb-1 rounded-xl font-sans z-50">
              <h3 className="text-white font-black tracking-widest uppercase text-xs flex items-center gap-2">
                {MobileHeaderIconComp && (
                  <MobileHeaderIconComp className="w-4 h-4 shrink-0 text-white" strokeWidth={1.8} />
                )}
                {mobileHeaderTitle}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setView("reservation");
                  setIsMoreMenuOpen(true);
                }}
                className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition-all flex items-center gap-1.5 font-black uppercase text-[9px] tracking-wider cursor-pointer outline-none border border-white/15"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />{" "}
                Zurück
              </button>
            </div>
          )}

          {/* Fixed Mobile Reservation Navigation Controller - Shell remains mounted to prevent flicker */}
          {window.innerWidth < 1024 && view === "reservation" && !isMoreMenuOpen && (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-1.5 shadow-sm flex flex-col gap-1.5 sticky top-[10px] z-[1000] lg:hidden mb-1.5 shrink-0">
              {showMobileCalendar ? (
                <div className="flex items-center justify-between h-7 px-1 gap-2">
                  <span className="text-[11px] font-black text-[var(--color-primary)] uppercase tracking-wide truncate select-none leading-none pt-0.5">
                    DATUM AUSWÄHLEN
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-[var(--color-primary)] text-[10px]"></i>
                      <span>Anlage:</span>
                    </span>
                    <select
                      value={currentVereinsId}
                      onChange={(e) => handleSwitchClub(e.target.value)}
                      className="text-[10px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none focus:border-[var(--color-primary)] cursor-pointer max-w-[150px] truncate"
                    >
                      {miniCalClubsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between h-7 gap-2">
                  <button
                    type="button"
                    disabled={isMobileBackDisabled}
                    onClick={() => handleNavigateMobileDate(-1)}
                    className={`h-7 px-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1 text-[var(--color-primary)] font-black text-[10px] uppercase tracking-wider transition-all shadow-sm outline-none shrink-0 whitespace-nowrap ${
                      isMobileBackDisabled
                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                        : "hover:bg-slate-100 active:scale-95 cursor-pointer"
                    }`}
                  >
                    <i className="fa-solid fa-chevron-left text-[9px]"></i>
                    <span>Zurück</span>
                  </button>

                  <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-black text-[var(--color-primary)] uppercase tracking-wide text-center truncate select-none leading-none pt-0.5 whitespace-nowrap">
                      {mobileViewType === "day"
                        ? new Date(mobileSelectedDate).toLocaleDateString("de-DE", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : (() => {
                            const wDates = getWeekDates(mobileSelectedDate);
                            return `${new Date(wDates[0]).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} — ${new Date(wDates[6]).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
                          })()}
                    </span>
                    {mobileSelectedDate !== getTodayStr() && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileSelectedDate(getTodayStr());
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-90 transition-all text-[var(--color-primary)] cursor-pointer outline-none shrink-0"
                        title="Zurück zu Heute"
                      >
                        <i className="fa-solid fa-house text-[9px]"></i>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavigateMobileDate(1)}
                    className="h-7 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 text-[var(--color-primary)] font-black text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer outline-none shrink-0 whitespace-nowrap"
                  >
                    <span>Weiter</span>
                    <i className="fa-solid fa-chevron-right text-[9px]"></i>
                  </button>
                </div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentVereinsId}_${view}_${(window.innerWidth < 1024 && isMoreMenuOpen) ? "more" : "main"}_${(window.innerWidth < 1024 && showMobileCalendar) ? "cal" : "normal"}`}
              initial={window.innerWidth < 1024 ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={window.innerWidth < 1024 ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={window.innerWidth < 1024 ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={window.innerWidth < 1024 ? { duration: 0.25 } : { duration: 0.16, ease: "easeInOut" }}
              className="w-full flex-grow flex flex-col min-h-0"
            >
              {showMobileCalendar && window.innerWidth < 1024 ? (
                <div className="w-full lg:animate-in lg:fade-in lg:duration-500 pb-0 md:pb-3 select-none space-y-4">
                  {/* Content area */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-md w-full h-auto flex flex-col select-none mb-0">
                    {/* Facility / Vereinsauswahl Header */}
                    <div className="p-2.5 px-3 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className="fa-solid fa-building-columns text-[var(--color-primary)] text-xs shrink-0"></i>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider shrink-0">
                          Anlage:
                        </span>
                        <span className="text-xs font-black text-slate-800 truncate">
                          {settings.clubName || currentVereinsId}
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <select
                          value={currentVereinsId}
                          onChange={(e) => handleSwitchClub(e.target.value)}
                          className="pl-2.5 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-[var(--color-primary)] appearance-none cursor-pointer max-w-[170px] truncate"
                        >
                          {miniCalClubsList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[8px]"></i>
                      </div>
                    </div>

                    {/* Month Navigator */}
                    <div className="p-2.5 px-3 sm:p-3.5 flex items-center justify-between border-b border-slate-100 bg-slate-50/80 shrink-0 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarMonth);
                          m.setMonth(m.getMonth() - 1);
                          setCalendarMonth(m);
                        }}
                        className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[var(--color-primary)] border border-slate-200 shadow-sm active:scale-90 transition-all font-black select-none"
                      >
                        <i className="fa-solid fa-chevron-left text-[10px]"></i>
                      </button>

                      <span className="font-black text-[11px] sm:text-xs uppercase tracking-widest text-[var(--color-primary)] select-none">
                        {
                          [
                            "Januar",
                            "Februar",
                            "März",
                            "April",
                            "Mai",
                            "Juni",
                            "Juli",
                            "August",
                            "September",
                            "Oktober",
                            "November",
                            "Dezember",
                          ][calendarMonth.getMonth()]
                        }{" "}
                        {calendarMonth.getFullYear()}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const m = new Date(calendarMonth);
                          m.setMonth(m.getMonth() + 1);
                          setCalendarMonth(m);
                        }}
                        className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[var(--color-primary)] border border-slate-200 shadow-sm active:scale-90 transition-all font-black select-none"
                      >
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                      </button>
                    </div>

                    {/* Grid */}
                    <div className="p-3 sm:p-5 flex flex-col w-full">
                      <div className="grid grid-cols-7 text-center gap-1 mb-1.5 sm:mb-3 select-none shrink-0 w-full">
                        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(
                          (wd) => (
                            <span
                              key={wd}
                              className="text-[9px] sm:text-xs font-semibold uppercase text-slate-700 py-0.5 sm:py-1"
                            >
                              {wd}
                            </span>
                          ),
                        )}
                      </div>

                      <div className="grid grid-cols-7 gap-1 font-sans items-center">
                        {(() => {
                          const tempIndex = calendarDays.findIndex(
                            (d) => d.dateString === tempSelectedDate,
                          );
                          const tempRowIndex =
                            tempIndex !== -1 ? Math.floor(tempIndex / 7) : -1;

                          return calendarDays.map((slot, index) => {
                            const isSelected =
                              slot.dateString === tempSelectedDate;
                            const todayStr = getTodayStr();
                            const isToday = slot.dateString === todayStr;

                            const isSelectedWeekRow =
                              mobileViewType === "week" &&
                              tempRowIndex !== -1 &&
                              Math.floor(index / 7) === tempRowIndex;

                            let dayStyleClass =
                              "text-slate-700 hover:bg-slate-100 border-2 border-transparent font-bold";
                            if (!slot.isCurrentMonth) {
                              dayStyleClass =
                                "text-slate-300 hover:bg-slate-50 border-2 border-transparent font-bold";
                            }

                            if (mobileViewType === "week") {
                              if (isSelected) {
                                dayStyleClass =
                                  "bg-[var(--color-primary)] text-white font-bold shadow-md border border-[var(--color-primary)]";
                              } else if (isSelectedWeekRow) {
                                dayStyleClass =
                                  "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-2 border-[var(--color-primary)]/10 font-bold";
                              } else if (isToday) {
                                dayStyleClass =
                                  "border-2 border-slate-300 text-slate-800 bg-slate-50 font-bold";
                              }
                            } else {
                              if (isSelected) {
                                dayStyleClass =
                                  "bg-[var(--color-primary)] text-white font-bold shadow-md border border-[var(--color-primary)]";
                              } else if (isToday) {
                                dayStyleClass =
                                  "border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-slate-50 font-bold";
                              }
                            }

                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setTempSelectedDate(slot.dateString);
                                  setMobileSelectedDate(slot.dateString);
                                  setMobileViewType("day");
                                  setView("reservation");
                                  setShowMobileCalendar(false);
                                  setIsMoreMenuOpen(false);
                                }}
                                className={`aspect-square ${isSelected ? "rounded-full" : "rounded-xl"} flex items-center justify-center font-medium text-xs sm:text-sm transition-all relative active:scale-95 cursor-pointer select-none ${dayStyleClass}`}
                              >
                                {slot.day}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : view === "reports" && isAdmin ? (
                <div className="flex flex-col h-full">
                  
                  <AdminReports
                    bookings={bookings}
                    users={users}
                    courts={settings.courts}
                  />
                </div>
              ) : view === "guests" && currentUser ? (
                <div className="flex flex-col h-full">
                  
                  <AdminGuests
                    bookings={bookings}
                    users={users}
                    settings={settings}
                    currentUser={currentUser}
                    vereinsId={currentVereinsId}
                    onSaveSettings={async (s) => {
                      await saveSettings(currentVereinsId, s);
                    }}
                    onDismissOnboardingHints={handleDismissOnboardingHints}
                  />
                </div>
              ) : view === "adminSettings" && isAdmin ? (
                <div className="flex flex-col h-full">
                  
                  <AdminSettings
                    users={users}
                    onUpdateUsers={async (u) => {
                      const currentKeys = new Set(Object.keys(u));
                      const previousKeys = Object.keys(users);
                      for (const [key, user] of Object.entries(u) as [
                        string,
                        User,
                      ][]) {
                        const prevUser = users[key];
                        if (
                          !prevUser ||
                          JSON.stringify(prevUser) !== JSON.stringify(user)
                        ) {
                          await saveUser(currentVereinsId, user);
                        }
                      }
                      for (const prevKey of previousKeys) {
                        if (!currentKeys.has(prevKey)) {
                          await deleteUserDoc(currentVereinsId, prevKey);
                        }
                      }
                    }}
                    bookings={bookings}
                    onUpdateBookings={() => {}} // deprecated for firestore sync
                    onSaveBooking={(b) => {
                      const bookingToSave = { ...b };
                      const isGuest =
                        (bookingToSave.guestCount &&
                          bookingToSave.guestCount > 0) ||
                        (bookingToSave.players &&
                          bookingToSave.players.some(
                            (p) =>
                              p.toLowerCase().includes("gastspieler") ||
                              p.toLowerCase().includes("gast"),
                          ));
                      if (isGuest && bookingToSave.guestFee === undefined) {
                        const feeCtx = buildBookingFeeContext({
                          court: bookingToSave.court,
                          players: bookingToSave.players,
                          guestCount: bookingToSave.guestCount,
                          date: bookingToSave.date,
                          time: bookingToSave.time,
                          durationMinutes: 60,
                        });
                        const feeRes = calculateBookingFee(feeCtx, settings.feeSettings, settings.reservationRules);
                        bookingToSave.guestFee = feeRes.ratePerUnitEuro;
                        bookingToSave.guestBillingMode = feeRes.action.type === "PER_COURT_HOUR" ? "per_court" : "per_player";
                        bookingToSave.calculatedFeeCents = feeRes.totalCents;
                        bookingToSave.appliedFeeRuleId = feeRes.matchedRuleId;
                        bookingToSave.appliedFeeRuleName = feeRes.matchedRuleName;
                        bookingToSave.feeCalculationMode = feeRes.mode;
                      }
                      if (superAdminContext) {
                        bookingToSave.createdBy =
                          bookingToSave.createdBy ||
                          (currentUser
                            ? currentUser.name || currentUser.id
                            : "unbekannt");
                        bookingToSave.actionPerformedBy =
                          superAdminContext.name || "superadmin";
                        bookingToSave.impersonatedBy =
                          superAdminContext.name || "superadmin";
                      } else {
                        bookingToSave.createdBy =
                          bookingToSave.createdBy ||
                          (currentUser
                            ? currentUser.name || currentUser.id
                            : "unbekannt");
                        bookingToSave.actionPerformedBy =
                          bookingToSave.actionPerformedBy ||
                          (currentUser
                            ? currentUser.name || currentUser.id
                            : "unbekannt");
                      }
                      saveBooking(currentVereinsId, bookingToSave);
                    }}
                     onDeleteBooking={async (id) => {
                       const bToDel = bookings.find((b) => b.id === id);
                       if (bToDel && bToDel.group_token) {
                         const group = bookings.filter((b) => b.group_token === bToDel.group_token);
                         for (const b of group) {
                           await deleteBooking(currentVereinsId, b.id);
                         }
                       } else {
                         await deleteBooking(currentVereinsId, id);
                       }
                     }}
                    currentUser={currentUser}
                    isSuperAdminImpersonating={!!superAdminContext}
                    settings={settings}
                    onUpdateSettings={(s) => {
                      const settingsToSave = { ...s };
                      if (superAdminContext) {
                        settingsToSave.lastEditedBy = currentUser
                          ? currentUser.name || currentUser.id
                          : "unbekannt";
                        settingsToSave.actionPerformedBy =
                          superAdminContext.name || "superadmin";
                        settingsToSave.impersonatedBy =
                          superAdminContext.name || "superadmin";
                      } else {
                        settingsToSave.lastEditedBy = currentUser
                          ? currentUser.name || currentUser.id
                          : "unbekannt";
                        settingsToSave.actionPerformedBy = currentUser
                          ? currentUser.name || currentUser.id
                          : "unbekannt";
                      }
                      saveSettings(currentVereinsId, settingsToSave);
                      setAdminSettingsDirty(false);
                    }}
                    onDirtyChange={setAdminSettingsDirty}
                    triggerSave={triggerAdminSave}
                    rankings={rankings}
                    onUpdateRankings={(r) => saveRankings(currentVereinsId, r)}
                    tournaments={tournaments}
                    onAddTournament={handleAddTournament}
                    onUpdateTournament={(id, updates) =>
                      updateTournament(currentVereinsId, id, updates)
                    }
                    onDeleteTournament={handleDeleteTournament}
                    onActAsUser={(u) => {
                      setProxyUser(u);
                      if (u.vereinsId) {
                        setActiveTenantId(u.vereinsId);
                      }
                      setView("reservation");
                    }}
                  />
                </div>
              ) : view === "tournaments" ? (
                <div className="flex flex-col h-full">
                  
                  <Tournaments
                    tournaments={tournaments}
                    users={users}
                    currentUser={proxyUser || currentUser}
                    onToggleRegistration={handleToggleRegistration}
                    onAddTournament={handleAddTournament}
                    onUpdateTournament={(id, updates) =>
                      updateTournament(currentVereinsId, id, updates)
                    }
                    onDeleteTournament={handleDeleteTournament}
                    highlightEventId={highlightEventId}
                    onDismissOnboardingHints={handleDismissOnboardingHints}
                  />
                </div>
              ) : view === "ranking" ? (
                <div className="flex flex-col h-full">
                  
                  {rankings ? (
                    <RankingView
                      data={rankings}
                      users={users}
                      currentUser={proxyUser || currentUser}
                      settings={settings}
                      onUpdate={(r) =>
                        saveRankings(
                          currentVereinsId,
                          r as unknown as RankingState,
                        )
                      }
                    />
                  ) : (
                    <div className="text-center font-bold p-10 text-slate-500">
                      Lade Rangliste...
                    </div>
                  )}
                </div>
              ) : view === "arbeitseinsaetze" ? (
                <div className="flex flex-col h-full">
                  
                  <Arbeitseinsaetze
                    currentUser={proxyUser || currentUser}
                    users={users}
                    settings={settings}
                    onSaveSettings={async (s) => {
                      await saveSettings(currentVereinsId, s);
                    }}
                    primaryColor={settings.primaryColor}
                    accentColor={settings.accentColor}
                    onDismissOnboardingHints={handleDismissOnboardingHints}
                  />
                </div>
              ) : view === "league" ? (
                isLeagueEnabled ? (
                  <div className="w-full flex-grow flex flex-col min-h-0">
                    <LeagueDashboard
                      currentUser={proxyUser || currentUser}
                      clubId={currentVereinsId}
                      users={users}
                      settings={settings}
                      bookings={bookings}
                      onBook={handleBook}
                      userClubs={uniqueUserClubs}
                      onSwitchClub={handleSwitchClub}
                      allClubs={allClubs}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
                    <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3"></i>
                    <h3 className="text-base font-bold text-slate-700">Liga nicht aktiv</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Die Liga ist aktuell für diesen Verein oder systemweit vom Superadministrator nicht freigeschaltet.
                    </p>
                  </div>
                )
              ) : view === "help" ? (
                <Help
                  isLoggedIn={true}
                  onBack={() => {
                    if (window.innerWidth < 1024) {
                      setView("reservation");
                      setIsMoreMenuOpen(true);
                    } else {
                      handleSetView("reservation");
                    }
                  }}
                  helpText={settings.helpText}
                />
              ) : view === "impressum" ? (
                <Impressum
                  onBack={() => {
                    if (window.innerWidth < 1024) {
                      setView("reservation");
                      setIsMoreMenuOpen(true);
                    } else {
                      handleSetView("reservation");
                    }
                  }}
                  impressumText={settings.impressum}
                />
              ) : isMoreMenuOpen && window.innerWidth < 1024 ? (
                <div className="w-full lg:animate-in lg:fade-in lg:duration-500 pb-28 select-none p-0">
                  {/* Content area */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm w-full flex flex-col overflow-hidden select-none p-3.5 mb-24">
                    <div className="grid grid-cols-2 gap-2">
                      {settings.modules?.events !== false && (
                        <button
                          onClick={() => {
                            setView("tournaments");
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                            view === "tournaments"
                              ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                          }`}
                        >
                          <PartyPopper className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Veranstaltungen
                          </span>
                        </button>
                      )}

                      {settings.modules?.ranking !== false && (
                        <button
                          onClick={() => {
                            setView("ranking");
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                            view === "ranking"
                              ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                          }`}
                        >
                          <Medal className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Rangliste
                          </span>
                        </button>
                      )}

                      {isLeagueEnabled && (
                        <button
                          onClick={() => {
                            setView("league");
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                            view === "league"
                              ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                          }`}
                        >
                          <Trophy className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Liga
                          </span>
                        </button>
                      )}

                      {settings.modules?.arbeitseinsaetze === true && (
                        <button
                          onClick={() => {
                            setView("arbeitseinsaetze");
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                            view === "arbeitseinsaetze"
                              ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                          }`}
                        >
                          <Briefcase className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Arbeitseinsätze
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setView("help");
                          setIsMoreMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                          view === "help"
                            ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                            : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                        }`}
                      >
                        <HelpCircle className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                        <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                          Hilfe
                        </span>
                      </button>

                      {!settings.hideWebsiteLink && (
                        <a
                          href={
                            settings.websiteUrl ||
                            "https://www.svneuhausen1947.de/tennis"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700 font-bold text-center transition-all active:scale-[0.97] duration-150 h-16 w-full"
                        >
                          <ExternalLink className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Website
                          </span>
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setView("impressum");
                          setIsMoreMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                          view === "impressum"
                            ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                            : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                        }`}
                      >
                        <Scale className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                        <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                          Impressum
                        </span>
                      </button>

                      {(isAdmin ||
                        (settings.modules?.guests !== false &&
                          currentUser)) && (
                        <button
                          onClick={() => {
                            setView("guests");
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                            view === "guests"
                              ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                          }`}
                        >
                          <UserPlus className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                            Gastspiele
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowProfile(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700 font-bold text-center transition-all active:scale-[0.97] duration-150 h-16 w-full"
                      >
                        <UserCog className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                        <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                          Konto
                        </span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setView("reports");
                              setIsMoreMenuOpen(false);
                            }}
                            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                              view === "reports"
                                ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                                : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                            }`}
                          >
                            <BarChart3 className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                            <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                              Statistik
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setView("adminSettings");
                              setIsMoreMenuOpen(false);
                            }}
                            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-xl border-2 text-center transition-all active:scale-[0.97] duration-150 h-16 w-full ${
                              view === "adminSettings"
                                ? "border-[var(--color-primary)] bg-slate-50 text-[var(--color-primary)] font-black"
                                : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700"
                            }`}
                          >
                            <Settings className="w-5 h-5 text-[var(--color-primary)] shrink-0" strokeWidth={1.8} />
                            <span className="text-[10px] font-black uppercase tracking-wider truncate w-full px-1">
                              System
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Compact Collapsible Vereins-Switcher directly above Angemeldet als / Logout */}
                    {uniqueUserClubs && uniqueUserClubs.length > 1 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100">
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => setIsMobileClubDropdownOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 transition-all cursor-pointer text-xs font-bold active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <i className="fa-solid fa-building-columns text-[var(--color-primary)] text-xs shrink-0"></i>
                              <span className="text-slate-500 font-normal">Verein:</span>
                              <span className="truncate text-slate-800 font-bold">
                                {uniqueUserClubs.find((c) => (c.vereinsId || c.id) === currentVereinsId || String(c.vereinsId || c.id).toLowerCase().replace(/\s/g, "") === String(currentVereinsId).toLowerCase().replace(/\s/g, ""))?.clubName || settings?.clubName || currentVereinsId}
                              </span>
                            </div>
                            <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isMobileClubDropdownOpen ? "rotate-180" : ""}`}></i>
                          </button>

                          <AnimatePresence>
                            {isMobileClubDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0, scale: 0.96 }}
                                animate={{ opacity: 1, height: "auto", scale: 1 }}
                                exit={{ opacity: 0, height: 0, scale: 0.96 }}
                                transition={{ duration: 0.18, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="w-full bg-white rounded-xl border border-slate-200 shadow-md py-1 z-10 mt-1">
                                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 flex items-center justify-between">
                                    <span>Verein wechseln</span>
                                    <i className="fa-solid fa-arrow-right-arrow-left text-[9px] text-[var(--color-primary)]"></i>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                    {uniqueUserClubs.map((club) => {
                                      const clubId = club.id || club.vereinsId;
                                      const targetVereinsId = club.vereinsId || club.id;
                                      const isActive = targetVereinsId === currentVereinsId || String(targetVereinsId).toLowerCase().replace(/\s/g, "") === String(currentVereinsId).toLowerCase().replace(/\s/g, "");
                                      return (
                                        <button
                                          key={clubId}
                                          onClick={() => {
                                            handleSwitchClub(targetVereinsId);
                                            setIsMobileClubDropdownOpen(false);
                                            setIsMoreMenuOpen(false);
                                          }}
                                          className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                            isActive
                                              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                                              : "text-slate-700 hover:bg-slate-50 font-medium"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-[var(--color-primary)]" : "bg-slate-300"}`} />
                                            <span className="truncate">{club.clubName || club.vereinsId}</span>
                                          </div>
                                          {isActive && (
                                            <i className="fa-solid fa-check text-xs text-[var(--color-primary)] shrink-0"></i>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fixed bottom Profile Card / Logout Area */}
                  <div className="fixed bottom-16 left-0 right-0 z-[1900] bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 px-6 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)] select-none">
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <UserAvatar user={currentUser} size="sm" />
                      <div className="min-w-0">
                        <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">
                          Angemeldet als
                        </span>
                        <span className="block text-xs font-bold text-slate-800 truncate max-w-[150px]">
                          {(currentUser.firstName || currentUser.lastName)
                            ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
                            : (currentUser.klarname || currentUser.name)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMoreMenuOpen(false);
                      }}
                      className="px-4 h-10 bg-red-600 hover:bg-black text-white font-medium rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer !text-sm"
                      style={{ fontSize: "14px" }}
                    >
                      Abmelden
                      <i className="fa-solid fa-right-from-bracket text-[14px]"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <Dashboard
                  bookings={anonymizedBookings}
                  currentUser={proxyUser || currentUser}
                  users={users}
                  courts={settings.courts}
                  reservationRules={settings.reservationRules}
                  onBook={handleBook}
                  onCancel={handleCancel}
                  onLockRange={handleLockRange}
                  settings={settings}
                  userClubs={uniqueUserClubs}
                  onSwitchClub={handleSwitchClub}
                  mobileViewType={mobileViewType}
                  onMobileViewTypeChange={setMobileViewType}
                  mobileSelectedDate={mobileSelectedDate}
                  onMobileSelectedDateChange={(d) => {
                    setMobileSelectedDate(d);
                    handleSetView("reservation");
                  }}
                  isPublicWochenplan={isPublicWochenplanRoute && !currentUser}
                  onPublicLoginSuccess={(loggedInUser) => {
                    setCurrentUser(loggedInUser);
                  }}
                  onDismissOnboardingHints={handleDismissOnboardingHints}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {pendingView && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-slate-200/80 animate-in zoom-in-95">
              <h3 className="font-black text-lg mb-2">
                Ungespeicherte Änderungen
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Möchtest du das Menü wirklich verlassen? Alle ungespeicherten
                Änderungen gehen dabei verloren.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setTriggerAdminSave((prev) => prev + 1);
                    setTimeout(() => {
                      setView(pendingView);
                      if (
                        window.innerWidth < 1024 &&
                        pendingView === "reservation"
                      ) {
                        setIsMoreMenuOpen(true);
                      }
                      setPendingView(null);
                    }, 100);
                  }}
                  className="w-full py-3 bg-[#1b4332] hover:bg-black text-white rounded-xl font-bold text-xs transition-colors"
                >
                  Speichern & Verlassen
                </button>
                <button
                  onClick={() => {
                    setAdminSettingsDirty(false);
                    setView(pendingView);
                    if (
                      window.innerWidth < 1024 &&
                      pendingView === "reservation"
                    ) {
                      setIsMoreMenuOpen(true);
                    }
                    setPendingView(null);
                  }}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors"
                >
                  Änderungen verwerfen
                </button>
                <button
                  onClick={() => setPendingView(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {showProfile && (proxyUser || currentUser) && (
          <ProfileModal
            currentUser={(proxyUser || currentUser)!}
            loggedInUser={currentUser}
            allUsers={users}
            settings={settings}
            onCloseStart={() => {
              if (window.innerWidth < 1024) {
                setIsMoreMenuOpen(true);
              }
            }}
            onClose={() => {
              setShowProfile(false);
            }}
            onSuccess={(updatedUser) => {
              if (proxyUser) {
                setProxyUser(updatedUser);
              } else {
                setCurrentUser(updatedUser);
              }
              // also update users list state so it immediately propagates on screens
              const key = updatedUser.name.toLowerCase().replace(/\s/g, '');
              setUsers((prev) => ({ ...prev, [key]: updatedUser }));
            }}
            primaryColor={settings.primaryColor}
          />
        )}

        {/* Multi-Tenant Member Onboarding Modal on Login */}
        {settings.club_onboarding_settings?.enable_onboarding &&
          currentUser &&
          currentUser.onboarding_pending &&
          !proxyUser && (
            <MemberOnboardingModal
              currentUser={currentUser}
              settings={settings}
              currentClubId={currentVereinsId}
              onSuccess={(updatedUser) => {
                setCurrentUser(updatedUser);
                const key = (updatedUser.id || updatedUser.name).toLowerCase().replace(/\s/g, '');
                setUsers((prev) => ({ ...prev, [key]: updatedUser }));
              }}
            />
        )}

        {/* Mobile Bottom Navigation Bar (YouTube style) */}
        {!isPublicWochenplanRoute && (
          <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.05)] px-2 pb-[safe-area-inset-bottom] h-16 flex items-center justify-around lg:hidden select-none">
            {/* Tagesansicht */}
          <button
            type="button"
            onClick={() => {
              const todayStr = getTodayStr();
              if (view === "reservation" && mobileViewType === "day") {
                if (mobileSelectedDate !== todayStr) {
                  setMobileSelectedDate(todayStr);
                }
              } else {
                setMobileViewType("day");
                handleSetView("reservation");
              }
              setIsMoreMenuOpen(false);
              setShowMobileCalendar(false);
            }}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 outline-none cursor-pointer ${
              view === "reservation" && mobileViewType === "day" && !showMobileCalendar
                ? "text-[var(--color-primary)] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Calendar className="w-5 h-5" strokeWidth={view === "reservation" && mobileViewType === "day" && !showMobileCalendar ? 2.25 : 1.8} />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wide">
              Tag
            </span>
          </button>

          {/* Wochenansicht */}
          <button
            type="button"
            onClick={() => {
              setMobileViewType("week");
              handleSetView("reservation");
              setIsMoreMenuOpen(false);
              setShowMobileCalendar(false);
            }}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 outline-none cursor-pointer ${
              view === "reservation" && mobileViewType === "week" && !showMobileCalendar
                ? "text-[var(--color-primary)] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <CalendarRange className="w-5 h-5" strokeWidth={view === "reservation" && mobileViewType === "week" && !showMobileCalendar ? 2.25 : 1.8} />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wide">
              Woche
            </span>
          </button>

          {/* Tag auswählen */}
          <button
            type="button"
            onClick={() => {
              if (showMobileCalendar) {
                setShowMobileCalendar(false);
              } else {
                setTempSelectedDate(mobileSelectedDate);
                setCalendarMonth(new Date(mobileSelectedDate));
                setShowMobileCalendar(true);
                setIsMoreMenuOpen(false);
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 outline-none cursor-pointer ${
              showMobileCalendar
                ? "text-[var(--color-primary)] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Calendar className="w-5 h-5" strokeWidth={showMobileCalendar ? 2.25 : 1.8} />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wide">
              Datum
            </span>
          </button>

          {/* Weiteres */}
          <button
            type="button"
            onClick={() => {
              if (view !== "reservation") {
                setView("reservation");
                setIsMoreMenuOpen(true);
              } else {
                setIsMoreMenuOpen((prev) => !prev);
              }
              setShowMobileCalendar(false);
            }}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 outline-none cursor-pointer ${
              (isMoreMenuOpen || view !== "reservation") && !showMobileCalendar
                ? "text-[var(--color-primary)] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={(isMoreMenuOpen || view !== "reservation") && !showMobileCalendar ? 2.25 : 1.8} />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wide">
              Weiteres
            </span>
          </button>
        </div>
        )}
      </Layout>
    </>
  );
};

export default App;
