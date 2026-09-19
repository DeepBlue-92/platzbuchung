const KNOWN_CLUBS: Record<string, string> = {
  "svn": "SV Neuhausen",
  "sv-neuhausen": "SV Neuhausen",
  "svneuhausen": "SV Neuhausen",
  "djk": "DJK Furth",
  "djk-furth": "DJK Furth",
  "djkfurth": "DJK Furth",
  "djk_furth": "DJK Furth",
  "furth": "DJK Furth",
  "tcsportsgeist": "TC Sportsgeist",
  "tc-sportsgeist": "TC Sportsgeist",
  "sportsgeist": "TC Sportsgeist",
};

const TECHNICAL_CLUB_IDS = new Set([
  "system",
  "admin",
  "super-admin",
  "superadmin",
  "hauptadmin",
  "null",
  "undefined",
  "verein",
  "ehemaliger-verein",
  "ehemaligerverein",
  "unknown",
  "none",
  "test",
]);

export function isTechnicalClubId(clubId?: string): boolean {
  if (!clubId) return true;
  const clean = clubId.toLowerCase().trim().replace(/[\s_-]/g, "");
  return TECHNICAL_CLUB_IDS.has(clean) || clean === "";
}

export function getCanonicalClubId(raw?: string): string {
  if (!raw || isTechnicalClubId(raw)) return "";
  const clean = raw.toLowerCase().trim().replace(/[\s_-]/g, "");
  if (clean.includes("neuhausen") || clean === "svn") return "sv-neuhausen";
  if (clean.includes("furth") || clean.includes("djk")) return "djk-furth";
  if (clean.includes("sportsgeist")) return "tcsportsgeist";
  return clean;
}

export function getSanitizedClubDisplayName(raw?: string, clubsList?: any[]): string {
  if (!raw || isTechnicalClubId(raw)) return "";
  const canonical = getCanonicalClubId(raw);
  if (canonical === "sv-neuhausen") return "SV Neuhausen";
  if (canonical === "djk-furth") return "DJK Furth";
  if (canonical === "tcsportsgeist") return "TC Sportsgeist";
  const resolved = resolveClubName(raw, undefined, clubsList);
  if (!resolved || isTechnicalClubId(resolved)) return "";
  return resolved;
}

export function getClubLogoUrl(raw?: string, clubsList?: any[]): string | undefined {
  if (!raw || isTechnicalClubId(raw)) return undefined;
  const canonical = getCanonicalClubId(raw);

  // 1. Direct match in provided clubsList
  if (Array.isArray(clubsList) && clubsList.length > 0) {
    const matched = clubsList.find((c: any) => {
      const cId = getCanonicalClubId(c.vereinsId || c.id || c.clubName || c.name);
      return cId === canonical;
    });
    if (matched) {
      if (matched.customLogoUrl) return matched.customLogoUrl;
      if (matched.logoUrl) return matched.logoUrl;
    }
  }

  // 2. Local storage cache check
  try {
    const clubsCacheStr = localStorage.getItem("v2_clubs_cache");
    if (clubsCacheStr) {
      const clubs = JSON.parse(clubsCacheStr);
      if (Array.isArray(clubs)) {
        const match = clubs.find(
          (c: any) => getCanonicalClubId(c.vereinsId || c.id || c.clubName) === canonical
        );
        if (match) {
          if (match.customLogoUrl) return match.customLogoUrl;
          if (match.logoUrl) return match.logoUrl;
        }
      }
    }
  } catch (e) {
    // Ignore cache read error
  }

  // 3. Known default crests / favicons
  if (canonical === "sv-neuhausen") return "/images/wappen_svn_login.png";
  if (canonical === "djk-furth") return "/images/wappen_djk_furth_login.png";
  if (canonical === "tcsportsgeist") return "/images/wappen_tc_sportsgeist_login.png";

  return undefined;
}

export function resolveClubName(clubId: string, fallbackName?: string, clubsList?: any[]): string {
  if (!clubId || isTechnicalClubId(clubId)) return fallbackName || "Verein";
  
  // 1. Direct match in provided clubsList
  if (Array.isArray(clubsList) && clubsList.length > 0) {
    const cleanTarget = clubId.toLowerCase().replace(/[\s_-]/g, "");
    const match = clubsList.find((c: any) => {
      const cId = (c.vereinsId || c.id || "").toLowerCase().replace(/[\s_-]/g, "");
      return cId === cleanTarget;
    });
    if (match) {
      return match.clubName || match.vereinsName || match.name || match.vereinsId;
    }
  }

  // 2. Check localStorage cache
  try {
    const clubsCacheStr = localStorage.getItem("v2_clubs_cache");
    if (clubsCacheStr) {
      const clubs = JSON.parse(clubsCacheStr);
      const cleanTarget = clubId.toLowerCase().replace(/[\s_-]/g, "");
      const match = clubs.find((c: any) => (c.vereinsId || c.id || "").toLowerCase().replace(/[\s_-]/g, "") === cleanTarget);
      if (match) {
        return match.clubName || match.vereinsName || match.name || match.vereinsId;
      }
    }
  } catch (e) {
    console.error("Error resolving club name", e);
  }

  // 3. Known fallback dictionary
  const cleanId = clubId.toLowerCase().replace(/[\s_-]/g, "");
  for (const [key, name] of Object.entries(KNOWN_CLUBS)) {
    if (key.replace(/[\s_-]/g, "") === cleanId) {
      return name;
    }
  }

  // 4. Heuristic pattern recognition
  if (cleanId.includes("neuhausen")) return "SV Neuhausen";
  if (cleanId.includes("furth") || cleanId.includes("djk")) return "DJK Furth";
  if (cleanId.includes("sportsgeist")) return "TC Sportsgeist";

  if (fallbackName && fallbackName !== "Ehemaliger Verein") {
    return fallbackName;
  }

  // 5. Clean Title-Case formatted fallback instead of generic "Ehemaliger Verein"
  const formatted = clubId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

  return formatted || "Verein";
}


