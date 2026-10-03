import React from "react";
import { User, LandingPageConfig, BentoItem, Booking, Tournament } from "../types";
import { RichTextRenderer } from "./RichText";
import { WorkletCourts } from "./bento/WorkletCourts";
import { WorkletEvents } from "./bento/WorkletEvents";
import { WorkletChampionship } from "./bento/WorkletChampionship";
import { WorkletWeather } from "./bento/WorkletWeather";
import {
  Calendar,
  ArrowRight,
} from "lucide-react";

interface LandingPageProps {
  config: LandingPageConfig;
  currentUser: User | null;
  onOpenLogin: () => void;
  onNavigateToBooking: () => void;
  onNavigateToWeekPlan?: () => void;
  onSelectSlot?: (court: string, time: string, date: string) => void;
  onNavigateToEvents?: () => void;
  onNavigateToChampionship?: () => void;
  clubName?: string;
  logoUrl?: string;
  onLogin?: (username: string, pass: string) => Promise<boolean | void>;
  loginError?: string | null;
  isLoggingIn?: boolean;
  onOpenTokenSetup?: () => void;
  onOpenHelp?: () => void;
  currentVereinsId?: string;
  courts?: string[];
  bookings?: Booking[];
  tournaments?: Tournament[];
  users?: Record<string, User>;
  onToggleEventRegistration?: (eventId: string, comment?: string) => Promise<void> | void;
  primaryColor?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  config,
  currentUser,
  onOpenLogin,
  onNavigateToBooking,
  onNavigateToWeekPlan,
  onSelectSlot,
  onNavigateToEvents,
  onNavigateToChampionship,
  clubName = "Tennis-Club",
  onLogin,
  loginError,
  isLoggingIn = false,
  onOpenTokenSetup,
  onOpenHelp,
  currentVereinsId = "",
  courts = ["Platz 1", "Platz 2"],
  bookings = [],
  tournaments = [],
  users = {},
  onToggleEventRegistration,
  primaryColor,
}) => {
  const sortedItems = [...(config.items || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 flex flex-col gap-6 w-full flex-grow lg:animate-in lg:fade-in lg:duration-500 min-h-0 select-text">
      {/* Bento Grid: 12 Columns */}
      {sortedItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
          {sortedItems.map((item) => {
            const colSpanClass =
              item.col_span === 4
                ? "md:col-span-4"
                : item.col_span === 6
                ? "md:col-span-6"
                : item.col_span === 8
                ? "md:col-span-8"
                : "md:col-span-12";

            return (
              <div
                key={item.id}
                className={`col-span-1 ${colSpanClass} bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 lg:p-7 flex flex-col justify-between min-w-0`}
              >
                {item.type === "worklet_courts" ? (
                  <WorkletCourts
                    item={item}
                    courts={courts}
                    bookings={bookings}
                    onNavigateToBooking={onNavigateToBooking}
                    onNavigateToWeekPlan={onNavigateToWeekPlan}
                    onSelectSlot={onSelectSlot}
                    primaryColor={primaryColor}
                  />
                ) : item.type === "worklet_events" ? (
                  <WorkletEvents
                    item={item}
                    tournaments={tournaments}
                    currentUser={currentUser}
                    onOpenLogin={onOpenLogin}
                    onNavigateToEvents={onNavigateToEvents || onNavigateToBooking}
                    onToggleEventRegistration={onToggleEventRegistration}
                  />
                ) : item.type === "worklet_championship" ? (
                  <WorkletChampionship
                    item={item}
                    clubId={currentVereinsId}
                    users={users}
                    onNavigateToChampionship={onNavigateToChampionship || onNavigateToBooking}
                  />
                ) : item.type === "worklet_weather" ? (
                  <WorkletWeather
                    item={item}
                    clubCity={clubName}
                  />
                ) : (
                  <>
                    <div>
                      {item.title && (
                        <div className="pb-3 mb-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
                              {item.title}
                            </h3>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 sm:p-4 text-sm text-slate-600 leading-relaxed font-normal break-words shadow-2xs">
                        <RichTextRenderer text={item.content || ""} />
                      </div>
                    </div>

                    {/* Subdued Footer if relevant for booking */}
                    {currentUser && item.col_span >= 8 && (
                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={onNavigateToBooking}
                          className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Zur Platzübersicht</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center text-slate-400">
          <p className="text-sm font-semibold">Aktuell sind keine Kacheln für die Startseite konfiguriert.</p>
        </div>
      )}
    </div>
  );
};
