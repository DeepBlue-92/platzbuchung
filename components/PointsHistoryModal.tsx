import React, { useEffect, useState } from "react";
import { User, Person, LeagueMatch } from "../types";
import { getPlayerMatches } from "../services/league";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface PointsHistoryModalProps {
  targetUser: User | Person;
  allUsers: Record<string, User>;
  onClose: () => void;
}

interface TimelinePoint {
  date: string;
  opponentName: string;
  result: string;
  pointsDelta: number;
  totalPoints: number;
  type: "start" | "match" | "decay";
}

export const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({
  targetUser,
  allUsers,
  onClose,
}) => {
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const playerName =
    `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() ||
    targetUser.klarname ||
    targetUser.name ||
    "Spieler";

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const m = await getPlayerMatches(targetUser.id);
        setMatches(m);
      } catch (err) {
        console.error("Error loading matches for points history:", err);
      }
      setLoading(false);
    }
    loadHistory();
  }, [targetUser.id]);

  // Compute points history timeline
  const timeline: TimelinePoint[] = [];
  let runningPoints = 100;

  timeline.push({
    date: "Start",
    opponentName: "Beitritt Hobbyliga",
    result: "-",
    pointsDelta: 100,
    totalPoints: 100,
    type: "start",
  });

  const completedMatches = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  completedMatches.forEach((m) => {
    const isP1 = m.player1UserId === targetUser.id;
    const opponentId = isP1 ? m.player2UserId : m.player1UserId;
    const oppUser = Object.values(allUsers).find(
      (u: any) => u.id === opponentId || u.name === opponentId
    ) as any;
    const opponentName = oppUser
      ? `${oppUser.firstName || ""} ${oppUser.lastName || ""}`.trim() || oppUser.name
      : "Gegner";

    const ptsAwarded = isP1
      ? m.pointsAwarded?.player1 || 0
      : m.pointsAwarded?.player2 || 0;

    const resultStr = m.result
      ? `Sets: ${m.result.player1Sets}:${m.result.player2Sets}`
      : "Beendet";

    runningPoints += ptsAwarded;

    timeline.push({
      date: new Date(m.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }),
      opponentName,
      result: resultStr,
      pointsDelta: ptsAwarded,
      totalPoints: Math.max(0, runningPoints),
      type: "match",
    });
  });

  const chartData = timeline.map((pt) => ({
    name: pt.date,
    Punkte: Number((pt.totalPoints ?? 0).toFixed(1)),
  }));

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--color-primary)] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-amber-300"></i>
              Punkteverlauf: {playerName}
            </h3>
            <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest mt-0.5">
              Gesamter bisheriger Turnier- & Ligaverlauf
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
              <i className="fa-solid fa-circle-notch animate-spin text-xl text-[var(--color-primary)]"></i>
              <span>Lade Punkteverlauf...</span>
            </div>
          ) : (
            <>
              {/* Chart */}
              {chartData.length > 1 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Punkteentwicklung
                  </h4>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="Punkte"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorPoints)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Match Timeline */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1.5">
                  Historie ({timeline.length} Einträge)
                </h4>

                <div className="space-y-2">
                  {timeline.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                            entry.type === "start"
                              ? "bg-amber-100 text-amber-700"
                              : entry.pointsDelta >= 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {entry.type === "start" ? (
                            <i className="fa-solid fa-flag-checkered"></i>
                          ) : entry.pointsDelta >= 0 ? (
                            <i className="fa-solid fa-arrow-up"></i>
                          ) : (
                            <i className="fa-solid fa-arrow-down"></i>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {entry.opponentName}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {entry.date} {entry.result !== "-" && `• ${entry.result}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-black block ${
                            entry.pointsDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {entry.pointsDelta > 0 && "+"}
                          {(entry.pointsDelta ?? 0).toFixed(1)} Pkt.
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Gesamt: {(entry.totalPoints ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
