import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";

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
