import React, { useState, useMemo, useEffect, useRef } from "react";
import { BentoItem, Booking } from "../../types";
import { Calendar, ArrowRight, Lock, Plus } from "lucide-react";

interface WorkletCourtsProps {
  item: BentoItem;
  courts?: string[];
  bookings?: Booking[];
  onNavigateToBooking: () => void;
  onNavigateToWeekPlan?: () => void;
  onSelectSlot?: (court: string, time: string, date: string) => void;
  primaryColor?: string;
}

export const WorkletCourts: React.FC<WorkletCourtsProps> = ({
  item,
  courts = ["Platz 1", "Platz 2", "Platz 3", "Platz 4"],
  bookings = [],
  onNavigateToBooking,
  onNavigateToWeekPlan,
  onSelectSlot,
  primaryColor,
}) => {
  // 0 = Heute, 1 = Morgen
  // Nach Ende des letzten Slots von heute (21:00-22:00 Uhr, d. h. ab 22:00 Uhr) automatisch auf Morgen springen
  const [selectedDayOffset, setSelectedDayOffset] = useState<0 | 1>(() => {
    const now = new Date();
    return now.getHours() >= 22 ? 1 : 0;
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Wenn der Tag gewechselt wird oder auf Morgen gesprungen wird, Scrollposition an den Anfang (08:00 Uhr) setzen
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedDayOffset]);

  // Falls die Seite um 22:00 Uhr geöffnet ist, automatisch live auf Morgen umstellen
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() >= 22 && selectedDayOffset === 0) {
        setSelectedDayOffset(1);
      }
    };
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [selectedDayOffset]);

  const { todayStr, tomorrowStr, activeDateStr, formattedDateBadge } = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const toDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const tStr = toDateStr(today);
    const tmrStr = toDateStr(tomorrow);
    const activeDate = selectedDayOffset === 0 ? today : tomorrow;

    const badge = activeDate.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

    return {
      todayStr: tStr,
      tomorrowStr: tmrStr,
      activeDateStr: selectedDayOffset === 0 ? tStr : tmrStr,
      formattedDateBadge: badge,
    };
  }, [selectedDayOffset]);

  // Hourly time slots (08:00 to 21:00)
  const hourlySlots = useMemo(() => {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    return hours.map((h) => {
      const startStr = `${String(h).padStart(2, "0")}:00`;
      const endStr = `${String(h + 1).padStart(2, "0")}:00`;
      const label = `${String(h).padStart(2, "0")} - ${String(h + 1).padStart(2, "0")} Uhr`;
      return { start: startStr, end: endStr, label, hour: h };
    });
  }, []);

  // Check if a slot is in the past
  const isSlotPassed = (dateStr: string, timeStr: string) => {
    const now = new Date();
    const [yr, mon, day] = dateStr.split("-").map(Number);
    const [hr, min] = timeStr.split(":").map(Number);
    const slotTimeObj = new Date(yr, mon - 1, day, hr, min, 0, 0);
    return slotTimeObj < now;
  };

  // Helper to check status of a court slot
  const getSlotStatus = (court: string, slotHour: number, slotTime: string, dateStr: string) => {
    const match = bookings.find((b) => {
      if (b.court !== court || b.date !== dateStr) return false;
      const bHour = parseInt(b.time.split(":")[0], 10);
      const duration = (b as any).durationHours || 1;
      return slotHour >= bHour && slotHour < bHour + duration;
    });

    if (match) {
      if (match.is_locked || match.locked || match.blockReason) {
        return { type: "locked" as const, label: match.blockReason || "Blockiert" };
      }
      return {
        type: "booked" as const,
        label: match.title || match.players?.[0] || match.bookedBy || "Belegt",
      };
    }
    return { type: "free" as const, label: "Frei" };
  };

  const handleOpenCalendar = () => {
    if (onNavigateToWeekPlan) {
      onNavigateToWeekPlan();
    } else {
      onNavigateToBooking();
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      <div>
        {/* Worklet Header with Unified Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-3 border-b border-slate-100 gap-2.5">
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {item.title && item.title !== "Live-Belegungsplan" ? item.title : "Freie Plätze"}
            </h3>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
              {selectedDayOffset === 0 ? "Heute, " : "Morgen, "}
              {formattedDateBadge}
            </span>
          </div>

          {/* Unified Switcher: Heute | Morgen | Ganze Woche */}
          <div className="inline-flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/90 shadow-2xs self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDayOffset(0)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedDayOffset === 0
                  ? "bg-white text-[var(--color-primary)] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Heute
            </button>
            <button
              type="button"
              onClick={() => setSelectedDayOffset(1)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedDayOffset === 1
                  ? "bg-white text-[var(--color-primary)] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Morgen
            </button>
            <div className="w-[1px] h-3.5 bg-slate-300 mx-1 shrink-0" />
            <button
              type="button"
              onClick={handleOpenCalendar}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Zum kompletten Wochenplan der Platzreservierung"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Ganze Woche</span>
              <span className="sm:hidden">Woche</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Unified Calendar Grid Table */}
        <div
          ref={scrollContainerRef}
          className="overflow-auto max-h-[380px] sm:max-h-[420px] rounded-xl border border-slate-200 bg-white shadow-2xs relative"
        >
          <table className="w-full border-collapse text-left min-w-full">
            <thead>
              <tr className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-2xs">
                {/* Sticky Top-Left Corner */}
                <th className="sticky left-0 top-0 z-30 bg-slate-100 p-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500 w-16 sm:w-20 border-r border-b border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                  Zeit
                </th>
                {courts.map((court, colIdx) => (
                  <th
                    key={court}
                    className={`p-2 text-center text-xs font-bold text-slate-800 border-b border-slate-200 min-w-[100px] sm:min-w-[120px] ${
                      colIdx < courts.length - 1 ? "border-r border-slate-100" : ""
                    }`}
                  >
                    <span className="truncate block">{court}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hourlySlots.map(({ hour, start, label }) => (
                <tr key={start} className="h-9">
                  {/* Sticky Time Column */}
                  <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 p-1 text-center select-none shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums whitespace-nowrap">
                      {hour} Uhr
                    </span>
                  </td>

                  {/* Court Columns */}
                  {courts.map((court, colIdx) => {
                    const status = getSlotStatus(court, hour, start, activeDateStr);
                    const isPassed = isSlotPassed(activeDateStr, start);

                    return (
                      <td
                        key={court}
                        className={`p-0.5 text-center ${
                          colIdx < courts.length - 1 ? "border-r border-slate-100" : ""
                        } ${
                          status.type === "booked" || status.type === "locked"
                            ? "bg-slate-100/80"
                            : isPassed
                            ? "bg-slate-100"
                            : "bg-white"
                        }`}
                      >
                        {status.type === "booked" ? (
                          <div
                            onClick={onNavigateToBooking}
                            title={`${court} (${label}): ${status.label} • Klick für Details`}
                            className="w-full h-8 bg-slate-200/60 hover:bg-slate-200 rounded-md border border-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold truncate px-1 cursor-pointer transition-colors"
                          >
                            <span className="truncate">{status.label}</span>
                          </div>
                        ) : status.type === "locked" ? (
                          <div
                            title={`${court} (${label}): Gesperrt (${status.label})`}
                            className="w-full h-8 bg-slate-200/60 rounded-md border border-slate-200 flex items-center justify-center gap-1 text-[9.5px] text-slate-500 font-medium px-1"
                          >
                            <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            <span className="truncate">{status.label}</span>
                          </div>
                        ) : isPassed ? (
                          <div
                            title={`${court} (${label}): Bereits verstrichen`}
                            className="w-full h-8 border border-dashed border-slate-300 rounded-md opacity-80 bg-slate-200/30"
                          ></div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectSlot) {
                                onSelectSlot(court, start, activeDateStr);
                              } else {
                                onNavigateToBooking();
                              }
                            }}
                            title={`${court} (${label}): Frei • Jetzt reservieren`}
                            className="w-full h-8 bg-white hover:bg-emerald-500 rounded-md border border-slate-200/60 hover:border-emerald-600 flex items-center justify-center transition-all cursor-pointer group shadow-2xs hover:shadow-xs"
                          >
                            <span className="opacity-0 group-hover:opacity-100 text-white font-black text-[10px] flex items-center gap-0.5 transition-opacity">
                              <Plus className="w-3 h-3" />
                              <span>Buchen</span>
                            </span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ampelsystem Legend (Footnote) matching Liga style */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300"></span>
            <span>Grau: Belegt</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-dashed border-slate-300 opacity-80"></span>
            <span>Gestrichelt: Vergangen</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 border border-emerald-600 shadow-2xs"></span>
            <span>Grün: Buchbar (in Plan klicken)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

