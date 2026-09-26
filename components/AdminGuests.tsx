import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Booking, User, Role } from "../types";
import {
  ClubSettings,
  updateBookingPaidStatus,
  saveBooking,
  deleteBooking,
} from "../services/db";
import { TIME_SLOTS } from "../constants";
import {
  Search,
  Download,
  HelpCircle,
  FileText,
  Check,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

interface AdminGuestsProps {
  bookings: Booking[];
  users: Record<string, User>;
  settings: any;
  currentUser: User;
  vereinsId: string;
  onSaveSettings?: (settings: any) => Promise<void>;
}

const AdminGuests: React.FC<AdminGuestsProps> = ({
  bookings,
  users,
  settings,
  currentUser,
  vereinsId,
  onSaveSettings,
}) => {
  const currentYearNum = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYearNum.toString());
  
  const rules = settings?.gastspiel_rules || [];
  
  const getRuleForYear = (year: number) => {
    if (rules.length === 0) return { gueltig_ab_jahr: year, guestFeePerHour: 5.0, berechnungsmodus: "PLATZBASIS" };
    const sorted = [...rules].sort((a, b) => b.gueltig_ab_jahr - a.gueltig_ab_jahr);
    const rule = sorted.find((r: any) => r.gueltig_ab_jahr <= year);
    return rule || sorted[sorted.length - 1];
  };

  const activeRule = getRuleForYear(parseInt(selectedYear));
  const guestFee = activeRule.guestFeePerHour;
  const berechnungsmodus = activeRule.berechnungsmodus;
  const defaultGlobalBillingMode = berechnungsmodus === "PLATZBASIS" ? "per_court" : "per_player";
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatingPaidId, setUpdatingPaidId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showRulesTimeline, setShowRulesTimeline] = useState(false);
  const [isRulesAnimatingIn, setIsRulesAnimatingIn] = useState(false);
  const [isRulesClosing, setIsRulesClosing] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const handleOpenRules = () => {
    setShowRulesTimeline(true);
    setTimeout(() => {
      setIsRulesAnimatingIn(true);
    }, 50);
  };

  const handleCloseRules = () => {
    setIsRulesClosing(true);
    setIsRulesAnimatingIn(false);
    setTimeout(() => {
      setShowRulesTimeline(false);
      setIsRulesClosing(false);
      setEditingRule(null);
    }, 200);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm("Möchtest du diese Regel wirklich löschen?")) return;
    const newRules = rules.filter((r: any) => r.id !== ruleId);
    try {
      await onSaveSettings({
        ...settings,
        gastspiel_rules: newRules,
      });
      setEditingRule(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !onSaveSettings) return;
    
    let newRules = [...rules];
    if (editingRule.isNew) {
      newRules.push({
        id: new Date().getFullYear().toString() + "-" + Math.random().toString(36).substr(2, 9),
        gueltig_ab_jahr: parseInt(editingRule.gueltig_ab_jahr),
        guestFeePerHour: parseFloat(editingRule.guestFeePerHour),
        berechnungsmodus: editingRule.berechnungsmodus,
      });
    } else {
      const idx = newRules.findIndex((r: any) => r.id === editingRule.id);
      if (idx !== -1) {
        newRules[idx] = {
          ...newRules[idx],
          gueltig_ab_jahr: parseInt(editingRule.gueltig_ab_jahr),
          guestFeePerHour: parseFloat(editingRule.guestFeePerHour),
          berechnungsmodus: editingRule.berechnungsmodus,
        };
      }
    }
    
    try {
      await onSaveSettings({
        ...settings,
        gastspiel_rules: newRules,
      });
      setEditingRule(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setIsAnimatingIn(false);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
    }, 200);
  };

  // Form states
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("12:00");
  const [bEndTime, setBEndTime] = useState("13:00");
  const [bCourt, setBCourt] = useState("Ohne Termin");
  const [bUserId, setBUserId] = useState("");
  const [bGuestCount, setBGuestCount] = useState(1);
  const [bGuestFee, setBGuestFee] = useState(2.5);
  const [bBillingMode, setBBillingMode] = useState<"per_player" | "per_court">(
    "per_player",
  );
  const [bIsPaid, setBIsPaid] = useState(false);
  const [bComment, setBComment] = useState("");
  const [bIsManual, setBIsManual] = useState(true);

  const isAdmin =
    currentUser.role === Role.ADMIN ||
    currentUser.role === Role.SUPER_ADMIN ||
    currentUser.hauptAdmin === true;

  // Find overall years where guest games have taken place
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    bookings.forEach((b) => {
      const isGuest =
        (b.guestCount && b.guestCount > 0) ||
        b.players.some(
          (p) =>
            p.toLowerCase().includes("gastspieler") ||
            p.toLowerCase().includes("gast"),
        );
      if (isGuest && b.date) {
        try {
          const year = b.date.split("-")[0];
          if (year && !isNaN(Number(year))) {
            years.add(year);
          }
        } catch (e) {}
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  // Compute guest bookings with filters applied
  const guestBookings = useMemo(() => {
    // 1. Core filter: either user has guests, or guest player name is typed, or manual guest entry flag set
    let filtered = bookings.filter(
      (b) =>
        b.isManualGuestEntry ||
        (b.guestCount && b.guestCount > 0) ||
        b.players.some(
          (p) =>
            p.toLowerCase().includes("gastspieler") ||
            p.toLowerCase().includes("gast"),
        ),
    );

    // 2. Year filter
    if (selectedYear !== "all") {
      filtered = filtered.filter(
        (b) => b.date && b.date.startsWith(selectedYear),
      );
    }

    // 3. User permission filter: regular players can only see their own guest play records
    const currentUserFullName =
      currentUser.firstName || currentUser.lastName
        ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
        : currentUser.name;

    if (!isAdmin) {
      filtered = filtered.filter((b) => {
        return (
          b.bookedBy === currentUser.id ||
          b.createdBy === currentUser.name ||
          b.players.some(
            (p) => p === currentUser.name || p === currentUserFullName,
          )
        );
      });
    }

    // 4. Search query filter (applies to both players and admins)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((b) => {
        const memberName =
          b.players.find((p) => !p.toLowerCase().includes("gast")) ||
          b.bookedBy ||
          "Unbekannt";
        const bookingOwner =
          users[b.bookedBy || ""] ||
          (Object.values(users) as User[]).find((u) => u.name === b.createdBy);

        const klarname = bookingOwner?.klarname || "";
        const firstName = bookingOwner?.firstName || "";
        const lastName = bookingOwner?.lastName || "";
        const email = bookingOwner?.email || "";
        const court = b.court || "";
        const date = b.date || "";

        return (
          memberName.toLowerCase().includes(query) ||
          b.players.some((p) => p.toLowerCase().includes(query)) ||
          klarname.toLowerCase().includes(query) ||
          firstName.toLowerCase().includes(query) ||
          lastName.toLowerCase().includes(query) ||
          email.toLowerCase().includes(query) ||
          court.toLowerCase().includes(query) ||
          date.includes(query)
        );
      });
    }

    // Sort by date and time
    return filtered.sort((a, b) => {
      if (a.date !== b.date) {
        const compareVal =
          new Date(a.date).getTime() - new Date(b.date).getTime();
        return sortOrder === "desc" ? -compareVal : compareVal;
      }
      const aTime = a.time || "00:00";
      const bTime = b.time || "00:00";
      const compareTime = aTime.localeCompare(bTime);
      return sortOrder === "desc" ? -compareTime : compareTime;
    });
  }, [
    bookings,
    selectedYear,
    isAdmin,
    searchQuery,
    sortOrder,
    currentUser,
    users,
  ]);

  // Helper function to resolve the slot's end time and duration
  const getEndAndHours = (startTime: string) => {
    const idx = TIME_SLOTS.indexOf(startTime);
    if (idx !== -1 && idx < TIME_SLOTS.length - 1) {
      return { endTime: TIME_SLOTS[idx + 1], hours: 1.0 };
    } else {
      try {
        const [hr, min] = startTime.split(":").map(Number);
        const nextHr = String((hr + 1) % 24).padStart(2, "0");
        const nextMin = String(min).padStart(2, "0");
        return { endTime: `${nextHr}:${nextMin}`, hours: 1.0 };
      } catch (e) {
        return { endTime: "13:00", hours: 1.0 };
      }
    }
  };

  const calculateHoursBetween = (
    startTime: string,
    endTime: string,
  ): number => {
    try {
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM))
        return 1.0;

      let diffInMinutes = endH * 60 + endM - (startH * 60 + startM);
      if (diffInMinutes <= 0) {
        diffInMinutes += 24 * 60; // Safe overnight transition
      }
      const computed = diffInMinutes / 60;
      return Math.round(computed * 100) / 100;
    } catch (e) {
      return 1.0;
    }
  };

  const addHoursToTime = (time: string, hours: number): string => {
    try {
      const [h, m] = time.split(":").map(Number);
      const totalMinutes = h * 60 + m + hours * 60;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = Math.round(totalMinutes % 60);
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    } catch (e) {
      return "13:00";
    }
  };

  const handlePaidChange = async (bookingId: string, isPaid: boolean) => {
    setUpdatingPaidId(bookingId);
    try {
      await updateBookingPaidStatus(vereinsId, bookingId, isPaid);
    } catch (error) {
      console.error("Error updating paid status for guest booking:", error);
    } finally {
      setUpdatingPaidId(null);
    }
  };

  const handleOpenAddModal = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    setEditingBooking(null);
    setBDate(todayStr);
    setBTime("12:00");
    setBEndTime("13:00");
    setBCourt("Ohne Termin");

    const userList = (Object.values(users) as User[]);
    if (userList.length > 0) {
      setBUserId(userList[0].id || userList[0].name);
    } else {
      setBUserId("");
    }

    setBGuestCount(1);
    setBGuestFee(guestFee);
    setBBillingMode(defaultGlobalBillingMode);
    setBIsPaid(false);
    setBComment("");
    setBIsManual(true);
    
    setIsClosing(false);
    setIsAnimatingIn(false);
    setIsModalOpen(true);
    setTimeout(() => setIsAnimatingIn(true), 10);
  };

  const handleOpenEditModal = (booking: Booking) => {
    setEditingBooking(booking);
    setBDate(booking.date);
    setBTime(booking.time || "12:00");
    setBCourt(booking.court || "Ohne Termin");

    const matchedUser = (Object.values(users) as User[]).find((u) => {
      const uFullName =
        u.klarname ||
        `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        u.name;
      return (
        booking.bookedBy === u.id ||
        booking.players.includes(u.name) ||
        booking.players.includes(uFullName)
      );
    });

    if (matchedUser) {
      setBUserId(matchedUser.id || matchedUser.name);
    } else {
      const firstUser = (Object.values(users) as User[])[0];
      setBUserId(firstUser?.id || firstUser?.name || "");
    }

    const bookingHours = booking.hours !== undefined ? booking.hours : 1.0;
    const computedEndTime = addHoursToTime(
      booking.time || "12:00",
      bookingHours,
    );
    setBEndTime(computedEndTime);

    setBGuestCount(booking.guestCount || 1);
    setBGuestFee(booking.guestFee !== undefined ? booking.guestFee : guestFee);
    setBBillingMode(
      booking.guestBillingMode || defaultGlobalBillingMode
    );
    setBIsPaid(!!booking.isPaid);
    setBComment(booking.comment || "");
    setBIsManual(!!booking.isManualGuestEntry);
    
    setIsClosing(false);
    setIsAnimatingIn(false);
    setIsModalOpen(true);
    setTimeout(() => setIsAnimatingIn(true), 10);
  };

  const handleSaveModalBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bDate) {
      alert("Bitte ein Datum auswählen.");
      return;
    }

    let finalPlayerName = "";
    let finalBookedBy = "";

    const selectedUser = (Object.values(users) as User[]).find(
      (u) => u.id === bUserId || u.name === bUserId,
    );
    if (selectedUser) {
      finalPlayerName =
        selectedUser.klarname ||
        `${selectedUser?.firstName || ""} ${selectedUser?.lastName || ""}`.trim() ||
        selectedUser.name;
      finalBookedBy = selectedUser.id;
    } else {
      alert("Bitte einen Vereinsspieler / Einlader aus der Liste auswählen.");
      return;
    }

    const calculatedHours = calculateHoursBetween(bTime, bEndTime);
    const bId =
      editingBooking?.id ||
      `manual_guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const savedB: Booking = {
      id: bId,
      date: bDate,
      time: bTime,
      court: bCourt,
      players: [finalPlayerName],
      guestCount: bGuestCount,
      isLocked: false,
      hasBallMachine: false,
      bookedBy: finalBookedBy || undefined,
      comment: bComment || undefined,
      isPaid: bIsPaid,
      guestFee: bGuestFee,
      guestBillingMode: bBillingMode,
      hours: calculatedHours,
      isManualGuestEntry: bIsManual,
      createdBy: editingBooking?.createdBy || currentUser.name || "unbekannt",
    };

    try {
      await saveBooking(vereinsId, savedB);
      handleCloseModal();
      setEditingBooking(null);
    } catch (err: any) {
      console.error("Error saving guest game:", err);
      alert("Fehler beim Speichern: " + err.message);
    }
  };

  const handleDeleteManualBooking = async (bId: string) => {
    if (!confirm("Möchtest du dieses Gastspiel wirklich löschen?")) return;
    try {
      const bToDel = bookings.find((b) => b.id === bId);
      if (bToDel && bToDel.group_token) {
        const group = bookings.filter((b) => b.group_token === bToDel.group_token);
        for (const b of group) {
          await deleteBooking(vereinsId, b.id);
        }
      } else {
        await deleteBooking(vereinsId, bId);
      }
      handleCloseModal();
      setEditingBooking(null);
    } catch (err: any) {
      console.error("Error deleting guest game:", err);
      alert("Fehler beim Löschen: " + err.message);
    }
  };

  const handleDownloadCSV = () => {
    if (!isAdmin) return;

    let csvContent =
      "\uFEFFDatum;Zeitraum;Stunden;Gaeste;Abrechnung;Gebuehr IP;Platz;Vereinsspieler;Bezahlt\n";

    guestBookings.forEach((b) => {
      const member =
        b.players.find((p) => !p.toLowerCase().includes("gast")) ||
        b.bookedBy ||
        "Unbekannt";
      const count = b.guestCount || 1;
      const { endTime, hours } = getEndAndHours(b.time || "12:00");
      const resolvedHours = b.hours !== undefined ? b.hours : hours;
      const zeitraum = b.isManualGuestEntry
        ? "Ohne Termin"
        : `${b.time} - ${endTime}`;
      const defaultBillingMode = defaultGlobalBillingMode;
      const countBillingMode = b.guestBillingMode || defaultBillingMode;
      const countGuestFee = b.guestFee !== undefined ? b.guestFee : guestFee;

      let fee = 0;
      if (b.calculatedFeeCents !== undefined) {
        fee = b.calculatedFeeCents / 100;
      } else if (count > 0) {
        if (countBillingMode === "per_court") {
          fee = countGuestFee * resolvedHours;
        } else {
          fee = countGuestFee * resolvedHours * count;
        }
      }

      const billingModeLabel =
        countBillingMode === "per_court" ? "pro Platzstunde" : "pro Gast";
      const paidStatus = b.isPaid ? "Ja" : "Nein";
      const row = `${b.date};${zeitraum};${resolvedHours.toFixed(1).replace(".", ",")};${count};${billingModeLabel};${fee.toFixed(2).replace(".", ",")} €;${b.court || "Ohne Termin"};${member};${paidStatus}`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `gastspiele_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-3.5 sm:gap-4 w-full lg:animate-in lg:fade-in lg:duration-500">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-4 md:p-6">
        {/* Upper Dashboard header area */}
        <div className={`flex flex-row justify-between items-center gap-2 md:gap-4 border-b-0 md:border-b border-slate-100 mb-2 pb-0 md:mb-6 md:pb-6 ${!isAdmin ? "hidden md:flex" : "flex"}`}>
          <div className="hidden md:flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)]">
              <FileText className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                  Gastspiele &amp; Abrechnung
                </h3>
                {isAdmin && (
                  <button
                    onClick={handleOpenRules}
                    className="text-xs font-normal text-slate-500 hover:text-black transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 inline-flex"
                  >
                    <i className="fa-solid fa-gear"></i> Regeln verwalten
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
                {isAdmin
                  ? "Systemübersicht aller vereinbarten Stunden mit externen Gästen"
                  : "Deine persönlichen Gaststunden im Überblick"}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-row items-center justify-between gap-2 w-full md:w-auto self-stretch md:self-auto mt-0 md:mt-0">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-slate-50 border border-slate-200 px-2 sm:px-3.5 h-9 rounded-2xl shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
                <div>
                  <div className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Gebührensatz
                  </div>
                  <div className="font-black text-[10px] sm:text-xs text-slate-800 leading-none mt-0.5 sm:mt-1">
                    {guestFee.toFixed(2).replace(".", ",")} €{" "}
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400">
                      / {berechnungsmodus === "PRO_GAST" ? "Gast" : "Std."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest px-3 md:px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 md:gap-2 cursor-pointer border border-transparent outline-none whitespace-nowrap text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">MANUELL ERFASSEN</span>
                  <span className="inline md:hidden normal-case font-medium">Erfassen</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="bg-[var(--color-primary)] text-white hover:bg-black uppercase tracking-widest px-3 md:px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 md:gap-2 cursor-pointer border border-transparent outline-none whitespace-nowrap text-xs font-medium"
                  title="CSV Export"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">CSV EXPORT</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Search Bar Section */}
        <div className="flex flex-col-reverse md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/70 p-3 md:p-4 rounded-2xl border border-slate-150 mb-4 md:mb-6 mt-2 md:mt-0">
          <div className="flex flex-wrap items-center gap-3">
            {availableYears.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                  className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-[var(--color-primary)] transition-colors flex items-center gap-1 bg-slate-200/50 hover:bg-slate-200/80 px-2 py-1 rounded-lg cursor-pointer select-none"
                  title={`Sortierung umkehren (Aktuell: ${sortOrder === "desc" ? "Neueste zuerst" : "Älteste zuerst"})`}
                >
                  Jahr:
                  <i className={`fa-solid fa-arrow-${sortOrder === "desc" ? "down" : "up"}-long text-[10px] text-[var(--color-primary)]`} />
                </button>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] shadow-sm py-2 font-sans font-medium"
                >
                  <option value="all">Alle Jahre</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Player Search Input field for both admins and players */}
          <div className="relative flex-1 max-w-sm w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </span>
            <input 
              type="text"
              value={searchQuery}
              aria-label="Gastspiele suchen"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAdmin
                  ? "Mitglieder, Platz oder Datum suchen..."
                  : "Platz oder Datum suchen..."
              }
              className="w-full pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] shadow-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Table Content */}
        {guestBookings.length === 0 ? (
          <div className="text-center py-16 bg-slate-20/40 rounded-3xl border border-dashed border-slate-200">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Keine Gastspiele registriert
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1">
              Für den gewählten Filter existieren keine Einträge.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto rounded-2xl border border-slate-150 shadow-sm hidden md:block">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest w-28">
                      Datum
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest w-40">
                      Zeitraum
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-28">
                      Stunden
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-20">
                      Gäste
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-36">
                      Abrechnung
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right w-28">
                      Gebühr
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest w-32">
                      Platz
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      Vereinsspieler
                    </th>
                    <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-32">
                      Bezahlt?
                    </th>
                    {isAdmin && (
                      <th className="p-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center w-24">
                        Aktion
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {guestBookings.map((b, i) => {
                    const member =
                      b.players.find(
                        (p) => !p.toLowerCase().includes("gast"),
                      ) ||
                      b.bookedBy ||
                      "Unbekannt";
                    const count = b.guestCount || 1;
                    const { endTime, hours } = getEndAndHours(
                      b.time || "12:00",
                    );
                    const resolvedHours =
                      b.hours !== undefined ? b.hours : hours;

                    const zeitraum = b.isManualGuestEntry
                      ? "Ohne Termin"
                      : b.time
                        ? `${b.time} - ${endTime} Uhr`
                        : "Unbekannt";

                    const defaultBillingMode = defaultGlobalBillingMode;
                    const countBillingMode =
                      b.guestBillingMode || defaultBillingMode;
                    const countGuestFee =
                      b.guestFee !== undefined ? b.guestFee : guestFee;

                    let fee = 0;
                    if (b.calculatedFeeCents !== undefined) {
                      fee = b.calculatedFeeCents / 100;
                    } else if (count > 0) {
                      if (countBillingMode === "per_court") {
                        fee = countGuestFee * resolvedHours;
                      } else {
                        fee = countGuestFee * resolvedHours * count;
                      }
                    }

                    const isUpdating = updatingPaidId === b.id;

                    return (
                      <tr
                        key={b.id || `guestb-${i}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="p-4 font-semibold text-sm text-slate-800 font-sans">
                          {new Date(b.date).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-4 font-semibold text-sm text-slate-800 font-sans">
                          {zeitraum}
                        </td>
                        <td className="p-4 font-semibold text-sm text-slate-800 text-center font-sans">
                          {Math.round(resolvedHours)} Std.
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-150 rounded-full min-w-8 font-sans">
                            {count}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border font-sans ${
                              countBillingMode === "per_court"
                                ? "text-cyan-800 bg-cyan-50/50 border-cyan-200"
                                : "text-amber-800 bg-amber-50/50 border-amber-200"
                            }`}
                          >
                            {countBillingMode === "per_court"
                              ? "pro Platzstunde"
                              : "pro Gast"}
                          </span>
                          {b.appliedFeeRuleName && (
                            <div className="text-[9px] text-slate-400 font-medium mt-0.5" title={`Regel: ${b.appliedFeeRuleName}`}>
                              {b.appliedFeeRuleName}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-semibold text-sm text-slate-800 text-right font-sans">
                          {fee.toFixed(2).replace(".", ",")} €
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-black text-indigo-805 bg-indigo-50 border border-indigo-150 rounded-lg font-sans">
                            {b.court || "Ohne Termin"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-sm text-slate-800 font-sans">
                          {member}
                        </td>
                        <td className="p-4 text-center align-middle">
                          {isAdmin ? (
                            <div className="flex items-center justify-center">
                              <label className="relative flex items-center justify-center cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!!b.isPaid}
                                  disabled={isUpdating}
                                  onChange={(e) =>
                                    handlePaidChange(b.id, e.target.checked)
                                  }
                                  className={`w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] shadow-sm transition-opacity ${isUpdating ? "opacity-30" : "opacity-100"}`}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              {b.isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 bg-emerald-100/80 border border-emerald-200 rounded-lg">
                                  <Check className="w-2.5 h-2.5 stroke-[3px]" />{" "}
                                  Bezahlt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-black uppercase text-slate-500 bg-slate-100 border border-slate-200 rounded-lg">
                                  Offen
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(b)}
                              className="p-1.5 text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Bearbeiten / Stundensatz anpassen"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="flex flex-col gap-3 md:hidden">
              {guestBookings.map((b, i) => {
                const member =
                  b.players.find((p) => !p.toLowerCase().includes("gast")) ||
                  b.bookedBy ||
                  "Unbekannt";
                const count = b.guestCount || 1;
                const { endTime, hours } = getEndAndHours(b.time || "12:00");
                const resolvedHours = b.hours !== undefined ? b.hours : hours;

                const zeitraum = b.isManualGuestEntry
                  ? "Ohne Termin"
                  : b.time
                    ? `${b.time} - ${endTime} Uhr`
                    : "Unbekannt";

                const defaultBillingMode = defaultGlobalBillingMode;
                const countBillingMode =
                  b.guestBillingMode || defaultBillingMode;
                const countGuestFee =
                  b.guestFee !== undefined ? b.guestFee : guestFee;

                let fee = 0;
                if (b.calculatedFeeCents !== undefined) {
                  fee = b.calculatedFeeCents / 100;
                } else if (count > 0) {
                  if (countBillingMode === "per_court") {
                    fee = countGuestFee * resolvedHours;
                  } else {
                    fee = countGuestFee * resolvedHours * count;
                  }
                }

                const isUpdating = updatingPaidId === b.id;

                return (
                  <div
                    key={`mc-${b.id || i}`}
                    className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="font-black text-[13px] text-[var(--color-primary)]">
                        {new Date(b.date).toLocaleDateString("de-DE", {
                          weekday: "long",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </div>
                      <div>
                        {b.isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <Check className="w-2.5 h-2.5 stroke-[3px]" />{" "}
                            Bezahlt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                            {fee.toFixed(2).replace(".", ",")} € offen
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500">
                      {zeitraum} • {Math.round(resolvedHours)}{" "}
                      Std. • {b.court || "Ohne Termin"} • {count}{" "}
                      {count === 1 ? "Gast" : "Gäste"}
                    </div>

                    <div className="text-[10px] font-semibold text-slate-400">
                      Modus:{" "}
                      {countBillingMode === "per_court"
                        ? "pro Platzstunde"
                        : "pro Gast"}{" "}
                      ({countGuestFee.toFixed(2).replace(".", ",")} €/Std)
                    </div>

                    {isAdmin && (
                      <div className="mt-2 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-[11px] font-bold text-slate-500">
                          Spieler:{" "}
                          <span className="text-base font-semibold text-[var(--color-primary)]">
                            {member}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                            title="Bearbeiten / Stundensatz anpassen"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <label className="cursor-pointer text-[9px] uppercase font-black tracking-widest text-slate-400">
                              Bezahlt?
                            </label>
                            <input
                              type="checkbox"
                              checked={!!b.isPaid}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handlePaidChange(b.id, e.target.checked)
                              }
                              className={`w-5 h-5 cursor-pointer rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] shadow-sm transition-opacity ${isUpdating ? "opacity-30" : "opacity-100"}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Rules Timeline Modal */}
      {showRulesTimeline && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity"
          onClick={handleCloseRules}
          style={{
            opacity: !isRulesAnimatingIn || isRulesClosing ? 0 : 1,
            transitionDuration: isRulesClosing ? "200ms" : "250ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isRulesClosing ? "none" : "auto",
          }}
        >
          <div
            className="w-full md:max-w-md h-full bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto text-left"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform:
                !isRulesAnimatingIn || isRulesClosing
                  ? "translateX(100%)"
                  : "translateX(0)",
              transitionDuration: isRulesClosing ? "200ms" : "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div className="h-20 bg-[var(--color-primary)] px-6 flex items-center justify-between shrink-0 shadow-sm z-10 text-white">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-scale-balanced text-white"></i> 
                {editingRule ? "Regel bearbeiten" : "Regeln & Tarife"}
              </h3>
              <button
                onClick={() => {
                  if (editingRule) setEditingRule(null);
                  else handleCloseRules();
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {!editingRule ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-800">Änderungshistorie</h4>
                    <button
                      onClick={() => setEditingRule({
                        isNew: true,
                        gueltig_ab_jahr: currentYearNum + 1,
                        guestFeePerHour: "5.00",
                        berechnungsmodus: "PLATZBASIS"
                      })}
                      className="px-3 py-1.5 !text-sm font-medium text-[var(--color-primary)] hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      + Neue Regel
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm">
                    {rules.length === 0 ? (
                      <div className="text-center text-slate-400 text-sm py-8 bg-white">
                        Keine Regeln hinterlegt. Es gelten die System-Defaults.
                      </div>
                    ) : (
                      [...rules].sort((a, b) => b.gueltig_ab_jahr - a.gueltig_ab_jahr).map((rule: any) => (
                        <div
                          key={rule.id}
                          onClick={() => setEditingRule({
                            ...rule,
                            guestFeePerHour: typeof rule.guestFeePerHour === "number" ? rule.guestFeePerHour.toFixed(2) : parseFloat(rule.guestFeePerHour || 0).toFixed(2)
                          })}
                          className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="font-bold text-slate-800 text-sm shrink-0">
                              Ab {rule.gueltig_ab_jahr}
                            </span>
                            <span className="text-xs text-slate-500 font-normal truncate">
                              Gebühr: {rule.guestFeePerHour.toFixed(2).replace(".", ",")} &euro; &bull; Modus: {rule.berechnungsmodus === "PRO_GAST" ? "Pro Gast" : "Platzbasis"}
                            </span>
                          </div>
                          <div className="flex items-center pl-4 shrink-0">
                            <Pencil className="w-3 h-3 text-slate-300 group-hover:text-[var(--color-primary)] transition-colors" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <form id="rule-form" onSubmit={handleSaveRule} className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">
                        Gültig ab Jahr <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={editingRule.gueltig_ab_jahr}
                        onChange={(e) => setEditingRule({...editingRule, gueltig_ab_jahr: e.target.value})}
                        className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-4">Gastspiel-Gebühren</h4>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">
                        Gastspielgebühr
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingRule.guestFeePerHour}
                          onChange={(e) => setEditingRule({...editingRule, guestFeePerHour: e.target.value})}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setEditingRule({
                                ...editingRule,
                                guestFeePerHour: val.toFixed(2)
                              });
                            }
                          }}
                          className="w-full h-10 pl-4 pr-12 bg-slate-50 text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">
                        Berechnungsmodus
                      </label>
                      <select
                        value={editingRule.berechnungsmodus}
                        onChange={(e) => setEditingRule({...editingRule, berechnungsmodus: e.target.value})}
                        className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer font-sans font-medium"
                        required
                      >
                        <option value="PLATZBASIS">Platzbasis (pauschal)</option>
                        <option value="PRO_GAST">Pro Gast</option>
                      </select>
                    </div>
                  </div>

                  {!editingRule.isNew && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(editingRule.id)}
                        className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-colors uppercase cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can mr-2"></i> Regel löschen
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>

            {editingRule && (
              <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                <button
                  type="submit"
                  form="rule-form"
                  className="w-full h-10 px-3 py-1.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-xl hover:bg-black shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  <Save className="w-4 h-4 mr-2" /> Speichern
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Polish Modal Popup for Manual Adding / Retroactive Editing as right-side slider */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
          onClick={handleCloseModal}
          style={{
            opacity: !isAnimatingIn || isClosing ? 0 : 1,
            transitionDuration: isClosing ? "200ms" : "250ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isClosing ? "none" : "auto",
          }}
        >
          <div
            className="w-[450px] max-w-[100vw] h-[100vh] bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform:
                !isAnimatingIn || isClosing
                  ? "translateX(100%)"
                  : "translateX(0)",
              transitionDuration: isClosing ? "200ms" : "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Drawer Header */}
            <div 
              className="bg-[var(--color-primary)] p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden"
            >
              {/* Background Relief Watermark */}
              <div className="absolute -bottom-10 -right-6 text-white opacity-[0.06] z-0 pointer-events-none transform -rotate-12">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-[140px] h-[140px]"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                  <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
                </svg>
              </div>

              <div className="relative z-10">
                <h3 className="text-xl font-bold uppercase tracking-tight leading-none mb-1">
                  {editingBooking
                    ? "Gastspiel Details"
                    : "Gastspiel manuell erfassen"}
                </h3>
                <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 opacity-75" />
                  Gastspiel dokumentieren
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveModalBooking} className="flex-1 flex flex-col min-h-0 bg-white">
              <div className="bg-white p-5 pb-6 space-y-4 overflow-y-auto flex-1 text-slate-700">
                {/* Manual vs Scheduled Indication */}
                {editingBooking && !editingBooking.isManualGuestEntry && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-[10px] font-semibold leading-relaxed">
                    Dieses Gastspiel stammt aus einer regulären Kalender-Buchung.
                    Datum, Zeit und Platz sind schreibgeschützt und können im
                    Kalender geändert werden.
                  </div>
                )}

                {/* Date, Time, Court Grid (Editable only if manual) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Datum
                    </label>
                    <input 
                      type="date"
                      required
                      disabled={
                        editingBooking && !editingBooking.isManualGuestEntry
                      }
                      value={bDate}
                      onChange={(e) => setBDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Platz / Ort
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Ohne Termin"
                      disabled={
                        editingBooking && !editingBooking.isManualGuestEntry
                      }
                      value={bCourt}
                      onChange={(e) => setBCourt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Time inputs and calculated duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Anfangszeit
                    </label>
                    <input 
                      type="time"
                      required
                      disabled={
                        editingBooking && !editingBooking.isManualGuestEntry
                      }
                      value={bTime}
                      onChange={(e) => setBTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Endzeit
                    </label>
                    <input 
                      type="time"
                      required
                      disabled={
                        editingBooking && !editingBooking.isManualGuestEntry
                      }
                      value={bEndTime}
                      onChange={(e) => setBEndTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Dauer (Std.)
                    </label>
                    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px] font-black text-emerald-800 text-center flex items-center justify-center min-h-[34px]">
                      {calculateHoursBetween(bTime, bEndTime)
                        .toFixed(2)
                        .replace(".", ",")}{" "}
                      Std.
                    </div>
                  </div>
                </div>

                {/* Invitation Member Selection */}
                <div className="space-y-2">
                  <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400">
                    Vereinsspieler / Einlader
                  </label>
                  <select 
                    value={bUserId}
                    onChange={(e) => setBUserId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] py-2 font-sans font-medium"
                  >
                    {(Object.values(users) as User[])
                      .sort((a, b) => {
                        const nameA =
                          a.klarname ||
                          `${a.firstName || ""} ${a.lastName || ""}`.trim() ||
                          a.name;
                        const nameB =
                          b.klarname ||
                          `${b.firstName || ""} ${b.lastName || ""}`.trim() ||
                          b.name;
                        return nameA.localeCompare(nameB);
                      })
                      .map((u) => {
                        const fullName =
                          u.klarname ||
                          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                          u.name;
                        return (
                          <option key={u.id || u.name} value={u.id}>
                            {fullName} ({u.name})
                          </option>
                        );
                      })}
                  </select>
                </div>

                {/* Guest Counts and Pricing Modus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Anzahl Gäste
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={bGuestCount}
                      onChange={(e) => setBGuestCount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Stundensatz pro Einheit (€)
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={bGuestFee}
                      onChange={(e) => setBGuestFee(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-mono py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Abrechnungsmodus */}
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Abrechnungsmodus
                  </label>
                  <select 
                    value={bBillingMode}
                    onChange={(e) =>
                      setBBillingMode(
                        e.target.value as "per_player" | "per_court",
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] py-2 font-sans font-medium"
                  >
                    <option value="per_player">
                      pro Gast (Stundensatz * Gäste * Dauer)
                    </option>
                    <option value="per_court">
                      pro Platzstunde (Stundensatz * Dauer)
                    </option>
                  </select>
                </div>

                {/* Live Fee Calculation Preview */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex justify-between items-center select-none">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500">
                    Voraussichtliche Gebühr
                  </span>
                  <span className="text-sm font-black text-[var(--color-accent)] font-mono">
                    {(() => {
                      const hours = calculateHoursBetween(bTime, bEndTime);
                      let fee = 0;
                      if (bGuestCount > 0) {
                        if (bBillingMode === "per_court") {
                          fee = bGuestFee * hours;
                        } else {
                          fee = bGuestFee * hours * bGuestCount;
                        }
                      }
                      return fee.toFixed(2).replace(".", ",");
                    })()}{" "}
                    €
                  </span>
                </div>

                {/* Payment and Comments */}
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Abrechnungs-Notiz
                  </label>
                  <textarea
                    rows={2}
                    maxLength={250}
                    placeholder="Interner Vermerk (z.b. Clubabend, Training oder Gutschein)..."
                    value={bComment}
                    onChange={(e) => setBComment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] resize-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="bIsPaidCheckbox"
                    checked={bIsPaid}
                    onChange={(e) => setBIsPaid(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] shadow-sm font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                  <label
                    htmlFor="bIsPaidCheckbox"
                    className="text-[11px] font-black uppercase tracking-wider text-slate-700 cursor-pointer select-none"
                  >
                    Direkt als &quot;Bezahlt&quot; markieren
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
                <button
                  type="submit"
                  className="flex-1 bg-[var(--color-primary)] hover:bg-black text-white rounded-xl shadow hover:brightness-95 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 py-2.5 text-sm font-medium cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Speichern
                </button>
                {editingBooking && editingBooking.isManualGuestEntry && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteManualBooking(editingBooking.id)
                    }
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer outline-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> LÖSCHEN
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 bg-white border border-slate-300 text-slate-700 font-bold py-2.5 rounded-xl shadow-sm transition-all uppercase tracking-wider text-xs active:scale-95 cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminGuests;
