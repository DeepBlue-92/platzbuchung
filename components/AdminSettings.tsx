import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import {
  User,
  Role,
  Booking,
  RankingState,
  RegularLock,
  RangeLock,
  Tournament,
  ArbeitsEinsatz,
  DynamicLeague,
  ClubFeeSettings,
} from "../types";
import { GuestFeeSettingsEditor } from "./admin/GuestFeeSettingsEditor";
import { getDefaultFeeSettings, validateFeeSettings } from "../utils/guestFeeCalculator";
import {
  ClubSettings,
  DEFAULT_SETTINGS,
  DEFAULT_DYNAMIC_LEAGUES,
  savePublicBookings,
  saveClearBookings,
  listenToArbeitseinsaetze,
  saveArbeitseinsatz,
  isUsernameTakenGlobally,
} from "../services/db";
import { calculateAge } from "../utils/playerHelper";
import { RichTextRenderer, RichTextEditorToolbar } from "./RichText";
import firebaseConfig from "../firebase-applet-config.json";
import { TIME_SLOTS } from "../constants";
import AdminRankings from "./AdminRankings";
import AdminChangelog from "./AdminChangelog";
import { AdminDocumentation } from "./AdminDocumentation";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Trophy } from "lucide-react";
import {
  findCandidateDuplicatesForAdmin,
  addExistingPersonToClub,
  PrivacySafeCandidate,
} from "../services/duplicateDetection";
import { UserAvatar } from "./UserAvatar";
import { AvatarUploader } from "./AvatarUploader";
import AdminOnboardingTab from "./AdminOnboardingTab";
import { ChampionshipAdminTab } from "../features/championship/ChampionshipAdminTab";

interface AdminSettingsProps {
  users: Record<string, User>;
  onUpdateUsers: (users: Record<string, User>) => void;
  bookings: Booking[];
  onUpdateBookings: (bookings: Booking[]) => void;
  currentUser: User;
  settings: ClubSettings;
  onUpdateSettings: (settings: ClubSettings) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  triggerSave?: number;
  rankings?: RankingState | null;
  onUpdateRankings?: (newData: RankingState) => void;
  tournaments: Tournament[];
  onAddTournament: (
    tournament: Omit<Tournament, "id" | "participants">,
  ) => void;
  onUpdateTournament: (id: string, updates: Partial<Tournament>) => void;
  onDeleteTournament: (id: string) => void;
  onActAsUser?: (user: User) => void;
  onSaveBooking?: (booking: Booking) => Promise<void> | void;
  onDeleteBooking?: (id: string) => Promise<void> | void;
  isSuperAdminImpersonating?: boolean;
  onNavigateToChampionship?: () => void;
  initialTab?: string;
}

const TABS = [
  { id: "allgemein", label: "Allgemein", icon: "fa-cubes" },
  { id: "rules", label: "Buchungs-Regeln", icon: "fa-clipboard-check" },
  { id: "sperren", label: "Sperren", icon: "fa-ban" },
  { id: "layout", label: "Layout", icon: "fa-paint-roller" },
  { id: "users", label: "Benutzer", icon: "fa-users" },
  { id: "onboarding", label: "Mitglieder-Onboarding", icon: "fa-user-check" },
  { id: "database", label: "Datenverwaltung", icon: "fa-database" },
  { id: "ranking", label: "Rangliste", icon: "fa-medal" },
  { id: "championship", label: "Meisterschaft", icon: "fa-trophy" },
  { id: "arbeitseinsaetze", label: "Arbeitseinsätze", icon: "fa-briefcase" },
  { id: "updates", label: "Updates", icon: "fa-clock-rotate-left" },
  { id: "handbuch", label: "Handbuch", icon: "fa-book-open" },
];

const AdminSettings: React.FC<AdminSettingsProps> = ({
  users,
  onUpdateUsers,
  bookings,
  onUpdateBookings,
  currentUser,
  settings,
  onUpdateSettings,
  onDirtyChange,
  triggerSave,
  rankings,
  onUpdateRankings,
  tournaments,
  onAddTournament,
  onUpdateTournament,
  onDeleteTournament,
  onActAsUser,
  onSaveBooking,
  onDeleteBooking,
  isSuperAdminImpersonating = false,
  onNavigateToChampionship,
  initialTab,
}) => {
  const currentClubId = settings?.vereinsId || settings?.id || currentUser.vereinsId || "sv-neuhausen";
  const [currentTab, setCurrentTab] = useState<
    | "allgemein"
    | "rules"
    | "tournaments"
    | "sperren"
    | "layout"
    | "users"
    | "onboarding"
    | "database"
    | "ranking"
    | "championship"
    | "arbeitseinsaetze"
    | "updates"
    | "handbuch"
  >((initialTab as any) || "allgemein");

  useEffect(() => {
    if (initialTab) {
      setCurrentTab(initialTab as any);
    }
  }, [initialTab]);
  const [pendingTab, setPendingTab] = useState<typeof currentTab | null>(null);

  const formatPlayerName = (name: string): string => {
    const trimmed = name.trim();
    
    // Try finding the user by their ID / username in the users list
    let foundUser = users[trimmed];
    
    if (!foundUser) {
      // Find user by scanning users values for matching username, klarname, or full name combinations
      foundUser = (Object.values(users) as User[]).find((u) => {
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`.trim().replace(/^, |,$/, "");
        return (
          u.name.toLowerCase() === trimmed.toLowerCase() ||
          (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
          (full && full.toLowerCase() === trimmed.toLowerCase()) ||
          (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
        );
      });
    }

    if (foundUser) {
      if (foundUser.firstName || foundUser.lastName) {
        const first = foundUser.firstName || "";
        const last = foundUser.lastName || "";
        if (first && last) return `${first} ${last}`;
        return first || last || foundUser.name;
      }
      if (foundUser.klarname) {
        if (foundUser.klarname.includes(",")) {
          const parts = foundUser.klarname.split(",").map((p) => p.trim());
          if (parts.length === 2) {
            return `${parts[1]} ${parts[0]}`;
          }
        }
        return foundUser.klarname;
      }
      return foundUser.name;
    }

    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").map((p) => p.trim());
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
      }
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      return parts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }
    return trimmed;
  };

  // --- Events (Tournaments) Form States ---
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(
    null,
  );
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventHideExpired, setEventHideExpired] = useState(true);
  const [eventAllowComment, setEventAllowComment] = useState(false);
  const [eventMaxParticipants, setEventMaxParticipants] = useState<string>("");
  const [eventIsRegistrationBlocked, setEventIsRegistrationBlocked] =
    useState<boolean>(false);

  const resetEventForm = () => {
    setEditingTournamentId(null);
    setEventTitle("");
    setEventDate("");
    setEventStartTime("");
    setEventEndTime("");
    setEventDescription("");
    setEventHideExpired(true);
    setEventAllowComment(false);
    setEventMaxParticipants("");
    setEventIsRegistrationBlocked(false);
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      setMessage({
        text: "Der Name der Veranstaltung ist ein Pflichtfeld.",
        type: "error",
      });
      return;
    }

    const eventData = {
      title: eventTitle.trim(),
      date: eventDate || null,
      startTime: eventStartTime || null,
      endTime: eventEndTime || null,
      description: eventDescription.trim() || null,
      hideExpired: eventHideExpired,
      allowComment: eventAllowComment,
      maxParticipants: eventMaxParticipants
        ? parseInt(eventMaxParticipants, 10)
        : null,
      isRegistrationBlocked: eventIsRegistrationBlocked || null,
    };

    if (editingTournamentId) {
      onUpdateTournament(editingTournamentId, eventData);
      setMessage({
        text: `Veranstaltung "${eventTitle}" erfolgreich aktualisiert.`,
        type: "success",
      });
    } else {
      onAddTournament(eventData);
      setMessage({
        text: `Veranstaltung "${eventTitle}" erfolgreich erstellt.`,
        type: "success",
      });
    }
    resetEventForm();
  };

  const handleStartEditEvent = (t: Tournament) => {
    setEditingTournamentId(t.id);
    setEventTitle(t.title);
    setEventDate(t.date || "");
    setEventStartTime(t.startTime || "");
    setEventEndTime(t.endTime || "");
    setEventDescription(t.description || "");
    setEventHideExpired(t.hideExpired ?? true);
    setEventAllowComment(t.allowComment || false);
    setEventMaxParticipants(t.maxParticipants ? String(t.maxParticipants) : "");
    setEventIsRegistrationBlocked(t.isRegistrationBlocked || false);
  };

  const [csvPreview, setCsvPreview] = useState<User[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const welcomeTextRef = useRef<HTMLTextAreaElement | null>(null);
  const impressumTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<
    "idle" | "parsing" | "ready" | "importing" | "success" | "error"
  >("idle");
  const [importErrorMsg, setImportErrorMsg] = useState<string>("");
  const [importPreview, setImportPreview] = useState<Booking[]>([]);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importProgress, setImportProgress] = useState(0);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const generateDemoBookings = (
    currentUserId: string,
    courtsList: string[] = ["Platz 1", "Platz 2", "Platz 3"],
  ): Booking[] => {
    const getRelativeDateStr = (days: number): string => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    const court1 = courtsList[0] || "Platz 1";
    const court2 = courtsList[1] || "Platz 2";
    const court3 = courtsList[2] || "Platz 3";

    return [
      {
        id: `demo_today_1`,
        date: getRelativeDateStr(0),
        time: "09:00",
        court: court1,
        players: ["Maximilian Kraft", "Sebastian Becker"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: currentUserId,
        comment: "Spitzenspiel der Herren-Mannschaft",
      },
      {
        id: `demo_today_2`,
        date: getRelativeDateStr(0),
        time: "10:00",
        court: court1,
        players: ["Maximilian Kraft", "Sebastian Becker"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: currentUserId,
        comment: "Spitzenspiel der Herren-Mannschaft",
      },
      {
        id: `demo_today_3`,
        date: getRelativeDateStr(0),
        time: "14:00",
        court: court2,
        players: [],
        isLocked: true,
        hasBallMachine: false,
        reason: "Jugend-Clubtraining (Gesperrt)",
        bookedBy: currentUserId,
      },
      {
        id: `demo_today_4`,
        date: getRelativeDateStr(0),
        time: "15:00",
        court: court2,
        players: [],
        isLocked: true,
        hasBallMachine: false,
        reason: "Jugend-Clubtraining (Gesperrt)",
        bookedBy: currentUserId,
      },
      {
        id: `demo_today_5`,
        date: getRelativeDateStr(0),
        time: "17:00",
        court: court1,
        players: ["Anna Wagner", "Sabine Schmidt"],
        isLocked: false,
        hasBallMachine: true,
        bookedBy: "demo_user_anna",
        comment: "Aufschlagtraining mit Ballmaschine",
      },
      {
        id: `demo_today_6`,
        date: getRelativeDateStr(0),
        time: "18:00",
        court: court3,
        players: [
          "Christian Meyer",
          "Thomas Klein",
          "Dieter Fuchs",
          "Jonas Lang",
        ],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: "demo_user_chris",
        comment: "Senioren Doppel-Runde",
      },
      {
        id: `demo_tomorrow_1`,
        date: getRelativeDateStr(1),
        time: "08:00",
        court: court1,
        players: [],
        isLocked: true,
        hasBallMachine: false,
        reason: "Regelmäßige Platzpflege & Bewässerung",
        bookedBy: currentUserId,
      },
      {
        id: `demo_tomorrow_2`,
        date: getRelativeDateStr(1),
        time: "10:00",
        court: court1,
        players: ["Michael Schumacher", "Ralf Schumacher"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: "demo_user_michael",
        comment: "Bruderduell am Vormittag",
      },
      {
        id: `demo_tomorrow_3`,
        date: getRelativeDateStr(1),
        time: "15:00",
        court: court2,
        players: ["Sabine Schmidt", "Elena Becker"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: "demo_user_sabine",
        comment: "Damen-Mannschaft Training",
      },
      {
        id: `demo_tomorrow_4`,
        date: getRelativeDateStr(1),
        time: "16:00",
        court: court1,
        players: [],
        isLocked: true,
        hasBallMachine: false,
        reason: "Punktspiel: Herren 50 (Gesperrt)",
        bookedBy: currentUserId,
      },
      {
        id: `demo_tomorrow_5`,
        date: getRelativeDateStr(1),
        time: "17:00",
        court: court1,
        players: [],
        isLocked: true,
        hasBallMachine: false,
        reason: "Punktspiel: Herren 50 (Gesperrt)",
        bookedBy: currentUserId,
      },
      {
        id: `demo_yesterday_1`,
        date: getRelativeDateStr(-1),
        time: "11:00",
        court: court1,
        players: ["Christian Meyer", "Sabine Schmidt"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: "demo_user_chris",
        comment: "Lockeres Einzel am Feiertag",
      },
      {
        id: `demo_yesterday_2`,
        date: getRelativeDateStr(-1),
        time: "16:00",
        court: court2,
        players: ["Thomas Klein", "Dieter Fuchs"],
        isLocked: false,
        hasBallMachine: true,
        bookedBy: "demo_user_thomas",
        comment: "Taktik- und Ballmaschinentraining",
      },
      {
        id: `demo_days2_1`,
        date: getRelativeDateStr(2),
        time: "18:00",
        court: court1,
        players: ["Lukas Haas", "David Wagner"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: currentUserId,
        comment: "Clubmeisterschaft Qualifikation",
      },
      {
        id: `demo_days2_2`,
        date: getRelativeDateStr(2),
        time: "19:00",
        court: court1,
        players: ["Lukas Haas", "David Wagner"],
        isLocked: false,
        hasBallMachine: false,
        bookedBy: currentUserId,
        comment: "Clubmeisterschaft Qualifikation",
      },
    ];
  };

  const initiateFileImport = (file: File) => {
    setImportFile(file);
    setImportStatus("parsing");
    setImportErrorMsg("");
    setImportPreview([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            throw new Error(
              "Die JSON-Datei muss ein Array von Buchungen enthalten.",
            );
          }
          const validBookings = parsed.filter(
            (b: any) =>
              b && typeof b === "object" && b.date && b.time && b.court,
          );
          if (validBookings.length === 0) {
            throw new Error(
              "Keine gültigen Buchungsobjekte mit Datum, Uhrzeit und Platz gefunden.",
            );
          }
          const normalized: Booking[] = validBookings.map((b: any) => ({
            id: b.id || Math.random().toString(36).substr(2, 9),
            date: String(b.date),
            time: String(b.time),
            court: String(b.court),
            players: Array.isArray(b.players) ? b.players.map(String) : [],
            isLocked: !!b.isLocked,
            hasBallMachine: !!b.hasBallMachine,
            reason: b.reason || "",
            bookedBy: b.bookedBy || "",
            comment: b.comment || "",
          }));
          setImportPreview(normalized);
          setImportStatus("ready");
        } else if (file.name.endsWith(".csv")) {
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.length === 0) {
            throw new Error("Die CSV-Datei ist leer.");
          }
          const firstLine = lines[0];
          const separator = firstLine.includes(";") ? ";" : ",";

          const parseCSVLine = (line: string, sep: string) => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === sep && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const rawHeaders = parseCSVLine(firstLine, separator);
          const headers = rawHeaders.map((h) =>
            h.toLowerCase().replace(/["\s\-]/g, ""),
          );

          const idIdx = headers.findIndex(
            (h) => h.includes("id") || h.includes("buchungs"),
          );
          const dateIdx = headers.findIndex(
            (h) => h.includes("datum") || h === "date",
          );
          const timeIdx = headers.findIndex(
            (h) => h.includes("uhrzeit") || h.includes("time"),
          );
          const courtIdx = headers.findIndex(
            (h) => h.includes("platz") || h === "court",
          );
          const playersIdx = headers.findIndex(
            (h) => h.includes("spieler") || h === "players",
          );
          const isLockedIdx = headers.findIndex(
            (h) => h.includes("gesperrt") || h === "islocked" || h === "locked",
          );
          const reasonIdx = headers.findIndex(
            (h) =>
              h.includes("grund") || h.includes("sperre") || h === "reason",
          );
          const bookedByIdx = headers.findIndex(
            (h) => h.includes("gebucht") || h === "bookedby",
          );
          const ballMachineIdx = headers.findIndex(
            (h) => h.includes("ballmaschine") || h === "hasballmachine",
          );
          const commentIdx = headers.findIndex(
            (h) => h.includes("kommentar") || h === "comment",
          );

          if (dateIdx === -1 || timeIdx === -1 || courtIdx === -1) {
            throw new Error(
              'Erforderliche Spalten wie "Datum", "Uhrzeit" oder "Platz" konnten im CSV-Header nicht identifiziert werden.',
            );
          }

          const parsedBookings: Booking[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i], separator);
            if (cols.length < Math.max(dateIdx, timeIdx, courtIdx) + 1)
              continue;

            const id =
              idIdx !== -1 && cols[idIdx]
                ? cols[idIdx]
                : Math.random().toString(36).substr(2, 9);
            const date = cols[dateIdx];
            const time = cols[timeIdx];
            const court = cols[courtIdx];

            let playersList: string[] = [];
            if (playersIdx !== -1 && cols[playersIdx]) {
              playersList = cols[playersIdx]
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
            }

            const isLockedVal =
              isLockedIdx !== -1 ? cols[isLockedIdx].toLowerCase() : "nein";
            const isLocked =
              isLockedVal === "ja" ||
              isLockedVal === "true" ||
              isLockedVal === "1";

            const reason = reasonIdx !== -1 ? cols[reasonIdx] : "";
            const bookedBy = bookedByIdx !== -1 ? cols[bookedByIdx] : "";

            const ballMachineVal =
              ballMachineIdx !== -1
                ? cols[ballMachineIdx].toLowerCase()
                : "nein";
            const hasBallMachine =
              ballMachineVal === "ja" ||
              ballMachineVal === "true" ||
              ballMachineVal === "1";

            const comment = commentIdx !== -1 ? cols[commentIdx] : "";

            if (date && time && court) {
              parsedBookings.push({
                id,
                date,
                time,
                court,
                players: playersList,
                isLocked,
                hasBallMachine,
                reason,
                bookedBy,
                comment,
              });
            }
          }

          if (parsedBookings.length === 0) {
            throw new Error(
              "Es wurden keine gültigen Buchungszeilen im CSV gefunden.",
            );
          }

          setImportPreview(parsedBookings);
          setImportStatus("ready");
        } else {
          throw new Error(
            "Dateiformat wird nicht unterstützt. Bitte wählen Sie eine *.csv oder *.json Datei.",
          );
        }
      } catch (err: any) {
        setImportErrorMsg(
          err.message || "Fehler beim Lesen oder Parsen der Datei.",
        );
        setImportStatus("error");
      }
    };
    reader.onerror = () => {
      setImportErrorMsg("Fehler beim Laden der Datei.");
      setImportStatus("error");
    };
    reader.readAsText(file);
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    initiateFileImport(file);
  };

  const runFileImport = async () => {
    if (importPreview.length === 0) return;
    setImportStatus("importing");
    setImportProgress(0);

    try {
      const total = importPreview.length;

      // Safe merge only - adding without overwriting/replacing existing records
      for (let i = 0; i < total; i++) {
        if (onSaveBooking) {
          await onSaveBooking(importPreview[i]);
        }
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }

      setImportStatus("success");
      setImportFile(null);
      setMessage({
        text: `${total} Buchungen wurden erfolgreich importiert (hinzugefügt).`,
        type: "success",
      });
    } catch (err: any) {
      setImportErrorMsg(
        err.message || "Fehler beim Speichern der Buchungen in der Datenbank.",
      );
      setImportStatus("error");
    }
  };

  // Deletion States
  const [showDeleteModal, setShowDeleteModal] = useState<
    "bookings" | "users" | null
  >(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteRange, setDeleteRange] = useState({
    start: "",
    end: "",
    court: "all",
  });

  // Export States
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkCopiedClear, setLinkCopiedClear] = useState(false);

  // Settings State Drafts
  const [clubName, setClubName] = useState(settings.clubName || "");
  const [street, setStreet] = useState(settings.street || "");
  const [zip, setZip] = useState(settings.zip || "");
  const [city, setCity] = useState(settings.city || "");
  const [facilityPhotoUrl, setFacilityPhotoUrl] = useState(
    settings.facilityPhotoUrl || ""
  );
  const [customFacilityPhotoUrl, setCustomFacilityPhotoUrl] = useState(
    settings.customFacilityPhotoUrl ||
      (settings.facilityPhotoUrl ? settings.facilityPhotoUrl : "")
  );
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");
  const [headerLogoUrl, setHeaderLogoUrl] = useState(
    settings.headerLogoUrl || settings.logoUrl || "",
  );
  const [faviconUrl, setFaviconUrl] = useState(
    settings.faviconUrl || "/favicon.svg",
  );
  const [customLogoUrl, setCustomLogoUrl] = useState(
    settings.customLogoUrl ||
      (settings.logoUrl !== DEFAULT_SETTINGS.logoUrl ? settings.logoUrl : ""),
  );
  const [customHeaderLogoUrl, setCustomHeaderLogoUrl] = useState(
    settings.customHeaderLogoUrl ||
      (settings.headerLogoUrl &&
      settings.headerLogoUrl !== DEFAULT_SETTINGS.headerLogoUrl
        ? settings.headerLogoUrl
        : ""),
  );
  const [customFaviconUrl, setCustomFaviconUrl] = useState(
    settings.customFaviconUrl ||
      (settings.faviconUrl !== DEFAULT_SETTINGS.faviconUrl
        ? settings.faviconUrl
        : ""),
  );
  const [faviconInputMode, setFaviconInputMode] = useState<"upload" | "url">(
    (settings.customFaviconUrl || "").startsWith("http") ? "url" : "upload",
  );
  const [bannerUrl, setBannerUrl] = useState(settings.bannerUrl);
  const [customBannerUrl, setCustomBannerUrl] = useState(
    settings.customBannerUrl ||
      (settings.bannerUrl !== DEFAULT_SETTINGS.bannerUrl
        ? settings.bannerUrl
        : ""),
  );
  const [loginBannerUrl, setLoginBannerUrl] = useState(
    settings.loginBannerUrl || settings.bannerUrl,
  );
  const [customLoginBannerUrl, setCustomLoginBannerUrl] = useState(
    settings.customLoginBannerUrl ||
      (settings.loginBannerUrl &&
      settings.loginBannerUrl !== DEFAULT_SETTINGS.bannerUrl
        ? settings.loginBannerUrl
        : ""),
  );
  const [bannerPosition, setBannerPosition] = useState(
    settings.bannerPosition || "50% 50%",
  );
  const [showBannerPositionModal, setShowBannerPositionModal] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [accentColor, setAccentColor] = useState(
    settings.accentColor || "#c04d2b",
  );
  const [accentColor2, setAccentColor2] = useState(
    settings.accentColor2 || "#0f172a",
  );
  const [accentColor3, setAccentColor3] = useState(
    settings.accentColor3 || "#ccff00",
  );
  const [isCustomColors, setIsCustomColors] = useState(
    !(
      settings.primaryColor === DEFAULT_SETTINGS.primaryColor &&
      (settings.accentColor || "#c04d2b") === DEFAULT_SETTINGS.accentColor &&
      (settings.accentColor2 || "#0f172a") === DEFAULT_SETTINGS.accentColor2 &&
      (settings.accentColor3 || "#ccff00") === DEFAULT_SETTINGS.accentColor3
    ),
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    settings.websiteUrl ||
      (settings.clubName?.toLowerCase().includes("neuhausen")
        ? "https://www.svneuhausen1947.de/tennis"
        : ""),
  );
  const [hideWebsiteLink, setHideWebsiteLink] = useState(
    settings.hideWebsiteLink ??
      !settings.clubName?.toLowerCase().includes("neuhausen"),
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    settings.welcomeMessage ||
      `Herzlich willkommen im modernisierten Reservierungssystem des ${settings.clubName || "Vereins"}! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.`,
  );
  const [courtsList, setCourtsList] = useState<string[]>(
    settings.courts || ["Platz 1", "Platz 2"],
  );
  const [newCourtName, setNewCourtName] = useState("");
  const [sollStunden, setSollStunden] = useState<number>(
    settings.arbeitseinsaetzeSettings?.sollStunden ?? 10
  );
  const [aeCategories, setAeCategories] = useState<string[]>(
    (settings.arbeitseinsaetzeSettings?.categories ?? ["Platzpflege", "Clubheim-Reinigung", "Bewirtung", "Sonstiges"]).slice().sort((a, b) => a.localeCompare(b, "de"))
  );
  const [newAeCategory, setNewAeCategory] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const [aeVisibility, setAeVisibility] = useState<"full" | "active_only" | "hidden">(
    settings.arbeitseinsaetzeSettings?.visibility ?? "full"
  );
  const [aeInterval, setAeInterval] = useState<"0.25" | "0.5" | "1.0">(
    settings.arbeitseinsaetzeSettings?.interval ?? "0.5"
  );
  const [aeMaxDaysBack, setAeMaxDaysBack] = useState<number>(
    settings.arbeitseinsaetzeSettings?.maxDaysBack ?? 14
  );
  const [commentsRequired, setCommentsRequired] = useState<boolean>(
    settings.arbeitseinsaetzeSettings?.commentsRequired ?? false
  );
  const [showPlannedShifts, setShowPlannedShifts] = useState<boolean>(
    settings.arbeitseinsaetzeSettings?.show_planned_shifts ?? settings.show_planned_shifts ?? true
  );
  const [aeEntries, setAeEntries] = useState<ArbeitsEinsatz[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [remapTargetCategory, setRemapTargetCategory] = useState<string>("");
  const [isRemapping, setIsRemapping] = useState<boolean>(false);

  useEffect(() => {
    const clubId = currentClubId;
    const unsubscribe = listenToArbeitseinsaetze(clubId, (entries) => {
      setAeEntries(entries);
    });
    return () => unsubscribe();
  }, [currentClubId]);

  const isSuperAdmin =
    currentUser?.role === Role.SUPER_ADMIN ||
    (currentUser?.role as any) === "super-admin" ||
    !!isSuperAdminImpersonating;

  const isLeagueEnabled = settings.modules?.league === true;

  const [modules, setModules] = useState({
    events: settings.modules?.events !== false,
    ranking: settings.modules?.ranking !== false,
    guests: settings.modules?.guests !== false,
    arbeitseinsaetze: settings.modules?.arbeitseinsaetze === true,
    league: settings.modules?.league === true,
    championship: settings.modules?.championship === true,
  });
  const [reservationRules, setReservationRules] = useState({
    maxAdvanceDays: 14,
    maxActiveBookings: 3,
    allowGuest: true,
    availableBallMachines: 1,
    guestFeePerHour: 2.5,
    maxBookingsPerDay: 2,
    maxBookingsPerWeek: 0,
    bypassRestrictionsForLeagueGames: false,
    cancellationDeadlineMinutes: 30,
    maxDurationMinutesSingle: 90,
    maxDurationMinutesDouble: 120,
    maxAdvanceWeeks: 2,
    allowPastBookings: true,
    requireCoplayer: false,
    openingHours: {
      "1": { start: "08:00", end: "21:00", closed: false },
      "2": { start: "08:00", end: "21:00", closed: false },
      "3": { start: "08:00", end: "21:00", closed: false },
      "4": { start: "08:00", end: "21:00", closed: false },
      "5": { start: "08:00", end: "21:00", closed: false },
      "6": { start: "08:00", end: "21:00", closed: false },
      "0": { start: "08:00", end: "21:00", closed: false },
    },
    ...(settings.reservationRules || {}),
  });
  const [guestFeeString, setGuestFeeString] = useState(
    (settings.reservationRules?.guestFeePerHour ?? 2.5)
      .toFixed(2)
      .replace(".", ","),
  );
  const [feeSettings, setFeeSettings] = useState<ClubFeeSettings>(() =>
    settings.feeSettings || getDefaultFeeSettings(settings.reservationRules)
  );
  const [isFeeSettingsValid, setIsFeeSettingsValid] = useState(true);
  const [localNews, setLocalNews] = useState(settings.news || "");
  const [impressum, setImpressum] = useState(settings.impressum || "");

  // --- Sperren / Lock Form States ---
  const [lockContext, setLockContext] = useState<"lock" | "event">("lock");
  const [newLockType, setNewLockType] = useState<"regular" | "range">(
    "regular",
  );
  const [newLockTitle, setNewLockTitle] = useState("");
  const [newLockCourts, setNewLockCourts] = useState<string[]>([]);
  const [newLockDay, setNewLockDay] = useState<number>(5); // default to Friday (5)
  const [newLockStartTime, setNewLockStartTime] = useState("15:00");
  const [newLockEndTime, setNewLockEndTime] = useState("21:00");
  const [newLockIsOngoing, setNewLockIsOngoing] = useState(true);
  const [newLockStartDate, setNewLockStartDate] = useState("");
  const [newLockEndDate, setNewLockEndDate] = useState("");
  const [newLockIsOpenOffer, setNewLockIsOpenOffer] = useState(false);
  const [newRangeStartDate, setNewRangeStartDate] = useState("");
  const [newRangeEndDate, setNewRangeEndDate] = useState("");
  const [newRangeStartTime, setNewRangeStartTime] = useState("08:00");
  const [newRangeEndTime, setNewRangeEndTime] = useState("22:00");
  const [editingLockId, setEditingLockId] = useState<string | null>(null);
  const [newLockColor, setNewLockColor] = useState("");
  const [isLockDrawerOpen, setIsLockDrawerOpen] = useState(false);

  // Meisterschaft draft states

  const [editingUser, setEditingUser] = useState<Partial<User>>({
    name: "",
    password: "",
    role: Role.USER,
    gender: "m",
    showContactInfo: true,
  });
  const [showUserForm, setShowUserForm] = useState(false);
  const [inlineEditingUserId, setInlineEditingUserId] = useState<string | null>(
    null,
  );
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSortBy, setUserSortBy] = useState<"alphabetical" | "role">(
    "alphabetical",
  );
  const [userSortOrder, setUserSortOrder] = useState<"asc" | "desc">("asc");
  const [userToDeleteConfirm, setUserToDeleteConfirm] = useState<User | null>(
    null,
  );
  const [revealedPasswords, setRevealedPasswords] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => {
    setUserPage(1);
  }, [userSearchQuery, userSortBy, userSortOrder]);

  // --- Individual Booking Management States ---
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingFilterType, setBookingFilterType] = useState<
    "all" | "future" | "past" | "bookings" | "locks"
  >("all");
  const [bookingFilterCourt, setBookingFilterCourt] = useState<string>("all");
  const [bookingPage, setBookingPage] = useState(1);
  const [editingAdminBooking, setEditingAdminBooking] =
    useState<Booking | null>(null);

  // States for the editing form inside the modal
  const [editBkDate, setEditBkDate] = useState("");
  const [editBkTime, setEditBkTime] = useState("");
  const [editBkCourt, setEditBkCourt] = useState("");
  const [editBkPlayers, setEditBkPlayers] = useState<string[]>([]);
  const [editBkHasBallMachine, setEditBkHasBallMachine] = useState(false);
  const [editBkComment, setEditBkComment] = useState("");
  const [editBkIsLocked, setEditBkIsLocked] = useState(false);
  const [editBkReason, setEditBkReason] = useState("");
  const [editBkNewPlayerQuery, setEditBkNewPlayerQuery] = useState("");
  const [editBkShowSuggestions, setEditBkShowSuggestions] = useState(false);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingSearchQuery, bookingFilterType, bookingFilterCourt]);
  const [uploadingImage, setUploadingImage] = useState<{
    logo: boolean;
    headerLogo: boolean;
    favicon: boolean;
    banner: boolean;
    loginBanner: boolean;
    facilityPhoto: boolean;
  }>({
    logo: false,
    headerLogo: false,
    favicon: false,
    banner: false,
    loginBanner: false,
    facilityPhoto: false,
  });

  // --- Dynamic League Management States ---
  const [adminLeagues, setAdminLeagues] = useState<DynamicLeague[]>(() => {
    return settings.leagueSettings?.leagues && settings.leagueSettings.leagues.length > 0
      ? settings.leagueSettings.leagues
      : DEFAULT_DYNAMIC_LEAGUES;
  });
  const [newLeagueName, setNewLeagueName] = useState("");
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editingLeagueName, setEditingLeagueName] = useState("");

  const handleToggleLeagueActive = (leagueId: string) => {
    const updated = adminLeagues.map((l) =>
      l.id === leagueId ? { ...l, active: !l.active } : l
    );
    setAdminLeagues(updated);
    onUpdateSettings({
      ...settings,
      leagueSettings: {
        ...(settings.leagueSettings || {
          enabled: true,
          minMatchDurationMinutes: 60,
          initialRankingPoints: 100,
          participationPoints: 5,
          maxBonusPoints: 45,
          logisticSteepnessK: 0.05,
          decayPointsPerWeek: 5,
        }),
        leagues: updated,
      },
    });
    setMessage({
      text: "Liga-Status erfolgreich aktualisiert.",
      type: "success",
    });
  };

  const handleAddLeague = () => {
    const trimmed = newLeagueName.trim();
    if (!trimmed) {
      setMessage({ text: "Bitte einen Namen für die neue Liga eingeben.", type: "error" });
      return;
    }
    const newId = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `league_${Date.now()}`;

    if (adminLeagues.some((l) => l.id === newId)) {
      setMessage({ text: "Eine Liga mit diesem Bezeichner existiert bereits.", type: "error" });
      return;
    }

    const newLeague: DynamicLeague = {
      id: newId,
      name: trimmed,
      active: true,
      displayOrder: adminLeagues.length + 1,
    };

    const updated = [...adminLeagues, newLeague];
    setAdminLeagues(updated);
    setNewLeagueName("");
    onUpdateSettings({
      ...settings,
      leagueSettings: {
        ...(settings.leagueSettings || {
          enabled: true,
          minMatchDurationMinutes: 60,
          initialRankingPoints: 100,
          participationPoints: 5,
          maxBonusPoints: 45,
          logisticSteepnessK: 0.05,
          decayPointsPerWeek: 5,
        }),
        leagues: updated,
      },
    });
    setMessage({
      text: `Liga "${trimmed}" erfolgreich angelegt.`,
      type: "success",
    });
  };

  const handleSaveEditLeagueName = (leagueId: string) => {
    const trimmed = editingLeagueName.trim();
    if (!trimmed) return;
    const updated = adminLeagues.map((l) =>
      l.id === leagueId ? { ...l, name: trimmed } : l
    );
    setAdminLeagues(updated);
    setEditingLeagueId(null);
    setEditingLeagueName("");
    onUpdateSettings({
      ...settings,
      leagueSettings: {
        ...(settings.leagueSettings || {
          enabled: true,
          minMatchDurationMinutes: 60,
          initialRankingPoints: 100,
          participationPoints: 5,
          maxBonusPoints: 45,
          logisticSteepnessK: 0.05,
          decayPointsPerWeek: 5,
        }),
        leagues: updated,
      },
    });
    setMessage({
      text: `Liga-Name auf "${trimmed}" geändert.`,
      type: "success",
    });
  };

  const handleDeleteLeague = (leagueId: string) => {
    if (adminLeagues.length <= 1) {
      setMessage({ text: "Es muss mindestens eine Liga im Verein verbleiben.", type: "error" });
      return;
    }
    const updated = adminLeagues.filter((l) => l.id !== leagueId);
    setAdminLeagues(updated);
    onUpdateSettings({
      ...settings,
      leagueSettings: {
        ...(settings.leagueSettings || {
          enabled: true,
          minMatchDurationMinutes: 60,
          initialRankingPoints: 100,
          participationPoints: 5,
          maxBonusPoints: 45,
          logisticSteepnessK: 0.05,
          decayPointsPerWeek: 5,
        }),
        leagues: updated,
      },
    });
    setMessage({
      text: "Liga erfolgreich entfernt.",
      type: "success",
    });
  };

  // Keep state drafts in sync with incoming settings
  useEffect(() => {
    setClubName(settings.clubName || "");
    setStreet(settings.street || "");
    setZip(settings.zip || "");
    setCity(settings.city || "");
    setFacilityPhotoUrl(settings.facilityPhotoUrl || "");
    setCustomFacilityPhotoUrl(
      settings.customFacilityPhotoUrl ||
        (settings.facilityPhotoUrl ? settings.facilityPhotoUrl : "")
    );
    setLogoUrl(settings.logoUrl || "");
    setHeaderLogoUrl(settings.headerLogoUrl || settings.logoUrl || "");
    setFaviconUrl(settings.faviconUrl || "/favicon.svg");
    setCustomLogoUrl(
      settings.customLogoUrl ||
        (settings.logoUrl !== DEFAULT_SETTINGS.logoUrl ? settings.logoUrl : ""),
    );
    setCustomHeaderLogoUrl(
      settings.customHeaderLogoUrl ||
        (settings.headerLogoUrl &&
        settings.headerLogoUrl !== DEFAULT_SETTINGS.headerLogoUrl
          ? settings.headerLogoUrl
          : ""),
    );
    setCustomFaviconUrl(
      settings.customFaviconUrl ||
        (settings.faviconUrl !== DEFAULT_SETTINGS.faviconUrl
          ? settings.faviconUrl
          : ""),
    );
    setBannerUrl(settings.bannerUrl);
    setCustomBannerUrl(
      settings.customBannerUrl ||
        (settings.bannerUrl !== DEFAULT_SETTINGS.bannerUrl
          ? settings.bannerUrl
          : ""),
    );
    setLoginBannerUrl(settings.loginBannerUrl || settings.bannerUrl);
    setCustomLoginBannerUrl(
      settings.customLoginBannerUrl ||
        (settings.loginBannerUrl &&
        settings.loginBannerUrl !== DEFAULT_SETTINGS.bannerUrl
          ? settings.loginBannerUrl
          : ""),
    );
    setBannerPosition(settings.bannerPosition || "50% 50%");
    setPrimaryColor(settings.primaryColor);
    setAccentColor(settings.accentColor || "#c04d2b");
    setAccentColor2(settings.accentColor2 || "#0f172a");
    setAccentColor3(settings.accentColor3 || "#ccff00");
    setAccentColor2(settings.accentColor2 || "#0f172a");
    setAccentColor3(settings.accentColor3 || "#ccff00");
    setWebsiteUrl(
      settings.websiteUrl || "https://www.tennis-club.local",
    );
    setHideWebsiteLink(settings.hideWebsiteLink || false);
    setWelcomeMessage(
      settings.welcomeMessage ||
        "Herzlich willkommen im modernisierten Reservierungssystem! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.",
    );
    setCourtsList(settings.courts || ["Platz 1", "Platz 2"]);
    setSollStunden(settings.arbeitseinsaetzeSettings?.sollStunden ?? 10);
    setAeCategories((settings.arbeitseinsaetzeSettings?.categories ?? ["Platzpflege", "Clubheim-Reinigung", "Bewirtung", "Sonstiges"]).slice().sort((a, b) => a.localeCompare(b, "de")));
    setCommentsRequired(settings.arbeitseinsaetzeSettings?.commentsRequired ?? false);
    setModules({
      events: settings.modules?.events !== false,
      ranking: settings.modules?.ranking !== false,
      guests: settings.modules?.guests !== false,
      arbeitseinsaetze: settings.modules?.arbeitseinsaetze === true,
      league: settings.modules?.league === true,
      championship: settings.modules?.championship === true,
    });
    setReservationRules({
      maxAdvanceDays: 14,
      maxActiveBookings: 3,
      allowGuest: true,
      availableBallMachines: 1,
      guestFeePerHour: 2.5,
      maxBookingsPerDay: 2,
      maxBookingsPerWeek: 0,
      bypassRestrictionsForLeagueGames: false,
      cancellationDeadlineMinutes: 30,
      maxDurationMinutesSingle: 90,
      maxDurationMinutesDouble: 120,
      maxAdvanceWeeks: 2,
      allowPastBookings: true,
      requireCoplayer: false,
      openingHours: {
        "1": { start: "08:00", end: "21:00", closed: false },
        "2": { start: "08:00", end: "21:00", closed: false },
        "3": { start: "08:00", end: "21:00", closed: false },
        "4": { start: "08:00", end: "21:00", closed: false },
        "5": { start: "08:00", end: "21:00", closed: false },
        "6": { start: "08:00", end: "21:00", closed: false },
        "0": { start: "08:00", end: "21:00", closed: false },
      },
      ...(settings.reservationRules || {}),
    });
    const fee = settings.reservationRules?.guestFeePerHour ?? 2.5;
    setGuestFeeString(fee.toFixed(2).replace(".", ","));
    setFeeSettings(settings.feeSettings || getDefaultFeeSettings(settings.reservationRules));
    setLocalNews(settings.news || "");
    setImpressum(settings.impressum || "");
  }, [settings]);

  // Evaluates if a given tab is dirty
  const isTabDirty = useCallback(
    (tab: string): boolean => {
      if (tab === "allgemein") {
        return (
          clubName !== settings.clubName ||
          (street || "") !== (settings.street || "") ||
          (zip || "") !== (settings.zip || "") ||
          (city || "") !== (settings.city || "") ||
          (customFacilityPhotoUrl || "") !== (settings.customFacilityPhotoUrl || settings.facilityPhotoUrl || "") ||
          (modules.events ?? true) !== (settings.modules?.events ?? true) ||
          (modules.ranking ?? true) !== (settings.modules?.ranking ?? true) ||
          (modules.guests ?? true) !== (settings.modules?.guests ?? true) ||
          (modules.championship ?? false) !== (settings.modules?.championship ?? false) ||
          modules.arbeitseinsaetze !== (settings.modules?.arbeitseinsaetze ?? false) ||
          (isSuperAdmin && (modules.league === true) !== (settings.modules?.league === true))
        );
      }
      if (tab === "arbeitseinsaetze") {
        return (
          sollStunden !== (settings.arbeitseinsaetzeSettings?.sollStunden ?? 10) ||
          aeVisibility !== (settings.arbeitseinsaetzeSettings?.visibility ?? "full") ||
          aeInterval !== (settings.arbeitseinsaetzeSettings?.interval ?? "0.5") ||
          aeMaxDaysBack !== (settings.arbeitseinsaetzeSettings?.maxDaysBack ?? 14) ||
          commentsRequired !== (settings.arbeitseinsaetzeSettings?.commentsRequired ?? false) ||
          showPlannedShifts !== (settings.arbeitseinsaetzeSettings?.show_planned_shifts ?? settings.show_planned_shifts ?? true) ||
          aeCategories.join(",") !== (settings.arbeitseinsaetzeSettings?.categories ?? ["Platzpflege", "Clubheim-Reinigung", "Bewirtung", "Sonstiges"]).join(",")
        );
      }
      if (tab === "rules") {
        return (
          (reservationRules.maxAdvanceDays ?? 14) !==
            (settings.reservationRules?.maxAdvanceDays ?? 14) ||
          (reservationRules.maxActiveBookings ?? 3) !==
            (settings.reservationRules?.maxActiveBookings ?? 3) ||
          (reservationRules.allowGuest ?? true) !==
            (settings.reservationRules?.allowGuest ?? true) ||
          (reservationRules.availableBallMachines ?? 1) !==
            (settings.reservationRules?.availableBallMachines ?? 1) ||
          (reservationRules.guestFeePerHour ?? 2.5) !==
            (settings.reservationRules?.guestFeePerHour ?? 2.5) ||
          (reservationRules.maxBookingsPerDay ?? 2) !==
            (settings.reservationRules?.maxBookingsPerDay ?? 2) ||
          (reservationRules.maxBookingsPerWeek ?? 0) !==
            (settings.reservationRules?.maxBookingsPerWeek ?? 0) ||
          (reservationRules.bypassRestrictionsForLeagueGames ?? false) !==
            (settings.reservationRules?.bypassRestrictionsForLeagueGames ?? false) ||
          (reservationRules.guestBillingMode ?? "per_player") !==
            (settings.reservationRules?.guestBillingMode ?? "per_player") ||
          (reservationRules.cancellationDeadlineMinutes ?? 30) !==
            (settings.reservationRules?.cancellationDeadlineMinutes ?? 30) ||
          (reservationRules.maxDurationMinutesSingle ?? 90) !==
            (settings.reservationRules?.maxDurationMinutesSingle ?? 90) ||
          (reservationRules.maxDurationMinutesDouble ?? 120) !==
            (settings.reservationRules?.maxDurationMinutesDouble ?? 120) ||
          (reservationRules.maxAdvanceWeeks ?? 2) !==
            (settings.reservationRules?.maxAdvanceWeeks ?? 2) ||
          (reservationRules.allowPastBookings ?? false) !==
            (settings.reservationRules?.allowPastBookings ?? false) ||
          (reservationRules.requireCoplayer ?? false) !==
            (settings.reservationRules?.requireCoplayer ?? false) ||
          JSON.stringify(reservationRules.openingHours) !==
            JSON.stringify(settings.reservationRules?.openingHours) ||
          JSON.stringify(courtsList) !==
            JSON.stringify(settings.courts || ["Platz 1", "Platz 2"]) ||
          JSON.stringify(feeSettings) !==
            JSON.stringify(settings.feeSettings || getDefaultFeeSettings(settings.reservationRules))
        );
      }
      if (tab === "layout") {
        return (
          (logoUrl || "") !== (settings.logoUrl || "") ||
          (headerLogoUrl || "") !==
            (settings.headerLogoUrl || settings.logoUrl || "") ||
          (faviconUrl || "") !== (settings.faviconUrl || "/favicon.svg") ||
          (bannerUrl || "") !== (settings.bannerUrl || "") ||
          (loginBannerUrl || "") !==
            (settings.loginBannerUrl || settings.bannerUrl || "") ||
          (customLogoUrl || "") !==
            (settings.customLogoUrl ||
              (settings.logoUrl !== DEFAULT_SETTINGS.logoUrl
                ? settings.logoUrl
                : "") ||
              "") ||
          (customHeaderLogoUrl || "") !==
            (settings.customHeaderLogoUrl ||
              (settings.headerLogoUrl &&
              settings.headerLogoUrl !== DEFAULT_SETTINGS.headerLogoUrl
                ? settings.headerLogoUrl
                : "") ||
              "") ||
          (customFaviconUrl || "") !==
            (settings.customFaviconUrl ||
              (settings.faviconUrl !== DEFAULT_SETTINGS.faviconUrl
                ? settings.faviconUrl
                : "") ||
              "") ||
          (customBannerUrl || "") !==
            (settings.customBannerUrl ||
              (settings.bannerUrl !== DEFAULT_SETTINGS.bannerUrl
                ? settings.bannerUrl
                : "") ||
              "") ||
          (customLoginBannerUrl || "") !==
            (settings.customLoginBannerUrl ||
              (settings.loginBannerUrl &&
              settings.loginBannerUrl !== DEFAULT_SETTINGS.bannerUrl
                ? settings.loginBannerUrl
                : "") ||
              "") ||
          (bannerPosition || "50% 50%") !==
            (settings.bannerPosition || "50% 50%") ||
          (primaryColor || "") !== (settings.primaryColor || "") ||
          (accentColor || "") !== (settings.accentColor || "#c04d2b") ||
          (accentColor2 || "") !== (settings.accentColor2 || "#0f172a") ||
          (accentColor3 || "") !== (settings.accentColor3 || "#ccff00") ||
          websiteUrl !==
            (settings.websiteUrl ||
              (settings.clubName?.toLowerCase().includes("neuhausen")
                ? "https://www.svneuhausen1947.de/tennis"
                : "")) ||
          hideWebsiteLink !==
            (settings.hideWebsiteLink ??
              !settings.clubName?.toLowerCase().includes("neuhausen")) ||
          localNews !== (settings.news || "") ||
          impressum !== (settings.impressum || "") ||
          welcomeMessage !==
            (settings.welcomeMessage ||
              `Herzlich willkommen im modernisierten Reservierungssystem des ${settings.clubName || "Vereins"}! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.`)
        );
      }
      return false;
    },
    [
      clubName,
      street,
      zip,
      city,
      customFacilityPhotoUrl,
      facilityPhotoUrl,
      settings,
      welcomeMessage,
      modules,
      reservationRules,
      courtsList,
      logoUrl,
      headerLogoUrl,
      faviconUrl,
      bannerUrl,
      loginBannerUrl,
      customLogoUrl,
      customHeaderLogoUrl,
      customFaviconUrl,
      customBannerUrl,
      customLoginBannerUrl,
      bannerPosition,
      primaryColor,
      accentColor,
      accentColor2,
      accentColor3,
      websiteUrl,
      hideWebsiteLink,
      localNews,
      impressum,
      sollStunden,
      commentsRequired,
      aeVisibility,
      aeInterval,
      aeMaxDaysBack,
      showPlannedShifts,
      aeCategories,
    ],
  );

  // Raise isDirty to parent App.tsx
  useEffect(() => {
    if (onDirtyChange) {
      const isDirty =
        isTabDirty("allgemein") || isTabDirty("rules") || isTabDirty("layout") || isTabDirty("arbeitseinsaetze");
      onDirtyChange(isDirty);
    }
  }, [isTabDirty, onDirtyChange]);

  const handleSaveTab = (tab: string) => {
    if (tab === "allgemein") {
      onUpdateSettings({
        ...settings,
        clubName,
        street,
        zip,
        city,
        facilityPhotoUrl: customFacilityPhotoUrl,
        customFacilityPhotoUrl: customFacilityPhotoUrl,
        modules: {
          ...modules,
          league: isSuperAdmin ? modules.league === true : settings.modules?.league === true,
        },
      });
      setMessage({
        text: "Allgemeine Einstellungen erfolgreich gespeichert.",
        type: "success",
      });
    } else if (tab === "arbeitseinsaetze") {
      onUpdateSettings({
        ...settings,
        show_planned_shifts: showPlannedShifts,
        arbeitseinsaetzeSettings: {
          sollStunden: Number(sollStunden) || 10,
          categories: aeCategories,
          visibility: aeVisibility,
          interval: aeInterval,
          maxDaysBack: aeMaxDaysBack,
          commentsRequired,
          show_planned_shifts: showPlannedShifts,
        }
      });
      setMessage({
        text: "Arbeitseinsätze Einstellungen erfolgreich gespeichert.",
        type: "success",
      });
    } else if (tab === "rules") {
      const currentCourts = settings.courts || ["Platz 1", "Platz 2"];
      const newCourts = courtsList.length > 0 ? courtsList : ["Platz 1"];
      const removedCourts = currentCourts.filter((c) => !newCourts.includes(c));

      if (removedCourts.length > 0) {
        const now = new Date();
        const hasFutureBookings = bookings.some((b) => {
          if (!removedCourts.includes(b.court)) return false;
          // Prüfen ob die Buchung in der Zukunft liegt oder gerade läuft
          const bookingEnd = new Date(b.date + "T" + b.endTime);
          return bookingEnd >= now;
        });

        if (hasFutureBookings) {
          setMessage({
            text: "Speichern fehlgeschlagen: Die entfernten Plätze haben noch offene/zukünftige Buchungen.",
            type: "error",
          });
          return;
        }
      }

      const feeValidation = validateFeeSettings(feeSettings);
      if (!feeValidation.isValid) {
        setMessage({
          text: "Speichern fehlgeschlagen: Bitte überprüfe die unvollständigen Gastgebühr-Regeln.",
          type: "error",
        });
        return;
      }

      const syncedReservationRules = {
        ...reservationRules,
        guestFeePerHour:
          feeSettings.fee_calculation_mode === "SIMPLE" && feeSettings.simple_config
            ? feeSettings.simple_config.amount_cents / 100
            : reservationRules.guestFeePerHour,
        guestBillingMode:
          feeSettings.fee_calculation_mode === "SIMPLE" && feeSettings.simple_config
            ? feeSettings.simple_config.rate_type === "PER_COURT_HOUR"
              ? ("per_court" as const)
              : ("per_player" as const)
            : reservationRules.guestBillingMode,
      };

      onUpdateSettings({
        ...settings,
        reservationRules: syncedReservationRules,
        feeSettings,
        courts: newCourts,
      });
      setMessage({
        text: "Buchungs-Regeln erfolgreich gespeichert.",
        type: "success",
      });
    } else if (tab === "layout") {
      onUpdateSettings({
        ...settings,
        logoUrl,
        headerLogoUrl,
        faviconUrl,
        bannerUrl,
        loginBannerUrl,
        customLogoUrl,
        customHeaderLogoUrl,
        customFaviconUrl,
        customBannerUrl,
        customLoginBannerUrl,
        bannerPosition,
        primaryColor,
        accentColor,
        accentColor2,
        accentColor3,
        websiteUrl,
        hideWebsiteLink,
        news: localNews,
        impressum,
        welcomeMessage,
      });
      setMessage({
        text: "Design-, Impressums- & News-Einstellungen erfolgreich gespeichert.",
        type: "success",
      });
    }
  };

  const handleDiscardTab = (tab: string) => {
    if (tab === "allgemein") {
      setClubName(settings.clubName);
      setStreet(settings.street || "");
      setZip(settings.zip || "");
      setCity(settings.city || "");
      setModules({
        events: settings.modules?.events !== false,
        ranking: settings.modules?.ranking !== false,
        guests: settings.modules?.guests !== false,
        arbeitseinsaetze: settings.modules?.arbeitseinsaetze === true,
        league: settings.modules?.league === true,
        championship: settings.modules?.championship === true,
      });
    } else if (tab === "arbeitseinsaetze") {
      setSollStunden(settings.arbeitseinsaetzeSettings?.sollStunden ?? 10);
      setAeCategories((settings.arbeitseinsaetzeSettings?.categories ?? ["Platzpflege", "Clubheim-Reinigung", "Bewirtung", "Sonstiges"]).slice().sort((a, b) => a.localeCompare(b, "de")));
      setAeVisibility(settings.arbeitseinsaetzeSettings?.visibility ?? "full");
      setAeInterval(settings.arbeitseinsaetzeSettings?.interval ?? "0.5");
      setAeMaxDaysBack(settings.arbeitseinsaetzeSettings?.maxDaysBack ?? 14);
      setCommentsRequired(settings.arbeitseinsaetzeSettings?.commentsRequired ?? false);
      setShowPlannedShifts(settings.arbeitseinsaetzeSettings?.show_planned_shifts ?? settings.show_planned_shifts ?? true);
    } else if (tab === "rules") {
      const activeRules = settings.reservationRules || {
        maxAdvanceDays: 14,
        maxActiveBookings: 3,
        allowGuest: true,
        availableBallMachines: 1,
        guestFeePerHour: 2.5,
        maxBookingsPerDay: 2,
        maxBookingsPerWeek: 0,
        bypassRestrictionsForLeagueGames: false,
        cancellationDeadlineMinutes: 30,
        maxDurationMinutesSingle: 90,
        maxDurationMinutesDouble: 120,
      };
      setReservationRules(activeRules);
      setGuestFeeString(
        (activeRules.guestFeePerHour ?? 2.5).toFixed(2).replace(".", ","),
      );
      setFeeSettings(settings.feeSettings || getDefaultFeeSettings(settings.reservationRules));
      setCourtsList(settings.courts || ["Platz 1", "Platz 2"]);
    } else if (tab === "layout") {
      setLogoUrl(settings.logoUrl);
      setHeaderLogoUrl(settings.headerLogoUrl || settings.logoUrl);
      setFaviconUrl(settings.faviconUrl || "/favicon.svg");
      setBannerUrl(settings.bannerUrl);
      setLoginBannerUrl(settings.loginBannerUrl || settings.bannerUrl);
      setCustomLogoUrl(
        settings.customLogoUrl ||
          (settings.logoUrl !== DEFAULT_SETTINGS.logoUrl
            ? settings.logoUrl
            : ""),
      );
      setCustomHeaderLogoUrl(
        settings.customHeaderLogoUrl ||
          (settings.headerLogoUrl &&
          settings.headerLogoUrl !== DEFAULT_SETTINGS.headerLogoUrl
            ? settings.headerLogoUrl
            : ""),
      );
      setCustomFaviconUrl(
        settings.customFaviconUrl ||
          (settings.faviconUrl !== DEFAULT_SETTINGS.faviconUrl
            ? settings.faviconUrl
            : ""),
      );
      setCustomBannerUrl(
        settings.customBannerUrl ||
          (settings.bannerUrl !== DEFAULT_SETTINGS.bannerUrl
            ? settings.bannerUrl
            : ""),
      );
      setCustomLoginBannerUrl(
        settings.customLoginBannerUrl ||
          (settings.loginBannerUrl &&
          settings.loginBannerUrl !== DEFAULT_SETTINGS.bannerUrl
            ? settings.loginBannerUrl
            : ""),
      );
      setBannerPosition(settings.bannerPosition || "50% 50%");
      setPrimaryColor(settings.primaryColor);
      setAccentColor(settings.accentColor || "#c04d2b");
      setAccentColor2(settings.accentColor2 || "#0f172a");
      setAccentColor3(settings.accentColor3 || "#ccff00");
      setWebsiteUrl(
        settings.websiteUrl ||
          (settings.clubName?.toLowerCase().includes("neuhausen")
            ? "https://www.svneuhausen1947.de/tennis"
            : ""),
      );
      setHideWebsiteLink(
        settings.hideWebsiteLink ??
          !settings.clubName?.toLowerCase().includes("neuhausen"),
      );
      setLocalNews(settings.news || "");
      setImpressum(settings.impressum || "");
      setWelcomeMessage(
        settings.welcomeMessage ||
          `Herzlich willkommen im modernisierten Reservierungssystem des ${settings.clubName || "Vereins"}! Organisiere deine Matches jetzt noch einfacher und behalte alle Events und Ranglisten stets im Blick.`,
      );
    }
  };

  // --- Sperren / Lock Operations ---
  const handleAddLock = () => {
    if (!newLockTitle.trim()) {
      setMessage({
        type: "error",
        text: "Bitte geben Sie einen Namen/Titel für die Sperrung ein.",
      });
      return;
    }
    if (newLockCourts.length === 0) {
      setMessage({
        type: "error",
        text: "Bitte wählen Sie mindestens einen Platz aus.",
      });
      return;
    }

    if (newLockType === "regular") {
      const newReg: RegularLock = {
        id: Math.random().toString(36).substring(2, 11),
        title: newLockTitle,
        courts: [...newLockCourts],
        dayOfWeek: newLockDay,
        startTime: newLockStartTime,
        endTime: newLockEndTime,
        isOngoing: newLockIsOngoing,
        startDate: newLockIsOngoing ? undefined : newLockStartDate,
        endDate: newLockIsOngoing ? undefined : newLockEndDate,
        isEvent: lockContext === "event",
        isOpenOffer: lockContext === "event",
        color: newLockColor.trim() || undefined,
      };

      const updatedRegs = [...(settings.recurringLocks || []), newReg];
      onUpdateSettings({
        ...settings,
        recurringLocks: updatedRegs,
      });
      setMessage({
        type: "success",
        text:
          lockContext === "event"
            ? `Serientermin "${newLockTitle}" erfolgreich hinzugefügt.`
            : `Wöchentliche Sperre "${newLockTitle}" erfolgreich hinzugefügt.`,
      });
    } else {
      if (!newRangeStartDate || !newRangeEndDate) {
        setMessage({
          type: "error",
          text: "Bitte geben Sie ein Start- und Enddatum ein.",
        });
        return;
      }
      if (newRangeStartDate > newRangeEndDate) {
        setMessage({
          type: "error",
          text: "Das Startdatum darf nicht nach dem Enddatum liegen.",
        });
        return;
      }

      const newRange: RangeLock = {
        id: Math.random().toString(36).substring(2, 11),
        title: newLockTitle,
        startDate: newRangeStartDate,
        endDate: newRangeEndDate,
        startTime: newRangeStartTime,
        endTime: newRangeEndTime,
        courts: [...newLockCourts],
        isEvent: lockContext === "event",
        isOpenOffer: lockContext === "event",
      };

      const updatedRanges = [...(settings.rangeLocks || []), newRange];
      onUpdateSettings({
        ...settings,
        rangeLocks: updatedRanges,
      });
      setMessage({
        type: "success",
        text:
          lockContext === "event"
            ? `Termin-Bereich "${newLockTitle}" erfolgreich hinzugefügt.`
            : `Zeitbereichs-Sperre "${newLockTitle}" erfolgreich hinzugefügt.`,
      });
    }

    // Reset fields
    setNewLockTitle("");
    setNewLockColor("");
    setNewLockCourts([]);
    setNewLockIsOngoing(true);
    setNewLockStartDate("");
    setNewLockEndDate("");
    setNewLockIsOpenOffer(false);
    setNewRangeStartDate("");
    setNewRangeEndDate("");
    setNewRangeStartTime("08:00");
    setNewRangeEndTime("22:00");
    setIsLockDrawerOpen(false);
  };

  const handleSaveLockEdit = () => {
    if (!editingLockId) return;
    if (!newLockTitle.trim()) {
      setMessage({
        type: "error",
        text: "Bitte geben Sie einen Namen/Titel für die Sperrung ein.",
      });
      return;
    }
    if (newLockCourts.length === 0) {
      setMessage({
        type: "error",
        text: "Bitte wählen Sie mindestens einen Platz aus.",
      });
      return;
    }

    if (newLockType === "regular") {
      const updatedRegs = (settings.recurringLocks || []).map((l) => {
        if (l.id === editingLockId) {
          return {
            ...l,
            title: newLockTitle,
            courts: [...newLockCourts],
            dayOfWeek: newLockDay,
            startTime: newLockStartTime,
            endTime: newLockEndTime,
            isOngoing: newLockIsOngoing,
            startDate: newLockIsOngoing ? undefined : newLockStartDate,
            endDate: newLockIsOngoing ? undefined : newLockEndDate,
            isOpenOffer: lockContext === "event",
            color: newLockColor.trim() || undefined,
          };
        }
        return l;
      });
      onUpdateSettings({
        ...settings,
        recurringLocks: updatedRegs,
      });
      setMessage({
        type: "success",
        text: `Änderungen an "${newLockTitle}" gespeichert.`,
      });
    } else {
      if (!newRangeStartDate || !newRangeEndDate) {
        setMessage({
          type: "error",
          text: "Bitte geben Sie ein Start- und Enddatum ein.",
        });
        return;
      }
      if (newRangeStartDate > newRangeEndDate) {
        setMessage({
          type: "error",
          text: "Das Startdatum darf nicht nach dem Enddatum liegen.",
        });
        return;
      }

      const updatedRanges = (settings.rangeLocks || []).map((l) => {
        if (l.id === editingLockId) {
          return {
            ...l,
            title: newLockTitle,
            startDate: newRangeStartDate,
            endDate: newRangeEndDate,
             startTime: newRangeStartTime,
            endTime: newRangeEndTime,
            isOpenOffer: lockContext === "event",
            courts: [...newLockCourts],
          };
        }
        return l;
      });
      onUpdateSettings({
        ...settings,
        rangeLocks: updatedRanges,
      });
      setMessage({
        type: "success",
        text: `Änderungen an "${newLockTitle}" gespeichert.`,
      });
    }

    // Reset editing states
    setEditingLockId(null);
    setNewLockTitle("");
    setNewLockColor("");
    setNewLockCourts([]);
    setNewLockIsOngoing(true);
    setNewLockStartDate("");
    setNewLockEndDate("");
    setNewLockIsOpenOffer(false);
    setNewRangeStartDate("");
    setNewRangeEndDate("");
    setNewRangeStartTime("08:00");
    setNewRangeEndTime("22:00");
    setIsLockDrawerOpen(false);
  };

  const handleDeleteRecurringLock = (id: string) => {
    const updated = (settings.recurringLocks || []).filter((l) => l.id !== id);
    onUpdateSettings({
      ...settings,
      recurringLocks: updated,
    });
    setMessage({
      type: "success",
      text: "Regelmäßige Sperre erfolgreich gelöscht.",
    });
  };

  const handleDeleteRangeLock = (id: string) => {
    const updated = (settings.rangeLocks || []).filter((l) => l.id !== id);
    onUpdateSettings({
      ...settings,
      rangeLocks: updated,
    });
    setMessage({
      type: "success",
      text: "Zeitbereichs-Sperre erfolgreich gelöscht.",
    });
  };

  const handleDeleteCalendarLock = async (bookingId: string) => {
    if (onDeleteBooking) {
      await onDeleteBooking(bookingId);
    } else {
      const updated = bookings.filter((b) => b.id !== bookingId);
      onUpdateBookings(updated);
    }
    setMessage({
      type: "success",
      text: "Manuelle Einzelsperre erfolgreich gelöscht.",
    });
  };

  // --- Individual Booking Management Operations ---
  const handleStartEditAdminBooking = (b: Booking) => {
    setEditingAdminBooking(b);
    setEditBkDate(b.date);
    setEditBkTime(b.time);
    setEditBkCourt(b.court);
    setEditBkPlayers([...(b.players || [])]);
    setEditBkHasBallMachine(!!b.hasBallMachine);
    setEditBkComment(b.comment || "");
    setEditBkIsLocked(!!b.isLocked);
    setEditBkReason(b.reason || "");
    setEditBkNewPlayerQuery("");
    setEditBkShowSuggestions(false);
  };

  const handleSaveAdminBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminBooking) return;

    if (!editBkDate || !editBkTime || !editBkCourt) {
      setMessage({
        type: "error",
        text: "Datum, Uhrzeit und Platz sind Pflichtangaben.",
      });
      return;
    }

    const updated: Booking = {
      ...editingAdminBooking,
      date: editBkDate,
      time: editBkTime,
      court: editBkCourt,
      players: editBkIsLocked ? [] : editBkPlayers,
      hasBallMachine: editBkIsLocked ? false : editBkHasBallMachine,
      isLocked: editBkIsLocked,
      comment: editBkIsLocked ? "" : editBkComment,
      reason: editBkIsLocked ? editBkReason : "",
    };

    try {
      if (onSaveBooking) {
        await onSaveBooking(updated);
        setMessage({
          type: "success",
          text: "Termin/Sperrung wurde erfolgreich aktualisiert.",
        });
        setEditingAdminBooking(null);
      } else {
        setMessage({
          type: "error",
          text: "Fehlende Speicherfunktion in den Props.",
        });
      }
    } catch (err: any) {
      console.error("Error saving booking:", err);
      setMessage({ type: "error", text: "Fehler beim Speichern des Termins." });
    }
  };

  const handleDeleteAdminBooking = async (id: string) => {
    if (
      window.confirm(
        "Bist du sicher, dass du diesen Termin oder diese Sperrung unwiderruflich löschen möchtest?",
      )
    ) {
      try {
        if (onDeleteBooking) {
          await onDeleteBooking(id);
          setMessage({
            type: "success",
            text: "Termin wurde erfolgreich gelöscht.",
          });
        } else {
          setMessage({
            type: "error",
            text: "Fehlende Löschfunktion in den Props.",
          });
        }
      } catch (err: any) {
        console.error("Error deleting booking:", err);
        setMessage({ type: "error", text: "Fehler beim Löschen des Termins." });
      }
    }
  };

  const handleAddPlayerToEditList = (playerName: string) => {
    if (!playerName.trim()) return;
    if (editBkPlayers.includes(playerName.trim())) return;
    setEditBkPlayers([...editBkPlayers, playerName.trim()]);
    setEditBkNewPlayerQuery("");
    setEditBkShowSuggestions(false);
  };

  const handleRemovePlayerFromEditList = (index: number) => {
    setEditBkPlayers(editBkPlayers.filter((_, idx) => idx !== index));
  };

  const handleStartEditRecurring = (lock: RegularLock) => {
    setIsLockDrawerOpen(true);
    setEditingLockId(lock.id);
    setNewLockType("regular");
    setNewLockTitle(lock.title);
    setNewLockCourts([...lock.courts]);
    setNewLockDay(lock.dayOfWeek);
    setNewLockStartTime(lock.startTime);
    setNewLockEndTime(lock.endTime);
    setNewLockIsOngoing(lock.isOngoing);
    setNewLockStartDate(lock.startDate || "");
    setNewLockEndDate(lock.endDate || "");
    setNewLockColor(lock.color || "");
  };

  const handleStartEditRange = (lock: RangeLock) => {
    setIsLockDrawerOpen(true);
    setEditingLockId(lock.id);
    setNewLockType("range");
    setLockContext(lock.isEvent ? "event" : "lock");
    setNewLockTitle(lock.title);
    setNewLockCourts([...lock.courts]);
    setNewRangeStartDate(lock.startDate);
    setNewRangeEndDate(lock.endDate);
    setNewRangeStartTime(lock.startTime || "08:00");
    setNewRangeEndTime(lock.endTime || "22:00");
    setNewLockIsOpenOffer(lock.isOpenOffer || false);
  };

  const handleCancelLockEdit = () => {
    setIsLockDrawerOpen(false);
    setEditingLockId(null);
    setNewLockTitle("");
    setNewLockColor("");
    setNewLockCourts([]);
    setNewLockIsOngoing(true);
    setNewLockStartDate("");
    setNewLockEndDate("");
    setNewRangeStartDate("");
    setNewRangeEndDate("");
  };

  const handleTabClick = (tabId: typeof currentTab) => {
    if (currentTab === tabId) return;
    if (isTabDirty(currentTab)) {
      setPendingTab(tabId);
    } else {
      setCurrentTab(tabId);
    }
  };

  useEffect(() => {
    if (triggerSave && triggerSave > 0) {
      handleSaveTab(currentTab);
    }
  }, [triggerSave, currentTab]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "headerLogo" | "favicon" | "banner" | "loginBanner" | "facilityPhoto",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage((prev) => ({ ...prev, [type]: true }));
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH =
            type === "banner" || type === "loginBanner" || type === "facilityPhoto" ? 1200 : 300;
          const MAX_HEIGHT =
            type === "banner" || type === "loginBanner" || type === "facilityPhoto" ? 1200 : 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/webp", 0.7);

          if (type === "logo") {
            setLogoUrl(dataUrl);
            setCustomLogoUrl(dataUrl);
          }
          if (type === "headerLogo") {
            setHeaderLogoUrl(dataUrl);
            setCustomHeaderLogoUrl(dataUrl);
          }
          if (type === "favicon") {
            setFaviconUrl(dataUrl);
            setCustomFaviconUrl(dataUrl);
          }
          if (type === "banner") {
            setBannerUrl(dataUrl);
            setCustomBannerUrl(dataUrl);
          }
          if (type === "loginBanner") {
            setLoginBannerUrl(dataUrl);
            setCustomLoginBannerUrl(dataUrl);
          }
          if (type === "facilityPhoto") {
            setFacilityPhotoUrl(dataUrl);
            setCustomFacilityPhotoUrl(dataUrl);
          }

          setMessage({
            text: "Bild erfolgreich geladen und im Cache bereitgestellt. Bitte speichere den Bereich, um die Änderungen dauerhaft zu übernehmen.",
            type: "success",
          });
          setUploadingImage((prev) => ({ ...prev, [type]: false }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: "Fehler beim Upload.", type: "error" });
      setUploadingImage((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleAddCourt = () => {
    if (newCourtName.trim() && !courtsList.includes(newCourtName.trim())) {
      setCourtsList([...courtsList, newCourtName.trim()]);
      setNewCourtName("");
    }
  };

  const handleRemoveCourt = (index: number) => {
    const courtName = courtsList[index];
    const hasBookings = bookings.some((b) => b.court === courtName);

    if (hasBookings) {
      setMessage({
        text: `Der Platz "${courtName}" kann nicht gelöscht werden, da noch Buchungen darauf existieren. Bitte lösche diese zuerst.`,
        type: "error",
      });
      return;
    }

    const updated = [...courtsList];
    updated.splice(index, 1);
    setCourtsList(updated);
  };

  const handleMoveCourt = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === courtsList.length - 1) return;

    const updated = [...courtsList];
    const temp = updated[index];
    if (direction === "up") {
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else {
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    }
    setCourtsList(updated);
  };

  const [duplicateCandidatesModal, setDuplicateCandidatesModal] = useState<{
    candidates: PrivacySafeCandidate[];
  } | null>(null);

  const [liveDuplicateCandidates, setLiveDuplicateCandidates] = useState<PrivacySafeCandidate[]>([]);
  const [isCheckingLiveDuplicates, setIsCheckingLiveDuplicates] = useState(false);

  useEffect(() => {
    if (!showUserForm || inlineEditingUserId) {
      setLiveDuplicateCandidates([]);
      return;
    }

    const fname = (editingUser.firstName || "").trim();
    const lname = (editingUser.lastName || "").trim();
    const em = (editingUser.email || "").trim();

    if (!fname && !lname && !em) {
      setLiveDuplicateCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingLiveDuplicates(true);
      try {
        const candidates = await findCandidateDuplicatesForAdmin(
          {
            firstName: fname,
            lastName: lname,
            email: em,
            phone: editingUser.phone,
          },
          currentClubId
        );
        setLiveDuplicateCandidates(candidates);
      } catch (err) {
        console.error("Error checking live duplicates:", err);
      } finally {
        setIsCheckingLiveDuplicates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [editingUser.firstName, editingUser.lastName, editingUser.email, showUserForm, inlineEditingUserId, currentClubId]);

  const handleSaveUser = async (bypassDuplicateCheck = false) => {
    if (!editingUser.firstName?.trim() || !editingUser.lastName?.trim()) {
      setMessage({
        text: "Vorname und Nachname sind Pflichtfelder.",
        type: "error",
      });
      return;
    }

    if (!editingUser.name?.trim() || !editingUser.password) {
      setMessage({
        text: "Benutzername und Passwort sind erforderlich.",
        type: "error",
      });
      return;
    }

    // Require email unless is_placeholder_email checkbox is ticked
    const isPlaceholderChecked = !!editingUser.is_placeholder_email;
    if (!isPlaceholderChecked && (!editingUser.email || !editingUser.email.trim())) {
      setMessage({
        text: "E-Mail-Adresse ist ein Pflichtfeld. Bitte eine gültige E-Mail angeben oder 'Keine E-Mail-Adresse vorhanden' aktivieren.",
        type: "error",
      });
      return;
    }

    // Check for potential duplicate person if creating a new member and not bypassing
    if (!inlineEditingUserId && !bypassDuplicateCheck) {
      const candidates = await findCandidateDuplicatesForAdmin(
        {
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          email: editingUser.email,
          phone: editingUser.phone,
        },
        currentClubId
      );
      if (candidates.length > 0) {
        setDuplicateCandidatesModal({ candidates });
        return;
      }
    }

    let key = editingUser.name.toLowerCase().replace(/\s/g, "");
    let finalUsername = editingUser.name.trim();

    const targetKey = inlineEditingUserId
      ? inlineEditingUserId.toLowerCase().replace(/\s/g, "")
      : null;
    const existingUser = targetKey ? users[targetKey] : null;

    if (existingUser) {
      if (existingUser.hauptAdmin) {
        if (editingUser.role !== Role.ADMIN) {
          setMessage({
            text: "Der Haupt-Admin dieses Vereins darf nicht herabgestuft werden!",
            type: "error",
          });
          return;
        }
      }
      key = targetKey!;
      finalUsername = existingUser.name;
    } else {
      let suffix = 2;
      const baseKey = key;
      const baseName = finalUsername;
      while (users[key] || (await isUsernameTakenGlobally(finalUsername))) {
        key = `${baseKey}${suffix}`;
        finalUsername = `${baseName}${suffix}`;
        suffix++;
      }
    }

    const updatedUsers = { ...users };
    updatedUsers[key] = {
      id: existingUser?.id || "",
      name: finalUsername,
      klarname:
        editingUser.klarname ||
        `${editingUser.firstName?.trim() || ""} ${editingUser.lastName?.trim() || ""}`.trim() ||
        finalUsername,
      password: editingUser.password,
      mustChangePassword: !!editingUser.mustChangePassword,
      role: editingUser.role || Role.MITGLIED,
      firstName: editingUser.firstName?.trim(),
      lastName: editingUser.lastName?.trim(),
      email: editingUser.is_placeholder_email ? "" : (editingUser.email?.trim() || ""),
      is_placeholder_email: !!editingUser.is_placeholder_email,
      phone: editingUser.phone?.trim() || "",
      showContactInfo: editingUser.showContactInfo !== false,
      onboarding_pending: editingUser.onboarding_pending !== undefined ? !!editingUser.onboarding_pending : (existingUser ? !!existingUser.onboarding_pending : (settings.club_onboarding_settings?.auto_enable_for_new_users !== false)),
      isSuspended: !!editingUser.isSuspended,
      hauptAdmin: (() => {
        if (existingUser) return existingUser.hauptAdmin ?? false;
        if (editingUser.role === Role.ADMIN) {
          const hasAnyAdmin = (Object.values(users) as User[]).some(
            (u) => u.role === Role.ADMIN || u.hauptAdmin,
          );
          return !hasAnyAdmin;
        }
        return false;
      })(),
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      gender: editingUser.gender || "m",
      birthDate: editingUser.birthDate ? editingUser.birthDate.trim() : null,
      avatarUrl: editingUser.avatarUrl !== undefined ? (editingUser.avatarUrl || null) : (existingUser?.avatarUrl || null),
      avatarIcon: editingUser.avatarIcon !== undefined ? (editingUser.avatarIcon || "initials") : (existingUser?.avatarIcon || "initials"),
    };

    try {
      await onUpdateUsers(updatedUsers);

      setMessage({
        text: `Benutzer "${finalUsername}" erfolgreich gespeichert.`,
        type: "success",
      });

      setEditingUser({
        name: "",
        password: "",
        role: Role.USER,
        gender: "m",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        birthDate: "",
        showContactInfo: true,
        isSuspended: false,
      });
      setShowUserForm(false);
      setInlineEditingUserId(null);
    } catch (err: any) {
      setMessage({
        text: `Fehler beim Speichern: ${err.message}`,
        type: "error",
      });
    }
  };

  const executeDeleteUser = (userToDelete: User) => {
    const userKey = userToDelete.name.toLowerCase().replace(/\s/g, "");
    const updatedUsers = { ...users };
    delete updatedUsers[userKey];
    onUpdateUsers(updatedUsers);
    setMessage({
      text: `Benutzer "${userToDelete.klarname || userToDelete.name}" gelöscht.`,
      type: "success",
    });
  };

  const handleDeleteUser = (username: string) => {
    const userKey = username.toLowerCase().replace(/\s/g, "");
    const userToDelete = users[userKey];

    if (!userToDelete) {
      setMessage({
        text: "Benutzer konnte nicht gefunden werden.",
        type: "error",
      });
      return;
    }

    if (userToDelete.hauptAdmin && !isSuperAdminImpersonating) {
      setMessage({
        text: "Der Haupt-Admin dieses Vereins kann nicht gelöscht werden!",
        type: "error",
      });
      return;
    }

    if (userToDelete.id === currentUser.id && !isSuperAdminImpersonating) {
      setMessage({
        text: "Du kannst dich nicht selbst löschen!",
        type: "error",
      });
      return;
    }

    setUserToDeleteConfirm(userToDelete);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportErrors([]);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
      const newUsers: User[] = [];
      const errorsList: string[] = [];
      const existingNames = new Set(
        (Object.values(users) as User[]).map((u: any) => u.name.toLowerCase().trim()),
      );
      const parsedNames = new Set<string>();

      lines.forEach((line, index) => {
        const parts = line.includes(";") ? line.split(";") : line.split(",");
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const password = parts[1].trim();

          const nameLower = name.toLowerCase();
          if (
            nameLower === "benutzername" ||
            nameLower === "username" ||
            nameLower === "name"
          ) {
            // Is a header, skip silently
            return;
          }

          const role =
            parts[2]?.trim().toLowerCase() === "admin" ? Role.ADMIN : Role.USER;
          const firstName = parts[3]?.trim() || "";
          const lastName = parts[4]?.trim() || "";
          const email = parts[5]?.trim() || "";
          const phone = parts[6]?.trim() || "";
          const genderRaw = parts[7]?.trim().toLowerCase();
          const gender = genderRaw === "w" ? "w" : "m";
          const birthDate = parts[8]?.trim() || undefined;
          const id = nameLower.replace(/[^a-z0-9]/g, "");

          if (name && password) {
            if (existingNames.has(nameLower)) {
              errorsList.push(
                `Zeile ${index + 1}: Benutzername "${name}" existiert bereits.`,
              );
              return;
            }
            if (parsedNames.has(nameLower)) {
              errorsList.push(
                `Zeile ${index + 1}: Benutzername "${name}" ist doppelt in Datei.`,
              );
              return;
            }

            parsedNames.add(nameLower);
            newUsers.push({
              id,
              name,
              password,
              role,
              firstName,
              lastName,
              email,
              phone,
              gender,
              birthDate,
            });
          }
        }
      });

      setCsvPreview(newUsers);
      setImportErrors(errorsList);
      if (newUsers.length === 0 && errorsList.length === 0) {
        setMessage({
          text: "Keine gültigen Daten gefunden. Format: Benutzername;Passwort;Rolle;Vorname;Nachname;Email;Telefon;Geschlecht;Geburtsdatum",
          type: "error",
        });
      }
    };
    reader.readAsText(file);
  };

  const importUsers = () => {
    const updatedUsers = { ...users };
    csvPreview.forEach((u) => {
      updatedUsers[u.id] = u;
    });
    onUpdateUsers(updatedUsers);
    setMessage({
      text: `${csvPreview.length} Mitglieder erfolgreich importiert!`,
      type: "success",
    });
    setCsvPreview([]);
    setImportErrors([]);
    setSelectedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const executeBulkDelete = () => {
    if (deleteConfirmText !== "LÖSCHEN") return;

    if (showDeleteModal === "bookings") {
      const toDelete = bookings.filter((b) => {
        let inRange = true;
        if (deleteRange.start && b.date < deleteRange.start) inRange = false;
        if (deleteRange.end && b.date > deleteRange.end) inRange = false;
        if (
          deleteRange.court &&
          deleteRange.court !== "all" &&
          b.court !== deleteRange.court
        )
          inRange = false;
        return inRange;
      });

      if (onDeleteBooking) {
        const runDeletion = async () => {
          for (let i = 0; i < toDelete.length; i++) {
            await onDeleteBooking(toDelete[i].id);
          }
        };

        runDeletion()
          .then(() => {
            setMessage({
              text: `${toDelete.length} Reservierungen im gewählten Zeitraum bzw. Platz wurden gelöscht.`,
              type: "success",
            });
          })
          .catch((err) => {
            console.error("Error bulk deleting bookings:", err);
            setMessage({
              text: "Fehler beim Löschen der Reservierungen in der Cloud.",
              type: "error",
            });
          });
      } else {
        const filtered = bookings.filter((b) => !toDelete.includes(b));
        onUpdateBookings(filtered);
        setMessage({
          text: "Reservierungen im gewählten Zeitraum bzw. auf dem gewählten Platz wurden gelöscht.",
          type: "success",
        });
      }
    } else if (showDeleteModal === "users") {
      const updatedUsers: Record<string, User> = {};
      
      // Find the correct username key of the current logged-in admin
      const currentAdminKey = Object.keys(users).find(
        (key) => users[key].id === currentUser.id
      ) || currentUser.id;

      updatedUsers[currentAdminKey] = {
        ...currentUser,
      };

      onUpdateUsers(updatedUsers);
      setMessage({
        text: "Alle Spieler außer dem aktuell eingeloggten Administrator wurden erfolgreich gelöscht.",
        type: "success",
      });
    }

    setShowDeleteModal(null);
    setDeleteConfirmText("");
  };

  const downloadTemplate = () => {
    const content =
      "Benutzername;Passwort;Rolle;Vorname;Nachname;Email;Telefon;Geschlecht;Geburtsdatum\nmaxmustermann;tennis123;user;Max;Mustermann;max@beispiel.de;+49 170 1234567;m;1990-05-15\nerikamusterfrau;geheim;admin;Erika;Musterfrau;erika@beispiel.de;+49 171 7654321;w;1985-11-20\nfelixjunior;jugend123;user;Felix;Junior;felix@beispiel.de;;m;2012-08-10";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Mitglieder_Vorlage.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMembersCSV = () => {
    const header = "Benutzername;Passwort;Rolle;Vorname;Nachname;Email;Telefon;Geschlecht;Geburtsdatum\n";
    const rows = sortedAndFilteredUsers
      .map((u) => {
        const roleText = u.role || Role.USER;
        const firstName = u.firstName || "";
        const lastName = u.lastName || "";
        const email = u.email || "";
        const phone = u.phone || "";
        const password = u.password || "";
        const name = u.name || "";
        const geschlecht = u.gender || "m";
        const geburtsdatum = u.birthDate || "";
        return `${name};${password};${roleText};${firstName};${lastName};${email};${phone};${geschlecht};${geburtsdatum}`;
      })
      .join("\n");

    const content = header + rows;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Mitglieder_Export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBookingsCSV = () => {
    let filtered = [...bookings];
    if (exportStartDate) {
      filtered = filtered.filter((b) => b.date >= exportStartDate);
    }
    if (exportEndDate) {
      filtered = filtered.filter((b) => b.date <= exportEndDate);
    }

    filtered.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.time.localeCompare(b.time);
    });

    const header =
      "Buchungs-ID;Datum;Uhrzeit;Platz;Spieler;Ist Gesperrt;Grund/Sperre;Gebucht von;Mit Ballmaschine;Kommentar\n";
    const rows = filtered
      .map((b) => {
        const id = b.id || "";
        const date = b.date || "";
        const time = b.time || "";
        const court = b.court || "";
        const players = Array.isArray(b.players) ? b.players.join(", ") : "";
        const isLocked = b.isLocked ? "Ja" : "Nein";
        const reason = b.reason ? b.reason.replace(/;/g, ",") : "";
        const bookedBy = b.bookedBy || "";
        const hasBallMachine = b.hasBallMachine ? "Ja" : "Nein";
        const comment = b.comment ? b.comment.replace(/;/g, ",") : "";

        return `"${id}";"${date}";"${time}";"${court}";"${players}";"${isLocked}";"${reason}";"${bookedBy}";"${hasBallMachine}";"${comment}"`;
      })
      .join("\n");

    const content = header + rows;
    const blob = new Blob(["\ufeff" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const fromText = exportStartDate || "Anfang";
    const toText = exportEndDate || "Ende";
    const filename =
      exportStartDate || exportEndDate
        ? `Buchungsexport_${fromText}_bis_${toText}.csv`
        : "Buchungsexport_Saemtlicher_Buchungen.csv";

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage({
      text: `${filtered.length} Buchungen wurden erfolgreich als CSV exportiert.`,
      type: "success",
    });
  };

  const exportBookingsJSON = () => {
    let filtered = [...bookings];
    if (exportStartDate) {
      filtered = filtered.filter((b) => b.date >= exportStartDate);
    }
    if (exportEndDate) {
      filtered = filtered.filter((b) => b.date <= exportEndDate);
    }

    filtered.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.time.localeCompare(b.time);
    });

    const content = JSON.stringify(filtered, null, 2);
    const blob = new Blob([content], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const fromText = exportStartDate || "Anfang";
    const toText = exportEndDate || "Ende";
    const filename =
      exportStartDate || exportEndDate
        ? `Buchungsexport_${fromText}_bis_${toText}.json`
        : "Buchungsexport_Saemtlicher_Buchungen.json";

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage({
      text: `${filtered.length} Buchungen wurden erfolgreich als JSON exportiert.`,
      type: "success",
    });
  };

  const getSevenDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getAnonymizedBookingsList = () => {
    const sevenDaysAgo = getSevenDaysAgoStr();
    const filtered = bookings.filter((b) => b.date >= sevenDaysAgo);
    return filtered.map((b) => {
      const anonymizedPlayers = Array.isArray(b.players)
        ? b.players.map((_, idx) => `Spieler ${idx + 1}`)
        : [];
      return {
        id: b.id,
        date: b.date,
        time: b.time,
        court: b.court,
        isLocked: b.isLocked || false,
        hasBallMachine: b.hasBallMachine || false,
        players: anonymizedPlayers,
        reason: b.isLocked ? b.reason || "Sperre" : "Privatspiel",
      };
    });
  };

  const getClearBookingsList = () => {
    const sevenDaysAgo = getSevenDaysAgoStr();
    const filtered = bookings.filter((b) => b.date >= sevenDaysAgo);
    return filtered.map((b) => {
      return {
        id: b.id,
        date: b.date,
        time: b.time,
        court: b.court,
        isLocked: b.isLocked || false,
        hasBallMachine: b.hasBallMachine || false,
        players: Array.isArray(b.players) ? b.players : [],
        reason: b.isLocked ? b.reason || "Sperre" : "Privatspiel",
      };
    });
  };

  const publishAnonymizedFeed = async () => {
    try {
      const list = getAnonymizedBookingsList();
      await savePublicBookings(currentClubId, list);
      setMessage({
        text: "Der anonymisierte, öffentliche Feed wurde erfolgreich in die Cloud-Datenbank geladen!",
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: `Fehler beim Veröffentlichen: ${err.message || err}`,
        type: "error",
      });
    }
  };

  const publishClearFeed = async () => {
    try {
      const list = getClearBookingsList();
      await saveClearBookings(currentClubId, list);
      setMessage({
        text: "Der öffentliche Feed mit Klarnamen wurde erfolgreich in die Cloud-Datenbank geladen!",
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: `Fehler beim Veröffentlichen: ${err.message || err}`,
        type: "error",
      });
    }
  };

  const downloadAnonymizedBookingsJSON = () => {
    const list = getAnonymizedBookingsList();
    const content = JSON.stringify(list, null, 2);
    const blob = new Blob([content], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Buchungen_Anonymisiert_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage({
      text: `${list.length} anonymisierte Buchungen wurden erfolgreich als JSON-Datei heruntergeladen.`,
      type: "success",
    });
  };

  const downloadClearBookingsJSON = () => {
    const list = getClearBookingsList();
    const content = JSON.stringify(list, null, 2);
    const blob = new Blob([content], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Buchungen_Klarnamen_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage({
      text: `${list.length} Buchungen mit Klarnamen wurden erfolgreich als JSON-Datei heruntergeladen.`,
      type: "success",
    });
  };

  const getPublicFeedURL = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const clubId = currentClubId;
    return `${origin}/api/public/feeds/bookings?type=anonymisiert&clubId=${clubId}`;
  };

  const getClearFeedURL = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const clubId = currentClubId;
    return `${origin}/api/public/feeds/bookings?type=klarnamen&clubId=${clubId}`;
  };

  const editPlayerSuggestions = useMemo(() => {
    if (!editBkNewPlayerQuery.trim()) return [];
    const q = editBkNewPlayerQuery.toLowerCase();

    return ((Object.values(users) as User[]) as User[])
      .filter((u) => {
        const fullName =
          u.lastName || u.firstName
            ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
            : u.name;
        return (
          u.name.toLowerCase().includes(q) ||
          (u.firstName || "").toLowerCase().includes(q) ||
          (u.lastName || "").toLowerCase().includes(q) ||
          fullName.toLowerCase().includes(q)
        );
      })
      .slice(0, 5);
  }, [users, editBkNewPlayerQuery]);

  const filteredAppointments = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    return bookings
      .filter((b) => {
        // 1. Search Query filter (matches Date, Court, Player name, Comment, or Reason)
        if (bookingSearchQuery.trim()) {
          const q = bookingSearchQuery.toLowerCase();
          const matchesDate = b.date.includes(q);
          const matchesCourt = b.court.toLowerCase().includes(q);
          const matchesReason = (b.reason || "").toLowerCase().includes(q);
          const matchesComment = (b.comment || "").toLowerCase().includes(q);
          const matchesPlayers =
            b.players && b.players.some((p) => p.toLowerCase().includes(q));

          if (
            !matchesDate &&
            !matchesCourt &&
            !matchesReason &&
            !matchesComment &&
            !matchesPlayers
          ) {
            return false;
          }
        }

        // 2. Type filter
        if (bookingFilterType === "future") {
          if (b.date < todayStr) return false;
        } else if (bookingFilterType === "past") {
          if (b.date >= todayStr) return false;
        } else if (bookingFilterType === "bookings") {
          if (b.isLocked) return false;
        } else if (bookingFilterType === "locks") {
          if (!b.isLocked) return false;
        }

        // 3. Court filter
        if (bookingFilterCourt !== "all") {
          if (b.court !== bookingFilterCourt) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by Date desc, then Time desc (newest/most recent first)
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      });
  }, [bookings, bookingSearchQuery, bookingFilterType, bookingFilterCourt]);

  const bkItemsPerPage = 10;
  const bkTotalPages = useMemo(() => {
    return Math.ceil(filteredAppointments.length / bkItemsPerPage) || 1;
  }, [filteredAppointments]);

  const paginatedAppointments = useMemo(() => {
    const page = Math.min(bookingPage, bkTotalPages);
    const startIndex = (page - 1) * bkItemsPerPage;
    return filteredAppointments.slice(startIndex, startIndex + bkItemsPerPage);
  }, [filteredAppointments, bookingPage, bkTotalPages]);

  const sortedAndFilteredUsers = useMemo(() => {
    const rolePriority: Record<string, number> = {
      "super-admin": 1,
      admin: 2,
      user: 3,
      mitglied: 4,
    };

    return ((Object.values(users) as User[]) as User[])
      .sort((a, b) => {
        let result = 0;
        if (userSortBy === "role") {
          const roleA = a.role || "";
          const roleB = b.role || "";
          const prioA = rolePriority[roleA] || 99;
          const prioB = rolePriority[roleB] || 99;
          if (prioA !== prioB) {
            result = prioA - prioB;
          }
        }

        if (result === 0) {
          // Sort alphabetically by LastName, FirstName (nach nachname vorname)
          const lnA = (a.lastName || "")
            .trim()
            .localeCompare((b.lastName || "").trim(), "de", {
              sensitivity: "base",
            });
          if (lnA !== 0) {
            result = lnA;
          } else {
            const fnA = (a.firstName || "")
              .trim()
              .localeCompare((b.firstName || "").trim(), "de", {
                sensitivity: "base",
              });
            if (fnA !== 0) {
              result = fnA;
            } else {
              result = a.name
                .trim()
                .localeCompare(b.name.trim(), "de", { sensitivity: "base" });
            }
          }
        }

        return userSortOrder === "asc" ? result : -result;
      })
      .filter(
        (u) =>
          u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          (u.firstName || "")
            .toLowerCase()
            .includes(userSearchQuery.toLowerCase()) ||
          (u.lastName || "")
            .toLowerCase()
            .includes(userSearchQuery.toLowerCase()) ||
          u.role.toLowerCase().includes(userSearchQuery.toLowerCase()),
      );
  }, [users, userSearchQuery, userSortBy, userSortOrder]);

  const itemsPerPage = 30;
  const totalUserPages = Math.ceil(
    sortedAndFilteredUsers.length / itemsPerPage,
  );
  const paginatedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * itemsPerPage;
    return sortedAndFilteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredUsers, userPage]);

  return (
    <div className="w-full space-y-4 lg:space-y-6 lg:animate-in lg:fade-in lg:duration-500 pb-6 lg:pb-8">
      <div className="transition-all duration-300 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200/80">
        {/* Upper Dashboard header area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-0 md:gap-4 mb-3 pb-3 md:mb-6 md:pb-6 border-b border-slate-100">
          <div className="hidden md:flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)]">
              <Settings className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                Systemeinstellungen
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Module, Regeln, Layout &amp; Datenpflege
              </p>
            </div>
          </div>
        </div>

        {/* Categories Tab Navigation */}
        <div className="flex flex-wrap p-1 gap-1 bg-slate-100/80 rounded-xl mb-8 relative">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            const isDirty = isTabDirty(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as any)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg font-black text-[10px] uppercase tracking-wider relative transition-all duration-300 ease-in-out whitespace-nowrap shrink-0 z-10 ${
                  isActive
                    ? "text-[var(--color-primary)] font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm z-[-1]"
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                  />
                )}
                <i
                  className={`fa-solid ${tab.icon} text-sm ${isActive ? "text-[var(--color-primary)]" : "text-slate-500"}`}
                ></i>
                <span>{tab.label}</span>
                {isDirty && (
                  <span
                    className="w-2 h-2 rounded-full bg-orange-600 animate-pulse border border-white absolute -top-1 -right-1 z-20"
                    title="Ungespeicherte Änderungen"
                  ></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Notifications/Messages */}
        {message && (
          <div
            className={`mb-8 p-4 rounded-2xl border-2 font-black text-xs flex items-center gap-3 animate-in slide-in-from-top-2 ${
              message.type === "success"
                ? "bg-green-50 border-green-100 text-green-700"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            <i
              className={`fa-solid ${message.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}
            ></i>
            <span className="flex-1">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="hover:opacity-75 transition-opacity"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        )}

        {/* Active Sub-Panel Area */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16, ease: "easeInOut" }}
              className="w-full"
            >
              {/* TAB 1: ALLGEMEIN */}
              {currentTab === "allgemein" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    {/* Modules Segment */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-toggle-on"></i> Module
                        Aktivieren
                      </h3>
                      <div className="space-y-4">
                        {/* 1. Veranstaltungen */}
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Veranstaltungen
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Veranstaltungsmodul für alle sichtbar.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!modules.events}
                            onChange={(e) =>
                              setModules({
                                ...modules,
                                events: e.target.checked,
                              })
                            }
                            className="w-5 h-5 accent-[var(--color-primary)] shrink-0 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>

                        {/* 2. Rangliste */}
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Rangliste
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Zeigt Reihenfolge der Spieler in Form eines
                              Dreiecks
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!modules.ranking}
                            onChange={(e) =>
                              setModules({
                                ...modules,
                                ranking: e.target.checked,
                              })
                            }
                            className="w-5 h-5 accent-[var(--color-primary)] shrink-0 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>

                        {/* 3. Meisterschaft */}
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Meisterschaft
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Aktiviert die offizielle Vereinsmeisterschaft (Vorlagen, Gruppenphasen & K.-o.-Endrunden)
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!modules.championship}
                            onChange={(e) =>
                              setModules({
                                ...modules,
                                championship: e.target.checked,
                              })
                            }
                            className="w-5 h-5 accent-[var(--color-primary)] shrink-0 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>

                        {/* 4. Gastspiele */}
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Gastspiele
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Ermöglicht Abrechnung und Erfassung von
                              Gastspielen
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={modules.guests !== false}
                            onChange={(e) =>
                              setModules({
                                ...modules,
                                guests: e.target.checked,
                              })
                            }
                            className="w-5 h-5 accent-[var(--color-primary)] shrink-0 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>

                        {/* 5. Arbeitseinsätze */}
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Arbeitseinsätze
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Ermöglicht Erfassung und Übersicht von geleisteten Arbeitsstunden
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!modules.arbeitseinsaetze}
                            onChange={(e) =>
                              setModules({
                                ...modules,
                                arbeitseinsaetze: e.target.checked,
                              })
                            }
                            className="w-5 h-5 accent-[var(--color-primary)] shrink-0 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Club Context / Basic Configurations */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-circle-info"></i> Allgemeine
                        Einstellungen
                      </h3>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Vereinsname
                          </label>
                          <input 
                            type="text"
                            value={clubName || ""}
                            onChange={(e) => setClubName(e.target.value)}
                            placeholder="z. B. SV Neuhausen"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        {/* Standort der Platzanlage (Strukturierte Adressfelder) */}
                        <div className="pt-2 border-t border-slate-200/60">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <i className="fa-solid fa-location-dot text-[var(--color-primary)]"></i>
                            Standort der Platzanlage
                          </label>
                          <div className="space-y-3">
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Straße & Hausnummer
                              </span>
                              <input 
                                type="text"
                                value={street || ""}
                                onChange={(e) => setStreet(e.target.value)}
                                placeholder="z. B. Sportweg 4"
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-1">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  PLZ
                                </span>
                                <input 
                                  type="text"
                                  value={zip || ""}
                                  onChange={(e) => setZip(e.target.value)}
                                  placeholder="z. B. 84030"
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                              <div className="col-span-2">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Ort
                                </span>
                                <input 
                                  type="text"
                                  value={city || ""}
                                  onChange={(e) => setCity(e.target.value)}
                                  placeholder="z. B. Ergolding"
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                            
                            <div className="pt-2">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Anlagen-Foto (Für Liga & Buchung)
                              </span>
                              <div className="flex flex-col gap-2">
                                {(customFacilityPhotoUrl || headerLogoUrl) ? (
                                  <div className="relative h-20 w-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                                    <img 
                                      src={customFacilityPhotoUrl || headerLogoUrl} 
                                      alt="Anlagen Vorschau" 
                                      className="w-full h-full object-cover"
                                    />
                                    {customFacilityPhotoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFacilityPhotoUrl("");
                                          setCustomFacilityPhotoUrl("");
                                        }}
                                        className="absolute top-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                                        title="Anlagen-Foto entfernen"
                                      >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                                <div className="flex flex-col gap-2 relative">
                                  <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-slate-200 active:scale-95">
                                    <i className="fa-solid fa-upload"></i> Foto hochladen
                                    <input className="hidden placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(e as any, "facilityPhoto");
                                      }}
                                    />
                                  </label>
                                  <p className="text-[10px] text-slate-400 leading-tight">
                                    Optional. Wenn leer, wird das Logo/Banner als Fallback für die Austragungsort-Karte genutzt.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Category Actions */}
                  <div className="border-t border-slate-100 pt-6 flex justify-end">
                    <button
                      type="button"
                      disabled={!isTabDirty("allgemein")}
                      onClick={() => handleSaveTab("allgemein")}
                      className={`font-black uppercase text-xs tracking-wider px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                        isTabDirty("allgemein")
                          ? "bg-[var(--color-primary)] text-white hover:bg-black shadow-lg hover:shadow-xl"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: ARBEITSEINSÄTZE */}
              {currentTab === "arbeitseinsaetze" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                    {/* Einstellungen */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-briefcase"></i> Modul-Parameter
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Sichtbarkeit der Mitgliederliste (für normale Mitglieder)
                          </label>
                          <div className="relative">
                            <select
                              value={aeVisibility}
                              onChange={(e) => setAeVisibility(e.target.value as any)}
                              className="w-full h-10 px-4 pr-10 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all appearance-none outline-none font-sans font-medium"
                            >
                              <option value="full">Vollständig sichtbar</option>
                              <option value="active_only">Nur aktive Helfer sichtbar (0-Stunden ausblenden)</option>
                              <option value="hidden">Komplett ausgeblendet</option>
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Buchungs-Intervall (Taktung)
                          </label>
                          <div className="relative">
                            <select
                              value={aeInterval}
                              onChange={(e) => setAeInterval(e.target.value as any)}
                              className="w-full h-10 px-4 pr-10 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all appearance-none outline-none font-sans font-medium"
                            >
                              <option value="0.25">0,25-Stunden-Schritte</option>
                              <option value="0.5">0,5-Stunden-Schritte</option>
                              <option value="1.0">1-Stunde-Schritte</option>
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 pt-2">
                          <input
                            type="checkbox"
                            id="aeCommentsRequired"
                            checked={commentsRequired}
                            onChange={(e) => setCommentsRequired(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <div className="flex flex-col">
                            <label htmlFor="aeCommentsRequired" className="text-xs font-bold text-slate-700 uppercase tracking-wide cursor-pointer select-none">
                              Beschreibung / Kommentar ist Pflichtfeld
                            </label>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Mitglieder müssen eine Beschreibung eingeben, wenn sie einen Arbeitseinsatz eintragen.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 pt-2">
                          <input
                            type="checkbox"
                            id="aeShowPlannedShifts"
                            checked={showPlannedShifts}
                            onChange={(e) => setShowPlannedShifts(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <div className="flex flex-col">
                            <label htmlFor="aeShowPlannedShifts" className="text-xs font-bold text-slate-700 uppercase tracking-wide cursor-pointer select-none">
                              Geplante Arbeitseinsätze anzeigen
                            </label>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Aktiviert den Bereich "GEPLANTE ARBEITSEINSÄTZE" (Putzplan & Arbeitsdienste) in der Arbeitseinsatz-Übersicht für Mitglieder.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Kategorien CRUD */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-tags"></i> Kategorien verwalten
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Neue Kategorie..."
                            value={newAeCategory}
                            onChange={(e) => setNewAeCategory(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newAeCategory.trim()) {
                                e.preventDefault();
                                if (!aeCategories.includes(newAeCategory.trim())) {
                                  setAeCategories([...aeCategories, newAeCategory.trim()].sort((a, b) => a.localeCompare(b, "de")));
                                }
                                setNewAeCategory("");
                              }
                            }}
                            className="flex-1 h-10 px-4 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all outline-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newAeCategory.trim() && !aeCategories.includes(newAeCategory.trim())) {
                                setAeCategories([...aeCategories, newAeCategory.trim()].sort((a, b) => a.localeCompare(b, "de")));
                                setNewAeCategory("");
                              }
                            }}
                            disabled={!newAeCategory.trim()}
                            className="h-10 px-6 bg-[var(--color-primary)] hover:bg-black text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            Hinzufügen
                          </button>
                        </div>

                        <div className="flex flex-col gap-2 mt-4 bg-white border border-slate-200 rounded-2xl p-2 max-h-[300px] overflow-y-auto">
                          {aeCategories.length === 0 ? (
                            <div className="p-4 text-center text-sm font-medium text-slate-400">
                              Keine Kategorien vorhanden.
                            </div>
                          ) : (
                            aeCategories.map((cat, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl group transition-colors min-h-[44px]">
                                {editingCategoryIndex === idx ? (
                                  <div className="flex items-center gap-2 w-full">
                                    <input
                                      type="text"
                                      value={editingCategoryValue}
                                      onChange={(e) => setEditingCategoryValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const val = editingCategoryValue.trim();
                                          if (val && (!aeCategories.includes(val) || val === cat)) {
                                            const updated = [...aeCategories];
                                            updated[idx] = val;
                                            setAeCategories(updated.sort((a, b) => a.localeCompare(b, "de")));
                                            setEditingCategoryIndex(null);
                                          }
                                        } else if (e.key === "Escape") {
                                          setEditingCategoryIndex(null);
                                        }
                                      }}
                                      className="flex-1 h-8 px-2 bg-white text-xs text-slate-700 rounded-lg border border-slate-300 focus:outline-none focus:border-[var(--color-primary)] outline-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = editingCategoryValue.trim();
                                        if (val && (!aeCategories.includes(val) || val === cat)) {
                                          const updated = [...aeCategories];
                                          updated[idx] = val;
                                          setAeCategories(updated.sort((a, b) => a.localeCompare(b, "de")));
                                          setEditingCategoryIndex(null);
                                        }
                                      }}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                      title="Speichern"
                                    >
                                      <i className="fa-solid fa-check text-[10px]"></i>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingCategoryIndex(null)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
                                      title="Abbrechen"
                                    >
                                      <i className="fa-solid fa-xmark text-[10px]"></i>
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-sm font-bold text-slate-700">{cat}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCategoryIndex(idx);
                                          setEditingCategoryValue(cat);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-100 transition-colors"
                                        title="Umbenennen"
                                      >
                                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matchingEntries = aeEntries.filter(
                                            (e) => e.category.trim().toLowerCase() === cat.trim().toLowerCase()
                                          );
                                          if (matchingEntries.length > 0) {
                                            setCategoryToDelete(cat);
                                            const otherCategories = aeCategories.filter(c => c !== cat);
                                            setRemapTargetCategory(otherCategories[0] || "");
                                          } else {
                                            if (window.confirm(`Möchtest du die Kategorie "${cat}" wirklich löschen?`)) {
                                              setAeCategories(aeCategories.filter(c => c !== cat));
                                              if (editingCategoryIndex === idx) {
                                                setEditingCategoryIndex(null);
                                              }
                                            }
                                          }
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can text-xs"></i>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {categoryToDelete && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
                      <div className="border-none outline-none bg-white rounded-2xl -200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-3">
                          <i className="fa-solid fa-triangle-exclamation text-amber-500 text-lg"></i>
                          Kategorie kann nicht gelöscht werden
                        </h3>
                        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                          Die Kategorie <span className="font-bold text-slate-800">"{categoryToDelete}"</span> kann nicht direkt gelöscht werden, da ihr aktuell <span className="font-bold text-slate-800">{aeEntries.filter(e => e.category.trim().toLowerCase() === categoryToDelete.trim().toLowerCase()).length} Arbeitseinsatz-Einträge</span> zugeordnet sind.
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Einträge umgruppieren in andere Kategorie:
                          </label>
                          {aeCategories.filter(c => c !== categoryToDelete).length > 0 ? (
                            <div className="relative">
                              <select
                                value={remapTargetCategory}
                                onChange={(e) => setRemapTargetCategory(e.target.value)}
                                className="w-full h-10 px-4 pr-10 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all appearance-none outline-none cursor-pointer font-sans font-medium"
                              >
                                {aeCategories
                                  .filter(c => c !== categoryToDelete)
                                  .map(c => (
                                    <option key={c} value={c}>
                                      {c.toUpperCase()}
                                    </option>
                                  ))
                                }
                              </select>
                              <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                            </div>
                          ) : (
                            <p className="text-xs text-rose-600 font-medium">
                              Keine andere Kategorie vorhanden. Bitte erstelle zuerst eine neue Kategorie, in die die Einträge umgruppiert werden können!
                            </p>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setCategoryToDelete(null)}
                            className="flex-1 h-10 border border-slate-200 rounded-xl font-bold uppercase tracking-wider text-[11px] text-slate-500 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
                          >
                            Abbrechen
                          </button>
                          
                          {aeCategories.filter(c => c !== categoryToDelete).length > 0 && (
                            <button
                              type="button"
                              disabled={isRemapping}
                              onClick={async () => {
                                try {
                                  setIsRemapping(true);
                                  const entriesToUpdate = aeEntries.filter(
                                    e => e.category.trim().toLowerCase() === categoryToDelete.trim().toLowerCase()
                                  );
                                  
                                  const clubId = currentClubId;
                                  
                                  for (const entry of entriesToUpdate) {
                                    await saveArbeitseinsatz(clubId, {
                                      ...entry,
                                      category: remapTargetCategory
                                    });
                                  }

                                  const newCats = aeCategories.filter(c => c !== categoryToDelete);
                                  setAeCategories(newCats);
                                  
                                  setCategoryToDelete(null);
                                  alert(`Erfolgreich ${entriesToUpdate.length} Einträge nach "${remapTargetCategory}" verschoben. Vergiss nicht, die Einstellungen unten zu SPEICHERN!`);
                                } catch (err) {
                                  console.error("Fehler beim Umgruppieren:", err);
                                  alert("Es ist ein Fehler beim Umgruppieren aufgetreten.");
                                } finally {
                                  setIsRemapping(false);
                                }
                              }}
                              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isRemapping ? (
                                <>
                                  <i className="fa-solid fa-spinner animate-spin"></i>
                                  Verarbeite...
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-arrows-spin"></i>
                                  Umgruppieren
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save/Discard Actions */}
                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
                    {isTabDirty("arbeitseinsaetze") && (
                      <button
                        type="button"
                        onClick={() => handleDiscardTab("arbeitseinsaetze")}
                        className="text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors px-4 py-2"
                      >
                        Abbrechen
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!isTabDirty("arbeitseinsaetze")}
                      onClick={() => handleSaveTab("arbeitseinsaetze")}
                      className={`font-black uppercase text-xs tracking-wider px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                        isTabDirty("arbeitseinsaetze")
                          ? "bg-[var(--color-primary)] text-white hover:bg-black shadow-lg hover:shadow-xl"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: BUCHUNGS-REGELN */}
              {currentTab === "rules" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    {/* Rule Limits Segment */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-shield-halved"></i>{" "}
                        Reservierungsschranken
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Max. aktive Buchungen pro Spieler (0 = keine Beschränkung)
                          </label>
                          <input 
                            type="number"
                            min="0"
                            value={reservationRules.maxActiveBookings}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setReservationRules({
                                ...reservationRules,
                                maxActiveBookings: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Max. Buchungen pro Spieler je Tag (0 = keine Beschränkung)
                          </label>
                          <input 
                            type="number"
                            min="0"
                            value={reservationRules.maxBookingsPerDay ?? 2}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setReservationRules({
                                ...reservationRules,
                                maxBookingsPerDay: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Max. Buchungen pro Spieler je Woche (0 = keine Beschränkung)
                          </label>
                          <input 
                            type="number"
                            min="0"
                            value={reservationRules.maxBookingsPerWeek ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setReservationRules({
                                ...reservationRules,
                                maxBookingsPerWeek: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        
                        <div className="pt-2">
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center mt-0.5">
                              <input
                                type="checkbox"
                                checked={reservationRules.bypassRestrictionsForLeagueGames ?? false}
                                onChange={(e) =>
                                  setReservationRules({
                                    ...reservationRules,
                                    bypassRestrictionsForLeagueGames: e.target.checked,
                                  })
                                }
                                className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-lg checked:bg-[var(--color-primary)] checked:border-[var(--color-primary)] transition-all cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"></i>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800 group-hover:text-[var(--color-primary)] transition-colors">
                                Ligaspiele von Standard-Buchungsbeschränkungen ausnehmen
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Umgeht Tages- und Wochenlimits für Hobbyliga-Matches (nur auf Verfügbarkeit geprüft).
                              </span>
                            </div>
                          </label>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Stornierungsfrist (Minuten vor Spielbeginn) (0 = sofort stornierbar / keine Frist)
                          </label>
                          <input 
                            type="number"
                            min="0"
                            value={
                              reservationRules.cancellationDeadlineMinutes ?? 30
                            }
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setReservationRules({
                                ...reservationRules,
                                cancellationDeadlineMinutes: isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Verfügbare Ballmaschinen
                          </label>
                          <input 
                            type="number"
                            min="0"
                            max="10"
                            value={reservationRules.availableBallMachines ?? 1}
                            onChange={(e) =>
                              setReservationRules({
                                ...reservationRules,
                                availableBallMachines:
                                  parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        {modules.guests !== false && (
                          <div className="pt-2 border-t border-slate-100">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Gastspiel-Tarifordnung
                            </label>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
                              <div>
                                <span className="font-bold text-slate-800">
                                  {feeSettings.fee_calculation_mode === "ADVANCED"
                                    ? "Erweiterter Regel-Builder"
                                    : "Einfaches Standardmodell"}
                                </span>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {feeSettings.fee_calculation_mode === "ADVANCED"
                                    ? `${(feeSettings.advanced_config?.rules || []).length} aktive Regeln konfiguriert`
                                    : `${((feeSettings.simple_config?.amount_cents ?? 250) / 100).toFixed(2).replace(".", ",")} € (${feeSettings.simple_config?.rate_type === "PER_COURT_HOUR" ? "pro Platzstunde" : "pro Gast/Std."})`}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-150">
                                Siehe unten
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Vorausbuchungsfrist für Spieler (Wochen) (0 = keine Beschränkung)
                          </label>
                          <input 
                            type="number"
                            min="0"
                            max="52"
                            value={reservationRules.maxAdvanceWeeks ?? 2}
                            onChange={(e) => {
                              const val = isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value);
                              setReservationRules({
                                ...reservationRules,
                                maxAdvanceWeeks: val,
                                maxAdvanceDays: val * 7,
                              });
                            }}
                            className="w-full max-w-[200px] px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors mt-2">
                          <div>
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Buchungen in Vergangenheit erlauben
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Ermöglicht das Eintragen von Buchungen
                              rückwirkend.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={reservationRules.allowPastBookings ?? true}
                            onChange={(e) =>
                              setReservationRules({
                                ...reservationRules,
                                allowPastBookings: e.target.checked,
                              })
                            }
                            className="h-4 w-4 text-[var(--color-primary)] border-slate-300 rounded focus:ring-[var(--color-primary)] flex-shrink-0 accent-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-[var(--color-primary)] transition-colors mt-2">
                          <div>
                            <div className="font-black text-xs text-slate-800 uppercase">
                              Mitspieler erforderlich (nur für Spieler)
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 max-w-[450px] leading-relaxed">
                              Wenn aktiviert, muss ein regulärer Spieler bei der
                              Buchung mindestens einen Mitspieler, einen Gast
                              oder die Ballmaschine auswählen. Admins sind von
                              dieser Regel ausgenommen.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={reservationRules.requireCoplayer ?? false}
                            onChange={(e) =>
                              setReservationRules({
                                ...reservationRules,
                                requireCoplayer: e.target.checked,
                              })
                            }
                            className="h-4 w-4 text-[var(--color-primary)] border-slate-300 rounded focus:ring-[var(--color-primary)] flex-shrink-0 accent-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </label>
                        <div className="pt-4 border-t border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                            Öffnungszeiten je Wochentag
                          </label>
                          <div className="space-y-3 bg-white p-4 rounded-2xl border-none shadow-md">
                            {[
                              { value: 1, label: "Montag" },
                              { value: 2, label: "Dienstag" },
                              { value: 3, label: "Mittwoch" },
                              { value: 4, label: "Donnerstag" },
                              { value: 5, label: "Freitag" },
                              { value: 6, label: "Samstag" },
                              { value: 0, label: "Sonntag" },
                            ].map((day) => {
                              const key = String(day.value);
                              const dayConfig = reservationRules.openingHours?.[
                                key
                              ] || {
                                start: "08:00",
                                end: "21:00",
                                closed: false,
                              };
                              return (
                                <div
                                  key={key}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
                                >
                                  <span className="font-black text-xs text-slate-700 min-w-[100px]">
                                    {day.label}
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    <label className="flex items-center gap-1.5 cursor-pointer mr-2">
                                      <input
                                        type="checkbox"
                                        checked={dayConfig.closed ?? false}
                                        onChange={(e) => {
                                          const updatedHours = {
                                            ...(reservationRules.openingHours ||
                                              {}),
                                          };
                                          updatedHours[key] = {
                                            ...dayConfig,
                                            closed: e.target.checked,
                                          };
                                          setReservationRules({
                                            ...reservationRules,
                                            openingHours: updatedHours,
                                          });
                                        }}
                                        className="h-4 w-4 text-[var(--color-primary)] border-slate-300 rounded focus:ring-[var(--color-primary)] flex-shrink-0 accent-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      />
                                      <span className="text-[10px] font-black uppercase text-slate-500">
                                        Geschlossen
                                      </span>
                                    </label>
                                    {!dayConfig.closed && (
                                      <div className="flex items-center gap-1">
                                        <select 
                                          value={dayConfig.start || "08:00"}
                                          onChange={(e) => {
                                            const updatedHours = {
                                              ...(reservationRules.openingHours ||
                                                {}),
                                            };
                                            updatedHours[key] = {
                                              ...dayConfig,
                                              start: e.target.value,
                                            };
                                            setReservationRules({
                                              ...reservationRules,
                                              openingHours: updatedHours,
                                            });
                                          }}
                                          className="px-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 py-2 font-sans font-medium"
                                        >
                                          {TIME_SLOTS.slice(0, -1).map((t) => (
                                            <option key={t} value={t}>
                                              {t} Uhr
                                            </option>
                                          ))}
                                        </select>
                                        <span className="text-slate-400 text-xs">
                                          bis
                                        </span>
                                        <select 
                                          value={dayConfig.end || "21:00"}
                                          onChange={(e) => {
                                            const updatedHours = {
                                              ...(reservationRules.openingHours ||
                                                {}),
                                            };
                                            updatedHours[key] = {
                                              ...dayConfig,
                                              end: e.target.value,
                                            };
                                            setReservationRules({
                                              ...reservationRules,
                                              openingHours: updatedHours,
                                            });
                                          }}
                                          className="px-1.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 py-2 font-sans font-medium"
                                        >
                                          {TIME_SLOTS.slice(1).map((t) => (
                                            <option key={t} value={t}>
                                              {t} Uhr
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Courts/Tennisplätze segments */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-list-ol"></i> Plätze Verwalten
                      </h3>
                      <div className="bg-white p-6 rounded-2xl border-none space-y-4 shadow-md">
                        <div className="flex flex-col gap-2">
                          {courtsList.map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 bg-slate-50 py-2 px-4 rounded-xl border border-slate-200 shadow-sm"
                            >
                              <input 
                                type="text"
                                value={c}
                                onChange={(e) => {
                                  const updated = [...courtsList];
                                  updated[i] = e.target.value;
                                  setCourtsList(updated);
                                }}
                                className="text-xs text-[var(--color-primary)] flex-1 bg-transparent border-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 rounded px-2 transition-all py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <div className="flex bg-white rounded border border-slate-200 overflow-hidden shadow-sm shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMoveCourt(i, "up")}
                                  disabled={i === 0}
                                  className="px-2 py-1.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <i className="fa-solid fa-chevron-up text-[10px]"></i>
                                </button>
                                <div className="w-[1px] bg-slate-200"></div>
                                <button
                                  type="button"
                                  onClick={() => handleMoveCourt(i, "down")}
                                  disabled={i === courtsList.length - 1}
                                  className="px-2 py-1.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCourt(i)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <i className="fa-solid fa-times"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 isolate pt-2">
                          <input 
                            type="text"
                            value={newCourtName}
                            onChange={(e) => setNewCourtName(e.target.value)}
                            placeholder="Z.B. Platz 3 Oder Halle..."
                            className="flex-1 px-3 border-2 border-slate-200 rounded-xl text-xs focus:border-[var(--color-primary)] outline-none bg-slate-50 focus:bg-white transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={handleAddCourt}
                            className="bg-[var(--color-primary)] text-white hover:bg-black px-6 rounded-xl uppercase transition-all py-2.5 text-sm font-medium"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {modules.guests !== false && (
                    <div className="pt-2">
                      <GuestFeeSettingsEditor
                        feeSettings={feeSettings}
                        onChange={(newFeeSettings) => {
                          setFeeSettings(newFeeSettings);
                          if (newFeeSettings.fee_calculation_mode === "SIMPLE" && newFeeSettings.simple_config) {
                            const euro = newFeeSettings.simple_config.amount_cents / 100;
                            const bMode =
                              newFeeSettings.simple_config.rate_type === "PER_COURT_HOUR"
                                ? ("per_court" as const)
                                : ("per_player" as const);
                            setReservationRules((prev) => ({
                              ...prev,
                              guestFeePerHour: euro,
                              guestBillingMode: bMode,
                            }));
                            setGuestFeeString(euro.toFixed(2).replace(".", ","));
                          }
                        }}
                        onValidationChange={setIsFeeSettingsValid}
                      />
                    </div>
                  )}

                  {/* Tab Category Actions */}
                  <div className="border-t border-slate-100 pt-6 flex justify-end">
                    <button
                      type="button"
                      disabled={!isTabDirty("rules") || !isFeeSettingsValid}
                      onClick={() => handleSaveTab("rules")}
                      className={`font-black uppercase text-xs tracking-wider px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                        isTabDirty("rules") && isFeeSettingsValid
                          ? "bg-[var(--color-primary)] text-white hover:bg-black shadow-lg hover:shadow-xl"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: SPERREN */}
              {currentTab === "sperren" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200/80 gap-4 shadow-sm">
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-[var(--color-primary)]">
                        <i className="fa-solid fa-ban"></i> Platz-Sperren
                        verwalten
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Definieren Sie hier Turniere, wöchentliche
                        Trainingszeiten (Freitagsdoppel etc.) oder Wintersperren
                        (Winterpause ganztätig).
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLockContext("lock");
                          setIsLockDrawerOpen(true);
                        }}
                        className="bg-slate-500 text-white hover:bg-slate-600 px-4 sm:px-6 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-plus"></i>{" "}
                        <span className="hidden sm:inline">Neue</span> Sperre
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLockContext("event");
                          setIsLockDrawerOpen(true);
                        }}
                        className="bg-[var(--color-primary)] text-white hover:bg-black px-4 sm:px-6 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-plus"></i>{" "}
                        <span className="hidden sm:inline">Neuer</span>{" "}
                        Serientermin
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 lg:gap-5 w-full">
                    {/* LISTING COLUMN */}
                    <div className="space-y-6 w-full">
                      {/* Category 1: Sperren & Öffnungszeiten */}
                      <div className="bg-white p-6 rounded-2xl border-none shadow-md space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <i className="fa-solid fa-ban"></i> Sperren &
                          Öffnungszeiten
                        </h4>

                        {(
                          [
                            ...(settings.recurringLocks || [])
                              .filter((l) => !l.isEvent)
                              .map((l) => ({ ...l, _type: "recurring" })),
                            ...(settings.rangeLocks || [])
                              .filter((l) => !l.isEvent)
                              .map((l) => ({ ...l, _type: "range" })),
                            ...bookings
                              .filter((b) => b.isLocked && !b.isEvent)
                              .map((b) => ({ ...b, _type: "calendar" })),
                          ] as any[]
                        ).length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 italic">
                            Keine manuellen Einzelsperren oder Schließzeiten
                            konfiguriert.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {/* Render Recurring Locks (not Events) */}
                            {(settings.recurringLocks || [])
                              .filter((l) => !l.isEvent)
                              .map((lock: RegularLock) => {
                                const weekdayLabel = [
                                  "Sonntag",
                                  "Montag",
                                  "Dienstag",
                                  "Mittwoch",
                                  "Donnerstag",
                                  "Freitag",
                                  "Samstag",
                                ][lock.dayOfWeek];
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-slate-100 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                        {lock.title}
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1.5 flex flex-wrap gap-2 items-center">
                                        <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700 uppercase tracking-widest text-[8px] font-black">
                                          {weekdayLabel}
                                        </span>
                                        <span>
                                          <i className="fa-regular fa-clock mr-1"></i>
                                          {lock.startTime} - {lock.endTime}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1 font-black"></i>
                                          {lock.courts.join(", ")}
                                        </span>
                                        {lock.isOngoing ? (
                                          <span className="text-slate-600">
                                            <i className="fa-solid fa-calendar-check mr-1"></i>
                                            Dauerhaft
                                          </span>
                                        ) : (
                                          <span className="text-slate-600">
                                            <i className="fa-solid fa-calendar-days mr-1"></i>
                                            {lock.startDate
                                              ? `${new Date(lock.startDate).toLocaleDateString("de-DE")} bis ${lock.endDate ? new Date(lock.endDate).toLocaleDateString("de-DE") : ""}`
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t sm:border-0 border-slate-200 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditRecurring(lock)
                                        }
                                        className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center transition-colors text-xs"
                                        title="Bearbeiten"
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteRecurringLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Render Range Locks (not Events) */}
                            {(settings.rangeLocks || [])
                              .filter((l) => !l.isEvent)
                              .map((lock: RangeLock) => {
                                const start = new Date(
                                  lock.startDate,
                                ).toLocaleDateString("de-DE");
                                const end = new Date(
                                  lock.endDate,
                                ).toLocaleDateString("de-DE");
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-slate-100 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                                        <i className="fa-solid fa-snowflake"></i>
                                        {lock.title}
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1 flex flex-wrap gap-3 items-center">
                                        <span>
                                          <i className="fa-regular fa-calendar-days mr-1"></i>
                                          {start} bis {end}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1"></i>
                                          {lock.courts.join(", ")}
                                        </span>
                                        <span className="text-orange-600 uppercase text-[8px] font-black tracking-wider">
                                          <i className="fa-solid fa-ban"></i>{" "}
                                          GANZTÄGIG GESPERRT
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t border-slate-200 sm:border-0 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditRange(lock)
                                        }
                                        className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center transition-colors text-xs"
                                        title="Bearbeiten"
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteRangeLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Render Calendar Locks (not Events) */}
                            {bookings
                              .filter((b) => b.isLocked && !b.isEvent)
                              .map((lock: Booking) => {
                                const dateFmt = new Date(
                                  lock.date,
                                ).toLocaleDateString("de-DE", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                });
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-rose-50 border border-red-100 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-rose-100 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-rose-700 uppercase tracking-wide">
                                        {lock.reason || "Sperre"}
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1 flex flex-wrap gap-3 items-center">
                                        <span>
                                          <i className="fa-regular fa-calendar-day mr-1"></i>
                                          {dateFmt}
                                        </span>
                                        <span>
                                          <i className="fa-regular fa-clock mr-1"></i>
                                          {lock.time}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1"></i>
                                          {lock.court}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t border-rose-100 sm:border-0 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCalendarLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Category 2: Regelmäßige Serientermine */}
                      <div className="bg-white p-6 rounded-2xl border-none shadow-md space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#f97316] flex items-center gap-2">
                          <i className="fa-solid fa-calendar-check"></i>{" "}
                          Regelmäßige Serientermine
                        </h4>

                        {(
                          [
                            ...(settings.recurringLocks || [])
                              .filter((l) => l.isEvent)
                              .map((l) => ({ ...l, _type: "recurring" })),
                            ...(settings.rangeLocks || [])
                              .filter((l) => l.isEvent)
                              .map((l) => ({ ...l, _type: "range" })),
                            ...bookings
                              .filter((b) => b.isLocked && b.isEvent)
                              .map((b) => ({ ...b, _type: "calendar" })),
                          ] as any[]
                        ).length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 italic">
                            Keine Serientermine konfiguriert.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {/* Render Recurring Locks (Events) */}
                            {(settings.recurringLocks || [])
                              .filter((l) => l.isEvent)
                              .map((lock: RegularLock) => {
                                const weekdayLabel = [
                                  "Sonntag",
                                  "Montag",
                                  "Dienstag",
                                  "Mittwoch",
                                  "Donnerstag",
                                  "Freitag",
                                  "Samstag",
                                ][lock.dayOfWeek];
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-orange-50 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-orange-800 uppercase tracking-wide flex items-center gap-2">
                                        {lock.color && (
                                          <span
                                            className="w-2.5 h-2.5 rounded-full inline-block border border-black/10 shrink-0"
                                            style={{ backgroundColor: lock.color }}
                                          />
                                        )}
                                        <span>{lock.title}</span>
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1.5 flex flex-wrap gap-2 items-center">
                                        <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded uppercase tracking-widest text-[8px] font-black">
                                          {weekdayLabel}
                                        </span>
                                        <span>
                                          <i className="fa-regular fa-clock mr-1"></i>
                                          {lock.startTime} - {lock.endTime}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1 font-black"></i>
                                          {lock.courts.join(", ")}
                                        </span>

                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t border-orange-200/50 sm:border-0 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditRecurring(lock)
                                        }
                                        className="w-8 h-8 rounded-full bg-white text-orange-600 hover:bg-orange-100 shadow flex items-center justify-center transition-colors text-xs"
                                        title="Bearbeiten"
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteRecurringLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Render Range Locks (Events) */}
                            {(settings.rangeLocks || [])
                              .filter((l) => l.isEvent)
                              .map((lock: RangeLock) => {
                                const start = new Date(
                                  lock.startDate,
                                ).toLocaleDateString("de-DE");
                                const end = new Date(
                                  lock.endDate,
                                ).toLocaleDateString("de-DE");
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-orange-50 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-orange-800 uppercase tracking-wide flex items-center gap-1.5">
                                        <i className="fa-solid fa-calendar-week"></i>
                                        {lock.title}
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1 flex flex-wrap gap-3 items-center">
                                        <span>
                                          <i className="fa-regular fa-calendar-days mr-1"></i>
                                          {start} bis {end}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1"></i>
                                          {lock.courts.join(", ")}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t border-orange-200/50 sm:border-0 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartEditRange(lock)
                                        }
                                        className="w-8 h-8 rounded-full bg-white text-orange-600 hover:bg-orange-100 shadow flex items-center justify-center transition-colors text-xs"
                                        title="Bearbeiten"
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteRangeLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Render Calendar Locks (Events) */}
                            {bookings
                              .filter((b) => b.isLocked && b.isEvent)
                              .map((lock: Booking) => {
                                const dateFmt = new Date(
                                  lock.date,
                                ).toLocaleDateString("de-DE", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                });
                                return (
                                  <div
                                    key={lock.id}
                                    className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center hover:bg-orange-50 transition-colors"
                                  >
                                    <div>
                                      <h5 className="text-xs font-black text-orange-800 uppercase tracking-wide">
                                        {lock.reason || "Sperre"}
                                      </h5>
                                      <div className="text-[10px] text-slate-500 font-bold mt-1 flex flex-wrap gap-3 items-center">
                                        <span>
                                          <i className="fa-regular fa-calendar-day mr-1"></i>
                                          {dateFmt}
                                        </span>
                                        <span>
                                          <i className="fa-regular fa-clock mr-1"></i>
                                          {lock.time}
                                        </span>
                                        <span>
                                          <i className="fa-solid fa-circle-nodes mr-1"></i>
                                          {lock.court}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-3 sm:shrink-0 w-full sm:w-auto justify-end border-t border-orange-200/50 sm:border-0 sm:pt-0 pt-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCalendarLock(lock.id)
                                        }
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors text-xs"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LOCK FORM DRAWER */}
                  {isLockDrawerOpen && createPortal(
                    <div className="fixed inset-0 z-[99999] flex justify-end">
                      {/* Backdrop */}
                      <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsLockDrawerOpen(false)}
                      ></div>

                      {/* Drawer Panel */}
                      <div className="relative w-full md:max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10">
                        {/* Header */}
                        <div
                          className={`${lockContext === "event" ? "bg-[var(--color-primary)]" : "bg-slate-500"} px-4 py-4 flex items-center justify-between text-white shrink-0`}
                        >
                          <h3 className="font-black tracking-widest uppercase text-xs sm:text-sm flex items-center gap-2">
                            <i
                              className={`fa-solid ${lockContext === "event" ? "fa-calendar-check" : "fa-ban"} text-white/50`}
                            ></i>
                            {editingLockId
                              ? lockContext === "event"
                                ? "Serientermin bearbeiten"
                                : "Sperre bearbeiten"
                              : lockContext === "event"
                                ? "Neuer Serientermin"
                                : "Neue Sperre"}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsLockDrawerOpen(false)}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all outline-none flex items-center justify-center border border-white/10 shrink-0"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>

                        {/* Body / Scrollable Form */}
                        <div className="flex-1 overflow-y-auto p-4 pb-6 space-y-4 bg-slate-50">
                          {/* Lock Type buttons (only show if creating new) */}
                          {!editingLockId && (
                            <div className="flex flex-col sm:flex-row p-0.5 gap-0.5 bg-slate-200 rounded-xl border border-slate-200 shrink-0">
                              <button
                                type="button"
                                onClick={() => setNewLockType("range")}
                                className={`flex-[1.2] py-2 px-2 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${newLockType === "range" ? (lockContext === "event" ? "bg-[var(--color-primary)] text-white shadow" : "bg-slate-500 text-white shadow") : "text-slate-600 hover:bg-slate-300"}`}
                              >
                                Einmaliger Zeitraum
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewLockType("regular")}
                                className={`flex-[1.8] py-2 px-2 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${newLockType === "regular" ? (lockContext === "event" ? "bg-[var(--color-primary)] text-white shadow" : "bg-slate-500 text-white shadow") : "text-slate-600 hover:bg-slate-300"}`}
                              >
                                Wöchentliche Wiederholung
                              </button>
                            </div>
                          )}

                          {/* Title */}
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                              Bezeichnung / Titel
                            </label>
                            <input 
                              type="text"
                              value={newLockTitle}
                              onChange={(e) => setNewLockTitle(e.target.value)}
                              placeholder={
                                lockContext === "event"
                                  ? "z.B. Freitagsdoppel, Training"
                                  : "z.B. Platzpflege, Regen..."
                              }
                              className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                          </div>

                          {/* Farbe (Hex-Code, optional) */}
                          {lockContext === "event" && newLockType === "regular" && (
                            <div className="space-y-1">
                              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                                Farbe (Hex-Code, optional)
                              </label>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={newLockColor}
                                  onChange={(e) => setNewLockColor(e.target.value)}
                                  placeholder={settings.primaryColor || "#1b4332"}
                                  className="flex-1 px-3 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-slate-800 transition-colors uppercase py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <div className="relative flex items-center justify-center w-10 h-10 border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-slate-400 bg-white">
                                  <input
                                    type="color"
                                    value={newLockColor && /^#[0-9A-F]{6}$/i.test(newLockColor) ? newLockColor : (settings.primaryColor || "#1b4332")}
                                    onChange={(e) => setNewLockColor(e.target.value.toLowerCase())}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer animate-none font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                  <div 
                                    className="w-6 h-6 rounded-lg shadow-inner border border-black/10"
                                    style={{ backgroundColor: newLockColor || settings.primaryColor || "#1b4332" }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                                Betroffene Plätze
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const all = settings.courts || [
                                    "Platz 1",
                                    "Platz 2",
                                  ];
                                  if (newLockCourts.length === all.length) {
                                    setNewLockCourts([]);
                                  } else {
                                    setNewLockCourts([...all]);
                                  }
                                }}
                                className="text-[9px] font-black text-[var(--color-accent)] uppercase tracking-wider hover:underline"
                              >
                                {newLockCourts.length ===
                                (settings.courts || []).length
                                  ? "Keine Plätze"
                                  : "Alle Plätze"}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                settings.courts || [
                                  "Platz 1",
                                  "Platz 2",
                                  "Platz 3",
                                  "Platz 4",
                                ]
                              ).map((court) => {
                                const isSel = newLockCourts.includes(court);
                                return (
                                  <button
                                    key={court}
                                    type="button"
                                    onClick={() => {
                                      if (isSel) {
                                        setNewLockCourts(
                                          newLockCourts.filter(
                                            (c) => c !== court,
                                          ),
                                        );
                                      } else {
                                        setNewLockCourts([
                                          ...newLockCourts,
                                          court,
                                        ]);
                                      }
                                    }}
                                    className={`h-10 px-3 flex items-center justify-center rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                                      isSel
                                        ? "bg-[color-mix(in_srgb,_var(--color-primary)_12%,_white)] border-[var(--color-primary)] text-[var(--color-primary)] font-black"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                  >
                                    {court}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Type specific fields */}
                          {newLockType === "regular" ? (
                            <div className="space-y-4 pt-3 border-t border-slate-200">
                              <p className="text-[10px] text-slate-500 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                                Verwende dies für alle echten Serien
                                (wöchentlich wiederkehrende Slots, z.B.
                                Vereinstraining jeden Freitag).
                              </p>
                              {/* Wochentag */}
                              <div className="space-y-1">
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                                  Wochentag
                                </label>
                                <select 
                                  value={newLockDay}
                                  onChange={(e) =>
                                    setNewLockDay(parseInt(e.target.value))
                                  }
                                  className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium"
                                >
                                  <option value={1}>Montag</option>
                                  <option value={2}>Dienstag</option>
                                  <option value={3}>Mittwoch</option>
                                  <option value={4}>Donnerstag</option>
                                  <option value={5}>Freitag</option>
                                  <option value={6}>Samstag</option>
                                  <option value={0}>Sonntag</option>
                                </select>
                              </div>

                              {/* Uhrzeiten */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Von
                                  </label>
                                  <select 
                                    value={newLockStartTime}
                                    onChange={(e) => {
                                      setNewLockStartTime(e.target.value);
                                      const idx = TIME_SLOTS.indexOf(
                                        e.target.value,
                                      );
                                      if (
                                        TIME_SLOTS.indexOf(newLockEndTime) <=
                                        idx
                                      ) {
                                        setNewLockEndTime(
                                          TIME_SLOTS[idx + 1] || e.target.value,
                                        );
                                      }
                                    }}
                                    className="w-full px-3 border border-slate-200 rounded-xl font-bold text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2"
                                  >
                                    {TIME_SLOTS.slice(0, -1).map((h) => (
                                      <option key={h} value={h}>
                                        {h} Uhr
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Bis
                                  </label>
                                  <select 
                                    value={newLockEndTime}
                                    onChange={(e) =>
                                      setNewLockEndTime(e.target.value)
                                    }
                                    className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium"
                                  >
                                    {TIME_SLOTS.slice(
                                      TIME_SLOTS.indexOf(newLockStartTime) + 1,
                                    ).map((h) => (
                                      <option key={h} value={h}>
                                        {h} Uhr
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Dauerhaft oder Datum */}
                              <div className="space-y-3 pt-3 border-t border-slate-200">
                                <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={newLockIsOngoing}
                                    onChange={(e) =>
                                      setNewLockIsOngoing(e.target.checked)
                                    }
                                    className="h-4 w-4 text-[var(--color-primary)] border-slate-300 rounded focus:ring-[var(--color-primary)] flex-shrink-0 accent-[var(--color-primary)] cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                                    Dauerhaft (Unbegrenzt)
                                  </span>
                                </label>

                                {!newLockIsOngoing && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                        Gültig von
                                      </label>
                                      <input 
                                        type="date"
                                        value={newLockStartDate}
                                        onChange={(e) =>
                                          setNewLockStartDate(e.target.value)
                                        }
                                        className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                        Gültig bis
                                      </label>
                                      <input 
                                        type="date"
                                        value={newLockEndDate}
                                        onChange={(e) =>
                                          setNewLockEndDate(e.target.value)
                                        }
                                        className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 pt-3 border-t border-slate-200">
                              {/* Date Range Fields */}
                              <p className="text-[10px] text-slate-500 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                                Sperrt die gewählten Plätze für den gesamten
                                angegebenen Zeitraum (z.B. Starkregen für 3
                                Stunden, oder Winterpause für mehrere Monate).
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Start-Datum
                                  </label>
                                  <input 
                                    type="date"
                                    value={newRangeStartDate}
                                    onChange={(e) =>
                                      setNewRangeStartDate(e.target.value)
                                    }
                                    className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Ende-Datum
                                  </label>
                                  <input 
                                    type="date"
                                    value={newRangeEndDate}
                                    onChange={(e) =>
                                      setNewRangeEndDate(e.target.value)
                                    }
                                    className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Von (Uhrzeit)
                                  </label>
                                  <select 
                                    value={newRangeStartTime}
                                    onChange={(e) =>
                                      setNewRangeStartTime(e.target.value)
                                    }
                                    className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium"
                                  >
                                    {TIME_SLOTS.map((t) => (
                                      <option key={t} value={t}>
                                        {t} Uhr
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Bis (Uhrzeit)
                                  </label>
                                  <select 
                                    value={newRangeEndTime}
                                    onChange={(e) =>
                                      setNewRangeEndTime(e.target.value)
                                    }
                                    className="w-full px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 outline-none focus:border-slate-800 transition-colors py-2 font-sans font-medium"
                                  >
                                    {TIME_SLOTS.map((t) => (
                                      <option key={t} value={t}>
                                        {t} Uhr
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                               {/* Option removed by request - all events are open offers */}
                            </div>
                          )}
                        </div>

                        {/* Footer / Buttons */}
                        <div className="p-6 border-t border-slate-200 bg-white shrink-0 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                          <button
                            type="button"
                            onClick={handleCancelLockEdit}
                            className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl uppercase tracking-wider transition-colors py-2.5 text-sm font-medium"
                          >
                            Abbrechen
                          </button>
                          {editingLockId ? (
                            <button
                              type="button"
                              onClick={handleSaveLockEdit}
                              className={`w-2/3 text-sm font-medium${lockContext === "event font-medium" ? "bg-[var(--color-primary)] hover:bg-black focus:ring-[var(--color-primary)]/20 font-medium" : "bg-slate-500 hover:bg-slate-600 focus:ring-slate-500/20 font-medium"}text-white rounded-xl uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 py-2.5 text-sm font-medium`}
                            >
                              <i className="fa-solid fa-check"></i> Speichern
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleAddLock}
                              className={`w-2/3 text-sm font-medium${lockContext === "event font-medium" ? "bg-[var(--color-primary)] hover:bg-black focus:ring-[var(--color-primary)]/20 font-medium" : "bg-slate-500 hover:bg-slate-600 focus:ring-slate-500/20 font-medium"}text-white rounded-xl uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 py-2.5 text-sm font-medium`}
                            >
                              <i className="fa-solid fa-plus-circle"></i> {lockContext === "event" ? "Serie anlegen" : "Sperre anlegen"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}

              {/* TAB 3: LAYOUT & NEWS */}
              {currentTab === "layout" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    {/* Branding configuration fields */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-palette"></i> Erscheinungsbild
                      </h3>

                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Farben
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                checked={!isCustomColors}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setIsCustomColors(false);
                                    setPrimaryColor(
                                      DEFAULT_SETTINGS.primaryColor,
                                    );
                                    setAccentColor(
                                      DEFAULT_SETTINGS.accentColor || "#c04d2b",
                                    );
                                    setAccentColor2(
                                      DEFAULT_SETTINGS.accentColor2 ||
                                        "#0f172a",
                                    );
                                    setAccentColor3(
                                      DEFAULT_SETTINGS.accentColor3 ||
                                        "#ccff00",
                                    );
                                  } else {
                                    setIsCustomColors(true);
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                Standard verwenden
                              </span>
                            </label>
                          </div>

                          <div
                            className={`space-y-4 transition-opacity ${!isCustomColors ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Primärfarbe (HEX-Code)
                              </label>
                              <div className="flex gap-3">
                                <input
                                  type="color"
                                  value={primaryColor}
                                  onChange={(e) =>
                                    setPrimaryColor(e.target.value)
                                  }
                                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200/80 p-1 bg-white hover:border-[var(--color-primary)] transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <input 
                                  type="text"
                                  value={primaryColor}
                                  onChange={(e) =>
                                    setPrimaryColor(e.target.value)
                                  }
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all uppercase text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Akzentfarbe (HEX-Code)
                              </label>
                              <div className="flex gap-3">
                                <input
                                  type="color"
                                  value={accentColor}
                                  onChange={(e) =>
                                    setAccentColor(e.target.value)
                                  }
                                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200/80 p-1 bg-white hover:border-[var(--color-primary)] transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <input 
                                  type="text"
                                  value={accentColor}
                                  onChange={(e) =>
                                    setAccentColor(e.target.value)
                                  }
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all uppercase text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Akzentfarbe 2 (z.B. Dunkelblau)
                              </label>
                              <div className="flex gap-3">
                                <input
                                  type="color"
                                  value={accentColor2}
                                  onChange={(e) =>
                                    setAccentColor2(e.target.value)
                                  }
                                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200/80 p-1 bg-white hover:border-[var(--color-primary)] transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <input 
                                  type="text"
                                  value={accentColor2}
                                  onChange={(e) =>
                                    setAccentColor2(e.target.value)
                                  }
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all uppercase text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Akzentfarbe 3 (z.B. Hellgrün)
                              </label>
                              <div className="flex gap-3">
                                <input
                                  type="color"
                                  value={accentColor3}
                                  onChange={(e) =>
                                    setAccentColor3(e.target.value)
                                  }
                                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200/80 p-1 bg-white hover:border-[var(--color-primary)] transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <input 
                                  type="text"
                                  value={accentColor3}
                                  onChange={(e) =>
                                    setAccentColor3(e.target.value)
                                  }
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all uppercase text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
                          {/* Logo Anmelde- und Ladebildschirm */}
                          <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Logo Anmelde- und Ladebildschirm
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  checked={logoUrl === DEFAULT_SETTINGS.logoUrl}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setLogoUrl(DEFAULT_SETTINGS.logoUrl);
                                    } else {
                                      if (
                                        !customLogoUrl ||
                                        customLogoUrl ===
                                          DEFAULT_SETTINGS.logoUrl
                                      ) {
                                        setLogoUrl("");
                                        setCustomLogoUrl("");
                                      } else {
                                        setLogoUrl(customLogoUrl);
                                      }
                                    }
                                  }}
                                />
                                <span className="text-[10px] font-bold text-slate-600 uppercase">
                                  Standard verwenden
                                </span>
                              </label>
                            </div>

                            <div
                              className={`transition-opacity ${logoUrl === DEFAULT_SETTINGS.logoUrl ? "opacity-50 pointer-events-none" : ""}`}
                            >
                              {!customLogoUrl ? (
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={customLogoUrl}
                                    onChange={(e) => {
                                      setLogoUrl(e.target.value);
                                      setCustomLogoUrl(e.target.value);
                                    }}
                                    className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    placeholder="https://example.com/logo.png"
                                  />
                                  <label className="bg-slate-100 border border-slate-200/80 hover:border-[var(--color-primary)] rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors h-10 shrink-0">
                                    {uploadingImage.logo ? (
                                      <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                                    ) : (
                                      <i className="fa-solid fa-cloud-arrow-up text-sm text-slate-600"></i>
                                    )}
                                    <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleImageUpload(e, "logo")
                                      }
                                      disabled={uploadingImage.logo}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <div className="relative group w-[100px] aspect-square rounded-xl border border-slate-200/80 overflow-hidden bg-white flex items-center justify-center">
                                  <img
                                    src={customLogoUrl}
                                    alt="Logo"
                                    className="w-full h-full object-contain p-2"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <label className="bg-white text-[var(--color-primary)] px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer hover:bg-slate-100 shadow-md">
                                      <i className="fa-solid fa-upload mr-1"></i>
                                      Ändern
                                      <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleImageUpload(e, "logo")
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLogoUrl("");
                                        setCustomLogoUrl("");
                                      }}
                                      className="text-white text-[8px] uppercase font-bold tracking-widest hover:underline"
                                    >
                                      URL
                                    </button>
                                  </div>
                                  {uploadingImage.logo && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                      <i className="fa-solid fa-spinner fa-spin text-xl text-[var(--color-primary)]"></i>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Logo Kopfzeile */}
                          <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Logo Kopfzeile
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  checked={
                                    headerLogoUrl ===
                                    (DEFAULT_SETTINGS.headerLogoUrl ||
                                      DEFAULT_SETTINGS.logoUrl)
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setHeaderLogoUrl(
                                        DEFAULT_SETTINGS.headerLogoUrl ||
                                          DEFAULT_SETTINGS.logoUrl,
                                      );
                                    } else {
                                      const defHdr =
                                        DEFAULT_SETTINGS.headerLogoUrl ||
                                        DEFAULT_SETTINGS.logoUrl;
                                      if (
                                        !customHeaderLogoUrl ||
                                        customHeaderLogoUrl === defHdr
                                      ) {
                                        setHeaderLogoUrl("");
                                        setCustomHeaderLogoUrl("");
                                      } else {
                                        setHeaderLogoUrl(customHeaderLogoUrl);
                                      }
                                    }
                                  }}
                                />
                                <span className="text-[10px] font-bold text-slate-600 uppercase">
                                  Standard verwenden
                                </span>
                              </label>
                            </div>

                            <div
                              className={`transition-opacity ${headerLogoUrl === (DEFAULT_SETTINGS.headerLogoUrl || DEFAULT_SETTINGS.logoUrl) ? "opacity-50 pointer-events-none" : ""}`}
                            >
                              {!customHeaderLogoUrl ? (
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={customHeaderLogoUrl}
                                    onChange={(e) => {
                                      setHeaderLogoUrl(e.target.value);
                                      setCustomHeaderLogoUrl(e.target.value);
                                    }}
                                    className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    placeholder="https://example.com/header-logo.png"
                                  />
                                  <label className="bg-slate-100 border border-slate-200/80 hover:border-[var(--color-primary)] rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors h-10 shrink-0">
                                    {uploadingImage.headerLogo ? (
                                      <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                                    ) : (
                                      <i className="fa-solid fa-cloud-arrow-up text-sm text-slate-600"></i>
                                    )}
                                    <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleImageUpload(e, "headerLogo")
                                      }
                                      disabled={uploadingImage.headerLogo}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <div className="relative group w-[100px] aspect-square rounded-xl border border-slate-200/80 overflow-hidden bg-white flex items-center justify-center bg-slate-50">
                                  <img
                                    src={customHeaderLogoUrl}
                                    alt="Header Logo"
                                    className="w-full h-full object-contain p-2 drop-shadow-md"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <label className="bg-white text-[var(--color-primary)] px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer hover:bg-slate-100 shadow-md">
                                      <i className="fa-solid fa-upload mr-1"></i>
                                      Ändern
                                      <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleImageUpload(e, "headerLogo")
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHeaderLogoUrl("");
                                        setCustomHeaderLogoUrl("");
                                      }}
                                      className="text-white text-[8px] uppercase font-bold tracking-widest hover:underline"
                                    >
                                      URL
                                    </button>
                                  </div>
                                  {uploadingImage.headerLogo && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                      <i className="fa-solid fa-spinner fa-spin text-xl text-[var(--color-primary)]"></i>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                                Favicon (Browser-Tab Symbol)
                              </label>
                              <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 block">
                                Symbol für den Browser-Tab
                              </span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                checked={
                                  faviconUrl ===
                                  (DEFAULT_SETTINGS.faviconUrl ||
                                    "/favicon.svg")
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFaviconUrl(
                                      DEFAULT_SETTINGS.faviconUrl ||
                                        "/favicon.svg",
                                    );
                                  } else {
                                    const defFav =
                                      DEFAULT_SETTINGS.faviconUrl ||
                                      "/favicon.svg";
                                    if (
                                      !customFaviconUrl ||
                                      customFaviconUrl === defFav
                                    ) {
                                      setFaviconUrl("");
                                      setCustomFaviconUrl("");
                                    } else {
                                      setFaviconUrl(customFaviconUrl);
                                    }
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                Standard verwenden
                              </span>
                            </label>
                          </div>

                          {/* Explicit Interactive Browser Tab Preview */}
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                Live-Vorschau (Browser-Tab)
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-200/50 px-2.5 py-0.5 rounded-full uppercase">
                                {faviconUrl ===
                                (DEFAULT_SETTINGS.faviconUrl || "/favicon.svg")
                                  ? "Standard aktiv"
                                  : "Eigene Grafik aktiv"}
                              </span>
                            </div>

                            <div className="bg-slate-200 rounded-xl p-3 flex items-center gap-1.5 h-14 overflow-hidden select-none relative shadow-sm">
                              {/* Browser Window Control Dots / Window actions decoration */}
                              <div className="flex gap-1 pr-3 pl-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                              </div>

                              {/* Simulated active browser tab */}
                              <div className="bg-white px-3.5 py-2 rounded-lg flex items-center gap-2 max-w-[170px] shadow-sm border border-slate-300/40 animate-in fade-in duration-200">
                                <img
                                  src={faviconUrl || "/favicon.svg"}
                                  alt="Favicon Tab Vorschau"
                                  className="w-4 h-4 object-contain shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "/favicon.svg";
                                  }}
                                />
                                <span className="text-[10px] font-extrabold text-slate-700 truncate">
                                  {clubName || "Tennis-Club"}
                                </span>
                                <i className="fa-solid fa-xmark text-[9px] text-slate-400 ml-1.5 hover:text-slate-600 transition-colors cursor-pointer"></i>
                              </div>

                              {/* Accent background filler */}
                              <div className="flex-1 bg-slate-200/20 h-full rounded-r"></div>
                            </div>
                          </div>

                          {/* Custom Icon Settings (only functional if Standard is unchecked) */}
                          <div
                            className={`transition-all duration-300 ${faviconUrl === (DEFAULT_SETTINGS.faviconUrl || "/favicon.svg") ? "opacity-40 pointer-events-none" : ""}`}
                          >
                            {/* Selector Tabs for custom input method */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                              <button
                                type="button"
                                onClick={() => setFaviconInputMode("upload")}
                                disabled={
                                  faviconUrl ===
                                  (DEFAULT_SETTINGS.faviconUrl ||
                                    "/favicon.svg")
                                }
                                className={`py-2 text-[10px] uppercase tracking-wider font-extrabold rounded-lg flex items-center justify-center gap-2 transition-all ${
                                  faviconInputMode === "upload"
                                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                <i className="fa-solid fa-cloud-arrow-up"></i>
                                <span>Grafik direkt hochladen</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setFaviconInputMode("url")}
                                disabled={
                                  faviconUrl ===
                                  (DEFAULT_SETTINGS.faviconUrl ||
                                    "/favicon.svg")
                                }
                                className={`py-2 text-[10px] uppercase tracking-wider font-extrabold rounded-lg flex items-center justify-center gap-2 transition-all ${
                                  faviconInputMode === "url"
                                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                <i className="fa-solid fa-link"></i>
                                <span>Über Web-Link verlinken</span>
                              </button>
                            </div>

                            {faviconInputMode === "upload" ? (
                              <div className="space-y-4">
                                {/* Drag / Drop Upload Zone or Active Upload State */}
                                {customFaviconUrl &&
                                customFaviconUrl.startsWith("data:") ? (
                                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                                    <div className="w-14 h-14 shrink-0 rounded-lg border border-slate-200/80 bg-white shadow-sm flex items-center justify-center relative overflow-hidden group">
                                      <img
                                        src={customFaviconUrl}
                                        alt="Custom Uploaded Favicon"
                                        className="w-full h-full object-contain p-1.5"
                                      />
                                      {uploadingImage.favicon && (
                                        <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                                          <i className="fa-solid fa-spinner fa-spin text-xl text-[var(--color-primary)]"></i>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-black text-slate-700 uppercase truncate">
                                        Eigenes Favicon hochgeladen
                                      </div>
                                      <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                        Optimiertes WebP Bildformat im
                                        Web-Speicher
                                      </div>

                                      <div className="flex items-center gap-3 mt-2.5">
                                        <label className="text-[9px] font-black uppercase tracking-wider text-white bg-[var(--color-primary)] hover:bg-black px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5">
                                          <i className="fa-solid fa-arrows-rotate"></i>
                                          <span>Anderes Bild hochladen</span>
                                          <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                            accept="image/*"
                                            onChange={(e) =>
                                              handleImageUpload(e, "favicon")
                                            }
                                            disabled={uploadingImage.favicon}
                                          />
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFaviconUrl("");
                                            setCustomFaviconUrl("");
                                          }}
                                          className="text-[9px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-2 rounded-lg transition-colors"
                                        >
                                          <i className="fa-solid fa-trash-can mr-1"></i>
                                          <span>Grafik löschen</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="border border-dashed border-slate-300 hover:border-[var(--color-primary)] bg-slate-50 hover:bg-slate-100/50 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative group">
                                    <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleImageUpload(e, "favicon")
                                      }
                                      disabled={uploadingImage.favicon}
                                    />
                                    {uploadingImage.favicon ? (
                                      <div className="py-2 flex flex-col items-center gap-2">
                                        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[var(--color-primary)]"></i>
                                        <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">
                                          Wird verarbeitet...
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-slate-200/80 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
                                          <i className="fa-solid fa-cloud-arrow-up text-lg text-slate-600 group-hover:text-[var(--color-primary)] transition-colors"></i>
                                        </div>
                                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
                                          Wähle ein quadratisches Bild aus
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-xs leading-relaxed">
                                          Zulässige Formate: PNG, SVG, JPG, ICO,
                                          WEBP.
                                          <br />
                                          Das Bild wird im System für dich
                                          optimiert.
                                        </div>
                                      </div>
                                    )}
                                  </label>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={customFaviconUrl}
                                    onChange={(e) => {
                                      setFaviconUrl(e.target.value);
                                      setCustomFaviconUrl(e.target.value);
                                    }}
                                    className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    placeholder="Z.B. https://ihre-website.de/favicon.png"
                                  />
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Geben Sie einen direkten HTTPS-Link zu einem
                                  Icon ein (z.B. PNG, ICO).
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Vereinsbanner
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                checked={
                                  bannerUrl === DEFAULT_SETTINGS.bannerUrl
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBannerUrl(DEFAULT_SETTINGS.bannerUrl);
                                  } else {
                                    if (
                                      !customBannerUrl ||
                                      customBannerUrl ===
                                        DEFAULT_SETTINGS.bannerUrl
                                    ) {
                                      setBannerUrl("");
                                      setCustomBannerUrl("");
                                    } else {
                                      setBannerUrl(customBannerUrl);
                                    }
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                Standard verwenden
                              </span>
                            </label>
                          </div>

                          <div
                            className={`transition-opacity ${bannerUrl === DEFAULT_SETTINGS.bannerUrl ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            {!customBannerUrl ? (
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={customBannerUrl}
                                  onChange={(e) => {
                                    setBannerUrl(e.target.value);
                                    setCustomBannerUrl(e.target.value);
                                  }}
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  placeholder="https://example.com/banner.jpg"
                                />
                                <label className="bg-slate-100 border border-slate-200/80 hover:border-[var(--color-primary)] rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors h-10 shrink-0">
                                  {uploadingImage.banner ? (
                                    <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                                  ) : (
                                    <i className="fa-solid fa-cloud-arrow-up text-sm text-slate-600"></i>
                                  )}
                                  <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleImageUpload(e, "banner")
                                    }
                                    disabled={uploadingImage.banner}
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="relative group w-full h-24 rounded-xl border border-slate-200/80 overflow-hidden bg-slate-100 flex items-center justify-center">
                                <img
                                  src={customBannerUrl}
                                  alt="Banner"
                                  className="w-full h-full object-cover"
                                  style={{ objectPosition: bannerPosition }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                  <div className="flex gap-2">
                                    <label className="bg-white text-[var(--color-primary)] px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer hover:bg-slate-100 shadow-md flex items-center">
                                      <i className="fa-solid fa-upload mr-1.5"></i>
                                      Bild ändern
                                      <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleImageUpload(e, "banner")
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowBannerPositionModal(true)
                                      }
                                      className="bg-[var(--color-accent)] text-white px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer shadow-md hover:brightness-110 flex items-center"
                                    >
                                      <i className="fa-solid fa-crop-simple mr-1.5"></i>
                                      Ausschnitt wählen
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBannerUrl("");
                                      setCustomBannerUrl("");
                                    }}
                                    className="text-white text-[8px] uppercase font-bold tracking-widest hover:underline"
                                  >
                                    URL eingeben
                                  </button>
                                </div>
                                {uploadingImage.banner && (
                                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <i className="fa-solid fa-spinner fa-spin text-2xl text-[var(--color-primary)]"></i>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Anmelde-Hintergrund (Grafik)
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input className="w-4 h-4 accent-[var(--color-primary)] placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                checked={
                                  loginBannerUrl ===
                                  (DEFAULT_SETTINGS.loginBannerUrl ||
                                    DEFAULT_SETTINGS.bannerUrl)
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setLoginBannerUrl(
                                      DEFAULT_SETTINGS.loginBannerUrl ||
                                        DEFAULT_SETTINGS.bannerUrl,
                                    );
                                  } else {
                                    const defLogB =
                                      DEFAULT_SETTINGS.loginBannerUrl ||
                                      DEFAULT_SETTINGS.bannerUrl;
                                    if (
                                      !customLoginBannerUrl ||
                                      customLoginBannerUrl === defLogB
                                    ) {
                                      setLoginBannerUrl("");
                                      setCustomLoginBannerUrl("");
                                    } else {
                                      setLoginBannerUrl(customLoginBannerUrl);
                                    }
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                Standard verwenden
                              </span>
                            </label>
                          </div>

                          <div
                            className={`transition-opacity ${loginBannerUrl === (DEFAULT_SETTINGS.loginBannerUrl || DEFAULT_SETTINGS.bannerUrl) ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            {!customLoginBannerUrl ? (
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={customLoginBannerUrl}
                                  onChange={(e) => {
                                    setLoginBannerUrl(e.target.value);
                                    setCustomLoginBannerUrl(e.target.value);
                                  }}
                                  className="flex-1 px-2.5 border border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  placeholder="https://example.com/login-banner.jpg"
                                />
                                <label className="bg-slate-100 border border-slate-200/80 hover:border-[var(--color-primary)] rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors h-10 shrink-0">
                                  {uploadingImage.loginBanner ? (
                                    <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                                  ) : (
                                    <i className="fa-solid fa-cloud-arrow-up text-sm text-slate-600"></i>
                                  )}
                                  <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleImageUpload(e, "loginBanner")
                                    }
                                    disabled={uploadingImage.loginBanner}
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="relative group w-full h-24 rounded-xl border border-slate-200/80 overflow-hidden bg-slate-100 flex items-center justify-center">
                                <img
                                  src={customLoginBannerUrl}
                                  alt="Login Banner"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                  <label className="bg-white text-[var(--color-primary)] px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer hover:bg-slate-100 shadow-md flex items-center">
                                    <i className="fa-solid fa-upload mr-1.5"></i>
                                    Bild ändern
                                    <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleImageUpload(e, "loginBanner")
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLoginBannerUrl("");
                                      setCustomLoginBannerUrl("");
                                    }}
                                    className="text-white text-[8px] uppercase font-bold tracking-widest hover:underline"
                                  >
                                    URL eingeben
                                  </button>
                                </div>
                                {uploadingImage.loginBanner && (
                                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <i className="fa-solid fa-spinner fa-spin text-2xl text-[var(--color-primary)]"></i>
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-2">
                              Hintergrundgrafik für den Anmeldebildschirm. Da
                              die Anmeldeseite auf Desktop-Monitoren zweispaltig
                              geteilt ist, wird hierfür eine quadratische oder
                              hochformatige Grafik empfohlen (z.B. Foto der
                              Hallenplätze/Anlage).
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Webseiten-Link
                          </label>
                          <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-4 shadow-sm">
                            <input 
                              type="text"
                              value={websiteUrl}
                              onChange={(e) => setWebsiteUrl(e.target.value)}
                              disabled={hideWebsiteLink}
                              className="w-full px-2.5 border border-slate-200/80 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none transition-all disabled:opacity-50 text-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              placeholder="https://www.tennis-club.local"
                            />
                            <label
                              className="flex items-center gap-3 cursor-pointer group"
                              onClick={() =>
                                setHideWebsiteLink(!hideWebsiteLink)
                              }
                            >
                              <div
                                className={`w-10 h-6 rounded-full p-1 transition-colors ${hideWebsiteLink ? "bg-[var(--color-primary)]" : "bg-slate-200"}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hideWebsiteLink ? "translate-x-4" : ""}`}
                                ></div>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-black">
                                Website-Link ganz verbergen
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Embedded News-Zentrale (Layout & News) */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-bullhorn"></i> Vereins-News
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Aktuelle Meldung (Im Header Sichtbar)
                          </label>
                          <textarea
                            value={localNews}
                            onChange={(e) => setLocalNews(e.target.value)}
                            placeholder="Z.B. Die Plätze sind eröffnet!..."
                            className="w-full h-8 px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-[var(--color-primary)] shadow-sm min-h-[120px] resize-y placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          />
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md space-y-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Meldungs-Vorschau
                          </p>
                          {localNews.trim() ? (
                            <div className="bg-[var(--color-accent)] py-2 px-4 rounded-xl text-center text-white text-[10px] font-black uppercase tracking-wider">
                              <i className="fa-solid fa-bullhorn mr-2"></i>{" "}
                              {localNews}
                            </div>
                          ) : (
                            <div className="py-4 text-center bg-slate-50 border border-dashed rounded-xl ">
                              <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest italic">
                                Keine aktive Meldung
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Willkommensnachricht (Anmeldescreen) */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-comment-dots"></i>{" "}
                        Willkommensnachricht (Anmeldescreen)
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Text für den Begrüßungsbildschirm
                          </label>
                          <RichTextEditorToolbar
                            textareaRef={welcomeTextRef}
                            value={welcomeMessage}
                            onChange={setWelcomeMessage}
                          />
                          <textarea
                            ref={welcomeTextRef}
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            placeholder="Herzlich willkommen..."
                            className="w-full h-8 px-3 py-1 rounded-b-xl bg-white border border-slate-200 border-t-0 text-xs outline-none focus:border-[var(--color-primary)] shadow-sm min-h-[120px] resize-y placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          />
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                            Dieser Text wird auf dem Loginbildschirm angezeigt.
                            Formatiere den Text mit der Leiste oder verwende
                            Markdown (z.B. **fett**, *kursiv*, ### Überschrift,
                            - Liste).
                          </p>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Live-Vorschau
                          </p>
                          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 max-h-[150px] overflow-y-auto">
                            <RichTextRenderer text={welcomeMessage} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Impressum-Zentrale (Layout & Impressum) */}
                    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                      <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-scale-balanced"></i> Impressum
                        (Rechtliche Angaben)
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Inhalt des Impressums (Text oder HTML)
                          </label>
                          <RichTextEditorToolbar
                            textareaRef={impressumTextRef}
                            value={impressum}
                            onChange={setImpressum}
                          />
                          <textarea
                            ref={impressumTextRef}
                            value={impressum}
                            onChange={(e) => setImpressum(e.target.value)}
                            placeholder="Angaben gemäß § 5 TMG..."
                            className="w-full h-8 px-3 py-1 rounded-b-xl bg-white border border-slate-200 border-t-0 text-xs outline-none focus:border-[var(--color-primary)] shadow-sm min-h-[160px] resize-y placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          />
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                            Dieser Text wird unten in der Fußzeile (Impressum
                            Link) angezeigt.
                          </p>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border-none shadow-md">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Live-Vorschau
                          </p>
                          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 max-h-[150px] overflow-y-auto">
                            <RichTextRenderer text={impressum} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Category Actions */}
                  <div className="border-t border-slate-100 pt-6 flex justify-end">
                    <button
                      type="button"
                      disabled={!isTabDirty("layout")}
                      onClick={() => handleSaveTab("layout")}
                      className={`font-black uppercase text-xs tracking-wider px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                        isTabDirty("layout")
                          ? "bg-[var(--color-primary)] text-white hover:bg-black shadow-lg hover:shadow-xl"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <i className="fa-solid fa-floppy-disk"></i> Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: BENUTZER (Spielerverwaltung) */}
              {currentTab === "users" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  {/* Member List & Search */}
                  <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                      <div>
                        <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2">
                          <i className="fa-solid fa-users"></i>{" "}
                          Mitgliederverwaltung
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          {Object.keys(users).length}{" "}
                          {Object.keys(users).length === 1
                            ? "Mitglied"
                            : "Mitglieder"}{" "}
                          registriert
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser({
                            name: "",
                            password: "",
                            role: Role.USER,
                            gender: "m",
                            firstName: "",
                            lastName: "",
                            email: "",
                            phone: "",
                            birthDate: "",
                            showContactInfo: true,
                            isSuspended: false,
                          });
                          setInlineEditingUserId(null);
                          setShowUserForm(!showUserForm);
                        }}
                        className="bg-[var(--color-primary)] hover:bg-black text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <i
                          className={`fa-solid ${showUserForm ? "fa-xmark" : "fa-user-plus"}`}
                        ></i>{" "}
                        {showUserForm
                          ? "Abbrechen"
                          : "Neues Mitglied hinzufügen"}
                      </button>
                    </div>

                    {/* Inline Add Form */}
                    {showUserForm && (
                      <div className="bg-white p-6 rounded-2xl border-none space-y-6 shadow-sm animate-in fade-in slide-in-from-top-4 mb-6 text-left">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2 text-[var(--color-primary)] font-black text-xs uppercase tracking-wider">
                            <i className="fa-solid fa-user-plus text-sm"></i>
                            <span>Neues Mitglied hinzufügen</span>
                          </div>
                        </div>

                        {/* Profilbild & Avatar (Hard-Bandwidth-Protection & 0-Byte Fallback) */}
                        <AvatarUploader
                          user={editingUser}
                          userId={editingUser.id || editingUser.name || "new_user"}
                          avatarUrl={editingUser.avatarUrl}
                          avatarIcon={editingUser.avatarIcon}
                          onChange={({ avatarUrl, avatarIcon }) => {
                            setEditingUser((prev) => ({
                              ...prev,
                              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
                              ...(avatarIcon !== undefined ? { avatarIcon } : {}),
                            }));
                          }}
                        />

                        {/* 1. PERSÖNLICHE DATEN */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-address-card text-[11px]"></i>
                            1. Persönliche Daten (Pflichtfelder)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Vorname <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={editingUser.firstName || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    firstName: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                placeholder="Z.B. Max"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Nachname <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={editingUser.lastName || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    lastName: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50 focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm outline-none text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                placeholder="Z.B. Mustermann"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Geschlecht <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={editingUser.gender || "m"}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    gender: e.target.value as "m" | "w",
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 bg-slate-50 focus:bg-white rounded-xl outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer text-sm text-slate-800 font-sans font-medium"
                              >
                                <option value="m">männlich</option>
                                <option value="w">weiblich</option>
                              </select>
                            </div>
                            <div>
                              <label className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <span>Geburtsdatum</span>
                                {editingUser.birthDate && calculateAge(editingUser.birthDate) !== null && (
                                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    {calculateAge(editingUser.birthDate)} J. {calculateAge(editingUser.birthDate)! < 18 ? "(Jugend/U18)" : "(Erwachsen)"}
                                  </span>
                                )}
                              </label>
                              <input
                                type="date"
                                min="1900-01-01"
                                max="2099-12-31"
                                value={editingUser.birthDate || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.length <= 10) {
                                    setEditingUser({
                                      ...editingUser,
                                      birthDate: val,
                                    });
                                  }
                                }}
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm text-slate-800"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. KONTAKTINFORMATIONEN */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-address-book text-[11px]"></i>
                            2. Kontaktinformationen (Optional)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  E-Mail-Adresse {!editingUser.is_placeholder_email && <span className="text-red-500">*</span>}
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!editingUser.is_placeholder_email}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setEditingUser({
                                        ...editingUser,
                                        is_placeholder_email: checked,
                                        email: checked ? "" : editingUser.email,
                                      });
                                    }}
                                    className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                  <span className="text-[10px] font-bold text-slate-600">
                                    Keine E-Mail vorhanden
                                  </span>
                                </label>
                              </div>
                              <input
                                type="email"
                                disabled={!!editingUser.is_placeholder_email}
                                value={editingUser.is_placeholder_email ? "" : (editingUser.email || "")}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    email: e.target.value,
                                    is_placeholder_email: false,
                                  })
                                }
                                required={!editingUser.is_placeholder_email}
                                className={`w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-[var(--color-primary)] transition-all text-sm ${
                                  editingUser.is_placeholder_email
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                    : "bg-slate-50 focus:bg-white text-slate-800"
                                }`}
                                placeholder={editingUser.is_placeholder_email ? "[Keine E-Mail hinterlegt]" : "name@beispiel.de"}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Telefonnummer <span className="text-slate-400 font-normal normal-case">(optional)</span>
                              </label>
                              <input
                                type="tel"
                                value={editingUser.phone || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    phone: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                placeholder="+49 170 1234567"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. ZUGANGSDATEN & PASSWORT */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-key text-[11px]"></i>
                            3. Zugangsdaten & Passwort
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Benutzername (Login) <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={editingUser.name || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    name: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                placeholder="z. B. maxmustermann"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Rolle <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={editingUser.role || Role.USER}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    role: e.target.value as Role,
                                  })
                                }
                                className="w-full h-10 px-3 py-2 border-2 border-slate-200 bg-slate-50 focus:bg-white rounded-xl outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer text-sm text-slate-800 font-sans font-medium"
                              >
                                <option value={Role.MITGLIED}>Mitglied (Standard)</option>
                                <option value={Role.ADMIN}>Vereins-Administrator</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Passwort <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingUser.password || ""}
                                  onChange={(e) =>
                                    setEditingUser({
                                      ...editingUser,
                                      password: e.target.value,
                                      mustChangePassword: false,
                                    })
                                  }
                                  className="flex-1 h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm font-mono text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  placeholder="Passwort eingeben..."
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                                    let pwd = "";
                                    for (let i = 0; i < 8; i++) {
                                      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                                    }
                                    setEditingUser({
                                      ...editingUser,
                                      password: pwd,
                                      mustChangePassword: true,
                                    });
                                  }}
                                  className="h-10 px-4 bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs rounded-xl hover:bg-[var(--color-primary)]/20 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                                  title="Einmal-Passwort generieren"
                                >
                                  <i className="fa-solid fa-key"></i>
                                  <span>Generieren</span>
                                </button>
                              </div>
                              {editingUser.mustChangePassword && (
                                <p className="text-[10px] text-amber-600 mt-1.5 font-bold flex items-center gap-1">
                                  <i className="fa-solid fa-circle-info text-[9px]"></i>
                                  Benutzer wird beim nächsten Login zur Passwortänderung aufgefordert.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4. PRIVATSPHÄRE & APP-ANZEIGE */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-user-shield text-[11px]"></i>
                            4. Privatsphäre & App-Anzeige
                          </h4>
                          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
                            <label className="flex items-center gap-3 cursor-pointer group select-none">
                              <input
                                type="checkbox"
                                checked={editingUser.showContactInfo !== false}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    showContactInfo: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 block">
                                  Kontaktdaten freigeben
                                </span>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  Meine E-Mail und Telefonnummer in Börse/Rangliste für Vereinsmitglieder anzeigen
                                </span>
                              </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group select-none">
                              <input
                                type="checkbox"
                                id="user-form-onboarding-pending"
                                checked={!!editingUser.onboarding_pending}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    onboarding_pending: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)]"
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 block flex items-center gap-1.5">
                                  <span>Onboarding ausstehend</span>
                                  {editingUser.onboarding_pending && (
                                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                      Aktiv
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  Beim nächsten Login des Mitglieds wird das Onboarding-Modal automatisch angezeigt
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Background Duplicate Check Info Box */}
                        {liveDuplicateCandidates.length > 0 && !inlineEditingUserId && (
                          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in duration-200 my-2">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 text-sm font-bold shadow-xs">
                                <i className="fa-solid fa-user-shield"></i>
                              </div>
                              <div className="space-y-0.5">
                                <h5 className="font-extrabold text-amber-950 text-xs sm:text-sm leading-tight">
                                  Ein Benutzer mit diesem Namen / dieser E-Mail existiert bereits im Ligasystem.
                                </h5>
                                <p className="text-[11px] text-amber-800 font-medium">
                                  Es wurde eine Übereinstimmung mit einem bestehenden Benutzerkonto gefunden.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2.5 pt-1">
                              {liveDuplicateCandidates.map((cand) => (
                                <div
                                  key={cand.personId}
                                  className="bg-white border border-amber-200 rounded-xl p-3 space-y-2.5 shadow-xs"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <span className="font-extrabold text-slate-900 text-xs block">
                                        {cand.firstName} {cand.lastName}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        System-ID: {cand.personId}
                                      </span>
                                    </div>

                                    {cand.hasAdminInOtherClub && (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/90 border border-amber-300 rounded-lg text-amber-950 font-bold text-[10px]">
                                        <i className="fa-solid fa-shield-halved text-amber-600"></i>
                                        <span>Hinweis: Dieser Benutzer ist in einem anderen Verein als Administrator registriert.</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await addExistingPersonToClub(
                                            cand.personId,
                                            currentClubId,
                                            Role.MITGLIED
                                          );
                                          setMessage({
                                            text: `Bestehender Benutzer "${cand.firstName} ${cand.lastName}" wurde erfolgreich mit diesem Verein verknüpft (Standard-Rolle: Mitglied).`,
                                            type: "success",
                                          });
                                          setEditingUser({
                                            name: "",
                                            password: "",
                                            role: Role.USER,
                                            gender: "m",
                                            firstName: "",
                                            lastName: "",
                                            email: "",
                                            phone: "",
                                            birthDate: "",
                                            showContactInfo: true,
                                            isSuspended: false,
                                          });
                                          setShowUserForm(false);
                                          setLiveDuplicateCandidates([]);
                                        } catch (err: any) {
                                          setMessage({
                                            text: err.message || "Fehler beim Verknüpfen des Benutzers.",
                                            type: "error",
                                          });
                                        }
                                      }}
                                      className="flex-1 bg-[#1b4332] hover:bg-[#153326] text-white px-3 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <i className="fa-solid fa-link text-emerald-300"></i>
                                      Bestehenden Benutzer zum Verein einladen / verknüpfen (Empfohlen)
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLiveDuplicateCandidates([]);
                                        handleSaveUser(true);
                                      }}
                                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors border border-slate-200 text-center cursor-pointer"
                                    >
                                      Trotzdem neues Profil anlegen
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-3 justify-end border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowUserForm(false)}
                            className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveUser()}
                            className="px-8 bg-[var(--color-primary)] text-white hover:bg-black rounded-xl uppercase tracking-wide shadow-md transition-all active:scale-95 flex items-center gap-2 h-10 text-xs font-black cursor-pointer"
                          >
                            <i className="fa-solid fa-user-plus"></i>
                            <span>Mitglied hinzufügen</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search Bar & Sorting */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-grow">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="text"
                          placeholder="Mitglieder durchsuchen (Name oder Rolle)..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] outline-none text-sm transition-all shadow-sm py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                        />
                        {userSearchQuery && (
                          <button
                            onClick={() => setUserSearchQuery("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-1.5 shrink-0 self-start sm:self-auto">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 pl-1">
                          <i className="fa-solid fa-arrow-down-a-z text-[11px]"></i>{" "}
                          Sortieren:
                        </span>
                        <div className="flex gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setUserSortBy("alphabetical")}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200 select-none cursor-pointer ${
                              userSortBy === "alphabetical"
                                ? "bg-white text-[var(--color-primary)] shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            A-Z
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserSortBy("role")}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200 select-none cursor-pointer ${
                              userSortBy === "role"
                                ? "bg-white text-[var(--color-primary)] shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Nach Typ
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setUserSortOrder((prev) =>
                            prev === "asc" ? "desc" : "asc",
                          )
                        }
                        title={
                          userSortOrder === "asc"
                            ? "Aufsteigend sortieren"
                            : "Absteigend sortieren"
                        }
                        className="flex items-center gap-1.5 bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 rounded-xl h-10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 cursor-pointer shadow-sm active:scale-95 transition-all self-start sm:self-auto h-[48px]"
                      >
                        {userSortOrder === "asc" ? (
                          <>
                            <i className="fa-solid fa-arrow-up-wide-short text-[11px] text-[var(--color-accent)]"></i>
                            <span>Aufst.</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-arrow-down-wide-short text-[11px] text-[var(--color-accent)]"></i>
                            <span>Abst.</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* User List */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-[var(--color-primary)]">
                        <div className="col-span-2">Rolle</div>
                        <div className="col-span-7">
                          Vollständiger Name / Login
                        </div>
                        <div className="col-span-3 text-right">Aktionen</div>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {paginatedUsers.map((u, idx) => {
                          const isEditingInline =
                            inlineEditingUserId === u.name;
                          if (isEditingInline) {
                            return (
                              <div
                                key={u.id || u.name + "-" + idx}
                                className="p-5 bg-emerald-50/40 border-2 border-[#10b981]/30 rounded-2xl my-3 space-y-5 animate-in zoom-in-95 duration-200 text-left shadow-sm"
                              >
                                <div className="flex justify-between items-center pb-3 border-b border-emerald-100">
                                  <div className="flex items-center gap-2 text-[var(--color-primary)] font-black text-xs uppercase tracking-wider">
                                    <i className="fa-solid fa-user-pen text-sm"></i>
                                    <span>Mitglied bearbeiten: {u.klarname || u.name}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setInlineEditingUserId(null)}
                                      className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-black uppercase text-[10px] tracking-wider text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                      Abbrechen
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveUser()}
                                      className="px-5 bg-[var(--color-primary)] text-white rounded-xl uppercase tracking-wide shadow-md hover:bg-black transition-colors py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <i className="fa-solid fa-floppy-disk"></i>
                                      <span>Sichern</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Profilbild & Avatar (Hard-Bandwidth-Protection & 0-Byte Fallback) */}
                                <AvatarUploader
                                  user={editingUser}
                                  userId={editingUser.id || editingUser.name || u.name}
                                  avatarUrl={editingUser.avatarUrl}
                                  avatarIcon={editingUser.avatarIcon}
                                  onChange={({ avatarUrl, avatarIcon }) => {
                                    setEditingUser((prev) => ({
                                      ...prev,
                                      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
                                      ...(avatarIcon !== undefined ? { avatarIcon } : {}),
                                    }));
                                  }}
                                />

                                {/* 1. PERSÖNLICHE DATEN */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-address-card text-[11px]"></i>
                                    1. Persönliche Daten (Pflichtfelder)
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Vorname <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editingUser.firstName || ""}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            firstName: e.target.value,
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] transition-all text-sm outline-none text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        placeholder="Z.B. Max"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Nachname <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editingUser.lastName || ""}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            lastName: e.target.value,
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-white focus:border-[var(--color-primary)] transition-all text-sm outline-none text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        placeholder="Z.B. Mustermann"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Geschlecht <span className="text-red-500">*</span>
                                      </label>
                                      <select
                                        value={editingUser.gender || "m"}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            gender: e.target.value as "m" | "w",
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer text-sm text-slate-800 font-sans font-medium"
                                      >
                                        <option value="m">männlich</option>
                                        <option value="w">weiblich</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        <span>Geburtsdatum</span>
                                        {editingUser.birthDate && calculateAge(editingUser.birthDate) !== null && (
                                          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                            {calculateAge(editingUser.birthDate)} J. {calculateAge(editingUser.birthDate)! < 18 ? "(Jugend/U18)" : "(Erwachsen)"}
                                          </span>
                                        )}
                                      </label>
                                      <input
                                        type="date"
                                        min="1900-01-01"
                                        max="2099-12-31"
                                        value={editingUser.birthDate || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val.length <= 10) {
                                            setEditingUser({
                                              ...editingUser,
                                              birthDate: val,
                                            });
                                          }
                                        }}
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl font-bold bg-white outline-none focus:border-[var(--color-primary)] transition-all text-sm text-slate-800"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* 2. KONTAKTINFORMATIONEN */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-address-book text-[11px]"></i>
                                    2. Kontaktinformationen (Optional)
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                          E-Mail-Adresse {!editingUser.is_placeholder_email && <span className="text-red-500">*</span>}
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={!!editingUser.is_placeholder_email}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setEditingUser({
                                                ...editingUser,
                                                is_placeholder_email: checked,
                                                email: checked ? "" : editingUser.email,
                                              });
                                            }}
                                            className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                          />
                                          <span className="text-[10px] font-bold text-slate-600">
                                            Keine E-Mail vorhanden
                                          </span>
                                        </label>
                                      </div>
                                      <input
                                        type="email"
                                        disabled={!!editingUser.is_placeholder_email}
                                        value={editingUser.is_placeholder_email ? "" : (editingUser.email || "")}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            email: e.target.value,
                                            is_placeholder_email: false,
                                          })
                                        }
                                        required={!editingUser.is_placeholder_email}
                                        className={`w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-[var(--color-primary)] transition-all text-sm ${
                                          editingUser.is_placeholder_email
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                            : "bg-white text-slate-800"
                                        }`}
                                        placeholder={editingUser.is_placeholder_email ? "[Keine E-Mail hinterlegt]" : "name@beispiel.de"}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Telefonnummer <span className="text-slate-400 font-normal normal-case">(optional)</span>
                                      </label>
                                      <input
                                        type="tel"
                                        value={editingUser.phone || ""}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            phone: e.target.value,
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-[var(--color-primary)] transition-all text-sm text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        placeholder="+49 170 1234567"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* 3. ZUGANGSDATEN & PASSWORT */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-key text-[11px]"></i>
                                    3. Zugangsdaten & Passwort
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Benutzername (Login) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editingUser.name || ""}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            name: e.target.value,
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 rounded-xl bg-white outline-none focus:border-[var(--color-primary)] transition-all text-sm text-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                        placeholder="z. B. maxmustermann"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Rolle <span className="text-red-500">*</span>
                                      </label>
                                      <select
                                        value={editingUser.role || Role.USER}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            role: e.target.value as Role,
                                          })
                                        }
                                        className="w-full h-10 px-3 py-2 border-2 border-slate-200 bg-white rounded-xl outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer text-sm text-slate-800 font-sans font-medium"
                                      >
                                        <option value={Role.MITGLIED}>Mitglied (Standard)</option>
                                        <option value={Role.ADMIN}>Vereins-Administrator</option>
                                      </select>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Passwort <span className="text-red-500">*</span>
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editingUser.password || ""}
                                          onChange={(e) =>
                                            setEditingUser({
                                              ...editingUser,
                                              password: e.target.value,
                                              mustChangePassword: false,
                                            })
                                          }
                                          disabled={u.name === "superadmin"}
                                          className={`flex-1 h-10 px-3 py-2 border-2 rounded-xl font-bold transition-all text-sm font-mono ${
                                            u.name === "superadmin"
                                              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                              : "bg-white border-slate-200 focus:border-[var(--color-primary)] text-slate-800"
                                          }`}
                                          placeholder="Passwort eingeben..."
                                          title={
                                            u.name === "superadmin"
                                              ? "Das Passwort des Super-Admins kann hier nicht geändert werden."
                                              : ""
                                          }
                                          required
                                        />
                                        {u.name !== "superadmin" && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                                              let pwd = "";
                                              for (let i = 0; i < 8; i++) {
                                                pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                                              }
                                              setEditingUser({
                                                ...editingUser,
                                                password: pwd,
                                                mustChangePassword: true,
                                              });
                                            }}
                                            className="h-10 px-4 bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs rounded-xl hover:bg-[var(--color-primary)]/20 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                                            title="Einmal-Passwort generieren"
                                          >
                                            <i className="fa-solid fa-key"></i>
                                            <span>Generieren</span>
                                          </button>
                                        )}
                                      </div>
                                      {editingUser.mustChangePassword && (
                                        <p className="text-[10px] text-amber-600 mt-1.5 font-bold flex items-center gap-1">
                                          <i className="fa-solid fa-circle-info text-[9px]"></i>
                                          Benutzer wird beim nächsten Login zur Passwortänderung aufgefordert.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 4. PRIVATSPHÄRE & APP-ANZEIGE */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-user-shield text-[11px]"></i>
                                    4. Privatsphäre & App-Anzeige
                                  </h4>
                                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                                      <input
                                        type="checkbox"
                                        checked={editingUser.showContactInfo !== false}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            showContactInfo: e.target.checked,
                                          })
                                        }
                                        className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      />
                                      <div>
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 block">
                                          Kontaktdaten freigeben
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-medium">
                                          Meine E-Mail und Telefonnummer in Börse/Rangliste für Vereinsmitglieder anzeigen
                                        </span>
                                      </div>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                                      <input
                                        type="checkbox"
                                        id="inline-user-onboarding-pending"
                                        checked={!!editingUser.onboarding_pending}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            onboarding_pending: e.target.checked,
                                          })
                                        }
                                        className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] accent-[var(--color-primary)]"
                                      />
                                      <div>
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 block flex items-center gap-1.5">
                                          <span>Onboarding ausstehend</span>
                                          {editingUser.onboarding_pending && (
                                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                              Aktiv
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-medium">
                                          Beim nächsten Login des Mitglieds wird das Onboarding-Modal automatisch angezeigt
                                        </span>
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                {/* 5. SYSTEM & KONTO-STATUS */}
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-shield-halved text-[11px]"></i>
                                    5. System & Konto-Status
                                  </h4>
                                  <div className="bg-red-50/80 p-3.5 rounded-xl border border-red-200/80">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={!!editingUser.isSuspended}
                                        onChange={(e) =>
                                          setEditingUser({
                                            ...editingUser,
                                            isSuspended: e.target.checked,
                                          })
                                        }
                                        className="w-4 h-4 text-red-600 bg-white border-red-300 rounded focus:ring-red-600 accent-red-600 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                      />
                                      <div>
                                        <span className="text-xs font-bold text-red-700 block">
                                          Benutzerkonto sperren (Login verhindern)
                                        </span>
                                        <span className="text-[10px] text-red-600/80 block font-medium">
                                          Der Benutzer kann sich vorübergehend nicht mehr im System anmelden.
                                        </span>
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-3 justify-end border-t border-emerald-100">
                                  <button
                                    type="button"
                                    onClick={() => setInlineEditingUserId(null)}
                                    className="px-5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
                                  >
                                    Abbrechen
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveUser()}
                                    className="px-6 bg-[var(--color-primary)] text-white hover:bg-black rounded-xl uppercase tracking-wide shadow-md transition-all active:scale-95 flex items-center gap-2 h-10 text-xs font-black cursor-pointer"
                                  >
                                    <i className="fa-solid fa-floppy-disk"></i>
                                    <span>Änderungen sichern</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={u.id || u.name + "-" + idx}
                              className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors"
                            >
                              <div className="md:col-span-2 flex flex-col gap-1 items-start">
                                <span
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-white ${u.role === Role.ADMIN ? "bg-[var(--color-accent)]" : "bg-slate-400"}`}
                                >
                                  {u.role === Role.ADMIN ? "Admin" : "Mitglied"}
                                </span>
                                {u.isSuspended && (
                                  <span className="px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest text-white bg-red-600">
                                    <i className="fa-solid fa-lock mr-1"></i>{" "}
                                    Gesperrt
                                  </span>
                                )}
                              </div>
                              <div
                                className={`md:col-span-7 text-base font-semibold break-words flex items-center gap-3 ${u.isSuspended ? "text-slate-400 line-through" : "text-slate-800"}`}
                              >
                                <UserAvatar user={u} size="md" />
                                <div className="flex flex-col justify-center min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>
                                      {u.lastName || u.firstName
                                        ? `${u.lastName || ""}, ${u.firstName || ""}`
                                            .trim()
                                            .replace(/^,|,$/, "")
                                        : u.name}
                                    </span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      u.gender === "w"
                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                  >
                                    {u.gender === "w" ? "♀ Damen" : "♂ Herren"}
                                  </span>
                                  {(() => {
                                    const age = calculateAge(u.birthDate);
                                    if (age !== null) {
                                      return (
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            age < 18
                                              ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold"
                                              : "bg-slate-100 text-slate-700 border border-slate-200"
                                          }`}
                                          title={`Geburtsdatum: ${u.birthDate}`}
                                        >
                                          <i className="fa-solid fa-cake-candles text-[9px] text-amber-600"></i>
                                          {age} J. {age < 18 ? `(U${age < 14 ? "14" : "18"})` : ""}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-50 text-slate-400 border border-slate-200/60"
                                        title="Kein Geburtsdatum gepflegt. Für U18-Ligen erforderlich."
                                      >
                                        <i className="fa-regular fa-calendar text-[8px]"></i>
                                        Kein Alter
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="text-xs text-slate-400 font-normal mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span>
                                    Login:{" "}
                                    <span className="font-semibold text-slate-700 bg-slate-100 rounded px-1">
                                      {u.name}
                                    </span>
                                  </span>
                                  {u.is_placeholder_email || (u.email && u.email.startsWith("no-email.") && u.email.endsWith("@internal.app")) ? (
                                    <span className="text-slate-400 italic">• [Keine E-Mail hinterlegt]</span>
                                  ) : u.email ? (
                                    <span>• {u.email}</span>
                                  ) : (
                                    <span className="text-slate-400 italic">• [Keine E-Mail hinterlegt]</span>
                                  )}
                                  {u.onboarding_pending && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200" title="Onboarding beim nächsten Login erforderlich">
                                      <i className="fa-solid fa-user-clock text-[9px]"></i>
                                      Onboarding ausstehend
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-md px-1.5 py-0.5 shadow-sm">
                                    <span className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                      Passwort:
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-slate-800">
                                      {revealedPasswords[u.name]
                                        ? u.password || "Keins"
                                        : "••••••••"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRevealedPasswords((prev) => ({
                                          ...prev,
                                          [u.name]: !prev[u.name],
                                        }));
                                      }}
                                      className="text-slate-400 hover:text-slate-700 focus:outline-none cursor-pointer p-0.5 rounded transition-colors"
                                      title={
                                        revealedPasswords[u.name]
                                          ? "Passwort verbergen"
                                          : "Passwort anzeigen"
                                      }
                                    >
                                      <i
                                        className={`fa-solid ${revealedPasswords[u.name] ? "fa-eye-slash" : "fa-eye"} text-[10px]`}
                                      ></i>
                                    </button>
                                  </span>
                                </div>
                              </div>
                            </div>
                              <div className="md:col-span-3 flex justify-end items-center gap-1.5">
                                {((u.id !== currentUser.id &&
                                  u.name !== currentUser.name) ||
                                  (currentUser.id &&
                                    currentUser.id.startsWith(
                                      "temp-admin-",
                                    ))) &&
                                  onActAsUser && (
                                    <button
                                      type="button"
                                      onClick={() => onActAsUser(u)}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-emerald-200 shadow-sm active:scale-95"
                                      title={`${u.name} aktivieren`}
                                    >
                                      <i className="fa-solid fa-user-secret"></i>{" "}
                                      Agieren
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser({
                                      ...u,
                                      showContactInfo: u.showContactInfo !== false,
                                      onboarding_pending: !!u.onboarding_pending,
                                      gender: u.gender || "m",
                                    });
                                    setInlineEditingUserId(u.name);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center shadow-sm shrink-0"
                                  title="Bearbeiten"
                                >
                                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.name)}
                                  className="w-8 h-8 rounded-lg bg-slate-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm shrink-0"
                                  title="Löschen"
                                >
                                  <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {sortedAndFilteredUsers.length === 0 && (
                          <div className="p-8 text-center text-slate-400 font-bold text-sm">
                            Keine Mitglieder gefunden{" "}
                            {userSearchQuery && `für "${userSearchQuery}"`}
                          </div>
                        )}
                      </div>

                      {totalUserPages > 1 && (
                        <div className="flex justify-between items-center bg-slate-50 h-8 px-3 py-1 border-t border-slate-100 font-sans font-medium">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Seite {userPage} von {totalUserPages} (
                            {sortedAndFilteredUsers.length} Mitglieder gesamt)
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={userPage === 1}
                              onClick={() =>
                                setUserPage((prev) => Math.max(prev - 1, 1))
                              }
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                            >
                              <i className="fa-solid fa-chevron-left mr-1"></i>{" "}
                              Zurück
                            </button>
                            <button
                              type="button"
                              disabled={userPage === totalUserPages}
                              onClick={() =>
                                setUserPage((prev) =>
                                  Math.min(prev + 1, totalUserPages),
                                )
                              }
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                            >
                              Weiter{" "}
                              <i className="fa-solid fa-chevron-right ml-1"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CSV Mass Import */}
                  <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2">
                          <i className="fa-solid fa-file-import"></i>{" "}
                          Massenupload (CSV)
                        </h3>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={exportMembersCSV}
                            className="text-blue-800 uppercase border-b-2 border-blue-500 hover:bg-blue-50 px-2.5 py-1.5 transition-colors flex items-center gap-1.5 rounded-lg text-sm font-medium"
                            title="Aktuelle Mitgliederliste herunterladen"
                          >
                            Exportieren (CSV){" "}
                            <i className="fa-solid fa-file-csv text-blue-600"></i>
                          </button>
                          <button
                            type="button"
                            onClick={downloadTemplate}
                            className="text-[var(--color-primary)] uppercase border-b-2 border-orange-500 hover:bg-orange-50 px-2.5 py-1.5 transition-colors flex items-center gap-1.5 rounded-lg text-sm font-medium"
                          >
                            Muster Herunterladen{" "}
                            <i className="fa-solid fa-download text-orange-500"></i>
                          </button>
                        </div>
                      </div>

                      {importErrors.length > 0 && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-[10px] text-red-700 font-medium space-y-1">
                          <p className="font-extrabold uppercase text-red-800 flex items-center gap-1.5 mb-1 tracking-wider">
                            <i className="fa-solid fa-triangle-exclamation"></i>{" "}
                            Einige Zeilen wurden wegen Problemen skipped:
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-semibold">
                            {importErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="relative">
                        <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          id="csv-upload"
                        />
                        <label
                          htmlFor="csv-upload"
                          className={`flex flex-col items-center justify-center gap-4 w-full p-8 border-2 rounded-3xl hover:border-[var(--color-primary)] hover:bg-white transition-all cursor-pointer group bg-white/50 ${
                            selectedFileName
                              ? "border-[#10b981] bg-emerald-50 border-solid ring-4 ring-emerald-500/10"
                              : "border-dashed border-slate-300"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              selectedFileName
                                ? "fa-file-circle-check text-[#10b981] animate-bounce"
                                : "fa-cloud-arrow-up text-slate-400 group-hover:text-[var(--color-primary)]"
                            } text-3xl`}
                          ></i>
                          <div className="text-center">
                            <span
                              className={`block font-black text-[10px] uppercase tracking-widest ${
                                selectedFileName
                                  ? "text-[#10b981]"
                                  : "text-slate-500 group-hover:text-[var(--color-primary)]"
                              }`}
                            >
                              {selectedFileName
                                ? "✓ DATEI ERFOLGREICH GEWÄHLT"
                                : "Mitglieder-CSV zur Einrichtung hochladen"}
                            </span>
                            {selectedFileName && (
                              <span className="block mt-1.5 text-xs text-slate-700 font-extrabold uppercase tracking-tight">
                                {selectedFileName}
                              </span>
                            )}
                          </div>
                        </label>
                      </div>

                      {csvPreview.length > 0 && (
                        <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm animate-in zoom-in duration-300">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-3">
                            {csvPreview.length} gültige Mitgliederzeilen erkannt
                          </p>
                          <button
                            type="button"
                            onClick={importUsers}
                            className="w-full bg-[var(--color-primary)] text-white hover:bg-black rounded-xl uppercase tracking-wide shadow-md active:scale-95 transition-all flex items-center justify-center h-10 text-sm font-semibold"
                          >
                            Import Jetzt Starten
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-[var(--color-accent-3)]/10 border border-[var(--color-accent-3)]/20 rounded-2xl text-[9px] font-bold text-slate-600 mt-6 leading-relaxed">
                      <p className="uppercase font-black text-[var(--color-primary)] mb-1">
                        <i className="fa-solid fa-lightbulb"></i> CSV-IMPORT
                        FORMAT HINWEIS
                      </p>
                      Die Datei muss eine Tabellen-CSV sein mit dem Header{" "}
                      <code className="bg-white/70 px-1 py-0.5 rounded text-black">
                        Benutzername;Passwort;Rolle;Vorname;Nachname;Email;Telefon;Geschlecht
                      </code>{" "}
                      (Spaltentrennung via Komma oder Semikolon). Als Rolle sind{" "}
                      <code className="bg-white/70 px-1 py-0.5 rounded text-black">
                        user
                      </code>{" "}
                      und{" "}
                      <code className="bg-white/70 px-1 py-0.5 rounded text-black">
                        admin
                      </code>{" "}
                      erlaubt.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: MITGLIEDER-ONBOARDING */}
              {currentTab === "onboarding" && (
                <div className="animate-in fade-in duration-300">
                  <AdminOnboardingTab
                    settings={settings}
                    currentClubId={currentClubId}
                    users={users}
                    onUpdateSettings={onUpdateSettings}
                    onUpdateUsers={onUpdateUsers}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {/* TAB 5: DATENVERWALTUNG */}
              {currentTab === "database" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  {/* EINZELNE BUCHUNGEN VERWALTEN (APPOINTMENTS MANAGER) */}
                  <div className="w-full bg-slate-50 border border-slate-200 p-6 sm:p-8 rounded-[1.25rem] space-y-6 shadow-none">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex gap-4 items-center">
                        <div className="text-left">
                          <h3 className="text-lg font-bold text-[var(--color-primary)] uppercase flex items-center gap-2">
                            <i className="fa-solid fa-calendar-check"></i> Einzelne Termine & Buchungen verwalten
                          </h3>
                          <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                            Reservierte Stunden & Sperren ansehen, bearbeiten
                            oder löschen
                          </p>
                        </div>
                      </div>

                      {/* Summary Metric */}
                      <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Gesamt: {filteredAppointments.length} Einträge
                      </div>
                    </div>

                    {/* Search & Filter Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      {/* Search query */}
                      <div className="md:col-span-5 space-y-1 text-left">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">
                          Termine durchsuchen
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            value={bookingSearchQuery}
                            onChange={(e) =>
                              setBookingSearchQuery(e.target.value)
                            }
                            placeholder="Spieler, Plätze, Kommentare, Datum..."
                            className="w-full pl-8 pr-4 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-emerald-600 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <i className="fa-solid fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
                        </div>
                      </div>

                      {/* Filter by Type */}
                      <div className="md:col-span-4 space-y-1 text-left">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">
                          Kategorie / Zeitraum
                        </label>
                        <select 
                          value={bookingFilterType}
                          onChange={(e: any) =>
                            setBookingFilterType(e.target.value)
                          }
                          className="w-full px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 outline-none focus:border-emerald-600 cursor-pointer py-2 font-sans font-medium"
                        >
                          <option value="all">Alle Belegungen</option>
                          <option value="future">Nur Zukünftige</option>
                          <option value="past">Nur Vergangene</option>
                          <option value="bookings">
                            Nur Spieltermine (Mitglieder)
                          </option>
                          <option value="locks">Nur Platz-Sperrungen</option>
                        </select>
                      </div>

                      {/* Filter by Court */}
                      <div className="md:col-span-3 space-y-1 text-left">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">
                          Spezifischer Platz
                        </label>
                        <select 
                          value={bookingFilterCourt}
                          onChange={(e) =>
                            setBookingFilterCourt(e.target.value)
                          }
                          className="w-full px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 outline-none focus:border-emerald-600 cursor-pointer py-2 font-sans font-medium"
                        >
                          <option value="all">Alle Plätze</option>
                          {settings.courts?.map((court) => (
                            <option key={court} value={court}>
                              {court}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Appointments List */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {/* Table header (hidden on mobile) */}
                      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-black text-[9px] uppercase tracking-wider text-slate-600 text-left">
                        <div className="col-span-3">Datum & Uhrzeit</div>
                        <div className="col-span-2">Platz</div>
                        <div className="col-span-5">Spielbelegung Details</div>
                        <div className="col-span-2 text-right">Aktionen</div>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {paginatedAppointments.map((bk) => {
                          const dateFmt = new Date(bk.date).toLocaleDateString(
                            "de-DE",
                            {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          );

                          // Identify creator
                          const creatorUser = bk.bookedBy ? users[bk.bookedBy] : null;
                          const creatorName = creatorUser ? formatPlayerName(creatorUser.name) : "Unbekannt";

                          return (
                            <div
                              key={bk.id}
                              className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-12 gap-3 hover:bg-slate-50/50 transition-colors items-center text-left"
                            >
                              {/* Date and time column */}
                              <div className="col-span-3 flex flex-col justify-center">
                                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                  <i className="fa-regular fa-calendar text-emerald-600"></i>{" "}
                                  {dateFmt}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 font-extrabold tracking-tight mt-1">
                                  <i className="fa-regular fa-clock"></i>{" "}
                                  {bk.time} Uhr
                                </span>
                              </div>

                              {/* Court column */}
                              <div className="col-span-2 md:block flex justify-between items-center bg-slate-50 md:bg-transparent px-2 py-1 md:p-0 rounded-lg">
                                <span className="block md:hidden text-[9px] font-black uppercase text-slate-400">
                                  Platz
                                </span>
                                <span className="font-bold text-xs text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider text-[10px]">
                                  {bk.court}
                                </span>
                              </div>

                              {/* Details column (Players or Lock description) */}
                              <div className="col-span-5 space-y-1.5 text-left py-2 md:py-0">
                                {bk.isLocked ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                                      <i className="fa-solid fa-lock"></i>{" "}
                                      Adminsperrung
                                    </span>
                                    <p className="text-xs font-black text-rose-800 uppercase mt-1 tracking-wide">
                                      {bk.reason || "Platz gesperrt"}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <i className="fa-solid fa-users"></i>{" "}
                                      Spielbelegung
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {bk.players && bk.players.length > 0 ? (
                                        bk.players.map((p, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-block bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-semibold"
                                          >
                                            {formatPlayerName(p)}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">
                                          Keine Spieler eingetragen
                                        </span>
                                      )}
                                    </div>
                                    {creatorName && (
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                        Gebucht von: {creatorName}
                                      </p>
                                    )}
                                    {bk.hasBallMachine && (
                                      <div className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest text-[#10b981] bg-emerald-500/10 px-1.5 py-0.5 rounded-md mt-1">
                                        <i className="fa-solid fa-microchip"></i>{" "}
                                        Mit Ballmaschine
                                      </div>
                                    )}
                                    {bk.comment && (
                                      <p className="text-[10px] font-bold text-slate-500 leading-normal italic mt-1 border-l-2 border-slate-300 pl-1.5">
                                        "{bk.comment}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Actions column */}
                              <div className="col-span-2 flex justify-end gap-1.5 items-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStartEditAdminBooking(bk)
                                  }
                                  className="w-8 h-8 rounded-lg bg-slate-100 text-blue-600 hover:bg-[var(--color-primary)] hover:text-white transition-all flex items-center justify-center shadow-sm shrink-0 active:scale-95 cursor-pointer"
                                  title="Termin bearbeiten"
                                >
                                  <i className="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteAdminBooking(bk.id)
                                  }
                                  className="w-8 h-8 rounded-lg bg-rose-50 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm shrink-0 active:scale-95 border border-red-100 cursor-pointer"
                                  title="Termin löschen"
                                >
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {paginatedAppointments.length === 0 && (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs italic">
                            Keine Reservierungen oder Termine für die
                            Filterkriterien gefunden.
                          </div>
                        )}
                      </div>

                      {/* Pagination control block */}
                      {bkTotalPages > 1 && (
                        <div className="flex justify-between items-center bg-slate-50 h-8 px-3 py-1 border-t border-slate-100 font-sans font-medium">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">
                            Seite {bookingPage} von {bkTotalPages} (
                            {filteredAppointments.length} gefundene Termine)
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={bookingPage === 1}
                              onClick={() =>
                                setBookingPage((prev) => Math.max(prev - 1, 1))
                              }
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                            >
                              <i className="fa-solid fa-chevron-left mr-1"></i>{" "}
                              Zurück
                            </button>
                            <button
                              type="button"
                              disabled={bookingPage === bkTotalPages}
                              onClick={() =>
                                setBookingPage((prev) =>
                                  Math.min(prev + 1, bkTotalPages),
                                )
                              }
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                            >
                              Weiter{" "}
                              <i className="fa-solid fa-chevron-right ml-1"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EDIT SINGLE BOOKING MODAL */}
                  {editingAdminBooking && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
                      <div className="border-none outline-none bg-white rounded-2xl -200/80 shadow-sm w-full max-w-lg overflow-hidden animate-in zoom-in duration-300 -200 text-left my-8">
                        {/* Header */}
                        <div className="bg-[var(--color-primary)] p-6 text-white flex justify-between items-center">
                          <div className="text-left">
                            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                              <i className="fa-solid fa-edit"></i> Einzeltermin
                              bearbeiten
                            </h3>
                            <p className="text-[10px] font-bold opacity-85 mt-1 uppercase tracking-widest">
                              ID: {editingAdminBooking.id}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingAdminBooking(null)}
                            className="w-8 h-8 rounded-lg bg-emerald-990/40 flex items-center justify-center text-white hover:bg-black/30 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark text-lg"></i>
                          </button>
                        </div>

                        {/* Form body */}
                        <form
                          onSubmit={handleSaveAdminBooking}
                          className="p-6 sm:p-8 space-y-5 text-left"
                        >
                          {/* Booking/Lock Type Switcher Toggle */}
                          <div className="space-y-1.5 text-left">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              Typ der Belegung
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setEditBkIsLocked(false)}
                                className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                  !editBkIsLocked
                                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                <i className="fa-solid fa-users"></i>{" "}
                                Spieltermin
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditBkIsLocked(true)}
                                className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                  editBkIsLocked
                                    ? "bg-red-650 bg-red-600 text-white shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                <i className="fa-solid fa-lock"></i> Adminsperre
                              </button>
                            </div>
                          </div>

                          {/* Date, Time, Court Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                            {/* Date */}
                            <div className="space-y-1 text-left">
                              <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                Datum
                              </label>
                              <input 
                                type="date"
                                required
                                value={editBkDate}
                                onChange={(e) => setEditBkDate(e.target.value)}
                                className="w-full px-3 border-2 border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:border-emerald-600 text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            </div>

                            {/* Start Time */}
                            <div className="space-y-1 text-left">
                              <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                Uhrzeit
                              </label>
                              <select 
                                value={editBkTime}
                                onChange={(e) => setEditBkTime(e.target.value)}
                                className="w-full px-3 border-2 border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:border-emerald-600 cursor-pointer text-slate-800 py-2 font-sans font-medium"
                              >
                                {TIME_SLOTS.map((slot) => (
                                  <option key={slot} value={slot}>
                                    {slot} Uhr
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Court selection */}
                            <div className="space-y-1 text-left">
                              <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                Platz
                              </label>
                              <select 
                                value={editBkCourt}
                                onChange={(e) => setEditBkCourt(e.target.value)}
                                className="w-full px-3 border-2 border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:border-emerald-600 cursor-pointer text-slate-800 py-2 font-sans font-medium"
                              >
                                {settings.courts?.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* LOCK FIELDS (Is Locked) */}
                          {editBkIsLocked ? (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300 text-left">
                              <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                Sperrgrund{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input 
                                type="text"
                                required={editBkIsLocked}
                                value={editBkReason}
                                onChange={(e) =>
                                  setEditBkReason(e.target.value)
                                }
                                placeholder="z.B. Verbandspiel, Training, Platzpflege"
                                className="w-full px-3 border border-red-200 rounded-xl text-sm bg-white outline-none focus:border-red-500 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                            </div>
                          ) : (
                            /* USER BOOKING SPECIFIC FIELDS */
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 text-left">
                              {/* Players List with Suggestion Autocomplete */}
                              <div className="space-y-1.5 relative text-left">
                                <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                  Eingetragene Spieler ({editBkPlayers.length})
                                </label>

                                {/* Existing Players List visual tags */}
                                <div className="flex flex-wrap gap-1.5 p-2 border-2 border-slate-100 rounded-xl bg-slate-50/50 mb-2">
                                  {editBkPlayers.map((player, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg text-xs font-bold border border-emerald-100"
                                    >
                                      {player}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemovePlayerFromEditList(idx)
                                        }
                                        className="text-emerald-600 hover:text-red-600 font-extrabold focus:outline-none px-0.5 ml-1 cursor-pointer"
                                        title="Spieler entfernen"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                  {editBkPlayers.length === 0 && (
                                    <span className="text-[10px] text-slate-400 italic">
                                      Noch keine Spieler hinzugefügt.
                                    </span>
                                  )}
                                </div>

                                {/* Add player manual input / suggestion search */}
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={editBkNewPlayerQuery}
                                    onChange={(e) => {
                                      setEditBkNewPlayerQuery(e.target.value);
                                      setEditBkShowSuggestions(true);
                                    }}
                                    onFocus={() =>
                                      setEditBkShowSuggestions(true)
                                    }
                                    placeholder="Spielernamen eingeben oder suchen..."
                                    className="flex-1 px-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-600 text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddPlayerToEditList(
                                        editBkNewPlayerQuery,
                                      )
                                    }
                                    disabled={!editBkNewPlayerQuery.trim()}
                                    className="px-4 py-2 bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-[var(--color-primary)] disabled:opacity-40 select-none active:scale-95 transition-all cursor-pointer"
                                  >
                                    Hinzufügen
                                  </button>
                                </div>

                                {/* Suggestion list overlay */}
                                {editBkShowSuggestions &&
                                  editPlayerSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] overflow-hidden divide-y divide-slate-100">
                                      {editPlayerSuggestions.map((u, idx) => {
                                        const fullName =
                                          u.lastName || u.firstName
                                            ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                                            : u.name;
                                        return (
                                          <button
                                            key={u.id || u.name + "-" + idx}
                                            type="button"
                                            onClick={() =>
                                              handleAddPlayerToEditList(
                                                fullName,
                                              )
                                            }
                                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold text-slate-700 block transition-colors cursor-pointer"
                                          >
                                            {fullName}{" "}
                                            <span className="text-[9px] text-slate-400 font-normal italic">
                                              ({u.name})
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                              </div>

                              {/* Extra user details (Ballmachine & Comment) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-left">
                                {/* Comment */}
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                    Notiz / Kommentar
                                  </label>
                                  <input 
                                    type="text"
                                    value={editBkComment}
                                    onChange={(e) =>
                                      setEditBkComment(e.target.value)
                                    }
                                    placeholder="z.B. Gastspieler"
                                    className="w-full px-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-600 text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                  />
                                </div>

                                {/* Ballmachine usage */}
                                {(settings?.reservationRules
                                  ?.availableBallMachines ?? 1) > 0 && (
                                  <div className="flex items-center gap-3 pt-4 sm:pt-6">
                                    <input
                                      type="checkbox"
                                      id="editBkHasBallMachine"
                                      checked={editBkHasBallMachine}
                                      onChange={(e) =>
                                        setEditBkHasBallMachine(
                                          e.target.checked,
                                        )
                                      }
                                      className="w-4.5 h-4.5 text-emerald-600 border-2 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                    />
                                    <label
                                      htmlFor="editBkHasBallMachine"
                                      className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wide cursor-pointer user-select-none flex items-center gap-1.5"
                                    >
                                      <i className="fa-solid fa-microchip text-emerald-600 text-xs"></i>{" "}
                                      Ballmaschine nutzen
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Modal Footer Controls */}
                          <div className="pt-6 border-t border-slate-100 flex gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingAdminBooking(null)}
                              className="flex-1 border-2 border-slate-300 hover:border-slate-400 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest text-slate-600 transition-all text-center bg-white cursor-pointer"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="submit"
                              className={`flex-1 text-sm font-medium${ editBkIsLocked ? "bg-red-600 hover:bg-red-700 font-medium"
                                  : "bg-[var(--color-primary)] hover:bg-black font-medium"
                              }text-white py-2.5 rounded-xl uppercase tracking-widest shadow-md transition-all active:scale-95 text-center cursor-pointer flex items-center justify-center text-sm font-medium`}
                            >
                              <i className="fa-solid fa-save mr-1.5"></i>{" "}
                              Änderungen sichern
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* PUBLIC CALENDAR SHARE WIDGET */}
                  <div className="w-full bg-slate-50 border border-slate-200 p-6 sm:p-8 rounded-[1.25rem] space-y-6 shadow-none mt-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex gap-4 items-center">
                        <div className="text-left">
                          <h3 className="text-lg font-bold text-[var(--color-primary)] uppercase flex items-center gap-2">
                            <i className="fa-solid fa-share-nodes"></i> Öffentliche Wochenplan-Freigabe
                          </h3>
                          <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                            Kalender per iFrame auf Vereinswebsite einbetten
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 transition-colors">
                        <div className="text-left">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Öffentlichen Direktlink aktivieren
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase">
                            Schaltet den Zugriff ohne Login für externe Aufrufer frei.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input className="sr-only peer placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            checked={settings?.publicCalendar?.enabled || false}
                            onChange={(e) => {
                              let token = settings?.publicCalendar?.token;
                              if (e.target.checked && !token) {
                                // generate a random token
                                token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                              }
                              onUpdateSettings({
                                publicCalendar: {
                                  enabled: e.target.checked,
                                  showNames: settings?.publicCalendar?.showNames || false,
                                  token: token || "",
                                }
                              });
                              onDirtyChange?.();
                            }}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 transition-colors">
                        <div className="text-left">
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Spielernamen öffentlich anzeigen
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase">
                            {settings?.publicCalendar?.showNames ? (
                              <span className="text-orange-600 font-bold">DSGVO-Hinweis: Namen sind aktuell für jedermann sichtbar!</span>
                            ) : (
                              <span>Alle Buchungen werden als "Belegt" anonymisiert dargestellt.</span>
                            )}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input className="sr-only peer placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            checked={settings?.publicCalendar?.showNames || false}
                            onChange={(e) => {
                              onUpdateSettings({
                                publicCalendar: {
                                  enabled: settings?.publicCalendar?.enabled || false,
                                  showNames: e.target.checked,
                                  token: settings?.publicCalendar?.token || "",
                                }
                              });
                              onDirtyChange?.();
                            }}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                      </div>

                      {settings?.publicCalendar?.enabled && settings?.publicCalendar?.token ? (
                        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 space-y-4 text-left">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <label className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                                Öffentlicher Direktlink
                              </label>
                              <a
                                href={`${window.location.origin}/public/calendar/woche/${settings.publicCalendar.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                              >
                                Testen <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                              </a>
                            </div>
                            <input className="w-full h-8 px-3 py-1 bg-white border border-emerald-200 rounded-lg text-sm font-mono text-emerald-900 select-all outline-none placeholder: placeholder: placeholder: placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider mb-2">
                              HTML iFrame-Code zur Einbettung
                            </label>
                            <textarea
                              readOnly
                              rows={3}
                              value={`<iframe src="${window.location.origin}/public/calendar/woche/${settings.publicCalendar.token}" width="100%" height="800px" frameborder="0" style="border:none; border-radius:12px;"></iframe>`}
                              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-mono text-emerald-900 select-all outline-none resize-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-200 text-left text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-3">
                          <i className="fa-solid fa-eye-slash text-slate-400 text-base shrink-0"></i>
                          <p className="normal-case font-medium text-slate-500 text-xs">
                            Öffentliche Freigabe ist aktuell <span className="font-bold text-slate-700">deaktiviert</span>. Aktiviere den Schalter oben, um den Direktlink und iFrame-Code zu generieren.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SAFETY CLEANSING CARD */}
                  <div className="w-full bg-red-50/50 border-2 border-red-100 p-6 sm:p-8 rounded-[1.25rem] space-y-4 shadow-sm">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-red-700 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation text-red-600"></i> Sicherheits-Bereinigungen
                      </h3>
                      <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                        Datenlöschung & Wartungstasks
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 p-6 space-y-4 shadow-sm">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        Als Administrator kannst du Buchungszeiträume selektiv
                        löschen, um das System clean zu halten oder eine neue
                        Saison vorzubereiten.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal("bookings")}
                          className="w-full text-left p-4 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-xl hover:text-white transition-all group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <i className="fa-solid fa-calendar-xmark text-lg text-red-500 group-hover:text-white shrink-0"></i>
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              Reservierungen in Zeitraum bereinigen
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right text-xs opacity-50 group-hover:opacity-100 transition-opacity"></i>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowDeleteModal("users")}
                          className="w-full text-left p-4 bg-rose-50 hover:bg-red-600 border border-rose-200 hover:border-red-600 rounded-xl text-red-700 hover:text-white transition-all group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <i className="fa-solid fa-users-slash text-lg text-red-500 group-hover:text-white shrink-0"></i>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 group-hover:text-white">
                              Alle registrierten Mitglieder löschen
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right text-xs opacity-50 group-hover:opacity-100 transition-opacity"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOOKINGS EXPORT CARD */}
                  <div className="w-full bg-slate-100/50 border border-slate-200/80 p-6 sm:p-8 rounded-2xl space-y-4 shadow-sm mt-8">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[var(--color-accent-2)] uppercase flex items-center gap-2">
                        <i className="fa-solid fa-file-export"></i> Buchungsexport (CSV / JSON)
                      </h3>
                      <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                        Reservierungsdaten herunterladen
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 space-y-6 shadow-sm text-left">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        Exportieren Sie sämtliche im System hinterlegten
                        Reservierungen. Sie können optional einen Zeitraum
                        (von/bis Datum) angeben, um den Export einzugrenzen.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Von Datum (optional)
                          </label>
                          <input 
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                            className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-[var(--color-accent-2)] outline-none text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 font-bold">
                            Bis Datum (optional)
                          </label>
                          <input 
                            type="date"
                            value={exportEndDate}
                            onChange={(e) => setExportEndDate(e.target.value)}
                            className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-[var(--color-accent-2)] outline-none text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* RESET BUTTON */}
                      {(exportStartDate || exportEndDate) && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setExportStartDate("");
                              setExportEndDate("");
                            }}
                            className="text-[9px] font-black text-red-600 hover:text-red-800 uppercase tracking-wider flex items-center gap-1"
                          >
                            <i className="fa-solid fa-circle-xmark"></i>{" "}
                            Zeitraum zurücksetzen
                          </button>
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={exportBookingsCSV}
                          className="flex-1 bg-[var(--color-accent-2)] text-white hover:opacity-90 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 h-10 !text-sm font-medium"
                          style={{ fontSize: "14px" }}
                        >
                          <i className="fa-solid fa-file-csv text-[14px]"></i>
                          CSV-Export herunterladen
                        </button>
                        <button
                          type="button"
                          onClick={exportBookingsJSON}
                          className="flex-1 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 bg-white active:scale-95 h-10 !text-sm font-medium"
                          style={{ fontSize: "14px" }}
                        >
                          <i className="fa-solid fa-file-code text-[14px] text-blue-600"></i>
                          JSON-Export herunterladen
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOOKINGS IMPORT CARD */}
                  <div className="w-full bg-slate-100/50 border border-slate-200/80 p-6 sm:p-8 rounded-2xl space-y-4 shadow-sm mt-8">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[var(--color-primary)] uppercase flex items-center gap-2">
                        <i className="fa-solid fa-file-import"></i> Buchungsimport & Testdaten
                      </h3>
                      <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                        Reservierungsdaten einspielen & Dummydaten verwalten
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 space-y-6 shadow-sm text-left">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        Importieren Sie reservierte Stunden und Belegungen aus
                        einer vorherigen CSV- oder JSON-Sicherungsdatei.
                      </p>

                      <>
                        {importStatus === "idle" && (
                          <div className="space-y-4">
                            {/* Dropzone */}
                            <div
                              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/70 transition-all cursor-pointer hover:border-[var(--color-accent-2)]"
                              onClick={() =>
                                importFileInputRef.current?.click()
                              }
                            >
                              <input className="hidden p-2 placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 mb-2"></i>
                              <p className="text-xs font-bold text-slate-700">
                                CSV- oder JSON-Datei hier hochladen
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase">
                                Klicken, um Datei auszuwählen (*.csv, *.json)
                              </p>
                            </div>
                          </div>
                        )}

                        {importStatus === "parsing" && (
                          <div className="py-8 text-center space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-2)] mx-auto"></div>
                            <p className="text-xs font-bold text-slate-600">
                              Datei wird analysiert...
                            </p>
                          </div>
                        )}

                        {(importStatus === "ready" ||
                          importStatus === "importing" ||
                          importStatus === "success") && (
                          <div className="space-y-4">
                            <div className="p-4 bg-[var(--color-accent-2)]/5 border border-[var(--color-accent-2)]/10 rounded-xl space-y-2">
                              <h4 className="text-[11px] font-black text-[var(--color-accent-2)] uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-circle-info"></i>{" "}
                                Import-Vorschau
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="font-bold text-slate-400">
                                    Dateiname:
                                  </span>{" "}
                                  <span className="font-bold text-slate-700 block truncate">
                                    {importFile?.name || "Demo-Vorschau"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-400">
                                    Gefundene Buchungen:
                                  </span>{" "}
                                  <span className="font-bold text-slate-700 block text-lg">
                                    {importPreview.length}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {importStatus === "ready" && (
                              <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-left space-y-1">
                                  <h4 className="text-[11px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
                                    <i className="fa-solid fa-circle-check"></i>{" "}
                                    Import-Modus: Hinzufügen (Merge)
                                  </h4>
                                  <p className="text-[11px] font-bold text-emerald-700 leading-normal">
                                    Die geladenen {importPreview.length}{" "}
                                    Buchungseinträge werden in die leere
                                    Spieldatenbank eingepflegt.
                                  </p>
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImportStatus("idle");
                                      setImportFile(null);
                                      setImportPreview([]);
                                    }}
                                    className="flex-1 border-2 border-slate-300 text-slate-700 hover:border-slate-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest bg-white animate-in duration-100"
                                  >
                                    Abbrechen
                                  </button>
                                  <button
                                    type="button"
                                    onClick={runFileImport}
                                    className="flex-1 text-white rounded-xl uppercase tracking-wide shadow-md transition-all bg-[var(--color-accent-2)] hover:opacity-90 flex items-center justify-center h-10 text-sm font-semibold"
                                  >
                                    Import starten
                                  </button>
                                </div>
                              </div>
                            )}

                            {importStatus === "importing" && (
                              <div className="space-y-3 py-4">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                  <span>Importiere Daten...</span>
                                  <span>{importProgress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-[var(--color-accent-2)] h-full rounded-full transition-all duration-300"
                                    style={{ width: `${importProgress}%` }}
                                  ></div>
                                </div>
                                <p className="text-[10px] text-slate-400 text-center font-bold uppercase">
                                  Bitte haben Sie einen Moment Geduld – die
                                  Datenbank wird synchronisiert.
                                </p>
                              </div>
                            )}

                            {importStatus === "success" && (
                              <div className="space-y-4 text-center py-2">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm text-xl">
                                  <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-black text-slate-800 uppercase">
                                    Daten erfolgreich eingespielt!
                                  </h4>
                                  <p className="text-xs text-slate-500">
                                    {importPreview.length} Buchungen wurden
                                    geladen und stehen im Buchungskalender
                                    bereit.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImportStatus("idle");
                                    setImportFile(null);
                                    setImportPreview([]);
                                  }}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                                >
                                  Fertigstellen & Zurück
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {importStatus === "error" && (
                          <div className="space-y-4">
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-left space-y-1">
                              <h4 className="text-[11px] font-black uppercase text-red-800 tracking-wider flex items-center gap-1.5">
                                <i className="fa-solid fa-circle-exclamation"></i>{" "}
                                Import-Fehler
                              </h4>
                              <p className="text-xs font-bold text-red-700 leading-normal">
                                {importErrorMsg ||
                                  "Ein unbekannter Fehler ist beim Import aufgetreten."}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setImportStatus("idle");
                                setImportFile(null);
                                setImportPreview([]);
                              }}
                              className="w-full bg-slate-800 text-white hover:bg-slate-900 py-3 rounded-xl font-black uppercase text-xs tracking-widest"
                            >
                              Erneut versuchen
                            </button>
                          </div>
                        )}
                      </>
                    </div>
                  </div>

                  {/* PUBLIC JSON FEEDS MANAGEMENT CARD */}
                  <div className="w-full bg-slate-100/50 border border-slate-200/80 p-6 sm:p-8 rounded-2xl space-y-6 shadow-sm mt-8">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[var(--color-accent-2)] uppercase flex items-center gap-2">
                        <i className="fa-solid fa-share-nodes"></i> Öffentliche JSON-Feeds (Widget-Datenquellen)
                      </h3>
                      <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                        Live-Schnittstellen für Ihre Vereinswebsite & externe Kalender
                      </p>
                    </div>

                    <p className="text-xs font-bold text-slate-600 leading-relaxed text-left">
                      Konfigurieren Sie öffentliche, live aktualisierte Schnittstellen für Ihre Platzbelegung von der letzten Woche bis unbegrenzt in die Zukunft. Sobald eine Buchung im Kalender eingetragen oder geändert wird, aktualisieren sich diese Feeds vollkommen automatisch in Echtzeit.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 text-left">
                      {/* OPTION 1: ANONYMISED FEED */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 flex flex-col space-y-5 shadow-sm">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                              Option 1 (Anonymisiert)
                            </span>
                            
                            {/* Toggle Slider Switch */}
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={settings.feedAnonEnabled || false}
                                onChange={(e) => {
                                  onUpdateSettings({
                                    ...settings,
                                    feedAnonEnabled: e.target.checked,
                                  });
                                  setMessage({
                                    text: `Anonymisierter Feed wurde ${e.target.checked ? "aktiviert" : "deaktiviert"}.`,
                                    type: "success",
                                  });
                                }}
                                className="sr-only peer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800">
                            Anonymisierter Buchungs-Feed
                          </h4>
                          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                            Alle Namen Ihrer Vereinsmitglieder werden automatisch durch neutrale Platzhalter wie <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">Spieler 1</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">Spieler 2</code> ersetzt. Perfekt für öffentliche Club-Websites zum Datenschutz.
                          </p>
                        </div>

                        {settings.feedAnonEnabled ? (
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-bold">
                                REST-Schnittstellen URL
                              </label>
                              <div className="flex gap-2">
                                <input className="flex-1 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono text-slate-600 outline-none select-all cursor-text truncate p-2 text-sm placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(getPublicFeedURL());
                                    setLinkCopied(true);
                                    setTimeout(() => setLinkCopied(false), 2000);
                                  }}
                                  className={`${
                                    linkCopied ? "bg-emerald-600" : "bg-slate-800 hover:bg-slate-900"
                                  } text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 active:scale-95`}
                                >
                                  {linkCopied ? "Kopiert!" : "Kopieren"}
                                </button>
                                <a
                                  href={getPublicFeedURL()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 active:scale-95"
                                >
                                  Testen
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center">
                            <p className="text-xs font-semibold text-slate-400">
                              Dieser Feed ist aktuell ausgeschaltet.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* OPTION 2: CLEAR NAME FEED */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 flex flex-col space-y-5 shadow-sm">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                              Option 2 (Klarnamen)
                            </span>

                            {/* Toggle Slider Switch */}
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={settings.feedRealEnabled || false}
                                onChange={(e) => {
                                  onUpdateSettings({
                                    ...settings,
                                    feedRealEnabled: e.target.checked,
                                  });
                                  setMessage({
                                    text: `Klarnamen Feed wurde ${e.target.checked ? "aktiviert" : "deaktiviert"}.`,
                                    type: "success",
                                  });
                                }}
                                className="sr-only peer font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                            </label>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800">
                            Klarnamen Buchungs-Feed
                          </h4>
                          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                            Liefert die echten und vollständigen Namen der buchenden Mitglieder im JSON-Format aus. Empfohlen für passwortgeschützte interne Vereinsbereiche oder vertrauenswürdige Integrationen.
                          </p>
                        </div>

                        {settings.feedRealEnabled ? (
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-bold">
                                REST-Schnittstellen URL
                              </label>
                              <div className="flex gap-2">
                                <input className="flex-1 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono text-slate-600 outline-none select-all cursor-text truncate p-2 text-sm placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(getClearFeedURL());
                                    setLinkCopiedClear(true);
                                    setTimeout(() => setLinkCopiedClear(false), 2000);
                                  }}
                                  className={`${
                                    linkCopiedClear ? "bg-indigo-600" : "bg-slate-800 hover:bg-slate-900"
                                  } text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 active:scale-95`}
                                >
                                  {linkCopiedClear ? "Kopiert!" : "Kopieren"}
                                </button>
                                <a
                                  href={getClearFeedURL()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 active:scale-95"
                                >
                                  Testen
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl text-center">
                            <p className="text-xs font-semibold text-slate-400">
                              Dieser Feed ist aktuell ausgeschaltet.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* GLOBAL COLLECTION POLICIES CARD */}
                  <div className="w-full bg-slate-100/50 border border-slate-200/80 p-6 sm:p-8 rounded-2xl space-y-6 shadow-sm mt-8">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[var(--color-primary)] uppercase flex items-center gap-2">
                        <i className="fa-solid fa-user-shield"></i> Globale Erfassungs-Richtlinien
                      </h3>
                      <p className="text-xs font-medium text-slate-400 uppercase mt-0.5">
                        Steuerung der Erfassung von Kontaktdaten der Mitglieder
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200/60 space-y-6 shadow-sm text-left">
                      <p className="text-xs font-bold text-slate-600 leading-relaxed">
                        Hier können Sie festlegen, ob E-Mail-Adressen und Telefonnummern von Mitgliedern erfasst und angezeigt werden sollen.
                      </p>

                      <div className="space-y-4">
                        {/* Toggle Email Collection */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 transition-colors">
                          <div className="text-left">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                              E-Mail-Adressen erfassen
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">
                              Schaltet die Erfassung und Anzeige von E-Mail-Adressen für Mitglieder an oder aus.
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input className="sr-only peer placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              checked={settings.collectEmail !== false}
                              onChange={(e) => {
                                onUpdateSettings({
                                  ...settings,
                                  collectEmail: e.target.checked,
                                });
                                setMessage({
                                  text: `Erfassung von E-Mail-Adressen wurde ${e.target.checked ? "aktiviert" : "deaktiviert"}.`,
                                  type: "success",
                                });
                                onDirtyChange?.();
                              }}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                          </label>
                        </div>

                        {/* Toggle Phone Collection */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 transition-colors">
                          <div className="text-left">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                              Telefonnummern erfassen
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">
                              Schaltet die Erfassung und Anzeige von Telefonnummern für Mitglieder an oder aus.
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input className="sr-only peer placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              checked={settings.collectPhone !== false}
                              onChange={(e) => {
                                onUpdateSettings({
                                  ...settings,
                                  collectPhone: e.target.checked,
                                });
                                setMessage({
                                  text: `Erfassung von Telefonnummern wurde ${e.target.checked ? "aktiviert" : "deaktiviert"}.`,
                                  type: "success",
                                });
                                onDirtyChange?.();
                              }}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                          </label>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl text-left space-y-1">
                        <p className="text-[11px] font-medium text-amber-800 leading-normal font-sans">
                          Hinweis: Wenn Sie die Erfassung deaktivieren, werden diese Felder in der gesamten App für Mitglieder ausgeblendet. Bereits erfasste Daten bleiben in der Datenbank erhalten.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: MEISTERSCHAFT */}
              {currentTab === "championship" && (
                <ChampionshipAdminTab
                  clubId={currentClubId}
                  users={users}
                  currentUser={currentUser}
                  onNavigateToPlayerView={() => {
                    if (onNavigateToChampionship) {
                      onNavigateToChampionship();
                    }
                  }}
                />
              )}

              {/* TAB: VERANSTALTUNGEN */}
              {currentTab === "tournaments" && (
                <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200/80 gap-4 shadow-sm">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-[var(--color-primary)]">
                        <i className="fa-solid fa-calendar-days"></i>{" "}
                        Veranstaltungen verwalten
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Definieren Sie hier Turniere, Events oder andere
                        Aktivitäten. Spieler können sich direkt im Kalender-Menü
                        dafür an- und abmelden.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
                    {/* FORM COLUMN */}
                    <div className="lg:col-span-1 space-y-6">
                      <form
                        onSubmit={handleEventSubmit}
                        className="bg-slate-50 p-6 rounded-[1rem] border border-slate-200 shadow-sm space-y-5 text-left"
                      >
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)] border-b border-slate-200 pb-3 mb-2 flex items-center gap-1.5">
                          <i className="fa-solid fa-pen-to-square"></i>
                          {editingTournamentId
                            ? "Event bearbeiten"
                            : "Neues Event anlegen"}
                        </h4>

                        {/* Titel (Pflichtfeld) */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Name der Veranstaltung{" "}
                            <span className="text-red-500 font-bold">*</span>
                          </label>
                          <input 
                            type="text"
                            required
                            value={eventTitle}
                            onChange={(e) => setEventTitle(e.target.value)}
                            placeholder="z.B. Sommerfest, Schleiferlturnier"
                            className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[var(--color-primary)] py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        {/* Datum (Optional) */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Datum (optional)
                          </label>
                          <input 
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[var(--color-primary)] text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        {/* Uhrzeit (Optional) */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                              Startzeit (optional)
                            </label>
                            <input 
                              type="time"
                              value={eventStartTime}
                              onChange={(e) =>
                                setEventStartTime(e.target.value)
                              }
                              className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[var(--color-primary)] text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 font-bold">
                              Endzeit (optional)
                            </label>
                            <input 
                              type="time"
                              value={eventEndTime}
                              onChange={(e) => setEventEndTime(e.target.value)}
                              className="w-full px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[var(--color-primary)] text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            />
                          </div>
                        </div>

                        {/* Beschreibung (Optional) */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Beschreibung (optional)
                          </label>
                          <textarea
                            value={eventDescription}
                            onChange={(e) =>
                              setEventDescription(e.target.value)
                            }
                            placeholder="Details, Ablauf, Verpflegung..."
                            rows={3}
                            className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[var(--color-primary)] resize-y placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                          />
                        </div>

                        {/* Hide expired events (optional, default: true) */}
                        <div className="pt-2 border-t border-slate-200/60 space-y-2">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                            Archivierung & Anzeige
                          </label>
                          <span className="block text-[9px] font-semibold text-slate-500 leading-normal mb-1">
                            Soll die Veranstaltung nach verstreichen des Datums
                            für Spieler ausgeblendet werden?
                          </span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventHideExpired"
                                checked={eventHideExpired === true}
                                onChange={() => setEventHideExpired(true)}
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Ja (Standard)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventHideExpired"
                                checked={eventHideExpired === false}
                                onChange={() => setEventHideExpired(false)}
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Nein</span>
                            </label>
                          </div>
                        </div>

                        {/* Allow registration comments (optional, default: false) */}
                        <div className="pt-3 border-t border-slate-200/60 space-y-2">
                          <span className="block text-[9px] font-semibold text-slate-500 leading-normal mb-1">
                            Kommentarfeld bei der Anmeldung zulassen? (z.B. für
                            Essenswünsche, Mitbringsel)
                          </span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventAllowComment"
                                checked={eventAllowComment === true}
                                onChange={() => setEventAllowComment(true)}
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Ja</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventAllowComment"
                                checked={eventAllowComment === false}
                                onChange={() => setEventAllowComment(false)}
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Nein (Standard)</span>
                            </label>
                          </div>
                        </div>

                        {/* Maximale Teilnehmerzahl (optional) */}
                        <div className="pt-3 border-t border-slate-200/60 space-y-2">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Max. Teilnehmerzahl (optional)
                          </label>
                          <input 
                            type="number"
                            min="1"
                            placeholder="Kein Limit"
                            value={eventMaxParticipants}
                            onChange={(e) =>
                              setEventMaxParticipants(e.target.value)
                            }
                            className="w-full max-w-[200px] px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[var(--color-primary)] text-slate-800 py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                        </div>

                        {/* Anmeldungen sperren */}
                        <div className="pt-3 border-t border-slate-200/60 space-y-2">
                          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Anmeldungen sperren?
                          </label>
                          <span className="block text-[9px] font-semibold text-slate-500 leading-normal mb-1">
                            Sperrt die Registrierung für normale Spieler, ohne
                            dass das Event ausgeblendet wird.
                          </span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventIsRegistrationBlocked"
                                checked={eventIsRegistrationBlocked === true}
                                onChange={() =>
                                  setEventIsRegistrationBlocked(true)
                                }
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Ja</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="eventIsRegistrationBlocked"
                                checked={eventIsRegistrationBlocked === false}
                                onChange={() =>
                                  setEventIsRegistrationBlocked(false)
                                }
                                className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                              />
                              <span>Nein (Standard)</span>
                            </label>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200">
                          <button
                            type="submit"
                            className="flex-1 bg-[var(--color-primary)] text-white rounded-xl uppercase tracking-wider shadow-sm hover:shadow-md hover:bg-black transition-all flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium"
                          >
                            <i className="fa-solid fa-check"></i>{" "}
                            {editingTournamentId
                              ? "Speichern"
                              : "Event anlegen"}
                          </button>
                          {(editingTournamentId ||
                            eventTitle ||
                            eventDate ||
                            eventDescription) && (
                            <button
                              type="button"
                              onClick={resetEventForm}
                              className="px-4 border-2 border-slate-300 text-slate-700 rounded-xl uppercase tracking-wider hover:border-slate-400 bg-white transition-all py-2.5 text-sm font-medium"
                            >
                              Abbrechen
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* LISTING COLUMN */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-6 rounded-2xl border-none shadow-md space-y-4 text-left">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-2 border-b border-slate-100 pb-3">
                          <i className="fa-solid fa-list"></i> Geplante
                          Veranstaltungen ({tournaments.length})
                        </h4>

                        {tournaments.length === 0 ? (
                          <p className="text-xs text-slate-500 py-8 italic text-center">
                            Keine geplanten Veranstaltungen gefunden.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {tournaments.map((t) => {
                              const hasDate = !!t.date;
                              const formattedDate = hasDate
                                ? new Date(t.date!).toLocaleDateString(
                                    "de-DE",
                                    {
                                      weekday: "long",
                                      day: "2-digit",
                                      month: "long",
                                      year: "numeric",
                                    },
                                  )
                                : null;
                              const hasTime = !!t.startTime;

                              return (
                                <div
                                  key={t.id}
                                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-green-50/10 transition-colors flex flex-col justify-between gap-4"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-black text-[var(--color-primary)] uppercase tracking-wide">
                                        {t.title}
                                      </h5>

                                      <div className="text-[10px] text-slate-500 font-bold flex flex-wrap gap-x-4 gap-y-2 items-center">
                                        {formattedDate ? (
                                          <span className="flex items-center gap-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold">
                                            <i className="fa-solid fa-calendar-day"></i>{" "}
                                            {formattedDate}
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold">
                                            Kein festes Datum
                                          </span>
                                        )}

                                        {hasTime && (
                                          <span className="flex items-center gap-1 text-slate-600 font-extrabold">
                                            <i className="fa-regular fa-clock"></i>{" "}
                                            {t.startTime}{" "}
                                            {t.endTime ? `- ${t.endTime}` : ""}{" "}
                                            Uhr
                                          </span>
                                        )}

                                        {t.maxParticipants &&
                                        t.maxParticipants > 0 ? (
                                          <span className="flex items-center gap-1 bg-emerald-50 text-[var(--color-primary)] px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border border-emerald-200">
                                            <i className="fa-solid fa-users"></i>{" "}
                                            Max. {t.maxParticipants}
                                          </span>
                                        ) : null}

                                        {t.isRegistrationBlocked && (
                                          <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border border-red-200">
                                            <i className="fa-solid fa-lock"></i>{" "}
                                            Anmeldungen gesperrt
                                          </span>
                                        )}
                                      </div>

                                      {t.description && (
                                        <p className="text-slate-600 text-[11px] leading-relaxed pt-1 bg-white/50 h-8 px-3 py-1 rounded-lg border border-slate-100 font-sans font-medium">
                                          {t.description}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex gap-2 self-start">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditEvent(t)}
                                        className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-[var(--color-primary)] hover:text-white flex items-center justify-center transition-colors text-xs shadow-sm"
                                        title="Bearbeiten"
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              `Veranstaltung "${t.title}" wirklich löschen?`,
                                            )
                                          ) {
                                            onDeleteTournament(t.id);
                                            setMessage({
                                              text: `Veranstaltung "${t.title}" erfolgreich gelöscht.`,
                                              type: "success",
                                            });
                                          }
                                        }}
                                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors text-xs shadow-sm"
                                        title="Löschen"
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-3">
                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2">
                                      <span
                                        className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${(t.hideExpired ?? true) ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-orange-50 border-orange-200 text-orange-600"}`}
                                      >
                                        {(t.hideExpired ?? true)
                                          ? "Nach Ablauf ausblenden: Ja"
                                          : "Nach Ablauf ausblenden: Nein"}
                                      </span>
                                      <span
                                        className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${t.allowComment ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                                      >
                                        {t.allowComment
                                          ? "Kommentarfeld zulässig: Ja"
                                          : "Kommentarfeld zulässig: Nein"}
                                      </span>
                                    </div>

                                    {/* Participants lists */}
                                    <div>
                                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Angemeldete Spieler (
                                        {t.participants?.length || 0})
                                      </span>
                                      {!t.participants ||
                                      t.participants.length === 0 ? (
                                        <span className="text-[10px] text-slate-400 font-bold italic">
                                          Noch keine Anmeldungen vorhanden.
                                        </span>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {t.participants.map((player, idx) => {
                                            const comment =
                                              t.registrationComments?.[player];
                                            return (
                                              <div
                                                key={idx}
                                                className="bg-white h-8 px-3 py-1 rounded-2xl border-none shadow-md text-[10px] text-slate-700 flex flex-col gap-1 font-sans font-medium"
                                              >
                                                <div className="flex items-center gap-1.5 text-slate-800">
                                                  <span>{player}</span>
                                                </div>
                                                {comment && (
                                                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-[9px] text-[var(--color-primary)] font-semibold italic">
                                                    <i className="fa-regular fa-comment-dots mr-1"></i>
                                                    "{comment}"
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: RANGLISTE */}
              {currentTab === "ranking" && (
                <AdminRankings
                  rankings={rankings || null}
                  users={users}
                  onUpdateRankings={onUpdateRankings || (() => {})}
                  settings={settings}
                  onUpdateSettings={onUpdateSettings}
                />
              )}

              {/* TAB 8: UPDATES / CHANGELOG */}
              {currentTab === "updates" && (
                <AdminChangelog settings={settings} />
              )}

              {/* TAB 9: HANDBUCH / SYSTEM-DOKUMENTATION */}
              {currentTab === "handbuch" && (
                <AdminDocumentation />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* WARNING POPUP: CHANGING TABS WITH UNSAVED CHANGES */}
      {pendingTab && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-sm -200/80 -500 animate-in zoom-in duration-300">
            <h3 className="text-orange-600 font-extrabold text-lg uppercase tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i> Ungespeicherte
              Änderungen
            </h3>
            <p className="text-xs text-slate-500 my-4 leading-relaxed">
              Du hast in der aktuellen Kategorie ungespeicherte Änderungen
              vorgenommen. Möchtest du diese vor dem Wechsel speichern?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSaveTab(currentTab);
                  setCurrentTab(pendingTab);
                  setPendingTab(null);
                }}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-black text-white rounded-xl font-bold text-xs transition-colors"
              >
                Speichern & Wechseln
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDiscardTab(currentTab);
                  setCurrentTab(pendingTab);
                  setPendingTab(null);
                }}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors"
              >
                Änderungen verwerfen & Wechseln
              </button>
              <button
                type="button"
                onClick={() => setPendingTab(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Auf aktueller Seite bleiben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: RESERVATIONS PURGE */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <div className="border-none outline-none bg-white rounded-2xl -200/80 shadow-sm w-full max-w-md overflow-hidden animate-in zoom-in duration-300 -600">
            <div className="bg-red-600 p-8 text-white">
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <i className="fa-solid fa-shield-virus"></i>{" "}
                Sicherheits-Bestätigung
              </h3>
              <p className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-widest">
                {showDeleteModal === "bookings"
                  ? "Reservierungs-Bereinigung"
                  : "Mitglieder-Bereinigung (Bulk)"}
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4">
                <i className="fa-solid fa-circle-exclamation text-red-600 text-xl mt-1"></i>
                <p className="text-[10px] font-bold text-red-900 leading-relaxed">
                  {showDeleteModal === "bookings"
                    ? "Bist du absolut sicher? Alle passenden Reservierungen werden unumkehrbar gelöscht!"
                    : "Bist du absolut sicher? ALLE registrierten Mitglieder werden unumkehrbar gelöscht (außer dein eigener Administrator-Account, damit du eingeloggt bleibst)!"}
                </p>
              </div>

              {showDeleteModal === "bookings" && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      Ab Datum
                    </label>
                    <input 
                      type="date"
                      value={deleteRange.start}
                      onChange={(e) =>
                        setDeleteRange((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="w-full p-2 border-2 border-slate-200 rounded-lg text-xs outline-none focus:border-red-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      Bis Datum
                    </label>
                    <input 
                      type="date"
                      value={deleteRange.end}
                      onChange={(e) =>
                        setDeleteRange((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                      className="w-full p-2 border-2 border-slate-200 rounded-lg text-xs outline-none focus:border-red-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      Platz wählen (optional)
                    </label>
                    <select 
                      value={deleteRange.court}
                      onChange={(e) =>
                        setDeleteRange((prev) => ({
                          ...prev,
                          court: e.target.value,
                        }))
                      }
                      className="w-full p-2 border-2 border-slate-200 rounded-lg text-xs outline-none focus:border-red-500 bg-white font-sans font-medium"
                    >
                      <option value="all">Alle Plätze</option>
                      {courtsList.map((court, i) => (
                        <option key={i} value={court}>
                          {court}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Eingabe zur Bestätigung:{" "}
                  <span className="text-red-600 font-extrabold uppercase">
                    LÖSCHEN
                  </span>
                </label>
                <input 
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  className="w-full px-4 border-2 border-red-200 rounded-2xl text-center text-red-600 tracking-[0.5em] outline-none focus:border-red-600 focus:bg-red-50 transition-all uppercase py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  disabled={deleteConfirmText !== "LÖSCHEN"}
                  onClick={executeBulkDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl shadow-md uppercase tracking-wide active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center h-10 text-sm font-semibold"
                >
                  Unwiderruflich Löschen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(null);
                    setDeleteConfirmText("");
                  }}
                  className="px-6 bg-slate-100 text-slate-500 font-black py-2.5 rounded-xl uppercase tracking-widest text-xs active:scale-95"
                >
                  Abbruch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: DELETE SINGLE USER CONFIRMATION */}
      {userToDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity"
            onClick={() => setUserToDeleteConfirm(null)}
          ></div>

          {/* Drawer Panel */}
          <div className="relative w-full md:max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10 text-left">
            {/* Header */}
            <div className="bg-slate-950 px-6 py-5 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                  <i className="fa-solid fa-user-minus text-red-500"></i>
                </div>
                <div>
                  <h3 className="font-black tracking-widest uppercase text-xs sm:text-sm">
                    Mitglied löschen
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Mitgliederverwaltung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToDeleteConfirm(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 active:scale-95 transition-all outline-none flex items-center justify-center border border-white/10 shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-white text-xs"></i>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Caution Callout */}
              <div className="bg-red-50 border border-red-200/60 p-4 rounded-xl flex items-start gap-3">
                <i className="fa-solid fa-triangle-exclamation text-red-600 text-lg mt-0.5"></i>
                <div>
                  <h4 className="text-xs font-black text-red-800 uppercase tracking-wider">
                    Achtung: Unwiderruflich!
                  </h4>
                  <p className="text-[11px] text-red-700 font-semibold leading-relaxed mt-1">
                    Sind Sie sicher, dass Sie dieses Mitglied dauerhaft löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>

              {/* Member Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Details zum Mitglied
                </h4>

                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 space-y-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Vollständiger Name
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {userToDeleteConfirm.klarname || userToDeleteConfirm.name}
                    </span>
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Benutzername (Login)
                    </span>
                    <span className="inline-block font-mono bg-slate-200 rounded px-2 py-0.5 text-[10px] font-black text-slate-700">
                      {userToDeleteConfirm.name}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      E-Mail-Adresse
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {userToDeleteConfirm.email || (
                        <span className="italic text-slate-400">Keine E-Mail hinterlegt</span>
                      )}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Telefonnummer
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {userToDeleteConfirm.phone || (
                        <span className="italic text-slate-400">Keine Nummer hinterlegt</span>
                      )}
                    </span>
                  </div>

                  {/* Role */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Rolle & Rechte
                    </span>
                    <span className="inline-block text-xs font-bold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-full capitalize">
                      {userToDeleteConfirm.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informative text */}
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Nach dem Löschen wird der Login-Zugang für dieses Mitglied sofort gesperrt. Bereits getätigte Reservierungen bleiben zur Planungsstabilität unter neutralem Namen sichtbar.
              </p>
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setUserToDeleteConfirm(null)}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer text-center"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  executeDeleteUser(userToDeleteConfirm);
                  setUserToDeleteConfirm(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer text-center"
              >
                Mitglied löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBannerPositionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="border-none outline-none bg-white rounded-2xl shadow-sm max-w-4xl w-full -200/80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[var(--color-primary)] text-white p-6 flex justify-between items-center z-10 shadow-md">
              <h3 className="font-black tracking-widest uppercase text-lg flex items-center gap-3">
                <i className="fa-solid fa-crop-simple"></i> Banner-Ausschnitt
                wählen
              </h3>
              <button
                type="button"
                onClick={() => setShowBannerPositionModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-8 flex flex-col gap-8">
              <div className="w-full h-32 relative rounded-2xl border-4 border-[var(--color-accent)] overflow-hidden shadow-sm">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt="Banner Preview"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: bannerPosition }}
                  />
                ) : null}
                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  "0% 0%",
                  "50% 0%",
                  "100% 0%",
                  "0% 50%",
                  "50% 50%",
                  "100% 50%",
                  "0% 100%",
                  "50% 100%",
                  "100% 100%",
                ].map((pos) => {
                  const labelMap: Record<string, string> = {
                    "0% 0%": "Oben Links",
                    "50% 0%": "Oben Mitte",
                    "100% 0%": "Oben Rechts",
                    "0% 50%": "Mitte Links",
                    "50% 50%": "Zentriert",
                    "100% 50%": "Mitte Rechts",
                    "0% 100%": "Unten Links",
                    "50% 100%": "Unten Mitte",
                    "100% 100%": "Unten Rechts",
                  };
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setBannerPosition(pos)}
                      className={`py-4 px-2 rounded-xl font-bold text-[10px] uppercase tracking-wider border-2 transition-all ${bannerPosition === pos ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-lg scale-105" : "border-slate-200 bg-white text-slate-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"}`}
                    >
                      {labelMap[pos]}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowBannerPositionModal(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--color-accent-2)] text-white font-black uppercase tracking-widest shadow-md hover:bg-black transition-colors"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateCandidatesModal && (
        <div className="fixed inset-0 bg-[#1b4332]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans">
          <div className="border-none outline-none bg-white rounded-2xl w-full max-w-xl shadow-xl p-6 sm:p-8 -200 space-y-5">
            <h2 className="text-base font-black text-[#1b4332] uppercase tracking-tight flex items-center justify-between">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-user-shield text-amber-600"></i>
                Ein Benutzer mit diesem Namen / dieser E-Mail existiert bereits im Ligasystem.
              </span>
              <button
                onClick={() => setDuplicateCandidatesModal(null)}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </h2>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed font-semibold">
              Es wurde eine Übereinstimmung mit einem bestehenden Benutzerkonto gefunden. Zur Vermeidung von Duplikaten kannst du das bestehende Profil direkt mit deinem Verein verknüpfen.
            </div>

            <div className="space-y-3">
              {duplicateCandidatesModal.candidates.map((cand) => (
                <div
                  key={cand.personId}
                  className="bg-slate-50 border border-amber-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {cand.firstName} {cand.lastName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        System-ID: {cand.personId}
                      </span>
                    </div>

                    {cand.hasAdminInOtherClub && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-lg text-amber-900 font-bold text-[10px]">
                        <i className="fa-solid fa-shield-halved text-amber-600"></i>
                        <span>Hinweis: Dieser Benutzer ist in einem anderen Verein als Administrator registriert.</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await addExistingPersonToClub(
                          cand.personId,
                          currentClubId,
                          Role.MITGLIED
                        );
                        setMessage({
                          text: `Bestehender Benutzer "${cand.firstName} ${cand.lastName}" wurde erfolgreich mit diesem Verein verknüpft (Standard-Rolle: Mitglied).`,
                          type: "success",
                        });
                        setEditingUser({
                          name: "",
                          password: "",
                          role: Role.MITGLIED,
                          firstName: "",
                          lastName: "",
                          email: "",
                          phone: "",
                        });
                        setShowUserForm(false);
                        setDuplicateCandidatesModal(null);
                      } catch (err: any) {
                        setMessage({
                          text: err.message || "Fehler beim Verknüpfen des Benutzers.",
                          type: "error",
                        });
                      }
                    }}
                    className="w-full bg-[#1b4332] hover:bg-[#153326] text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-link text-emerald-300"></i>
                    Bestehenden Benutzer zum Verein einladen / verknüpfen (Empfohlen)
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDuplicateCandidatesModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateCandidatesModal(null);
                  handleSaveUser(true);
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-800 cursor-pointer"
              >
                Trotzdem neues Profil anlegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
