import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  CircleUser,
  UserCog,
  HelpCircle,
  LogOut,
  ArrowLeftRight,
  Check,
} from "lucide-react";
import { RichTextRenderer } from "./RichText";
import { UserClub } from "../types";
import { getUserClubs } from "../lib/userUtils";
import { UserAvatar } from "./UserAvatar";

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
  onShowHelp?: () => void;
  onShowImpressum?: () => void;
  onShowProfile?: () => void;
  news?: string;
  clubName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  bannerPosition?: string;
  primaryColor?: string;
  websiteUrl?: string;
  hideWebsiteLink?: boolean;
  impressum?: string;
  desktopNav?: React.ReactNode;
  isPublicWochenplanRoute?: boolean;
  onLogoClick?: () => void;
  userClubs?: UserClub[];
  currentVereinsId?: string;
  onSwitchClub?: (vereinsId: string) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  onLogout,
  onShowHelp,
  onShowImpressum,
  onShowProfile,
  news,
  clubName = "Tennis-Club",
  logoUrl = "https://lirp.cdn-website.com/236a6a55/dms3rep/multi/opt/Wappen-1920w.jpg",
  bannerUrl = "https://lirp.cdn-website.com/236a6a55/dms3rep/multi/opt/banner_platzreservierung_1-1920w.png",
  bannerPosition = "50% 50%",
  primaryColor = "var(--color-primary)",
  websiteUrl = "https://www.tennis-club.local",
  hideWebsiteLink = false,
  impressum,
  desktopNav,
  isPublicWochenplanRoute,
  onLogoClick,
  userClubs,
  currentVereinsId,
  onSwitchClub,
}) => {
  const clubUrl = websiteUrl;
  const [isTopLeftDropdownOpen, setIsTopLeftDropdownOpen] = useState(false);
  const topLeftDropdownRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<any>(null);

  const handleDropdownMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (showClubSwitcher) {
      setIsTopLeftDropdownOpen(true);
    }
  };

  const handleDropdownMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsTopLeftDropdownOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const availableClubs = useMemo(() => {
    const rawList = userClubs && userClubs.length > 0
      ? userClubs
      : getUserClubs(user);
    if (!Array.isArray(rawList)) return [];

    const uniqueSet = new Set<string>();
    const filteredClubs: any[] = [];

    rawList.forEach((c: any) => {
      if (!c) return;
      const rawId = typeof c === "string" ? c : (c.vereinsId || c.id);
      if (!rawId) return;

      const normId = String(rawId).trim().toLowerCase().replace(/\s/g, "");
      if (!normId || ["super-admin", "system"].includes(normId)) return;

      if (!uniqueSet.has(normId)) {
        uniqueSet.add(normId);
        const nameVal = typeof c === "object" ? (c.clubName || c.vereinsName || c.name) : undefined;
        filteredClubs.push({
          ...(typeof c === "object" ? c : {}),
          id: rawId,
          vereinsId: rawId,
          clubName: nameVal || rawId,
          type: "club",
          is_tenant: true,
        });
      }
    });

    return filteredClubs.sort((a: any, b: any) => {
      const nameA = String(a.clubName || a.name || a.id || "").toLowerCase();
      const nameB = String(b.clubName || b.name || b.id || "").toLowerCase();
      return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
    });
  }, [userClubs, user]);

  const showClubSwitcher = availableClubs.length > 1 && !!onSwitchClub;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        topLeftDropdownRef.current &&
        !topLeftDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTopLeftDropdownOpen(false);
      }
    }
    if (isTopLeftDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTopLeftDropdownOpen]);

  const getCleanClubName = (clubObj: any, fallbackName?: string) => {
    if (!clubObj) return fallbackName || "Verein";

    const candidates = [
      clubObj.clubName,
      clubObj.vereinsName,
      clubObj.name,
      clubObj.shortName,
      clubObj.abbreviation,
      clubObj.title,
      clubObj.displayName,
    ];

    for (const cand of candidates) {
      if (typeof cand === "string" && cand.trim()) {
        const trimmed = cand.trim();
        if (!["api", "default", "system", "super-admin"].includes(trimmed.toLowerCase())) {
          return trimmed;
        }
      }
    }

    if (fallbackName && typeof fallbackName === "string") {
      const trimmedFallback = fallbackName.trim();
      if (!["api", "default", "system", "super-admin"].includes(trimmedFallback.toLowerCase())) {
        return trimmedFallback;
      }
    }

    const vId = clubObj.vereinsId || clubObj.id;
    if (typeof vId === "string" && vId.trim()) {
      const trimmedVId = vId.trim();
      if (!["api", "default", "system", "super-admin"].includes(trimmedVId.toLowerCase())) {
        return trimmedVId;
      }
    }

    return "Verein";
  };

  // Find active club name
  const activeClubObj = availableClubs.find((c: any) => {
    const cId = String(c.vereinsId || c.id || "").toLowerCase().replace(/\s/g, "");
    const curId = String(currentVereinsId || "").toLowerCase().replace(/\s/g, "");
    return cId === curId;
  });
  const activeClubName = getCleanClubName(activeClubObj, clubName);

  if (isPublicWochenplanRoute) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-100 w-full font-sans text-slate-900">
        {/* Clean Static Header */}
        <header
          className="w-full h-14 relative shadow-md shrink-0 z-[60] text-white flex items-center px-4 md:px-6"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${clubName} Logo`}
                className="w-8 h-8 object-contain drop-shadow-lg shrink-0 animate-in fade-in zoom-in duration-200"
              />
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-[15.5pt] leading-none" style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}>
                {clubName}
              </span>
              <span className="text-sm font-semibold text-white/90">
                – Platzbuchung
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col w-full px-4 pt-4 pb-6 md:px-6 md:pt-6 md:pb-6 lg:px-4 lg:pt-4 lg:pb-4 overflow-x-hidden">
          <div className="max-w-[1600px] w-full mx-auto flex-grow flex flex-col">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 w-full font-sans text-slate-900">
      {/* Super Compact Club Banner Section */}
      <div
        className="hidden lg:block w-full h-12 md:h-14 relative shadow-md border-b-[3px] border-[var(--color-accent)] shrink-0 z-[60]"
        style={{ backgroundColor: primaryColor }}
      >
        {/* Background media and overlays contained inside a clipped viewport */}
        <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentVereinsId || bannerUrl || primaryColor}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <img
                src={bannerUrl}
                alt={`${clubName} Anlage`}
                className="w-full h-full object-cover"
                style={{ objectPosition: bannerPosition }}
              />
              {/* Gradient overlay for text readability */}
              <div
                className="absolute inset-0 bg-gradient-to-r"
                style={{
                  backgroundImage: `linear-gradient(to right, ${primaryColor}F2, ${primaryColor}E6, ${primaryColor}80, transparent)`,
                }}
              ></div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute inset-0 flex items-center px-4 md:px-6 z-20">
          <div className="flex items-center justify-between w-full gap-4 transition-all duration-300 ease-in-out">
            <div className="flex items-center gap-4 min-w-0 shrink transition-all duration-300 ease-in-out">
              <motion.div
                ref={topLeftDropdownRef}
                layout
                transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
                className="relative flex items-center shrink-0 transition-all duration-300 ease-in-out"
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                <div 
                  onClick={() => {
                    if (showClubSwitcher && onSwitchClub) {
                      setIsTopLeftDropdownOpen((prev) => !prev);
                    } else if (onLogoClick) {
                      onLogoClick();
                    }
                  }}
                  className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer hover:opacity-80 transition-all duration-300 ease-in-out select-none"
                  title={showClubSwitcher ? "Verein wechseln" : clubName}
                >
                  <img
                    src={logoUrl}
                    alt={`${clubName} Logo`}
                    className="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow-lg shrink-0 transition-all duration-300 ease-in-out"
                  />
                  <div className="text-white drop-shadow-2xl truncate min-w-0 flex items-center gap-1.5 transition-all duration-300 ease-in-out">
                    <h2
                      className="text-sm sm:text-base md:text-[14pt] font-bold tracking-tight leading-none truncate max-w-[200px] sm:max-w-[240px] md:max-w-[280px] transition-all duration-300 ease-in-out"
                      style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
                      title={clubName}
                    >
                      {clubName}
                    </h2>
                    {showClubSwitcher && (
                      <ChevronDown className={`w-3.5 h-3.5 text-white/80 transition-transform duration-200 shrink-0 ${isTopLeftDropdownOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
                    )}
                  </div>
                </div>

                {/* Top-Left Club Switcher Dropdown */}
                <AnimatePresence>
                  {showClubSwitcher && isTopLeftDropdownOpen && onSwitchClub && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute left-0 top-full pt-1.5 w-60 z-[100] select-none text-slate-800"
                    >
                      <div className="bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 py-1.5 overflow-hidden">
                        <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 flex items-center justify-between">
                          <span>Verein wechseln</span>
                          <ArrowLeftRight className="w-3 h-3 text-[var(--color-primary)]" strokeWidth={1.8} />
                        </div>
                        <div className="py-1 max-h-60 overflow-y-auto hide-scrollbar">
                          {availableClubs.map((club: any) => {
                            const clubId = club.id || club.vereinsId;
                            const clubNameDisplay = getCleanClubName(club, clubName);
                            const targetVereinsId = club.vereinsId || club.id;
                            const isActive = targetVereinsId === currentVereinsId || String(targetVereinsId).toLowerCase().replace(/\s/g, "") === String(currentVereinsId).toLowerCase().replace(/\s/g, "");
                            return (
                              <button
                                key={clubId}
                                onClick={() => {
                                  onSwitchClub(targetVereinsId);
                                  setIsTopLeftDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                  isActive
                                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                                    : "text-slate-700 hover:bg-slate-50 font-medium"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-[var(--color-primary)]" : "bg-slate-300"}`} />
                                  <span className="truncate">{clubNameDisplay}</span>
                                </div>
                                {isActive && (
                                  <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" strokeWidth={2} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {desktopNav && (
                <motion.div 
                  layout 
                  transition={{ layout: { duration: 0.3, ease: "easeInOut" } }} 
                  className="flex items-center min-w-0 transition-all duration-300 ease-in-out"
                >
                  {desktopNav}
                </motion.div>
              )}
            </div>

            {/* Compact Greeting & Control Buttons inside the Banner */}
            <div className="flex items-center justify-end drop-shadow-lg text-white select-none shrink-0 gap-3 ml-auto transition-all duration-300 ease-in-out">
              {/* Desktop: Unified Pill Container for Account, Profile and Help - identical to left Nav Bar styling */}
              {(() => {
                const headerDisplayName = (user.firstName && user.lastName)
                  ? `${user.firstName} ${user.lastName}`
                  : (user.firstName || user.lastName)
                    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                    : (user.displayName || user.username || user.klarname || user.name);

                return (
                  <>
                    <div className="hidden lg:flex bg-white/10 py-0.5 pl-1 pr-1.5 rounded-full shadow-sm gap-1 w-auto backdrop-blur-sm border border-white/10 relative items-center h-8 transition-all duration-300 ease-in-out">
                      {/* Interactive Profile Button (Avatar + Name) */}
                      {onShowProfile ? (
                        <button
                          type="button"
                          onClick={onShowProfile}
                          className="flex items-center gap-2 pl-1 pr-2.5 h-[26px] text-[10px] font-medium tracking-wide rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer outline-none select-none group"
                          title="Mein Profil bearbeiten"
                        >
                          <UserAvatar user={user} size="xs" showBorder borderColor="border-white/40" />
                          <span className="truncate max-w-[120px] group-hover:text-white">
                            {headerDisplayName}
                          </span>
                        </button>
                      ) : (
                        <div 
                          className="flex items-center gap-2 pl-1 pr-2.5 h-[26px] text-[10px] font-medium tracking-wide rounded-full text-white/90"
                          title={headerDisplayName}
                        >
                          <UserAvatar user={user} size="xs" showBorder borderColor="border-white/40" />
                          <span className="truncate max-w-[120px]">
                            {headerDisplayName}
                          </span>
                        </div>
                      )}

                      {/* Vertical Divider */}
                      {onShowHelp && <div className="w-[1px] h-3.5 bg-white/20 mx-0.5 shrink-0" />}

                      {/* Help Action */}
                      {onShowHelp && (
                        <button
                          type="button"
                          onClick={onShowHelp}
                          className="w-[26px] h-[26px] rounded-full flex items-center justify-center transition-colors cursor-pointer outline-none text-white/70 hover:text-white hover:bg-white/10 shrink-0"
                          title="Hilfe & Funktionen"
                        >
                          <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                    </div>

                    {/* Mobile Fallback for Account/Profile/Help */}
                    <div className="flex lg:hidden items-center gap-1">
                      <div className="text-[9px] font-medium tracking-wide flex items-center gap-1.5 text-white/95 bg-white/10 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-sm w-auto">
                        <UserAvatar user={user} size="xs" />
                        <span className="truncate max-w-[100px]">
                          {headerDisplayName}
                        </span>
                      </div>
                      {onShowProfile && (
                        <button
                          onClick={onShowProfile}
                          className="bg-white/10 hover:bg-white/20 transition-all p-1 rounded-lg text-white border border-white/15 active:scale-95 shadow-sm flex items-center justify-center backdrop-blur-sm text-xs font-medium h-7 w-7"
                          title="Mein Profil"
                        >
                          <UserCog className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                      {onShowHelp && (
                        <button
                          onClick={onShowHelp}
                          className="bg-white/10 hover:bg-white/20 transition-all p-1 rounded-lg text-white border border-white/15 active:scale-95 shadow-sm flex items-center justify-center backdrop-blur-sm text-xs font-medium h-7 w-7"
                          title="Hilfe & Funktionen"
                        >
                          <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="bg-[var(--color-accent)] hover:bg-[color-mix(in srgb, var(--color-accent) 80%, black)] transition-all px-4 h-7 lg:h-8 rounded-lg lg:rounded-full text-white border border-white/20 active:scale-95 shadow-sm flex items-center justify-center gap-1.5 text-[10px] font-medium tracking-wide shrink-0"
                title="Abmelden"
              >
                <span className="hidden xl:inline">Abmelden</span>
                <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {news && news.trim() !== "" && (
        <header
          className="sticky top-0 z-50 w-full"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {/* Centered Compact News Bar - Icon removed, Padding reduced */}
          <div className="w-full py-1.5 px-4 shadow-md flex justify-center items-center animate-in fade-in slide-in-from-top-2 duration-500">
            <p className="text-[9px] md:text-xs font-black uppercase tracking-wider text-white text-center w-full leading-tight">
              {news}
            </p>
          </div>
        </header>
      )}

      <main className="flex-grow flex flex-col w-full px-4 pt-4 pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:pb-4 md:px-6 md:pt-4 lg:px-4 lg:pt-4">
        <div className="max-w-[1600px] w-full mx-auto flex-grow flex flex-col min-h-0">{children}</div>
      </main>

      <footer
        className="hidden md:block py-2 text-center w-full border-t border-white/10 px-6"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
          <button
            onClick={onShowHelp}
            className="uppercase tracking-widest text-white/60 hover:text-[var(--color-accent-3)] transition-colors flex items-center gap-2 py-1 text-[10px] font-medium"
          >
            <i className="fa-solid fa-info-circle"></i> Hilfe & Funktionen
          </button>
          {!hideWebsiteLink && (
            <a
              href={clubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black uppercase tracking-[0.4em] text-white/40 hover:text-[var(--color-accent-3)] transition-colors text-[10px] flex items-center gap-2"
            >
              {clubName}{" "}
              <i className="fa-solid fa-external-link text-[9px]"></i>
            </a>
          )}
          <button
            onClick={onShowImpressum}
            className="uppercase tracking-widest text-white/60 hover:text-[var(--color-accent-3)] transition-colors flex items-center gap-2 py-1 text-[10px] font-medium"
          >
            <i className="fa-solid fa-scale-balanced"></i> Impressum
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
