import React, { useState, useMemo } from "react";
import { Booking, User } from "../types";
import { BarChart3, Download } from "lucide-react";

interface AdminReportsProps {
  bookings: Booking[];
  users: Record<string, User>;
  courts?: string[];
}

const AdminReports: React.FC<AdminReportsProps> = ({
  bookings,
  users,
  courts,
}) => {
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear()); // Always allow current year
    bookings.forEach((b) => {
      if (b.date) {
        const d = new Date(b.date);
        const yr = d.getFullYear();
        if (!isNaN(yr)) {
          const isPlayerBooking =
            !b.isLocked && Array.isArray(b.players) && b.players.length > 0;
          if (isPlayerBooking) {
            yearsSet.add(yr);
          }
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [bookings]);

  const courtList = useMemo(() => {
    return courts && courts.length > 0 ? courts : ["Platz 1", "Platz 2"];
  }, [courts]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = new Date(b.date);
      const isPlayerBooking =
        !b.isLocked && Array.isArray(b.players) && b.players.length > 0;
      return d.getFullYear() === reportYear && isPlayerBooking;
    });
  }, [bookings, reportYear]);

  const monthlyStats = useMemo(() => {
    const monthNames = [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ];

    return monthNames.map((name, index) => {
      const monthBookings = filteredBookings.filter((b) => {
        const d = new Date(b.date);
        return d.getMonth() === index;
      });

      const courtHours: Record<string, number> = {};
      let total = 0;

      courtList.forEach((courtName) => {
        const count = monthBookings.filter((b) => b.court === courtName).length;
        courtHours[courtName] = count;
        total += count;
      });

      return {
        month: name,
        courtHours,
        total,
      };
    });
  }, [filteredBookings, courtList]);

  const activityStats = useMemo(() => {
    const playerHours: Record<string, { hours: number; ballMachine: number }> =
      {};
    let guestHours = 0;

    const yearCourtHours: Record<string, number> = {};
    courtList.forEach((c) => {
      yearCourtHours[c] = 0;
    });

    let yearMachine = 0;

    filteredBookings.forEach((b) => {
      if (b.court && yearCourtHours[b.court] !== undefined) {
        yearCourtHours[b.court]++;
      }
      if (b.hasBallMachine) yearMachine++;

      const hasGuestByString = b.players.some((p) =>
        p.toLowerCase().includes("gast"),
      );
      const count = b.guestCount || (hasGuestByString ? 1 : 0);
      guestHours += count;

      b.players.forEach((p) => {
        if (!p.toLowerCase().includes("gast")) {
          if (!playerHours[p]) playerHours[p] = { hours: 0, ballMachine: 0 };
          playerHours[p].hours++;
          if (b.hasBallMachine) playerHours[p].ballMachine++;
        }
      });
    });

    const topPlayers = Object.entries(playerHours)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    const totalHours = Object.values(yearCourtHours).reduce(
      (sum, h) => sum + h,
      0,
    );

    return { topPlayers, guestHours, yearCourtHours, totalHours, yearMachine };
  }, [filteredBookings, courtList]);

  const kpiCards = useMemo(() => {
    const cards = [
      {
        label: "Gesamtstunden",
        val: activityStats.totalHours + " Std.",
        icon: "fa-clock",
      },
    ];

    courtList.forEach((courtName) => {
      const hours = activityStats.yearCourtHours[courtName] || 0;
      cards.push({
        label: courtName,
        val: hours + " Std.",
        icon: "fa-table-tennis-paddle-ball",
      });
    });

    cards.push({
      label: "Ballmaschine",
      val: activityStats.yearMachine + " Std.",
      icon: "fa-robot",
    });
    cards.push({
      label: "Gaststunden",
      val: activityStats.guestHours + " Std.",
      icon: "fa-user-group",
    });

    return cards;
  }, [activityStats, courtList]);

  const downloadCSV = () => {
    let csvContent = "\uFEFFREPORT " + reportYear + "\n\n";
    csvContent += "TOP SPIELER\n";
    csvContent += "Name,Stunden,Ballmaschine\n";
    activityStats.topPlayers.forEach((p) => {
      csvContent += `${p.name},${p.hours},${p.ballMachine}\n`;
    });
    csvContent += "\nMONATLICHE AUSWERTUNG\n";

    const courtHeaders = courtList.map((c) => `${c} (Std)`).join(",");
    csvContent += `Monat,${courtHeaders},Gesamt (Std)\n`;

    monthlyStats.forEach((m) => {
      const courtValues = courtList.map((c) => m.courtHours[c] || 0).join(",");
      csvContent += `${m.month},${courtValues},${m.total}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tennis_Club_Report_${reportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="lg:animate-in lg:fade-in lg:duration-500 pb-0 md:pb-3 w-full">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-4 md:p-6">
        {/* Upper Dashboard header area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-0 md:gap-4 mb-3 pb-3 md:mb-6 md:pb-6 border-b border-slate-100">
          <div className="hidden md:flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)] animate-pulse-subtle">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                Reporting &amp; Statistiken
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Vereinsanalysen für das gewählte Kalenderjahr und alle Plätze
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto self-stretch md:self-auto justify-between md:justify-end mt-1 md:mt-0">
            <button
              onClick={downloadCSV}
              type="button"
              className="bg-[var(--color-primary)] text-white hover:bg-black uppercase tracking-widest px-3 md:px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 md:gap-2 cursor-pointer border border-transparent outline-none whitespace-nowrap text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" /> CSV EXPORT
            </button>
          </div>
        </div>

        {/* Filters and Search Bar Section */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/70 p-3 md:p-4 rounded-2xl border border-slate-150 mb-4 md:mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[140px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Jahr:
              </span>
              <select 
                value={reportYear}
                onChange={(e) => setReportYear(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] flex-1 min-w-[90px] shadow-sm cursor-pointer py-2 font-sans font-medium"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Wrapper inside Card */}
        <div className="space-y-4 lg:space-y-6 mt-2">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {kpiCards.map((kpi, i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-150 p-4 rounded-xl shadow-sm flex items-center justify-between transition-all hover:bg-slate-100/50"
              >
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">
                    {kpi.label}
                  </p>
                  <p className="text-base font-black text-slate-800 leading-none">
                    {kpi.val}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-150 flex items-center justify-center text-[var(--color-primary)] shadow-sm shrink-0">
                  <i className={`fa-solid ${kpi.icon} text-xs`}></i>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Chart Table */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider flex items-center gap-2 mb-4">
              <i className="fa-solid fa-calendar-days"></i> Auslastung pro Platz{" "}
              {reportYear}
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-sm">
              <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest w-[25%]">
                      Monat
                    </th>
                    {courtList.map((courtName) => (
                      <th
                        key={courtName}
                        className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center"
                      >
                        {courtName}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-[18%]">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyStats.map((m) => (
                    <tr
                      key={m.month}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-normal text-slate-700">
                        {m.month}
                      </td>
                      {courtList.map((courtName) => {
                        const val = m.courtHours[courtName] || 0;
                        return (
                          <td
                            key={courtName}
                            className="px-4 py-3 text-center text-xs font-normal text-slate-800"
                          >
                            {val} Std.
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center bg-[var(--color-primary)] text-white px-2.5 py-0.5 rounded-full text-[10px] font-normal shadow-sm min-w-[40px]">
                          {m.total} Std.
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Player Table */}
          <div className="pt-4 border-t border-slate-100">
            <div className="mb-4">
              <h3 className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-ranking-star"></i> Top-Spieler{" "}
                {reportYear}
              </h3>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mt-0.5">
                Die 10 aktivsten Mitglieder des gewählten Jahres
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-sm">
              <table className="w-full border-collapse table-fixed min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest w-[12%]">
                      #
                    </th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest w-[44%] text-left">
                      Mitglied
                    </th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-[22%]">
                      Gesamtstunden
                    </th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-[22%]">
                      Ballmaschine
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityStats.topPlayers.map((player, idx) => (
                    <tr
                      key={player.name + "-" + idx}
                      className="hover:bg-slate-50/50 transition-all text-xs"
                    >
                      <td className="px-4 py-3 font-normal text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-normal text-[var(--color-primary)] uppercase text-[11px] truncate">
                        {player.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg text-[11px] font-normal text-slate-700 shadow-sm">
                          {player.hours} Std.
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {player.ballMachine > 0 ? (
                          <span className="text-[var(--color-accent)] font-normal text-[11px] flex items-center justify-center gap-1">
                            <i className="fa-solid fa-robot"></i>{" "}
                            {player.ballMachine}
                          </span>
                        ) : (
                          <span className="text-slate-350">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {activityStats.topPlayers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-slate-400 font-normal italic uppercase text-[10px]"
                      >
                        Keine Spieldaten für {reportYear} vorhanden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
