import React, { useMemo } from "react";
import { BentoItem, Booking } from "../../types";
import { Calendar, ArrowRight, Lock } from "lucide-react";

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
  courts = ["Platz 1", "Platz 2"],
  bookings = [],
  onNavigateToBooking,
  onNavigateToWeekPlan,
  onSelectSlot,
}) => {
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Representative hours for compact display: 09:00, 11:00, 14:00, 16:00, 18:00, 20:00
  const dayTimeSlots = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];

  // Helper to check status of a court slot
  const getSlotStatus = (court: string, time: string, dateStr: string) => {
    const slotHour = parseInt(time.split(":")[0], 10);
    const match = bookings.find((b) => {
      if (b.court !== court || b.date !== dateStr) return false;
      const bHour = parseInt(b.time.split(":")[0], 10);
      return Math.abs(bHour - slotHour) < 1.5; // overlap
    });

    if (match) {
      if (match.is_locked || match.locked || match.blockReason) {
        return { type: "locked" as const, label: "Gesperrt" };
      }
      return { type: "booked" as const, label: match.players?.[0] || "Gebucht" };
    }
    return { type: "free" as const, label: "Frei" };
  };

  return (
    <div className="flex flex-col justify-between h-full w-full">
      <div>
        {/* Worklet Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              {item.title || "Live-Belegungsplan"}
            </h3>
          </div>

          {/* Button: Zeige ganze Woche mit Link zum Wochenplan */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToWeekPlan) {
                onNavigateToWeekPlan();
              } else {
                onNavigateToBooking();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            title="Zum kompletten Wochenplan der Platzreservierung"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zeige ganze Woche</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Structured Container: Immer Tages-Live-Plan */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5 space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider py-1 px-2.5 bg-white rounded-lg border border-slate-200/70 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-white border border-slate-300"></span>
              <span>Frei</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-[var(--color-primary)]"></span>
              <span>Gebucht</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-slate-300"></span>
              <span>Gesperrt</span>
            </div>
          </div>

          {/* Table: Day View */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse border border-slate-200/80 rounded-xl overflow-hidden text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200/80">
                  <th className="p-2 border-r border-slate-200/80 text-center w-16">Uhrzeit</th>
                  {courts.map((court) => (
                    <th key={court} className="p-2 text-center border-r last:border-r-0 border-slate-200/80">
                      {court}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 bg-white">
                {dayTimeSlots.map((time) => (
                  <tr key={time} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200/80 text-[11px] bg-slate-50/30">
                      {time}
                    </td>
                    {courts.map((court) => {
                      const status = getSlotStatus(court, time, todayStr);
                      return (
                        <td key={court} className="p-1 border-r last:border-r-0 border-slate-200/80 text-center">
                          {status.type === "booked" ? (
                            <button
                              type="button"
                              onClick={onNavigateToBooking}
                              title="Belegt • Bitte anmelden für Details"
                              className="w-full py-1 px-1.5 bg-[var(--color-primary)] text-white rounded font-bold text-[10px] truncate shadow-2xs hover:brightness-95 transition-all cursor-pointer text-center"
                            >
                              {status.label}
                            </button>
                          ) : status.type === "locked" ? (
                            <div className="py-1 px-1.5 bg-slate-200 text-slate-600 rounded font-medium text-[10px] flex items-center justify-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span className="hidden sm:inline">Gesperrt</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectSlot) {
                                  onSelectSlot(court, time, todayStr);
                                } else {
                                  onNavigateToBooking();
                                }
                              }}
                              title="Frei • Jetzt buchen"
                              className="w-full py-1 px-1.5 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-dashed border-slate-200 hover:border-emerald-300 rounded font-bold text-[10px] transition-colors cursor-pointer text-center"
                            >
                              Frei
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
        </div>
      </div>

      {/* Footer Link */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-medium">Live-Belegungsplan (Heute)</span>
        <button
          type="button"
          onClick={() => {
            if (onNavigateToWeekPlan) {
              onNavigateToWeekPlan();
            } else {
              onNavigateToBooking();
            }
          }}
          className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Ganze Woche anzeigen</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
