import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Booking, UserClub } from '../../types';
import { createLeagueMatch } from '../../services/league';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { resolvePlayerDisplayName } from '../../utils/playerHelper';
import { UserAvatar } from '../UserAvatar';
import { TIME_SLOTS } from '../../constants';
import { listenToSettings, listenToBookings, listenToClubs, saveBooking } from '../../services/db';
import { getUserClubs, getCanonicalClubId, getClubInitials, KNOWN_CLUBS_STAMMDATEN } from '../../lib/userUtils';
import {
  checkPlayerCollisionSync,
  checkPlayerCollisionAsync,
  fetchCrossClubAppointments,
  PlayerCollision,
} from '../../services/collisionService';

interface HobbyligaBookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slot: {
    date: string;
    court: string;
    startTime: string;
  } | null;
  currentUser: User;
  clubId: string;
  users: Record<string, User>;
  settings?: any;
  userClubs?: UserClub[];
  allClubs?: any[];
  activeLeagueId?: string;
  prefilledOpponent?: { userId: string; name?: string } | null;
  onSwitchClub?: (clubId: string) => void;
  onBook?: (
    date: string,
    startTime: string,
    endTime: string,
    court: string,
    players: string[],
    hasBallMachine: boolean,
    guestCount: number,
    editingId?: string,
    comment?: string
  ) => Promise<string | null>;
  onSuccess?: () => void;
}

export const HobbyligaBookingDrawer: React.FC<HobbyligaBookingDrawerProps> = ({
  isOpen,
  onClose,
  slot,
  currentUser,
  clubId,
  users,
  settings,
  userClubs,
  allClubs: propAllClubs,
  activeLeagueId = 'open_mixed',
  prefilledOpponent,
  onSwitchClub,
  onBook,
  onSuccess,
}) => {
  const [selectedFacilityClubId, setSelectedFacilityClubId] = useState<string>(clubId || 'sv-neuhausen');
  const [currentClubSettings, setCurrentClubSettings] = useState<any>(settings);
  const [currentClubBookings, setCurrentClubBookings] = useState<Booking[]>([]);
  const [systemClubs, setSystemClubs] = useState<any[]>([]);

  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [courtNotice, setCourtNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cross-facility appointments for collision detection
  const [crossClubMatches, setCrossClubMatches] = useState<any[]>([]);
  const [crossClubBookings, setCrossClubBookings] = useState<Record<string, Booking[]>>({});

  useEffect(() => {
    if (!isOpen || !slot?.date) return;
    let isMounted = true;
    const knownIds = (propAllClubs || []).map((c: any) => c.vereinsId || c.id).filter(Boolean);
    fetchCrossClubAppointments(slot.date, knownIds).then((res) => {
      if (isMounted) {
        setCrossClubMatches(res.matches);
        setCrossClubBookings(res.bookingsByClub);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, slot?.date, propAllClubs]);

  // Animation states
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Opponent search & selection
  const [leagueOpponent, setLeagueOpponent] = useState<string | null>(null);
  const [leagueOpponentName, setLeagueOpponentName] = useState<string>('');
  const [leagueOpponentQuery, setLeagueOpponentQuery] = useState('');
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);
  const [allLeagueUsers, setAllLeagueUsers] = useState<Array<User & { clubTag?: string }>>([]);

  // Deutsches Datumsformat (Tag.Monat.Jahr) wie in Deutschland üblich
  const formatGermanDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    }
    return dateStr;
  };

  const formattedSlotDate = useMemo(() => formatGermanDate(slot?.date), [slot?.date]);

  // Sync selected club when modal opens or clubId changes
  useEffect(() => {
    if (isOpen) {
      setSelectedFacilityClubId(clubId || 'sv-neuhausen');
      setCourtNotice(null);
    }
  }, [isOpen, clubId]);

  // Load system clubs
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

  // Available clubs list - comprehensive list of all participating league/system clubs
  const availableClubsList = useMemo(() => {
    const map = new Map<string, any>();
    const sourceClubs: any[] = [];

    const userClubList = userClubs && userClubs.length > 0 
      ? userClubs 
      : getUserClubs(currentUser, systemClubs);

    if (Array.isArray(userClubList)) sourceClubs.push(...userClubList);
    if (Array.isArray(systemClubs)) sourceClubs.push(...systemClubs);
    if (Array.isArray(propAllClubs)) sourceClubs.push(...propAllClubs);

    // Seed with known clubs master data
    Object.entries(KNOWN_CLUBS_STAMMDATEN).forEach(([kId, meta]) => {
      sourceClubs.push({
        id: kId,
        vereinsId: kId,
        clubName: meta.clubName,
        name: meta.clubName,
        city: meta.city,
        street: meta.street,
        zip: meta.zip,
        logoUrl: meta.logoUrl,
      });
    });

    sourceClubs.forEach((c) => {
      const id = c.vereinsId || c.id;
      if (id) {
        const canonicalKey = getCanonicalClubId(id);
        if (canonicalKey && !['super-admin', 'system'].includes(canonicalKey)) {
          if (map.has(canonicalKey)) {
            const existing = map.get(canonicalKey);
            map.set(canonicalKey, {
              ...existing,
              street: existing.street || c.street,
              zip: existing.zip || c.zip,
              city: existing.city || c.city,
              facilityPhotoUrl: existing.facilityPhotoUrl || c.facilityPhotoUrl,
            });
            return;
          }

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

    // Always ensure current club is present if map is empty
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
  }, [userClubs, currentUser, systemClubs, propAllClubs, clubId, settings]);

  const hasMultipleClubs = availableClubsList.length > 1;

  // Handle switching facility
  const handleSwitchFacility = (newClubId: string) => {
    const normNew = String(newClubId).toLowerCase().replace(/\s/g, '');
    const normOld = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');
    if (normNew === normOld) return;

    setSelectedFacilityClubId(newClubId);
    setCourtNotice(null);
    setError(null);
    onSwitchClub?.(newClubId);
  };

  const currentFacilitySelectValue = useMemo(() => {
    const norm = getCanonicalClubId(selectedFacilityClubId);
    const match = availableClubsList.find((c) => getCanonicalClubId(c.vereinsId || c.id) === norm);
    return match ? (match.vereinsId || match.id) : selectedFacilityClubId;
  }, [availableClubsList, selectedFacilityClubId]);

  // Listen to settings and bookings for the selected facility
  useEffect(() => {
    if (!selectedFacilityClubId) return;

    const currentNorm = String(clubId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
    const selNorm = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');

    if (selNorm === currentNorm && settings) {
      setCurrentClubSettings(settings);
    }

    const unsubSettings = listenToSettings(selectedFacilityClubId, (s) => {
      if (s) setCurrentClubSettings(s);
    });

    const unsubBookings = listenToBookings(selectedFacilityClubId, (b) => {
      setCurrentClubBookings(b || []);
    });

    return () => {
      unsubSettings();
      unsubBookings();
    };
  }, [selectedFacilityClubId, clubId, settings]);

  const spieler1Name = useMemo(() => {
    if (!currentUser) return '';
    return resolvePlayerDisplayName(currentUser, currentUser.name || currentUser.id);
  }, [currentUser]);

  // Helper to calculate duration in hours
  const getDurationInHours = (start: string, end: string): number => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
  };

  // Facility Operating & Closing Hours
  const facilityClosingTime = useMemo(() => {
    if (slot?.date && currentClubSettings?.reservationRules?.openingHours) {
      const weekday = new Date(slot.date).getDay();
      const dayRule = currentClubSettings.reservationRules.openingHours[String(weekday)];
      if (dayRule && dayRule.end && !dayRule.closed) {
        return dayRule.end;
      }
    }
    // Default closing time is 21:00
    return '21:00';
  }, [slot?.date, currentClubSettings?.reservationRules?.openingHours]);

  const facilityClosingIdx = useMemo(() => {
    const idx = TIME_SLOTS.indexOf(facilityClosingTime);
    return idx !== -1 ? idx : TIME_SLOTS.indexOf('21:00');
  }, [facilityClosingTime]);

  // 2h and 3h duration options capped strictly by facility closing time
  const leagueEndTimeOptions = useMemo(() => {
    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    if (startIdx < 0) return [];

    const closingIdx = facilityClosingIdx >= 0 ? facilityClosingIdx : TIME_SLOTS.length - 1;

    const options: string[] = [];
    const idx2h = startIdx + 2;
    if (idx2h <= closingIdx) options.push(TIME_SLOTS[idx2h]);
    const idx3h = startIdx + 3;
    if (idx3h <= closingIdx) options.push(TIME_SLOTS[idx3h]);

    // If no 2h or 3h option fits before closing, provide the closing time itself if it's > start
    if (options.length === 0 && closingIdx > startIdx) {
      options.push(TIME_SLOTS[closingIdx]);
    }

    return options;
  }, [modalStartTime, facilityClosingIdx]);

  const currentDuration = getDurationInHours(modalStartTime, endTime);

  // Calculate court options & availability for the selected time slot
  const courtOptions = useMemo(() => {
    const courtsList =
      currentClubSettings?.courts && currentClubSettings.courts.length > 0
        ? currentClubSettings.courts
        : ['Platz 1', 'Platz 2', 'Platz 3', 'Platz 4'];

    if (!slot?.date) {
      return courtsList.map((c: string) => ({ name: c, isAvailable: true }));
    }

    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    const endIdx = TIME_SLOTS.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return courtsList.map((c: string) => ({ name: c, isAvailable: true }));
    }

    const slotsToCheck = TIME_SLOTS.slice(startIdx, endIdx);

    return courtsList.map((courtName: string) => {
      const isOccupied = slotsToCheck.some((t: string) => {
        // 1. Check existing bookings
        const hasBooking = currentClubBookings.some(
          (b) => b.date === slot.date && b.court === courtName && b.time === t
        );
        if (hasBooking) return true;

        // 2. Check Range Locks
        const rangeLocks = currentClubSettings?.rangeLocks || [];
        const inRangeLock = rangeLocks.some((l: any) => {
          if (!l.courts || !l.courts.includes(courtName)) return false;
          if (slot.date < l.startDate || slot.date > l.endDate) return false;
          const sTime = l.startTime || '00:00';
          const eTime = l.endTime || '24:00';
          if (slot.date === l.startDate && t < sTime) return false;
          if (slot.date === l.endDate && t >= eTime) return false;
          return true;
        });
        if (inRangeLock) return true;

        // 3. Check Recurring Locks
        const recurringLocks = currentClubSettings?.recurringLocks || [];
        const inRecurringLock = recurringLocks.some((l: any) => {
          const d = new Date(slot.date);
          if (d.getDay() !== l.dayOfWeek) return false;
          if (!l.courts || !l.courts.includes(courtName)) return false;
          if (t < l.startTime || t >= l.endTime) return false;
          if (!l.isOngoing) {
            if (l.startDate && slot.date < l.startDate) return false;
            if (l.endDate && slot.date > l.endDate) return false;
          }
          return true;
        });
        if (inRecurringLock) return true;

        return false;
      });

      return {
        name: courtName,
        isAvailable: !isOccupied,
      };
    });
  }, [currentClubSettings, currentClubBookings, modalStartTime, endTime, slot?.date]);

  // Auto-adjust court when facility changes or courtOptions change (Platz-Check)
  useEffect(() => {
    if (!isOpen || courtOptions.length === 0) return;
    const courtNames = courtOptions.map((c) => c.name);

    // 1. Check if currently selected court exists on this facility
    if (selectedCourt && !courtNames.includes(selectedCourt)) {
      const fallbackCourt = courtOptions.find((c) => c.isAvailable)?.name || courtNames[0];
      setSelectedCourt(fallbackCourt);
      setCourtNotice(`Platz wurde automatisch auf „${fallbackCourt}“ angepasst (gewählte Anlage verfügt nicht über „${selectedCourt}“).`);
      return;
    }

    // 2. If no court is selected yet, select the first available or first court
    if (!selectedCourt) {
      const firstFree = courtOptions.find((c) => c.isAvailable)?.name || courtNames[0];
      setSelectedCourt(firstFree);
    }
  }, [isOpen, courtOptions, selectedCourt]);

  // Real-time Availability Check (Collision Detection)
  const isSelectedCourtOccupied = useMemo(() => {
    if (!selectedCourt || courtOptions.length === 0) return false;
    const current = courtOptions.find((c) => c.name === selectedCourt);
    return current ? !current.isAvailable : false;
  }, [selectedCourt, courtOptions]);

  // Venue location & photo data
  const activeClubObj = useMemo(() => {
    const norm = getCanonicalClubId(selectedFacilityClubId);
    return (
      availableClubsList.find((c) => getCanonicalClubId(c.vereinsId || c.id) === norm) || null
    );
  }, [availableClubsList, selectedFacilityClubId]);

  const venueClubName =
    currentClubSettings?.clubName ||
    activeClubObj?.clubName ||
    activeClubObj?.vereinsName ||
    KNOWN_CLUBS_STAMMDATEN[getCanonicalClubId(selectedFacilityClubId)]?.clubName ||
    selectedFacilityClubId ||
    'Tennisverein';

  const venueStreet =
    currentClubSettings?.street ||
    activeClubObj?.street ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? 'Sportweg 4' : '');
  const venueZip =
    currentClubSettings?.zip ||
    activeClubObj?.zip ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? '84030' : '');
  const venueCity =
    currentClubSettings?.city ||
    activeClubObj?.city ||
    (venueClubName?.toLowerCase().includes('neuhausen') ? 'Ergolding' : '');

  const fullAddress = [venueStreet, [venueZip, venueCity].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const displayAddress = fullAddress || (venueClubName?.toLowerCase().includes('neuhausen') ? 'Sportweg 4, 84030 Ergolding' : 'Vereinsanlage');

  const venuePhoto =
    currentClubSettings?.facilityPhotoUrl ||
    currentClubSettings?.customFacilityPhotoUrl ||
    currentClubSettings?.loginBannerUrl ||
    currentClubSettings?.bannerUrl ||
    activeClubObj?.facilityPhotoUrl ||
    activeClubObj?.customFacilityPhotoUrl ||
    activeClubObj?.logoUrl ||
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=800&auto=format&fit=crop';

  const mapsQuery = encodeURIComponent(`${venueClubName}, ${displayAddress}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  // Player-Level Collision Detection across all clubs & leagues
  const playerCollision: PlayerCollision | null = useMemo(() => {
    if (!isOpen || !slot?.date || !modalStartTime || !endTime || !currentUser) return null;
    const playersToCheck = [
      currentUser,
      ...(leagueOpponent ? [{ id: leagueOpponent, name: leagueOpponentName }] : []),
    ];
    return checkPlayerCollisionSync(
      {
        date: slot.date,
        startTime: modalStartTime,
        endTime,
        players: playersToCheck,
        currentClubId: selectedFacilityClubId,
        currentClubBookings,
      },
      crossClubMatches,
      crossClubBookings
    );
  }, [
    isOpen,
    slot?.date,
    modalStartTime,
    endTime,
    currentUser,
    leagueOpponent,
    leagueOpponentName,
    selectedFacilityClubId,
    currentClubBookings,
    crossClubMatches,
    crossClubBookings,
  ]);

  const collisionWarning = useMemo(() => {
    if (playerCollision) {
      return playerCollision.errorMessage;
    }
    if (isSelectedCourtOccupied) {
      return `Achtung: Dieser Zeitslot (${modalStartTime} - ${endTime} Uhr) ist beim gewählten Verein „${venueClubName}“ auf ${selectedCourt} bereits belegt. Bitte wähle eine andere Uhrzeit oder einen anderen Platz.`;
    }
    return null;
  }, [playerCollision, isSelectedCourtOccupied, modalStartTime, endTime, venueClubName, selectedCourt]);

  // Pre-fill effect when opening drawer
  useEffect(() => {
    if (isOpen && slot) {
      setModalStartTime(slot.startTime);
      setSelectedCourt(slot.court || '');

      const startIdx = TIME_SLOTS.indexOf(slot.startTime);
      if (startIdx >= 0) {
        const closingIdx = facilityClosingIdx >= 0 ? facilityClosingIdx : TIME_SLOTS.length - 1;
        const endIdx = Math.min(closingIdx, startIdx + 2);
        setEndTime(TIME_SLOTS[endIdx] || TIME_SLOTS[Math.min(TIME_SLOTS.length - 1, startIdx + 2)]);
      } else {
        const [h, m] = slot.startTime.split(':').map(Number);
        const endH = Math.min(21, h + 2);
        setEndTime(`${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
      }

      setError(null);
      setComment('');
      setIsClosing(false);
      setIsAnimatingIn(false);

      if (prefilledOpponent) {
        setLeagueOpponent(prefilledOpponent.userId);
        const found = users[prefilledOpponent.userId];
        const disp = prefilledOpponent.name || (found ? resolvePlayerDisplayName(found) : prefilledOpponent.userId);
        setLeagueOpponentName(disp);
        setLeagueOpponentQuery('');
      } else {
        setLeagueOpponent(null);
        setLeagueOpponentName('');
        setLeagueOpponentQuery('');
      }

      const timer = setTimeout(() => setIsAnimatingIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimatingIn(false);
    }
  }, [isOpen, slot, prefilledOpponent, users, facilityClosingIdx]);

  // Lock body & html scroll when open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch league users across clubs for opponent autocomplete
  useEffect(() => {
    let active = true;
    const fetchLeagueUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!active) return;
        const fetchedList: Array<User & { clubTag?: string }> = [];
        snap.forEach((d) => {
          const u = d.data() as User;
          const uId = d.id;
          const clubTag = u.vereinsId ? u.vereinsId.toUpperCase().slice(0, 4) : undefined;
          fetchedList.push({
            ...u,
            id: uId,
            clubTag,
          });
        });
        setAllLeagueUsers(fetchedList);
      } catch (err) {
        console.error('Failed to fetch cross-club league users:', err);
      }
    };

    if (isOpen) {
      fetchLeagueUsers();
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Filtered opponent candidates
  const filteredLeagueUsers = useMemo(() => {
    const q = leagueOpponentQuery.toLowerCase().trim();
    return allLeagueUsers.filter((u) => {
      if (u.id === currentUser.id) return false;
      if (u.name && currentUser.name && u.name.toLowerCase() === currentUser.name.toLowerCase()) return false;
      if (!q) return true;

      const fName = (u.firstName || '').toLowerCase();
      const lName = (u.lastName || '').toLowerCase();
      const kName = (u.klarname || '').toLowerCase();
      const uName = (u.name || '').toLowerCase();
      const fullName = `${fName} ${lName}`.trim();
      const reverseName = `${lName} ${fName}`.trim();
      const club = (u.vereinsId || '').toLowerCase();

      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        fName.includes(q) ||
        lName.includes(q) ||
        kName.includes(q) ||
        uName.includes(q) ||
        club.includes(q)
      );
    });
  }, [allLeagueUsers, leagueOpponentQuery, currentUser]);

  // Resolved opponent user object for avatar & details
  const opponentUser = useMemo(() => {
    if (!leagueOpponent) return null;
    const foundInLeague = allLeagueUsers.find(
      (u) => u.id === leagueOpponent || u.name === leagueOpponent || resolvePlayerDisplayName(u) === leagueOpponent
    );
    if (foundInLeague) return foundInLeague;

    if (users && users[leagueOpponent]) return users[leagueOpponent];

    if (users) {
      const foundInUsers = Object.values(users).find(
        (u) => u.id === leagueOpponent || u.name === leagueOpponent || resolvePlayerDisplayName(u) === leagueOpponent
      );
      if (foundInUsers) return foundInUsers;
    }

    return null;
  }, [leagueOpponent, allLeagueUsers, users]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setIsAnimatingIn(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!slot) return;
    if (!leagueOpponent) {
      setError('Bitte wähle einen Hobbyliga-Gegner aus.');
      return;
    }
    if (playerCollision) {
      setError(playerCollision.errorMessage);
      return;
    }
    if (isSelectedCourtOccupied) {
      setError(collisionWarning || 'Dieser Zeitslot ist auf dem gewählten Platz bereits belegt.');
      return;
    }
    if (currentDuration < 2 && facilityClosingIdx > TIME_SLOTS.indexOf(modalStartTime) + 1) {
      setError(`Hobbyliga-Matches müssen mindestens 2 Stunden dauern (aktuell: ${currentDuration.toFixed(1)} Std.).`);
      return;
    }
    if (currentDuration > 3) {
      setError(`Hobbyliga-Matches dürfen maximal 3 Stunden dauern (aktuell: ${currentDuration.toFixed(1)} Std.).`);
      return;
    }

    const courtToBook = selectedCourt || slot.court || 'Platz 1';

    setIsSubmitting(true);
    setError(null);

    const oppDisplayName = leagueOpponentName || leagueOpponent;
    const players = [spieler1Name, oppDisplayName].filter(Boolean);
    const fullComment = comment ? `[Ligaspiel] ${comment}` : '[Ligaspiel]';

    try {
      // Re-verify player collision asynchronously across clubs right before saving
      const freshCollision = await checkPlayerCollisionAsync({
        date: slot.date,
        startTime: modalStartTime,
        endTime,
        players: [currentUser, { id: leagueOpponent, name: oppDisplayName }],
        currentClubId: selectedFacilityClubId,
        currentClubBookings,
        knownClubIds: (propAllClubs || []).map((c: any) => c.vereinsId || c.id).filter(Boolean),
      });

      if (freshCollision) {
        setError(freshCollision.errorMessage);
        setIsSubmitting(false);
        return;
      }

      const currentNorm = String(clubId || 'sv-neuhausen').toLowerCase().replace(/\s/g, '');
      const selNorm = String(selectedFacilityClubId).toLowerCase().replace(/\s/g, '');

      if (selNorm === currentNorm && onBook) {
        const result = await onBook(
          slot.date,
          modalStartTime,
          endTime,
          courtToBook,
          players,
          false,
          0,
          undefined,
          fullComment
        );
        if (result) {
          setError(result);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Multi-tenant booking on the selected facility
        const startIndex = TIME_SLOTS.indexOf(modalStartTime);
        const endIndex = TIME_SLOTS.indexOf(endTime);
        const slotsToBook = TIME_SLOTS.slice(startIndex, endIndex);

        for (const t of slotsToBook) {
          const bookingData: Booking = {
            id: `slot_${slot.date}_${t.replace(':', '-')}_${courtToBook.replace(/\s+/g, '_')}`,
            date: slot.date,
            time: t,
            court: courtToBook,
            players,
            userId: currentUser.id,
            comment: fullComment,
            isLeagueBooking: true,
            createdAt: new Date().toISOString(),
          };
          await saveBooking(selectedFacilityClubId, bookingData);
        }
      }

      // Create match record in league_matches collection
      try {
        await createLeagueMatch({
          clubId: selectedFacilityClubId,
          clubName: venueClubName,
          facilityName: venueClubName,
          court: courtToBook,
          leagueId: activeLeagueId,
          player1Id: currentUser.id,
          player2Id: leagueOpponent,
          player1UserId: currentUser.id,
          player2UserId: leagueOpponent,
          status: 'scheduled',
          scheduledDate: slot.date,
          scheduledStartTime: modalStartTime,
          scheduledEndTime: endTime,
        });
        window.dispatchEvent(new CustomEvent('league-result-added'));
      } catch (matchErr) {
        console.error('Failed to create scheduled league match:', matchErr);
      }

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Buchung fehlgeschlagen wegen eines Konflikts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !slot) return null;

  return createPortal(
    <>
      {/* MOBILE DRAWER (lg:hidden) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bottom-16 z-[99999] flex items-stretch justify-center bg-white p-0">
        <div className="bg-[var(--color-primary)] w-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-300 flex flex-col h-full rounded-none border-0 shadow-none">
          {/* Header */}
          <div className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 border-b border-white/10 overflow-hidden">
            {/* Background Relief Watermark */}
            <div className="absolute -bottom-8 -right-4 text-white opacity-[0.08] z-0 pointer-events-none transform -rotate-12">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[130px] h-[130px]"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
              </svg>
            </div>
            <div className="relative z-10">
              <div className="text-[10px] uppercase font-bold tracking-widest text-white/80">
                Ligaspiel buchen
              </div>
              <div className="text-lg font-black flex items-center gap-1.5 mt-0.5">
                <span>{formattedSlotDate || slot.date}</span>
                <span>•</span>
                <span>{selectedCourt || slot.court}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-base font-medium cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="bg-amber-50/50 p-4 pb-4 space-y-4 overflow-y-auto flex-1 text-slate-700">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-2 animate-pulse text-[10px] font-bold">
                  <i className="fa-solid fa-circle-exclamation text-base shrink-0"></i>
                  <span>{error}</span>
                </div>
              )}

              {courtNotice && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 h-8 px-3 py-1 rounded-xl flex items-center gap-2 text-[10px] font-sans font-medium">
                  <i className="fa-solid fa-circle-info text-blue-600 text-xs shrink-0"></i>
                  <span>{courtNotice}</span>
                </div>
              )}

              {collisionWarning && (
                <div className={`border-2 p-3 rounded-xl flex items-start gap-3 text-[11px] font-bold shadow-sm ${
                  playerCollision
                    ? 'bg-red-50 border-red-500 text-red-950'
                    : 'bg-amber-50 border-amber-400 text-amber-950'
                }`}>
                  <i className={`fa-solid ${playerCollision ? 'fa-circle-xmark text-red-600' : 'fa-triangle-exclamation text-amber-600'} text-base shrink-0 mt-0.5`}></i>
                  <div className="flex-1">
                    {playerCollision && (
                      <div className="text-[10px] uppercase tracking-wider text-red-700 font-black mb-0.5">
                        Terminkonflikt (Spieler bereits gebucht)
                      </div>
                    )}
                    <span>{collisionWarning}</span>
                  </div>
                </div>
              )}

              {/* Austragungsort Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm shrink-0 overflow-hidden">
                <div className="h-24 w-full relative bg-slate-200 rounded-t-xl overflow-hidden">
                  {venuePhoto ? (
                    <img
                      src={venuePhoto}
                      alt="Austragungsort Anlage"
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end justify-between p-3">
                    <div className="text-white min-w-0 flex-1">
                      <div className="text-[9px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5 leading-none mb-1">
                        <i className="fa-solid fa-location-dot"></i>
                        Austragungsort
                      </div>
                      <div className="text-xs font-black truncate drop-shadow-sm text-white">
                        {venueClubName}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 bg-white flex items-center justify-between gap-2 rounded-b-xl">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-slate-700 hover:text-[var(--color-primary)] flex items-center gap-1.5 min-w-0 transition-colors group cursor-pointer"
                    title="In Google Maps öffnen"
                  >
                    <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                    <span className="truncate">{displayAddress}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400 group-hover:text-[var(--color-primary)] shrink-0 transition-colors"></i>
                  </a>
                </div>
              </div>

              {/* Anlage wählen */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                  Anlage wählen
                </label>
                <div className="relative">
                  <select
                    value={currentFacilitySelectValue}
                    onChange={(e) => handleSwitchFacility(e.target.value)}
                    className="w-full h-8 px-3 py-1 pr-8 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 font-sans font-medium"
                  >
                    {availableClubsList.map((c) => {
                      const cId = c.vereinsId || c.id;
                      return (
                        <option key={cId} value={cId} className="text-slate-800">
                          {c.clubName || c.name || cId} {c.city ? `(${c.city})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                </div>
              </div>

              {/* Platz wählen */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                  Platz wählen
                </label>
                <div className="relative">
                  <select
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    className="w-full h-8 px-3 py-1 pr-8 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 font-sans font-medium"
                  >
                    {courtOptions.map(({ name, isAvailable }) => (
                      <option
                        key={name}
                        value={name}
                        disabled={!isAvailable}
                        className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                      >
                        {name} {!isAvailable ? '(belegt)' : ''}
                      </option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                </div>
              </div>

              {/* Zeitraum */}
              <div className={`p-3 rounded-xl border transition-all grid grid-cols-2 gap-3 shrink-0 shadow-sm ${
                playerCollision ? 'bg-red-50/20 border-red-500 ring-2 ring-red-100' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Ab
                  </label>
                  <select
                    value={modalStartTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setModalStartTime(newStart);
                      const startIdx = TIME_SLOTS.indexOf(newStart);
                      if (startIdx >= 0) {
                        const closingIdx = facilityClosingIdx >= 0 ? facilityClosingIdx : TIME_SLOTS.length - 1;
                        const endIdx = Math.min(closingIdx, startIdx + 2);
                        setEndTime(TIME_SLOTS[endIdx] || TIME_SLOTS[startIdx + 1] || newStart);
                      }
                    }}
                    className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer font-sans font-medium"
                  >
                    {TIME_SLOTS.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t} Uhr
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Bis (2 - 3 Std.)
                  </label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer font-sans font-medium"
                  >
                    {leagueEndTimeOptions.map((t) => {
                      const dur = getDurationInHours(modalStartTime, t);
                      return (
                        <option key={t} value={t}>
                          {t} Uhr ({dur.toFixed(dur % 1 === 0 ? 0 : 1)} Std.)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Validation Warning */}
              {currentDuration > 0 && currentDuration < 2 && (
                <div className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600 text-xs shrink-0"></i>
                  <span>Mindestspieldauer: 2 Stunden (aktuell: {currentDuration.toFixed(1)} Std.).</span>
                </div>
              )}
              {currentDuration > 3 && (
                <div className="text-[10px] font-bold text-red-800 bg-red-100/90 border border-red-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation text-red-600 text-xs shrink-0"></i>
                  <span>Maximaldauer: 3 Stunden (aktuell: {currentDuration.toFixed(1)} Std.).</span>
                </div>
              )}

              {/* Spieler 1 & Gegner */}
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    Spieler 1 (Eingeloggt)
                  </label>
                  <div className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    <i className="fa-solid fa-user-check text-[var(--color-primary)]"></i>
                    {spieler1Name}
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    Gegner
                  </label>
                  {!leagueOpponent ? (
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"></i>
                      <input
                        type="text"
                        value={leagueOpponentQuery}
                        onChange={(e) => setLeagueOpponentQuery(e.target.value)}
                        onFocus={() => setShowLeagueSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 250)}
                        placeholder="Gegner suchen..."
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-xs transition-all shadow-sm font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                      {showLeagueSuggestions && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                          {filteredLeagueUsers.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center font-medium">
                              Keine Spieler gefunden
                            </div>
                          ) : (
                            filteredLeagueUsers.map((u) => {
                              const disp = resolvePlayerDisplayName(u);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setLeagueOpponent(u.id);
                                    setLeagueOpponentName(disp);
                                    setShowLeagueSuggestions(false);
                                    setLeagueOpponentQuery('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <UserAvatar
                                      user={u}
                                      name={disp}
                                      size="xs"
                                      className="shrink-0"
                                    />
                                    <span className="font-bold text-slate-800 truncate">{disp}</span>
                                  </div>
                                  {u.clubTag && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded shrink-0">
                                      {u.clubTag}
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between h-8 px-3 py-1 bg-white border border-amber-200 rounded-xl shadow-sm font-sans font-medium">
                      <div className="flex items-center gap-3 truncate">
                        <UserAvatar
                          user={opponentUser}
                          avatarUrl={opponentUser?.avatarUrl}
                          avatarIcon={opponentUser?.avatarIcon}
                          name={leagueOpponentName || (opponentUser ? resolvePlayerDisplayName(opponentUser) : leagueOpponent)}
                          size="xs"
                          className="shrink-0"
                        />
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {leagueOpponentName || (opponentUser ? resolvePlayerDisplayName(opponentUser) : leagueOpponent)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLeagueOpponent(null);
                          setLeagueOpponentName('');
                        }}
                        className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm cursor-pointer shrink-0"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>

                {/* Notiz */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                    Notiz / Bemerkung (optional)
                  </label>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="z. B. Hobbyliga Match..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-xs transition-all shadow-sm font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Mobile Action Footer */}
            <div className="p-3 bg-white border-t border-slate-200 shrink-0 shadow-lg space-y-2">
              <div className="flex justify-end gap-3 items-center">
                <button
                  onClick={handleClose}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl shadow-sm transition-all uppercase tracking-wider text-[10px] active:scale-95 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !leagueOpponent || isSelectedCourtOccupied || !!playerCollision}
                  className="flex-1 text-white rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: settings?.primaryColor || 'var(--color-primary)' }}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-[12px]"></i>
                      Wird gebucht...
                    </>
                  ) : (
                    "Ligaspiel eintragen"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP MODAL / DRAWER (hidden lg:flex) */}
      <div className="hidden lg:flex fixed inset-0 z-[99999] items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="fixed inset-0"
          onClick={handleClose}
        />
        <div
          className={`relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-out transform ${
            isAnimatingIn && !isClosing ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div
            className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden"
            style={{ backgroundColor: settings?.primaryColor || 'var(--color-primary)' }}
          >
            {/* Background Relief Watermark */}
            <div className="absolute -bottom-8 -right-4 text-white opacity-[0.08] z-0 pointer-events-none transform -rotate-12">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[130px] h-[130px]"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
              </svg>
            </div>
            
            <div className="relative z-10 min-w-0 pr-4">
              <div className="text-[11px] uppercase font-black tracking-widest text-white/80 flex items-center gap-1.5">
                <i className="fa-solid fa-calendar-check"></i> Ligaspiel buchen
              </div>
              <div className="text-lg font-black flex items-center gap-2 mt-0.5 text-white truncate">
                <span>{formattedSlotDate || slot.date}</span>
                <span>•</span>
                <span>{selectedCourt || slot.court}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-5 pt-4 pb-0 shrink-0">
              <div className="bg-red-50 border-x-4 border-red-500 text-red-700 h-8 px-3 py-1 flex items-center gap-2 animate-pulse text-[11px] shadow-sm font-sans font-medium">
                <i className="fa-solid fa-circle-exclamation text-base shrink-0"></i>
                <span>{error}</span>
              </div>
            </div>
          )}

          {courtNotice && (
            <div className="px-5 pt-3 pb-0 shrink-0">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 h-8 px-3 py-1 rounded-xl flex items-center gap-2 text-[11px] font-sans font-medium">
                <i className="fa-solid fa-circle-info text-blue-600 text-xs shrink-0"></i>
                <span>{courtNotice}</span>
              </div>
            </div>
          )}

          {collisionWarning && (
            <div className="px-5 pt-3 pb-0 shrink-0">
              <div className={`border-2 p-3 rounded-xl flex items-start gap-3 text-xs font-bold shadow-sm ${
                playerCollision
                  ? 'bg-red-50 border-red-500 text-red-950'
                  : 'bg-amber-50 border-amber-400 text-amber-950'
              }`}>
                <i className={`fa-solid ${playerCollision ? 'fa-circle-xmark text-red-600' : 'fa-triangle-exclamation text-amber-600'} text-base shrink-0 mt-0.5`}></i>
                <div className="flex-1">
                  {playerCollision && (
                    <div className="text-[10px] uppercase tracking-wider text-red-700 font-black mb-0.5">
                      Terminkonflikt (Spieler bereits gebucht)
                    </div>
                  )}
                  <span>{collisionWarning}</span>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Form Content */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 overflow-y-auto flex-1 bg-amber-50/50" style={{ isolation: 'isolate' }}>
              <div className="space-y-5">
                {/* Austragungsort Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm shrink-0 overflow-hidden">
                  <div className="h-28 w-full relative bg-slate-200 rounded-t-xl overflow-hidden">
                    {venuePhoto ? (
                      <img
                        src={venuePhoto}
                        alt="Austragungsort Anlage"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end justify-between p-3">
                      <div className="text-white min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5 leading-none mb-1">
                          <i className="fa-solid fa-location-dot"></i>
                          Austragungsort
                        </div>
                        <div className="text-sm font-black truncate drop-shadow-sm text-white">
                          {venueClubName}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white flex items-center justify-between gap-3 rounded-b-xl">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                        <span className="truncate">{displayAddress}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {selectedCourt || slot.court} • Treffpunkt vor Ort
                      </div>
                    </div>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors border border-slate-200 shrink-0 shadow-2xs hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                      In Google Maps
                    </a>
                  </div>
                </div>

                {/* Anlage wählen */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    Anlage wählen
                  </label>
                  <div className="relative">
                    <select
                      value={currentFacilitySelectValue}
                      onChange={(e) => handleSwitchFacility(e.target.value)}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 font-sans font-medium"
                    >
                      {availableClubsList.map((c) => {
                        const cId = c.vereinsId || c.id;
                        return (
                          <option key={cId} value={cId} className="text-slate-800">
                            {c.clubName || c.name || cId} {c.city ? `(${c.city})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                </div>

                {/* Platz wählen */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    Platz wählen
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCourt}
                      onChange={(e) => setSelectedCourt(e.target.value)}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer text-slate-800 font-sans font-medium"
                    >
                      {courtOptions.map(({ name, isAvailable }) => (
                        <option
                          key={name}
                          value={name}
                          disabled={!isAvailable}
                          className={!isAvailable ? 'text-slate-400 bg-slate-100' : 'text-slate-800'}
                        >
                          {name} {!isAvailable ? '(belegt)' : ''}
                        </option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                </div>

                {/* Zeitraum */}
                <div className={`p-4 rounded-xl border transition-all grid grid-cols-2 gap-4 shrink-0 shadow-sm ${
                  playerCollision ? 'bg-red-50/20 border-red-500 ring-2 ring-red-100' : 'bg-white border-slate-200'
                }`}>
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                      Ab
                    </label>
                    <select
                      value={modalStartTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setModalStartTime(newStart);
                        const startIdx = TIME_SLOTS.indexOf(newStart);
                        if (startIdx >= 0) {
                          const closingIdx = facilityClosingIdx >= 0 ? facilityClosingIdx : TIME_SLOTS.length - 1;
                          const endIdx = Math.min(closingIdx, startIdx + 2);
                          setEndTime(TIME_SLOTS[endIdx] || TIME_SLOTS[startIdx + 1] || newStart);
                        }
                      }}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer font-sans font-medium"
                    >
                      {TIME_SLOTS.slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {t} Uhr
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                      Bis (2 - 3 Std.)
                    </label>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer font-sans font-medium"
                    >
                      {leagueEndTimeOptions.map((t) => {
                        const dur = getDurationInHours(modalStartTime, t);
                        return (
                          <option key={t} value={t}>
                            {t} Uhr ({dur.toFixed(dur % 1 === 0 ? 0 : 1)} Std.)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Validation Warnings */}
                {currentDuration > 0 && currentDuration < 2 && (
                  <div className="text-xs font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-3 py-2 rounded-xl flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm shrink-0"></i>
                    <span>Mindestspieldauer für Ligaspiele: 2 Stunden (aktuell: {currentDuration.toFixed(1)} Std.).</span>
                  </div>
                )}
                {currentDuration > 3 && (
                  <div className="text-xs font-bold text-red-800 bg-red-100/90 border border-red-300 px-3 py-2 rounded-xl flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-red-600 text-sm shrink-0"></i>
                    <span>Maximaldauer für Ligaspiele: 3 Stunden (aktuell: {currentDuration.toFixed(1)} Std.).</span>
                  </div>
                )}

                {/* Spieler 1 & Gegner Search */}
                <div className="space-y-4 mt-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Spieler 1 (Eingeloggt)
                    </label>
                    <div className="font-bold text-[13px] text-[var(--color-primary)] flex items-center gap-1.5">
                      <i className="fa-solid fa-user-check text-[var(--color-primary)]"></i>
                      {spieler1Name}
                    </div>
                  </div>

                  <div className="space-y-2.5 relative">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Gegner
                    </label>
                    {!leagueOpponent ? (
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs pointer-events-none"></i>
                        <input
                          type="text"
                          value={leagueOpponentQuery}
                          onChange={(e) => setLeagueOpponentQuery(e.target.value)}
                          onFocus={() => setShowLeagueSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 250)}
                          placeholder="Gegner suchen (Name oder Verein)..."
                          className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-xs transition-all shadow-sm font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                        {showLeagueSuggestions && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                            {filteredLeagueUsers.length === 0 ? (
                              <div className="p-3 text-xs text-slate-400 text-center font-medium">
                                Keine Spieler gefunden
                              </div>
                            ) : (
                              filteredLeagueUsers.map((u) => {
                                const disp = resolvePlayerDisplayName(u);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setLeagueOpponent(u.id);
                                      setLeagueOpponentName(disp);
                                      setShowLeagueSuggestions(false);
                                      setLeagueOpponentQuery('');
                                    }}
                                    className="w-full text-left h-8 px-3 py-1 text-xs hover:bg-amber-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 font-sans font-medium"
                                  >
                                    <div className="flex items-center gap-3 truncate">
                                      <UserAvatar
                                        user={u}
                                        name={disp}
                                        size="xs"
                                        className="shrink-0"
                                      />
                                      <span className="font-bold text-slate-800 truncate">{disp}</span>
                                    </div>
                                    {u.clubTag && (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded shrink-0">
                                        {u.clubTag}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 truncate">
                          <UserAvatar
                            user={opponentUser}
                            avatarUrl={opponentUser?.avatarUrl}
                            avatarIcon={opponentUser?.avatarIcon}
                            name={leagueOpponentName || (opponentUser ? resolvePlayerDisplayName(opponentUser) : leagueOpponent)}
                            size="sm"
                            className="shrink-0"
                          />
                          <span className="font-bold text-sm text-slate-800 truncate">
                            {leagueOpponentName || (opponentUser ? resolvePlayerDisplayName(opponentUser) : leagueOpponent)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLeagueOpponent(null);
                            setLeagueOpponentName('');
                          }}
                          className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm border border-slate-200 cursor-pointer shrink-0"
                        >
                          <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notiz / Bemerkung */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Notiz / Bemerkung (optional)
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="z. B. Hobbyliga Match..."
                      className="w-full h-8 px-3 py-1 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-accent)] outline-none text-slate-900 text-xs transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Action Footer */}
            <div className="px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0 space-y-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] z-10">
              <div className="flex justify-end gap-3 items-center w-full">
                <button
                  onClick={handleClose}
                  className="px-6 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold h-10 text-sm rounded-xl shadow-sm transition-all uppercase tracking-wider active:scale-95 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !leagueOpponent || isSelectedCourtOccupied || !!playerCollision}
                  className="flex-1 max-w-[240px] text-white rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 h-10 text-sm font-medium hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: settings?.primaryColor || 'var(--color-primary)' }}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-[12px]"></i>
                      Wird gebucht...
                    </>
                  ) : (
                    "Ligaspiel eintragen"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
