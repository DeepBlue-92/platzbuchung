import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LeagueMatch } from '../../types';
import { UserAvatar } from '../UserAvatar';
import {
  X,
  Trophy,
  Shield,
  TrendingUp,
  Swords,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  getCanonicalClubId,
  getSanitizedClubDisplayName,
  getClubLogoUrl,
  resolveClubName,
} from '../../services/clubHelper';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface HobbyligaPlayerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile: any | null;
  currentUser: User;
  getUserObject: (userId: string) => User | undefined | null;
  getUserRank: (userId: string) => number | undefined;
  getUserName?: (userId: string) => string;
  matches: LeagueMatch[];
  allProfiles: any[];
  participatingClubs?: any[];
}

export const HobbyligaPlayerDrawer: React.FC<HobbyligaPlayerDrawerProps> = ({
  isOpen,
  onClose,
  playerProfile,
  currentUser,
  getUserObject,
  getUserRank,
  getUserName,
  matches,
  allProfiles,
  participatingClubs = [],
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const matchesPerPage = 10;

  const targetUserId = playerProfile?.userId || playerProfile?.id;

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [isOpen, targetUserId]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Background Scroll Lock & Wheel Event Isolation
  useEffect(() => {
    if (!isOpen) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // Compensate scrollbar width to prevent horizontal layout shift
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // Both documentElement and body must be locked because index.html defines html { overflow-y: scroll; }
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Intercept wheel events on desktop to prevent scroll chaining and background shifts
    const handleWheel = (e: WheelEvent) => {
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) {
        e.preventDefault();
        return;
      }

      // If wheel event happened outside the scrollable content (e.g. on backdrop, header, stats)
      if (!scrollEl.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }

      // Inside scrollable area: check if content exceeds height
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const isScrollable = scrollHeight > clientHeight + 1;

      // When the profile content does not exceed drawer height (nothing to scroll)
      if (!isScrollable) {
        e.preventDefault();
        return;
      }

      // Boundary check to prevent scroll chaining to the background page
      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

      if (e.deltaY < 0 && isAtTop) {
        e.preventDefault();
      } else if (e.deltaY > 0 && isAtBottom) {
        e.preventDefault();
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) {
        e.preventDefault();
        return;
      }

      if (!scrollEl.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const isScrollable = scrollHeight > clientHeight + 1;

      if (!isScrollable) {
        e.preventDefault();
        return;
      }

      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartY - currentY;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

        if (deltaY < 0 && isAtTop) {
          e.preventDefault();
        } else if (deltaY > 0 && isAtBottom) {
          e.preventDefault();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          return;
        }
        const scrollEl = scrollContainerRef.current;
        if (!scrollEl) {
          e.preventDefault();
          return;
        }
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const isScrollable = scrollHeight > clientHeight + 1;
        if (!isScrollable) {
          e.preventDefault();
          return;
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const userObj = targetUserId ? getUserObject(targetUserId) : null;
  const isCurrentUser = Boolean(
    targetUserId &&
      currentUser &&
      (String(targetUserId) === String(currentUser.id) ||
        (currentUser.uid && String(targetUserId) === String(currentUser.uid)))
  );

  // Name des Spielers
  const playerName = useMemo(() => {
    if (!targetUserId) return '';
    if (getUserName) return getUserName(targetUserId);
    return userObj?.displayName || userObj?.name || playerProfile?.userName || 'Spieler';
  }, [targetUserId, getUserName, userObj, playerProfile]);

  // Dynamischer User für Avatar & Initialen (identisch zu Profil Bearbeiten)
  const effectiveUser = useMemo(() => {
    if (isCurrentUser) return currentUser;
    if (userObj) return userObj;
    return { name: playerName, displayName: playerName } as any;
  }, [isCurrentUser, currentUser, userObj, playerName]);

  // Rang & Punkte
  const currentRank = useMemo(() => {
    if (!targetUserId) return 1;
    return getUserRank(targetUserId) ?? 1;
  }, [targetUserId, getUserRank]);

  const livePoints = useMemo(() => {
    if (!playerProfile) return '0.0';
    return playerProfile.livePoints !== undefined
      ? Number(playerProfile.livePoints).toFixed(1)
      : '0.0';
  }, [playerProfile]);

  // Bereinigter Vereinsname & Wappen/Favicon
  const clubInfo = useMemo(() => {
    const rawClub = userObj?.vereinsId || playerProfile?.clubId;
    if (!rawClub) return null;
    const displayName = getSanitizedClubDisplayName(rawClub, participatingClubs);
    const logoUrl = getClubLogoUrl(rawClub, participatingClubs);
    return { displayName, logoUrl };
  }, [userObj, playerProfile, participatingClubs]);

  // Alle abgeschlossenen Ligaspiele dieses Spielers (chronologisch absteigend für Historie)
  const playerCompletedMatches = useMemo(() => {
    if (!targetUserId) return [];
    return (matches || [])
      .filter((m) => {
        if (m.status !== 'completed') return false;
        const p1 = m.player1UserId || m.player1Id;
        const p2 = m.player2UserId || m.player2Id;
        return p1 === targetUserId || p2 === targetUserId;
      })
      .sort((a, b) => {
        const timeA = new Date(a.played_at || a.scheduledDate || a.createdAt).getTime();
        const timeB = new Date(b.played_at || b.scheduledDate || b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [matches, targetUserId]);

  // Quick Stats: Siege, Niederlagen, Quote
  const matchStats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    playerCompletedMatches.forEach((m) => {
      if (m.result?.winnerId === targetUserId) {
        wins++;
      } else {
        losses++;
      }
    });
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, total, winRate };
  }, [playerCompletedMatches, targetUserId]);

  // Head-to-Head: Duelle zwischen currentUser und targetUserId
  const h2hData = useMemo(() => {
    if (!targetUserId || isCurrentUser) {
      return { matches: [], userWins: 0, targetWins: 0 };
    }

    const h2h = (matches || [])
      .filter((m) => {
        if (m.status !== 'completed') return false;
        const p1 = m.player1UserId || m.player1Id;
        const p2 = m.player2UserId || m.player2Id;
        return (
          (p1 === currentUser.id && p2 === targetUserId) ||
          (p2 === currentUser.id && p1 === targetUserId)
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.played_at || a.scheduledDate || a.createdAt).getTime();
        const timeB = new Date(b.played_at || b.scheduledDate || b.createdAt).getTime();
        return timeB - timeA;
      });

    let userWins = 0;
    let targetWins = 0;
    h2h.forEach((m) => {
      if (m.result?.winnerId === currentUser.id) {
        userWins++;
      } else if (m.result?.winnerId === targetUserId) {
        targetWins++;
      }
    });

    return { matches: h2h, userWins, targetWins };
  }, [matches, targetUserId, isCurrentUser, currentUser.id]);

  // Sparkline Chart: Ranglisten-Verlauf der letzten Wochen/Monate (chronologisch aufsteigend)
  const sparklineData = useMemo(() => {
    if (!targetUserId) return [];

    const chronological = [...playerCompletedMatches].reverse();
    const dataPoints: { date: string; rank: number; points: number }[] = [];

    let runningPoints = 100.0;
    const totalPlayers = Math.max((allProfiles || []).length || 1, 5);
    const initialRank = Math.min(totalPlayers, Math.max(1, Math.ceil(totalPlayers / 2)));

    // Start-Punkt
    const firstDate = chronological.length > 0
      ? new Date(chronological[0].played_at || chronological[0].createdAt)
      : new Date();
    const startDate = new Date(firstDate);
    startDate.setDate(startDate.getDate() - 7);

    dataPoints.push({
      date: startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      rank: initialRank,
      points: 100,
    });

    chronological.forEach((m) => {
      const isP1 = (m.player1UserId || m.player1Id) === targetUserId;
      const pts = isP1 ? (m.pointsAwarded?.player1 || 0) : (m.pointsAwarded?.player2 || 0);
      runningPoints += pts;

      const betterCount = (allProfiles || []).filter(
        (p) => p.userId !== targetUserId && (p.livePoints ?? 100) > runningPoints
      ).length;
      const estRank = Math.max(1, betterCount + 1);

      const mDate = new Date(m.played_at || m.scheduledDate || m.createdAt);
      dataPoints.push({
        date: mDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        rank: estRank,
        points: Number((Math.max(0, runningPoints) || 0).toFixed(1)),
      });
    });

    // Aktueller Live-Punkt
    dataPoints.push({
      date: 'Heute',
      rank: currentRank,
      points: Number(livePoints),
    });

    // Falls weniger als 2 Punkte, mit sauberem Baseline-Punkt auffüllen
    if (dataPoints.length < 2) {
      return [
        { date: 'Start', rank: currentRank, points: Number(livePoints) },
        { date: 'Heute', rank: currentRank, points: Number(livePoints) },
      ];
    }

    return dataPoints;
  }, [targetUserId, playerCompletedMatches, allProfiles, currentRank, livePoints]);

  // Paginierung für Gespielte Partien
  const totalPages = Math.ceil(playerCompletedMatches.length / matchesPerPage);
  const indexOfLastMatch = currentPage * matchesPerPage;
  const indexOfFirstMatch = indexOfLastMatch - matchesPerPage;
  const paginatedMatches = playerCompletedMatches.slice(indexOfFirstMatch, indexOfLastMatch);

  return (
    <AnimatePresence>
      {isOpen && playerProfile && (
        <>
          {/* BACKDROP (IDENTISCH ZU PROFIL BEARBEITEN) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-[2px] transition-opacity overscroll-contain"
          />

          {/* SLIDE-OVER DRAWER (IDENTISCHE BREITE, SCHATTEN & ANIMATION ZU PROFIL BEARBEITEN) */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 h-[100dvh] w-full lg:w-[450px] bg-white shadow-2xl z-[100000] flex flex-col border-none outline-none overflow-hidden pointer-events-auto overscroll-contain"
          >
            {/* 1. KOMPAKTER HEADER (DUNKELGRÜN, FLUID & MINIMAL VISUAL NOISE) */}
            <div
              className="relative z-20 shrink-0 bg-[var(--color-primary)] text-white shadow-sm py-3 px-4 sm:px-5"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {/* KOMPAKTE HORIZONTALE ZEILE: AVATAR + NAME + VEREINS-BADGE + SCHLIESSEN BUTTON */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <UserAvatar
                    user={effectiveUser}
                    avatarUrl={effectiveUser?.avatarUrl}
                    avatarIcon={effectiveUser?.avatarIcon}
                    name={playerName}
                    fallbackMode="initials"
                    size="md"
                    className="shrink-0 ring-2 ring-white/30 shadow-xs"
                  />

                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                      {playerName}
                    </h2>

                    {/* VEREINS-BADGE */}
                    {clubInfo?.displayName && (
                      <div className="inline-flex items-center gap-1 bg-black/20 border border-white/20 px-2 py-0.5 rounded-full text-[11px] font-medium text-white shrink-0">
                        {clubInfo.logoUrl ? (
                          <img
                            src={clubInfo.logoUrl}
                            alt=""
                            className="w-3 h-3 rounded-full object-contain bg-white shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Shield className="w-3 h-3 text-white/80 shrink-0" />
                        )}
                        <span className="truncate max-w-[130px] sm:max-w-[170px]">{clubInfo.displayName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SCHLIESSEN BUTTON RECHTS */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white shrink-0 cursor-pointer border border-white/15"
                  title="Schließen"
                  aria-label="Schließen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3 STATS-KARTEN (FLACHE, DEZENT INTEGRIERTE LEISTE) */}
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {/* Stat 1: Aktueller Rang */}
                <div className="bg-black/20 border border-white/10 rounded-lg py-1.5 px-3 text-center shadow-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75 block leading-tight">
                    Rang
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white mt-0.5 block leading-none">
                    #{currentRank}
                  </span>
                </div>

                {/* Stat 2: Gesamtpunkte */}
                <div className="bg-black/20 border border-white/10 rounded-lg py-1.5 px-3 text-center shadow-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75 block leading-tight">
                    Punkte
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white mt-0.5 block leading-none">
                    {livePoints}
                  </span>
                </div>

                {/* Stat 3: Bilanz */}
                <div className="bg-black/20 border border-white/10 rounded-lg py-1.5 px-3 text-center shadow-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75 block leading-tight">
                    Bilanz
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white mt-0.5 block leading-none truncate">
                    {matchStats.wins}S / {matchStats.losses}N
                  </span>
                </div>
              </div>
            </div>

            {/* SCROLLABLE INHALTSBEREICH (DARUNTER LIEGENDER INHALT) */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 bg-slate-50/60 subtle-scrollbar"
            >
              {/* 1. ENTWICKLUNG (CHART / SPARKLINE) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 order-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                      Entwicklung
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Rang (#1 oben)
                    </span>
                    <span className="text-blue-600 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Punkte
                    </span>
                  </div>
                </div>

                {/* RECHARTS ENTWICKLUNG (KOMPAKTERE HÖHE h-48 sm:h-52 FÜR SOFORTIGE SICHTBARKEIT) */}
                <div className="pt-1">
                  <div className="w-full h-48 sm:h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={sparklineData}
                        margin={{ top: 12, right: 6, bottom: 4, left: -14 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                          dy={6}
                        />
                        <YAxis
                          yAxisId="rank"
                          reversed={true}
                          domain={['dataMin - 1', 'dataMax + 1']}
                          tick={{ fontSize: 12, fill: '#059669', fontWeight: 600 }}
                          tickFormatter={(v) => `#${v}`}
                          axisLine={false}
                          tickLine={false}
                          width={38}
                        />
                        <YAxis
                          yAxisId="points"
                          orientation="right"
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 12, fill: '#2563eb', fontWeight: 600 }}
                          tickFormatter={(v) => `${v}`}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900/95 text-white h-8 px-3 py-1 rounded-xl shadow-xl border border-slate-700/80 text-xs sm:text-sm">
                                  <div className="font-semibold text-slate-300 pb-1.5 border-b border-slate-700/70 mb-2 flex items-center justify-between gap-4">
                                    <span>{d.date}</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between gap-4 font-bold text-emerald-400 text-xs sm:text-sm">
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                                        Rang
                                      </span>
                                      <span>#{d.rank}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 font-bold text-blue-300 text-xs sm:text-sm">
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
                                        Punkte
                                      </span>
                                      <span>{d.points} Pkt.</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          yAxisId="rank"
                          type="monotone"
                          dataKey="rank"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                        <Line
                          yAxisId="points"
                          type="monotone"
                          dataKey="points"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          dot={{ r: 3.5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                          activeDot={{ r: 5.5, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            {/* 2. HEAD-TO-HEAD / DIREKTVERGLEICH (NUR BEI FREMDEN PROFILEN) */}
            {!isCurrentUser && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5 order-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                      <Swords className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Direktvergleich
                    </h3>
                  </div>

                  {/* GESAMTBILANZ-BADGE */}
                  {h2hData.matches.length > 0 && (
                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                        h2hData.userWins > h2hData.targetWins
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : h2hData.userWins < h2hData.targetWins
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {h2hData.userWins > h2hData.targetWins
                        ? `${h2hData.userWins} : ${h2hData.targetWins} Duelle für dich`
                        : h2hData.userWins < h2hData.targetWins
                        ? `${h2hData.userWins} : ${h2hData.targetWins} Duelle für ${playerName}`
                        : `${h2hData.userWins} : ${h2hData.targetWins} Ausgeglichen`}
                    </span>
                  )}
                </div>

                {/* BISHERIGE PARTIEN LISTE */}
                {h2hData.matches.length > 0 ? (
                  <div className="space-y-2">
                    {h2hData.matches.map((m) => {
                      const isUserWinner = m.result?.winnerId === currentUser.id;
                      const isP1User = (m.player1UserId || m.player1Id) === currentUser.id;

                      // Satz-Ergebnis (aus Sicht des aktuellen Nutzers)
                      const setsFormatted = m.result?.sets
                        ? isP1User
                          ? m.result.sets.map((s) => `${s.p1}:${s.p2}`).join(', ')
                          : m.result.sets.map((s) => `${s.p2}:${s.p1}`).join(', ')
                        : '-';

                      const dateStr = new Date(
                        m.played_at || m.scheduledDate || m.createdAt
                      ).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });

                      // Austragungsort / Platz
                      const courtStr = m.court ? `${m.court}` : '';
                      const clubStr = m.clubName || (m.clubId ? resolveClubName(m.clubId, undefined, participatingClubs) : '');
                      const venueText = courtStr && clubStr
                        ? `${courtStr} – ${clubStr}`
                        : courtStr || clubStr || 'Hobbyliga Match';

                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between h-8 px-3 py-1 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/70 transition-colors font-sans font-medium"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* FARBIGER INDIKATOR: GRÜN = GEWONNEN, ROT = VERLOREN */}
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isUserWinner
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-200'
                              }`}
                              title={isUserWinner ? 'Gewonnen' : 'Verloren'}
                            >
                              {isUserWinner ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                                <span className={isUserWinner ? 'text-emerald-700' : 'text-slate-700'}>
                                  {isUserWinner ? 'Sieg für dich' : `Sieg für ${playerName}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>{dateStr}</span>
                                <span>&bull;</span>
                                <span className="truncate">{venueText}</span>
                              </div>
                            </div>
                          </div>

                          {/* SATZ-ERGEBNIS */}
                          <div className="text-right shrink-0 pl-2">
                            <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                              {setsFormatted}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* FALLBACK: NOCH KEIN DUELL STATTGEFUNDEN */
                  <div className="py-6 px-4 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <Clock className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-500">
                      Noch keine direkten Duelle absolviert.
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Bisher sind die beiden Spieler in dieser Liga noch nicht aufeinandergetroffen.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3. ALLGEMEINE LIGA-MATCH-HISTORIE DES SPIELERS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 order-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Gespielte Partien
                  </h3>
                </div>
                <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {playerCompletedMatches.length}
                </span>
              </div>

              {/* MATCH LISTE */}
              {paginatedMatches.length > 0 ? (
                <div className="space-y-2">
                  {paginatedMatches.map((m) => {
                    const isWinner = m.result?.winnerId === targetUserId;
                    const isP1 = (m.player1UserId || m.player1Id) === targetUserId;
                    const opponentUserId = isP1
                      ? (m.player2UserId || m.player2Id)
                      : (m.player1UserId || m.player1Id);
                    
                    const oppName = getUserName
                      ? getUserName(opponentUserId)
                      : getUserObject(opponentUserId)?.displayName || 'Gegner';

                    const setsFormatted = m.result?.sets
                      ? isP1
                        ? m.result.sets.map((s) => `${s.p1}:${s.p2}`).join(', ')
                        : m.result.sets.map((s) => `${s.p2}:${s.p1}`).join(', ')
                      : '-';

                    const dateFormatted = new Date(
                      m.played_at || m.scheduledDate || m.createdAt
                    ).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between h-8 px-3 py-1 rounded-xl bg-slate-50/70 border border-slate-100 font-sans font-medium"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                              isWinner
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isWinner ? 'Sieg' : 'Niederlage'}
                          </span>

                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              vs. {oppName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {dateFormatted}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {setsFormatted}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* PAGINATION CONTROLS */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="text-[10px] font-bold uppercase text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:text-slate-800 px-2 py-1 bg-slate-100 rounded-md transition-colors"
                      >
                        Zurück
                      </button>
                      <span className="text-[10px] font-black text-slate-400">
                        Seite {currentPage} von {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="text-[10px] font-bold uppercase text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:text-slate-800 px-2 py-1 bg-slate-100 rounded-md transition-colors"
                      >
                        Weiter
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 px-4 text-center text-slate-400 text-xs">
                  Bisher noch keine Partien absolviert.
                </div>
              )}
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
