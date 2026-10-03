import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getNormalizedVereinsId } from "./db";
import { LandingPageConfig, BentoItem } from "../types";

export const DEFAULT_LANDING_PAGE: LandingPageConfig = {
  is_enabled: true,
  items: [
    {
      id: "bento_1",
      type: "rich_text",
      col_span: 8,
      order: 0,
      eyebrow: "AKTUELLES & NEWS",
      title: "Willkommen bei der DJK Furth",
      content:
        "Hier stehen wichtige Ankündigungen, Termine und Informationen rund um die Tennisabteilung. Entdecke unsere Plätze, Veranstaltungen und aktuellen Ranglisten.",
    },
    {
      id: "bento_weather",
      type: "worklet_weather",
      col_span: 4,
      order: 1,
      eyebrow: "CLUB-WETTER",
      title: "Wetter & Platz-Kondition",
      city: "Furth",
      latitude: 48.59,
      longitude: 12.02,
      content: "",
    },
    {
      id: "bento_courts",
      type: "worklet_courts",
      col_span: 8,
      order: 2,
      eyebrow: "PLATZRESERVIERUNG",
      title: "Live-Belegungsplan",
      default_view: "day",
      content: "",
    },
    {
      id: "bento_events",
      type: "worklet_events",
      col_span: 4,
      order: 3,
      eyebrow: "TERMINE & TURNIERE",
      title: "Veranstaltungen",
      content: "",
    },
  ],
};

function getCacheKey(normId: string): string {
  return `v2_landing_page_${normId}`;
}

/**
 * Single-read landing page config loader with sessionStorage caching.
 * Prevents repetitive Firestore reads during tab navigation.
 */
export async function getLandingPageConfig(
  vereinsId?: string,
  bypassCache: boolean = false
): Promise<LandingPageConfig> {
  const normId = getNormalizedVereinsId(vereinsId);
  const cacheKey = getCacheKey(normId);

  if (!bypassCache) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
          return parsed as LandingPageConfig;
        }
      }
    } catch (e) {
      console.warn("Failed reading landing page cache:", e);
    }
  }

  const VALID_TYPES = ["rich_text", "worklet_courts", "worklet_events", "worklet_championship", "worklet_weather"];

  const formatConfig = (data: Partial<LandingPageConfig>): LandingPageConfig => ({
    is_enabled: Boolean(data.is_enabled),
    nav_order: Array.isArray(data.nav_order) ? data.nav_order : undefined,
    items: Array.isArray(data.items) && data.items.length > 0
      ? data.items.map((it, idx) => ({
          id: it.id || `bento_${idx + 1}`,
          type: VALID_TYPES.includes(it.type as any) ? it.type : "rich_text",
          col_span: [4, 6, 8, 12].includes(it.col_span as any) ? it.col_span : 6,
          order: typeof it.order === "number" ? it.order : idx,
          title: it.title || "Information",
          content: it.content || "",
          default_view: it.default_view === "week" ? "week" : "day",
          eyebrow: it.eyebrow || undefined,
          city: it.city || undefined,
          latitude: typeof it.latitude === "number" ? it.latitude : undefined,
          longitude: typeof it.longitude === "number" ? it.longitude : undefined,
        }))
      : DEFAULT_LANDING_PAGE.items,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  });

  // 1. First attempt: Read directly from the club document (vereine/{normId})
  // This document has public read access rules in all Firestore configurations.
  try {
    const clubSnap = await getDoc(doc(db, "vereine", normId));
    if (clubSnap.exists() && clubSnap.data()?.landing_page_config) {
      const config = formatConfig(clubSnap.data()!.landing_page_config);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(config));
      } catch {}
      return config;
    }
  } catch (err) {
    // If club doc read failed, continue to fallback
  }

  // 2. Second attempt: Check the nested subcollection (vereine/{normId}/settings/landing_page)
  try {
    const docRef = doc(db, "vereine", normId, "settings", "landing_page");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as Partial<LandingPageConfig>;
      const config = formatConfig(data);

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(config));
      } catch (err) {
        console.warn("Failed caching landing page config:", err);
      }

      return config;
    }
  } catch (err) {
    // Silently handle subcollection permissions/missing doc and fall back to default
  }

  // Fallback to default
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(DEFAULT_LANDING_PAGE));
  } catch {}
  return DEFAULT_LANDING_PAGE;
}

/**
 * Saves landing page config with writes to both the club document and settings subcollection.
 */
export async function saveLandingPageConfig(
  vereinsId: string | undefined,
  config: LandingPageConfig,
  authorName?: string
): Promise<void> {
  const normId = getNormalizedVereinsId(vereinsId);
  const cacheKey = getCacheKey(normId);

  const VALID_TYPES = ["rich_text", "worklet_courts", "worklet_events", "worklet_championship", "worklet_weather"];

  const payload: LandingPageConfig = {
    is_enabled: Boolean(config.is_enabled),
    nav_order: config.nav_order || undefined,
    items: config.items.map((it, idx) => ({
      id: it.id || `bento_${idx + 1}`,
      type: VALID_TYPES.includes(it.type) ? it.type : "rich_text",
      col_span: [4, 6, 8, 12].includes(it.col_span) ? it.col_span : 6,
      order: typeof it.order === "number" ? it.order : idx,
      title: (it.title || "").trim(),
      content: (it.content || "").trim(),
      default_view: it.default_view === "week" ? "week" : "day",
      eyebrow: (it.eyebrow || "").trim() || undefined,
      city: (it.city || "").trim() || undefined,
      latitude: typeof it.latitude === "number" && !isNaN(it.latitude) ? it.latitude : undefined,
      longitude: typeof it.longitude === "number" && !isNaN(it.longitude) ? it.longitude : undefined,
    })),
    updatedAt: new Date().toISOString(),
    updatedBy: authorName || "Admin",
  };

  // Save to the club document (always authorized for club admins under existing rules)
  try {
    await setDoc(doc(db, "vereine", normId), { landing_page_config: payload }, { merge: true });
  } catch (e) {
    console.warn("Failed writing landing_page_config to club document:", e);
  }

  // Also save to settings subcollection for compatibility
  try {
    const docRef = doc(db, "vereine", normId, "settings", "landing_page");
    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    console.warn("Failed writing landing_page_config to subcollection:", e);
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed updating landing page cache:", e);
  }
}

/**
 * Clears local cache for the specified club.
 */
export function clearLandingPageCache(vereinsId?: string): void {
  const normId = getNormalizedVereinsId(vereinsId);
  try {
    sessionStorage.removeItem(getCacheKey(normId));
  } catch {}
}
