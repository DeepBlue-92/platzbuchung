import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { User, Role, ArbeitsEinsatz, PlannedWorkShift } from "../types";
import {
  listenToArbeitseinsaetze,
  saveArbeitseinsatz,
  deleteArbeitseinsatz,
  listenToPlannedWorkShifts,
  savePlannedWorkShift,
  deletePlannedWorkShift,
  signUpForPlannedWorkShift,
  signOutFromPlannedWorkShift,
} from "../services/db";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase } from "lucide-react";
import OnboardingBanner from "./OnboardingBanner";

interface ArbeitseinsaetzeProps {
  currentUser: User;
  users: Record<string, User>;
  settings: any;
  onSaveSettings: (settings: any) => Promise<void>;
  primaryColor?: string;
  accentColor?: string;
  onDismissOnboardingHints?: () => void;
}

const Arbeitseinsaetze: React.FC<ArbeitseinsaetzeProps> = ({
  currentUser,
  users,
  settings,
  onSaveSettings,
  primaryColor = "#1b4332",
  accentColor = "#c04d2b",
  onDismissOnboardingHints,
}) => {
  const currentClubId = settings?.vereinsId || settings?.id || currentUser.vereinsId || "sv-neuhausen";
  const currentYearNum = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [entries, setEntries] = useState<ArbeitsEinsatz[]>([]);

  const rules = settings?.arbeitseinsatz_rules || [];
  
  const getRuleForYear = (year: number) => {
    if (rules.length === 0) return { gueltig_ab_jahr: year, soll_stunden: 10, stundenlohn_ersatz: 15 };
    const sorted = [...rules].sort((a, b) => b.gueltig_ab_jahr - a.gueltig_ab_jahr);
    const rule = sorted.find(r => r.gueltig_ab_jahr <= year);
    return rule || sorted[sorted.length - 1];
  };

  const ruleYears = rules.map((r: any) => r.gueltig_ab_jahr);
  const entryYears = entries.map(e => parseInt(e.date.split("-")[0])).filter(y => !isNaN(y));
  const allYearsSet = new Set<number>([currentYearNum, ...ruleYears, ...entryYears]);
  const availableYears = Array.from(allYearsSet).sort((a, b) => b - a);

  const activeRule = getRuleForYear(selectedYear);
  const sollStunden = activeRule.soll_stunden;
  const stundenlohnErsatz = activeRule.stundenlohn_ersatz;

  const entriesForSaison = entries.filter(e => {
    return e.date.startsWith(selectedYear.toString());
  });

  const categories = [...(settings?.arbeitseinsaetzeSettings?.categories ?? ["Platzpflege", "Clubheim-Reinigung", "Bewirtung", "Sonstiges"])].sort((a, b) => a.localeCompare(b, "de"));
  const visibility = settings?.arbeitseinsaetzeSettings?.visibility ?? "full";
  const interval = settings?.arbeitseinsaetzeSettings?.interval ?? "0.5";
  const maxDaysBack = settings?.arbeitseinsaetzeSettings?.maxDaysBack ?? 14;
  const commentsRequired = settings?.arbeitseinsaetzeSettings?.commentsRequired ?? false;

  const isAdmin = currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN;
  const isListHidden = !isAdmin && visibility === "hidden";
  const showActiveOnly = !isAdmin && visibility === "active_only";

  const getUserSortName = (u: any) => {
    if (u.lastName || u.firstName) {
      return {
        last: (u.lastName || "").trim(),
        first: (u.firstName || "").trim()
      };
    }
    const fullName = (u.klarname || u.name || "").trim();
    const parts = fullName.split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      const first = parts.slice(0, parts.length - 1).join(" ");
      return { last, first };
    }
    return { last: fullName, first: "" };
  };

  const compareUsersByLastName = (a: any, b: any) => {
    const nameA = getUserSortName(a);
    const nameB = getUserSortName(b);
    const cmp = nameA.last.localeCompare(nameB.last, "de");
    if (cmp !== 0) return cmp;
    return nameA.first.localeCompare(nameB.first, "de");
  };

  const getUserDisplayName = (uOrId: any) => {
    if (!uOrId) return "Mitglied";
    const u: User | undefined = typeof uOrId === "string"
      ? (users[uOrId] || (Object.values(users) as User[]).find(x => x.id === uOrId || (x as any).uid === uOrId))
      : uOrId;
    if (!u) return typeof uOrId === "string" ? "Mitglied" : "Mitglied";
    if (u.lastName || u.firstName) {
      return `${u.firstName || ""} ${u.lastName || ""}`.trim();
    }
    return u.klarname || u.name || "Mitglied";
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState("all");
  const [selectedFulfillmentFilter, setSelectedFulfillmentFilter] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) + 
    (selectedCategoryFilter !== "all" ? 1 : 0) + 
    (isAdmin && selectedMemberFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategoryFilter("all");
    if (isAdmin) {
      setSelectedMemberFilter("all");
    }
    setEntriesPage(1);
  };
  
  const [sortCol, setSortCol] = useState("date");
  const [sortDesc, setSortDesc] = useState(true);

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSortCol, setUserSortCol] = useState("hours");
  const [userSortDesc, setUserSortDesc] = useState(true);

  // Pagination State
  const [entriesPage, setEntriesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Mobile swipe and touch handlers for aggregated values pagination
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeStyle, setSwipeStyle] = useState<React.CSSProperties>({});
  const prevPageRefForSwipe = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (prevPageRefForSwipe.current === null) {
      prevPageRefForSwipe.current = usersPage;
      return;
    }

    const prev = prevPageRefForSwipe.current;
    prevPageRefForSwipe.current = usersPage;

    if (prev === usersPage) return;

    const isForward = usersPage > prev;
    const startX = isForward ? "40px" : "-40px";

    setSwipeStyle({
      transform: `translateX(${startX})`,
      willChange: "transform",
      opacity: 0,
      transition: "none",
    });

    const transitionTimer = setTimeout(() => {
      setSwipeStyle({
        transform: "translateX(0)",
        willChange: "transform",
        opacity: 1,
        transition: "transform 200ms ease-out, opacity 200ms ease-out",
      });
    }, 16);

    const clearTimer = setTimeout(() => {
      setSwipeStyle({});
    }, 216);

    return () => {
      clearTimeout(transitionTimer);
      clearTimeout(clearTimer);
    };
  }, [usersPage, isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    const threshold = 65; // minimum swipe horizontal distance in pixels
    if (
      Math.abs(diffX) > threshold &&
      Math.abs(diffX) > Math.abs(diffY) * 1.5
    ) {
      const totalPages = Math.ceil(userStats.length / ITEMS_PER_PAGE);
      if (totalPages > 1) {
        if (diffX > 0) {
          // Swipe right -> Previous page
          setUsersPage(p => Math.max(1, p - 1));
        } else {
          // Swipe left -> Next page
          setUsersPage(p => Math.min(totalPages, p + 1));
        }
      }
    }
    touchStartRef.current = null;
  };

  // Mass Actions State
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [massCategory, setMassCategory] = useState("");
  const [showDeleteConfirmFor, setShowDeleteConfirmFor] = useState<string | null>(null);
  const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);
  const [expandedMobileEntries, setExpandedMobileEntries] = useState<string[]>([]);

  // Slider State
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ArbeitsEinsatz | null>(null);
  
  // Form State
  const [formDate, setFormDate] = useState("");
  const [formHours, setFormHours] = useState<number>(1);
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUserId, setFormUserId] = useState(""); // Self-reporting target or single admin target
  const [formSelectedUserIds, setFormSelectedUserIds] = useState<string[]>([]); // Bulk admin target
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");


  const handleSort = (col: string) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
    setEntriesPage(1);
  };

  const handleUserSort = (col: string) => {
    if (userSortCol === col) setUserSortDesc(!userSortDesc);
    else { setUserSortCol(col); setUserSortDesc(true); }
    setUsersPage(1);
  };

  // Planned Work Shifts State
  const [plannedShifts, setPlannedShifts] = useState<PlannedWorkShift[]>([]);
  const [plannedYear, setPlannedYear] = useState<number>(currentYearNum);
  const [plannedSearchQuery, setPlannedSearchQuery] = useState<string>("");
  const [plannedCategoryFilter, setPlannedCategoryFilter] = useState<string>("all");

  const [showPlannedModal, setShowPlannedModal] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<PlannedWorkShift | null>(null);

  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [shiftStartTime, setShiftStartTime] = useState<string>("10:00");
  const [shiftEndTime, setShiftEndTime] = useState<string>("12:00");
  const [shiftCategory, setShiftCategory] = useState<string>("REINIGUNG");
  const [shiftTitleDescription, setShiftTitleDescription] = useState<string>("");
  const [shiftRequiredVolunteers, setShiftRequiredVolunteers] = useState<number>(2);
  const [shiftAssignedUserIds, setShiftAssignedUserIds] = useState<string[]>([]);
  const [shiftMemberSearchQuery, setShiftMemberSearchQuery] = useState<string>("");
  const [shiftMemberSearchOpen, setShiftMemberSearchOpen] = useState<boolean>(false);
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);

  const [shiftToDelete, setShiftToDelete] = useState<PlannedWorkShift | null>(null);
  const [memberAssignShift, setMemberAssignShift] = useState<PlannedWorkShift | null>(null);
  const [assignUserSearch, setAssignUserSearch] = useState<string>("");

  // Subscribe to work hours entries
  useEffect(() => {
    const unsubscribe = listenToArbeitseinsaetze(currentClubId, (data) => {
      // We will sort dynamically during render instead of here, to support table sorting
      setEntries(data);
    });
    const unsubscribePlanned = listenToPlannedWorkShifts(currentClubId, (data) => {
      setPlannedShifts(data);
    });
    return () => {
      unsubscribe();
      unsubscribePlanned();
    };
  }, [currentClubId]);

  const getMemberFormattedName = (u?: User, fallbackId?: string) => {
    if (!u) {
      if (!fallbackId) return "Unbekannt";
      const foundUser = users[fallbackId] || (Object.values(users) as User[]).find(x => x.id === fallbackId || (x as any).uid === fallbackId);
      if (foundUser) return getMemberFormattedName(foundUser);
      return "Mitglied";
    }
    const first = (u.firstName || "").trim();
    const last = (u.lastName || "").trim();
    if (first && last) {
      return `${first} ${last}`;
    }
    const full = (u.klarname || u.name || "").trim();
    return full || "Mitglied";
  };

  const showPlannedShiftsSection = settings?.show_planned_shifts ?? settings?.arbeitseinsaetzeSettings?.show_planned_shifts ?? true;

  const plannedCategoryOptions = Array.from(
    new Set([
      "Reinigung",
      "Anlage",
      "Gastronomie",
      "Platzpflege",
      ...categories,
      ...plannedShifts.map(s => s.category).filter(Boolean)
    ])
  ).sort((a, b) => a.localeCompare(b, "de"));

  const plannedShiftYears = Array.from(
    new Set([currentYearNum, currentYearNum + 1, ...plannedShifts.map(s => parseInt(s.date.split("-")[0])).filter(y => !isNaN(y))])
  ).sort((a, b) => b - a);

  const filteredPlannedShifts = plannedShifts
    .filter(s => {
      if (s.date && !s.date.startsWith(plannedYear.toString())) {
        return false;
      }
      if (plannedCategoryFilter !== "all" && s.category.toLowerCase() !== plannedCategoryFilter.toLowerCase()) {
        return false;
      }
      if (plannedSearchQuery.trim()) {
        const q = plannedSearchQuery.toLowerCase().trim();
        const matchTitle = s.title_description?.toLowerCase().includes(q);
        const matchCat = s.category?.toLowerCase().includes(q);
        const matchTime = s.time_window?.toLowerCase().includes(q);
        const matchDate = s.date?.toLowerCase().includes(q);
        const matchUsers = s.assigned_user_ids?.some(uid => {
          const u = users[uid];
          if (!u) return false;
          return (u.firstName + " " + u.lastName + " " + u.klarname + " " + u.name).toLowerCase().includes(q);
        });
        if (!matchTitle && !matchCat && !matchTime && !matchDate && !matchUsers) return false;
      }
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time_window || "").localeCompare(b.time_window || ""));

  const handleSignUpForShift = async (shift: PlannedWorkShift) => {
    const clubId = currentClubId;
    await signUpForPlannedWorkShift(clubId, shift, currentUser.id);
  };

  const handleSignOutFromShift = async (shift: PlannedWorkShift) => {
    const clubId = currentClubId;
    await signOutFromPlannedWorkShift(clubId, shift, currentUser.id);
  };

  const filteredMemberSuggestions = (Object.values(users) as User[])
    .filter(u => u.role !== Role.SUPER_ADMIN && !u.isSuspended)
    .filter(u => !shiftAssignedUserIds.includes(u.id))
    .filter(u => {
      if (!shiftMemberSearchQuery.trim()) return false;
      const q = shiftMemberSearchQuery.toLowerCase().trim();
      const name = getUserDisplayName(u).toLowerCase();
      return name.includes(q);
    })
    .sort(compareUsersByLastName);

  const handleOpenCreateShiftModal = () => {
    setEditingShift(null);
    const today = new Date().toISOString().split("T")[0];
    setShiftDate(today);
    setShiftStartTime("");
    setShiftEndTime("");
    const defaultCategory = plannedCategoryOptions[0] || "Reinigung";
    setShiftCategory(defaultCategory);
    setShiftTitleDescription("");
    setShiftRequiredVolunteers(2);
    setShiftAssignedUserIds([]);
    setShiftMemberSearchQuery("");
    setShiftMemberSearchOpen(false);
    setShiftFormError(null);
    setShowPlannedModal(true);
  };

  const handleOpenEditShiftModal = (shift: PlannedWorkShift) => {
    setEditingShift(shift);
    setShiftDate(shift.date);

    let start = "";
    let end = "";
    if (shift.time_window) {
      const times = shift.time_window.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (times && times.length >= 3) {
        start = times[1];
        end = times[2];
      } else {
        const abMatch = shift.time_window.match(/ab\s*(\d{1,2}:\d{2})/i);
        const bisMatch = shift.time_window.match(/bis\s*(\d{1,2}:\d{2})/i);
        if (abMatch) start = abMatch[1];
        if (bisMatch) end = bisMatch[1];
        if (!abMatch && !bisMatch) {
          const singleMatch = shift.time_window.match(/(\d{1,2}:\d{2})/);
          if (singleMatch) start = singleMatch[1];
        }
      }
    }
    setShiftStartTime(start);
    setShiftEndTime(end);

    setShiftCategory(shift.category || "Reinigung");
    setShiftTitleDescription(shift.title_description || "");
    setShiftRequiredVolunteers(shift.required_volunteers || 2);
    setShiftAssignedUserIds(shift.assigned_user_ids || []);
    setShiftMemberSearchQuery("");
    setShiftMemberSearchOpen(false);
    setShiftFormError(null);
    setShowPlannedModal(true);
  };

  const handleSavePlannedShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftFormError(null);

    if (!shiftDate) {
      setShiftFormError("Bitte ein Datum angeben.");
      return;
    }
    if (!shiftCategory.trim()) {
      setShiftFormError("Bitte eine Kategorie angeben.");
      return;
    }
    if (!shiftTitleDescription.trim()) {
      setShiftFormError("Bitte eine Tätigkeit/Beschreibung angeben.");
      return;
    }
    if (!shiftRequiredVolunteers || shiftRequiredVolunteers < 1) {
      setShiftFormError("Die Anzahl der benötigten Personen muss mindestens 1 sein.");
      return;
    }

    let timeWindowFormatted = "";
    if (shiftStartTime && shiftEndTime) {
      timeWindowFormatted = `${shiftStartTime} - ${shiftEndTime} Uhr`;
    } else if (shiftStartTime) {
      timeWindowFormatted = `ab ${shiftStartTime} Uhr`;
    } else if (shiftEndTime) {
      timeWindowFormatted = `bis ${shiftEndTime} Uhr`;
    } else {
      timeWindowFormatted = "";
    }

    const clubId = currentClubId;
    const now = new Date().toISOString();

    const shiftToSave: PlannedWorkShift = {
      id: editingShift ? editingShift.id : `shift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: shiftDate,
      time_window: timeWindowFormatted,
      category: shiftCategory.trim(),
      title_description: shiftTitleDescription.trim(),
      required_volunteers: Math.max(1, Number(shiftRequiredVolunteers) || 1),
      assigned_user_ids: shiftAssignedUserIds,
      createdBy: editingShift ? editingShift.createdBy : (currentUser.klarname || currentUser.name),
      created_at: editingShift?.created_at || now,
      updated_at: now,
    };

    try {
      // Optimistic state update for instant UI feedback
      setPlannedShifts(prev => {
        const idx = prev.findIndex(s => s.id === shiftToSave.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = shiftToSave;
          return updated;
        } else {
          return [...prev, shiftToSave];
        }
      });

      await savePlannedWorkShift(clubId, shiftToSave);
      setShowPlannedModal(false);
      setEditingShift(null);
    } catch (err: any) {
      console.error("Fehler beim Speichern des geplanten Einsatzes:", err);
      setShiftFormError("Fehler beim Speichern: " + (err?.message || "Unbekannter Fehler"));
    }
  };

  const handleDeletePlannedShiftSubmit = async () => {
    if (!shiftToDelete) return;
    const clubId = currentClubId;
    await deletePlannedWorkShift(clubId, shiftToDelete.id);
    setShiftToDelete(null);
  };

  // Open slider for a new entry
  const handleOpenSlider = () => {
    setEditingEntry(null);
    setErrorMsg("");
    setSuccessMsg("");
    
    const today = new Date().toISOString().split("T")[0];
    setFormDate(today);
    setFormHours(Number(interval));
    setFormCategory(categories[0] || "Platzpflege");
    setFormDescription("");
    setFormUserId(isAdmin ? "" : currentUser.id);
    setFormSelectedUserIds(isAdmin ? [] : [currentUser.id]);
    setMemberSearchQuery("");
    
    setIsClosing(false);
    setIsAnimatingIn(false);
    setIsSliderOpen(true);
    setTimeout(() => setIsAnimatingIn(true), 10);
  };

  const handleCloseSlider = () => {
    setIsClosing(true);
    setIsAnimatingIn(false);
    setTimeout(() => {
      setIsSliderOpen(false);
      setIsClosing(false);
    }, 200); // 200ms out animation
  };

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
        arbeitseinsatz_rules: newRules,
      });
      setEditingRule(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    
    let newRules = [...rules];
    if (editingRule.isNew) {
      newRules.push({
        id: new Date().getFullYear().toString() + "-" + Math.random().toString(36).substr(2, 9),
        gueltig_ab_jahr: parseInt(editingRule.gueltig_ab_jahr),
        soll_stunden: parseFloat(editingRule.soll_stunden),
        stundenlohn_ersatz: parseFloat(editingRule.stundenlohn_ersatz),
      });
    } else {
      const idx = newRules.findIndex((r: any) => r.id === editingRule.id);
      if (idx !== -1) {
        newRules[idx] = {
          ...newRules[idx],
          gueltig_ab_jahr: parseInt(editingRule.gueltig_ab_jahr),
          soll_stunden: parseFloat(editingRule.soll_stunden),
          stundenlohn_ersatz: parseFloat(editingRule.stundenlohn_ersatz),
        };
      }
    }
    
    try {
      await onSaveSettings({
        ...settings,
        arbeitseinsatz_rules: newRules,
      });
      setEditingRule(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewEntry = () => {
    handleOpenSlider();
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!formDate) {
      setErrorMsg("Bitte ein gültiges Datum auswählen.");
      return;
    }
    if (formHours <= 0) {
      setErrorMsg("Die Arbeitsstunden müssen größer als 0 sein.");
      return;
    }
    const step = Number(interval);
    if (Math.round(formHours * 100) % Math.round(step * 100) !== 0) {
      setErrorMsg(`Bitte erfassen Sie die Stunden im ${interval}-Stunden-Takt.`);
      return;
    }

    if (!formCategory) {
      setErrorMsg("Bitte eine Kategorie auswählen.");
      return;
    }
    if (commentsRequired && !formDescription.trim()) {
      setErrorMsg("Bitte eine kurze Beschreibung der ausgeführten Arbeiten angeben.");
      return;
    }

    if (isAdmin && formSelectedUserIds.length === 0) {
      setErrorMsg("Bitte mindestens ein Mitglied auswählen.");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const targetUids = isAdmin ? formSelectedUserIds : [currentUser.id];
      
      for (const targetUid of targetUids) {
        const targetUser = users[targetUid] || currentUser;
        const newEntry: ArbeitsEinsatz = {
          id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${targetUid}`,
          date: formDate,
          hours: formHours,
          category: formCategory,
          description: formDescription.trim(),
          userId: targetUid,
          userName: targetUser.name,
          userFullName: targetUser.klarname || `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() || targetUser.name,
          createdBy: currentUser.name,
          createdAt: timestamp,
        };
        await saveArbeitseinsatz(currentClubId, newEntry);
      }

      if (targetUids.length > 1) {
        setSuccessMsg("Einträge erfolgreich gespeichert!");
      } else {
        setSuccessMsg("Eintrag erfolgreich gespeichert!");
      }
      setTimeout(() => {
        handleCloseSlider();
      }, 800);
    } catch (err) {
      console.error("Error saving entry:", err);
      setErrorMsg("Fehler beim Speichern. Bitte versuche es erneut.");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteArbeitseinsatz(currentClubId, entryId);
      setShowDeleteConfirmFor(null);
      setSelectedEntries(prev => prev.filter(id => id !== entryId));
    } catch (err) {
      console.error("Error deleting entry:", err);
    }
  };

  const handleMassDelete = async () => {
    try {
      for (const entryId of selectedEntries) {
        await deleteArbeitseinsatz(currentClubId, entryId);
      }
      setSelectedEntries([]);
      setShowMassDeleteConfirm(false);
    } catch (err) {
      console.error("Error mass deleting entries:", err);
    }
  };

  const handleMassCategorize = async () => {
    if (!massCategory) return;
    try {
      for (const entryId of selectedEntries) {
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          await saveArbeitseinsatz(currentClubId, {
            ...entry,
            category: massCategory
          });
        }
      }
      setSelectedEntries([]);
      setMassCategory("");
    } catch (err) {
      console.error("Error mass categorizing entries:", err);
    }
  };

  // Calculate totals per user
  let userStats = (Object.values(users) as User[])
    .filter((u) => u.role !== Role.SUPER_ADMIN && !u.isSuspended)
    .map((user) => {
      const userEntries = entriesForSaison.filter((e) => e.userId === user.id);
      const totalHours = userEntries.reduce((sum, e) => sum + e.hours, 0);
      const progress = Math.min((totalHours / sollStunden) * 100, 100);
      const isCompleted = totalHours >= sollStunden;
      const displayName = getUserDisplayName(user);
      
      return {
        user,
        displayName,
        totalHours,
        progress,
        isCompleted,
        entriesCount: userEntries.length,
      };
    })
    .filter(s => {
      if (showActiveOnly && s.totalHours === 0) return false;
      if (userStatusFilter === "fulfilled" && !s.isCompleted) return false;
      if (userStatusFilter === "pending" && s.isCompleted) return false;
      if (userSearchQuery && !s.displayName.toLowerCase().includes(userSearchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (userSortCol === "name") {
        cmp = compareUsersByLastName(a.user, b.user);
      } else if (userSortCol === "hours") {
        cmp = a.totalHours - b.totalHours;
        if (cmp === 0) cmp = compareUsersByLastName(a.user, b.user);
      } else if (userSortCol === "status") {
        const valA = a.isCompleted ? 2 : (a.totalHours > 0 ? 1 : 0);
        const valB = b.isCompleted ? 2 : (b.totalHours > 0 ? 1 : 0);
        cmp = valA - valB;
        if (cmp === 0) cmp = compareUsersByLastName(a.user, b.user);
      }
      return userSortDesc ? -cmp : cmp;
    });

  // Calculate active club stats
  const totalClubHours = entriesForSaison.reduce((sum, e) => sum + e.hours, 0);
  // Re-calculate activeMembersCount without the new search filter to be accurate
  const activeMembersCount = (Object.values(users) as User[]).filter(u => u.role !== Role.SUPER_ADMIN && !u.isSuspended && entriesForSaison.filter(e => e.userId === u.id).reduce((sum, e) => sum + e.hours, 0) > 0).length;

  const currentUserTotalHours = entriesForSaison.filter((e) => e.userId === currentUser.id).reduce((sum, e) => sum + e.hours, 0);

  // Filtered list of individual entries
  const filteredEntries = entriesForSaison.filter((e) => {
    const matchesSearch =
      e.userFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = selectedCategoryFilter === "all" || e.category === selectedCategoryFilter;
    const matchesMember = selectedMemberFilter === "all" || e.userId === selectedMemberFilter;
    
    // Only show current user's entries if not admin and list is not fully hidden
    const isOwnEntry = isAdmin || e.userId === currentUser.id;

    return matchesSearch && matchesCategory && matchesMember && isOwnEntry;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortCol === "date") cmp = a.date.localeCompare(b.date);
    else if (sortCol === "member") {
      const uA = users[a.userId];
      const uB = users[b.userId];
      if (uA && uB) {
        cmp = compareUsersByLastName(uA, uB);
      } else {
        cmp = a.userFullName.localeCompare(b.userFullName);
      }
    }
    else if (sortCol === "createdBy") {
      const uA = (Object.values(users) as User[]).find(u => u.name === a.createdBy || u.id === a.createdBy);
      const uB = (Object.values(users) as User[]).find(u => u.name === b.createdBy || u.id === b.createdBy);
      const nameA = uA ? getUserDisplayName(uA) : a.createdBy;
      const nameB = uB ? getUserDisplayName(uB) : b.createdBy;
      cmp = nameA.localeCompare(nameB);
    }
    else if (sortCol === "category") cmp = a.category.localeCompare(b.category);
    else if (sortCol === "task") cmp = a.description.localeCompare(b.description);
    else if (sortCol === "hours") cmp = a.hours - b.hours;
    return sortDesc ? -cmp : cmp;
  });

  return (
    <div className="lg:animate-in lg:fade-in lg:duration-500 pb-0 md:pb-3 w-full select-none font-sans flex flex-col space-y-3 lg:space-y-4">
      <OnboardingBanner
        show={currentUser?.show_onboarding_hints !== false}
        text='Mit "Einsatz eintragen" kannst du deine geleisteten Arbeitsstunden hinzufügen.'
        onDismiss={() => onDismissOnboardingHints?.()}
      />
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-6 space-y-6 md:space-y-8 flex flex-col">
        {/* Integrated Page Header */}
      <div className="pb-4 md:pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="hidden md:flex p-3 bg-emerald-50 rounded-2xl items-center justify-center shrink-0 text-[var(--color-primary)]">
            <Briefcase className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-sans font-bold text-slate-900 uppercase tracking-wider">
                Arbeitseinsätze
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
              Dokumentation der geleisteten Arbeitsstunden
            </p>
          </div>
        </div>
      </div>
      {/* Single Work Hours Progress Bar for the logged-in User - styled as a beautiful white card */}
      <div className="w-full">
        <div className="flex flex-row items-center justify-between gap-2 mb-1.5 sm:mb-2.5">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex w-5 h-5 rounded-full bg-emerald-50 items-center justify-center text-emerald-600 text-xs shrink-0">
              <i className="fa-solid fa-clock"></i>
            </div>
            <h2 className="text-sm xs:text-base font-black text-slate-800 uppercase tracking-wider sm:text-sm sm:font-bold sm:text-slate-700 sm:normal-case sm:tracking-normal">
              <span className="inline sm:hidden">Meine Arbeitsstunden {selectedYear}</span>
              <span className="hidden sm:inline">Dein Arbeitsstunden-Fortschritt ({selectedYear})</span>
            </h2>
          </div>
          <div className="flex items-baseline gap-1 font-mono shrink-0">
            <span className="text-sm sm:text-lg font-black text-slate-800">
              {currentUserTotalHours.toFixed(1).replace(".0", "")}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">/</span>
            <span className="text-xs sm:text-xs font-bold text-slate-500">
              {sollStunden} Std.
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-[2px] border border-slate-300/30 mt-1.5 sm:mt-0">
          <div
            style={{ width: `${sollStunden > 0 ? Math.min((currentUserTotalHours / sollStunden) * 100, 100) : 100}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              currentUserTotalHours >= sollStunden
                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                : currentUserTotalHours >= sollStunden * 0.4
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-rose-400 to-rose-500"
            }`}
          ></div>
        </div>

        {currentUserTotalHours >= sollStunden ? (
          <div className="mt-2.5 hidden sm:flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
            <i className="fa-solid fa-circle-check text-emerald-600"></i>
            <span>Soll erfüllt! Vielen Dank für deinen starken Einsatz für den Verein!</span>
          </div>
        ) : (
          <div className="mt-2.5 hidden sm:flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {currentUserTotalHours > 0
                ? "Weiter so! Jede Stunde trägt zu unserer gepflegten Anlage bei."
                : "Noch keine Stunden eingetragen. Melde jetzt deinen ersten Arbeitseinsatz an!"}
            </span>
            {sollStunden > currentUserTotalHours && (
              <span className="font-semibold text-slate-600">
                Noch {(sollStunden - currentUserTotalHours).toFixed(1).replace(".0", "")} Std. verbleibend
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Upper Table - Logs list */}
        <div className="flex flex-col">
          <div className="mb-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm xs:text-base md:text-lg font-black text-slate-800 uppercase tracking-wider">
              {isAdmin ? "Einzelnachweise" : "Meine Einzelnachweise"}
            </h2>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 cursor-pointer"
              >
                <i className="fa-solid fa-filter text-[10px]"></i>
                <span>FILTER</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-[var(--color-primary)] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleNewEntry}
                style={{ backgroundColor: primaryColor || "var(--color-primary)" }}
                className="px-3.5 py-2 bg-[var(--color-primary)] hover:brightness-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-plus"></i>
                <span>EINSATZ EINTRAGEN</span>
              </button>
            </div>
          </div>
          
          {/* Filter & Suche */}
          <div className="mb-2.5 sm:mb-6">

            {/* Desktop filters grid - always visible, no layout flash */}
            <div className="hidden md:grid md:grid-cols-4 gap-3">
              {/* Year Filter */}
              <div>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setEntriesPage(1);
                  }}
                  className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="SUCHEN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
              >
                <option value="all">ALLE BEREICHE</option>
                {categories.map((c: string) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
              
              {/* Member Dropdown */}
              {isAdmin ? (
                <select
                  value={selectedMemberFilter}
                  onChange={(e) => setSelectedMemberFilter(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                >
                  <option value="all">ALLE MITGLIEDER</option>
                  {(Object.values(users) as User[])
                    .filter((u) => u.role !== Role.SUPER_ADMIN && !u.isSuspended)
                    .sort(compareUsersByLastName)
                    .map((u) => {
                      const name = getUserDisplayName(u);
                      return (
                        <option key={u.id} value={u.id}>
                          {name.toUpperCase()}
                        </option>
                      );
                    })}
                </select>
              ) : (
                <div className="hidden md:block"></div>
              )}
            </div>

            {/* Mobile filters section with smooth expand/collapse */}
            <div className="md:hidden">
              <AnimatePresence initial={false}>
                {showMobileFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-3 pb-2">
                      {/* Search input */}
                      <div className="relative">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                          type="text"
                          placeholder="SUCHEN..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-10 pl-9 pr-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>

                      {/* Category Dropdown */}
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                      >
                        <option value="all">ALLE BEREICHE</option>
                        {categories.map((c: string) => (
                          <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                      </select>
                      
                      {/* Member Dropdown */}
                      {isAdmin && (
                        <select
                          value={selectedMemberFilter}
                          onChange={(e) => setSelectedMemberFilter(e.target.value)}
                          className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                        >
                          <option value="all">ALLE MITGLIEDER</option>
                          {(Object.values(users) as User[])
                            .filter((u) => u.role !== Role.SUPER_ADMIN && !u.isSuspended)
                            .sort(compareUsersByLastName)
                            .map((u) => {
                              const name = getUserDisplayName(u);
                              return (
                                <option key={u.id} value={u.id}>
                                  {name.toUpperCase()}
                                </option>
                              );
                            })}
                        </select>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Mass Actions */}
          {isAdmin && selectedEntries.length > 0 && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-700 self-start md:self-auto">
                {selectedEntries.length} Eintrag(e) ausgewählt
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                <select
                  value={massCategory}
                  onChange={(e) => setMassCategory(e.target.value)}
                  className="h-10 px-3 bg-white text-sm text-slate-700 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all uppercase cursor-pointer w-full sm:w-auto sm:min-w-[180px] font-sans font-medium"
                >
                  <option value="">UMGRUPPIEREN NACH...</option>
                  {categories.map((c: string) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleMassCategorize}
                    disabled={!massCategory}
                    className="h-10 flex-1 sm:flex-none px-4 bg-[var(--color-primary)] text-white !text-sm font-medium rounded-lg hover:bg-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Übernehmen
                  </button>
                  <button
                    onClick={() => setShowMassDeleteConfirm(true)}
                    className="h-10 flex-1 sm:flex-none px-4 bg-rose-500 text-white !text-sm font-medium rounded-lg hover:bg-rose-600 transition-colors whitespace-nowrap"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-xs">
                    {isAdmin && (
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedEntries.length > 0 && selectedEntries.length === filteredEntries.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEntries(filteredEntries.map(e => e.id));
                            } else {
                              setSelectedEntries([]);
                            }
                          }}
                          className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("date")}>
                      Datum {sortCol === "date" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("member")}>
                      Mitglied {sortCol === "member" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("createdBy")}>
                      Eingetragen durch {sortCol === "createdBy" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("category")}>
                      Kategorie {sortCol === "category" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("task")}>
                      Tätigkeit {sortCol === "task" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 text-center cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleSort("hours")}>
                      Stunden {sortCol === "hours" && <i className={`fa-solid fa-sort-${sortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    {isAdmin && <th className="py-3 px-4 text-right">Aktionen</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.slice((entriesPage - 1) * ITEMS_PER_PAGE, entriesPage * ITEMS_PER_PAGE).map((e) => {
                    const memberName = users[e.userId] ? getUserDisplayName(users[e.userId]) : e.userFullName;
                    const creatorUser = (Object.values(users) as User[]).find(u => u.name === e.createdBy || u.id === e.createdBy);
                    const creatorName = creatorUser ? getUserDisplayName(creatorUser) : e.createdBy;
                    const isSelected = selectedEntries.includes(e.id);
                    return (
                      <tr key={e.id} className={`${isSelected ? "bg-[var(--color-primary)]/5" : "hover:bg-slate-50/50"} transition-colors text-sm font-normal`}>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center align-middle">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(ev) => {
                                  if (ev.target.checked) {
                                    setSelectedEntries(prev => [...prev, e.id]);
                                  } else {
                                    setSelectedEntries(prev => prev.filter(id => id !== e.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            </div>
                          </td>
                        )}
                        <td className="py-3 px-4 whitespace-nowrap text-sm font-normal text-slate-700 align-middle">
                          <div className="flex items-center">
                            {new Date(e.date).toLocaleDateString("de-DE")}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-normal text-slate-700 align-middle">
                          <div className="flex items-center">
                            {memberName}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-normal text-slate-600 align-middle">
                          <div className="flex items-center">
                            {creatorName}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-normal uppercase tracking-wider text-[11px] leading-none">
                              {e.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-normal text-slate-600 max-w-[200px] truncate align-middle" title={e.description}>
                          <div className="flex items-center truncate">
                            {e.description}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-sm font-normal text-slate-700 align-middle">
                          <div className="flex items-center justify-center">
                            {e.hours}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => setShowDeleteConfirmFor(e.id)}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors inline-flex items-center justify-center align-middle"
                              >
                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 6} className="py-8 text-center text-slate-400 font-medium">
                        Keine Arbeitseinsätze gefunden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Compact Mobile-friendly Card View */}
            <div className="block md:hidden space-y-2">
              {filteredEntries.slice((entriesPage - 1) * ITEMS_PER_PAGE, entriesPage * ITEMS_PER_PAGE).map((e) => {
                const memberName = users[e.userId] ? getUserDisplayName(users[e.userId]) : e.userFullName;
                const creatorUser = (Object.values(users) as User[]).find(u => u.name === e.createdBy || u.id === e.createdBy);
                const creatorName = creatorUser ? getUserDisplayName(creatorUser) : e.createdBy;
                const isSelected = selectedEntries.includes(e.id);
                const isExpanded = expandedMobileEntries.includes(e.id);

                const toggleExpanded = () => {
                  setExpandedMobileEntries(prev =>
                    prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
                  );
                };

                return (
                  <div 
                    key={e.id}
                    onClick={toggleExpanded}
                    className={`py-2 px-3 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer select-none active:scale-[0.99] ${
                      isSelected 
                        ? "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/30 shadow-sm" 
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* ZEILE 1 (Flex-Row): Links die Checkbox + Name ("System-Admin"), direkt gefolgt vom Stunden-Badge ("0.25 Std."). Ganz rechts auf derselben Linie platziere das Mülleimer-Icon */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(ev) => {
                              if (ev.target.checked) {
                                setSelectedEntries(prev => [...prev, e.id]);
                              } else {
                                setSelectedEntries(prev => prev.filter(id => id !== e.id));
                              }
                            }}
                            className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] h-3.5 w-3.5 shrink-0 cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        )}
                        <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                          {memberName}
                        </span>
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/50 font-black text-[10px]">
                          {e.hours} Std.
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setShowDeleteConfirmFor(e.id);
                            }}
                            className="w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                          >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                          </button>
                        )}
                        <span className="text-slate-400 w-5 h-5 flex items-center justify-center">
                          <i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"} text-[9px] transition-transform duration-200`}></i>
                        </span>
                      </div>
                    </div>

                    {/* ZEILE 2 (Sub-Row direkt darunter): Bündele alle Metadaten oder expandiere sie */}
                    {!isExpanded ? (
                      <div className="text-[10px] text-slate-400 truncate w-full">
                        {new Date(e.date).toLocaleDateString("de-DE")} • {e.category.toUpperCase()}
                        {e.description ? ` • ${e.description}` : ""}
                        {creatorName && creatorName !== memberName ? ` • Eingetragen durch: ${creatorName}` : ""}
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1.5 w-full animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Datum:</span>
                          <span className="text-slate-700 font-bold">{new Date(e.date).toLocaleDateString("de-DE")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Kategorie:</span>
                          <span className="text-slate-700 font-black uppercase text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/40">
                            {e.category}
                          </span>
                        </div>
                        {e.description && (
                          <div className="flex flex-col gap-1 bg-slate-50/70 p-2 rounded-xl border border-slate-200/50">
                            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Beschreibung:</span>
                            <span className="text-slate-700 font-medium italic break-words whitespace-pre-wrap leading-relaxed text-[11px]">
                              {e.description}
                            </span>
                          </div>
                        )}
                        {creatorName && creatorName !== memberName && (
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Eingetragen durch:</span>
                            <span className="text-slate-700 font-bold">{creatorName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredEntries.length === 0 && (
                <div className="text-center py-8 text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Keine Arbeitseinsätze gefunden
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {filteredEntries.length > ITEMS_PER_PAGE && (
              <div className="flex justify-between items-center mt-4 px-2">
                <button 
                  disabled={entriesPage === 1}
                  onClick={() => setEntriesPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-chevron-left mr-1"></i> Zurück
                </button>
                <div className="text-xs font-medium text-slate-500">
                  Seite {entriesPage} von {Math.ceil(filteredEntries.length / ITEMS_PER_PAGE)}
                </div>
                <button 
                  disabled={entriesPage >= Math.ceil(filteredEntries.length / ITEMS_PER_PAGE)}
                  onClick={() => setEntriesPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter <i className="fa-solid fa-chevron-right ml-1"></i>
                </button>
              </div>
            )}
          </div>

        {/* SECTION: GEPLANTE ARBEITSEINSÄTZE (Putzplan & Arbeitsdienste) */}
        {(showPlannedShiftsSection || isAdmin) && (
          <div className="flex flex-col mt-8 pt-6 border-t-2 border-slate-200">
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm xs:text-base md:text-lg font-black text-slate-800 uppercase tracking-wider">
                  Geplante Arbeitseinsätze
                </h2>
                {!showPlannedShiftsSection && isAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                    Für Mitglieder ausgeblendet
                  </span>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenCreateShiftModal}
                  className="px-3.5 py-2 bg-[var(--color-primary)] hover:brightness-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>EINSATZ ANLEGEN</span>
                </button>
              )}
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4 bg-slate-50  px-3 py-1.5 sm:p-3 rounded-2xl border border-slate-200/80">
              {/* Year Dropdown */}
              <div className="relative min-w-[110px]">
                <select
                  value={plannedYear}
                  onChange={(e) => setPlannedYear(Number(e.target.value))}
                  className="w-full h-9 pl-3 pr-8 bg-white text-xs text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] appearance-none cursor-pointer font-sans font-medium"
                >
                  {plannedShiftYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Jahr: {yr}
                    </option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
              </div>

              {/* Category Dropdown */}
              <div className="relative min-w-[150px]">
                <select
                  value={plannedCategoryFilter}
                  onChange={(e) => setPlannedCategoryFilter(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 bg-white text-xs text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] appearance-none cursor-pointer font-sans font-medium"
                >
                  <option value="all">Alle Kategorien</option>
                  {plannedCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
              </div>

              {/* Search Input */}
              <div className="relative flex-1 min-w-[180px]">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={plannedSearchQuery}
                  onChange={(e) => setPlannedSearchQuery(e.target.value)}
                  placeholder="Suchen..."
                  className="w-full h-9 pl-8 pr-8 bg-white text-xs text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />
                {plannedSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPlannedSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Table Desktop View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-xs">
                    <th className="py-3 px-4 w-[16%]">Datum</th>
                    <th className="py-3 px-4 w-[16%]">Kategorie</th>
                    <th className="py-3 px-4 w-[28%]">Tätigkeit / Bereich</th>
                    <th className="py-3 px-4 w-[24%]">Eingetragene Personen</th>
                    <th className="py-3 px-4 w-[16%] text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredPlannedShifts.map((shift) => {
                    const isAssigned = shift.assigned_user_ids.includes(currentUser.id);
                    const isFull = shift.assigned_user_ids.length >= shift.required_volunteers;

                    return (
                      <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Datum & Zeitfenster */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-bold text-slate-800">
                            {new Date(shift.date).toLocaleDateString("de-DE", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                          {shift.time_window && (
                            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                              <i className="fa-regular fa-clock mr-1 text-[10px]"></i>
                              {shift.time_window}
                            </div>
                          )}
                        </td>

                        {/* Kategorie Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            {shift.category}
                          </span>
                        </td>

                        {/* Tätigkeit / Beschreibung */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-bold text-slate-800 text-xs leading-snug">
                            {shift.title_description}
                          </div>
                        </td>

                        {/* Eingetragene Personen */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            {Array.from({ length: Math.max(shift.required_volunteers, shift.assigned_user_ids.length) }).map((_, idx) => {
                              const assignedId = shift.assigned_user_ids[idx];
                              if (assignedId) {
                                const assignedUser = users[assignedId];
                                const nameFormatted = getMemberFormattedName(assignedUser, assignedId);
                                const isSelf = assignedId === currentUser.id;

                                return (
                                  <div key={idx} className="flex items-center justify-between gap-1 text-slate-700 text-xs font-semibold">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span className="text-emerald-600 font-bold">•</span>
                                      <span className={isSelf ? "font-black text-[var(--color-primary)]" : ""}>
                                        {nameFormatted} {isSelf && "(Du)"}
                                      </span>
                                    </span>
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        title="Aus Slot austragen"
                                        onClick={() => signOutFromPlannedWorkShift(currentClubId, shift, assignedId)}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                                      >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                      </button>
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={idx} className="text-slate-400 text-xs font-medium italic flex items-center gap-1.5">
                                    <span className="text-slate-300">•</span>
                                    <span>[ Offen ]</span>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </td>

                        {/* Aktionen */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* User Self-Service buttons */}
                            {isAssigned ? (
                              <button
                                type="button"
                                onClick={() => handleSignOutFromShift(shift)}
                                className="px-2.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50/50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <i className="fa-solid fa-user-minus text-[10px]"></i>
                                <span>Mich austragen</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSignUpForShift(shift)}
                                className="px-3 py-1.5 rounded-xl bg-[var(--color-primary)] hover:brightness-95 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <i className="fa-solid fa-user-plus text-[10px]"></i>
                                <span>+ Mich eintragen</span>
                              </button>
                            )}

                            {/* Admin edit & delete controls */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                                <button
                                  type="button"
                                  title="Einsatz bearbeiten"
                                  onClick={() => handleOpenEditShiftModal(shift)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button
                                  type="button"
                                  title="Einsatz löschen"
                                  onClick={() => setShiftToDelete(shift)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPlannedShifts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                        Keine geplanten Arbeitseinsätze vorhanden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {filteredPlannedShifts.map((shift) => {
                const isAssigned = shift.assigned_user_ids.includes(currentUser.id);
                const isFull = shift.assigned_user_ids.length >= shift.required_volunteers;

                return (
                  <div
                    key={shift.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80 mb-1">
                          {shift.category}
                        </span>
                        <div className="font-bold text-slate-800 text-sm">
                          {new Date(shift.date).toLocaleDateString("de-DE", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </div>
                        {shift.time_window && (
                          <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <i className="fa-regular fa-clock text-[10px]"></i>
                            {shift.time_window}
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditShiftModal(shift)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 bg-slate-50"
                          >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShiftToDelete(shift)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 bg-slate-50"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-800 bg-slate-50 h-8 px-3 py-1 rounded-xl border border-slate-100 font-sans font-medium">
                      {shift.title_description}
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Eingetragene Personen ({shift.assigned_user_ids.length} / {shift.required_volunteers}):
                      </span>
                      {Array.from({ length: Math.max(shift.required_volunteers, shift.assigned_user_ids.length) }).map((_, idx) => {
                        const assignedId = shift.assigned_user_ids[idx];
                        if (assignedId) {
                          const assignedUser = users[assignedId];
                          const nameFormatted = getMemberFormattedName(assignedUser, assignedId);
                          const isSelf = assignedId === currentUser.id;
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                              <span className="flex items-center gap-1.5">
                                <span className="text-emerald-600 font-bold">•</span>
                                <span className={isSelf ? "font-black text-[var(--color-primary)]" : ""}>
                                  {nameFormatted} {isSelf && "(Du)"}
                                </span>
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => signOutFromPlannedWorkShift(currentClubId, shift, assignedId)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5"
                                >
                                  <i className="fa-solid fa-xmark text-xs"></i>
                                </button>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div key={idx} className="text-slate-400 text-xs font-medium italic flex items-center gap-1.5">
                              <span className="text-slate-300">•</span>
                              <span>[ Offen ]</span>
                            </div>
                          );
                        }
                      })}
                    </div>

                    <div className="pt-2 flex justify-end">
                      {isAssigned ? (
                        <button
                          type="button"
                          onClick={() => handleSignOutFromShift(shift)}
                          className="w-full py-2 px-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-user-minus text-[10px]"></i>
                          <span>Mich austragen</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSignUpForShift(shift)}
                          className="w-full py-2 px-3 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <i className="fa-solid fa-user-plus text-[10px]"></i>
                          <span>+ Mich eintragen</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredPlannedShifts.length === 0 && (
                <div className="text-center py-8 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Keine geplanten Arbeitseinsätze vorhanden.
                </div>
              )}
            </div>
          </div>
        )}
  
        {!isListHidden && (
          <div 
            onTouchStart={isMobile ? handleTouchStart : undefined}
            onTouchEnd={isMobile ? handleTouchEnd : undefined}
            className="flex flex-col mt-4 pt-4 border-t border-slate-100"
          >
            <div className="mb-4 pb-3 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-sm xs:text-base md:text-lg font-black text-slate-800 uppercase tracking-wider">
                 Aggregierte Werte je Mitglied
              </h2>
              {isAdmin && selectedMemberFilter !== "all" && (
                <button
                  onClick={() => setSelectedMemberFilter("all")}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Filter zurücksetzen <i className="fa-solid fa-xmark ml-1"></i>
                </button>
              )}
            </div>
            
            {/* Filter & Suche */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Dropdown Jahr */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Suchfeld Mitglieder */}
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="MITGLIEDER SUCHEN..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                {/* Dropdown Status */}
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all uppercase cursor-pointer font-sans font-medium"
                >
                  <option value="all">Alle Einträge</option>
                  <option value="fulfilled">SOLL ERFÜLLT</option>
                  <option value="pending">SOLL AUSSTEHEND</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto" style={isMobile ? swipeStyle : undefined}>
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-xs">
                    <th className="py-3 px-4 w-[50%] cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleUserSort("name")}>
                      Mitglied {userSortCol === "name" && <i className={`fa-solid fa-sort-${userSortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 w-[25%] text-center cursor-pointer hover:text-[var(--color-primary)] transition-colors" onClick={() => handleUserSort("hours")}>
                      Stunden {userSortCol === "hours" && <i className={`fa-solid fa-sort-${userSortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                    <th className="py-3 px-4 w-[25%] text-center cursor-pointer hover:text-[var(--color-primary)] transition-colors hidden sm:table-cell" onClick={() => handleUserSort("status")}>
                      Status {userSortCol === "status" && <i className={`fa-solid fa-sort-${userSortDesc ? "down" : "up"} ml-1`}></i>}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userStats.slice((usersPage - 1) * ITEMS_PER_PAGE, usersPage * ITEMS_PER_PAGE).map(({ user, displayName, totalHours, progress, isCompleted }) => {
                    const colorHex = isCompleted ? "#10b981" : (totalHours > 0 ? "#3b82f6" : "#f59e0b");
                    const isSelected = selectedMemberFilter === user.id;
                    return (
                      <tr
                        key={user.id}
                        onClick={() => {
                          if (isAdmin && typeof window !== "undefined" && window.innerWidth >= 768) {
                            if (isSelected) {
                              setSelectedMemberFilter("all");
                            } else {
                              setSelectedMemberFilter(user.id);
                            }
                          }
                        }}
                        title={isAdmin && typeof window !== "undefined" && window.innerWidth >= 768 ? (isSelected ? "Auswahl aufheben" : "Klicken, um Einzelnachweise auf dieses Mitglied zu filtern") : undefined}
                        className={`transition-all ${
                          isAdmin ? "md:cursor-pointer md:hover:bg-slate-100/50" : ""
                        } ${
                          isSelected ? "md:bg-emerald-50/40 md:hover:bg-emerald-50/60 md:border-l-4 md:border-emerald-500" : ""
                        }`}
                      >
                        <td className="py-3 px-4 w-[50%] align-middle truncate">
                          <div className="flex items-center gap-2 text-sm font-normal text-slate-700 truncate">
                            <span className="truncate">{displayName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 w-[25%] text-center text-sm font-normal text-slate-700 align-middle">
                          <div className="flex items-center justify-center">
                            {totalHours.toFixed(1)} <span className="text-slate-400 font-normal text-xs uppercase ml-1">Std.</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 w-[25%] text-center align-middle hidden sm:table-cell">
                          <div className="flex items-center justify-center">
                            {(() => {
                              let bg = "bg-rose-50 text-rose-700 border border-rose-150";
                              let label = "Keine Stunden";
                              let icon = "fa-xmark";
                              if (isCompleted) {
                                bg = "bg-emerald-50 text-emerald-700 border border-emerald-150";
                                label = "Ziel erreicht";
                                icon = "fa-check";
                              } else if (totalHours > 0) {
                                bg = "bg-amber-50 text-amber-700 border border-amber-150";
                                label = "Unter Ziel";
                                icon = "fa-clock";
                              }
                              return (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-normal uppercase tracking-wider text-[10px] leading-none ${bg}`}>
                                  <i className={`fa-solid ${icon} mr-1`}></i>
                                  {label}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {userStats.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                        Keine Einträge gefunden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls for Users */}
            {userStats.length > ITEMS_PER_PAGE && (
              <div className="flex justify-between items-center mt-4 px-2">
                <button 
                  disabled={usersPage === 1}
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-chevron-left mr-1"></i> Zurück
                </button>
                <div className="text-xs font-medium text-slate-500">
                  Seite {usersPage} von {Math.ceil(userStats.length / ITEMS_PER_PAGE)}
                </div>
                <button 
                  disabled={usersPage >= Math.ceil(userStats.length / ITEMS_PER_PAGE)}
                  onClick={() => setUsersPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter <i className="fa-solid fa-chevron-right ml-1"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialogs */}
      {(showDeleteConfirmFor || showMassDeleteConfirm) && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-2">
              Löschen bestätigen
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {showMassDeleteConfirm 
                ? (selectedEntries.length === 1
                  ? "Möchtest du wirklich 1 Arbeitseintrag endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                  : `Möchtest du wirklich ${selectedEntries.length} Arbeitseinträge endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)
                : "Möchtest du wirklich diesen Arbeitseintrag endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmFor(null);
                  setShowMassDeleteConfirm(false);
                }}
                className="px-4 py-2 !text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  if (showMassDeleteConfirm) {
                    handleMassDelete();
                  } else if (showDeleteConfirmFor) {
                    handleDeleteEntry(showDeleteConfirmFor);
                  }
                }}
                className="px-4 py-2 !text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors shadow-sm"
              >
                Endgültig Löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Slider / Drawer for new entry */}
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
                <i className="fa-solid fa-xmark text-white text-base"></i>
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
                        soll_stunden: 10,
                        stundenlohn_ersatz: "15.00"
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
                            stundenlohn_ersatz: typeof rule.stundenlohn_ersatz === "number" ? rule.stundenlohn_ersatz.toFixed(2) : parseFloat(rule.stundenlohn_ersatz || 0).toFixed(2)
                          })}
                          className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="font-bold text-slate-800 text-sm shrink-0">
                              Ab {rule.gueltig_ab_jahr}
                            </span>
                            <span className="text-xs text-slate-500 font-normal truncate">
                              Soll: {rule.soll_stunden} Std. &bull; Ersatz: {rule.stundenlohn_ersatz.toFixed(2).replace(".", ",")} &euro;/Std.
                            </span>
                          </div>
                          <div className="flex items-center pl-4 shrink-0">
                            <i className="fa-solid fa-pen text-xs text-slate-300 group-hover:text-[var(--color-primary)] transition-colors"></i>
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
                    <h4 className="text-sm font-bold text-slate-800 mb-4">Arbeitseinsätze & Gebühren</h4>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">
                        Soll-Stunden pro Jahr
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={editingRule.soll_stunden}
                          onChange={(e) => setEditingRule({...editingRule, soll_stunden: e.target.value})}
                          className="w-full h-10 pl-4 pr-12 bg-slate-50 text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">Std.</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">
                        Ersatzgebühr (bei Nicht-Erfüllung)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingRule.stundenlohn_ersatz}
                          onChange={(e) => setEditingRule({...editingRule, gueltig_ab_jahr: editingRule.gueltig_ab_jahr, stundenlohn_ersatz: e.target.value})}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setEditingRule({
                                ...editingRule,
                                stundenlohn_ersatz: val.toFixed(2)
                              });
                            }
                          }}
                          className="w-full h-10 pl-4 pr-16 bg-slate-50 text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">€ / Std.</span>
                      </div>
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
                  <i className="fa-solid fa-floppy-disk mr-2"></i> Speichern
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {isSliderOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
          onClick={handleCloseSlider}
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
              style={{ backgroundColor: primaryColor || "var(--color-primary)" }}
              className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden"
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
                  Einsatz erfassen
                </h3>
                <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                  <i className="fa-solid fa-file-signature text-white"></i>
                  Arbeitseinsatz dokumentieren
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSlider}
                className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 bg-white">
              <div className="bg-white p-5 pb-6 space-y-4 overflow-y-auto flex-1 text-slate-700">
                
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 text-xs font-bold flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5 animate-pulse"></i>
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-200 text-xs font-bold flex items-start gap-2">
                    <i className="fa-solid fa-check mt-0.5"></i>
                    {successMsg}
                  </div>
                )}
                
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Mitglieder ({formSelectedUserIds.length} ausgewählt)
                    </label>
                    
                    {/* Search box with autocomplete */}
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="Mitglieder suchen..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 focus:outline-none focus:border-slate-800 focus:bg-white transition-all font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                      {memberSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMemberSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      )}

                      {/* Autocomplete Dropdown - ONLY shown if search query is entered */}
                      {memberSearchQuery.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                          {(() => {
                            const matches = (Object.values(users) as User[])
                              .filter((u) => u.role !== Role.SUPER_ADMIN && !u.isSuspended)
                              .filter((u) => !formSelectedUserIds.includes(u.id))
                              .filter((u) => {
                                const name = getUserDisplayName(u).toLowerCase();
                                return name.includes(memberSearchQuery.toLowerCase().trim());
                              })
                              .sort(compareUsersByLastName);

                            if (matches.length === 0) {
                              return (
                                <div className="px-3.5 py-3 text-xs text-slate-400 italic">
                                  Kein passendes Mitglied gefunden
                                </div>
                              );
                            }

                            return matches.map((u) => {
                              const name = getUserDisplayName(u);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setFormSelectedUserIds(prev => [...prev, u.id]);
                                    setMemberSearchQuery("");
                                  }}
                                  className="w-full text-left h-8 px-3 py-1 hover:bg-slate-50 text-xs text-slate-800 flex items-center justify-between transition-colors cursor-pointer font-sans font-medium"
                                >
                                  <span>{name}</span>
                                  <i className="fa-solid fa-plus text-[10px] text-[var(--color-primary)]"></i>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Selected Badges */}
                    {formSelectedUserIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1 max-h-28 overflow-y-auto">
                        {formSelectedUserIds.map((uid) => {
                          const u = users[uid];
                          if (!u) return null;
                          const name = getUserDisplayName(u);
                          return (
                            <span
                              key={uid}
                              className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs font-bold shadow-2xs"
                            >
                              <span>{name}</span>
                              <button
                                type="button"
                                onClick={() => setFormSelectedUserIds(prev => prev.filter(id => id !== uid))}
                                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-bold transition-all cursor-pointer"
                              >
                                <i className="fa-solid fa-xmark text-[10px]"></i>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic bg-slate-50 h-8 px-3 py-1 rounded-xl border border-dashed border-slate-200 text-center font-sans font-medium">
                        Keine Mitglieder ausgewählt. Tippe oben einen Namen ein.
                      </div>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                      Datum
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs outline-none focus:border-slate-800 transition-colors text-slate-900 cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
  
                  {/* Hours */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                      Stunden
                    </label>
                    <input
                      type="number"
                      value={formHours || ""}
                      onChange={(e) => setFormHours(Number(e.target.value))}
                      step={interval}
                      min={interval}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs outline-none focus:border-slate-800 transition-colors text-slate-900 cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                    <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 block leading-tight">
                      Erfassung im {interval}-Std.-Takt
                    </span>
                  </div>
                </div>

                {/* Category Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Kategorie / Arbeitsbereich
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-8 px-3 py-1 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 focus:outline-none focus:border-slate-800 transition-all cursor-pointer font-sans font-medium"
                  >
                    {categories.map((c: string) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Beschreibung der Arbeiten {commentsRequired ? "*" : "(Optional)"}
                  </label>
                  <textarea
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Bsp. Unkraut gejätet, Linien repariert, Platz abgezogen..."
                    required={commentsRequired}
                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 focus:border-slate-800 transition-all text-slate-700 resize-none cursor-text font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  ></textarea>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
                <button
                  type="submit"
                  style={{ backgroundColor: primaryColor || "var(--color-primary)" }}
                  className="flex-1 text-white rounded-xl shadow hover:brightness-95 transition-all flex items-center justify-center gap-1.5 active:scale-95 py-2.5 !text-sm font-medium cursor-pointer"
                >
                  <i className="fa-solid fa-check-circle"></i> Speichern
                </button>
                <button
                  type="button"
                  onClick={handleCloseSlider}
                  className="px-6 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-xl shadow-sm transition-all !text-sm font-medium active:scale-95 cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Create/Edit Planned Shift Slide-Over Panel (Sheet / Drawer) */}
      {showPlannedModal && createPortal(
        <div className="fixed inset-0 z-[999999] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowPlannedModal(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />

          {/* Slide-over Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between pointer-events-auto"
            >
                {/* Drawer Header */}
                <div 
                  style={{ backgroundColor: primaryColor || "var(--color-primary)" }}
                  className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden"
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
                      {editingShift ? "Einsatz bearbeiten" : "Geplanten Einsatz anlegen"}
                    </h3>
                    <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-plus text-white"></i>
                      {editingShift ? "Ändere die Details des Einsatztermins" : "Erstelle einen neuen Arbeitsdienst oder Putzplan"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlannedModal(false)}
                    className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-base"></i>
                  </button>
                </div>

                {/* Form Content - Scrollable area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {shiftFormError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-3">
                      <i className="fa-solid fa-triangle-exclamation text-sm shrink-0"></i>
                      <span>{shiftFormError}</span>
                    </div>
                  )}

                  <form id="planned-shift-form" onSubmit={handleSavePlannedShiftSubmit} className="space-y-5">
                    {/* Datum */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Datum
                      </label>
                      <input
                        type="date"
                        required
                        value={shiftDate}
                        onChange={(e) => setShiftDate(e.target.value)}
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Ab & Bis */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                          Ab
                        </label>
                        <input
                          type="time"
                          value={shiftStartTime}
                          onChange={(e) => setShiftStartTime(e.target.value)}
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                          Bis
                        </label>
                        <input
                          type="time"
                          value={shiftEndTime}
                          onChange={(e) => setShiftEndTime(e.target.value)}
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Kategorie */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Kategorie
                      </label>
                      <select
                        required
                        value={shiftCategory}
                        onChange={(e) => setShiftCategory(e.target.value)}
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white cursor-pointer font-sans font-medium"
                      >
                        {plannedCategoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tätigkeit / Beschreibung */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Tätigkeit / Beschreibung
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="z.B. Sportheim & Duschen gründlich reinigen"
                        value={shiftTitleDescription}
                        onChange={(e) => setShiftTitleDescription(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white resize-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Benötigte Personen */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Benötigte Personen
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        required
                        value={shiftRequiredVolunteers}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setShiftRequiredVolunteers(val);
                          if (shiftAssignedUserIds.length > val) {
                            setShiftAssignedUserIds(prev => prev.slice(0, val));
                          }
                        }}
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Autocomplete Member Selection */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Eingetragene Mitglieder ({shiftAssignedUserIds.length})
                        </label>
                      </div>

                      {/* Search / Autocomplete Field */}
                      <div className="relative">
                        <i className="fa-solid fa-user-plus absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                          type="text"
                          placeholder="Mitglied suchen und auswählen..."
                          value={shiftMemberSearchQuery}
                          onChange={(e) => {
                            setShiftMemberSearchQuery(e.target.value);
                            setShiftMemberSearchOpen(true);
                          }}
                          onFocus={() => setShiftMemberSearchOpen(true)}
                          className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[var(--color-primary)] focus:bg-white font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                        {shiftMemberSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setShiftMemberSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}

                        {/* Autocomplete Dropdown */}
                        {shiftMemberSearchOpen && shiftMemberSearchQuery.trim().length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                            {filteredMemberSuggestions.length > 0 ? (
                              filteredMemberSuggestions.map((u) => {
                                const name = getUserDisplayName(u);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                      setShiftAssignedUserIds(prev => [...prev, u.id]);
                                      setShiftMemberSearchQuery("");
                                      setShiftMemberSearchOpen(false);
                                    }}
                                    className="w-full text-left h-8 px-3 py-1 hover:bg-slate-50 text-xs text-slate-800 flex items-center justify-between transition-colors cursor-pointer font-sans font-medium"
                                  >
                                    <span>{name}</span>
                                    <i className="fa-solid fa-plus text-[10px] text-[var(--color-primary)]"></i>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3.5 py-3 text-xs text-slate-400 italic">
                                Kein passendes Mitglied gefunden
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected Member Badges / Tags */}
                      {shiftAssignedUserIds.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {shiftAssignedUserIds.map((uid) => {
                            const name = getUserDisplayName(uid);
                            return (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs"
                              >
                                <i className="fa-solid fa-user-check text-[10px] text-emerald-600"></i>
                                <span>{name}</span>
                                <button
                                  type="button"
                                  onClick={() => setShiftAssignedUserIds(prev => prev.filter(id => id !== uid))}
                                  className="ml-1 text-emerald-600 hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                  <i className="fa-solid fa-xmark text-xs"></i>
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                          Noch keine Mitglieder eingetragen
                        </div>
                      )}
                    </div>
                  </form>
                </div>

                {/* Action Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
                  <button
                    type="submit"
                    form="planned-shift-form"
                    className="flex-1 bg-[var(--color-primary)] hover:brightness-95 text-white rounded-xl shadow-sm py-2.5 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <i className="fa-solid fa-check text-sm"></i>
                    <span>Speichern</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlannedModal(false)}
                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                  >
                    Abbrechen
                  </button>
                </div>
              </motion.div>
            </div>
          </div>,
          document.body
        )}

      {/* Admin Delete Shift Confirmation Modal */}
      {shiftToDelete && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-left">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
              Geplanten Einsatz löschen
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Möchtest du den Einsatz <span className="font-bold text-slate-800">"{shiftToDelete.title_description}"</span> am {new Date(shiftToDelete.date).toLocaleDateString("de-DE")} wirklich löschen?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShiftToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors uppercase"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDeletePlannedShiftSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors shadow-sm uppercase"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Quick Member Assignment Modal */}
      {memberAssignShift && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Mitglieder verwalten
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate max-w-[280px]">
                  {memberAssignShift.title_description} ({new Date(memberAssignShift.date).toLocaleDateString("de-DE")})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemberAssignShift(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <div className="relative mb-3">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={assignUserSearch}
                onChange={(e) => setAssignUserSearch(e.target.value)}
                placeholder="Mitglied suchen..."
                className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[var(--color-primary)] focus:bg-white font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-[200px] max-h-[300px] border border-slate-100 p-2 rounded-xl bg-slate-50/50">
              {(Object.values(users) as User[])
                .filter(u => u.role !== Role.GUEST)
                .filter(u => {
                  if (!assignUserSearch.trim()) return true;
                  const q = assignUserSearch.toLowerCase();
                  return (u.firstName + " " + u.lastName + " " + u.klarname + " " + u.name).toLowerCase().includes(q);
                })
                .sort((a, b) => (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "de"))
                .map((u) => {
                  const isAssigned = memberAssignShift.assigned_user_ids.includes(u.id);
                  const isFull = memberAssignShift.assigned_user_ids.length >= memberAssignShift.required_volunteers;
                  const name = u.klarname || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.name;

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 text-xs"
                    >
                      <span className="font-bold text-slate-800">{name}</span>
                      {isAssigned ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const clubId = currentClubId;
                            await signOutFromPlannedWorkShift(clubId, memberAssignShift, u.id);
                            setMemberAssignShift(prev => prev ? {
                              ...prev,
                              assigned_user_ids: prev.assigned_user_ids.filter(id => id !== u.id)
                            } : null);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 bg-rose-50 text-[10px] font-bold hover:bg-rose-100 uppercase"
                        >
                          Entfernen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const clubId = currentClubId;
                            await signUpForPlannedWorkShift(clubId, memberAssignShift, u.id);
                            setMemberAssignShift(prev => prev ? {
                              ...prev,
                              assigned_user_ids: [...prev.assigned_user_ids, u.id]
                            } : null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)] text-white text-[10px] font-bold hover:brightness-95 uppercase"
                        >
                          Eintragen
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-500 mt-2">
              <span>Plätze: {memberAssignShift.assigned_user_ids.length} / {memberAssignShift.required_volunteers} belegt</span>
              <button
                type="button"
                onClick={() => setMemberAssignShift(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 uppercase text-xs font-bold"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  </div>
);
};

export default Arbeitseinsaetze;
