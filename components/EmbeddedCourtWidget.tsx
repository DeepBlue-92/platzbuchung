import React, { useState, useMemo, useEffect, useRef } from "react";
import { User, Booking } from "../types";
import {
  Calendar,
  Lock,
  Plus,
  LogIn,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Layers,
} from "lucide-react";

interface EmbeddedCourtWidgetProps {
  clubId: string;
  clubName?: string;
  primaryColor?: string;
  courts?: string[];
  bookings?: Booking[];
  currentUser?: User | null;
  onLogin?: (username: string, pass: string) => Promise<boolean | void>;
  onSelectSlot?: (court: string, time: string, date: string) => void;
  onNavigateToFullApp?: (court?: string, time?: string, date?: string) => void;
}

export const EmbeddedCourtWidget: React.FC<EmbeddedCourtWidgetProps> = ({
  clubId,
  clubName = "Tennisclub",
  primaryColor = "#047857",
  courts = ["Platz 1", "Platz 2", "Platz 3"],
  bookings = [],
  currentUser = null,
  onLogin,
  onSelectSlot,
  onNavigateToFullApp,
}) => {
  // Check URL parameters for custom theme (light, dark, club)
  const urlParams = useMemo(() => {
    if (typeof window === "undefined") return { theme: "auto" };
    const sp = new URLSearchParams(window.location.search);
    return {
      theme: sp.get("theme") || "auto",
    };
  }, []);

  // Day selection (0 = Heute, 1 = Morgen, etc.)
  const [dayOffset, setDayOffset] = useState<number>(() => {
    const now = new Date();
    return now.getHours() >= 22 ? 1 : 0;
  });

  // Active court filter (null = alle Plätze anzeigen)
  const [selectedCourtFilter, setSelectedCourtFilter] = useState<string | null>(null);

  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{
    court: string;
    time: string;
    date: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentSlotRef = useRef<HTMLTableRowElement>(null);
  const hasAutoScrolledRef = useRef(false);

  // Auto-switch to tomorrow after 22:00
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getHours() >= 22 && dayOffset === 0) {
        setDayOffset(1);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [dayOffset]);

  // Date computations
  const { activeDateStr, formattedDateBadge, isToday, isTomorrow, currentHourNow } =
    useMemo(() => {
      const target = new Date();
      target.setDate(target.getDate() + dayOffset);

      const y = target.getFullYear();
      const m = String(target.getMonth() + 1).padStart(2, "0");
      const d = String(target.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      const badge = target.toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });

      return {
        activeDateStr: dateStr,
        formattedDateBadge: badge,
        isToday: dayOffset === 0,
        isTomorrow: dayOffset === 1,
        currentHourNow: new Date().getHours(),
      };
    }, [dayOffset]);

  // 14 hourly slots (08:00 - 22:00)
  const hourlySlots = useMemo(() => {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    return hours.map((h) => ({
      start: `${String(h).padStart(2, "0")}:00`,
      end: `${String(h + 1).padStart(2, "0")}:00`,
      label: `${String(h).padStart(2, "0")} - ${String(h + 1).padStart(2, "0")} Uhr`,
      hour: h,
    }));
  }, []);

  // Smart Auto-scroll: Focus on current time on today's view
  useEffect(() => {
    if (isToday && currentSlotRef.current && !hasAutoScrolledRef.current) {
      setTimeout(() => {
        currentSlotRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        hasAutoScrolledRef.current = true;
      }, 200);
    } else if (!isToday && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [dayOffset, isToday]);

  const isSlotPassed = (dateStr: string, timeStr: string) => {
    const now = new Date();
    const [yr, mon, day] = dateStr.split("-").map(Number);
    const [hr, min] = timeStr.split(":").map(Number);
    const slotTimeObj = new Date(yr, mon - 1, day, hr, min, 0, 0);
    return slotTimeObj < now;
  };

  const getSlotStatus = (court: string, slotHour: number, dateStr: string) => {
    const match = bookings.find((b) => {
      if (b.court !== court || b.date !== dateStr) return false;
      const bHour = parseInt(b.time.split(":")[0], 10);
      const duration = (b as any).durationHours || 1;
      return slotHour >= bHour && slotHour < bHour + duration;
    });

    if (match) {
      if (match.is_locked || match.locked || match.blockReason) {
        return {
          type: "locked" as const,
          label: match.blockReason || "Gesperrt",
        };
      }
      return {
        type: "booked" as const,
        label: "Gebucht",
      };
    }
    return { type: "free" as const, label: "Frei" };
  };

  const displayedCourts = useMemo(() => {
    if (selectedCourtFilter && courts.includes(selectedCourtFilter)) {
      return [selectedCourtFilter];
    }
    return courts;
  }, [courts, selectedCourtFilter]);

  const handleSlotClick = (court: string, time: string) => {
    if (isSlotPassed(activeDateStr, time)) return;

    if (currentUser) {
      if (onSelectSlot) {
        onSelectSlot(court, time, activeDateStr);
      } else if (onNavigateToFullApp) {
        onNavigateToFullApp(court, time, activeDateStr);
      }
    } else {
      // Store pending slot and open login modal
      setPendingSlot({ court, time, date: activeDateStr });
      setLoginError(null);
      setIsLoginModalOpen(true);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Bitte Benutzername und Passwort eingeben.");
      return;
    }

    if (!onLogin) {
      if (onNavigateToFullApp) {
        onNavigateToFullApp(
          pendingSlot?.court,
          pendingSlot?.time,
          pendingSlot?.date
        );
      }
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const success = await onLogin(loginUsername.trim(), loginPassword.trim());
      if (success !== false) {
        setIsLoginModalOpen(false);
        if (pendingSlot && onSelectSlot) {
          onSelectSlot(pendingSlot.court, pendingSlot.time, pendingSlot.date);
        } else if (onNavigateToFullApp) {
          onNavigateToFullApp(
            pendingSlot?.court,
            pendingSlot?.time,
            pendingSlot?.date
          );
        }
      } else {
        setLoginError("Anmeldedaten ungültig.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Anmeldefehler aufgetreten.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const isDarkTheme = urlParams.theme === "dark";

  return (
    <div
      className={`w-full max-w-full flex flex-col rounded-2xl border shadow-sm overflow-hidden select-none font-sans transition-colors ${
        isDarkTheme
          ? "bg-slate-900 border-slate-800 text-white"
          : "bg-white border-slate-200/90 text-slate-900"
      }`}
      style={{ "--color-primary": primaryColor } as React.CSSProperties}
    >
      {/* 1. ADAPTIVE HEADER BAR */}
      <div
        className={`p-3.5 sm:p-4 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 transition-colors ${
          isDarkTheme
            ? "bg-slate-950/80 border-slate-800"
            : "bg-slate-50/90 border-slate-200/80 backdrop-blur-xs"
        }`}
      >
        {/* Club Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center shadow-xs shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-tight uppercase truncate max-w-[200px] sm:max-w-[320px]">
                {clubName}
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300/60 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Platzbelegung &amp; Direktanmeldung
            </p>
          </div>
        </div>

        {/* Date Selector Controls */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs self-stretch md:self-auto justify-between md:justify-start">
          <button
            type="button"
            onClick={() => setDayOffset((prev) => Math.max(0, prev - 1))}
            disabled={dayOffset <= 0}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Vorheriger Tag"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isToday
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Heute
            </button>
            <button
              type="button"
              onClick={() => setDayOffset(1)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isTomorrow
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Morgen
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDayOffset((prev) => prev + 1)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Nächster Tag"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs font-extrabold text-slate-700 pl-2.5 pr-1.5 border-l border-slate-200">
            {formattedDateBadge}
          </span>
        </div>
      </div>

      {/* 2. COURT FILTER TABS (Only shown if > 2 courts or on mobile) */}
      {courts.length > 2 && (
        <div className="px-3.5 py-1.5 bg-slate-100/70 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto select-none custom-scrollbar">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-1 shrink-0">
            <Layers className="w-3 h-3" />
            <span>Plätze:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedCourtFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedCourtFilter === null
                ? "bg-[var(--color-primary)] text-white shadow-2xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
            }`}
          >
            Alle Plätze ({courts.length})
          </button>
          {courts.map((court) => (
            <button
              key={court}
              type="button"
              onClick={() => setSelectedCourtFilter(court)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                selectedCourtFilter === court
                  ? "bg-[var(--color-primary)] text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
              }`}
            >
              {court}
            </button>
          ))}
        </div>
      )}

      {/* 3. GRID CONTAINER WITH STICKY TIME COLUMN & HEADER */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto relative divide-y divide-slate-100 custom-scrollbar"
      >
        <table className="w-full border-collapse text-left min-w-full">
          {/* Header Row */}
          <thead>
            <tr className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs shadow-2xs">
              {/* Sticky Top-Left Corner */}
              <th className="sticky left-0 top-0 z-30 bg-slate-200/95 backdrop-blur-xs p-2.5 sm:p-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-600 w-24 sm:w-28 border-r border-b border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                Uhrzeit
              </th>
              {displayedCourts.map((c) => (
                <th
                  key={c}
                  className="p-2.5 sm:p-3 text-center text-xs font-black text-slate-800 uppercase tracking-wider min-w-[130px] sm:min-w-[160px] border-b border-slate-200"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          {/* Rows */}
          <tbody className="divide-y divide-slate-100">
            {hourlySlots.map((slot) => {
              const isPassed = isSlotPassed(activeDateStr, slot.start);
              const isCurrentHourSlot = isToday && currentHourNow === slot.hour;

              return (
                <tr
                  key={slot.start}
                  ref={isCurrentHourSlot ? currentSlotRef : null}
                  className={`transition-colors ${
                    isCurrentHourSlot
                      ? "bg-emerald-50/40"
                      : isPassed
                      ? "bg-slate-50/50 opacity-75"
                      : "hover:bg-slate-50/70"
                  }`}
                >
                  {/* Sticky Time Column */}
                  <td
                    className={`sticky left-0 z-10 p-2 text-center border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)] ${
                      isCurrentHourSlot
                        ? "bg-emerald-50/95 text-emerald-950"
                        : isPassed
                        ? "bg-slate-50 text-slate-400"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                          {slot.start}
                        </span>
                        {isCurrentHourSlot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        bis {slot.end}
                      </span>
                    </div>
                  </td>

                  {/* Court Columns */}
                  {displayedCourts.map((court) => {
                    const status = getSlotStatus(court, slot.hour, activeDateStr);

                    if (isPassed) {
                      return (
                        <td key={court} className="p-1.5 sm:p-2 text-center border-r border-slate-100 last:border-r-0">
                          <div className="w-full h-9 rounded-xl bg-slate-100/90 text-slate-400 text-[10px] font-bold flex items-center justify-center">
                            {status.type === "free" ? "Vorbei" : "Belegt"}
                          </div>
                        </td>
                      );
                    }

                    if (status.type === "locked") {
                      return (
                        <td key={court} className="p-1.5 sm:p-2 text-center border-r border-slate-100 last:border-r-0">
                          <div className="w-full h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center justify-center gap-1 px-2 truncate shadow-2xs">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span className="truncate">{status.label}</span>
                          </div>
                        </td>
                      );
                    }

                    if (status.type === "booked") {
                      return (
                        <td key={court} className="p-1.5 sm:p-2 text-center border-r border-slate-100 last:border-r-0">
                          <div className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Gebucht</span>
                          </div>
                        </td>
                      );
                    }

                    // FREE & INTERACTIVE SLOT (With instant hover action & micro-animation)
                    return (
                      <td key={court} className="p-1.5 sm:p-2 text-center border-r border-slate-100 last:border-r-0">
                        <button
                          type="button"
                          onClick={() => handleSlotClick(court, slot.start)}
                          className="w-full h-9 rounded-xl bg-emerald-50 hover:bg-[var(--color-primary)] text-emerald-800 hover:text-white border border-emerald-200/90 hover:border-transparent transition-all duration-150 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer group shadow-2xs hover:shadow-xs active:scale-95 relative overflow-hidden"
                          title={`Jetzt ${court} um ${slot.start} Uhr buchen`}
                        >
                          {/* Idle State */}
                          <span className="group-hover:hidden flex items-center gap-1.5 text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Frei</span>
                          </span>

                          {/* Hover / Active Action State */}
                          <span className="hidden group-hover:flex items-center gap-1 text-[11px] animate-in fade-in zoom-in-95 duration-100">
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Buchen</span>
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. RESPONSIVE FOOTER & LEGEND */}
      <div className="bg-slate-50 border-t border-slate-200 p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs shrink-0">
        {/* Legend */}
        <div className="flex items-center gap-3.5 font-bold text-slate-600 flex-wrap justify-center sm:justify-start">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Frei</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span>Gebucht</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
            <span>Gesperrt</span>
          </div>
        </div>

        {/* Action Link to Full App */}
        {onNavigateToFullApp && (
          <button
            type="button"
            onClick={() => onNavigateToFullApp()}
            className="text-slate-700 hover:text-[var(--color-primary)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span className="hidden sm:inline">Vollständige Buchungs-App öffnen</span>
            <span className="sm:hidden">App öffnen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 5. DIRECT LOGIN MODAL (Embedded Mode) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150 text-slate-900">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center mx-auto mb-2">
                <LogIn className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
                Mitgliederanmeldung
              </h3>
              {pendingSlot && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 py-1 px-2.5 rounded-full inline-block">
                  Reservierung für {pendingSlot.court}, {pendingSlot.time} Uhr
                </p>
              )}
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Benutzername oder E-Mail
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="z. B. MaxMustermann"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Passwort / PIN
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs font-bold text-slate-900"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] text-white text-xs font-black uppercase tracking-wider hover:brightness-95 disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmittingLogin ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <span>Anmelden</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
