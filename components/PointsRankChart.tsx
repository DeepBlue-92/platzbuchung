import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { User, LeaguePlayer, LeagueMatch } from "../types";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Label,
} from "recharts";

interface PointsRankChartProps {
  currentUser: User;
  profile: LeaguePlayer | null;
  allProfiles: LeaguePlayer[];
  matches: LeagueMatch[];
  users: Record<string, User>;
  onNavigateToRules?: () => void;
}

type TimeRange = "3M" | "6M" | "1J" | "Alle";

interface ChartDataPoint {
  id: string;
  timestamp: number;
  dateStr: string;
  points: number;
  pointsDelta: number;
  rank: number;
  matchDetails?: string;
  opponentName?: string;
  type: "start" | "match" | "decay";
  isWin?: boolean;
}

export const PointsRankChart: React.FC<PointsRankChartProps> = ({
  currentUser,
  profile,
  allProfiles,
  matches,
  users,
  onNavigateToRules,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1J");

  // Calculate overall player count for rank axis scaling
  const totalPlayers = Math.max(
    allProfiles.filter((p) => p.active !== false).length,
    5
  );

  // Compute full history data points chronologically
  const fullHistoryData = useMemo(() => {
    if (!profile) return [];

    const pointsHistory: ChartDataPoint[] = [];

    // Determine initial creation / start date
    const completedMatches = matches
      .filter((m) => m.status === "completed")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let startDate = new Date();
    if (completedMatches.length > 0) {
      startDate = new Date(completedMatches[0].createdAt);
      startDate.setDate(startDate.getDate() - 7); // 1 week before first match
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    // Start baseline point
    let runningPoints = 100;
    const initialRank = Math.min(totalPlayers, Math.max(1, Math.ceil(totalPlayers / 2)));

    pointsHistory.push({
      id: "start",
      timestamp: startDate.getTime(),
      dateStr: startDate.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }),
      points: 100,
      pointsDelta: 0,
      rank: initialRank,
      matchDetails: "Beitritt Hobbyliga",
      type: "start",
    });

    completedMatches.forEach((m) => {
      const isP1 = m.player1UserId === currentUser.id;
      const opponentId = isP1 ? m.player2UserId : m.player1UserId;

      // Find opponent user object or profile
      const oppUser = Object.values(users).find(
        (u) => u.id === opponentId || u.name === opponentId
      );
      const opponentName = oppUser
        ? `${oppUser.firstName || ""} ${oppUser.lastName || ""}`.trim() || oppUser.name
        : "Gegner";

      const ptsAwarded = isP1
        ? m.pointsAwarded?.player1 || 0
        : m.pointsAwarded?.player2 || 0;

      const isWin = isP1
        ? (m.result?.player1Sets || 0) > (m.result?.player2Sets || 0)
        : (m.result?.player2Sets || 0) > (m.result?.player1Sets || 0);

      const setsStr = m.result
        ? `${m.result.player1Sets}:${m.result.player2Sets}`
        : "";

      runningPoints += ptsAwarded;
      const matchDate = new Date(m.createdAt);

      // Estimate rank at this point based on runningPoints compared to other profiles
      const betterCount = allProfiles.filter(
        (p) => p.userId !== currentUser.id && (p.livePoints ?? 0) > runningPoints
      ).length;
      const estimatedRank = Math.max(1, betterCount + 1);

      const matchLabel = `${isWin ? "Sieg" : "Niederlage"} vs. ${opponentName}${
        setsStr ? ` (${setsStr})` : ""
      }`;

      pointsHistory.push({
        id: m.id,
        timestamp: matchDate.getTime(),
        dateStr: matchDate.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        }),
        points: Number((Math.max(0, runningPoints) || 0).toFixed(1)),
        pointsDelta: Number((ptsAwarded || 0).toFixed(1)),
        rank: estimatedRank,
        matchDetails: matchLabel,
        opponentName,
        type: "match",
        isWin,
      });
    });

    // Ensure current live status point if matches exist and latest point isn't today
    if (completedMatches.length > 0) {
      const now = new Date();
      const lastPoint = pointsHistory[pointsHistory.length - 1];
      const daysDiff = (now.getTime() - lastPoint.timestamp) / (1000 * 3600 * 24);

      if (daysDiff > 1) {
        const livePts = profile?.livePoints ?? 100;
        // Calculate current rank among active profiles
        const sortedActive = [...allProfiles]
          .filter((p) => p.active !== false)
          .sort((a, b) => (b.livePoints ?? 0) - (a.livePoints ?? 0));
        const currentRankIndex = sortedActive.findIndex((p) => p.userId === currentUser.id);
        const currentRank = currentRankIndex !== -1 ? currentRankIndex + 1 : lastPoint.rank;

        pointsHistory.push({
          id: "current",
          timestamp: now.getTime(),
          dateStr: "Heute",
          points: Number((livePts || 0).toFixed(1)),
          pointsDelta: Number(((livePts || 0) - (lastPoint?.points || 0)).toFixed(1)),
          rank: currentRank,
          matchDetails: "Aktueller Stand",
          type: "decay",
        });
      }
    }

    return pointsHistory;
  }, [profile, matches, allProfiles, users, currentUser.id, totalPlayers]);

  // Filter data based on selected time range
  const filteredData = useMemo(() => {
    if (fullHistoryData.length === 0) return [];
    if (timeRange === "Alle") return fullHistoryData;

    const now = Date.now();
    let daysToSubtract = 365;
    if (timeRange === "3M") daysToSubtract = 90;
    if (timeRange === "6M") daysToSubtract = 180;
    if (timeRange === "1J") daysToSubtract = 365;

    const cutoffTimestamp = now - daysToSubtract * 24 * 60 * 60 * 1000;
    const filtered = fullHistoryData.filter((pt) => pt.timestamp >= cutoffTimestamp);

    // If filtering yields less than 2 points, include at least the last point or start point
    if (filtered.length < 2 && fullHistoryData.length >= 2) {
      return fullHistoryData.slice(-2);
    }
    return filtered.length > 0 ? filtered : fullHistoryData;
  }, [fullHistoryData, timeRange]);

  // Min and max points for nicely bounded Y axis
  const pointsMin = useMemo(() => {
    if (filteredData.length === 0) return 80;
    const minVal = Math.min(...filteredData.map((d) => d.points));
    return Math.max(0, Math.floor(minVal / 10) * 10 - 10);
  }, [filteredData]);

  const pointsMax = useMemo(() => {
    if (filteredData.length === 0) return 150;
    const maxVal = Math.max(...filteredData.map((d) => d.points));
    return Math.ceil(maxVal / 10) * 10 + 10;
  }, [filteredData]);

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ChartDataPoint = payload[0].payload;
      return (
        <div className="bg-white text-slate-900 p-3.5 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2 min-w-[210px] z-50">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-extrabold text-slate-500 text-[11px] uppercase tracking-wider">
              {data.dateStr}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-black text-[10px] border border-amber-200">
              Rang #{data.rank}
            </span>
          </div>

          {data.matchDetails && (
            <div className="flex items-center gap-2 pt-0.5">
              {data.type === "match" ? (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    data.isWin ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] shrink-0" />
              )}
              <span className="font-bold text-slate-800 truncate">{data.matchDetails}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500 font-semibold">Punktestand:</span>
            <div className="text-right">
              <span className="font-black text-slate-900">{(data.points ?? 0).toFixed(1)} Pkt.</span>
              {data.pointsDelta !== 0 && (
                <span
                  className={`ml-1.5 font-bold text-[10px] ${
                    data.pointsDelta > 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  ({data.pointsDelta > 0 ? `+${data.pointsDelta}` : data.pointsDelta})
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[var(--bg-surface,white)] rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-5">
      {/* Header with Title and Time Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
              <i className="fa-solid fa-chart-area text-lg" />
            </span>
            <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">
              Mein Punkte- & Rangverlauf
            </h3>
          </div>
        </div>

        {/* Time Segment Controls */}
        <div className="relative flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
          {(["3M", "6M", "1J", "Alle"] as TimeRange[]).map((range) => {
            const labels: Record<TimeRange, string> = {
              "3M": "3 Monate",
              "6M": "6 Monate",
              "1J": "1 Jahr",
              Alle: "Alle",
            };
            const isActive = timeRange === range;
            return (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`relative z-10 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors active:scale-95 ${
                  isActive
                    ? "text-slate-900 font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="chartTimeRangeIndicator"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/60"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{labels[range]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 md:h-72 w-full pt-2">
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={filteredData}
              margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorPointsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary, #1b4332)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-primary, #1b4332)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />

              <XAxis
                dataKey="dateStr"
                stroke="#64748b"
                tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                dy={5}
              />

              {/* Left Y-Axis: Points */}
              <YAxis
                yAxisId="points"
                orientation="left"
                stroke="#64748b"
                tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                domain={[pointsMin, pointsMax]}
                tickFormatter={(v) => `${v}`}
              >
                <Label
                  value="Punkte"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle", fill: "var(--color-primary, #1b4332)", fontSize: 12, fontWeight: 800 }}
                />
              </YAxis>

              {/* Right Y-Axis: Rank (INVERTED so Rank #1 is at TOP) */}
              <YAxis
                yAxisId="rank"
                orientation="right"
                reversed={true}
                stroke="#d97706"
                tick={{ fill: "#92400e", fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                domain={[1, Math.max(totalPlayers, 10)]}
                allowDecimals={false}
                tickFormatter={(v) => `#${v}`}
              >
                <Label
                  value="Rang #"
                  angle={90}
                  position="insideRight"
                  style={{ textAnchor: "middle", fill: "#d97706", fontSize: 12, fontWeight: 800 }}
                />
              </YAxis>

              <Tooltip content={<CustomTooltip />} />

              {/* Points Area */}
              <Area
                yAxisId="points"
                type="monotone"
                dataKey="points"
                name="Punkte"
                stroke="var(--color-primary, #1b4332)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPointsGradient)"
                dot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--color-primary, #1b4332)",
                  fill: "#ffffff",
                }}
                activeDot={{
                  r: 6,
                  strokeWidth: 3,
                  stroke: "var(--color-primary, #1b4332)",
                  fill: "#ffffff",
                }}
              />

              {/* Rank Line */}
              <Line
                yAxisId="rank"
                type="monotone"
                dataKey="rank"
                name="Rang"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{
                  r: 3.5,
                  strokeWidth: 1.5,
                  stroke: "#d97706",
                  fill: "#ffffff",
                }}
                activeDot={{
                  r: 5.5,
                  strokeWidth: 2,
                  stroke: "#b45309",
                  fill: "#fef3c7",
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Keine Daten für den gewählten Zeitraum verfügbar.
          </div>
        )}
      </div>

      {/* Details zur Punkteberechnung Footer Link */}
      {onNavigateToRules && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onNavigateToRules}
            className="inline-flex items-center gap-1.5 font-extrabold text-xs text-[var(--color-primary)] hover:underline cursor-pointer group"
          >
            <i className="fa-solid fa-circle-info text-[12px] opacity-80 group-hover:opacity-100" />
            <span>Details zur Punkteberechnung &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
};
