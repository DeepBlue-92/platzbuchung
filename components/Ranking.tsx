import React, { useState, useMemo, useEffect, useRef } from "react";
import { Medal } from "lucide-react";
import { RankingState, User, RankingEntry, Role, Person } from "../types";
import { ClubSettings } from "../services/db";
import { motion, AnimatePresence } from "motion/react";
import { PlayerContactModal } from "./PlayerContactModal";

interface RankingProps {
  data: RankingState;
  users: Record<string, User>;
  currentUser: User;
  settings?: ClubSettings;
  onUpdate?: (newData: RankingState) => void;
}

const defaultRules = `* Forderungsrecht innerhalb der gesamten Kategorie.
* Gewinnt der Forderer, übernimmt er den Platz des Geforderten.
* Alle nachfolgenden Spieler rutschen einen Platz nach unten.
* Die Rangliste wird regelmäßig vom Administrator aktualisiert.`;

const getUserObject = (
  rawName: string,
  users: Record<string, User> = {}
): User | null => {
  if (!rawName) return null;
  const trimmed = rawName.trim();

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
};

const getUserDisplayName = (
  rawName: string,
  users: Record<string, User> = {}
): string => {
  const u = getUserObject(rawName, users);
  if (u) {
    return (
      u.klarname ||
      `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
      u.name
    );
  }
  return rawName;
};

const RankingView: React.FC<RankingProps> = ({
  data,
  users,
  currentUser,
  settings,
}) => {
  const categories = data.categories || [];
  const defaultCategory = categories.length > 0 ? categories[0].id : "";
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [selectedContactUser, setSelectedContactUser] = useState<User | Person | null>(null);
  const [selectedContactRank, setSelectedContactRank] = useState<number | undefined>(undefined);

  const [isMobile, setIsMobile] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      categories.length > 0 &&
      !categories.find((c) => c.id === activeCategory)
    ) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const currentCategory =
    categories.find((c) => c.id === activeCategory) || categories[0];

  // View layout is determined globally by Vereins-Admin configuration (no player toggle)
  const viewLayout: "pyramid" | "list" = useMemo(() => {
    // 1. Club-wide setting in ClubSettings
    const globalMode =
      settings?.rankingViewMode || (settings as any)?.rankingDisplay;
    if (
      globalMode === "list" ||
      globalMode === "linear" ||
      globalMode === "table"
    ) {
      return "list";
    }
    if (globalMode === "pyramid") {
      return "pyramid";
    }

    // 2. RankingState global viewMode
    if (
      data.viewMode === "list" ||
      (data.viewMode as string) === "linear" ||
      (data.viewMode as string) === "table"
    ) {
      return "list";
    }
    if (data.viewMode === "pyramid") {
      return "pyramid";
    }

    // 3. Category-specific layout set by admin
    if (
      currentCategory?.layout === "linear" ||
      (currentCategory?.layout as string) === "list" ||
      (currentCategory?.layout as string) === "table"
    ) {
      return "list";
    }

    return "pyramid";
  }, [
    settings?.rankingViewMode,
    (settings as any)?.rankingDisplay,
    data.viewMode,
    currentCategory?.layout,
  ]);

  const rawEntries = useMemo(() => {
    if (!currentCategory) return [];
    return currentCategory.entries || [];
  }, [currentCategory]);

  const filteredEntries = useMemo(() => {
    if (!rawEntries) return [];
    if (!searchTerm.trim()) return rawEntries;
    const q = searchTerm.toLowerCase().trim();
    return rawEntries.filter((entry) => {
      const dispName = getUserDisplayName(entry.userName, users).toLowerCase();
      const rawN = (entry.userName || "").toLowerCase();
      return dispName.includes(q) || rawN.includes(q);
    });
  }, [rawEntries, searchTerm, users]);

  // Pyramid data structure (based on all raw entries)
  const pyramidData = useMemo(() => {
    const entriesToUse = rawEntries;
    if (!entriesToUse || entriesToUse.length === 0) return [];
    const rows: (RankingEntry | null)[][] = [];
    let currentIdx = 0;
    let rowSize = 1;

    while (currentIdx < entriesToUse.length) {
      const row: (RankingEntry | null)[] = [];
      for (let i = 0; i < rowSize; i++) {
        if (currentIdx < entriesToUse.length) {
          row.push(entriesToUse[currentIdx]);
          currentIdx++;
        } else {
          row.push(null);
        }
      }
      rows.push(row);
      rowSize++;
    }
    return rows;
  }, [rawEntries]);

  const scalingFactor = useMemo(() => {
    if (!pyramidData || pyramidData.length === 0) return 1;
    let base = 1;
    if (isMobile) base = 0.85;
    return base;
  }, [pyramidData, isMobile]);

  if (!currentCategory) {
    return (
      <div className="w-full text-center p-12 text-slate-500 font-bold bg-white rounded-2xl border border-slate-200 shadow-sm">
        Derzeit sind keine Ranglisten verfügbar.
      </div>
    );
  }

  const renderRulesContent = (markdownText: string) => {
    if (!markdownText) return null;
    const lines = markdownText.split("\n");
    return (
      <ul className="list-disc pl-5 space-y-2 pb-2">
        {lines.map((line, idx) => {
          let trimmed = line.trim();
          if (!trimmed) return null;

          let isBullet = false;
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            trimmed = trimmed.substring(2);
            isBullet = true;
          } else if (trimmed.startsWith("•")) {
            trimmed = trimmed.substring(1).trim();
            isBullet = true;
          }

          const parts = trimmed.split("**");
          const formattedText = parts.map((part, partIdx) => {
            if (partIdx % 2 === 1) {
              return (
                <strong key={partIdx} className="font-black text-slate-800">
                  {part}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <li
                key={idx}
                className="text-xs font-medium text-slate-600 leading-relaxed marker:text-slate-400"
              >
                {formattedText}
              </li>
            );
          } else {
            return (
              <div
                key={idx}
                className="text-xs font-medium text-slate-600 leading-relaxed -ml-5"
              >
                {formattedText}
              </div>
            );
          }
        })}
      </ul>
    );
  };

  const handleOpenContact = (entry: RankingEntry, rank: number) => {
    const u = getUserObject(entry.userName, users);
    if (u) {
      setSelectedContactUser(u);
      setSelectedContactRank(rank);
    } else {
      setSelectedContactUser({
        id: entry.id,
        name: entry.userName,
        firstName: entry.userName,
        lastName: "",
        gender: "m",
        showContactInfo: false,
        role: Role.MITGLIED,
        vereinsId: settings?.vereinsId || settings?.id || currentUser.vereinsId || "sv-neuhausen",
      });
      setSelectedContactRank(rank);
    }
  };

  const isEntryCurrentUser = (entry: RankingEntry): boolean => {
    if (!currentUser) return false;
    const u = getUserObject(entry.userName, users);
    if (u && u.id === currentUser.id) return true;
    const eLower = (entry.userName || "").toLowerCase().trim();
    return (
      eLower === (currentUser.name || "").toLowerCase().trim() ||
      eLower === (currentUser.klarname || "").toLowerCase().trim() ||
      eLower === `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.toLowerCase().trim()
    );
  };

  return (
    <div className="space-y-4 lg:space-y-5 lg:animate-in lg:fade-in lg:duration-500 w-full overflow-hidden">
      
      {/* 1. TOP HEADER & CATEGORY TABS (LIGHT MODE) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)] shrink-0">
              <Medal className="w-5 h-5 text-[var(--color-primary)]" strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                  Rangliste
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
                Aktuelle Platzierungen im Überblick
              </p>
            </div>
          </div>

          {/* Search Bar (No player layout toggle button) */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Spieler suchen..."
                className="pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] w-44 sm:w-56 transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Suche zurücksetzen"
                >
                  <i className="fa-solid fa-circle-xmark text-xs"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <div className="pt-2 border-t border-slate-100">
            <div
              ref={tabsRef}
              className="flex relative bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full overflow-x-auto md:overflow-hidden no-scrollbar scrollbar-none gap-1"
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`relative z-10 flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                      isActive
                        ? "text-slate-900 font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="rankingCategoryActiveTab"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200 pointer-events-none"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN CONTENT CARD (Pyramid or List - strictly Light Mode) */}
      <div className="bg-white pt-6 pb-6 sm:pt-8 sm:pb-8 px-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col items-center w-full min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${viewLayout}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="relative z-10 w-full flex flex-col items-center gap-4"
          >
            {viewLayout === "pyramid" ? (
              /* PYRAMID LAYOUT */
              <div className="w-full flex-1 px-2 pb-4">
                {/* Desktop View */}
                <div className="hidden md:block w-full overflow-x-auto no-scrollbar scrollbar-none">
                  <div
                    className="flex flex-col items-center gap-2 md:gap-2.5 w-full transition-transform duration-300 origin-top min-w-max mx-auto py-1"
                    style={{ transform: `scale(${scalingFactor})` }}
                  >
                    {pyramidData.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="flex justify-center gap-2 md:gap-2.5 w-full shrink-0"
                      >
                        {row.map((entry, colIndex) => {
                          if (!entry)
                            return (
                              <div
                                key={`empty-${rowIndex}-${colIndex}`}
                                className="w-[125px] md:w-[180px] invisible h-px shrink-0"
                              ></div>
                            );
                          const absoluteIdx =
                            pyramidData
                              .slice(0, rowIndex)
                              .reduce(
                                (acc, r) =>
                                  acc + r.filter((x) => x !== null).length,
                                0
                              ) +
                            row.slice(0, colIndex).filter((x) => x !== null).length;
                          const rankNum = absoluteIdx + 1;
                          const isFirst = absoluteIdx === 0;
                          const isSecond = absoluteIdx === 1;
                          const isThird = absoluteIdx === 2;
                          const isCurrent = isEntryCurrentUser(entry);
                          const displayName = getUserDisplayName(entry.userName, users);

                          const isSearchHit =
                            searchTerm.trim() &&
                            displayName.toLowerCase().includes(searchTerm.toLowerCase().trim());

                          return (
                            <div
                              key={entry.id}
                              className={`w-[125px] md:w-[180px] relative group flex flex-col items-center transition-all duration-300 shrink-0 ${
                                searchTerm.trim() && !isSearchHit ? "opacity-35 scale-95" : ""
                              }`}
                            >
                              {/* Rank Badge */}
                              <div
                                className={`absolute -top-1.5 -left-1.5 w-5.5 h-5.5 md:w-6 md:h-6 text-[8.5px] md:text-[10px] rounded-lg flex items-center justify-center font-black z-20 shadow-xs border ${
                                  isFirst
                                    ? "bg-amber-400 text-amber-950 border-amber-300 ring-2 ring-amber-400/30"
                                    : isSecond
                                    ? "bg-slate-200 text-slate-800 border-slate-300"
                                    : isThird
                                    ? "bg-amber-600 text-white border-amber-500"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {rankNum}
                              </div>

                              <div
                                onClick={() => handleOpenContact(entry, rankNum)}
                                className={`
                                  w-full px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border transition-all relative overflow-visible cursor-pointer hover:shadow-md active:scale-[0.98]
                                  ${
                                    isCurrent
                                      ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/30 shadow-xs"
                                      : isFirst
                                      ? "bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs"
                                      : isSecond
                                      ? "bg-slate-50 border-slate-200 text-slate-900 shadow-xs"
                                      : isThird
                                      ? "bg-orange-50/70 border-orange-200 text-orange-950 shadow-xs"
                                      : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
                                  }
                                `}
                              >
                                <div className="flex flex-col items-center justify-center min-h-[30px] md:min-h-[34px] min-w-0">
                                  {isFirst && (
                                    <i className="fa-solid fa-crown text-amber-500 text-[9px] mb-0.5"></i>
                                  )}
                                  <div className="flex items-center justify-center gap-1 w-full px-1">
                                    <span className="font-bold text-xs md:text-sm text-slate-800 truncate text-center leading-snug">
                                      {displayName}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[7.5px] bg-emerald-600 text-white px-1 py-0.2 rounded font-black tracking-wider uppercase shrink-0">
                                        DU
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden w-full space-y-4">
                  {pyramidData.map((row, rowIndex) => {
                    const activeEntries = row.filter((x): x is RankingEntry => x !== null);
                    if (activeEntries.length === 0) return null;

                    return (
                      <div key={rowIndex} className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {rowIndex + 1}. Ebene
                          </span>
                          <div className="h-px flex-1 bg-slate-100"></div>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5">
                          {row.map((entry, colIndex) => {
                            if (!entry) return null;
                            const absoluteIdx =
                              pyramidData
                                .slice(0, rowIndex)
                                .reduce(
                                  (acc, r) =>
                                    acc + r.filter((x) => x !== null).length,
                                  0
                                ) +
                              row.slice(0, colIndex).filter((x) => x !== null).length;
                            const rankNum = absoluteIdx + 1;
                            const isFirst = absoluteIdx === 0;
                            const isSecond = absoluteIdx === 1;
                            const isThird = absoluteIdx === 2;
                            const isCurrent = isEntryCurrentUser(entry);
                            const displayName = getUserDisplayName(entry.userName, users);

                            return (
                              <div
                                key={entry.id}
                                onClick={() => handleOpenContact(entry, rankNum)}
                                className={`
                                  flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 relative overflow-visible cursor-pointer active:scale-[0.99]
                                  ${
                                    isCurrent
                                      ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-1 ring-emerald-500 shadow-xs"
                                      : isFirst
                                      ? "bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs"
                                      : isSecond
                                      ? "bg-slate-50 border-slate-200 text-slate-900 shadow-xs"
                                      : isThird
                                      ? "bg-orange-50/70 border-orange-200 text-orange-950 shadow-xs"
                                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-xs"
                                  }
                                `}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`
                                      w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border shrink-0
                                      ${
                                        isFirst
                                          ? "bg-amber-400 text-amber-950 border-amber-300"
                                          : isSecond
                                          ? "bg-slate-200 text-slate-800 border-slate-300"
                                          : isThird
                                          ? "bg-orange-500 text-white border-orange-400"
                                          : "bg-slate-100 text-slate-700 border-slate-200"
                                      }
                                    `}
                                  >
                                    {rankNum}
                                  </div>
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-bold text-xs text-slate-800 truncate">
                                      {displayName}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[7.5px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                                        DU
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* MODERN TABLE / LIST LAYOUT (strictly Light Mode) */
              <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 text-left">
                <div className="lg:col-span-3 space-y-2">
                  {filteredEntries.map((entry, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    const isCurrent = isEntryCurrentUser(entry);
                    const displayName = getUserDisplayName(entry.userName, users);

                    return (
                      <div
                        key={entry.id}
                        onClick={() => handleOpenContact(entry, index + 1)}
                        className={`
                          w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-200 relative overflow-visible cursor-pointer select-none
                          ${
                            isCurrent
                              ? "bg-emerald-50/70 border-emerald-400 text-emerald-950 ring-1 ring-emerald-500/40 shadow-sm"
                              : isFirst
                              ? "bg-amber-50/70 border-amber-300 text-amber-950 shadow-2xs"
                              : isSecond
                              ? "bg-slate-50 border-slate-200 text-slate-900 shadow-2xs"
                              : isThird
                              ? "bg-orange-50/60 border-orange-200 text-orange-950 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`
                              w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center text-xs font-black border shrink-0
                              ${
                                isFirst
                                  ? "bg-amber-400 text-amber-950 border-amber-300 shadow-2xs"
                                  : isSecond
                                  ? "bg-slate-200 text-slate-800 border-slate-300 shadow-2xs"
                                  : isThird
                                  ? "bg-orange-500 text-white border-orange-400 shadow-2xs"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }
                            `}
                          >
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-xs md:text-sm text-slate-800 truncate">
                              {displayName}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                                DU
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredEntries.length === 0 && (
                    <div className="text-center text-slate-400 text-xs font-bold py-10 w-full">
                      {searchTerm ? `Keine Spieler für "${searchTerm}" gefunden.` : "In dieser Kategorie befinden sich aktuell keine Spieler."}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 lg:border-l lg:border-slate-100 lg:pl-5 px-2 mt-4 lg:mt-0">
                  <h4 className="text-sm font-black text-[var(--color-primary)] flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <i className="fa-solid fa-circle-info"></i> Regeln der Rangliste
                  </h4>
                  {renderRulesContent(data.rules || defaultRules)}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3. RULES CARD (for Pyramid view - strictly Light Mode) */}
      {viewLayout === "pyramid" && (
        <motion.div
          layout
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative"
        >
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black text-[var(--color-primary)] flex items-center gap-2">
              <i className="fa-solid fa-circle-info"></i> Regeln der Rangliste
            </h4>
          </div>

          {renderRulesContent(data.rules || defaultRules)}
        </motion.div>
      )}

      {/* Modals */}
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
    </div>
  );
};

export default RankingView;
