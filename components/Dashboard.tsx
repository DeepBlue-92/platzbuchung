import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { TIME_SLOTS, INITIAL_USERS } from "../constants";
import { Booking, User, Role, DynamicLeague } from "../types";
import { ClubSettings, listenToSettings, listenToBookings, listenToClubs, saveBooking } from "../services/db";
import { getUserClubs, getCanonicalClubId, KNOWN_CLUBS_STAMMDATEN } from "../lib/userUtils";
import { loginWithUsername } from "../lib/firebase";
import OnboardingBanner from "./OnboardingBanner";
import { UserAvatar } from "./UserAvatar";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { createLeagueMatch, listenToDynamicLeagues, isLeagueActiveDoc } from "../services/league";
import { checkPlayerCollisionAsync } from "../services/collisionService";
import { getWaterfallAssignedLeague, isPlayerEligibleForLeague } from "../utils/playerHelper";
import { DEFAULT_DYNAMIC_LEAGUES } from "../services/db";

const FIRST_NAMES_DB = [
  "marcandreterstegen",
  "marcandre",
  "annalena",
  "alexander",
  "elisabeth",
  "christian",
  "christine",
  "christoph",
  "sebastian",
  "steffen",
  "steffi",
  "stefanie",
  "stefan",
  "susanne",
  "sören",
  "tanja",
  "thea",
  "thomas",
  "timo",
  "toni",
  "ulrich",
  "ursula",
  "patrick",
  "robert",
  "herbert",
  "roswitha",
  "florian",
  "johann",
  "alois",
  "amelie",
  "andrea",
  "andreas",
  "andre",
  "angelika",
  "anita",
  "anja",
  "antonio",
  "barbara",
  "bela",
  "bernhard",
  "carolin",
  "daniela",
  "daniel",
  "david",
  "dennis",
  "dieter",
  "dietmar",
  "elena",
  "elisa",
  "ella",
  "erika",
  "fabienne",
  "felix",
  "frank",
  "franziska",
  "franz",
  "fritz",
  "gaby",
  "georg",
  "gerhard",
  "hannah",
  "hanna",
  "hans",
  "heidi",
  "helmut",
  "horst",
  "isabella",
  "jacqueline",
  "jakob",
  "jamal",
  "jan",
  "jessica",
  "jimmy",
  "joerg",
  "jonas",
  "jonathan",
  "josef",
  "joshua",
  "juergen",
  "jürgen",
  "julia",
  "julian",
  "kai",
  "karin",
  "kathrin",
  "katrin",
  "kilian",
  "laura",
  "leo",
  "leroy",
  "lina",
  "linus",
  "lisa",
  "loni",
  "lucas",
  "lukas",
  "manuel",
  "maria",
  "marieke",
  "marina",
  "marion",
  "markus",
  "martin",
  "matthias",
  "maximilian",
  "michaela",
  "michael",
  "mila",
  "moritz",
  "nadine",
  "niclas",
  "nicole",
  "nikolaus",
  "nina",
  "olaf",
  "oscar",
  "peter",
  "petra",
  "philipp",
  "pia",
  "quirin",
  "rainer",
  "raphaela",
  "renate",
  "rene",
  "richard",
  "rinor",
  "rita",
  "rudolf",
  "rüdiger",
  "sabine",
  "sabrina",
  "sandra",
  "sarah",
  "simon",
  "sindy",
  "system",
  "admin"
];

export function formatPlayerName(name: string): string {
  if (!name) return "";
  let cleaned = name.trim();

  // Remove trailing email domains or tenant suffixes like _sv-neuhausen
  if (cleaned.includes("@")) {
    cleaned = cleaned.split("@")[0];
  }
  if (cleaned.includes("_")) {
    cleaned = cleaned.split("_")[0];
  }

  // Remove numbers and dots
  cleaned = cleaned.replace(/[0-9.]/g, "");

  if (cleaned.toLowerCase() === "admin") return "Admin";
  if (cleaned.toLowerCase() === "superadmin") return "Super-Admin";
  if (cleaned.toLowerCase() === "system admin") return "System Admin";

  // If it already contains spaces or is mixed case, assume it has first and last names
  if (cleaned.includes(" ") || (cleaned !== cleaned.toLowerCase() && cleaned !== cleaned.toUpperCase())) {
    // Just sanitize the space splitting and capitalize each part
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Check known first name prefixes
  const lower = cleaned.toLowerCase();
  for (const prefix of FIRST_NAMES_DB) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const firstName = cleaned.slice(0, prefix.length);
      const lastName = cleaned.slice(prefix.length);

      const capFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      const capLast = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
      return `${capFirst} ${capLast}`;
    }
  }

  // Fallback: Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}


interface PlayerInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  idx: number;
  suggestions: string[];
  isActive: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSelect: (v: string) => void;
}

const PlayerInput: React.FC<PlayerInputProps> = ({
  label,
  value,
  onChange,
  idx,
  suggestions,
  isActive,
  onFocus,
  onBlur,
  onSelect,
}) => {
  return (
    <div className="relative w-full min-w-0">
      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
        {label}
      </label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={() => setTimeout(onBlur, 200)}
        placeholder="Spieler suchen..."
        className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-sm transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
      />
      {isActive && value.length > 0 && suggestions.length > 0 && (
        <div className="absolute z-[110] w-full mt-1 bg-white border-2 border-slate-400 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(s);
              }}
              className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 font-bold text-slate-700 border-b last:border-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface DashboardProps {
  bookings: Booking[];
  currentUser: User | null;
  users: Record<string, User>;
  courts: string[];
  reservationRules: ClubSettings["reservationRules"];
  onBook: (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    players: string[],
    hasBallMachine: boolean,
    guestCount?: number,
    deleteId?: string,
    comment?: string,
  ) => Promise<string | null> | string | null;
  onCancel: (id: string) => Promise<string | null> | string | null;
  onLockRange: (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    reason: string,
    recurring: boolean,
    recurringUntil?: string,
  ) => void;
  settings?: ClubSettings;
  mobileViewType?: "day" | "week";
  onMobileViewTypeChange?: (v: "day" | "week") => void;
  mobileSelectedDate?: string;
  onMobileSelectedDateChange?: (d: string) => void;
  isPublicWochenplan?: boolean;
  onPublicLoginSuccess?: (u: User) => void;
  onDismissOnboardingHints?: () => void;
  userClubs?: any[];
  allClubs?: any[];
  onSwitchClub?: (clubId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  bookings,
  currentUser,
  users,
  courts,
  reservationRules,
  onBook,
  onCancel,
  onLockRange,
  settings,
  mobileViewType,
  onMobileViewTypeChange,
  mobileSelectedDate,
  onMobileSelectedDateChange,
  isPublicWochenplan = false,
  onPublicLoginSuccess,
  onDismissOnboardingHints,
  userClubs,
  allClubs: propAllClubs,
  onSwitchClub,
}) => {
  const [leagueUsers, setLeagueUsers] = useState<User[]>([]);

  const formatPlayerName = useCallback((name: string): string => {
    const trimmed = name.trim();
    
    // Try finding the user by their ID / username in the users list or leagueUsers list
    let foundUser = users[trimmed] || leagueUsers.find((u) => u.id === trimmed || u.name === trimmed || u.username === trimmed);
    
    if (!foundUser) {
      // Find user by scanning users values and leagueUsers for matching username, klarname, or full name combinations
      const allKnownUsers = [...Object.values(users), ...leagueUsers];
      foundUser = allKnownUsers.find((u) => {
        if (!u) return false;
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`.trim().replace(/^, |,$/, "");
        return (
          (u.name && u.name.toLowerCase() === trimmed.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === trimmed.toLowerCase()) ||
          (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
          (full && full.toLowerCase() === trimmed.toLowerCase()) ||
          (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
        );
      });
    }

    if (foundUser) {
      if (foundUser.firstName || foundUser.lastName) {
        const first = foundUser.firstName || "";
        const last = foundUser.lastName || "";
        if (first && last) return `${first} ${last}`;
        return first || last || foundUser.name;
      }
      if (foundUser.klarname) {
        if (foundUser.klarname.includes(",")) {
          const parts = foundUser.klarname.split(",").map((p) => p.trim());
          if (parts.length === 2) {
            return `${parts[1]} ${parts[0]}`;
          }
        }
        return foundUser.klarname;
      }
      return foundUser.name;
    }

    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").map((p) => p.trim());
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
      }
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }

    return trimmed;
  }, [users, leagueUsers]);

  const formatPlayerNameCompact = useCallback((name: string): string => {
    const trimmed = name.trim();
    
    // Try finding the user by their ID / username in the users list or leagueUsers list
    let foundUser = users[trimmed] || leagueUsers.find((u) => u.id === trimmed || u.name === trimmed || u.username === trimmed);
    
    if (!foundUser) {
      // Find user by scanning users values and leagueUsers for matching username, klarname, or full name combinations
      const allKnownUsers = [...Object.values(users), ...leagueUsers];
      foundUser = allKnownUsers.find((u) => {
        if (!u) return false;
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`.trim().replace(/^, |,$/, "");
        return (
          (u.name && u.name.toLowerCase() === trimmed.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === trimmed.toLowerCase()) ||
          (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
          (full && full.toLowerCase() === trimmed.toLowerCase()) ||
          (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
        );
      });
    }

    if (foundUser) {
      if (foundUser.firstName || foundUser.lastName) {
        const first = foundUser.firstName || "";
        const last = foundUser.lastName || "";
        if (first && last) return `${last}, ${first.charAt(0)}.`;
        return last || first || foundUser.name;
      }
      if (foundUser.klarname) {
        if (foundUser.klarname.includes(",")) {
          const parts = foundUser.klarname.split(",").map((p) => p.trim());
          if (parts.length === 2) {
            return `${parts[0]}, ${parts[1].charAt(0)}.`;
          }
        }
        const parts = foundUser.klarname.split(/\s+/);
        if (parts.length > 1) {
           const last = parts.pop();
           const first = parts[0];
           return `${last}, ${first.charAt(0)}.`;
        }
        return foundUser.klarname;
      }
      return foundUser.name;
    }

    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").map((p) => p.trim());
      if (parts.length === 2) {
        return `${parts[0]}, ${parts[1].charAt(0)}.`;
      }
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const last = parts.pop();
      const first = parts[0];
      return `${last}, ${first.charAt(0)}.`;
    }

    return trimmed;
  }, [users]);

  const formatEventTitle = useCallback((title: string): string => {
    if (!title) return "";
    let text = title.trim();
    if (text === text.toUpperCase() && text.length > 3) {
      text = text.toLowerCase().split(/\s+/).map(word => {
        if (word.length <= 1) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(" ");
    }
    const mappings = [
      { key: "Damentraining", val: "Damen\u00adtraining" },
      { key: "Dienstagsdoppel", val: "Dienstags\u00addoppel" },
      { key: "Freitagsdoppel", val: "Freitags\u00addoppel" },
      { key: "Herrentraining", val: "Herren\u00adtraining" },
      { key: "Kindertraining", val: "Kinder\u00adtraining" },
      { key: "Seniorentennis", val: "Senioren\u00adtennis" },
      { key: "Tenniskindergarten", val: "Tennis\u00adkinder\u00adgarten" }
    ];
    for (const m of mappings) {
      const regex = new RegExp(m.key, "gi");
      text = text.replace(regex, m.val);
    }
    return text;
  }, []);

  // Helper to reliably get local YYYY-MM-DD format avoiding UTC offset leaps
  const getLocalDateString = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [selectedDateState, setSelectedDateState] = useState(
    getLocalDateString(new Date()),
  );
  const selectedDate =
    mobileSelectedDate !== undefined ? mobileSelectedDate : selectedDateState;
  const setSelectedDate = useCallback(
    (d: string) => {
      setSelectedDateState(d);
      onMobileSelectedDateChange?.(d);
    },
    [onMobileSelectedDateChange],
  );

  const getEventCategory = (title: string): "adult" | "youth" | "general" => {
    if (!title) return "general";
    const low = title.toLowerCase();
    
    if (
      low.includes("jugend") || 
      low.includes("kinder") || 
      low.includes("bambini") || 
      low.includes("junioren") || 
      low.includes("juniorinnen") || 
      low.includes("mädchen") || 
      low.includes("knaben") ||
      low.includes("kids") ||
      low.includes("u10") ||
      low.includes("u12") ||
      low.includes("u15") ||
      low.includes("u18")
    ) {
      return "youth";
    }

    if (
      low.includes("herren") || 
      low.includes("damen") || 
      low.includes("mannschaft") || 
      low.includes("erwachsen") || 
      low.includes("aktive") || 
      low.includes("senioren") || 
      low.includes("liga") ||
      low.includes("training")
    ) {
      return "adult";
    }

    return "general";
  };

  const getEventStyles = (titleOrReason: string) => {
    const cat = getEventCategory(titleOrReason);
    if (cat === "adult") {
      return {
        bg: "bg-emerald-50",
        hoverBg: "hover:bg-emerald-100",
        border: "border-emerald-200",
        text: "text-emerald-950 font-black",
        borderAccent: "border-l-4 border-l-emerald-600",
        borderAccentColor: "border-emerald-600",
        textSaturated: "text-emerald-700",
        iconClass: "text-emerald-600",
        pillBg: "bg-emerald-100 text-emerald-800 border border-emerald-150",
        titleClass: "text-emerald-400",
        cardBg: "bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100",
        innerBorder: "border-emerald-200",
        textLabel: "Erwachsenentraining"
      };
    } else if (cat === "youth") {
      return {
        bg: "bg-indigo-50/90",
        hoverBg: "hover:bg-indigo-100",
        border: "border-indigo-200",
        text: "text-indigo-950 font-black",
        borderAccent: "border-l-4 border-l-indigo-600",
        borderAccentColor: "border-indigo-600",
        textSaturated: "text-indigo-700",
        iconClass: "text-indigo-600",
        pillBg: "bg-indigo-100 text-indigo-800 border border-indigo-150",
        titleClass: "text-indigo-400",
        cardBg: "bg-indigo-50 border-indigo-200 text-indigo-950 hover:bg-indigo-100",
        innerBorder: "border-indigo-200",
        textLabel: "Jugendtraining"
      };
    } else {
      return {
        bg: "bg-emerald-50",
        hoverBg: "hover:bg-emerald-100",
        border: "border-emerald-200",
        text: "text-emerald-950 font-black",
        borderAccent: "border-l-4 border-l-emerald-600",
        borderAccentColor: "border-emerald-600",
        textSaturated: "text-emerald-800",
        iconClass: "text-emerald-600",
        pillBg: "bg-emerald-100 text-emerald-800 border border-emerald-150",
        titleClass: "text-emerald-500",
        cardBg: "bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100",
        innerBorder: "border-emerald-200",
        textLabel: "Vereinstermin"
      };
    }
  };

  const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
    let c = hex.replace(/^#/, "");
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    if (c.length !== 6) return null;

    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };

  const getBookingStyleProperties = (
    booking: Booking | null | undefined,
    isMyBooking: boolean,
    defaultPrimaryHex: string | undefined,
  ) => {
    if (!booking) return null;

    // Locks that are not events (e.g. general Sperrung) stay default
    if (booking.isLocked && !booking.isEvent) return null;

    let hex = booking.color || defaultPrimaryHex || "#10b981";
    if (!booking.isLocked) {
      // regular booking uses primary green color
      hex = booking.color || defaultPrimaryHex || "#10b981";
    }

    if (!hex.startsWith("#")) {
      hex = "#" + hex;
    }

    const hsl = hexToHsl(hex);
    if (!hsl) {
      return {
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        borderColor: "rgba(16, 185, 129, 0.3)",
        borderLeftColor: "#10b981",
        color: "#064e3b",
      };
    }

    return {
      backgroundColor: `hsl(${hsl.h}, ${hsl.s}%, 96%)`, // 10% opacity roughly (96% lightness)
      borderColor: `hsl(${hsl.h}, ${hsl.s}%, 85%)`,
      borderLeftColor: `hsl(${hsl.h}, ${hsl.s}%, 45%)`,
      color: `hsl(${hsl.h}, ${hsl.s}%, 20%)`, // fully opaque dark admin base color
    };
  };

  const getEventStyleProperties = (booking: Booking | undefined, defaultPrimaryHex: string | undefined) => {
    if (!booking || !booking.isLocked || !booking.isEvent) return null;
    let hex = booking.color || defaultPrimaryHex || "#10b981";
    if (!hex.startsWith("#")) {
      hex = "#" + hex;
    }

    const hsl = hexToHsl(hex);
    if (!hsl) {
      // Safe fallback if hex parsing fails
      return {
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        borderColor: "rgba(16, 185, 129, 0.3)",
        borderLeftColor: "#10b981",
        color: "#064e3b",
      };
    }

    return {
      backgroundColor: `hsl(${hsl.h}, ${hsl.s}%, 96%)`,
      borderColor: `hsl(${hsl.h}, ${hsl.s}%, 45%)`,
      borderLeftColor: `hsl(${hsl.h}, ${hsl.s}%, 45%)`,
      color: `hsl(${hsl.h}, ${hsl.s}%, 20%)`,
    };
  };

  const isAdmin = useMemo(() => {
    return (
      currentUser?.role === Role.ADMIN ||
      currentUser?.role === Role.SUPER_ADMIN ||
      (currentUser as any)?.role === "super-admin" ||
      (currentUser as any)?.hauptAdmin === true
    );
  }, [currentUser]);

  const isPastAllowed = useMemo(() => {
    return isAdmin || (reservationRules?.allowPastBookings ?? true);
  }, [isAdmin, reservationRules]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsClosing(false);
    setIsAnimatingIn(false);
    setIsModalOpen(true);
    // Trigger entrance animation with a small delay
    setTimeout(() => setIsAnimatingIn(true), 10);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsClosing(true);
    setIsAnimatingIn(false);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
    }, 200); // 200ms out animation
  }, []);

  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    court: string;
    editingId?: string;
  } | null>(null);

  const [bookingTab, setBookingTab] = useState<"normal" | "league">("normal");
  const [leagueOpponentQuery, setLeagueOpponentQuery] = useState("");
  const [leagueOpponent, setLeagueOpponent] = useState<string | null>(null);
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);

  // Resolved opponent user object for avatar & details
  const selectedOpponentUser = useMemo(() => {
    if (!leagueOpponent) return null;
    const inLeague = leagueUsers.find(
      (u) => u.id === leagueOpponent || u.name === leagueOpponent || resolvePlayerDisplayName(u) === leagueOpponent
    );
    if (inLeague) return inLeague;
    if (users && users[leagueOpponent]) return users[leagueOpponent];
    if (users) {
      const inUsers = Object.values(users).find(
        (u) => u.id === leagueOpponent || u.name === leagueOpponent || resolvePlayerDisplayName(u) === leagueOpponent
      );
      if (inUsers) return inUsers;
    }
    return null;
  }, [leagueOpponent, leagueUsers, users]);

  const isLeagueEnabledInClub = settings?.modules?.league === true;
  const hasHobbyLeagueOptIn = currentUser?.hobbyLeagueOptIn === true || (currentUser?.hobbyLeagueOptIn as any) === "true";
  const canBookHobbyLeague = isLeagueEnabledInClub && hasHobbyLeagueOptIn;

  // Multi-facility state for booking slider
  const [selectedFacilityClubId, setSelectedFacilityClubId] = useState<string>(settings?.vereinsId || 'sv-neuhausen');
  const [currentFacilitySettings, setCurrentFacilitySettings] = useState<ClubSettings | undefined>(settings);
  const [currentFacilityBookings, setCurrentFacilityBookings] = useState<Booking[]>(bookings);
  const [systemClubs, setSystemClubs] = useState<any[]>([]);

  const [isLockMode, setIsLockMode] = useState(false);
  const [reason, setReason] = useState("Training");
  const [additionalPlayers, setAdditionalPlayers] = useState<string[]>([]);
  const [playerQuery, setPlayerQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [comment, setComment] = useState("");
  const [hasBallMachine, setHasBallMachine] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [modalStartTime, setModalStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isFullDay, setIsFullDay] = useState(false);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  const [selectedCourtInModal, setSelectedCourtInModal] = useState<string>('');

  const handleSwitchFacility = (newClubId: string) => {
    setSelectedFacilityClubId(newClubId);
  };

  // Load system clubs
  useEffect(() => {
    try {
      const cached = localStorage.getItem('v2_clubs_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSystemClubs(parsed);
        }
      }
    } catch {}

    const unsub = listenToClubs((clubs) => {
      if (clubs && clubs.length > 0) {
        setSystemClubs(clubs);
      }
    });
    return () => unsub();
  }, []);

  // Available clubs list - comprehensive list of all participating league/system clubs
  const availableClubsList = useMemo(() => {
    const map = new Map<string, any>();
    const sourceClubs: any[] = [];

    const userClubList = userClubs && userClubs.length > 0 
      ? userClubs 
      : getUserClubs(currentUser, systemClubs);

    if (Array.isArray(userClubList)) sourceClubs.push(...userClubList);
    if (Array.isArray(systemClubs)) sourceClubs.push(...systemClubs);

    // Seed with known clubs master data
    Object.entries(KNOWN_CLUBS_STAMMDATEN).forEach(([kId, meta]) => {
      sourceClubs.push({
        id: kId,
        vereinsId: kId,
        clubName: meta.clubName,
        name: meta.clubName,
        city: meta.city,
        street: meta.street,
        zip: meta.zip,
        logoUrl: meta.logoUrl,
      });
    });

    sourceClubs.forEach((c) => {
      const id = c.vereinsId || c.id;
      if (id) {
        const canonicalKey = getCanonicalClubId(id);
        if (canonicalKey && !['super-admin', 'system'].includes(canonicalKey)) {
          if (map.has(canonicalKey)) {
            const existing = map.get(canonicalKey);
            map.set(canonicalKey, {
              ...existing,
              street: existing.street || c.street,
              zip: existing.zip || c.zip,
              city: existing.city || c.city,
              facilityPhotoUrl: existing.facilityPhotoUrl || c.facilityPhotoUrl,
            });
            return;
          }

          const matchedSystemClub = (systemClubs || []).find((sc) => {
            const scId = getCanonicalClubId(sc.vereinsId || sc.id || '');
            return scId === canonicalKey;
          });
          const knownMeta = KNOWN_CLUBS_STAMMDATEN[canonicalKey];

          let cleanClubName = matchedSystemClub?.clubName || matchedSystemClub?.vereinsName || matchedSystemClub?.name;
          if (!cleanClubName && knownMeta?.clubName) {
            cleanClubName = knownMeta.clubName;
          }
          if (!cleanClubName) {
            const raw = c.clubName || c.name;
            if (raw && typeof raw === 'string') {
              const trimmed = raw.trim();
              const lower = trimmed.toLowerCase();
              const isInvalid = ['api', 'system', 'super-admin', 'default', 'null', 'undefined', 'verein', 'tennis-club', 'tennis club', 'tennisclub'].includes(lower) || lower === canonicalKey;
              if (!isInvalid) {
                cleanClubName = trimmed;
              }
            }
          }
          if (!cleanClubName) {
            if (canonicalKey.includes('neuhausen')) cleanClubName = 'SV Neuhausen';
            else if (canonicalKey.includes('furth')) cleanClubName = 'DJK Furth';
            else if (canonicalKey.includes('sportsgeist')) cleanClubName = 'TC Sportsgeist';
            else cleanClubName = String(id);
          }

          const resolvedLogo = 
            matchedSystemClub?.customLogoUrl || 
            matchedSystemClub?.logoUrl || 
            matchedSystemClub?.customHeaderLogoUrl || 
            matchedSystemClub?.headerLogoUrl || 
            c.logoUrl || 
            knownMeta?.logoUrl;

          map.set(canonicalKey, {
            ...c,
            id: canonicalKey,
            vereinsId: canonicalKey,
            clubName: cleanClubName,
            name: cleanClubName,
            logoUrl: resolvedLogo,
            facilityPhotoUrl: matchedSystemClub?.facilityPhotoUrl || c.facilityPhotoUrl,
            street: matchedSystemClub?.street || c.street || knownMeta?.street,
            zip: matchedSystemClub?.zip || c.zip || knownMeta?.zip,
            city: matchedSystemClub?.city || c.city || knownMeta?.city,
          });
        }
      }
    });

    const currentCanonical = getCanonicalClubId(settings?.vereinsId || 'sv-neuhausen');
    if (map.size === 0 && currentCanonical && !['super-admin', 'system'].includes(currentCanonical)) {
      const known = KNOWN_CLUBS_STAMMDATEN[currentCanonical];
      map.set(currentCanonical, {
        id: currentCanonical,
        vereinsId: currentCanonical,
        clubName: settings?.clubName || known?.clubName || 'SV Neuhausen',
        name: settings?.clubName || known?.clubName || 'SV Neuhausen',
        logoUrl: settings?.logoUrl || settings?.headerLogoUrl || known?.logoUrl,
      });
    }

    return Array.from(map.values());
  }, [userClubs, currentUser, systemClubs, settings?.vereinsId, settings?.clubName, settings?.headerLogoUrl, settings?.logoUrl]);

  const currentFacilitySelectValue = useMemo(() => {
    const norm = getCanonicalClubId(selectedFacilityClubId);
    const match = availableClubsList.find((c) => getCanonicalClubId(c.vereinsId || c.id) === norm);
    return match ? (match.vereinsId || match.id) : selectedFacilityClubId;
  }, [availableClubsList, selectedFacilityClubId]);

  // Sync selected club when modal opens or settings change
  useEffect(() => {
    if (isModalOpen) {
      setSelectedFacilityClubId(settings?.vereinsId || 'sv-neuhausen');
    }
  }, [isModalOpen, settings?.vereinsId]);

  // Listen to settings and bookings for the selected facility
  useEffect(() => {
    if (!selectedFacilityClubId) return;

    const currentNorm = String(settings?.vereinsId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
    const selNorm = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');

    if (selNorm === currentNorm) {
      setCurrentFacilitySettings(settings);
      setCurrentFacilityBookings(bookings);
      return;
    }

    const unsubSettings = listenToSettings(selectedFacilityClubId, (s) => {
      setCurrentFacilitySettings(s);
    });

    const unsubBookings = listenToBookings(selectedFacilityClubId, (b) => {
      setCurrentFacilityBookings(b || []);
    });

    return () => {
      unsubSettings();
      unsubBookings();
    };
  }, [selectedFacilityClubId, settings, bookings]);

  const activeClubObj = useMemo(() => {
    const norm = getCanonicalClubId(selectedFacilityClubId);
    return (
      availableClubsList.find((c) => getCanonicalClubId(c.vereinsId || c.id) === norm) || null
    );
  }, [availableClubsList, selectedFacilityClubId]);

  const venueClubName =
    currentFacilitySettings?.clubName ||
    activeClubObj?.clubName ||
    activeClubObj?.vereinsName ||
    KNOWN_CLUBS_STAMMDATEN[getCanonicalClubId(selectedFacilityClubId)]?.clubName ||
    settings?.clubName ||
    'Tennisverein';

  const venueStreet =
    currentFacilitySettings?.street ||
    activeClubObj?.street ||
    settings?.street ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? 'Sportweg 4' : '');
  const venueZip =
    currentFacilitySettings?.zip ||
    activeClubObj?.zip ||
    settings?.zip ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? '84030' : '');
  const venueCity =
    currentFacilitySettings?.city ||
    activeClubObj?.city ||
    settings?.city ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? 'Ergolding' : '');

  const fullAddress = [venueStreet, [venueZip, venueCity].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const displayAddress = fullAddress || ((settings?.street && settings?.city) ? `${settings.street}, ${settings.zip || ''} ${settings.city}` : "Keine Adresse hinterlegt");

  const venuePhoto =
    currentFacilitySettings?.facilityPhotoUrl ||
    currentFacilitySettings?.customFacilityPhotoUrl ||
    currentFacilitySettings?.headerLogoUrl ||
    currentFacilitySettings?.customLogoUrl ||
    currentFacilitySettings?.logoUrl ||
    settings?.facilityPhotoUrl ||
    settings?.customFacilityPhotoUrl ||
    settings?.headerLogoUrl ||
    settings?.customLogoUrl ||
    settings?.logoUrl ||
    activeClubObj?.facilityPhotoUrl ||
    activeClubObj?.customFacilityPhotoUrl ||
    activeClubObj?.logoUrl ||
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=800&auto=format&fit=crop';

  const mapsQuery = encodeURIComponent(`${venueClubName}, ${displayAddress}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  // Calculate court availability for the currently selected facility and time window
  const currentModalCourtOptions = useMemo(() => {
    const courtsList =
      currentFacilitySettings?.courts && currentFacilitySettings.courts.length > 0
        ? currentFacilitySettings.courts
        : courts && courts.length > 0
        ? courts
        : ['Platz 1', 'Platz 2', 'Platz 3', 'Platz 4'];

    if (!selectedSlot?.date) {
      return courtsList.map((c: string) => ({ name: c, isAvailable: true }));
    }

    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    const endIdx = TIME_SLOTS.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return courtsList.map((c: string) => ({ name: c, isAvailable: true }));
    }

    const slotsToCheck = TIME_SLOTS.slice(startIdx, endIdx);

    return courtsList.map((courtName: string) => {
      const isOccupied = slotsToCheck.some((t: string) => {
        // 1. Check existing bookings (excluding current editing booking)
        const hasBooking = currentFacilityBookings.some(
          (b) =>
            b.id !== selectedSlot.editingId &&
            b.date === selectedSlot.date &&
            b.court === courtName &&
            b.time === t,
        );
        if (hasBooking) return true;

        // 2. Check Range Locks
        const rangeLocks = currentFacilitySettings?.rangeLocks || [];
        const inRangeLock = rangeLocks.some((l: any) => {
          if (!l.courts || !l.courts.includes(courtName)) return false;
          if (selectedSlot.date < l.startDate || selectedSlot.date > l.endDate) return false;
          const sTime = l.startTime || '00:00';
          const eTime = l.endTime || '24:00';
          if (selectedSlot.date === l.startDate && t < sTime) return false;
          if (selectedSlot.date === l.endDate && t >= eTime) return false;
          return true;
        });
        if (inRangeLock) return true;

        // 3. Check Recurring Locks
        const recurringLocks = currentFacilitySettings?.recurringLocks || [];
        const inRecurringLock = recurringLocks.some((l: any) => {
          const d = new Date(selectedSlot.date);
          if (d.getDay() !== l.dayOfWeek) return false;
          if (!l.courts || !l.courts.includes(courtName)) return false;
          if (t < l.startTime || t >= l.endTime) return false;
          if (!l.isOngoing) {
            if (l.startDate && selectedSlot.date < l.startDate) return false;
            if (l.endDate && selectedSlot.date > l.endDate) return false;
          }
          return true;
        });
        if (inRecurringLock) return true;

        return false;
      });

      return {
        name: courtName,
        isAvailable: !isOccupied,
      };
    });
  }, [currentFacilitySettings, currentFacilityBookings, courts, selectedSlot?.date, selectedSlot?.editingId, modalStartTime, endTime]);

  // Automatically select the first available court if currently selected court is occupied or unset
  useEffect(() => {
    if (!isModalOpen || currentModalCourtOptions.length === 0) return;
    const currentValid = currentModalCourtOptions.find((c) => c.name === selectedCourtInModal);
    if (!currentValid || !currentValid.isAvailable) {
      const firstFree = currentModalCourtOptions.find((c) => c.isAvailable);
      if (firstFree) {
        setSelectedCourtInModal(firstFree.name);
      } else if (currentModalCourtOptions[0]) {
        setSelectedCourtInModal(currentModalCourtOptions[0].name);
      }
    }
  }, [isModalOpen, currentModalCourtOptions, selectedCourtInModal]);


  useEffect(() => {
    if (isModalOpen) {
      setBookingTab("normal");
      setLeagueOpponent(null);
      setLeagueOpponentQuery("");
    }
  }, [isModalOpen]);

  useEffect(() => {
    let active = true;
    const fetchLeagueUsers = async () => {
      if (!isLeagueEnabledInClub) return;
      try {
        // Query all registered users across all clubs and tenants without restriction
        const snap = await getDocs(collection(db, "users"));
        if (!active) return;
        
        const map = new Map<string, User>();
        
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const id = d.id;
          const username = data.username || data.name || id;
          const u: User = {
            id,
            name: username,
            username: data.username || username,
            firstName: data.firstName || data.vorname || "",
            lastName: data.lastName || data.nachname || "",
            klarname: data.klarname || (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : (data.vorname && data.nachname ? `${data.vorname} ${data.nachname}` : "")),
            displayName: data.displayName || data.klarname || "",
            email: data.email,
            role: data.role,
            gender: data.gender || data.geschlecht,
            birthYear: data.birthYear || data.geburtsjahr,
            birthDate: data.birthDate || data.geburtsdatum,
            leagueId: data.leagueId,
            vereinsId: data.tenantId || data.vereinsId,
            isSuspended: data.isSuspended,
            hobbyLeagueOptIn: data.hobbyLeagueOptIn,
            clubs: data.clubs,
            ...data,
          };
          if (u.isSuspended !== true) {
            map.set(id, u);
          }
        });

        // Also merge any local users from props if present
        if (users) {
          Object.values(users).forEach((u) => {
            if (u && u.id && !map.has(u.id) && u.isSuspended !== true) {
              map.set(u.id, u);
            }
          });
        }

        setLeagueUsers(Array.from(map.values()));
      } catch (e) {
        console.error("Error fetching league users:", e);
        if (active && users) {
          setLeagueUsers(Object.values(users).filter((u) => u && u.isSuspended !== true));
        }
      }
    };
    fetchLeagueUsers();
    return () => { active = false; };
  }, [isLeagueEnabledInClub, users]);

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

  const activeLeagues = useMemo(() => {
    const active = dynamicLeagues.filter((l) => isLeagueActiveDoc(l));
    return active.length > 0 ? active : dynamicLeagues;
  }, [dynamicLeagues]);

  const userLeagueObj = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.leagueId) {
      const direct = activeLeagues.find((l) => l.id === currentUser.leagueId);
      if (direct) return direct;
    }
    const userLeague = getWaterfallAssignedLeague(currentUser, activeLeagues);
    if (userLeague) return userLeague;
    const defaultLId = currentUser?.leagueId || "open_mixed";
    return activeLeagues.find((l) => l.id === defaultLId) || activeLeagues[0];
  }, [currentUser, activeLeagues]);

  const getFilteredLeagueUsers = (queryStr: string): User[] => {
    const lowerQ = queryStr ? queryStr.toLowerCase().trim() : "";
    const activeLId = userLeagueObj?.id || "open_mixed";
    
    return leagueUsers
      .filter((u) => {
        if (!u) return false;

        // Exclude current logged in user
        const isCurrentUser =
          u.id === currentUser?.id ||
          (u.name && currentUser?.name && u.name.toLowerCase() === currentUser.name.toLowerCase()) ||
          (u.username && currentUser?.username && u.username.toLowerCase() === currentUser.username.toLowerCase()) ||
          ((u as any).personId && (currentUser as any)?.personId && (u as any).personId === (currentUser as any).personId);
        if (isCurrentUser) return false;
        
        // Check eligibility for current league
        if (userLeagueObj) {
          const eligible = isPlayerEligibleForLeague(u, userLeagueObj, activeLId, u.leagueId, activeLeagues);
          if (!eligible) return false;
        }

        if (!lowerQ) return true;

        const fn = (u.firstName || (u as any).vorname || "").toLowerCase();
        const ln = (u.lastName || (u as any).nachname || "").toLowerCase();
        const kn = (u.klarname || "").toLowerCase();
        const dn = ((u as any).displayName || "").toLowerCase();
        const un = (u.name || u.username || "").toLowerCase();
        const full1 = `${fn} ${ln}`.trim();
        const full2 = `${ln} ${fn}`.trim();
        const full3 = `${ln}, ${fn}`.trim();
        const resolved = resolvePlayerDisplayName(u).toLowerCase();

        return (
          fn.includes(lowerQ) ||
          ln.includes(lowerQ) ||
          kn.includes(lowerQ) ||
          dn.includes(lowerQ) ||
          un.includes(lowerQ) ||
          full1.includes(lowerQ) ||
          full2.includes(lowerQ) ||
          full3.includes(lowerQ) ||
          resolved.includes(lowerQ)
        );
      });
  };

  const [inlineUsername, setInlineUsername] = useState("");
  const [inlinePassword, setInlinePassword] = useState("");
  const [isInlineLoggingIn, setIsInlineLoggingIn] = useState(false);
  const [inlineLoginError, setInlineLoginError] = useState<string | null>(null);
  const [isPublicLoginModalOpen, setIsPublicLoginModalOpen] = useState(false);

  const [viewTypeState, setViewTypeState] = useState<"day" | "week">(
    window.innerWidth < 1024 ? "day" : "week",
  );
  const viewType = isPublicWochenplan
    ? "week"
    : mobileViewType !== undefined
      ? mobileViewType
      : viewTypeState;
  const setViewType = useCallback(
    (v: "day" | "week") => {
      setViewTypeState(v);
      onMobileViewTypeChange?.(v);
    },
    [onMobileViewTypeChange],
  );
  const [mobileDayLayout, setMobileDayLayout] = useState<
    "timeline" | "columns"
  >(window.innerWidth < 1024 ? "timeline" : "columns");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(
    new Date(),
  );
  const calendarRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [swipeStyle, setSwipeStyle] = useState<React.CSSProperties>({});
  const prevDateRefForSwipe = useRef<string | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    if (!prevDateRefForSwipe.current) {
      prevDateRefForSwipe.current = selectedDate;
      return;
    }

    const prev = prevDateRefForSwipe.current;
    prevDateRefForSwipe.current = selectedDate;

    const prevTime = new Date(prev).getTime();
    const currTime = new Date(selectedDate).getTime();
    if (isNaN(prevTime) || isNaN(currTime) || prevTime === currTime) return;

    const isForward = currTime > prevTime;
    const startX = isForward ? "40px" : "-40px";

    setSwipeStyle({
      transform: `translateX(${startX})`,
      willChange: "transform",
      opacity: 0,
      transition: "none",
    });

    const transitionTimer = setTimeout(() => {
      setSwipeStyle({
        transform: "translateX(0)",
        willChange: "transform",
        opacity: 1,
        transition:
          "transform 200ms ease-out, opacity 200ms ease-out",
      });
    }, 16);

    const clearTimer = setTimeout(() => {
      setSwipeStyle({});
    }, 200 + 16);

    return () => {
      clearTimeout(transitionTimer);
      clearTimeout(clearTimer);
    };
  }, [selectedDate, isMobile]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setShowCustomCalendar(false);
      }
    }
    if (showCustomCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCustomCalendar]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const calendarDays = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Day of the week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Adjust so Sunday is 6, Monday is 0
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];

    // Placeholder padding for days of previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateString: getLocalDateString(
          new Date(year, month - 1, prevMonthDays - i),
        ),
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateString: getLocalDateString(new Date(year, month, i)),
      });
    }

    // Placeholder padding for days of next month to complete the row (multiples of 7)
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const nextDaysNeeded = totalSlots - days.length;
    for (let i = 1; i <= nextDaysNeeded; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        dateString: getLocalDateString(new Date(year, month + 1, i)),
      });
    }

    return days;
  }, [currentCalendarMonth]);

  const getDurationInHours = useCallback((start: string, end: string): number => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  }, []);

  const leagueEndTimeOptions = useMemo(() => {
    if (!modalStartTime) return [];
    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    if (startIdx === -1) return [];

    let closingIdx = TIME_SLOTS.length - 1;
    if (selectedSlot?.date && reservationRules?.openingHours) {
      const weekday = new Date(selectedSlot.date).getDay();
      const dayRule = reservationRules.openingHours[String(weekday)];
      if (dayRule && dayRule.end && !dayRule.closed) {
        const idx = TIME_SLOTS.indexOf(dayRule.end);
        if (idx !== -1) closingIdx = idx;
      }
    }

    const validSlots = TIME_SLOTS.slice(startIdx + 1, closingIdx + 1).filter((t) => {
      const dur = getDurationInHours(modalStartTime, t);
      return dur >= 2 && dur <= 3;
    });

    if (validSlots.length > 0) {
      return validSlots;
    }
    return TIME_SLOTS.slice(startIdx + 1, closingIdx + 1);
  }, [modalStartTime, getDurationInHours, selectedSlot?.date, reservationRules?.openingHours]);

  const currentLeagueDuration = useMemo(() => {
    return getDurationInHours(modalStartTime, endTime);
  }, [modalStartTime, endTime, getDurationInHours]);

  useEffect(() => {
    if (bookingTab === "league" && modalStartTime) {
      const currentDur = getDurationInHours(modalStartTime, endTime);
      // If current duration is not within 2 to 3 hours, default to exactly 2 hours
      if (currentDur < 2 || currentDur > 3) {
        const startIdx = TIME_SLOTS.indexOf(modalStartTime);
        if (startIdx >= 0) {
          const defaultEndIdx = Math.min(TIME_SLOTS.length - 1, startIdx + 2);
          setEndTime(TIME_SLOTS[defaultEndIdx]);
        }
      }
    }
  }, [bookingTab, modalStartTime, endTime, getDurationInHours]);

  const bookingOptions = [];
  bookingOptions.push({ id: "normal", label: "Freies Spiel" });
  if (isLeagueEnabledInClub) {
    bookingOptions.push({ id: "league", label: userLeagueObj?.name || "Ligaspiel" });
  }
  if (currentUser?.role === Role.ADMIN) {
    bookingOptions.push({ id: "lock", label: "Platz sperren" });
  }
  const activeMode = isLockMode ? "lock" : bookingTab === "league" ? "league" : "normal";

  const startTimes = useMemo(() => {
    let maxEndIdx = 0;
    if (reservationRules?.openingHours) {
      Object.values(reservationRules.openingHours).forEach((rule: any) => {
        if (!rule.closed && rule.end) {
          const idx = TIME_SLOTS.indexOf(rule.end);
          if (idx > maxEndIdx) maxEndIdx = idx;
        }
      });
    }
    if (maxEndIdx <= 0) {
      maxEndIdx = TIME_SLOTS.indexOf("22:00");
    }
    
    // Responsive Rendering-Array constraint:
    // Mobile: Limit to "21:00" max, so the last slot is "20 - 21"
    // Desktop: Respect the actual maxEndIdx defined by the club's opening hours (no artificial expansion to 22:00).
    if (isMobile) {
      maxEndIdx = Math.min(maxEndIdx, TIME_SLOTS.indexOf("21:00"));
    }

    return TIME_SLOTS.slice(0, maxEndIdx);
  }, [reservationRules?.openingHours, isMobile]);

  const gridHeight = isMobile ? `${startTimes.length * 38}px` : `max(480px, calc(100dvh - 270px))`;
  const slotHeight = isMobile ? "38px" : `${100 / startTimes.length}%`;

  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const currentOrNextHourSlot = useMemo(() => {
    const now = new Date();
    const currentHr = now.getHours();
    const currentMin = now.getMinutes();

    for (const slot of startTimes) {
      const [slotHr] = slot.split(":").map(Number);
      if (slotHr > currentHr || (slotHr === currentHr && currentMin === 0)) {
        return slot;
      }
    }
    return null;
  }, [startTimes]);
  const userList = useMemo(() => {
    return ((Object.values(users) as User[]) as User[]).sort((a, b) => {
      const lnA = (a.lastName || "")
        .trim()
        .localeCompare((b.lastName || "").trim(), "de", {
          sensitivity: "base",
        });
      if (lnA !== 0) return lnA;
      const fnA = (a.firstName || "")
        .trim()
        .localeCompare((b.firstName || "").trim(), "de", {
          sensitivity: "base",
        });
      if (fnA !== 0) return fnA;
      return a.name
        .trim()
        .localeCompare(b.name.trim(), "de", { sensitivity: "base" });
    });
  }, [users]);

  const getFullName = useCallback((u: User | null | undefined) => {
    if (!u) return "";
    if (u.firstName || u.lastName) {
      return `${u.firstName || ""} ${u.lastName || ""}`.trim();
    }
    if (u.klarname) return u.klarname;
    return u.name || "";
  }, []);

  const currentUserFullName = useMemo(
    () => (currentUser ? getFullName(currentUser) : ""),
    [currentUser, getFullName],
  );

  const editingBooking = useMemo(() => {
    if (!selectedSlot?.editingId || !bookings) return undefined;
    return bookings.find(b => b.id === selectedSlot.editingId);
  }, [selectedSlot?.editingId, bookings]);

  const isUserAuthorizedToEdit = useMemo(() => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (!editingBooking) return true;
    if (editingBooking.isLocked) return false;
    return (
      editingBooking.players.includes(currentUser.name) ||
      editingBooking.players.includes(currentUserFullName)
    );
  }, [currentUser, isAdmin, editingBooking, currentUserFullName]);

  const spieler1Name = useMemo(() => {
    if (editingBooking && editingBooking.players && editingBooking.players.length > 0) {
      return editingBooking.players[0];
    }
    return currentUserFullName;
  }, [editingBooking, currentUserFullName]);

  const handleAddPlayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      // Find custom match in userList (either by resolved name or username)
      const matchedUser = userList.find((u) => {
        const fullName = getFullName(u);
        return (
          fullName.toLowerCase() === trimmed.toLowerCase() ||
          (u.name || "").toLowerCase() === trimmed.toLowerCase()
        );
      });

      if (!matchedUser) {
        // Not a registered user! Block adding freetext
        return;
      }

      const resolvedName = getFullName(matchedUser);
      const isCurrentUser =
        matchedUser.id === currentUser?.id ||
        resolvedName.toLowerCase() === currentUserFullName.toLowerCase() ||
        (matchedUser.name || "").toLowerCase() ===
          (currentUser?.name || "").toLowerCase();

      if (
        additionalPlayers.some(
          (p) => p.toLowerCase() === resolvedName.toLowerCase(),
        ) ||
        isCurrentUser
      ) {
        setPlayerQuery("");
        return;
      }

      setAdditionalPlayers((prev) => [...prev, resolvedName]);
      setPlayerQuery("");
    },
    [
      additionalPlayers,
      currentUserFullName,
      currentUser,
      userList,
      getFullName,
    ],
  );

  const handleRemovePlayer = useCallback((idx: number) => {
    setAdditionalPlayers((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const getFilteredUsers = useCallback(
    (query: string) => {
      if (!query || query.length < 1) return [];
      const q = query.toLowerCase();
      const matches: string[] = [];
      const alreadyAdded = [
        ...additionalPlayers.map((p) => p.toLowerCase()),
        currentUserFullName.toLowerCase(),
        (currentUser?.name || "").toLowerCase(),
      ];
      for (const u of userList) {
        const fullName = getFullName(u);
        const lowerFullName = fullName.toLowerCase();
        const lowerUserName = (u.name || "").toLowerCase();

        const isCurrentUser =
          u.id === currentUser?.id ||
          lowerFullName === currentUserFullName.toLowerCase() ||
          lowerUserName === (currentUser?.name || "").toLowerCase();

        if (
          !isCurrentUser &&
          (lowerFullName.includes(q) || lowerUserName.includes(q)) &&
          !alreadyAdded.includes(lowerFullName) &&
          !matches.some(m => m.toLowerCase() === lowerFullName)
        ) {
          matches.push(fullName);
          if (matches.length >= 5) break;
        }
      }
      const results = matches;
      return results.slice(0, 5);
    },
    [
      userList,
      currentUser,
      currentUserFullName,
      getFullName,
      additionalPlayers,
    ],
  );

  const handleAddPlayerFromInput = useCallback(() => {
    const query = playerQuery.trim();
    if (!query) return;

    const suggestions = getFilteredUsers(query);
    if (suggestions.length > 0) {
      handleAddPlayer(suggestions[0]);
    } else {
      handleAddPlayer(query);
    }
  }, [playerQuery, getFilteredUsers, handleAddPlayer]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPlayerFromInput();
    }
  };

  const weekDates = useMemo(() => {
    const dates = [];
    const curr = new Date(selectedDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(getLocalDateString(d));
    }
    return dates;
  }, [selectedDate]);

  // Find range locks that overlap with currently displayed dates
  const activePeriodRangeLocks = useMemo(() => {
    const rangeLocks = settings?.rangeLocks || [];
    if (rangeLocks.length === 0) return [];

    const displayedDates = viewType === "day" ? [selectedDate] : weekDates;
    return rangeLocks.filter((lock) => {
      // Return true if any displayed date lies within the lock period
      return displayedDates.some(
        (date) => lock.startDate <= date && date <= lock.endDate,
      );
    });
  }, [settings?.rangeLocks, viewType, selectedDate, weekDates]);

  const getBooking = (
    date: string,
    time: string,
    court: string,
  ): Booking | undefined => {
    const matchedLocks: Booking[] = [];

    // 1. Check database manual locks first
    const manualLock = bookings.find(
      (b) =>
        b.date === date && b.time === time && b.court === court && b.isLocked,
    );
    if (manualLock) matchedLocks.push(manualLock);

    // 2. Check Range Locks in settings (e.g. Winterpause)
    const rangeLocks = settings?.rangeLocks || [];
    rangeLocks.forEach((l) => {
      if (!l.courts.includes(court)) return;
      if (date < l.startDate || date > l.endDate) return;

      const sTime = l.startTime || "00:00";
      const eTime = l.endTime || "24:00";

      if (date === l.startDate && time < sTime) return;
      if (date === l.endDate && time >= eTime) return;

      matchedLocks.push({
        id: `range-${l.id}-${date}-${time}-${court}`,
        date,
        time,
        court,
        players: [],
        isLocked: true,
        isEvent: l.isEvent,
        isOpenOffer: l.isEvent ? true : l.isOpenOffer,
        reason:
          l.title ||
          (l.isEvent
            ? "Serientermin"
            : "Platz gesperrt (Winterpause/Sperrung)"),
        hasBallMachine: false,
        bookedBy: "admin",
      });
    });

    // 3. Check Recurring Locks in settings (e.g. Freitagsdoppel)
    const recurringLocks = settings?.recurringLocks || [];
    recurringLocks.forEach((l) => {
      const d = new Date(date);
      const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (day !== l.dayOfWeek) return;
      if (!l.courts.includes(court)) return;
      if (time < l.startTime || time >= l.endTime) return;
      if (!l.isOngoing) {
        if (l.startDate && date < l.startDate) return;
        if (l.endDate && date > l.endDate) return;
      }

      matchedLocks.push({
        id: `recurring-${l.id}-${date}-${time}-${court}`,
        date,
        time,
        court,
        players: [],
        isLocked: true,
        isEvent: l.isEvent,
        isOpenOffer: l.isEvent ? true : l.isOpenOffer,
        reason: l.title || (l.isEvent ? "Vereinstraining" : "Platz gesperrt"),
        hasBallMachine: false,
        bookedBy: "admin",
        color: l.color,
      });
    });

    if (matchedLocks.length > 0) {
      // Höchste Priorität: Echte Sperren (!isEvent)
      const realLock = matchedLocks.find((l) => !l.isEvent);
      if (realLock) return realLock;

      // Ansonsten das Event
      return matchedLocks[0];
    }

    // 4. Check regular database bookings
    const dbBooking = bookings.find(
      (b) =>
        b.date === date && b.time === time && b.court === court && !b.isLocked,
    );
    if (dbBooking) return dbBooking;

    return undefined;
  };

  const isSlotPassed = useCallback((dateStr: string, timeStr: string) => {
    const now = new Date();
    const [yr, mon, day] = dateStr.split("-").map(Number);
    const [hr, min] = timeStr.split(":").map(Number);
    const slotTimeObj = new Date(yr, mon - 1, day, hr, min, 0, 0);
    return slotTimeObj < now;
  }, []);

  const getSlotStatus = useCallback(
    (dateStr: string, timeStr: string) => {
      // Check if user is admin
      const isAdmin =
        currentUser?.role === Role.ADMIN ||
        currentUser?.role === Role.SUPER_ADMIN ||
        (currentUser as any)?.hauptAdmin === true;

      // Check past
      const allowPast = reservationRules?.allowPastBookings ?? true;
      const now = new Date();
      const [yr, mon, day] = dateStr.split("-").map(Number);
      const [hr, min] = timeStr.split(":").map(Number);
      const slotTimeObj = new Date(yr, mon - 1, day, hr, min, 0, 0);

      // Sits slightly in the past? Let's check against hour boundary
      const isPast = slotTimeObj < now;
      if (isPast && !allowPast && !isAdmin) {
        return { disabled: true, type: "past" };
      }

      // Check max advance weeks
      const maxWeeks = reservationRules?.maxAdvanceWeeks ?? 2;
      const maxDaysInAdvance = maxWeeks * 7;
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + maxDaysInAdvance);
      limitDate.setHours(23, 59, 59, 999);

      if (slotTimeObj > limitDate && !isAdmin) {
        return { disabled: true, type: "advance" };
      }

      // Check opening hours
      const targetDateObj = new Date(yr, mon - 1, day);
      const weekday = targetDateObj.getDay();
      const dayRule = reservationRules?.openingHours?.[String(weekday)] || {
        start: "08:00",
        end: "22:00",
        closed: false,
      };

      if (dayRule.closed) {
        return { disabled: !isAdmin, type: "closed" };
      }

      const slotIdx = TIME_SLOTS.indexOf(timeStr);
      const ruleStartIdx = TIME_SLOTS.indexOf(dayRule.start || "08:00");
      const ruleEndIdx = TIME_SLOTS.indexOf(dayRule.end || "22:00");

      if (slotIdx < ruleStartIdx || slotIdx >= ruleEndIdx) {
        return { disabled: !isAdmin, type: "outside_hours" };
      }

      return { disabled: false };
    },
    [currentUser, reservationRules],
  );

  const getLockPositionInfo = (date: string, time: string, court: string) => {
    const currentBooking = getBooking(date, time, court);
    if (!currentBooking || !currentBooking.isLocked) return null;

    const currentReason = (currentBooking.reason || "GESPERRT")
      .trim()
      .toLowerCase();

    // Find all times in startTimes
    const times = startTimes;
    const currentIndex = times.indexOf(time);
    if (currentIndex === -1) return null;

    // Scan backwards to find the start of this contiguous locked block
    let startIndex = currentIndex;
    while (startIndex > 0) {
      const prevTime = times[startIndex - 1];
      const prevBooking = getBooking(date, prevTime, court);
      if (
        prevBooking &&
        prevBooking.isLocked &&
        (prevBooking.reason || "GESPERRT").trim().toLowerCase() ===
          currentReason
      ) {
        startIndex--;
      } else {
        break;
      }
    }

    // Scan forwards to find the end of this contiguous locked block
    let endIndex = currentIndex;
    while (endIndex < times.length - 1) {
      const nextTime = times[endIndex + 1];
      const nextBooking = getBooking(date, nextTime, court);
      if (
        nextBooking &&
        nextBooking.isLocked &&
        (nextBooking.reason || "GESPERRT").trim().toLowerCase() ===
          currentReason
      ) {
        endIndex++;
      } else {
        break;
      }
    }

    const length = endIndex - startIndex + 1;
    const relativeIndex = currentIndex - startIndex;
    const middleIndex = Math.floor(length / 2);

    return {
      isMiddle: relativeIndex === middleIndex,
      isFirst: relativeIndex === 0,
      isLast: relativeIndex === length - 1,
      length,
      reason: currentBooking.reason || "GESPERRT",
      booking: currentBooking,
    };
  };

  const computeLockedRegions = (
    dateStr: string,
    activeCourts: string[],
    activeTimes: string[],
  ) => {
    interface LockedRegion {
      startCourtIdx: number;
      endCourtIdx: number;
      startTimeIdx: number;
      endTimeIdx: number;
      reason: string;
      booking: Booking;
    }
    const regions: LockedRegion[] = [];
    const visited = Array.from({ length: activeTimes.length }, () =>
      Array(activeCourts.length).fill(false),
    );

    for (let tIdx = 0; tIdx < activeTimes.length; tIdx++) {
      const time = activeTimes[tIdx];
      for (let cIdx = 0; cIdx < activeCourts.length; cIdx++) {
        if (visited[tIdx][cIdx]) continue;
        const court = activeCourts[cIdx];
        const booking = getBooking(dateStr, time, court);

        if (booking && booking.isLocked) {
          const reason = (booking.reason || "GESPERRT").trim();
          const reasonLower = reason.toLowerCase();

          // 1. Find max width we can grow to the right (courts in same row tIdx)
          // NO HORIZONTAL SPANNING ALLOWED AS PER PROMPT
          let maxCIdx = cIdx;

          // 2. Find max height we can grow down (rows of times)
          let maxTIdx = tIdx;
          let canGrowDown = true;
          while (canGrowDown && maxTIdx + 1 < activeTimes.length) {
            const checkTime = activeTimes[maxTIdx + 1];
            // All courts in the span [cIdx, maxCIdx] must be locked with the same reason at checkTime
            for (let col = cIdx; col <= maxCIdx; col++) {
              const checkCourt = activeCourts[col];
              if (visited[maxTIdx + 1][col]) {
                canGrowDown = false;
                break;
              }
              const checkBooking = getBooking(dateStr, checkTime, checkCourt);
              if (
                !checkBooking ||
                !checkBooking.isLocked ||
                (checkBooking.reason || "GESPERRT").trim().toLowerCase() !==
                  reasonLower
              ) {
                canGrowDown = false;
                break;
              }
            }
            if (canGrowDown) {
              maxTIdx++;
            }
          }

          // 3. Mark all cells in this rectangular region as visited
          for (let r = tIdx; r <= maxTIdx; r++) {
            for (let c = cIdx; c <= maxCIdx; c++) {
              visited[r][c] = true;
            }
          }

          regions.push({
            startCourtIdx: cIdx,
            endCourtIdx: maxCIdx,
            startTimeIdx: tIdx,
            endTimeIdx: maxTIdx,
            reason,
            booking,
          });
        }
      }
    }

    return { regions, visited };
  };

  const isBackDisabled = (() => {
    const d = new Date(selectedDate);
    const step = viewType === "day" ? 1 : 7;
    d.setDate(d.getDate() - step);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const targetDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 28);
    const minDateStr = `${minDate.getFullYear()}-${pad(minDate.getMonth() + 1)}-${pad(minDate.getDate())}`;

    return targetDateStr < minDateStr;
  })();

  const navigateDate = (amount: number) => {
    if (amount < 0 && isBackDisabled) return;
    const d = new Date(selectedDate);
    const step = viewType === "day" ? 1 : 7;
    d.setDate(d.getDate() + amount * step);
    setSelectedDate(getLocalDateString(d));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    const threshold = 65; // minimum swipe horizontal distance in pixels
    // Math.abs(diffX) > Math.abs(diffY) * 1.5 prevents picking up diagonal scrolls as swipe
    if (
      Math.abs(diffX) > threshold &&
      Math.abs(diffX) > Math.abs(diffY) * 1.5
    ) {
      e.stopPropagation();
      if (diffX > 0) {
        // Swipe right -> Previous Day/Week
        navigateDate(-1);
      } else {
        // Swipe left -> Next Day/Week
        navigateDate(1);
      }
    }
    touchStartRef.current = null;
  };

  const openCalendar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentCalendarMonth(new Date(selectedDate));
    setShowCustomCalendar((prev) => !prev);
  };

  const handleSlotClick = (
    date: string,
    time: string,
    court: string,
    booking?: Booking,
  ) => {
    const isPassed = isSlotPassed(date, time);

    if (isPublicWochenplan) {
      setIsPublicLoginModalOpen(true);
      setInlineLoginError(null);
      return;
    }

    if (!currentUser) {
      return;
    }

    let activeBooking = booking;
    const isSyntheticLock =
      booking?.id.startsWith("range-") || booking?.id.startsWith("recurring-");

    if (isSyntheticLock) {
      // Admins can book on blocked slots (Sperren, not events/series bookings)
      if (isAdmin && !booking.isEvent) {
        // Treat as a new booking
        activeBooking = undefined;
      } else {
        return;
      }
    }

    const isRealLock = activeBooking?.isLocked && !activeBooking?.isEvent;

    // Block any click on a real lock (Sperre) in the past!
    if (isPassed && isRealLock) {
      return;
    }

    if (!activeBooking && isPassed && !isPastAllowed) return;

    // Block standard users from editing/viewing past regular bookings if not permitted by settings
    if (activeBooking && !activeBooking.isLocked && isPassed && !isPastAllowed)
      return;

    let blockStartTime = time;
    let blockEndTime = TIME_SLOTS[TIME_SLOTS.indexOf(time) + 1];

    if (activeBooking && activeBooking.group_token) {
      const groupBookings = bookings.filter(
        (b) =>
          b.group_token === activeBooking.group_token &&
          b.date === date &&
          b.court === court,
      );
      if (groupBookings.length > 0) {
        const times = groupBookings.map((b) => b.time);
        const indices = times
          .map((t) => TIME_SLOTS.indexOf(t))
          .filter((idx) => idx !== -1);
        if (indices.length > 0) {
          const minIdx = Math.min(...indices);
          const maxIdx = Math.max(...indices);
          blockStartTime = TIME_SLOTS[minIdx];
          blockEndTime = TIME_SLOTS[maxIdx + 1] || TIME_SLOTS[TIME_SLOTS.length - 1];
        }
      }
    }

    setSelectedSlot({ date, court, editingId: activeBooking?.id });
    setSelectedCourtInModal(court);
    setModalStartTime(blockStartTime);
    setPlayerQuery("");
    setShowSuggestions(false);

    if (activeBooking) {
      setIsLockMode(activeBooking.isLocked);
      setReason(activeBooking.reason || "Training");

      const others = activeBooking.players.slice(1);
      setAdditionalPlayers(others);

      setHasBallMachine(activeBooking.hasBallMachine);
      setGuestCount(activeBooking.guestCount || 0);
      setComment(activeBooking.comment || "");
      setEndTime(blockEndTime);
    } else {
      setIsLockMode(false);
      setReason("Training");
      setAdditionalPlayers([]);
      setHasBallMachine(false);
      setGuestCount(0);
      setComment("");
      setEndTime(blockEndTime);
    }

    setError(null);
    handleOpenModal();
    setIsFullDay(false);
  };

  const confirmAction = async () => {
    if (!selectedSlot) return;
    const courtToBook = selectedCourtInModal || selectedSlot.court || "Platz 1";
    const currentNorm = String(settings?.vereinsId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
    const selNorm = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');
    const isCurrentClub = selNorm === currentNorm;

    if (isLockMode) {
      const start = isFullDay ? TIME_SLOTS[0] : modalStartTime;
      const end = isFullDay ? TIME_SLOTS[TIME_SLOTS.length - 1] : endTime;
      if (selectedSlot.editingId) await onCancel(selectedSlot.editingId);
      onLockRange(
        selectedSlot.date,
        start,
        end,
        courtToBook,
        reason,
        false,
        undefined,
      );
    } else {
      const isUserAdmin =
        currentUser?.role === Role.ADMIN ||
        currentUser?.role === Role.SUPER_ADMIN ||
        (currentUser as any)?.hauptAdmin === true;
      if (reservationRules?.requireCoplayer && !isUserAdmin) {
        const hasCoplayer = additionalPlayers.length > 0;
        const hasGuest = guestCount && guestCount > 0;
        const hasMachine = hasBallMachine === true;
        if (!hasCoplayer && !hasGuest && !hasMachine) {
          setError(
            "Buchungsregel: Du musst mindestens einen Mitspieler (Partner), einen Gast oder die Ballmaschine auswählen.",
          );
          return;
        }
      }
      const players = [spieler1Name, ...additionalPlayers].filter(
        (p) => typeof p === "string" && p.trim() !== "",
      );
      try {
        // Player-level collision detection across all clubs & facilities
        const playerCollision = await checkPlayerCollisionAsync({
          date: selectedSlot.date,
          startTime: modalStartTime,
          endTime: endTime,
          players: [currentUser, ...players],
          editingBookingId: selectedSlot.editingId,
          currentClubId: selectedFacilityClubId || settings?.vereinsId,
          currentClubBookings: bookings,
          knownClubIds: (availableClubsList || []).map((c: any) => c.vereinsId || c.id).filter(Boolean),
        });

        if (playerCollision) {
          setError(playerCollision.errorMessage);
          return;
        }

        if (isCurrentClub) {
          const result = await onBook(
            selectedSlot.date,
            modalStartTime,
            endTime,
            courtToBook,
            players,
            hasBallMachine,
            guestCount,
            selectedSlot.editingId,
            comment,
          );
          if (result) {
            setError(result);
            return;
          }
        } else {
          // Multi-facility booking
          const startIndex = TIME_SLOTS.indexOf(modalStartTime);
          const endIndex = TIME_SLOTS.indexOf(endTime);
          const slotsToBook = TIME_SLOTS.slice(startIndex, endIndex);

          for (const t of slotsToBook) {
            const bookingData: Booking = {
              id: `slot_${selectedSlot.date}_${t.replace(':', '-')}_${courtToBook.replace(/\s+/g, '_')}`,
              date: selectedSlot.date,
              time: t,
              court: courtToBook,
              players,
              userId: currentUser?.id || 'guest',
              comment: comment || '',
              hasBallMachine: hasBallMachine || false,
              guestCount: guestCount || 0,
              createdAt: new Date().toISOString(),
            };
            await saveBooking(selectedFacilityClubId, bookingData);
          }
        }
      } catch (err: any) {
        setError(
          err.message || "Buchung fehlgeschlagen wegen eines Konflikts.",
        );
        return;
      }
    }
    handleCloseModal();
  };

  const handleLeagueSubmit = async () => {
    if (!selectedSlot || !leagueOpponent) {
      setError("Bitte wähle einen Gegner aus.");
      return;
    }

    const duration = getDurationInHours(modalStartTime, endTime);
    if (duration < 2) {
      setError(`Hobbyliga-Matches müssen eine Mindestspieldauer von 2 Stunden haben (aktuell: ${duration.toFixed(duration % 1 === 0 ? 0 : 1)} Std.).`);
      return;
    }
    if (duration > 3) {
      setError(`Hobbyliga-Matches dürfen maximal 3 Stunden dauern (aktuell: ${duration.toFixed(duration % 1 === 0 ? 0 : 1)} Std.).`);
      return;
    }

    const courtToBook = selectedCourtInModal || selectedSlot.court || "Platz 1";
    const currentNorm = String(settings?.vereinsId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
    const selNorm = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');
    const isCurrentClub = selNorm === currentNorm;

    const myName = spieler1Name || currentUser?.name || currentUser?.id || "Ich";
    const players = [myName, leagueOpponent].filter(
      (p) => typeof p === "string" && p.trim() !== "",
    );

    try {
      // Player-level collision detection across all clubs & facilities
      const playerCollision = await checkPlayerCollisionAsync({
        date: selectedSlot.date,
        startTime: modalStartTime,
        endTime: endTime,
        players: [
          currentUser,
          ...(leagueOpponentId ? [{ id: leagueOpponentId, name: leagueOpponent }] : [leagueOpponent]),
        ],
        editingBookingId: selectedSlot.editingId,
        currentClubId: selectedFacilityClubId || settings?.vereinsId,
        currentClubBookings: bookings,
        knownClubIds: (availableClubsList || []).map((c: any) => c.vereinsId || c.id).filter(Boolean),
      });

      if (playerCollision) {
        setError(playerCollision.errorMessage);
        return;
      }

      if (isCurrentClub) {
        const result = await onBook(
          selectedSlot.date,
          modalStartTime,
          endTime,
          courtToBook,
          players,
          false, // hasBallMachine
          0,     // guestCount
          selectedSlot.editingId,
          comment ? `[Ligaspiel] ${comment}` : "[Ligaspiel]"
        );
        if (result) {
          setError(result);
          return;
        }
      } else {
        // Multi-facility booking
        const startIndex = TIME_SLOTS.indexOf(modalStartTime);
        const endIndex = TIME_SLOTS.indexOf(endTime);
        const slotsToBook = TIME_SLOTS.slice(startIndex, endIndex);

        for (const t of slotsToBook) {
          const bookingData: Booking = {
            id: `slot_${selectedSlot.date}_${t.replace(':', '-')}_${courtToBook.replace(/\s+/g, '_')}`,
            date: selectedSlot.date,
            time: t,
            court: courtToBook,
            players,
            userId: currentUser?.id || 'guest',
            comment: comment ? `[Ligaspiel] ${comment}` : "[Ligaspiel]",
            hasBallMachine: false,
            guestCount: 0,
            createdAt: new Date().toISOString(),
          };
          await saveBooking(selectedFacilityClubId, bookingData);
        }
      }

      // Record in league_matches if it's a new booking
      if (!selectedSlot.editingId && currentUser) {
        try {
          const matchClubId = selectedFacilityClubId || (currentUser as any).tenantId || (settings as any)?.vereinsId || "unknown";
          const matchClubName = venueClubName || settings?.clubName || "Vereinsanlage";
          await createLeagueMatch({
            clubId: matchClubId,
            clubName: matchClubName,
            facilityName: matchClubName,
            court: courtToBook,
            leagueId: userLeagueObj?.id || (currentUser as any)?.leagueId || "open_mixed",
            player1Id: currentUser.id,
            player2Id: leagueOpponent,
            player1UserId: currentUser.id,
            player2UserId: leagueOpponent,
            status: "scheduled",
            scheduledDate: selectedSlot.date,
            scheduledStartTime: modalStartTime,
            scheduledEndTime: endTime,
          });
          window.dispatchEvent(new CustomEvent("league-result-added"));
        } catch (matchErr) {
          console.error("Failed to create league match record:", matchErr);
        }
      }

    } catch (err: any) {
      setError(err.message || "Buchung fehlgeschlagen wegen eines Konflikts.");
      return;
    }

    handleCloseModal();
  };

  const MobileDailyView = () => (
    <div className="space-y-6 pb-4 animate-in fade-in duration-300">
      <div
        className="grid gap-2 sm:gap-6"
        style={{
          gridTemplateColumns: `repeat(${courts.length}, minmax(0, 1fr))`,
        }}
      >
        {courts.map((court) => (
          <div key={court} className="flex flex-col gap-2">
            <h4 className="text-center text-base font-semibold text-[var(--color-primary)] uppercase tracking-widest bg-slate-200 py-1.5 sm:py-2 rounded-xl border-2 border-slate-300 shadow-sm">
              {court}
            </h4>
            <div className="space-y-1 sm:space-y-1.5">
              {startTimes.map((time, idx) => {
                const booking = getBooking(selectedDate, time, court);
                const nextTime = TIME_SLOTS[idx + 1];
                const slotStatus = getSlotStatus(selectedDate, time);
                const isPassed = isSlotPassed(selectedDate, time);
                const isClosedState =
                  slotStatus.type === "closed" ||
                  slotStatus.type === "outside_hours" ||
                  slotStatus.type === "past" ||
                  isPassed;
                const isAdmin =
                  currentUser?.role === Role.ADMIN ||
                  currentUser?.role === Role.SUPER_ADMIN ||
                  (currentUser as any)?.hauptAdmin === true;

                const isEvent = booking?.isLocked && booking?.isEvent;
                const mStyles = isEvent ? getEventStyles(booking.reason || "SERIENTERMIN") : null;
                const dynamicProps = getEventStyleProperties(booking, settings?.primaryColor);
                
                const isGenuinelyClosed = slotStatus.type === "closed" || slotStatus.type === "outside_hours";
                if (isGenuinelyClosed && !booking) return null;

                return (
                  <div
                    key={time}
                    onClick={isEvent ? undefined : () =>
                      handleSlotClick(selectedDate, time, court, booking)
                    }
                    style={dynamicProps ? {
                      backgroundColor: dynamicProps.backgroundColor,
                      borderTopColor: dynamicProps.borderColor,
                      borderRightColor: dynamicProps.borderColor,
                      borderBottomColor: dynamicProps.borderColor,
                      borderLeftColor: dynamicProps.borderLeftColor,
                    } : {}}
                    className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border-2 transition-all flex flex-col justify-center h-[38.7px] sm:h-[42.3px] shadow-sm relative overflow-hidden group ${isEvent ? "cursor-default" : "cursor-pointer"} ${
                      booking
                        ? booking.isLocked
                          ? booking.isEvent
                            ? `shadow-[inset_0_0_8px_rgba(0,0,0,0.03)] ${mStyles?.bg} ${mStyles?.border} ${mStyles?.borderAccent}`
                            : "stripe-locked border-slate-300 shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]"
                          : "bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-600 shadow-sm"
                        : isClosedState
                          ? isAdmin
                            ? "stripe-closed border-slate-400 active:scale-95 hover:opacity-90"
                            : "stripe-closed border-slate-300 opacity-90 pointer-events-none cursor-not-allowed"
                          : slotStatus.disabled
                            ? "stripe-disabled border-slate-300"
                            : "bg-white border-slate-400 active:scale-95 hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    <div
                      className={`flex justify-between items-center w-full ${booking ? "mb-0.5" : ""}`}
                    >
                      <span
                        className={`text-xs font-black tracking-tight leading-none ${!booking && !isClosedState ? "text-[var(--color-primary)] group-hover:text-white transition-colors" : "text-slate-500"}`}
                      >
                        {parseInt(time.split(":")[0], 10)} -{" "}
                        {parseInt(nextTime.split(":")[0], 10)} Uhr
                      </span>
                      {/* Robot icon removed as per user request */}
                      {!booking && !isClosedState && (
                        <div className="flex items-center gap-2">
                          <i
                            className="fa-solid fa-circle-plus text-[14px] group-hover:text-white transition-colors"
                            style={{
                              color:
                                settings?.primaryColor ||
                                "var(--color-primary)",
                            }}
                          ></i>
                        </div>
                      )}
                    </div>
                    {booking ? (
                      <div className="truncate">
                        {booking.isLocked ? (
                          (() => {
                            const lockInfo = getLockPositionInfo(
                              selectedDate,
                              time,
                              court,
                            );
                            return lockInfo?.isMiddle ? (
                              <div className="flex items-center gap-1">
                                {!booking.isEvent && (
                                  <i
                                    className="fa-solid fa-lock text-slate-500 text-[7px]"
                                    style={dynamicProps ? { color: dynamicProps.color } : {}}
                                  ></i>
                                )}
                                <span
                                  className={`text-xs font-black truncate leading-none ${booking.isEvent ? `${mStyles?.textSaturated || "text-emerald-800"} break-normal hyphens-auto` : "uppercase text-slate-700"}`}
                                  style={dynamicProps ? { color: dynamicProps.color } : {}}
                                >
                                  {booking.isEvent
                                    ? formatEventTitle(booking.reason || "SERIENTERMIN")
                                    : `GESPERRT ${booking.reason ? ": " + booking.reason : ""}`}
                                </span>
                              </div>
                            ) : null;
                          })()
                        ) : (
                          <div className="flex flex-col gap-y-0.5">
                            <span 
                              className="text-xs font-black text-emerald-950 uppercase line-clamp-2 block leading-tight"
                              style={{ wordBreak: "break-word" }}
                              title={booking.players.join(", ") + (booking.guestCount ? ` + ${booking.guestCount} Gast` : "")}
                            >
                              {booking.players.map(formatPlayerName).join(", ") + (booking.guestCount ? ` + ${booking.guestCount} Gast` : "")}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  interface ContinuousEvent {
    startIdx: number;
    span: number;
    booking: Booking;
  }

  const getContinuousEvents = (date: string, court: string, times: string[]): ContinuousEvent[] => {
    const blocks: ContinuousEvent[] = [];
    let currentBlock: ContinuousEvent | null = null;

    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const booking = getBooking(date, time, court);

      if (booking) {
        if (!currentBlock) {
          currentBlock = { startIdx: i, span: 1, booking };
        } else {
          const prevBooking = currentBlock.booking;
          const isSameLocked = booking.isLocked && prevBooking.isLocked && (booking.reason || "GESPERRT").trim().toLowerCase() === (prevBooking.reason || "GESPERRT").trim().toLowerCase();
          
          const isSameUnlocked = !booking.isLocked && !prevBooking.isLocked && 
              JSON.stringify(booking.players) === JSON.stringify(prevBooking.players) &&
              (booking.reason || "") === (prevBooking.reason || "") &&
              booking.guestCount === prevBooking.guestCount;

          if (isSameLocked || isSameUnlocked) {
            currentBlock.span += 1;
          } else {
            blocks.push(currentBlock);
            currentBlock = { startIdx: i, span: 1, booking };
          }
        }
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
      }
    }
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    return blocks;
  };

  const renderDesktopColumn = (date: string, court: string, times: string[], isDayView: boolean) => {
    const events = getContinuousEvents(date, court, times);
    const colKey = date + "-" + court;
    
    const courtIdx = courts.indexOf(court);
    const calculatedZIndex = courtIdx !== -1 ? courts.length - courtIdx : 1;
    
    return (
      <div 
        key={colKey} 
        style={{ 
          height: gridHeight,
          zIndex: calculatedZIndex
        }}
        className={`flex-1 ${isDayView ? "min-w-[120px]" : "min-w-0"} flex flex-col relative border-r border-slate-300 last:border-r-0 group/col bg-white`}
      >
        {/* Header inside the column is only needed if not rendered in a separate header row. 
            We will render the header in the parent, so this just holds the grid. */}
        <div className="absolute inset-0 flex flex-col z-0" style={{ height: gridHeight }}>
          {times.map((time, tIdx) => {
            const isPassed = isSlotPassed(date, time);
            const slotStatus = getSlotStatus(date, time);
            const isAdmin = currentUser?.role === Role.ADMIN || currentUser?.role === Role.SUPER_ADMIN || (currentUser as any)?.hauptAdmin;
            const isGenuinelyClosed = slotStatus.type === "closed" || slotStatus.type === "outside_hours";
            
            let bgClass = "bg-transparent";
            let cursorClass = "cursor-pointer";
            
            if (isGenuinelyClosed) {
               bgClass = "bg-slate-100 stripe-closed pointer-events-none";
            } else if (isPassed) {
               bgClass = isAdmin ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-100 pointer-events-none";
            } else {
               bgClass = "hover:bg-green-50/20 active:bg-green-100/50";
            }
            
            return (
              <div 
                key={time} 
                style={{ height: slotHeight }}
                className={`border-b border-slate-300 last:border-b-0 w-full transition-colors group/cell ${bgClass}`}
                onMouseEnter={() => setHoveredTime(time)}
                onMouseLeave={() => setHoveredTime(null)}
                onClick={() => {
                   if (!isGenuinelyClosed && (!isPassed || isAdmin)) {
                      handleSlotClick(date, time, court, undefined);
                   }
                }}
              >
                <div className="w-full h-full flex items-center justify-center transition-opacity opacity-0 group-hover/cell:opacity-100">
                   {!isPublicWochenplan && !isGenuinelyClosed && (!isPassed || isAdmin) && (
                      <i 
                         className="fa-solid fa-plus text-xs" 
                         style={{ color: settings?.primaryColor || "var(--color-primary)" }}
                      ></i>
                   )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Absolutely Positioned Events */}
        {events.map((evt, idx) => {
          const { startIdx, span, booking } = evt;
          const isPassed = isSlotPassed(date, times[startIdx]);
          const isAdmin = currentUser?.role === Role.ADMIN || currentUser?.role === Role.SUPER_ADMIN || (currentUser as any)?.hauptAdmin;

          const isEvent = booking.isEvent;
          
          let colSpan = 1;
          let shouldSkipRender = false;
          
          if (isEvent) {
            const courtIdx = courts.indexOf(court);
            if (courtIdx !== -1) {
              // 1. Calculate how many consecutive courts have this identical event
              let consecutiveMatches = 0;
              for (let nextIdx = courtIdx + 1; nextIdx < courts.length; nextIdx++) {
                const nextCourt = courts[nextIdx];
                const nextCourtEvents = getContinuousEvents(date, nextCourt, times);
                const matchingEvent = nextCourtEvents.find(
                  otherEvt =>
                    otherEvt.booking.isEvent &&
                    otherEvt.startIdx === startIdx &&
                    otherEvt.span === span &&
                    (otherEvt.booking.reason || "").trim().toLowerCase() === (booking.reason || "").trim().toLowerCase()
                );
                if (matchingEvent) {
                  consecutiveMatches++;
                } else {
                  break;
                }
              }
              colSpan = 1 + consecutiveMatches;

              // 2. Determine if we should skip rendering on this court because it's already covered by a spanned event on a previous court
              if (courtIdx > 0) {
                const prevCourt = courts[courtIdx - 1];
                const prevCourtEvents = getContinuousEvents(date, prevCourt, times);
                const hasPrevMatch = prevCourtEvents.some(
                  otherEvt =>
                    otherEvt.booking.isEvent &&
                    otherEvt.startIdx === startIdx &&
                    otherEvt.span === span &&
                    (otherEvt.booking.reason || "").trim().toLowerCase() === (booking.reason || "").trim().toLowerCase()
                );
                if (hasPrevMatch) {
                  shouldSkipRender = true;
                }
              }
            }
          }

          if (shouldSkipRender) return null;

          const topPercent = (startIdx / times.length) * 100;
          const heightPercent = (span / times.length) * 100;
          const isMyBooking = currentUser && !booking.isLocked && (booking.players.includes(currentUserFullName) || booking.players.includes(currentUser.name));

          const evtStyles = isEvent ? getEventStyles(booking.reason || "SERIENTERMIN") : null;
          const dynamicProps = isEvent ? getEventStyleProperties(booking, settings?.primaryColor) : getBookingStyleProperties(booking, !!isMyBooking, settings?.primaryColor);
          
          const pastVeilClass = isPassed ? "after:content-[''] after:absolute after:inset-0 after:bg-black/[0.03] after:pointer-events-none" : "";
          const pastOpacityClass = isPassed ? "opacity-90" : "";
          const pastPointerClass = isPassed && !isAdmin ? "pointer-events-none" : (isEvent ? "cursor-default" : "cursor-pointer");

          const widthStyle = colSpan > 1 ? `calc(${colSpan * 100}% + ${colSpan - 1}px)` : "100%";
          const zIndexStyle = colSpan > 1 ? 20 : 10;

          return (
            <div 
              key={idx}
              style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
                left: 0,
                width: widthStyle,
                zIndex: zIndexStyle,
              }}
              className={`absolute p-[2px] ${pastVeilClass} ${pastOpacityClass} ${pastPointerClass}`}
              onMouseEnter={() => setHoveredTime(times[startIdx])}
              onMouseLeave={() => setHoveredTime(null)}
              onClick={isEvent ? undefined : () => handleSlotClick(date, times[startIdx], court, booking)}
            >
              {booking.isLocked && !booking.isEvent ? (
                // Locked Generic
                <div className="w-full h-full flex flex-col items-center justify-center p-0.5 select-none hover:bg-slate-200 transition-colors bg-slate-100 rounded border border-slate-300 shadow-sm overflow-hidden">
                   <div className="border-none outline-none bg-white/95 -300 shadow-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 max-w-full">
                     <i className="fa-solid fa-lock text-slate-500 text-[8px]"></i>
                     <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wide truncate text-slate-700">
                       {booking.reason || "Sperre"}
                     </span>
                   </div>
                </div>
              ) : booking.isEvent ? (
                // Event (Training, etc)
                <div
                  style={dynamicProps ? {
                    backgroundColor: dynamicProps.backgroundColor,
                    borderTopColor: dynamicProps.borderColor,
                    borderRightColor: dynamicProps.borderColor,
                    borderBottomColor: dynamicProps.borderColor,
                    borderLeftColor: dynamicProps.borderLeftColor,
                  } : {}}
                  className={`w-full h-full shadow-[0_2px_4px_rgba(0,0,0,0.05)] flex flex-col items-start justify-start ${colSpan > 1 ? "px-2.5" : "px-1"} py-1 ${evtStyles?.bg || 'bg-emerald-50'} ${evtStyles?.borderAccent || 'border-l-4 border-l-emerald-600'} border-emerald-200 border border-l-4 relative rounded-md overflow-hidden`}
                >
                  <span
                    className={`block text-left text-[11px] font-black leading-tight whitespace-normal break-normal hyphens-auto ${evtStyles?.textSaturated}`}
                    style={dynamicProps ? { color: dynamicProps.color } : {}}
                  >
                    {formatEventTitle(booking.reason || "EVENT")}
                  </span>
                </div>
              ) : (
                // Normal Booking
                <div
                  style={dynamicProps ? {
                    backgroundColor: dynamicProps.backgroundColor,
                    borderTopColor: dynamicProps.borderColor,
                    borderRightColor: dynamicProps.borderColor,
                    borderBottomColor: dynamicProps.borderColor,
                    borderLeftColor: dynamicProps.borderLeftColor,
                  } : {}}
                  className={`w-full h-full rounded-md border border-l-4 ${dynamicProps ? "" : "bg-emerald-50 border-emerald-200 border-l-emerald-600 text-emerald-950"} flex flex-col justify-start items-start p-1.5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] hover:brightness-95 transition-all overflow-hidden`}
                >
                  <div
                    className="text-[9px] sm:text-[9px] md:text-[10px] font-black w-full truncate leading-tight block text-emerald-950"
                    style={dynamicProps ? { color: dynamicProps.color } : {}}
                  >
                    {booking.players.map(formatPlayerNameCompact).join(", ")}
                    {booking.guestCount && booking.guestCount > 0 ? ` + ${booking.guestCount} Gast` : ""}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    );
  };
  if (isMobile) {
    const today = new Date();
    const todayStr = getLocalDateString(today);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    const overmorrow = new Date(today);
    overmorrow.setDate(overmorrow.getDate() + 2);
    const overmorrowStr = getLocalDateString(overmorrow);

    const mobileCourts = courts.length > 0 ? courts : ["Platz 1", "Platz 2"];

    const formatDateForPill = (dateStr: string) => {
      const d = new Date(dateStr);
      const weekday = d.toLocaleDateString("de-DE", { weekday: "short" }); // e.g., "Di."
      const dateVal = d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }); // e.g. "02.06."
      return { weekday: weekday.replace(".", ""), dateVal };
    };

    const todayPill = formatDateForPill(todayStr);
    const tomorrowPill = formatDateForPill(tomorrowStr);
    const overmorrowPill = formatDateForPill(overmorrowStr);

    const isCustomDate =
      selectedDate !== todayStr &&
      selectedDate !== tomorrowStr &&
      selectedDate !== overmorrowStr;
    const customDatePill = isCustomDate
      ? formatDateForPill(selectedDate)
      : null;

    const activeDateFormatted = new Date(selectedDate).toLocaleDateString(
      "de-DE",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      },
    );

  console.log("Hobbyliga Check:", { 
    user: currentUser?.id, 
    optIn: currentUser?.hobbyLeagueOptIn, 
    clubEnabled: settings?.modules?.league 
  });

  return (
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full flex-1 flex flex-col lg:animate-in lg:fade-in lg:duration-500 pb-0 lg:pb-3 md:pb-3 select-none space-y-0 lg:space-y-4 min-h-0 lg:min-h-[calc(100vh-160px)] h-full"
      >
        <OnboardingBanner
          show={currentUser?.show_onboarding_hints !== false && !isPublicWochenplan}
          desktopText="Wähle eine freie Uhrzeit in der Zukunft, um deinen Platz zu reservieren."
          mobileText={
            viewType === "week"
              ? "Drücke auf einen Wochentag, um für den Tag zu buchen."
              : 'Drücke auf "+" um einen Platz zu reservieren.'
          }
          onDismiss={() => onDismissOnboardingHints?.()}
        />

        <AnimatePresence mode="wait">
          {viewType === "day" ? (
            <motion.div
              key="mobile-day-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex-grow flex flex-col min-h-0"
            >
            {/* Mobile 3-column table - Thinner borders, more compact */}
            <div 
              className="flex-1 flex flex-col rounded-2xl border-none bg-slate-50 shadow-md w-full mb-4 lg:mb-0 lg:min-h-0 lg:max-h-none overflow-hidden"
              style={isMobile ? { ...swipeStyle, flexGrow: 1 } : undefined}
            >
              <table className="w-full h-full border-collapse table-fixed flex-1 bg-slate-50" style={{ height: "100%" }}>
                <thead className="sticky top-0 bg-slate-50 z-40 shadow-sm">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th
                      className="p-1.5 text-center text-xs font-black uppercase text-slate-500 tracking-wider sticky top-0 bg-slate-50 z-40"
                      style={{ width: "22%" }}
                    >
                      Von - Bis
                    </th>
                    {mobileCourts.map((court) => (
                      <th
                        key={court}
                        className="p-1.5 text-center text-xs font-black uppercase text-[var(--color-primary)] tracking-wider border-l border-slate-200 truncate sticky top-0 bg-slate-50 z-40"
                        style={{ width: `${78 / mobileCourts.length}%` }}
                      >
                        {court}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: "100%" }}>
                  {(() => {
                    const { regions, visited } = computeLockedRegions(
                      selectedDate,
                      mobileCourts,
                      startTimes,
                    );
                    return startTimes.map((time, tIdx) => {
                      const nextTime = TIME_SLOTS[tIdx + 1];
                      return (
                        <tr
                          key={time}
                          className="border-b border-slate-150 last:border-b-0"
                          style={{ height: `${100 / startTimes.length}%` }}
                        >
                          <td className="p-0.5 text-center align-middle font-bold text-sm text-slate-700 bg-slate-50/60" style={{ height: "1px" }}>
                            <div className="flex items-center justify-center">
                              <span className="text-xs font-black text-slate-800 whitespace-nowrap">
                                {parseInt(time.split(":")[0], 10)} -{" "}
                                {parseInt(nextTime.split(":")[0], 10)}
                              </span>
                            </div>
                          </td>

                          {mobileCourts.map((court, cIdx) => {
                            if (visited[tIdx][cIdx]) {
                              const region = regions.find(
                                (r) =>
                                  r.startTimeIdx === tIdx &&
                                  r.startCourtIdx === cIdx,
                              );
                              if (region) {
                                const rSpan =
                                  region.endTimeIdx - region.startTimeIdx + 1;
                                const cSpan =
                                  region.endCourtIdx - region.startCourtIdx + 1;
                                const isEvent = region.booking?.isEvent;
                                const evtStyles = isEvent ? getEventStyles(region.reason || region.booking.reason || "SERIENTERMIN") : null;
                                const dynamicProps = getEventStyleProperties(region.booking, settings?.primaryColor);
                                const isAtBottom = region.endTimeIdx === startTimes.length - 1;
                                const isAtRight = region.endCourtIdx === mobileCourts.length - 1;
                                const roundedCornerClass = (isAtBottom && isAtRight)
                                  ? "rounded-tl-md rounded-tr-md rounded-bl-md rounded-br-[15px]"
                                  : "rounded-md";
                                return (
                                  <td
                                    key={court}
                                    rowSpan={rSpan}
                                    colSpan={cSpan}
                                    onClick={isEvent ? undefined : () =>
                                      handleSlotClick(
                                        selectedDate,
                                        startTimes[region.startTimeIdx],
                                        mobileCourts[region.startCourtIdx],
                                        region.booking,
                                      )
                                    }
                                    className={`relative ${isEvent ? "p-0 cursor-default bg-slate-50" : "p-[1.5px] text-center align-middle hover:bg-transparent"} ${isEvent ? "duration-150 bg-slate-50" : "stripe-closed border-r border-b border-slate-200 select-none cursor-pointer"}`}
                                    style={{ height: "1px" }}
                                  >
                                    {isEvent ? (
                                      <div
                                        style={dynamicProps ? {
                                          backgroundColor: dynamicProps.backgroundColor,
                                          borderTopColor: dynamicProps.borderColor,
                                          borderRightColor: dynamicProps.borderColor,
                                          borderBottomColor: dynamicProps.borderColor,
                                          borderLeftColor: dynamicProps.borderLeftColor,
                                        } : {}}
                                        className={`w-full h-full shadow-[inset_0_0_8px_rgba(0,0,0,0.03)] min-h-[28px] flex flex-col items-start justify-start p-0 pointer-events-none ${evtStyles?.bg} ${evtStyles?.borderAccent} border-slate-200 border-r border-t border-b ${roundedCornerClass} relative cursor-default`}
                                      >
                                        <div className="flex items-start justify-start overflow-hidden w-full gap-[3px] h-full min-h-[28px] pt-2 pl-2 pr-1.5">
                                          {cSpan > 1 ? (
                                            <span
                                              className={`block text-left text-[11px] font-black break-normal hyphens-auto ${evtStyles?.textSaturated}`}
                                              style={dynamicProps ? { color: dynamicProps.color } : {}}
                                            >
                                              {formatEventTitle(region.reason || "SERIENTERMIN")}
                                            </span>
                                          ) : (
                                            <span
                                              className={`block text-left text-[11px] font-black leading-tight break-normal hyphens-auto ${evtStyles?.textSaturated}`}
                                              style={dynamicProps ? { color: dynamicProps.color } : {}}
                                            >
                                              {formatEventTitle(region.reason || "EVENT")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-start justify-center w-full h-full min-h-[28px] pt-2 select-none pointer-events-none">
                                        <div
                                          className={`bg-white/95 border border-slate-355 shadow-md rounded-xl px-2 py-1 flex items-center gap-1.5 max-w-full`}
                                        >
                                          <i
                                            className={`fa-solid fa-lock text-slate-500 text-[9px]`}
                                          ></i>
                                          <span
                                            className={`text-[9px] font-black uppercase tracking-wide truncate max-w-[124px] text-slate-700`}
                                          >
                                            {region.reason || "Sperre"}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                );
                              }
                              return null;
                            }

                            const booking = getBooking(
                              selectedDate,
                              time,
                              court,
                            );
                            const isPassed = isSlotPassed(selectedDate, time);
                            const slotStatus = getSlotStatus(
                              selectedDate,
                              time,
                            );
                            const isGenuinelyClosed =
                              slotStatus.type === "closed" ||
                              slotStatus.type === "outside_hours";
                              
                            if (isGenuinelyClosed && !booking) {
                              return <td key={court} className="p-0 m-0 border-0 bg-transparent pointer-events-none"></td>;
                            }

                            const isClosedState =
                              isGenuinelyClosed ||
                              slotStatus.type === "past" ||
                              isPassed;
                            const isMyBooking =
                              currentUser &&
                              booking &&
                              !booking.isLocked &&
                              (booking.players.includes(currentUserFullName) ||
                                booking.players.includes(currentUser.name));
                            const isAdmin =
                              currentUser?.role === Role.ADMIN ||
                              currentUser?.role === Role.SUPER_ADMIN ||
                              (currentUser as any)?.hauptAdmin === true;

                            let cellBgClassStr = "";
                            if (booking) {
                              if (booking.isLocked) {
                                cellBgClassStr = booking.isEvent
                                  ? "bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border-l-4 border-l-emerald-600 border-emerald-200 duration-150 font-semibold shadow-[inset_0_0_8px_rgba(0,0,0,0.03)]"
                                  : "bg-slate-100";
                              } else {
                                cellBgClassStr = "bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border-l-4 border-l-emerald-600 border-emerald-200 duration-150 font-semibold";
                              }
                            } else {
                              if (isGenuinelyClosed) {
                                cellBgClassStr = isAdmin
                                  ? "stripe-closed active:scale-95 hover:opacity-95 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                                  : "stripe-closed opacity-90 pointer-events-none cursor-not-allowed";
                              } else if (isPassed) {
                                cellBgClassStr = isAdmin
                                  ? "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 cursor-pointer text-slate-400"
                                  : "bg-slate-100 cursor-default";
                              } else {
                                cellBgClassStr =
                                  "bg-white hover:bg-green-50/20 active:bg-green-100/50 transition-colors cursor-pointer";
                              }
                            }

                            const pastVeilClass = isPassed
                              ? "after:content-[''] after:absolute after:inset-0 after:bg-black/[0.03] after:pointer-events-none"
                              : "";
                            const pastOpacityClass = isPassed
                              ? "opacity-90"
                              : "";
                            const pastPointerClass =
                              isPassed && !isAdmin ? "pointer-events-none" : "";

                            const dynamicProps = getEventStyleProperties(booking, settings?.primaryColor);

                            return (
                              <td
                                key={court}
                                onClick={() =>
                                  handleSlotClick(
                                    selectedDate,
                                    time,
                                    court,
                                    booking,
                                  )
                                }
                                className={`border-l border-slate-200 p-0.5 text-center align-middle relative select-none ${cellBgClassStr} ${pastVeilClass} ${pastOpacityClass} ${pastPointerClass}`}
                                style={{
                                  height: "1px",
                                  ...(dynamicProps ? {
                                    backgroundColor: dynamicProps.backgroundColor,
                                    borderColor: dynamicProps.borderColor,
                                  } : {})
                                }}
                              >
                                {booking ? (
                                  <div
                                    className={`flex flex-col items-start justify-start h-full w-full pt-1.5 pl-1.5 pr-1 pb-1`}
                                  >
                                    {booking.isLocked ? (
                                      <div
                                        className="flex items-center justify-start gap-1 w-full"
                                        style={dynamicProps ? { color: dynamicProps.color } : {}}
                                      >
                                        {!booking.isEvent && (
                                          <i
                                            className="fa-solid fa-lock text-slate-500 text-[8px]"
                                            style={dynamicProps ? { color: dynamicProps.color } : {}}
                                          ></i>
                                        )}
                                        <span
                                          className={`font-black w-full text-left ${booking.isEvent ? "text-[11px] leading-tight break-normal hyphens-auto text-emerald-950 whitespace-normal text-left" : "uppercase text-[10px] sm:text-xs leading-tight truncate text-slate-700"}`}
                                          style={dynamicProps ? { color: dynamicProps.color } : {}}
                                        >
                                          {booking.isEvent
                                            ? formatEventTitle(booking.reason || "EVENT")
                                            : (booking.reason || "SPERRE")}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-start justify-start gap-0 w-full">
                                        <div
                                          className="text-emerald-950 font-extrabold text-[10px] sm:text-[11px] leading-tight text-left w-full truncate"
                                          title={
                                            booking.players.join(", ") +
                                            (booking.guestCount
                                              ? ` + ${booking.guestCount} Gast`
                                              : "")
                                          }
                                        >
                                          {booking.players.map(formatPlayerNameCompact).join(", ") + (booking.guestCount > 0 ? ` + ${booking.guestCount} Gast` : "")}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full transition-all">
                                    {isGenuinelyClosed || isPublicWochenplan || (isClosedState &&
                                    !(isPassed && isAdmin)) ? null : (
                                      <i
                                        className={`fa-solid fa-plus text-xs ${isPassed ? "text-gray-400 opacity-60" : ""}`}
                                        style={
                                          isPassed
                                            ? {}
                                            : {
                                                color:
                                                  settings?.primaryColor ||
                                                  "var(--color-primary)",
                                              }
                                        }
                                      ></i>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            </motion.div>
          ) : (
            /* Mobile Weekly View */
            <motion.div
              key="mobile-week-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex flex-col"
            >
            <div 
              className="space-y-2 overflow-y-auto max-h-[calc(100dvh-170px)] mb-0 hide-scrollbar w-full lg:min-h-0 lg:max-h-none"
              style={isMobile ? swipeStyle : undefined}
            >
              {weekDates
                .map((dateStr) => {
                  const d = new Date(dateStr);
                  const isSelected = selectedDate === dateStr;
                  const isToday = dateStr === todayStr;
                  const isPastDate = dateStr < todayStr;

                  const weekdayLong = d.toLocaleDateString("de-DE", {
                    weekday: "long",
                  });
                  const dateCompact = d.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                  const dateLabel = d
                    .toLocaleDateString("de-DE", { weekday: "short" })
                    .replace(".", "");

                  // Count status
                  const dateBookings = bookings.filter(
                    (b) => b.date === dateStr,
                  );
                  const ownBookings = currentUser ? dateBookings.filter(
                    (b) =>
                      !b.isLocked &&
                      (b.players.includes(currentUserFullName) ||
                        b.players.includes(currentUser.name)),
                  ) : [];
                  const activeLocks = dateBookings.filter((b) => b.isLocked);
                  const freeCount =
                    startTimes.length * mobileCourts.length -
                    dateBookings.length;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setViewType("day");
                      }}
                      className={`py-2.5 px-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between gap-3 ${
                        isPastDate
                          ? "bg-slate-50/80 border-slate-200/80 opacity-60"
                          : isSelected
                            ? "bg-white border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] shadow-md"
                            : isToday
                              ? "bg-white border-orange-300 ring-1 ring-orange-300 shadow-md"
                              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 truncate py-0.5">
                          <span className={`font-black text-[13px] tracking-tight leading-normal ${isPastDate ? "text-slate-600" : "text-[var(--color-primary)]"}`}>
                            {weekdayLong}
                          </span>
                          <span className="text-slate-500 font-bold text-[13px] tracking-tight leading-normal">
                            , {dateCompact}
                          </span>
                          {isToday && (
                            <span className="text-orange-500 font-black ml-1.5 uppercase text-[8.5px] tracking-widest leading-normal shrink-0">
                              [Heute]
                            </span>
                          )}
                          {isPastDate && (
                            <span className="text-slate-400 font-bold ml-1.5 uppercase text-[8.5px] tracking-widest leading-normal shrink-0">
                              [Vergangen]
                            </span>
                          )}
                        </div>

                        {/* Hourly mini progress visualizer bar */}
                        <div className="mt-2.5 pt-1.5 border-t border-slate-100">
                          <div className={`relative h-5 text-[12px] font-semibold tracking-tight mb-0.5 select-none font-sans tabular-nums ${isPastDate ? "text-slate-400" : "text-slate-800"}`}>
                            <span className="absolute left-0">08:00</span>
                            <span className="absolute left-[50%] -translate-x-1/2">
                              15:00
                            </span>
                            <span className="absolute right-0">22:00</span>
                          </div>

                          <div className="flex gap-[3px] w-full">
                            {startTimes.map((time) => {
                              const slotStatus = getSlotStatus(dateStr, time);
                              const isGenuinelyClosed = slotStatus.type === "closed" || slotStatus.type === "outside_hours";
                              
                              const courtBookings = mobileCourts.map((c) =>
                                getBooking(dateStr, time, c),
                              );
                              const anyBooked = courtBookings.some((b) => b);
                              const allBooked = courtBookings.every((b) => b);

                              if (isGenuinelyClosed && !anyBooked) {
                                return <div key={time} className="flex-1 h-3 rounded-[3px] bg-transparent"></div>;
                              }

                              let bgStyle: React.CSSProperties = {};
                              let colorClass = "";

                              if (isPastDate) {
                                colorClass = "bg-slate-300/80";
                              } else if (!anyBooked) {
                                // GRÜN (Alle Plätze frei) - sportliches Vereins-Mittelgrün
                                bgStyle = {
                                  backgroundColor:
                                    settings?.primaryColor ||
                                    "var(--color-primary)",
                                };
                              } else if (allBooked) {
                                // ROT (Alle Plätze ausgebucht) - klares, sattes Verkehrsrot
                                colorClass = "bg-red-600";
                              } else {
                                // GELB/AMBER (Teilweise belegt) - kräftiges, warmes Gelb-Orange (Safran/Amber)
                                colorClass = "bg-amber-600";
                              }

                              return (
                                <div
                                  key={time}
                                  className={`flex-1 h-2 rounded-sm ${colorClass} transition-all`}
                                  style={bgStyle}
                                  title={`${time} Uhr`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-slate-400 flex items-center justify-center">
                        <i className="fa-solid fa-chevron-right text-[11px]"></i>
                      </div>
                    </div>
                  );
                })}

              {/* Dezente mobile Ampel-Legende */}
              <div className="flex flex-row items-center justify-center gap-4 mt-4 pb-1 pt-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                {/* Grün: Alle frei */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{
                      backgroundColor:
                        settings?.primaryColor || "var(--color-primary)",
                    }}
                  />
                  <span>Alle frei</span>
                </div>

                {/* Gelb/Amber: Teilweise belegt (nur einblenden falls courts >= 2) */}
                {mobileCourts.length >= 2 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shadow-sm" />
                    <span>
                      {mobileCourts.length === 2
                        ? "1 Platz frei"
                        : "Mind. 1 Platz frei"}
                    </span>
                  </div>
                )}

                {/* Rot: Ausgebucht */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-sm" />
                  <span>Ausgebucht</span>
                </div>
              </div>
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal handling */}
        {isModalOpen &&
          selectedSlot &&
          createPortal(
            <div className="lg:hidden fixed top-0 left-0 right-0 bottom-16 z-[99999] flex items-stretch justify-center bg-white p-0">
              <div className="bg-[var(--color-primary)] w-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-300 flex flex-col h-full rounded-none border-0 shadow-none">
                <div className="p-4 text-white flex justify-between items-center relative shrink-0 border-b border-white/10">
                  <div>
                    <h3 className="text-xl font-bold uppercase tracking-tight">
                      {selectedSlot.editingId && isUserAuthorizedToEdit
                        ? "Bearbeiten"
                        : selectedSlot.court}
                    </h3>
                    <p className="text-[10px] font-bold text-white mt-0.5 flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-day"></i>
                      {new Date(selectedSlot.date).toLocaleDateString("de-DE", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-white hover:text-slate-100 transition-colors bg-white/10 w-9 h-9 rounded-full flex items-center justify-center border border-white/20 active:scale-90"
                  >
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
                
                {bookingOptions.length > 1 && (
                  <div className="h-8 px-3 py-1 bg-slate-100 border-b border-slate-200 shrink-0 select-none font-sans font-medium">
                    <div className="relative flex p-0.5 bg-slate-200 rounded-lg border border-slate-200 shrink-0 select-none">
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded-md shadow-sm transition-all duration-300 ease-out z-0 bg-white`}
                        style={{
                           width: `calc(${100 / bookingOptions.length}% - 2px)`,
                           left: `calc(${bookingOptions.findIndex(o => o.id === activeMode) * (100 / bookingOptions.length)}% + 1px)`,
                           ...(activeMode !== "lock" ? { backgroundColor: settings?.primaryColor || "var(--color-primary)" } : { backgroundColor: "#64748b" })
                        }}
                      ></div>
                      {bookingOptions.map(option => (
                        <button
                          key={option.id}
                          className={`relative z-10 flex-1 py-1.5 rounded-md transition-colors uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 ${
                             activeMode === option.id 
                               ? "text-white font-medium" 
                               : "text-slate-500 hover:text-slate-700 font-bold"
                          }`}
                          onClick={() => {
                             if (option.id === "lock") {
                               setIsLockMode(true);
                               setBookingTab("normal");
                             } else if (option.id === "league") {
                               setIsLockMode(false);
                               setBookingTab("league");
                             } else {
                               setIsLockMode(false);
                               setBookingTab("normal");
                             }
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Normal Booking Tab Content */}
                <div style={{ display: bookingTab === "normal" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  <div className="bg-slate-50 p-4 pb-4 space-y-4 overflow-y-auto flex-1 text-slate-700">
                    {/* Platz wählen */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                        Platz wählen
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCourtInModal}
                          disabled={!isUserAuthorizedToEdit}
                          onChange={(e) => setSelectedCourtInModal(e.target.value)}
                          className="w-full h-8 px-3 py-1 pr-8 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                        >
                          {currentModalCourtOptions.map(({ name, isAvailable }) => (
                            <option
                              key={name}
                              value={name}
                              disabled={!isAvailable && name !== selectedCourtInModal}
                              className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                            >
                              {name} {!isAvailable ? '(belegt)' : ''}
                            </option>
                          ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                      </div>
                    </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-2 animate-pulse text-[10px] font-bold">
                      <i className="fa-solid fa-circle-exclamation text-base"></i>
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                        Ab
                      </label>
                      <select 
                        value={modalStartTime}
                        disabled={!isUserAuthorizedToEdit}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setModalStartTime(newStart);
                          const startIdx = TIME_SLOTS.indexOf(newStart);
                          if (TIME_SLOTS.indexOf(endTime) <= startIdx) {
                            setEndTime(TIME_SLOTS[startIdx + 1]);
                          }
                        }}
                        className="w-full h-8 px-3 py-1 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                      >
                        {TIME_SLOTS.slice(0, -1).map((t) => (
                          <option key={t} value={t}>
                            {t} Uhr
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                        Bis
                      </label>
                      <select 
                        value={endTime}
                        disabled={!isUserAuthorizedToEdit}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full h-8 px-3 py-1 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-accent)] transition-colors text-slate-900 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                      >
                        {TIME_SLOTS.slice(
                          TIME_SLOTS.indexOf(modalStartTime) + 1,
                        ).map((t) => (
                          <option key={t} value={t}>
                            {t} Uhr
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {isLockMode ? (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">
                        Grund der Sperrung
                      </label>
                      <input 
                        type="text"
                        value={reason}
                        disabled={!isUserAuthorizedToEdit}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-800 bg-slate-50 transition-colors py-2 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        placeholder="z.B. Medenspiel, Training..."
                      />
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <label className={`flex items-center gap-2 text-[9px] font-bold text-slate-800 cursor-pointer ${!isUserAuthorizedToEdit ? "opacity-60 cursor-not-allowed" : ""}`}>
                          <input
                            type="checkbox"
                            checked={isFullDay}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setIsFullDay(e.target.checked)}
                            className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>GANZTÄGIG</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-50 h-8 px-3 py-1 rounded-lg border border-slate-200 font-sans font-medium">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                          {selectedSlot?.editingId ? "Spieler 1 (Ersteller)" : "Spieler 1 (Eingeloggt)"}
                        </label>
                        <div className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                          <i className="fa-solid fa-user-check text-[var(--color-primary)]"></i>
                          {spieler1Name}
                        </div>
                      </div>
                      <div className="space-y-2.5 relative">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                          Mitspieler
                        </label>

                        <div className="relative">
                          <div className="relative flex items-center w-full">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 text-slate-400 text-xs pointer-events-none"></i>
                            <input 
                              type="text"
                              value={playerQuery}
                              disabled={!isUserAuthorizedToEdit}
                              onChange={(e) => setPlayerQuery(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onFocus={() => setShowSuggestions(true)}
                              onBlur={() =>
                                setTimeout(() => setShowSuggestions(false), 200)
                              }
                              placeholder={
                                !isUserAuthorizedToEdit
                                  ? "Keine Berechtigung zum Bearbeiten"
                                  : "Mitspieler suchen & hinzufügen..."
                              }
                              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-sm transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                          </div>

                          {showSuggestions && playerQuery.trim().length > 0 && isUserAuthorizedToEdit && (
                            <div className="absolute top-full left-0 right-0 z-[120] mt-1 bg-white border border-slate-300 rounded-xl shadow-lg overflow-hidden max-h-[150px] overflow-y-auto">
                              {getFilteredUsers(playerQuery).length === 0 ? (
                                canBookHobbyLeague ? (
                                  <div className="p-3 text-center flex flex-col items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-bold">Kein Mitspieler gefunden.</span>
                                    <button 
                                      type="button" 
                                      onMouseDown={(e) => { e.preventDefault(); setBookingTab("league"); }}
                                      className="text-[10px] text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors w-full border border-amber-200 shadow-sm"
                                    >
                                      Suchst du einen Gegner für dein Ligaspiel?
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-3 text-[10px] text-slate-500 font-bold text-center">Kein Mitspieler gefunden.</div>
                                )
                              ) : (
                                getFilteredUsers(playerQuery).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleAddPlayer(s);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-slate-100 font-bold text-slate-700 border-b last:border-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <i className="fa-solid fa-user-plus text-[var(--color-primary)] opacity-75"></i>
                                    <span>{formatPlayerName(s)}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        {/* Already added players as visual pills displayed directly under the input field */}
                        {additionalPlayers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[36px] items-center">
                            {additionalPlayers.map((player, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 bg-emerald-50/70 text-emerald-800 border border-emerald-100 px-2.5 py-1 rounded-full font-semibold text-[10px] shadow-sm hover:border-emerald-200 transition-colors select-none"
                              >
                                <i className="fa-solid fa-user text-[8px] text-emerald-600 opacity-80"></i>
                                <span>{formatPlayerName(player)}</span>
                                {isUserAuthorizedToEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePlayer(idx)}
                                    className="w-3.5 h-3.5 rounded-full bg-emerald-100/80 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors text-[8px] font-black ml-0.5 cursor-pointer"
                                    title="Entfernen"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {(() => {
                        const maxMachines =
                          reservationRules?.availableBallMachines ?? 1;
                        if (maxMachines <= 0) return null;

                        const ballMachinesInUse = bookings.filter(
                          (b) =>
                            b.id !== selectedSlot.editingId &&
                            b.date === selectedSlot.date &&
                            b.time === modalStartTime &&
                            b.court !== selectedSlot.court &&
                            b.hasBallMachine,
                        ).length;
                        const ballMachineBelegt =
                          ballMachinesInUse >= maxMachines;
                        return (
                          <div className="flex flex-col justify-end">
                            <label
                              className={`flex items-center gap-2 p-2 bg-green-50/50 border rounded-lg transition-all shadow-sm ${ballMachineBelegt ? "opacity-50 border-red-200 bg-red-50 cursor-not-allowed" : !isUserAuthorizedToEdit ? "opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed" : "border-[var(--color-primary)]/10 cursor-pointer hover:bg-green-100"}`}
                            >
                              <input
                                type="checkbox"
                                checked={!ballMachineBelegt && hasBallMachine}
                                onChange={(e) => {
                                  if (!ballMachineBelegt) {
                                    setHasBallMachine(e.target.checked);
                                  }
                                }}
                                disabled={ballMachineBelegt || !isUserAuthorizedToEdit}
                                className="w-4 h-4 accent-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase flex items-center gap-1.5">
                                <i className="fa-solid fa-robot"></i>{" "}
                                Ballmaschine
                              </span>
                            </label>
                            {ballMachineBelegt && (
                              <p className="text-[8px] text-red-600 font-bold mt-0.5 uppercase tracking-wider leading-none">
                                <i className="fa-solid fa-circle-exclamation mr-1"></i>{" "}
                                Belegt auf anderem Platz!
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {settings?.modules?.guests !== false && (
                        <div className="flex flex-col justify-end">
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5 flex items-center gap-1">
                            <i className="fa-solid fa-user-tag text-slate-400"></i>{" "}
                            Gastspieler
                          </label>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((num) => (
                              <button
                                key={num}
                                type="button"
                                disabled={!isUserAuthorizedToEdit}
                                onClick={() => setGuestCount(num)}
                                className={`flex-1 h-8 rounded-lg border font-bold text-[11px] transition-all active:scale-95 flex items-center justify-center gap-0.5 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed ${guestCount === num ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                              >
                                {num > 0 && (
                                  <i className="fa-solid fa-user text-[9px]"></i>
                                )}
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
                  {!isUserAuthorizedToEdit && (
                    <p className="text-center text-xs text-slate-500 font-semibold font-sans py-1">
                      <i className="fa-solid fa-circle-info mr-1.5 text-slate-400"></i>
                      Diese Reservierung kann nur vom Ersteller oder Admin bearbeitet werden.
                    </p>
                  )}
                  <div className="flex gap-3 w-full">
                    {isUserAuthorizedToEdit && (
                      <button
                        onClick={confirmAction}
                        className={`flex-1 text-white rounded-xl shadow transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 h-10 text-sm font-medium ${isLockMode ? "bg-slate-500 hover:bg-slate-600" : "hover:brightness-95"}`}
                        style={!isLockMode ? { backgroundColor: settings?.primaryColor || "var(--color-primary)" } : undefined}
                      >
                        <i
                          className={`fa-solid ${selectedSlot.editingId ? "fa-floppy-disk" : "fa-check-circle"}`}
                        ></i>
                        {selectedSlot.editingId
                          ? "Speichern"
                          : isLockMode
                            ? "Sperrung aktiv"
                            : "Platz reservieren"}
                      </button>
                    )}
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className={`${isUserAuthorizedToEdit ? "px-6 bg-white border border-slate-300 text-slate-700" : "flex-1 bg-slate-200 text-slate-700"} font-bold py-2.5 rounded-xl shadow-sm transition-all uppercase tracking-wider text-[10px] active:scale-95`}
                    >
                      {isUserAuthorizedToEdit ? "Abbr." : "Schließen"}
                    </button>
                  </div>
                </div>
                </div>

                {/* League Booking Tab Content */}
                {bookingTab === "league" && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="bg-amber-50/50 p-4 pb-4 space-y-4 overflow-y-auto flex-1 text-slate-700">
                      {/* Austragungsort Card with Facility Switcher */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                        <div className="h-24 w-full relative bg-slate-200 overflow-hidden">
                          <img
                            src={venuePhoto}
                            alt="Austragungsort Anlage"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end justify-between p-3">
                            <div className="text-white min-w-0 flex-1 pr-2">
                              <div className="text-[9px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5 leading-none mb-1">
                                <i className="fa-solid fa-location-dot"></i>
                                Austragungsort
                              </div>
                              <div className="text-xs font-black truncate drop-shadow-sm text-white">
                                {venueClubName}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-white flex items-center justify-between gap-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-slate-700 hover:text-[var(--color-primary)] flex items-center gap-1.5 min-w-0 transition-colors group cursor-pointer"
                            title="In Google Maps öffnen"
                          >
                            <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                            <span className="truncate">{displayAddress}</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400 group-hover:text-[var(--color-primary)] shrink-0 transition-colors"></i>
                          </a>
                        </div>
                      </div>

                      {/* Anlage wählen */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                          Anlage wählen
                        </label>
                        <div className="relative">
                          <select
                            value={currentFacilitySelectValue}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => handleSwitchFacility(e.target.value)}
                            className="w-full h-8 px-3 py-1 pr-8 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {availableClubsList.map((c) => {
                              const cId = c.vereinsId || c.id;
                              return (
                                <option key={cId} value={cId} className="text-slate-800">
                                  {c.clubName || c.name || cId} {c.city ? `(${c.city})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                        </div>
                      </div>

                      {/* Platz wählen */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                          Platz wählen
                        </label>
                        <div className="relative">
                          <select
                            value={selectedCourtInModal}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setSelectedCourtInModal(e.target.value)}
                            className="w-full h-8 px-3 py-1 pr-8 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {currentModalCourtOptions.map(({ name, isAvailable }) => (
                              <option
                                key={name}
                                value={name}
                                disabled={!isAvailable && name !== selectedCourtInModal}
                                className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                              >
                                {name} {!isAvailable ? '(belegt)' : ''}
                              </option>
                            ))}
                          </select>
                          <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                        </div>
                      </div>

                      {/* Zeitraum */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0 shadow-sm">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                            Ab
                          </label>
                          <select 
                            value={modalStartTime}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setModalStartTime(newStart);
                              const startIdx = TIME_SLOTS.indexOf(newStart);
                              if (startIdx >= 0) {
                                let maxEndIdx = TIME_SLOTS.length - 1;
                              if (selectedSlot?.date && reservationRules?.openingHours) {
                                const weekday = new Date(selectedSlot.date).getDay();
                                const dayRule = reservationRules.openingHours[String(weekday)];
                                if (dayRule && dayRule.end && !dayRule.closed) {
                                  const idx = TIME_SLOTS.indexOf(dayRule.end);
                                  if (idx !== -1) maxEndIdx = idx;
                                }
                              }
                              const endIdx = Math.min(maxEndIdx, startIdx + 2);
                              setEndTime(TIME_SLOTS[endIdx]);
                              }
                            }}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {TIME_SLOTS.slice(0, -1).map((t) => (
                              <option key={t} value={t}>{t} Uhr</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                            Bis (2 - 3 Std.)
                          </label>
                          <select 
                            value={endTime}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {leagueEndTimeOptions.map((t) => {
                              const dur = getDurationInHours(modalStartTime, t);
                              return (
                                <option key={t} value={t}>
                                  {t} Uhr ({dur.toFixed(dur % 1 === 0 ? 0 : 1)} Std.)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Validation Warning for Duration */}
                      {currentLeagueDuration > 0 && currentLeagueDuration < 2 && (
                        <div className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                          <i className="fa-solid fa-triangle-exclamation text-amber-600 text-xs shrink-0"></i>
                          <span>Mindestspieldauer für Ligaspiele: 2 Stunden (aktuell: {currentLeagueDuration.toFixed(1)} Std.).</span>
                        </div>
                      )}
                      {currentLeagueDuration > 3 && (
                        <div className="text-[10px] font-bold text-red-800 bg-red-100/90 border border-red-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-exclamation text-red-600 text-xs shrink-0"></i>
                          <span>Maximaldauer für Ligaspiele: 3 Stunden (aktuell: {currentLeagueDuration.toFixed(1)} Std.).</span>
                        </div>
                      )}

                      {/* League Opponent Search */}
                      <div className="space-y-4 mt-4">
                        <div className="bg-slate-50 h-8 px-3 py-1 rounded-lg border border-slate-200 font-sans font-medium">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            {selectedSlot?.editingId ? "Spieler 1 (Ersteller)" : "Spieler 1 (Eingeloggt)"}
                          </label>
                          <div className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                            <i className="fa-solid fa-user-check text-[var(--color-primary)]"></i>
                            {spieler1Name}
                          </div>
                        </div>
                        <div className="space-y-2.5 relative">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            Gegner
                          </label>
                          {!leagueOpponent ? (
                            <div className="relative">
                              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"></i>
                              <input 
                                type="text"
                                value={leagueOpponentQuery}
                                disabled={!isUserAuthorizedToEdit}
                                onChange={(e) => setLeagueOpponentQuery(e.target.value)}
                                onFocus={() => setShowLeagueSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 250)}
                                placeholder="Gegner suchen (Name, Vorname...)"
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-sm transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            {showLeagueSuggestions && leagueOpponentQuery.trim().length > 0 && isUserAuthorizedToEdit && (
                              <div className="absolute top-full left-0 right-0 z-[120] mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-[190px] overflow-y-auto">
                                {getFilteredLeagueUsers(leagueOpponentQuery).length === 0 ? (
                                  <div className="p-3 text-xs text-slate-500 text-center font-medium">Keine passenden Spieler gefunden.</div>
                                ) : (
                                  getFilteredLeagueUsers(leagueOpponentQuery).map((u) => {
                                    const displayName = resolvePlayerDisplayName(u);
                                    const identifier = u.name || u.id;
                                    const clubBadge = u.vereinsId ? u.vereinsId.toUpperCase() : "";
                                    return (
                                      <button
                                        key={u.id || identifier}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setLeagueOpponent(identifier);
                                          setLeagueOpponentQuery("");
                                          setShowLeagueSuggestions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-[11px] hover:bg-amber-50 font-bold text-slate-700 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <UserAvatar user={u} name={displayName} size="xs" className="shrink-0" />
                                          <span className="truncate">{displayName}</span>
                                        </div>
                                        {clubBadge && (
                                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                            {clubBadge}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between h-8 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl shadow-sm font-sans font-medium">
                            <div className="flex items-center gap-3 truncate">
                              <UserAvatar
                                user={selectedOpponentUser}
                                avatarUrl={selectedOpponentUser?.avatarUrl}
                                avatarIcon={selectedOpponentUser?.avatarIcon}
                                name={selectedOpponentUser ? resolvePlayerDisplayName(selectedOpponentUser) : formatPlayerName(leagueOpponent)}
                                size="xs"
                                className="shrink-0"
                              />
                              <span className="font-bold text-sm text-slate-800 truncate">
                                {selectedOpponentUser ? resolvePlayerDisplayName(selectedOpponentUser) : formatPlayerName(leagueOpponent)}
                              </span>
                            </div>
                            {isUserAuthorizedToEdit && (
                              <button
                                type="button"
                                onClick={() => setLeagueOpponent(null)}
                                className="w-6 h-6 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm border border-slate-200 shrink-0"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      </div>

                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
                      <div className="flex gap-3 w-full">
                        {isUserAuthorizedToEdit && (
                          <button
                            onClick={handleLeagueSubmit}
                            className="flex-1 text-white rounded-xl shadow transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 h-10 text-sm font-medium hover:brightness-95"
                            style={{ backgroundColor: settings?.primaryColor || "var(--color-primary)" }}
                          >
                            <i className="fa-solid fa-trophy"></i> Ligaspiel eintragen
                          </button>
                        )}
                        <button
                          onClick={() => setIsModalOpen(false)}
                          className={`${isUserAuthorizedToEdit ? "px-6 bg-white border border-slate-300 text-slate-700" : "flex-1 bg-slate-200 text-slate-700"} font-bold py-2.5 rounded-xl shadow-sm transition-all uppercase tracking-wider text-[10px] active:scale-95`}
                        >
                          {isUserAuthorizedToEdit ? "Abbr." : "Schließen"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }


  return (
    <div className="space-y-3 lg:space-y-4 w-full flex-grow flex flex-col lg:animate-in lg:fade-in lg:duration-500 min-h-0">
      <OnboardingBanner
        show={currentUser?.show_onboarding_hints !== false && !isPublicWochenplan}
        desktopText="Wähle eine freie Uhrzeit in der Zukunft, um deinen Platz zu reservieren."
        mobileText={
          viewType === "week"
            ? "Drücke auf einen Wochentag, um für den Tag zu buchen."
            : 'Drücke auf "+" um einen Platz zu reservieren.'
        }
        onDismiss={() => onDismissOnboardingHints?.()}
      />
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-1 pr-2 lg:pr-2.5 rounded-2xl shadow-sm border border-slate-200/80 gap-1.5 lg:gap-2 w-full shrink-0">
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-1 w-full sm:w-auto shrink-0 h-8 relative gap-1">
            <button
              type="button"
              disabled={isBackDisabled}
              onClick={() => navigateDate(-1)}
              className={`px-2 text-slate-600 rounded-lg transition-colors h-full flex items-center justify-center shrink-0 ${
                isBackDisabled
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer"
              }`}
              title="Vorheriger Tag"
              aria-label="Vorheriger Tag"
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <div
              ref={calendarRef}
              className="relative h-full flex-1 sm:flex-none sm:min-w-[140px] group cursor-pointer"
            >
              <button
                type="button"
                onClick={openCalendar}
                className="px-2.5 sm:px-3 text-slate-800 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-1.5 h-full w-full transition-colors outline-none select-none cursor-pointer"
              >
                <i className="fa-solid fa-calendar-day text-[var(--color-primary)] text-[11px] sm:text-[10.5px]"></i>
                <span className="text-[11px] sm:text-[11.5px] font-semibold text-slate-800 uppercase tracking-wider whitespace-nowrap pt-[0.5px]">
                  {viewType === "day"
                    ? new Date(selectedDate).toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : `${new Date(weekDates[0]).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} - ${new Date(weekDates[6]).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`}
                </span>
                <i className="fa-solid fa-caret-down text-slate-400 group-hover:text-slate-600 transition-colors text-[8px]"></i>
              </button>

              {/* STUNNING INLINE CALENDAR DROPDOWN & MOBILE MODAL */}
              {showCustomCalendar && (
                <>
                  {/* Mobile Backdrop */}
                  <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] lg:hidden"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomCalendar(false);
                    }}
                  />

                  {/* Calendar Container */}
                  <div className="fixed lg:absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 lg:top-[34px] lg:mt-1 lg:left-0 lg:translate-x-0 lg:translate-y-0 w-[320px] lg:w-[280px] bg-white border border-slate-200/90 rounded-2xl shadow-xl p-5 lg:p-4 z-[9999] animate-in fade-in zoom-in-95 lg:slide-in-from-top-2 duration-200">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4 lg:mb-3 select-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const prevMonth = new Date(currentCalendarMonth);
                          prevMonth.setMonth(prevMonth.getMonth() - 1);
                          setCurrentCalendarMonth(prevMonth);
                        }}
                        className="text-slate-600 hover:text-emerald-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                        title="Vorheriger Monat"
                        aria-label="Vorheriger Monat"
                      >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                      </button>
                      <span className="text-sm lg:text-xs font-black text-[var(--color-primary)] uppercase tracking-wider">
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
                          ][currentCalendarMonth.getMonth()]
                        }{" "}
                        {currentCalendarMonth.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextMonth = new Date(currentCalendarMonth);
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          setCurrentCalendarMonth(nextMonth);
                        }}
                        className="text-slate-600 hover:text-emerald-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                        title="Nächster Monat"
                        aria-label="Nächster Monat"
                      >
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                      </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-1 place-items-center mb-2 select-none">
                      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((wd) => (
                        <span
                          key={wd}
                          className="w-full text-center text-[10px] lg:text-[9px] font-black uppercase text-slate-400 py-1"
                        >
                          {wd}
                        </span>
                      ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1 place-items-center">
                      {calendarDays.map((slot, index) => {
                        const isSelected = slot.dateString === selectedDate;
                        const todayStr = getLocalDateString(new Date());
                        const isToday = slot.dateString === todayStr;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(slot.dateString);
                              setShowCustomCalendar(false);
                            }}
                            className={`w-full aspect-square rounded-xl lg:rounded-lg flex items-center justify-center font-bold text-sm lg:text-xs transition-all relative active:scale-95 cursor-pointer ${
                              !slot.isCurrentMonth
                                ? "text-slate-300 hover:bg-slate-50"
                                : isSelected
                                  ? "bg-[var(--color-primary)] text-white font-black shadow-md border-2 border-[var(--color-primary)]"
                                  : isToday
                                    ? "border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-slate-50"
                                    : "text-slate-700 hover:bg-slate-100 border-2 border-transparent"
                            }`}
                          >
                            {slot.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigateDate(1)}
              className="px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors active:scale-95 shrink-0 cursor-pointer h-full flex items-center justify-center"
              title="Nächster Tag"
              aria-label="Nächster Tag"
            >
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto shrink-0 h-8 relative overflow-hidden gap-0.5">
            {isPublicWochenplan ? (
              <button
                type="button"
                onClick={() => {
                  setIsPublicLoginModalOpen(true);
                  setInlineLoginError(null);
                }}
                className="flex-1 px-3 sm:px-4 h-full rounded-lg bg-emerald-600 hover:bg-emerald-700 font-black uppercase text-[10px] lg:text-[9px] tracking-widest text-white transition-all flex items-center justify-center gap-1.5 relative cursor-pointer outline-none shadow-sm active:scale-95 whitespace-nowrap"
              >
                <i className="fa-solid fa-right-to-bracket text-[10px]"></i> Anmelden
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setViewType("day")}
                  className="flex-1 sm:px-3 h-full rounded-lg font-black md:font-medium uppercase text-[10px] lg:text-[9px] tracking-widest transition-colors flex items-center justify-center gap-1.5 relative cursor-pointer outline-none"
                >
                  {viewType === "day" && (
                    <motion.div
                      layoutId="desktopViewTypeBadge"
                      className="absolute inset-0 rounded-lg shadow-sm"
                      style={{
                        backgroundColor:
                          settings?.primaryColor || "var(--color-primary)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    />
                  )}
                  <span
                    className={`relative z-10 flex items-center gap-1.5 ${viewType === "day" ? "text-white" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <i className="fa-solid fa-calendar-day text-[10px]"></i> Tag
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType("week")}
                  className="flex-1 sm:px-3 h-full rounded-lg font-black md:font-medium uppercase text-[10px] lg:text-[9px] tracking-widest transition-colors flex items-center justify-center gap-1.5 relative cursor-pointer outline-none"
                >
                  {viewType === "week" && (
                    <motion.div
                      layoutId="desktopViewTypeBadge"
                      className="absolute inset-0 rounded-lg shadow-sm"
                      style={{
                        backgroundColor:
                          settings?.primaryColor || "var(--color-primary)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    />
                  )}
                  <span
                    className={`relative z-10 flex items-center gap-1.5 ${viewType === "week" ? "text-white" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <i className="fa-solid fa-calendar-week text-[10px]"></i> Woche
                  </span>
                </button>
                <div className="w-[1px] h-3 bg-slate-300 mx-1 shrink-0 relative z-10" />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const todayStr = getLocalDateString(new Date());
                setSelectedDate(todayStr);
                setCurrentCalendarMonth(new Date());
              }}
              className="flex-1 sm:px-3 h-full rounded-lg font-black md:font-medium uppercase text-[10px] lg:text-[9px] tracking-widest transition-colors flex items-center justify-center gap-1.5 relative cursor-pointer outline-none text-slate-500 hover:text-slate-700 active:scale-95"
              title="Zum heutigen Tag springen"
            >
              <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>{" "}
              Heute
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 overflow-x-auto w-full lg:w-auto shrink-0 border-t sm:border-t-0 lg:border-l border-slate-200 lg:border-slate-300 pt-1 sm:pt-0 lg:pl-4 lg:pr-3 min-h-8 items-center justify-center sm:justify-start">
          <span className="flex items-center gap-1.5 text-[10px] lg:text-[9px] font-black md:font-medium text-slate-600 uppercase whitespace-nowrap">
            <div className="w-3 h-3 bg-white border border-slate-400 rounded-sm shadow-sm"></div>{" "}
            Frei
          </span>
          <span className="flex items-center gap-1.5 text-[10px] lg:text-[9px] font-black md:font-medium text-slate-600 uppercase whitespace-nowrap">
            <div className="w-3 h-3 bg-emerald-50 border border-emerald-300 rounded-sm shadow-sm"></div>{" "}
            Gebucht
          </span>
          <span className="flex items-center gap-1.5 text-[10px] lg:text-[9px] font-black md:font-medium text-slate-600 uppercase whitespace-nowrap">
            <div className="w-3 h-3 bg-slate-200 border border-slate-400 rounded-sm shadow-sm"></div>{" "}
            Blockiert
          </span>
        </div>
      </div>

      {activePeriodRangeLocks.length > 0 && (
        <div className="space-y-3">
          {activePeriodRangeLocks.map((lock) => {
            const startStr = new Date(lock.startDate).toLocaleDateString(
              "de-DE",
              { day: "2-digit", month: "2-digit", year: "numeric" },
            );
            const endStr = new Date(lock.endDate).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const isWinterBreak = lock.title.toLowerCase().includes("winter");
            return (
              <div
                key={lock.id}
                className={`p-5 sm:p-6 rounded-3xl border-2 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top duration-300 ${
                  isWinterBreak
                    ? "bg-blue-50/95 border-blue-200 text-blue-950"
                    : "bg-amber-50/95 border-amber-200 text-amber-950"
                }`}
              >
                <div className="flex items-start md:items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isWinterBreak
                        ? "bg-blue-100 border-blue-200 text-blue-600"
                        : "bg-amber-100 border-amber-200 text-amber-600"
                    }`}
                  >
                    <i
                      className={`fa-solid ${isWinterBreak ? "fa-snowflake text-lg" : "fa-triangle-exclamation text-lg"}`}
                    ></i>
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-wider leading-none">
                      {lock.title}
                    </h4>
                    <p className="text-[11px] font-bold mt-1.5 opacity-90 leading-relaxed">
                      Einschränkung für {lock.courts.join(", ")} vom{" "}
                      <strong>{startStr}</strong> bis zum{" "}
                      <strong>{endStr}</strong> aktiv. In diesem Zeitraum sind
                      die betroffenen Plätze für Reservierungen komplett
                      gesperrt.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="w-full relative flex flex-col">
        <AnimatePresence mode="wait">
          {viewType === "day" ? (
          <motion.div
            key="desktop-day-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 lg:space-y-0 w-full flex flex-col"
          >
          {/* Mobile Layout Switcher - Only visible on small screens when Day View is active */}
          <div className="lg:hidden flex items-center justify-between bg-white px-2.5 py-1.5 rounded-none border border-slate-200/80 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-sliders text-slate-400"></i>{" "}
              Mobil-Ansicht:
            </span>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-none border border-slate-200">
              <button
                onClick={() => setMobileDayLayout("timeline")}
                className={`px-3 py-1.5 rounded-none font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1 active:scale-95 ${mobileDayLayout === "timeline" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
              >
                <i className="fa-solid fa-list-ul"></i> Kompakt
              </button>
              <button
                onClick={() => setMobileDayLayout("columns")}
                className={`px-3 py-1.5 rounded-none font-black uppercase text-[9px] tracking-wider transition-all flex items-center gap-1 active:scale-95 ${mobileDayLayout === "columns" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
              >
                <i className="fa-solid fa-columns"></i> Spalten
              </button>
            </div>
          </div>

          
          {/* Desktop view OR Column layout if selected on mobile */}
          {(() => {
            return (
              <div
                className={`${mobileDayLayout === "columns" ? "flex flex-col max-h-[calc(100dvh-170px)] mb-0 overflow-y-auto hide-scrollbar lg:max-h-none lg:mb-0 lg:overflow-y-visible" : "hidden lg:flex lg:flex-col"} w-full [will-change:transform] custom-calendar-container`}
                style={
                  {
                    ...(isMobile ? swipeStyle : {}),
                  } as React.CSSProperties
                }
              >
                <div className="custom-calendar-scroll w-full flex flex-col overflow-x-auto overflow-y-auto">
                  <div className="flex w-full min-w-[600px] relative">
                    {/* Time Axis Column */}
                    <div className="w-24 shrink-0 border-r-2 border-slate-400 bg-slate-200 z-30 flex flex-col sticky left-0 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                        <div className="h-[72px] border-b-2 border-slate-400 bg-slate-200 text-center font-black md:font-normal uppercase text-[10px] text-[var(--color-primary)] sticky top-0 z-40 flex items-center justify-center">Zeitraum</div>
                        <div className="flex flex-col" style={{ height: gridHeight }}>
                            {startTimes.map((time, idx) => {
                                const nextTime = TIME_SLOTS[TIME_SLOTS.indexOf(time) + 1];
                                const isHoveredTime = hoveredTime === time;
                                const defaultGreen = settings?.primaryColor || "var(--color-primary)";
                                return (
                                   <div 
                                      key={time} 
                                      style={{ height: slotHeight, ...(isHoveredTime ? { backgroundColor: defaultGreen } : {}) }}
                                      className={`border-b border-slate-300 last:border-b-0 flex items-center justify-center transition-all ${isHoveredTime ? "" : "bg-slate-100"}`}
                                      onMouseEnter={() => setHoveredTime(time)}
                                      onMouseLeave={() => setHoveredTime(null)}
                                   >
                                      <span className={`text-xs font-medium text-center leading-none tracking-tight transition-colors ${isHoveredTime ? "text-white" : "text-slate-500"}`}>
                                          {parseInt(time)} - {parseInt(nextTime)} Uhr
                                      </span>
                                   </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Courts Columns */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex sticky top-0 z-20 bg-slate-50 border-b-2 border-slate-400 h-[72px]">
                           {courts.map(court => (
                              <div key={court} className="flex-1 min-w-[120px] h-full text-center font-bold uppercase text-[12px] text-[var(--color-primary)] border-r border-slate-300 last:border-r-0 flex items-center justify-center">
                                 {court}
                              </div>
                           ))}
                        </div>
                        <div className="flex" style={{ height: gridHeight }}>
                           {courts.map(court => renderDesktopColumn(selectedDate, court, startTimes, true))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      ) : (
        <motion.div
          key="desktop-week-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="custom-calendar-container w-full relative [will-change:transform]"
          style={
            {
              ...(isMobile ? swipeStyle : {}),
            } as React.CSSProperties
          }
        >
          <div className="custom-calendar-scroll w-full flex flex-col overflow-x-auto overflow-y-auto">
            <div className="flex w-full relative min-w-[700px]">
              {/* Time Axis Column */}
              <div className="w-24 shrink-0 border-r-2 border-slate-400 bg-slate-200 z-30 flex flex-col sticky left-0 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  <div className="h-[72px] border-b-2 border-slate-400 bg-slate-200 text-center font-black md:font-normal uppercase text-[10px] text-[var(--color-primary)] sticky top-0 z-40 flex items-center justify-center">Zeitraum</div>
                  <div className="flex flex-col" style={{ height: gridHeight }}>
                      {startTimes.map((time, idx) => {
                          const nextTime = TIME_SLOTS[TIME_SLOTS.indexOf(time) + 1];
                          const isHoveredTime = hoveredTime === time;
                          const defaultGreen = settings?.primaryColor || "var(--color-primary)";
                          return (
                             <div 
                                key={time} 
                                style={{ height: slotHeight, ...(isHoveredTime ? { backgroundColor: defaultGreen } : {}) }}
                                className={`border-b border-slate-300 last:border-b-0 flex items-center justify-center transition-all ${isHoveredTime ? "" : "bg-slate-100"}`}
                                onMouseEnter={() => setHoveredTime(time)}
                                onMouseLeave={() => setHoveredTime(null)}
                             >
                                <span className={`text-xs font-medium text-center leading-none tracking-tight transition-colors ${isHoveredTime ? "text-white" : "text-slate-500"}`}>
                                    {parseInt(time)} - {parseInt(nextTime)} Uhr
                                </span>
                             </div>
                          )
                      })}
                  </div>
              </div>

              {/* Dates -> Courts Columns */}
              <div className="flex-1 flex flex-col min-w-0">
                  {/* Two-level Header */}
                  <div className="flex h-[72px] sticky top-0 z-20 bg-slate-50 border-b-2 border-slate-400 flex-col">
                     <div className="flex w-full h-10 border-b-2 border-slate-300 bg-slate-200">
                        {weekDates.map((date) => (
                          <div key={date} className="flex-1 min-w-0 text-center border-r-2 border-slate-500 last:border-r-0 flex items-center justify-center">
                            <div className="flex justify-center items-center gap-1 font-bold uppercase text-[10px] md:text-[11px] lg:text-[12px]">
                              <span className="tracking-widest text-[var(--color-primary)]">
                                {new Date(date).toLocaleDateString("de-DE", { weekday: "short" })}
                              </span>
                              <span className="text-slate-500 font-bold">
                                {new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        ))}
                     </div>
                     <div className="flex w-full h-8">
                        {weekDates.map((date) => (
                           <div key={`${date}-courts`} className="flex-1 min-w-0 flex border-r-2 border-slate-500 last:border-r-0">
                              {courts.map(court => (
                                 <div key={court} className="flex-1 min-w-0 h-8 text-center font-bold uppercase text-[10px] lg:text-[11px] text-slate-600 border-r border-slate-300 last:border-r-0 flex items-center justify-center">
                                    {court}
                                 </div>
                              ))}
                           </div>
                        ))}
                     </div>
                  </div>
                  
                  {/* Grid Content */}
                  <div className="flex" style={{ height: gridHeight }}>
                     {weekDates.map((date) => (
                        <div key={`${date}-content`} className="flex-1 min-w-0 flex border-r-2 border-slate-500 last:border-r-0" style={{ height: gridHeight }}>
                           {courts.map(court => renderDesktopColumn(date, court, startTimes, false))}
                        </div>
                     ))}
                  </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>

      {isModalOpen &&
        selectedSlot &&
        createPortal(
          <div
            className="hidden lg:flex fixed inset-0 z-[99999] justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
            onClick={handleCloseModal}
            style={{
              opacity: !isAnimatingIn || isClosing ? 0 : 1,
              transitionDuration: isClosing ? "200ms" : "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              pointerEvents: isClosing ? "none" : "auto",
            }}
          >
            <div
              className="w-[450px] max-w-[100vw] h-[100vh] bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform:
                  !isAnimatingIn || isClosing
                    ? "translateX(100%)"
                    : "translateX(0)",
                transitionDuration: isClosing ? "200ms" : "250ms",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Drawer Header */}
              <div className="bg-[var(--color-primary)] p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden">
                {/* Background Relief Watermark */}
                <div className="absolute -bottom-10 -right-6 text-white opacity-[0.06] z-0 pointer-events-none transform -rotate-12">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[140px] h-[140px]"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                    <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
                  </svg>
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold uppercase tracking-tight leading-none mb-1">
                    {selectedSlot.editingId && isUserAuthorizedToEdit ? "Bearbeiten" : selectedSlot.court}
                  </h3>
                  <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-day opacity-75"></i>
                    {new Date(selectedSlot.date).toLocaleDateString("de-DE", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="px-5 pt-4 pb-0 shrink-0">
                  <div className="bg-red-50 border-x-4 border-red-500 text-red-700 h-8 px-3 py-1 flex items-center gap-2 animate-pulse text-[11px] shadow-sm font-sans font-medium">
                    <i className="fa-solid fa-circle-exclamation text-base"></i>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Sticky Actions Area (Above the fold) */}
              {!currentUser ? (
                <div className="flex flex-col flex-1 bg-white select-text h-full overflow-y-auto">
                  <div className="p-6 flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-6">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-800 border border-slate-200 shadow-sm">
                        <i className="fa-solid fa-user-lock text-lg"></i>
                      </div>
                      <h4 className="text-base font-black uppercase tracking-tight text-slate-800">
                        Bitte anmelden, um diesen Slot zu buchen
                      </h4>
                      <p className="text-xs text-slate-500 font-sans font-semibold">
                        Gib deine Anmeldedaten ein, um die Buchung für diesen Zeitslot fortzusetzen.
                      </p>
                    </div>

                    {inlineLoginError && (
                      <div className="bg-red-50 border-x-4 border-red-500 text-red-700 h-8 px-3 py-1 flex items-center gap-2 animate-pulse text-[11px] shadow-sm font-sans font-medium">
                        <i className="fa-solid fa-circle-exclamation text-base"></i>
                        <span>{inlineLoginError}</span>
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setInlineLoginError(null);
                        setIsInlineLoggingIn(true);
                        try {
                          const loggedInUser = await loginWithUsername(
                            inlineUsername,
                            inlinePassword,
                            settings?.id || "djk-furth"
                          );
                          if (onPublicLoginSuccess) {
                            onPublicLoginSuccess(loggedInUser);
                          }
                        } catch (err: any) {
                          setInlineLoginError(err.message || "Benutzername oder Passwort falsch.");
                        } finally {
                          setIsInlineLoggingIn(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Benutzername oder E-Mail
                        </label>
                        <input
                          type="text"
                          required
                          value={inlineUsername}
                          onChange={(e) => setInlineUsername(e.target.value)}
                          className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-colors placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          placeholder="z. B. max.mustermann"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Passwort
                        </label>
                        <input
                          type="password"
                          required
                          value={inlinePassword}
                          onChange={(e) => setInlinePassword(e.target.value)}
                          className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-colors placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          placeholder="••••••••"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isInlineLoggingIn}
                        className="w-full text-white bg-[var(--color-primary)] hover:brightness-95 disabled:opacity-50 rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-black"
                      >
                        {isInlineLoggingIn ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin"></i>
                            <span>Anmeldung läuft...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-right-to-bracket"></i>
                            <span>Anmelden & Weiter</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <>
                  {bookingOptions.length > 1 && (
                    <div className="px-5 py-4 border-b-2 border-slate-200 bg-slate-50 shrink-0 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] z-10">
                      <div className="relative flex p-1 bg-slate-200 rounded-xl border border-slate-300 select-none shadow-sm">
                        <div
                          className={`absolute top-1 bottom-1 rounded-lg shadow-sm transition-all duration-300 ease-out z-0 bg-white`}
                          style={{
                             width: `calc(${100 / bookingOptions.length}% - 4px)`,
                             left: `calc(${bookingOptions.findIndex(o => o.id === activeMode) * (100 / bookingOptions.length)}% + 2px)`,
                             ...(activeMode !== "lock" ? { backgroundColor: settings?.primaryColor || "var(--color-primary)" } : { backgroundColor: "#64748b" })
                          }}
                        ></div>
                        {bookingOptions.map(option => (
                          <button
                            key={option.id}
                            className={`relative z-10 flex-1 py-1.5 rounded-lg transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 ${
                               activeMode === option.id 
                                 ? "text-white font-medium" 
                                 : "text-slate-500 hover:text-slate-800 font-bold"
                            }`}
                            onClick={() => {
                               if (option.id === "lock") {
                                 setIsLockMode(true);
                                 setBookingTab("normal");
                               } else if (option.id === "league") {
                                 setIsLockMode(false);
                                 setBookingTab("league");
                               } else {
                                 setIsLockMode(false);
                                 setBookingTab("normal");
                               }
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scrollable Form Area */}
              {/* Normal Booking Tab Content */}
              <div style={{ display: bookingTab === "normal" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div
                className="p-5 overflow-y-auto flex-1 bg-slate-50 space-y-5"
                style={{ isolation: "isolate" }}
              >
                    {/* Platz wählen */}
                    <div className="bg-white p-3 rounded-xl mb-5 border border-slate-200 shrink-0 shadow-sm">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                        Platz wählen
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCourtInModal}
                          disabled={!isUserAuthorizedToEdit}
                          onChange={(e) => setSelectedCourtInModal(e.target.value)}
                          className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                        >
                          {currentModalCourtOptions.map(({ name, isAvailable }) => (
                            <option
                              key={name}
                              value={name}
                              disabled={!isAvailable && name !== selectedCourtInModal}
                              className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                            >
                              {name} {!isAvailable ? '(belegt)' : ''}
                            </option>
                          ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                      </div>
                    </div>

                <div className={`space-y-5 ${!isUserAuthorizedToEdit ? "pointer-events-none opacity-80" : ""}`}>
                  {/* Zeitraum */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0 shadow-sm">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                      Ab
                    </label>
                    <select 
                      value={modalStartTime}
                      disabled={!isUserAuthorizedToEdit}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setModalStartTime(newStart);
                        const startIdx = TIME_SLOTS.indexOf(newStart);
                        if (TIME_SLOTS.indexOf(endTime) <= startIdx) {
                          setEndTime(TIME_SLOTS[startIdx + 1]);
                        }
                      }}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                    >
                      {TIME_SLOTS.slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {t} Uhr
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                      Bis
                    </label>
                    <select 
                      value={endTime}
                      disabled={!isUserAuthorizedToEdit}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                    >
                      {TIME_SLOTS.slice(
                        TIME_SLOTS.indexOf(modalStartTime) + 1,
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t} Uhr
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isLockMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                        Grund der Sperrung
                      </label>
                      <input 
                        type="text"
                        value={reason}
                        disabled={!isUserAuthorizedToEdit}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl text-sm outline-none focus:border-slate-800 bg-slate-50 focus:bg-white transition-colors disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                        placeholder="z. B. Medenspiel, Training..."
                      />
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <label className={`flex items-center gap-3 text-[11px] font-black text-slate-800 cursor-pointer p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors ${!isUserAuthorizedToEdit ? "opacity-60 bg-slate-100 cursor-not-allowed" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isFullDay}
                          disabled={!isUserAuthorizedToEdit}
                          onChange={(e) => setIsFullDay(e.target.checked)}
                          className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                        <span>GANZTÄGIG SPERREN</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-100 p-1.5 px-3 rounded-xl border-2 border-slate-200">
                      <label className="block text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                        <i className="fa-solid fa-user-check text-[var(--color-primary)] text-[9px]"></i>{" "}
                        {selectedSlot?.editingId ? "Spieler 1 (Ersteller)" : "Spieler 1 (Eingeloggt)"}
                      </label>
                      <div className="font-black text-sm text-[var(--color-primary)] mt-0.5">
                        {spieler1Name}
                      </div>
                    </div>
                    <div className="space-y-2 relative">
                      <label className="block text-[10px] font-black text-slate-500 uppercase">
                        Mitspieler
                      </label>

                      <div className="relative">
                        <div className="relative flex items-center w-full">
                          <i className="fa-solid fa-magnifying-glass absolute left-3 text-slate-400 text-xs pointer-events-none"></i>
                          <input 
                            type="text"
                            value={playerQuery}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setPlayerQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() =>
                              setTimeout(() => setShowSuggestions(false), 200)
                            }
                            placeholder={
                              !isUserAuthorizedToEdit
                                ? "Keine Berechtigung zum Bearbeiten"
                                : "Mitspieler suchen & hinzufügen..."
                            }
                            className="w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-sm transition-colors shadow-sm disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        {showSuggestions && playerQuery.trim().length > 0 && isUserAuthorizedToEdit && (
                          <div className="absolute top-full left-0 right-0 z-[120] mt-1 bg-white border-none rounded-2xl shadow-md overflow-hidden max-h-[190px] overflow-y-auto">
                            {getFilteredUsers(playerQuery).length === 0 ? (
                              canBookHobbyLeague ? (
                                <div className="p-3 text-center flex flex-col items-center gap-2">
                                  <span className="text-xs text-slate-500 font-bold">Kein Mitspieler gefunden.</span>
                                  <button 
                                    type="button" 
                                    onMouseDown={(e) => { e.preventDefault(); setBookingTab("league"); }}
                                    className="text-xs text-amber-600 font-bold bg-amber-50 px-3 py-2 rounded-xl hover:bg-amber-100 transition-colors w-full border border-amber-200 shadow-sm"
                                  >
                                    Suchst du einen Gegner für dein Ligaspiel?
                                  </button>
                                </div>
                              ) : (
                                <div className="p-3 text-xs text-slate-500 font-bold text-center">Kein Mitspieler gefunden.</div>
                              )
                            ) : (
                              getFilteredUsers(playerQuery).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAddPlayer(s);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 font-bold text-slate-700 border-b last:border-0 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <i className="fa-solid fa-user-plus text-[var(--color-primary)] opacity-75"></i>
                                  <span>{formatPlayerName(s)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Already added players as visual pills shown directly under the input field */}
                      {additionalPlayers.length > 0 && (
                        <div className="flex flex-wrap gap-1 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl min-h-[32px] items-center">
                          {additionalPlayers.map((player, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 bg-emerald-50/70 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full font-semibold text-[10px] shadow-sm hover:border-emerald-200 transition-colors select-none"
                            >
                              <i className="fa-solid fa-user text-[8px] text-emerald-600 opacity-80"></i>
                              <span>{formatPlayerName(player)}</span>
                              {isUserAuthorizedToEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePlayer(idx)}
                                  className="w-3.5 h-3.5 rounded-full bg-emerald-100/80 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors text-[8px] font-bold ml-0.5 cursor-pointer"
                                  title="Entfernen"
                                >
                                  <i className="fa-solid fa-xmark"></i>
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      {(() => {
                        const maxMachines =
                          reservationRules?.availableBallMachines ?? 1;
                        if (maxMachines <= 0) return null;

                        const ballMachinesInUse = bookings.filter(
                          (b) =>
                            b.id !== selectedSlot.editingId &&
                            b.date === selectedSlot.date &&
                            b.time === modalStartTime &&
                            b.court !== selectedSlot.court &&
                            b.hasBallMachine,
                        ).length;
                        const ballMachineBelegt =
                          ballMachinesInUse >= maxMachines;
                        return (
                          <div className="flex flex-col justify-end">
                            <label
                              className={`flex items-center gap-3 p-2 bg-green-50 border-2 rounded-xl transition-all shadow-sm ${ballMachineBelegt ? "opacity-50 border-red-200 bg-red-50 cursor-not-allowed" : !isUserAuthorizedToEdit ? "opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed" : "border-[var(--color-primary)]/20 cursor-pointer hover:bg-green-100"}`}
                            >
                              <input
                                type="checkbox"
                                checked={!ballMachineBelegt && hasBallMachine}
                                onChange={(e) => {
                                  if (!ballMachineBelegt) {
                                    setHasBallMachine(e.target.checked);
                                  }
                                }}
                                disabled={ballMachineBelegt || !isUserAuthorizedToEdit}
                                className="w-4 h-4 accent-[var(--color-primary)] relative top-px disabled:opacity-60 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span className="text-[10px] font-black text-[var(--color-primary)] uppercase flex items-center gap-1.5">
                                <i className="fa-solid fa-robot"></i>{" "}
                                Ballmaschine
                              </span>
                            </label>
                            {ballMachineBelegt && (
                              <p className="text-[8px] text-red-600 font-bold mt-1 uppercase tracking-wider leading-tight">
                                <i className="fa-solid fa-circle-exclamation mr-1"></i>{" "}
                                Belegt auf anderem Platz!
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {settings?.modules?.guests !== false && (
                        <div className="flex flex-col justify-end mt-2.5">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                            <i className="fa-solid fa-user-tag text-slate-400"></i>{" "}
                            Gastspieler
                          </label>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((num) => (
                              <button
                                key={num}
                                type="button"
                                disabled={!isUserAuthorizedToEdit}
                                onClick={() => setGuestCount(num)}
                                className={`flex-1 h-8 rounded-lg border-2 font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-1 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed ${guestCount === num ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"}`}
                              >
                                {num > 0 && (
                                  <i className="fa-solid fa-user text-[9px]"></i>
                                )}
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 mt-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <i className="fa-regular fa-comment-dots mr-1"></i>
                        Kommentar{" "}
                        <span className="opacity-70 normal-case tracking-normal">
                          (optional)
                        </span>
                      </label>
                      <input 
                        type="text"
                        value={comment}
                        disabled={!isUserAuthorizedToEdit}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="z. B. Vereinsmeisterschaft"
                        className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-all shadow-sm disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                      />
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Sticky Footer for Action Buttons */}
              <div className="px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0 space-y-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] z-10">
                {isUserAuthorizedToEdit ? (
                <div className="flex gap-2 w-full">
                  <button
                    onClick={confirmAction}
                    className={`w-full text-white rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-medium ${isLockMode ? "bg-slate-500 hover:bg-slate-600" : "hover:brightness-95"}`}
                    style={!isLockMode ? { backgroundColor: settings?.primaryColor || "var(--color-primary)" } : undefined}
                  >
                    <i
                      className={`fa-solid ${selectedSlot.editingId ? "fa-floppy-disk" : "fa-check-circle"} text-[12px]`}
                    ></i>
                    {selectedSlot.editingId
                      ? "Speichern"
                      : isLockMode
                        ? "Sperren"
                        : "Platz reservieren"}
                  </button>

                  {selectedSlot.editingId && (
                    <button
                      onClick={async () => {
                        const errorMsg = await onCancel(
                          selectedSlot.editingId!,
                        );
                        if (errorMsg) setError(errorMsg);
                        else handleCloseModal();
                      }}
                      className="px-4 shrink-0 bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5"
                      title="Buchung stornieren / Freigeben"
                    >
                      <i className="fa-solid fa-trash-can text-[11px]"></i>
                    </button>
                  )}
                </div>
                ) : (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                    <i className="fa-solid fa-circle-info text-slate-400 text-base mt-0.5"></i>
                    <span className="text-[11px] text-slate-500 font-sans font-semibold leading-relaxed">
                      Diese Reservierung kann nur vom Ersteller oder Admin bearbeitet werden.
                    </span>
                  </div>
                )}
              </div>
              </div>

              {/* League Booking Tab Content (Desktop) */}
              {bookingTab === "league" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-5 overflow-y-auto flex-1 bg-amber-50/50" style={{ isolation: "isolate" }}>
                    <div className="space-y-5">
                      
                      {/* Austragungsort Card with Facility Switcher */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                        <div className="h-24 w-full relative bg-slate-200 overflow-hidden">
                          <img
                            src={venuePhoto}
                            alt="Austragungsort Anlage"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end justify-between p-3">
                            <div className="text-white min-w-0 flex-1 pr-2">
                              <div className="text-[9px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5 leading-none mb-1">
                                <i className="fa-solid fa-location-dot"></i>
                                Austragungsort
                              </div>
                              <div className="text-xs font-black truncate drop-shadow-sm text-white">
                                {venueClubName}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-white flex items-center justify-between gap-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-slate-700 hover:text-[var(--color-primary)] flex items-center gap-1.5 min-w-0 transition-colors group cursor-pointer"
                            title="In Google Maps öffnen"
                          >
                            <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                            <span className="truncate">{displayAddress}</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400 group-hover:text-[var(--color-primary)] shrink-0 transition-colors"></i>
                          </a>
                        </div>
                      </div>

                      {/* Anlage wählen */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                          Anlage wählen
                        </label>
                        <div className="relative">
                          <select
                            value={currentFacilitySelectValue}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => handleSwitchFacility(e.target.value)}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {availableClubsList.map((c) => {
                              const cId = c.vereinsId || c.id;
                              return (
                                <option key={cId} value={cId} className="text-slate-800">
                                  {c.clubName || c.name || cId} {c.city ? `(${c.city})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                        </div>
                      </div>

                      {/* Platz wählen */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                          Platz wählen
                        </label>
                        <div className="relative">
                          <select
                            value={selectedCourtInModal}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setSelectedCourtInModal(e.target.value)}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {currentModalCourtOptions.map(({ name, isAvailable }) => (
                              <option
                                key={name}
                                value={name}
                                disabled={!isAvailable && name !== selectedCourtInModal}
                                className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                              >
                                {name} {!isAvailable ? '(belegt)' : ''}
                              </option>
                            ))}
                          </select>
                          <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                        </div>
                      </div>

                      {/* Zeitraum */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 shrink-0 shadow-sm">
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                            Ab
                          </label>
                          <select 
                            value={modalStartTime}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setModalStartTime(newStart);
                              const startIdx = TIME_SLOTS.indexOf(newStart);
                              if (startIdx >= 0) {
                                let maxEndIdx = TIME_SLOTS.length - 1;
                              if (selectedSlot?.date && reservationRules?.openingHours) {
                                const weekday = new Date(selectedSlot.date).getDay();
                                const dayRule = reservationRules.openingHours[String(weekday)];
                                if (dayRule && dayRule.end && !dayRule.closed) {
                                  const idx = TIME_SLOTS.indexOf(dayRule.end);
                                  if (idx !== -1) maxEndIdx = idx;
                                }
                              }
                              const endIdx = Math.min(maxEndIdx, startIdx + 2);
                              setEndTime(TIME_SLOTS[endIdx]);
                              }
                            }}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {TIME_SLOTS.slice(0, -1).map((t) => (
                              <option key={t} value={t}>{t} Uhr</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                            Bis (2 - 3 Std.)
                          </label>
                          <select 
                            value={endTime}
                            disabled={!isUserAuthorizedToEdit}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium"
                          >
                            {leagueEndTimeOptions.map((t) => {
                              const dur = getDurationInHours(modalStartTime, t);
                              return (
                                <option key={t} value={t}>
                                  {t} Uhr ({dur.toFixed(dur % 1 === 0 ? 0 : 1)} Std.)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Validation Warning for Duration */}
                      {currentLeagueDuration > 0 && currentLeagueDuration < 2 && (
                        <div className="text-xs font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-3 py-2 rounded-xl flex items-center gap-2">
                          <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm shrink-0"></i>
                          <span>Mindestspieldauer für Ligaspiele: 2 Stunden (aktuell: {currentLeagueDuration.toFixed(1)} Std.).</span>
                        </div>
                      )}
                      {currentLeagueDuration > 3 && (
                        <div className="text-xs font-bold text-red-800 bg-red-100/90 border border-red-300 px-3 py-2 rounded-xl flex items-center gap-2">
                          <i className="fa-solid fa-circle-exclamation text-red-600 text-sm shrink-0"></i>
                          <span>Maximaldauer für Ligaspiele: 3 Stunden (aktuell: {currentLeagueDuration.toFixed(1)} Std.).</span>
                        </div>
                      )}

                      {/* League Opponent Search */}
                      <div className="space-y-4 mt-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                            {selectedSlot?.editingId ? "Spieler 1 (Ersteller)" : "Spieler 1 (Eingeloggt)"}
                          </label>
                          <div className="font-bold text-[13px] text-[var(--color-primary)] flex items-center gap-1.5">
                            <i className="fa-solid fa-user-check text-[var(--color-primary)]"></i>
                            {spieler1Name}
                          </div>
                        </div>
                        <div className="space-y-2.5 relative">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                            Gegner
                          </label>
                          {!leagueOpponent ? (
                            <div className="relative">
                              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs pointer-events-none"></i>
                              <input 
                                type="text"
                                value={leagueOpponentQuery}
                                disabled={!isUserAuthorizedToEdit}
                                onChange={(e) => setLeagueOpponentQuery(e.target.value)}
                                onFocus={() => setShowLeagueSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 250)}
                                placeholder="Gegner suchen (Name, Vorname...)"
                                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-sm transition-all shadow-sm disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            {showLeagueSuggestions && leagueOpponentQuery.trim().length > 0 && isUserAuthorizedToEdit && (
                              <div className="absolute top-full left-0 right-0 z-[120] mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-[190px] overflow-y-auto">
                                {getFilteredLeagueUsers(leagueOpponentQuery).length === 0 ? (
                                  <div className="p-3 text-xs text-slate-500 text-center font-medium">Keine passenden Spieler gefunden.</div>
                                ) : (
                                  getFilteredLeagueUsers(leagueOpponentQuery).map((u) => {
                                    const displayName = resolvePlayerDisplayName(u);
                                    const identifier = u.name || u.id;
                                    const clubBadge = u.vereinsId ? u.vereinsId.toUpperCase() : "";
                                    return (
                                      <button
                                        key={u.id || identifier}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setLeagueOpponent(identifier);
                                          setLeagueOpponentQuery("");
                                          setShowLeagueSuggestions(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-amber-50 font-bold text-slate-700 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3 truncate">
                                          <UserAvatar user={u} name={displayName} size="xs" className="shrink-0" />
                                          <span className="truncate">{displayName}</span>
                                        </div>
                                        {clubBadge && (
                                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                                            {clubBadge}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3 truncate">
                              <UserAvatar
                                user={selectedOpponentUser}
                                avatarUrl={selectedOpponentUser?.avatarUrl}
                                avatarIcon={selectedOpponentUser?.avatarIcon}
                                name={selectedOpponentUser ? resolvePlayerDisplayName(selectedOpponentUser) : formatPlayerName(leagueOpponent)}
                                size="sm"
                                className="shrink-0"
                              />
                              <span className="font-bold text-sm text-slate-800 truncate">
                                {selectedOpponentUser ? resolvePlayerDisplayName(selectedOpponentUser) : formatPlayerName(leagueOpponent)}
                              </span>
                            </div>
                            {isUserAuthorizedToEdit && (
                              <button
                                type="button"
                                onClick={() => setLeagueOpponent(null)}
                                className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm border border-slate-200 cursor-pointer shrink-0"
                              >
                                <i className="fa-solid fa-xmark text-sm"></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      </div>

                    </div>
                  </div>

                  <div className="px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0 space-y-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] z-10">
                    {isUserAuthorizedToEdit ? (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={handleLeagueSubmit}
                          className="w-full text-white rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-medium hover:brightness-95"
                          style={{ backgroundColor: settings?.primaryColor || "var(--color-primary)" }}
                        >
                          <i className="fa-solid fa-trophy text-[12px]"></i> Ligaspiel eintragen
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                        <i className="fa-solid fa-circle-info text-slate-400 text-base mt-0.5"></i>
                        <span className="text-[11px] text-slate-500 font-sans font-semibold leading-relaxed">
                          Diese Reservierung kann nur vom Ersteller oder Admin bearbeitet werden.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
            </div>
          </div>,
          document.body,
        )}

      {/* Public Calendar Login Modal Overlay */}
      {isPublicLoginModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 select-none">
          <div className="relative max-w-md w-full bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setIsPublicLoginModalOpen(false);
                setInlineLoginError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="text-center space-y-2 pt-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md text-white text-xl"
                style={{ backgroundColor: settings?.primaryColor || "var(--color-primary)" }}
              >
                {settings?.logoUrl || settings?.headerLogoUrl ? (
                  <img
                    src={settings?.headerLogoUrl || settings?.logoUrl}
                    alt="Logo"
                    className="w-9 h-9 object-contain"
                  />
                ) : (
                  <i className="fa-solid fa-right-to-bracket"></i>
                )}
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
                Vereins-Login
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Melde dich an, um Plätze zu reservieren und alle Details einzusehen.
              </p>
            </div>

            {inlineLoginError && (
              <div className="bg-rose-50 border-x-4 border-rose-500 text-rose-700 p-3 rounded-r-xl flex items-center gap-3 text-xs font-bold shadow-sm">
                <i className="fa-solid fa-circle-exclamation text-base shrink-0"></i>
                <span>{inlineLoginError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setInlineLoginError(null);
                setIsInlineLoggingIn(true);
                try {
                  const loggedInUser = await loginWithUsername(
                    inlineUsername,
                    inlinePassword,
                    settings?.id || "djk-furth"
                  );
                  setIsPublicLoginModalOpen(false);
                  if (onPublicLoginSuccess) {
                    onPublicLoginSuccess(loggedInUser);
                  }
                } catch (err: any) {
                  setInlineLoginError(
                    err.message || "Benutzername oder Passwort falsch."
                  );
                } finally {
                  setIsInlineLoggingIn(false);
                }
              }}
              className="space-y-4 pt-1"
            >
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Benutzername oder E-Mail
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inlineUsername}
                  onChange={(e) => setInlineUsername(e.target.value)}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  placeholder="z. B. max.mustermann"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  value={inlinePassword}
                  onChange={(e) => setInlinePassword(e.target.value)}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isInlineLoggingIn}
                style={{
                  backgroundColor:
                    settings?.primaryColor || "var(--color-primary)",
                }}
                className="w-full text-white hover:brightness-95 disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-black cursor-pointer"
              >
                {isInlineLoggingIn ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Anmeldung läuft...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket"></i>
                    <span>Anmelden</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
