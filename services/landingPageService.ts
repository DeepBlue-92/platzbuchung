import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
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
      title: "Wetter & Platzkondition",
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

const VALID_TYPES = [
  "hero_banner",
  "rich_text",
  "worklet_courts",
  "worklet_events",
  "worklet_championship",
  "worklet_weather",
];

export const formatConfig = (data: Partial<LandingPageConfig>): LandingPageConfig => ({
  is_enabled: data.is_enabled !== undefined ? Boolean(data.is_enabled) : true,
  nav_order: Array.isArray(data.nav_order) ? data.nav_order : undefined,
  items: Array.isArray(data.items)
    ? data.items.map((it, idx) => ({
        id: it.id || `bento_${idx + 1}`,
        type: VALID_TYPES.includes(it.type as any) ? it.type : "rich_text",
        col_span: ([4, 6, 8, 12].includes(it.col_span as any) ? it.col_span : 6) as 4 | 6 | 8 | 12,
        order: typeof it.order === "number" ? it.order : idx,
        title: it.title !== undefined ? it.title : "Information",
        content: it.content || "",
        default_view: it.default_view === "week" ? "week" : "day",
        eyebrow: it.eyebrow || undefined,
        image_url: it.image_url || undefined,
        bg_color_start: it.bg_color_start || undefined,
        bg_color_end: it.bg_color_end || undefined,
        cta_text: it.cta_text || undefined,
        cta_link: it.cta_link || undefined,
        city: it.city || undefined,
        latitude: typeof it.latitude === "number" && !isNaN(it.latitude) ? it.latitude : undefined,
        longitude: typeof it.longitude === "number" && !isNaN(it.longitude) ? it.longitude : undefined,
      }))
    : DEFAULT_LANDING_PAGE.items,
  updatedAt: data.updatedAt,
  updatedBy: data.updatedBy,
});

/**
 * Single-read landing page config loader with sessionStorage caching.
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

  // 1. First attempt: Read directly from the club document (vereine/{normId})
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
 * Real-time listener for landing page configuration changes in Firestore.
 */
export function listenToLandingPageConfig(
  vereinsId: string | undefined,
  callback: (config: LandingPageConfig) => void
): () => void {
  const normId = getNormalizedVereinsId(vereinsId);
  const cacheKey = getCacheKey(normId);

  // Set initial cache if present
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        callback(parsed as LandingPageConfig);
      }
    }
  } catch {}

  const clubDocRef = doc(db, "vereine", normId);
  const unsub = onSnapshot(
    clubDocRef,
    (snap) => {
      if (snap.exists() && snap.data()?.landing_page_config) {
        const config = formatConfig(snap.data()!.landing_page_config);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(config));
        } catch {}
        callback(config);
      } else {
        // Fallback check on subcollection
        getDoc(doc(db, "vereine", normId, "settings", "landing_page"))
          .then((subSnap) => {
            if (subSnap.exists()) {
              const cfg = formatConfig(subSnap.data() as Partial<LandingPageConfig>);
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify(cfg));
              } catch {}
              callback(cfg);
            } else {
              callback(DEFAULT_LANDING_PAGE);
            }
          })
          .catch(() => {
            callback(DEFAULT_LANDING_PAGE);
          });
      }
    },
    (err) => {
      console.warn("listenToLandingPageConfig snapshot error:", err);
    }
  );

  return unsub;
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

  const payload: LandingPageConfig = {
    is_enabled: config.is_enabled !== undefined ? Boolean(config.is_enabled) : true,
    nav_order: config.nav_order || undefined,
    items: (config.items || []).map((it, idx) => {
      const cleanItem: BentoItem = {
        id: it.id || `bento_${idx + 1}`,
        type: VALID_TYPES.includes(it.type) ? it.type : "rich_text",
        col_span: ([4, 6, 8, 12].includes(it.col_span) ? it.col_span : 6) as 4 | 6 | 8 | 12,
        order: typeof it.order === "number" ? it.order : idx,
        title: (it.title || "").trim(),
        content: (it.content || "").trim(),
      };
      if (it.default_view) cleanItem.default_view = it.default_view === "week" ? "week" : "day";
      if (it.eyebrow?.trim()) cleanItem.eyebrow = it.eyebrow.trim();
      if (it.image_url?.trim()) cleanItem.image_url = it.image_url.trim();
      if (it.bg_color_start?.trim()) cleanItem.bg_color_start = it.bg_color_start.trim();
      if (it.bg_color_end?.trim()) cleanItem.bg_color_end = it.bg_color_end.trim();
      if (it.cta_text?.trim()) cleanItem.cta_text = it.cta_text.trim();
      if (it.cta_link?.trim()) cleanItem.cta_link = it.cta_link.trim();
      if (it.city?.trim()) cleanItem.city = it.city.trim();
      if (typeof it.latitude === "number" && !isNaN(it.latitude)) cleanItem.latitude = it.latitude;
      if (typeof it.longitude === "number" && !isNaN(it.longitude)) cleanItem.longitude = it.longitude;
      return cleanItem;
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: authorName || "Admin",
  };

  // Strip any accidental undefined values
  const cleanPayload = JSON.parse(JSON.stringify(payload));

  // Save to the club document (always authorized for club admins under existing rules)
  try {
    await setDoc(doc(db, "vereine", normId), { landing_page_config: cleanPayload }, { merge: true });
  } catch (e) {
    console.warn("Failed writing landing_page_config to club document:", e);
  }

  // Also save to settings subcollection for compatibility
  try {
    const docRef = doc(db, "vereine", normId, "settings", "landing_page");
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (e) {
    console.warn("Failed writing landing_page_config to subcollection:", e);
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(cleanPayload));
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
