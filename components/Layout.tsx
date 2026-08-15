import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RichTextRenderer } from "./RichText";
import { UserClub } from "../types";

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
  const [isClubDropdownOpen, setIsClubDropdownOpen] = useState(false);
  const clubDropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const availableClubs = useMemo(() => {
    const rawList = userClubs || user?.clubs || [];
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
  }, [userClubs, user?.clubs]);

  const showClubSwitcher = availableClubs.length > 1;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsClubDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsClubDropdownOpen(false);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        clubDropdownRef.current &&
        !clubDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClubDropdownOpen(false);
      }
    }
    if (isClubDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isClubDropdownOpen]);

  const getCleanClubName = (clubObj: any, fallbackName?: string) => {
    if (!clubObj) return fallbackName || "Verein";

    const candidates = [
      clubObj.name,
      clubObj.shortName,
      clubObj.abbreviation,
      clubObj.clubName,
      clubObj.vereinsName,
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
              <span className="font-bold text-lg leading-none" style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}>
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
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentVereinsId || logoUrl || clubName}
                  layout
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{
                    layout: { duration: 0.3, ease: "easeInOut" },
                    opacity: { duration: 0.2, ease: "easeInOut" },
                    y: { duration: 0.2, ease: "easeInOut" }
                  }}
                  onClick={onLogoClick}
                  className="flex items-center gap-2 sm:gap-3 shrink-0 max-w-[150px] sm:max-w-[180px] md:max-w-[200px] min-w-0 cursor-pointer hover:opacity-90 transition-all duration-300 ease-in-out"
                >
                  <img
                    src={logoUrl}
                    alt={`${clubName} Logo`}
                    className="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow-lg shrink-0"
                  />
                  <div className="text-white drop-shadow-2xl truncate min-w-0">
                    <h2
                      className="text-xs sm:text-sm md:text-base font-bold tracking-tight leading-none truncate max-w-[200px]"
                      style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
                      title={clubName}
                    >
                      {clubName}
                    </h2>
                  </div>
                </motion.div>
              </AnimatePresence>
              {desktopNav && (
                <div className="flex items-center min-w-0 transition-all duration-300 ease-in-out">{desktopNav}</div>
              )}
            </div>

            {/* Compact Greeting & Control Buttons inside the Banner */}
            <div className="flex items-center justify-end drop-shadow-lg text-white select-none shrink-0 gap-3 ml-auto transition-all duration-300 ease-in-out">
              {/* Desktop: Unified Pill Container for Account, Profile and Help - identical to left Nav Bar styling */}
              <div className="hidden lg:flex bg-white/10 p-0.5 rounded-full shadow-sm gap-0.5 w-auto backdrop-blur-sm border border-white/10 relative items-center transition-all duration-300 ease-in-out">
                {/* Account Name */}
                <div 
                  className="flex items-center gap-1.5 py-1 px-3 text-[10px] font-medium tracking-wide rounded-full text-white/90 transition-all duration-300 ease-in-out"
                  title={
                    user.klarname ||
                    user.displayName ||
                    (user.firstName || user.lastName
                      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                      : user.name)
                  }
                >
                  <i className="fa-solid fa-circle-user text-white/80 text-[10.5px] shrink-0"></i>
                  <span className="truncate">
                    {user.klarname ||
                      user.displayName ||
                      (user.firstName || user.lastName
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                        : user.name)}
                  </span>
                </div>

                {/* Club Switcher Badge - ONLY rendered for multi-club members (user.clubs.length > 1) */}
                {showClubSwitcher && onSwitchClub && (
                  <>
                    <div className="w-[1px] h-3 bg-white/15 mx-0.5 shrink-0" />
                    <div
                      className="relative transition-all duration-300 ease-in-out"
                      ref={clubDropdownRef}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        onClick={() => setIsClubDropdownOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 py-1 px-2 text-[10px] tracking-wide rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-all duration-300 ease-in-out cursor-pointer outline-none active:scale-95"
                        title="Verein wechseln"
                      >
                        <i className="fa-solid fa-building-columns text-[10px] text-white/80 shrink-0"></i>
                        <span className="max-w-[200px] truncate font-bold inline-flex items-center">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={activeClubName}
                              initial={{ opacity: 0, y: -2 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 2 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="truncate max-w-[200px] inline-block"
                            >
                              {activeClubName}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[8.5px] transition-transform duration-200 shrink-0 ${isClubDropdownOpen ? "rotate-180" : ""}`}></i>
                      </button>

                      <AnimatePresence>
                        {isClubDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.97 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute right-0 top-full pt-1.5 w-56 z-[100] select-none"
                          >
                            <div className="bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 py-1.5 overflow-hidden">
                              <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 flex items-center justify-between">
                                <span>Verein wechseln</span>
                                <i className="fa-solid fa-arrow-right-arrow-left text-[9px] text-[var(--color-primary)]"></i>
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
                                        setIsClubDropdownOpen(false);
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
                  </>
                )}

                {/* Vertical Divider */}
                <div className="w-[1px] h-3 bg-white/15 mx-0.5" />

                {onShowProfile && (
                  <button
                    onClick={onShowProfile}
                    className="flex items-center justify-center py-1 px-3 text-[10px] font-medium tracking-wide rounded-full transition-colors cursor-pointer outline-none text-white/70 hover:text-white hover:bg-white/10"
                    title="Mein Profil"
                  >
                    <i className="fa-solid fa-user-gear text-[11px]"></i>
                  </button>
                )}
                {onShowHelp && (
                  <button
                    onClick={onShowHelp}
                    className="flex items-center justify-center py-1 px-3 text-[10px] font-medium tracking-wide rounded-full transition-colors cursor-pointer outline-none text-white/70 hover:text-white hover:bg-white/10"
                    title="Hilfe & Funktionen"
                  >
                    <i className="fa-solid fa-circle-question text-[11px]"></i>
                  </button>
                )}
              </div>

              {/* Mobile Fallback for Account/Profile/Help */}
              <div className="flex lg:hidden items-center gap-1">
                <div className="text-[9px] font-medium tracking-wide flex items-center gap-1 text-white/95 bg-white/10 px-4 py-1 rounded-md border border-white/10 backdrop-blur-sm w-auto">
                  <i className="fa-solid fa-circle-user text-white/80 text-[10px]"></i>
                  <span className="truncate">
                    {user.klarname ||
                      user.displayName ||
                      (user.firstName || user.lastName
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                        : user.name)}
                  </span>
                </div>
                {onShowProfile && (
                  <button
                    onClick={onShowProfile}
                    className="bg-white/10 hover:bg-white/20 transition-all p-1 rounded-lg text-white border border-white/15 active:scale-95 shadow-sm flex items-center justify-center backdrop-blur-sm text-xs font-medium h-7 w-7"
                    title="Mein Profil"
                  >
                    <i className="fa-solid fa-user-gear text-[10px]"></i>
                  </button>
                )}
                {onShowHelp && (
                  <button
                    onClick={onShowHelp}
                    className="bg-white/10 hover:bg-white/20 transition-all p-1 rounded-lg text-white border border-white/15 active:scale-95 shadow-sm flex items-center justify-center backdrop-blur-sm text-xs font-medium h-7 w-7"
                    title="Hilfe & Funktionen"
                  >
                    <i className="fa-solid fa-circle-question text-[10px]"></i>
                  </button>
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="bg-[var(--color-accent)] hover:bg-[color-mix(in srgb, var(--color-accent) 80%, black)] transition-all px-3 h-7 lg:h-[26px] rounded-lg text-white border border-white/20 active:scale-95 shadow-sm flex items-center justify-center gap-1.5 text-[10px] font-medium tracking-wide shrink-0"
                title="Abmelden"
              >
                <span className="hidden xl:inline">Abmelden</span>
                <i className="fa-solid fa-right-from-bracket text-[10px]"></i>
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
