import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { User, Booking, UserClub } from '../../types';
import { TIME_SLOTS } from '../../constants';
import { listenToBookings, listenToSettings, listenToClubs } from '../../services/db';
import { getUserClubs, getCanonicalClubId, getClubInitials, KNOWN_CLUBS_STAMMDATEN } from '../../lib/userUtils';

interface HobbyligaMiniKalenderProps {
  currentUser: User;
  clubId: string;
  bookings: Booking[];
  settings?: any;
  courts?: string[];
  pendingChallengedUser?: { userId: string; name?: string } | null;
  onClearChallengedUser?: () => void;
  onSelectSlot: (date: string, court: string, startTime: string) => void;
  userClubs?: UserClub[];
  onSwitchClub?: (clubId: string) => void; // Keeping prop for backwards compatibility
}

export const HobbyligaMiniKalender: React.FC<HobbyligaMiniKalenderProps> = ({
  currentUser,
  clubId,
  bookings = [],
  settings,
  courts: propCourts,
  pendingChallengedUser,
  onClearChallengedUser,
  onSelectSlot,
  userClubs,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Local state for the mini calendar's selected club to avoid global reload
  const [selectedMiniClubId, setSelectedMiniClubId] = useState<string>(clubId);
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings);
  const [localSettings, setLocalSettings] = useState<any>(settings);
  const [systemClubs, setSystemClubs] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load system clubs from cache and listener
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

  // Deduplicate clubs strictly by id, filtering only by user's actual memberships
  const uniqueClubs = useMemo(() => {
    const map = new Map<string, any>();
    const userClubList = userClubs && userClubs.length > 0 
      ? userClubs 
      : getUserClubs(currentUser, systemClubs);

    // Filter by user's actual clubs
    if (userClubList && Array.isArray(userClubList)) {
      userClubList.forEach((c) => {
        const id = c.vereinsId || c.id;
        if (id) {
          const canonicalKey = getCanonicalClubId(id);
          if (canonicalKey && !['super-admin', 'system'].includes(canonicalKey)) {
            // Find system club metadata (for logo, address, master data)
            const matchedSystemClub = (systemClubs || []).find((sc) => {
              const scId = getCanonicalClubId(sc.vereinsId || sc.id || '');
              return scId === canonicalKey;
            });
            const knownMeta = KNOWN_CLUBS_STAMMDATEN[canonicalKey];

            // Resolve dynamic club name: prefer system master data, then knownMeta, then clean c.name/c.clubName
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

            // Strictly resolve Wappen / Logo (prioritize login / loading screen logo)
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
    }

    // Always ensure current club is in the list if the map is empty
    const currentCanonical = getCanonicalClubId(clubId || 'sv-neuhausen');
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
  }, [userClubs, currentUser, systemClubs, clubId, settings]);

  const currentClub = useMemo(() => {
    const normSelected = getCanonicalClubId(selectedMiniClubId || clubId || 'sv-neuhausen');
    const found = uniqueClubs.find((c) => {
      const id = c.vereinsId || c.id;
      return getCanonicalClubId(id) === normSelected;
    });
    if (found) return found;
    const fallbackKnown = KNOWN_CLUBS_STAMMDATEN[normSelected];
    return {
      id: normSelected,
      vereinsId: normSelected,
      clubName: localSettings?.clubName || settings?.clubName || fallbackKnown?.clubName || 'SV Neuhausen',
      name: localSettings?.clubName || settings?.clubName || fallbackKnown?.clubName || 'SV Neuhausen',
      logoUrl: localSettings?.logoUrl || settings?.logoUrl || fallbackKnown?.logoUrl,
    };
  }, [uniqueClubs, selectedMiniClubId, clubId, localSettings, settings]);

  // Sync props to local state if the selected club is the global one
  useEffect(() => {
    if (selectedMiniClubId === clubId) {
      setLocalBookings(bookings);
      setLocalSettings(settings);
    }
  }, [selectedMiniClubId, clubId, bookings, settings]);

  // Fetch local data when a different club is selected
  useEffect(() => {
    if (selectedMiniClubId === clubId) return;

    setIsLoadingData(true);
    let isMounted = true;
    let bookingsLoaded = false;
    let settingsLoaded = false;

    const checkLoaded = () => {
      if (bookingsLoaded && settingsLoaded && isMounted) {
        setIsLoadingData(false);
      }
    };

    const unsubBookings = listenToBookings(selectedMiniClubId, (newBookings) => {
      if (isMounted) {
        setLocalBookings(newBookings);
        bookingsLoaded = true;
        checkLoaded();
      }
    });

    const unsubSettings = listenToSettings(selectedMiniClubId, (newSettings) => {
      if (isMounted) {
        setLocalSettings(newSettings);
        settingsLoaded = true;
        checkLoaded();
      }
    });

    return () => {
      isMounted = false;
      unsubBookings();
      unsubSettings();
    };
  }, [selectedMiniClubId, clubId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format today as YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mon}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen on mount & resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('day');
      } else {
        setViewMode('week');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const courts = useMemo(() => {
    // If we are looking at the global club and courts were passed as props, use them
    if (selectedMiniClubId === clubId && propCourts && propCourts.length > 0) return propCourts;
    // Otherwise rely on localSettings
    if (localSettings?.courts && localSettings.courts.length > 0) return localSettings.courts;
    return ['Platz 1', 'Platz 2', 'Platz 3', 'Platz 4'];
  }, [propCourts, localSettings?.courts, selectedMiniClubId, clubId]);

  // Generate 7 days of the active week (Monday to Sunday) containing selectedDate
  const weekDates = useMemo(() => {
    const [yr, mon, day] = selectedDate.split('-').map(Number);
    const curr = new Date(yr, mon - 1, day);
    const dayOfWeek = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - distanceToMonday);

    const dates: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }[] = [];
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push({
        dateStr: dStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
      });
    }
    return dates;
  }, [selectedDate, todayStr]);

  // Quick navigation day tabs (+0 to +6 days from today)
  const quickDays = useMemo(() => {
    const list: { dateStr: string; label: string; subLabel: string; isToday: boolean }[] = [];
    const today = new Date();
    const dayLabels = ['Heute', 'Morgen', '+2 Tage', '+3 Tage', '+4 Tage', '+5 Tage', '+6 Tage'];
    const weekdayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      list.push({
        dateStr: dStr,
        label: i < 2 ? dayLabels[i] : `${weekdayShort[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`,
        subLabel: `${d.getDate()}.${d.getMonth() + 1}.`,
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  const [hoveredCell, setHoveredCell] = useState<{ colId: string, timeIdx: number } | null>(null);

  // Filter time slots (e.g. 08:00 - 21:00 for compact mini preview)
  const calendarSlots = useMemo(() => {
    const slots = TIME_SLOTS.filter((t) => {
      const [h] = t.split(':').map(Number);
      return h >= 8 && h <= 21;
    });
    return slots.length > 0 ? slots : TIME_SLOTS;
  }, []);

  // Helper to check if a specific time on a court is booked or locked
  const isSlotOccupied = (date: string, court: string, time: string): boolean => {
    // 1. Regular database bookings or manual locks
    const hasBooking = localBookings.some(
      (b) => b.date === date && b.court === court && b.time === time
    );
    if (hasBooking) return true;

    // 2. Check Range Locks
    const rangeLocks = localSettings?.rangeLocks || [];
    const inRangeLock = rangeLocks.some((l: any) => {
      if (!l.courts || !l.courts.includes(court)) return false;
      if (date < l.startDate || date > l.endDate) return false;
      const sTime = l.startTime || '00:00';
      const eTime = l.endTime || '24:00';
      if (date === l.startDate && time < sTime) return false;
      if (date === l.endDate && time >= eTime) return false;
      return true;
    });
    if (inRangeLock) return true;

    // 3. Check Recurring Locks
    const recurringLocks = localSettings?.recurringLocks || [];
    const inRecurringLock = recurringLocks.some((l: any) => {
      const d = new Date(date);
      if (d.getDay() !== l.dayOfWeek) return false;
      if (!l.courts || !l.courts.includes(court)) return false;
      if (time < l.startTime || time >= l.endTime) return false;
      if (!l.isOngoing) {
        if (l.startDate && date < l.startDate) return false;
        if (l.endDate && date > l.endDate) return false;
      }
      return true;
    });
    if (inRecurringLock) return true;

    return false;
  };

  // Helper to check if a slot is passed in time
  const isSlotPassed = (date: string, time: string): boolean => {
    const now = new Date();
    const [yr, mon, day] = date.split('-').map(Number);
    const [hr, min] = time.split(':').map(Number);
    const slotDate = new Date(yr, mon - 1, day, hr, min, 0);
    return slotDate < now;
  };

  // Check if a 2-hour contiguous free slot can START at this time
  const checkCanStart2HourMatch = (date: string, court: string, timeIndex: number): boolean => {
    const time1 = calendarSlots[timeIndex];
    const time2 = calendarSlots[timeIndex + 1];
    if (!time1 || !time2) return false;

    // Check if slot 1 is free & not passed
    if (isSlotPassed(date, time1) || isSlotOccupied(date, court, time1)) {
      return false;
    }
    // Check if slot 2 is free & not passed
    if (isSlotPassed(date, time2) || isSlotOccupied(date, court, time2)) {
      return false;
    }

    return true;
  };

  // Week navigation helpers
  const handlePrevWeek = () => {
    const [yr, mon, day] = selectedDate.split('-').map(Number);
    const d = new Date(yr, mon - 1, day - 7);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleNextWeek = () => {
    const [yr, mon, day] = selectedDate.split('-').map(Number);
    const d = new Date(yr, mon - 1, day + 7);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleResetToToday = () => {
    setSelectedDate(todayStr);
  };

  const venueClubName = currentClub?.clubName || localSettings?.clubName || (String(selectedMiniClubId).toLowerCase().includes("neuhausen") ? "SV Neuhausen" : "");
  const facilityStreet = localSettings?.street || currentClub?.street || (venueClubName?.toLowerCase().includes("neuhausen") ? "Sportweg 4" : "");
  const facilityZip = localSettings?.zip || currentClub?.zip || (venueClubName?.toLowerCase().includes("neuhausen") ? "84030" : "");
  const facilityCity = localSettings?.city || currentClub?.city || (venueClubName?.toLowerCase().includes("neuhausen") ? "Ergolding" : "");
  
  const fullAddress = [facilityStreet, [facilityZip, facilityCity].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const clubAddress = fullAddress 
    ? (venueClubName ? `${venueClubName}, ${fullAddress}` : fullAddress)
    : (venueClubName || "Sportweg 4, 84030 Ergolding");

  return (
    <div id="mini-kalender-liga-slots" className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-700 rounded-xl border border-emerald-500/20">
              <i className="fa-solid fa-calendar-days text-lg"></i>
            </span>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Freie Liga-Slots
              </h3>
            </div>
          </div>
        </div>

        {/* View Toggle & Week Navigator */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          
          {/* Facility Selector */}
          <div className="relative h-9" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 h-9 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              title="Anlage / Verein wechseln"
            >
              <div className="relative w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                {currentClub?.logoUrl ? (
                  <img
                    src={currentClub.logoUrl}
                    alt={currentClub.clubName}
                    className="w-full h-full object-contain p-0.5"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className={`text-[8px] font-black text-slate-600 uppercase tracking-tighter ${currentClub?.logoUrl ? 'absolute inset-0 flex items-center justify-center -z-10 bg-slate-100' : ''}`}>
                  {getClubInitials(currentClub?.clubName || currentClub?.name || currentClub?.id)}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                Anlage: {currentClub?.clubName || 'SV Neuhausen'}
              </span>
              <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 shadow-xl rounded-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1 mb-1 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100">
                  Anlage / Austragungsort wählen
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {uniqueClubs.map(c => {
                    const cId = c.vereinsId || c.id;
                    const isActive = getCanonicalClubId(cId) === getCanonicalClubId(selectedMiniClubId || currentClub?.id);
                    const cLoc = c.street && c.city ? `${c.street}, ${c.city}` : (c.city || "");
                    const initials = getClubInitials(c.clubName || c.name || c.id);
                    return (
                      <button
                        key={cId}
                        type="button"
                        onClick={() => {
                          setSelectedMiniClubId(c.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-emerald-50 font-bold text-emerald-950'
                            : 'hover:bg-slate-50 font-medium text-slate-700'
                        }`}
                      >
                        <div className="relative w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {c.logoUrl ? (
                            <img
                              src={c.logoUrl}
                              alt={c.clubName}
                              className="w-full h-full object-contain p-0.5"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <span className={`text-[9px] font-black text-slate-600 uppercase tracking-tighter ${c.logoUrl ? 'absolute inset-0 flex items-center justify-center -z-10 bg-slate-100' : ''}`}>
                            {initials}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs truncate ${isActive ? 'font-bold text-emerald-950' : 'font-semibold text-slate-800'}`}>
                            {c.clubName}
                          </div>
                          {cLoc && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {cLoc}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <i className="fa-solid fa-check text-emerald-600 text-xs shrink-0 ml-auto"></i>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Discrete Anfahrt Link */}
          {clubAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clubAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Anfahrt zu ${clubAddress} in Google Maps öffnen`}
              className="inline-flex items-center gap-1.5 px-3 h-9 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-600 hover:text-[var(--color-primary)] rounded-xl transition-all text-xs font-bold shadow-2xs active:scale-95 cursor-pointer shrink-0"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Anfahrt</span>
            </a>
          )}

          {/* Week / Day View Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold h-9">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 h-full flex items-center justify-center rounded-lg transition-all ${
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-calendar-day mr-1.5"></i> Tag
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 h-full flex items-center justify-center rounded-lg transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-calendar-week mr-1.5"></i> Woche
            </button>
          </div>

          {/* Prev/Next Week Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 h-9">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="w-7 h-full flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition"
              title="Vorherige Woche"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button
              type="button"
              onClick={handleResetToToday}
              className="px-2 h-full flex items-center text-[11px] font-bold rounded-lg hover:bg-white text-slate-700 transition"
            >
              Heute
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="w-7 h-full flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition"
              title="Nächste Woche"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Date Switcher Carousel / Tabs (Mobile & Day view) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {quickDays.map((qd) => {
          const isSelected = qd.dateStr === selectedDate;
          return (
            <button
              key={qd.dateStr}
              type="button"
              onClick={() => setSelectedDate(qd.dateStr)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                isSelected
                  ? 'bg-[var(--color-primary)] text-white shadow-sm ring-2 ring-[var(--color-primary)]/30 font-black'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>{qd.label}</span>
              {qd.isToday && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Week Selector */}
      {viewMode === 'day' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>
              {new Date(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Klick auf einen freien Slot startet Buchung
            </span>
          </div>

          <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden relative">
            {isLoadingData && (
              <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[var(--color-primary)]"></i>
                <span className="mt-2 text-xs font-bold text-slate-600">Wechsle zu: {currentClub?.clubName || selectedMiniClubId}...</span>
              </div>
            )}
            {/* Time Column */}
            <div className="w-16 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col z-10">
              <div className="h-10 border-b border-slate-200 sticky top-0 bg-slate-50"></div>
              {calendarSlots.map((time) => (
                <div key={time} className="h-9 relative border-b border-slate-100 flex justify-center text-[10px] font-bold text-slate-400">
                  <span className="absolute -top-2 bg-slate-50 px-1.5 text-slate-500 font-bold tabular-nums text-[10px]">
                    {parseInt(time.split(':')[0], 10)} Uhr
                  </span>
                </div>
              ))}
            </div>

            {/* Court Columns */}
            <div className="flex-1 flex overflow-x-auto scrollbar-none relative">
              {courts.map((court, colIdx) => (
                <div key={court} className={`flex-1 min-w-[80px] flex flex-col relative ${colIdx < courts.length - 1 ? 'border-r border-slate-100' : ''}`}
                     onMouseLeave={() => setHoveredCell(null)}>
                  
                  <div className="h-10 border-b border-slate-200 flex items-center justify-center bg-white sticky top-0 z-10">
                    <span className="text-xs font-black text-slate-800 truncate px-1">{court}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col relative">
                    {calendarSlots.map((time, timeIdx) => {
                      const isOccupied = isSlotOccupied(selectedDate, court, time);
                      const isPast = isSlotPassed(selectedDate, time);

                      return (
                        <div
                          key={time}
                          onMouseEnter={() => setHoveredCell({ colId: court, timeIdx })}
                          className={`h-9 border-b border-slate-100 p-0.5 relative transition-colors ${
                            isOccupied ? 'bg-slate-100/80' : isPast ? 'bg-slate-100' : 'bg-white'
                          }`}
                        >
                          {/* Grey block if occupied */}
                          {isOccupied && (
                            <div className="w-full h-full bg-slate-200/60 rounded-md border border-slate-200" title="Belegt (Anonymisiert)"></div>
                          )}
                          {/* Past dashes if not occupied */}
                          {!isOccupied && isPast && (
                            <div className="w-full h-full border border-dashed border-slate-300 rounded-md opacity-80 bg-slate-200/30"></div>
                          )}
                        </div>
                      );
                    })}

                    {/* Hover logic overlay */}
                    {hoveredCell?.colId === court && (() => {
                      const timeIdx = hoveredCell.timeIdx;
                      const time1 = calendarSlots[timeIdx];
                      const time2 = calendarSlots[timeIdx + 1];
                      
                      if (!time1) return null;

                      const slot1Occupied = isSlotPassed(selectedDate, time1) || isSlotOccupied(selectedDate, court, time1);
                      const slot2Occupied = !time2 || isSlotPassed(selectedDate, time2) || isSlotOccupied(selectedDate, court, time2);

                      if (slot1Occupied) return null;

                      const timeEnd = calendarSlots[timeIdx + 2] || `${parseInt(time2?.split(':')[0] || time1.split(':')[0]) + 1}:00`;

                      if (!slot2Occupied) {
                        return (
                          <button
                            onClick={() => onSelectSlot(selectedDate, court, time1)}
                            className="absolute left-0 right-0 z-20 bg-emerald-500/95 hover:bg-emerald-500 text-white rounded-xl shadow-md border border-emerald-600 flex flex-col items-center justify-center cursor-pointer mx-1 transition-all group"
                            style={{
                              top: `${timeIdx * 36 + 2}px`,
                              height: `${36 * 2 - 4}px`,
                            }}
                            title={`${time1} – ${timeEnd} Uhr (2h Match)`}
                          >
                            <span className="text-xs font-black tracking-tight text-white flex items-center justify-center gap-1 tabular-nums whitespace-nowrap">
                              <span>{time1}</span>
                              <span className="text-white/70 font-semibold">–</span>
                              <span>{timeEnd}</span>
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-100 mt-0.5 whitespace-nowrap flex items-center gap-1">
                              <i className="fa-regular fa-clock text-[8px] opacity-80"></i> 2h Match
                            </span>
                          </button>
                        );
                      } else {
                        return (
                          <div
                            className="absolute left-0 right-0 z-20 bg-slate-50/95 border border-red-300 rounded-lg flex flex-col items-center justify-center cursor-not-allowed mx-1"
                            style={{
                              top: `${timeIdx * 36 + 2}px`,
                              height: `${36 - 4}px`,
                            }}
                          >
                            <span className="text-[8px] font-bold text-red-500 text-center px-1 leading-tight">Mind. 2h<br/>erforderlich</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid: WEEK VIEW (Desktop / Tablet) */}
      {viewMode === 'week' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>
              Woche: {new Date(weekDates[0]?.dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} – {new Date(weekDates[6]?.dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              <i className="fa-solid fa-hand-pointer mr-1 text-emerald-600"></i> Slots anklicken zum Buchen
            </span>
          </div>

          <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden relative">
            {isLoadingData && (
              <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[var(--color-primary)]"></i>
                <span className="mt-2 text-xs font-bold text-slate-600">Wechsle zu: {currentClub?.clubName || selectedMiniClubId}...</span>
              </div>
            )}
            {/* Time Column */}
            <div className="w-16 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col z-10">
              <div className="h-10 border-b border-slate-200 sticky top-0 bg-slate-50"></div>
              {calendarSlots.map((time) => (
                <div key={time} className="h-9 relative border-b border-slate-100 flex justify-center text-[10px] font-bold text-slate-400">
                  <span className="absolute -top-2 bg-slate-50 px-1.5 text-slate-500 font-bold tabular-nums text-[10px]">
                    {parseInt(time.split(':')[0], 10)} Uhr
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="flex-1 flex overflow-x-auto scrollbar-none relative">
              {weekDates.map((wd, colIdx) => (
                <div key={wd.dateStr} className={`flex-1 min-w-[70px] flex flex-col relative ${colIdx < weekDates.length - 1 ? 'border-r border-slate-100' : ''}`}
                     onMouseLeave={() => setHoveredCell(null)}>
                  
                  <div className={`h-10 border-b border-slate-200 flex flex-col items-center justify-center sticky top-0 z-10 ${wd.isToday ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-slate-800'}`}>
                    <span className="text-[10px] font-medium leading-none mb-0.5">{wd.dayName}</span>
                    <span className="text-xs font-black leading-none">{wd.dayNumber}.</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col relative">
                    {calendarSlots.map((time, timeIdx) => {
                      const allOccupied = courts.every(c => isSlotOccupied(wd.dateStr, c, time));
                      const isPast = isSlotPassed(wd.dateStr, time);

                      return (
                        <div
                          key={time}
                          onMouseEnter={() => setHoveredCell({ colId: wd.dateStr, timeIdx })}
                          className={`h-9 border-b border-slate-100 p-0.5 relative transition-colors ${
                            allOccupied ? 'bg-slate-100/80' : isPast ? 'bg-slate-100' : 'bg-white'
                          }`}
                        >
                          {/* Grey block if occupied */}
                          {allOccupied && (
                            <div className="w-full h-full bg-slate-200/60 rounded-md border border-slate-200" title="Alle Plätze belegt"></div>
                          )}
                          {/* Past dashes if not occupied */}
                          {!allOccupied && isPast && (
                            <div className="w-full h-full border border-dashed border-slate-300 rounded-md opacity-80 bg-slate-200/30"></div>
                          )}
                        </div>
                      );
                    })}

                    {/* Hover logic overlay */}
                    {hoveredCell?.colId === wd.dateStr && (() => {
                      const timeIdx = hoveredCell.timeIdx;
                      const time1 = calendarSlots[timeIdx];
                      const time2 = calendarSlots[timeIdx + 1];
                      
                      if (!time1) return null;

                      // Check if at least one court is free for time1
                      const freeCourtsSlot1 = courts.filter(c => !isSlotPassed(wd.dateStr, time1) && !isSlotOccupied(wd.dateStr, c, time1));
                      const slot1Occupied = freeCourtsSlot1.length === 0;

                      if (slot1Occupied) return null;

                      // Check if there is ANY court that is free for BOTH time1 and time2
                      const targetCourtFor2h = courts.find(c => checkCanStart2HourMatch(wd.dateStr, c, timeIdx));
                      const canStart2h = !!targetCourtFor2h;

                      const timeEnd = calendarSlots[timeIdx + 2] || `${parseInt(time2?.split(':')[0] || time1.split(':')[0]) + 1}:00`;

                      if (canStart2h) {
                        return (
                          <button
                            onClick={() => onSelectSlot(wd.dateStr, targetCourtFor2h, time1)}
                            className="absolute left-0 right-0 z-20 bg-emerald-500/95 hover:bg-emerald-500 text-white rounded-xl shadow-md border border-emerald-600 flex flex-col items-center justify-center cursor-pointer mx-1 transition-all group"
                            style={{
                              top: `${timeIdx * 36 + 2}px`,
                              height: `${36 * 2 - 4}px`,
                            }}
                            title={`${time1} – ${timeEnd} Uhr auf ${targetCourtFor2h} (2h Match)`}
                          >
                            <span className="text-[11px] sm:text-xs font-black tracking-tight text-white flex items-center justify-center gap-1 tabular-nums whitespace-nowrap">
                              <span>{time1}</span>
                              <span className="text-white/70 font-semibold">–</span>
                              <span>{timeEnd}</span>
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-100 mt-0.5 whitespace-nowrap flex items-center gap-1">
                              <i className="fa-regular fa-clock text-[8px] opacity-80"></i> 2h Match
                            </span>
                          </button>
                        );
                      } else {
                        return (
                          <div
                            className="absolute left-0 right-0 z-20 bg-slate-50/95 border border-red-300 rounded-lg flex flex-col items-center justify-center cursor-not-allowed mx-1"
                            style={{
                              top: `${timeIdx * 36 + 2}px`,
                              height: `${36 - 4}px`,
                            }}
                          >
                            <span className="text-[8px] font-bold text-red-500 text-center px-0.5 leading-tight">Mind. 2h<br/>erforderlich</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ampelsystem Legend (Footnote) */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
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
  );
};
