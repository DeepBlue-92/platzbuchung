import React, { useState, useMemo, useEffect, useRef } from "react";
import { RankingState, User, RankingEntry, Role, Person } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { PlayerContactModal } from "./PlayerContactModal";

interface RankingProps {
  data: RankingState;
  users: Record<string, User>;
  currentUser: User;
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
  onUpdate,
}) => {
  const categories = data.categories || [];
  const defaultCategory = categories.length > 0 ? categories[0].id : "";
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  
  const [selectedContactUser, setSelectedContactUser] = useState<User | Person | null>(null);
  const [selectedContactRank, setSelectedContactRank] = useState<number | undefined>(undefined);

  const [isMobile, setIsMobile] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ transform: 'translateX(0px)', width: '0px', opacity: 0 });

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

  const filteredEntries = useMemo(() => {
    if (!currentCategory) return [];
    return currentCategory.entries;
  }, [currentCategory]);

  const pyramidData = useMemo(() => {
    if (!filteredEntries) return [];
    const rows: (RankingEntry | null)[][] = [];
    let currentIdx = 0;
    let rowSize = 1;

    while (currentIdx < filteredEntries.length) {
      const row: (RankingEntry | null)[] = [];
      for (let i = 0; i < rowSize; i++) {
        if (currentIdx < filteredEntries.length) {
          row.push(filteredEntries[currentIdx]);
          currentIdx++;
        } else {
          row.push(null);
        }
      }
      rows.push(row);
      rowSize++;
    }
    return rows;
  }, [filteredEntries]);

  const scalingFactor = useMemo(() => {
    if (!pyramidData || pyramidData.length === 0) return 1;
    let base = 1;
    if (isMobile) base = 0.85;
    return base;
  }, [pyramidData, isMobile]);

  if (!currentCategory) {
    return (
      <div className="w-full text-center p-10 text-slate-500 font-bold">
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
                <strong key={partIdx} className="font-black text-slate-700">
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
                className="text-[10px] md:text-xs font-normal text-slate-500 leading-relaxed marker:text-slate-400"
              >
                {formattedText}
              </li>
            );
          } else {
            return (
              <div
                key={idx}
                className="text-[10px] md:text-xs font-normal text-slate-500 leading-relaxed -ml-5"
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
        vereinsId: currentUser.vereinsId || "sv-neuhausen",
      });
      setSelectedContactRank(rank);
    }
  };

  return (
    <div className="space-y-4 lg:animate-in lg:fade-in lg:duration-500 w-full overflow-hidden">
      {categories.length > 1 && (
        <div className="flex justify-center">
          <div 
            ref={tabsRef}
            className="flex relative bg-slate-100 p-1 rounded-full border border-slate-200/60 w-full sm:w-auto"
          >
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  data-active={isActive}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative z-10 flex-1 sm:flex-none px-6 py-2 rounded-full text-[10px] uppercase tracking-wider transition-colors duration-200 whitespace-nowrap ${
                    isActive
                      ? "text-[var(--color-primary)] font-semibold"
                      : "text-slate-500 font-black hover:text-slate-700"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Pyramid/List Card */}
      <motion.div
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-white pt-6 pb-6 sm:pt-8 sm:pb-8 px-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col items-center w-full"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative z-10 w-full flex flex-col items-center gap-4"
          >
            {(currentCategory.layout || "pyramid") === "pyramid" ? (
            <div className="w-full flex-1 px-2 pb-4">
              {/* Desktop view */}
              <div className="hidden md:block w-full overflow-x-auto visual-scrollbar">
                <div
                  className="flex flex-col items-center gap-2 md:gap-3 w-full transition-all duration-300 origin-top min-w-max mx-auto py-2"
                  style={{ transform: `scale(${scalingFactor})` }}
                >
                  {pyramidData.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex justify-center gap-3 md:gap-4 w-full shrink-0"
                    >
                      {row.map((entry, colIndex) => {
                        if (!entry)
                          return (
                            <div
                              key={`empty-${rowIndex}-${colIndex}`}
                              className="w-[120px] md:w-[180px] invisible h-px shrink-0"
                            ></div>
                          );
                        const absoluteIdx =
                          pyramidData
                            .slice(0, rowIndex)
                            .reduce(
                              (acc, r) =>
                                acc + r.filter((x) => x !== null).length,
                              0,
                            ) +
                          row.slice(0, colIndex).filter((x) => x !== null)
                            .length;
                        const rankNum = absoluteIdx + 1;
                        const isFirst = absoluteIdx === 0;
                        const isSecond = absoluteIdx === 1;
                        const isThird = absoluteIdx === 2;
                        return (
                          <div
                            key={entry.id}
                            className="w-[120px] md:w-[180px] relative group flex flex-col items-center transition-all duration-300 shrink-0"
                          >
                            <div
                              className={`absolute -top-1.5 -left-1.5 w-5 h-5 md:w-6 md:h-6 text-[8px] md:text-[10px] rounded-lg flex items-center justify-center font-black z-20 shadow-sm border ${
                                isFirst
                                  ? "bg-amber-500 text-white border-amber-400"
                                  : isSecond
                                    ? "bg-slate-500 text-white border-slate-400"
                                    : isThird
                                      ? "bg-orange-500 text-white border-orange-400"
                                      : "bg-slate-200 text-slate-800 border-slate-300"
                              }`}
                            >
                              {rankNum}
                            </div>

                            <div
                              onClick={() => handleOpenContact(entry, rankNum)}
                              className={`
                              w-full px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl border transition-all relative overflow-visible cursor-pointer group-hover:shadow-md
                              ${
                                isFirst
                                  ? "bg-amber-50/70 border-amber-300 text-amber-950 shadow-sm"
                                  : isSecond
                                    ? "bg-slate-50 border-slate-300 text-slate-950 shadow-sm"
                                    : isThird
                                      ? "bg-orange-50/70 border-orange-300 text-orange-950 shadow-sm"
                                      : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                              }
                            `}
                            >
                              <div className="flex flex-col items-center py-0.5 min-w-0">
                                {isFirst && (
                                  <i className="fa-solid fa-crown text-amber-500 text-[8px] md:text-[10px] mb-0.5"></i>
                                )}
                                <span className="font-bold text-[10px] md:text-xs text-slate-800 truncate w-full text-center px-1 pb-0.5">
                                  {getUserDisplayName(entry.userName, users)}
                                </span>

                                {/* Contact Action Row */}
                                <div className="flex items-center justify-center mt-1 opacity-80 group-hover:opacity-100 transition">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenContact(entry, rankNum);
                                    }}
                                    className="text-[9px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold flex items-center gap-1"
                                    title="Kontakt & Profil"
                                  >
                                    <i className="fa-solid fa-address-book text-[8px]"></i> Kontakt
                                  </button>
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
                    <div key={rowIndex} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {rowIndex + 1}. Ebene
                        </span>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {row.map((entry, colIndex) => {
                          if (!entry) return null;
                          const absoluteIdx =
                            pyramidData
                              .slice(0, rowIndex)
                              .reduce(
                                (acc, r) =>
                                  acc + r.filter((x) => x !== null).length,
                                0,
                              ) +
                            row.slice(0, colIndex).filter((x) => x !== null)
                              .length;
                          const rankNum = absoluteIdx + 1;
                          const isFirst = absoluteIdx === 0;
                          const isSecond = absoluteIdx === 1;
                          const isThird = absoluteIdx === 2;

                          return (
                            <div
                              key={entry.id}
                              onClick={() => handleOpenContact(entry, rankNum)}
                              className={`
                                flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative overflow-visible cursor-pointer
                                ${
                                  isFirst
                                    ? "bg-amber-50/70 border-amber-300 text-amber-950 shadow-sm"
                                    : isSecond
                                      ? "bg-slate-50 border-slate-300 text-slate-950 shadow-sm"
                                      : isThird
                                        ? "bg-orange-50/70 border-orange-300 text-orange-950 shadow-sm"
                                        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                                }
                              `}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`
                                    w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border shrink-0
                                    ${
                                      isFirst
                                        ? "bg-amber-500 text-white border-amber-400"
                                        : isSecond
                                          ? "bg-slate-500 text-white border-slate-400"
                                          : isThird
                                            ? "bg-orange-500 text-white border-orange-400"
                                            : "bg-slate-200 text-slate-800 border-slate-300"
                                    }
                                  `}
                                >
                                  {rankNum}
                                </div>
                                <span className="font-bold text-xs text-slate-800 truncate">
                                  {getUserDisplayName(entry.userName, users)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenContact(entry, rankNum);
                                  }}
                                  className="text-[10px] px-2 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                                >
                                  <i className="fa-solid fa-address-book"></i> Kontakt
                                </button>
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
            <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 text-left">
              <div className="lg:col-span-3">
                <div className="w-full flex flex-col gap-2 px-2 lg:mt-[44px]">
                  {filteredEntries.map((entry, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => handleOpenContact(entry, index + 1)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-300 relative overflow-visible cursor-pointer
                          ${
                            isFirst
                              ? "bg-amber-50/70 border-amber-300 text-amber-950 shadow-sm"
                              : isSecond
                                ? "bg-slate-50 border-slate-300 text-slate-950 shadow-sm"
                                : isThird
                                  ? "bg-orange-50/70 border-orange-300 text-orange-950 shadow-sm"
                                  : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                          }
                        `}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`
                            w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[10px] md:text-xs font-black border shrink-0
                            ${
                              isFirst
                                ? "bg-amber-500 text-white border-amber-400"
                                : isSecond
                                  ? "bg-slate-500 text-white border-slate-400"
                                  : isThird
                                    ? "bg-orange-500 text-white border-orange-400"
                                    : "bg-slate-200 text-slate-800 border-slate-300"
                            }
                          `}
                          >
                            {index + 1}
                          </div>
                          <span className="font-bold text-xs text-slate-800 truncate">
                            {getUserDisplayName(entry.userName, users)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenContact(entry, index + 1);
                            }}
                            className="text-[10px] px-2 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                          >
                            <i className="fa-solid fa-address-book"></i> Kontakt
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredEntries.length === 0 && (
                    <div className="text-center text-slate-400 text-xs font-bold py-10 w-full">
                      In dieser Kategorie befinden sich aktuell keine Spieler.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 lg:border-l lg:border-slate-100 lg:pl-6 px-2 mt-4 lg:mt-0">
                <h4 className="text-sm font-black text-[var(--color-primary)] flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
                  <i className="fa-solid fa-circle-info"></i> Regeln
                </h4>
                {renderRulesContent(data.rules || defaultRules)}
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Rules Section */}
      {(currentCategory.layout || "pyramid") === "pyramid" && (
        <motion.div
          layout
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-sm relative"
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
