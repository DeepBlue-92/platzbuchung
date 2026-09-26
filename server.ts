import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";
import {
  sendNotificationMail,
  getAllTemplates,
  saveCustomTemplate,
} from "./services/resendService";
import { renderEmail } from "./services/templateEngine";
import {
  bulkUpdateUserNotificationSettings,
  updateClubDefaultNotificationSettings,
  getClubDefaultNotificationSettings,
} from "./services/db";
import {
  broadcastHobbyligaNewPost,
  notifyMatchResultSubmitted,
} from "./services/notificationDispatcher";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const { subjectTemplate, bodyTemplate, payload, wrapperOptions } = req.body || {};
      const rendered = renderEmail({
        subjectTemplate: subjectTemplate || "",
        bodyTemplate: bodyTemplate || "",
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
