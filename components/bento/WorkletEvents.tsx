import React, { useMemo } from "react";
import { BentoItem, Tournament, User } from "../../types";
import { Clock, Users, ArrowRight, PartyPopper } from "lucide-react";

interface WorkletEventsProps {
  item: BentoItem;
  tournaments?: Tournament[];
  currentUser?: User | null;
  onOpenLogin: () => void;
  onNavigateToEvents: () => void;
  onToggleEventRegistration?: (eventId: string, comment?: string) => Promise<void> | void;
}

export const WorkletEvents: React.FC<WorkletEventsProps> = ({
  item,
  tournaments = [],
  currentUser,
  onOpenLogin,
  onNavigateToEvents,
  onToggleEventRegistration,
}) => {
  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Filter for upcoming tournaments
  const upcomingEvents = useMemo(() => {
    return tournaments
      .filter((t) => !t.date || t.date >= todayStr)
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        const c = a.date.localeCompare(b.date);
        if (c !== 0) return c;
        return (a.startTime || "").localeCompare(b.startTime || "");
      })
      .slice(0, 4);
  }, [tournaments, todayStr]);

  const parseDateParts = (dateStr?: string) => {
    if (!dateStr) return { day: "--", month: "Offen" };
    try {
      const [y, m, d] = dateStr.split("-");
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleDateString("de-DE", { month: "short" });
      return { day, month };
    } catch {
      return { day: "--", month: "Termin" };
    }
  };

  const handleAction = (event: Tournament) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (onToggleEventRegistration) {
      onToggleEventRegistration(event.id);
    } else {
      onNavigateToEvents();
    }
  };

  return (
    <div className="flex flex-col justify-between h-auto w-full">
      <div>
        {/* Worklet Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              {item.title || "Kommende Veranstaltungen"}
            </h3>
          </div>
        </div>

        {/* Structured Container */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-3.5">
          {/* Dynamic List of Upcoming Events */}
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2.5">
              {upcomingEvents.map((t) => {
                const { day, month } = parseDateParts(t.date);
                const isRegistered =
                  currentUser &&
                  t.participants &&
                  t.participants.some(
                    (p) =>
                      p.toLowerCase() === (currentUser.name || "").toLowerCase() ||
                      p.toLowerCase() === (currentUser.id || "").toLowerCase() ||
                      p.toLowerCase() === `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim().toLowerCase()
                  );

                return (
                  <div
                    key={t.id}
                    className="bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/80 p-3 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                  >
                  {/* Left: Date Badge */}
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100/80 text-[var(--color-primary)] flex flex-col items-center justify-center shrink-0">
                    <span className="text-sm font-black leading-none">{day}</span>
                    <span className="text-[8.5px] font-bold uppercase tracking-wider mt-0.5">{month}</span>
                  </div>

                  {/* Middle: Title & Meta */}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={t.title}>
                      {t.title}
                    </h4>
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-500 font-medium mt-0.5 flex-wrap">
                      {t.startTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {t.startTime} Uhr
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {t.participants?.length || 0}
                        {t.maxParticipants ? ` / ${t.maxParticipants}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Right: Registration Button */}
                  <button
                    type="button"
                    onClick={() => handleAction(t)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95 ${
                      isRegistered
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200"
                        : "bg-[var(--color-primary)] hover:brightness-95 text-white"
                    }`}
                  >
                    {isRegistered ? "Angemeldet ✓" : "Anmelden"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <PartyPopper className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold">Aktuell keine kommenden Veranstaltungen geplant.</p>
          </div>
        )}
        </div>
      </div>

      {/* Footer Link */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-end">
        <button
          type="button"
          onClick={onNavigateToEvents}
          className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <PartyPopper className="w-3.5 h-3.5" />
          <span>Alle Veranstaltungen &amp; Details</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
