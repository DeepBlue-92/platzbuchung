import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, setDoc } from "firebase/firestore";
import { db, ensureServerAuthenticated } from "./lib/firebase";
import {
  sendNotificationMail,
  getAllTemplates,
  saveCustomTemplate,
} from "./services/resendService";
import { renderEmail } from "./services/templateEngine";
import {
  loadClubEmailTemplatesData,
  getActiveTemplateForEvent,
} from "./services/emailTemplateStorage";
import {
  bulkUpdateUserNotificationSettings,
  updateClubDefaultNotificationSettings,
  getClubDefaultNotificationSettings,
} from "./services/db";
import {
  broadcastHobbyligaNewPost,
  notifyMatchResultSubmitted,
  notifyBookingModified,
} from "./services/notificationDispatcher";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize server-side superadmin authentication in background
  ensureServerAuthenticated().catch((authErr) => {
    console.warn("Server-side superadmin auth initialization:", authErr);
  });

  // JSON parsing middleware
  app.use(express.json());

  // MIDDLEWARE: Exclude public & feed routes from any auth checks and enforce CORS
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/feed/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }
    }
    next();
  });

  // Reusable handler for JSON feeds
  const handleFeedRequest = async (req: express.Request, res: express.Response) => {
    try {
      const requestedType = req.query.type || (req.path.includes("full") || req.path.includes("klarnamen") ? "klarnamen" : "anonymisiert");
      const rawClubId = (req.query.clubId || "sv-neuhausen").toString();
      const normalizedClubId = rawClubId.toLowerCase().replace(/\s/g, "");

      // Decision Option A: Non-authenticated visitors strictly receive anonymized feed data ("Belegt" / Spieler X)
      const authHeader = req.headers.authorization;
      const isAuthenticated = !!(authHeader && authHeader.startsWith("Bearer "));
      const isAnon = requestedType !== "klarnamen" || !isAuthenticated;

      // Check if the feed is enabled in club settings
      const clubRef = doc(db, "vereine", normalizedClubId);
      const clubSnap = await getDoc(clubRef);

      let isEnabled = true;
      if (clubSnap.exists()) {
        const clubSettings = clubSnap.data();
        if (clubSettings.publicCalendar && clubSettings.publicCalendar.enabled === false) {
          isEnabled = false;
        } else if (isAnon && clubSettings.feedAnonEnabled === false) {
          isEnabled = false;
        } else if (!isAnon && clubSettings.feedRealEnabled === false) {
          isEnabled = false;
        }
      }

      if (!isEnabled) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(403).json({
          error: "Forbidden",
          message: `Der ${isAnon ? "anonymisierte" : "Klarnamen"} Buchungs-Feed ist für diesen Verein aktuell deaktiviert.`
        });
      }

      // Try reading pre-aggregated public state document
      const docName = isAnon ? "public_bookings" : "public_bookings_clear";
      const docRef = doc(db, "vereine", normalizedClubId, "state", docName);
      const docSnap = await getDoc(docRef);

      res.setHeader("Content-Type", "application/json; charset=utf-8");

      if (docSnap.exists() && Array.isArray(docSnap.data()?.bookings)) {
        return res.json(docSnap.data());
      }

      // Dynamic Fallback: fetch directly from bookings collection if pre-aggregated doc is not yet populated
      const bookingsRef = collection(db, "vereine", normalizedClubId, "bookings");
      const bookingsSnap = await getDocs(bookingsRef);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

      const bookingsList: any[] = [];
      bookingsSnap.forEach((docSnapItem) => {
        const b = docSnapItem.data();
        if (b.date && b.date >= sevenDaysAgoStr) {
          const rawPlayers = Array.isArray(b.players) ? b.players : [];
          const players = isAnon
            ? rawPlayers.map((_, idx) => `Spieler ${idx + 1}`)
            : rawPlayers;

          bookingsList.push({
            id: b.id || docSnapItem.id,
            date: b.date,
            time: b.time,
            court: b.court,
            isLocked: b.isLocked || false,
            hasBallMachine: b.hasBallMachine || false,
            players,
            reason: b.isLocked ? b.reason || "Sperre" : "Privatspiel",
          });
        }
      });

      return res.json({ bookings: bookingsList });
    } catch (error: any) {
      console.error("Error fetching public feed:", error);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  };

  // Bind feed routes
  const feedRoutes = [
    "/api/public/feeds/bookings",
    "/api/feed/anonymous",
    "/api/feed/anonymisiert",
    "/api/feed/full",
    "/api/feed/klarnamen",
    "/api/feed/bookings",
    "/feed/anonymous",
    "/feed/anonymisiert",
    "/feed/full",
    "/feed/klarnamen",
    "/feed/bookings"
  ];

  feedRoutes.forEach((route) => {
    app.get(route, handleFeedRequest);
  });

  // API Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Assistant Chat endpoint grounded on public/tutorial
  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const { message, history } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Missing message parameter" });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "AI_NOT_CONFIGURED",
          message: "No Gemini API key configured on server. Falling back to local knowledge base."
        });
      }

      let cachedTutorial = "";
      try {
        const tutorialPath = path.join(process.cwd(), "public", "tutorial");
        if (fs.existsSync(tutorialPath)) {
          cachedTutorial = fs.readFileSync(tutorialPath, "utf-8");
        }
      } catch (readErr) {
        console.warn("Could not read public/tutorial:", readErr);
      }

      let personalityInstruction = (req.body && req.body.systemInstruction) || "";
      if (!personalityInstruction) {
        try {
          const personalityPath = path.join(process.cwd(), "public", "personality");
          if (fs.existsSync(personalityPath)) {
            const rawPersona = fs.readFileSync(personalityPath, "utf-8");
            const cleanVorname = (req.body?.vorname || "").trim();
            if (cleanVorname) {
              personalityInstruction = rawPersona.replace(/\{\{VORNAME\}\}/g, cleanVorname);
            } else {
              personalityInstruction = rawPersona
                .replace(/Servus\s*\{\{VORNAME\}\}!/g, "Servus!")
                .replace(/\{\{VORNAME\}\}/g, "");
            }
          }
        } catch (personaErr) {
          console.warn("Could not read public/personality:", personaErr);
        }
      }

      const combinedSystemInstruction = `${personalityInstruction || 'Du bist "Ace", der persönliche, intelligente Vereins- und Tennis-Assistent der DJK Fürth.'}

---
AUTORITATIVE WISSENSBASIS AUS DEM VEREINSHANDBUCH (public/tutorial):
${cachedTutorial}
`;

      const ai = new GoogleGenAI();
      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const h of history) {
          if (h && h.text && h.sender) {
            contents.push({
              role: h.sender === "user" ? "user" : "model",
              parts: [{ text: h.text }]
            });
          }
        }
      }
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: {
            parts: [{ text: combinedSystemInstruction }]
          },
          temperature: 0.3,
        }
      });

      const reply = response.text || "";
      return res.json({ reply });
    } catch (error: any) {
      console.error("Error in /api/assistant/chat:", error);
      return res.status(500).json({
        error: "AI_GENERATION_FAILED",
        message: error.message || "Failed to generate AI response"
      });
    }
  });

  // EMAIL NOTIFICATION SYSTEM ROUTES

  // 1. Send Notification / Test Email via Resend
  app.post("/api/send-email", async (req: express.Request, res: express.Response) => {
    try {
      const {
        eventKey,
        recipientEmail,
        payload,
        customTemplate,
        clubName,
        clubLogoUrl,
      } = req.body || {};

      if (!recipientEmail || !recipientEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          status: "failed",
          error: "INVALID_RECIPIENT",
          message: "Bitte gib eine gültige Empfänger-E-Mail-Adresse an.",
        });
      }

      if (!eventKey) {
        return res.status(400).json({
          success: false,
          status: "failed",
          error: "MISSING_EVENT_KEY",
          message: "eventKey (z. B. RESERVATION_CONFIRMED) ist erforderlich.",
        });
      }

      const result = await sendNotificationMail({
        eventKey,
        recipientEmail,
        payload: payload || {},
        customTemplate,
        clubName: clubName || "Tennis-Club e.V.",
        clubLogoUrl,
      });

      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/send-email:", err);
      return res.status(500).json({
        success: false,
        status: "failed",
        error: "INTERNAL_ERROR",
        message: err.message || "Fehler beim Versenden der Benachrichtigungs-E-Mail.",
      });
    }
  });

  // 2. Fetch all templates
  app.get("/api/email-templates", (_req: express.Request, res: express.Response) => {
    const templates = getAllTemplates();
    return res.json(templates);
  });

  // 3. Save / Update a template
  app.post("/api/email-templates", (req: express.Request, res: express.Response) => {
    try {
      const template = req.body;
      if (!template || !template.id) {
        return res.status(400).json({ error: "Missing template id" });
      }
      saveCustomTemplate(template);
      return res.json({ success: true, template });
    } catch (err: any) {
      console.error("Error saving template:", err);
      return res.status(500).json({ error: "FAILED_TO_SAVE_TEMPLATE" });
    }
  });

  // 4. Render email preview
  app.post("/api/email-preview", (req: express.Request, res: express.Response) => {
    try {
      const { subjectTemplate, bodyTemplate, blocks, globalSettings, payload, wrapperOptions } = req.body || {};
      const rendered = renderEmail({
        subjectTemplate: subjectTemplate || "",
        bodyTemplate: bodyTemplate || "",
        blocks,
        globalSettings,
        payload: payload || {},
        wrapperOptions,
      });
      return res.json(rendered);
    } catch (err: any) {
      console.error("Error in /api/email-preview:", err);
      return res.status(500).json({ error: "RENDER_FAILED", message: err.message });
    }
  });

  // 5. Bulk Update User Notification Settings (Database Mutation)
  app.post("/api/notifications/bulk-update", async (req: express.Request, res: express.Response) => {
    try {
      const { userIds, eventKey, enabled, vereinsId } = req.body || {};
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "MISSING_USER_IDS",
          message: "Keine Benutzer-IDs für die Massenaktualisierung übergeben.",
        });
      }
      if (!eventKey) {
        return res.status(400).json({
          success: false,
          error: "MISSING_EVENT_KEY",
          message: "Event-Schlüssel erforderlich.",
        });
      }

      const result = await bulkUpdateUserNotificationSettings(
        vereinsId || "sv-neuhausen",
        userIds,
        eventKey,
        enabled === true
      );

      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/notifications/bulk-update:", err);
      return res.status(500).json({
        success: false,
        error: "BULK_UPDATE_FAILED",
        message: err.message || "Fehler bei der Massenaktualisierung der Benachrichtigungen.",
      });
    }
  });

  // 6. Broadcast Hobbyliga New Post Event
  app.post("/api/notifications/broadcast-post", async (req: express.Request, res: express.Response) => {
    try {
      const { authorId, authorName, leagueId, leagueName, postTitle, postContent, vereinsId, clubName, users } = req.body || {};

      if (!postTitle || !postContent) {
        return res.status(400).json({
          success: false,
          error: "MISSING_CONTENT",
          message: "Titel und Text des Beitrags erforderlich.",
        });
      }

      // If users are passed in request, use them; otherwise fetch from DB
      let usersMap = users || {};
      if (Object.keys(usersMap).length === 0) {
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          usersMap = {};
          usersSnap.docs.forEach((d) => {
            usersMap[d.id] = { id: d.id, ...d.data() };
          });
        } catch (dbErr) {
          console.warn("Could not fetch users collection from Firestore directly:", dbErr);
        }
      }

      const result = await broadcastHobbyligaNewPost(
        {
          authorId: authorId || "system",
          authorName: authorName || "Pinnwand",
          leagueId,
          leagueName,
          postTitle,
          postContent,
          vereinsId,
        },
        usersMap,
        clubName || "Tennis-Club e.V."
      );

      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/notifications/broadcast-post:", err);
      return res.status(500).json({
        success: false,
        error: "BROADCAST_FAILED",
        message: err.message || "Fehler beim Versenden des Hobbyliga-Broadcasts.",
      });
    }
  });

  // 7. Match Result Submitted Event (Strictly to Opponent)
  app.post("/api/notifications/match-result", async (req: express.Request, res: express.Response) => {
    try {
      const {
        submitterId,
        submitterName,
        opponentId,
        opponentName,
        resultScore,
        matchDate,
        leagueName,
        courtName,
        clubName,
        users,
      } = req.body || {};

      if (!opponentId || !resultScore) {
        return res.status(400).json({
          success: false,
          error: "MISSING_DATA",
          message: "Gegner-ID und Ergebnis erforderlich.",
        });
      }

      let usersMap = users || {};
      if (Object.keys(usersMap).length === 0) {
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          usersMap = {};
          usersSnap.docs.forEach((d) => {
            usersMap[d.id] = { id: d.id, ...d.data() };
          });
        } catch (dbErr) {
          console.warn("Could not fetch users collection from Firestore directly:", dbErr);
        }
      }

      const result = await notifyMatchResultSubmitted(
        {
          submitterId: submitterId || "unknown",
          submitterName: submitterName || "Spielpartner",
          opponentId,
          opponentName,
          resultScore,
          matchDate,
          leagueName,
          courtName,
        },
        usersMap,
        clubName || "Tennis-Club e.V."
      );

      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/notifications/match-result:", err);
      return res.status(500).json({
        success: false,
        error: "MATCH_RESULT_NOTIFY_FAILED",
        message: err.message || "Fehler beim Versenden der Ergebnis-Benachrichtigung.",
      });
    }
  });

  // 7b. Booking Modified Event (Sent to booking owner & partners)
  app.post("/api/notifications/booking-modified", async (req: express.Request, res: express.Response) => {
    try {
      const {
        bookingId,
        userId,
        userName,
        userEmail,
        recipientEmail,
        courtName,
        date,
        time,
        oldCourtName,
        oldDate,
        oldTime,
        players,
        cancellationLink,
        comment,
        vereinsId,
        clubName,
        users,
      } = req.body || {};

      if (!courtName || !date || !time) {
        return res.status(400).json({
          success: false,
          error: "MISSING_DATA",
          message: "Platz, Datum und Uhrzeit erforderlich.",
        });
      }

      let usersMap = users || {};
      if (Object.keys(usersMap).length === 0) {
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          usersMap = {};
          usersSnap.docs.forEach((d) => {
            usersMap[d.id] = { id: d.id, ...d.data() };
          });
        } catch (dbErr) {
          console.warn("Could not fetch users collection from Firestore directly:", dbErr);
        }
      }

      const result = await notifyBookingModified(
        {
          bookingId: bookingId || "BK-UPDATE",
          userId,
          userName,
          userEmail,
          recipientEmail,
          courtName,
          date,
          time,
          oldCourtName,
          oldDate,
          oldTime,
          players,
          cancellationLink,
          comment,
          vereinsId,
        },
        usersMap,
        clubName || "Tennis-Club e.V."
      );

      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/notifications/booking-modified:", err);
      return res.status(500).json({
        success: false,
        error: "BOOKING_MODIFIED_NOTIFY_FAILED",
        message: err.message || "Fehler beim Versenden der Umbuchungs-Benachrichtigung.",
      });
    }
  });

  // 8. Onboarding / Club Notification Defaults
  app.get("/api/notifications/defaults", async (req: express.Request, res: express.Response) => {
    try {
      const vereinsId = (req.query.vereinsId as string) || "sv-neuhausen";
      const defaults = await getClubDefaultNotificationSettings(vereinsId);
      return res.json({ defaults });
    } catch (err: any) {
      console.error("Error in GET /api/notifications/defaults:", err);
      return res.status(500).json({ error: "LOAD_DEFAULTS_FAILED" });
    }
  });

  app.post("/api/notifications/defaults", async (req: express.Request, res: express.Response) => {
    try {
      const { vereinsId, defaults } = req.body || {};
      if (!defaults) {
        return res.status(400).json({ error: "Missing defaults payload" });
      }
      await updateClubDefaultNotificationSettings(vereinsId || "sv-neuhausen", defaults);
      return res.json({ success: true, defaults });
    } catch (err: any) {
      console.error("Error in POST /api/notifications/defaults:", err);
      return res.status(500).json({ error: "SAVE_DEFAULTS_FAILED" });
    }
  });

  // HELPER: Resolve user document in Firestore by ID or name
  async function resolveUserDoc(userId: string, userHint?: any): Promise<{ docRef: any; data: any } | null> {
    try {
      if (userId) {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          return { docRef: userRef, data: { id: snap.id, ...snap.data() } };
        }
      }
      if (userId) {
        const q = query(collection(db, "users"), where("name", "==", userId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          return { docRef: doc(db, "users", d.id), data: { id: d.id, ...d.data() } };
        }
      }
      if (userId && userId.includes("@")) {
        const qEmail = query(collection(db, "users"), where("email", "==", userId));
        const emSnap = await getDocs(qEmail);
        if (!emSnap.empty) {
          const d = emSnap.docs[0];
          return { docRef: doc(db, "users", d.id), data: { id: d.id, ...d.data() } };
        }
      }
      if (userHint && userHint.id) {
        const hRef = doc(db, "users", userHint.id);
        const snap = await getDoc(hRef);
        if (snap.exists()) {
          return { docRef: hRef, data: { id: snap.id, ...snap.data() } };
        }
        return { docRef: hRef, data: userHint };
      }
    } catch (err) {
      console.warn("[resolveUserDoc] Error querying user:", err);
    }
    return null;
  }

  // 9. ADMIN: Send Initial Account Activation Email with Token
  app.post("/api/admin/users/:id/send-activation", async (req: express.Request, res: express.Response) => {
    try {
      const rawUserId = req.params.id;
      const { vereinsId = "sv-neuhausen", clubName = "Tennis-Club e.V.", user: userHint } = req.body || {};

      const resolved = await resolveUserDoc(rawUserId, userHint);
      if (!resolved || !resolved.data) {
        return res.status(404).json({
          success: false,
          error: "USER_NOT_FOUND",
          message: `Benutzer „${rawUserId}“ konnte in der Datenbank nicht gefunden werden.`,
        });
      }

      const userData = resolved.data;
      const recipientEmail = userData.email || userHint?.email;

      if (
        !recipientEmail ||
        !recipientEmail.includes("@") ||
        userData.is_placeholder_email ||
        recipientEmail.endsWith("@internal.app") ||
        recipientEmail.startsWith("no-email.")
      ) {
        return res.status(400).json({
          success: false,
          error: "MISSING_EMAIL",
          message: `Für das Mitglied „${userData.klarname || userData.name || rawUserId}“ ist keine gültige E-Mail-Adresse hinterlegt.`,
        });
      }

      // 1. Generate cryptographically secure one-time activation token (valid 24h)
      const token = `act_${crypto.randomBytes(24).toString("hex")}`;
      const validityHours = 24;
      const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();

      // 2. Build secure activation URL
      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const baseUrl = req.get("origin") || `${protocol}://${host}`;
      const activationLink = `${baseUrl}/#activate?token=${token}&userId=${encodeURIComponent(userData.id || rawUserId)}&clubId=${encodeURIComponent(vereinsId)}`;

      // 3. Load active email template for USER_ACTIVATION
      const clubData = await loadClubEmailTemplatesData(vereinsId);
      const activeTemplate = getActiveTemplateForEvent("USER_ACTIVATION", clubData.templates, clubData.assignments);

      // Member display name
      const memberName =
        userData.klarname ||
        (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}`.trim() : "") ||
        userData.firstName ||
        userData.name ||
        "Mitglied";

      // 4. Send email via notification engine
      const mailResult = await sendNotificationMail({
        eventKey: "USER_ACTIVATION",
        recipientEmail,
        recipientName: memberName,
        payload: {
          user_name: memberName,
          club_name: clubName || "Tennis-Club e.V.",
          activation_link: activationLink,
          link_validity_hours: String(validityHours),
        },
        customTemplate: activeTemplate,
        clubName: clubName || "Tennis-Club e.V.",
        vereinsId,
      });

      // 5. Update user record with token and timestamp
      try {
        await updateDoc(resolved.docRef, {
          activationToken: token,
          activationTokenExpiresAt: expiresAt,
          activationSentAt: sentAt,
        });
      } catch (dbErr) {
        console.warn("[send-activation] Warning updating user doc in Firestore:", dbErr);
      }

      return res.json({
        success: true,
        sentAt,
        token,
        expiresAt,
        activationLink,
        recipientEmail,
        recipientName: memberName,
        templateName: activeTemplate.name,
        message: `Aktivierungs-Mail erfolgreich an ${recipientEmail} versendet!`,
        mailResult,
      });
    } catch (err: any) {
      console.error("Error in /api/admin/users/:id/send-activation:", err);
      return res.status(500).json({
        success: false,
        error: "SEND_ACTIVATION_FAILED",
        message: err.message || "Fehler beim Versenden der Aktivierungs-E-Mail.",
      });
    }
  });

  // 10. ADMIN: Send Password Reset Email with Token
  app.post("/api/admin/users/:id/send-password-reset", async (req: express.Request, res: express.Response) => {
    try {
      const rawUserId = req.params.id;
      const { vereinsId = "sv-neuhausen", clubName = "Tennis-Club e.V.", user: userHint } = req.body || {};

      const resolved = await resolveUserDoc(rawUserId, userHint);
      if (!resolved || !resolved.data) {
        return res.status(404).json({
          success: false,
          error: "USER_NOT_FOUND",
          message: `Benutzer „${rawUserId}“ konnte in der Datenbank nicht gefunden werden.`,
        });
      }

      const userData = resolved.data;
      const recipientEmail = userData.email || userHint?.email;

      if (
        !recipientEmail ||
        !recipientEmail.includes("@") ||
        userData.is_placeholder_email ||
        recipientEmail.endsWith("@internal.app") ||
        recipientEmail.startsWith("no-email.")
      ) {
        return res.status(400).json({
          success: false,
          error: "MISSING_EMAIL",
          message: `Für das Mitglied „${userData.klarname || userData.name || rawUserId}“ ist keine gültige E-Mail-Adresse hinterlegt.`,
        });
      }

      // 1. Generate cryptographically secure one-time reset token (valid 1h)
      const token = `rst_${crypto.randomBytes(24).toString("hex")}`;
      const validityHours = 1;
      const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();
      const sentAt = new Date().toISOString();

      // 2. Build secure password reset URL
      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const baseUrl = req.get("origin") || `${protocol}://${host}`;
      const passwordResetLink = `${baseUrl}/#reset-password?token=${token}&userId=${encodeURIComponent(userData.id || rawUserId)}&clubId=${encodeURIComponent(vereinsId)}`;

      // 3. Load active email template for PASSWORD_RESET
      const clubData = await loadClubEmailTemplatesData(vereinsId);
      const activeTemplate = getActiveTemplateForEvent("PASSWORD_RESET", clubData.templates, clubData.assignments);

      // Member display name
      const memberName =
        userData.klarname ||
        (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}`.trim() : "") ||
        userData.firstName ||
        userData.name ||
        "Mitglied";

      // 4. Send email via notification engine
      const mailResult = await sendNotificationMail({
        eventKey: "PASSWORD_RESET",
        recipientEmail,
        recipientName: memberName,
        payload: {
          user_name: memberName,
          club_name: clubName || "Tennis-Club e.V.",
          password_reset_link: passwordResetLink,
          link_validity_hours: String(validityHours),
        },
        customTemplate: activeTemplate,
        clubName: clubName || "Tennis-Club e.V.",
        vereinsId,
      });

      // 5. Update user record with token and timestamp
      try {
        await updateDoc(resolved.docRef, {
          passwordResetToken: token,
          passwordResetTokenExpiresAt: expiresAt,
          passwordResetSentAt: sentAt,
        });
      } catch (dbErr) {
        console.warn("[send-password-reset] Warning updating user doc in Firestore:", dbErr);
      }

      return res.json({
        success: true,
        sentAt,
        token,
        expiresAt,
        passwordResetLink,
        recipientEmail,
        recipientName: memberName,
        templateName: activeTemplate.name,
        message: `Passwort-Reset-Mail erfolgreich an ${recipientEmail} versendet!`,
        mailResult,
      });
    } catch (err: any) {
      console.error("Error in /api/admin/users/:id/send-password-reset:", err);
      return res.status(500).json({
        success: false,
        error: "SEND_PASSWORD_RESET_FAILED",
        message: err.message || "Fehler beim Versenden der Passwort-Reset-E-Mail.",
      });
    }
  });

  // 11. ADMIN: Bulk Send Activation Emails
  app.post("/api/admin/users/bulk-send-activation", async (req: express.Request, res: express.Response) => {
    try {
      const { userIds, users: usersPayload, vereinsId = "sv-neuhausen", clubName = "Tennis-Club e.V." } = req.body || {};

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "MISSING_USER_IDS",
          message: "Keine Benutzer-IDs übergeben.",
        });
      }

      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const baseUrl = req.get("origin") || `${protocol}://${host}`;

      const clubData = await loadClubEmailTemplatesData(vereinsId);
      const activeTemplate = getActiveTemplateForEvent("USER_ACTIVATION", clubData.templates, clubData.assignments);

      let sentCount = 0;
      let failedCount = 0;
      const skippedUsers: { id: string; name?: string; reason: string }[] = [];
      const updatedTimestamps: Record<string, string> = {};

      for (const uid of userIds) {
        const userHint = usersPayload && usersPayload[uid] ? usersPayload[uid] : null;
        const resolved = await resolveUserDoc(uid, userHint);

        if (!resolved || !resolved.data) {
          skippedUsers.push({ id: uid, reason: "Benutzer nicht gefunden" });
          failedCount++;
          continue;
        }

        const u = resolved.data;
        const email = u.email;

        if (!email || !email.includes("@") || u.is_placeholder_email || email.endsWith("@internal.app") || email.startsWith("no-email.")) {
          skippedUsers.push({ id: uid, name: u.klarname || u.name, reason: "Keine gültige E-Mail hinterlegt" });
          failedCount++;
          continue;
        }

        const token = `act_${crypto.randomBytes(24).toString("hex")}`;
        const validityHours = 24;
        const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();
        const sentAt = new Date().toISOString();
        const activationLink = `${baseUrl}/#activate?token=${token}&userId=${encodeURIComponent(u.id || uid)}&clubId=${encodeURIComponent(vereinsId)}`;

        const memberName =
          u.klarname ||
          (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}`.trim() : "") ||
          u.name ||
          "Mitglied";

        try {
          await sendNotificationMail({
            eventKey: "USER_ACTIVATION",
            recipientEmail: email,
            recipientName: memberName,
            payload: {
              user_name: memberName,
              club_name: clubName || "Tennis-Club e.V.",
              activation_link: activationLink,
              link_validity_hours: String(validityHours),
            },
            customTemplate: activeTemplate,
            clubName: clubName || "Tennis-Club e.V.",
            vereinsId,
          });

          await updateDoc(resolved.docRef, {
            activationToken: token,
            activationTokenExpiresAt: expiresAt,
            activationSentAt: sentAt,
          });

          updatedTimestamps[uid] = sentAt;
          sentCount++;
        } catch (subErr: any) {
          console.error(`Bulk send activation failed for user ${uid}:`, subErr);
          skippedUsers.push({ id: uid, name: memberName, reason: subErr.message || "Versandfehler" });
          failedCount++;
        }
      }

      return res.json({
        success: true,
        sentCount,
        failedCount,
        skippedUsers,
        updatedTimestamps,
        message: `Aktivierungs-Mails an ${sentCount} Mitglied(er) erfolgreich versendet.${failedCount > 0 ? ` (${failedCount} übersprungen)` : ""}`,
      });
    } catch (err: any) {
      console.error("Error in /api/admin/users/bulk-send-activation:", err);
      return res.status(500).json({
        success: false,
        error: "BULK_ACTIVATION_FAILED",
        message: err.message || "Fehler bei der Massenaktivierung.",
      });
    }
  });

  // 12. AUTH: Verify Token (Activation or Reset)
  app.get("/api/auth/verify-token", async (req: express.Request, res: express.Response) => {
    try {
      const { token, userId } = req.query as { token?: string; userId?: string };
      if (!token || !userId) {
        return res.status(400).json({ valid: false, error: "MISSING_PARAMS", message: "Token und Benutzer-ID erforderlich." });
      }

      const resolved = await resolveUserDoc(userId);
      if (!resolved || !resolved.data) {
        return res.status(404).json({ valid: false, error: "USER_NOT_FOUND", message: "Benutzerkonto nicht gefunden." });
      }

      const u = resolved.data;
      const isActivation = token.startsWith("act_");
      const isReset = token.startsWith("rst_");

      let storedToken = "";
      let expiresAt = "";

      if (isActivation) {
        storedToken = u.activationToken || "";
        expiresAt = u.activationTokenExpiresAt || "";
      } else if (isReset) {
        storedToken = u.passwordResetToken || "";
        expiresAt = u.passwordResetTokenExpiresAt || "";
      } else {
        storedToken = u.activationToken === token ? u.activationToken : (u.passwordResetToken || "");
        expiresAt = u.activationToken === token ? (u.activationTokenExpiresAt || "") : (u.passwordResetTokenExpiresAt || "");
      }

      if (!storedToken || storedToken !== token) {
        return res.status(400).json({
          valid: false,
          error: "INVALID_TOKEN",
          message: "Dieser Sicherheits-Link ist ungültig oder wurde bereits verwendet.",
        });
      }

      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return res.status(400).json({
          valid: false,
          error: "TOKEN_EXPIRED",
          message: "Dieser Sicherheits-Link ist abgelaufen. Bitte fordere einen neuen Link an.",
        });
      }

      return res.json({
        valid: true,
        type: isActivation ? "activation" : "reset",
        user: {
          id: u.id,
          name: u.name,
          klarname: u.klarname || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
          email: u.email,
        },
      });
    } catch (err: any) {
      console.error("Error in /api/auth/verify-token:", err);
      return res.status(500).json({ valid: false, error: "VERIFY_FAILED", message: err.message });
    }
  });

  // 13. AUTH: Setup / Reset Password with Token
  app.post("/api/auth/setup-password", async (req: express.Request, res: express.Response) => {
    try {
      const { token, userId, newPassword } = req.body || {};
      if (!token || !userId || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "MISSING_DATA",
          message: "Token, Benutzer-ID und neues Passwort erforderlich.",
        });
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: "PASSWORD_TOO_SHORT",
          message: "Das Passwort muss mindestens 6 Zeichen lang sein.",
        });
      }

      const resolved = await resolveUserDoc(userId);
      if (!resolved || !resolved.data) {
        return res.status(404).json({
          success: false,
          error: "USER_NOT_FOUND",
          message: "Benutzerkonto nicht gefunden.",
        });
      }

      const u = resolved.data;
      const isActivation = token.startsWith("act_") || u.activationToken === token;
      const storedToken = isActivation ? u.activationToken : u.passwordResetToken;
      const expiresAt = isActivation ? u.activationTokenExpiresAt : u.passwordResetTokenExpiresAt;

      if (!storedToken || storedToken !== token) {
        return res.status(400).json({
          success: false,
          error: "INVALID_TOKEN",
          message: "Dieser Sicherheits-Link ist ungültig oder wurde bereits verwendet.",
        });
      }

      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          error: "TOKEN_EXPIRED",
          message: "Dieser Sicherheits-Link ist abgelaufen. Bitte fordere einen neuen Link an.",
        });
      }

      // Update password and clear used token, mark active
      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        password: newPassword,
        passwort: newPassword,
        mustChangePassword: false,
        lastLogin: now,
        lastLoginAt: now,
        status: "active",
      };

      if (isActivation) {
        updateData.activationToken = null;
        updateData.activationTokenExpiresAt = null;
        updateData.activatedAt = now;
      } else {
        updateData.passwordResetToken = null;
        updateData.passwordResetTokenExpiresAt = null;
        updateData.passwordResetAt = now;
      }

      await updateDoc(resolved.docRef, updateData);

      return res.json({
        success: true,
        message: isActivation
          ? "Konto erfolgreich aktiviert und persönliches Passwort gespeichert!"
          : "Passwort erfolgreich zurückgesetzt!",
        username: u.name,
      });
    } catch (err: any) {
      console.error("Error in /api/auth/setup-password:", err);
      return res.status(500).json({
        success: false,
        error: "SETUP_PASSWORD_FAILED",
        message: err.message || "Fehler beim Speichern des neuen Passworts.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
