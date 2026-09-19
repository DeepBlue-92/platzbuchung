import { User, Person, UserClub, Role } from '../types';

/**
 * Standardizes club IDs to canonical formats to prevent duplicates and mismatched lookups.
 * e.g., 'svneuhausen' -> 'sv-neuhausen', 'tc-sportsgeist' -> 'tcsportsgeist', 'djkfurth' -> 'djk-furth'
 */
export function getCanonicalClubId(id: any): string {
  if (!id) return '';
  const s = String(id).trim().toLowerCase().replace(/[\s\-_]/g, '');
  if (s.includes('neuhausen')) return 'sv-neuhausen';
  if (s.includes('furth')) return 'djk-furth';
  if (s.includes('sportsgeist')) return 'tcsportsgeist';
  return s;
}

/**
 * Generates clean 2-3 letter initials for a club to use as a fallback badge.
 */
export function getClubInitials(name?: string): string {
  if (!name) return 'V';
  const clean = String(name).trim();
  const lower = clean.toLowerCase();
  if (lower.includes('neuhausen')) return 'SVN';
  if (lower.includes('furth')) return 'DJK';
  if (lower.includes('sportsgeist')) return 'TCS';

  const words = clean.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 3).toUpperCase();
}

/**
 * Verified base master data for known clubs to guarantee accurate names and badges
 * even with legacy or incomplete account references.
 */
export const KNOWN_CLUBS_STAMMDATEN: Record<string, { clubName: string; logoUrl: string; city?: string; street?: string; zip?: string }> = {
  'sv-neuhausen': {
    clubName: 'SV Neuhausen',
    logoUrl: '/images/wappen_svn_login.png',
    city: 'Neuhausen',
    street: 'Deggendorfer Str. 18',
    zip: '94560',
  },
  'djk-furth': {
    clubName: 'DJK Furth',
    logoUrl: '/images/wappen_djk_furth_login.png',
    city: 'Furth',
    street: 'Am Sportplatz 1',
    zip: '84095',
  },
  'tcsportsgeist': {
    clubName: 'TC Sportsgeist',
    logoUrl: '/images/wappen_tc_sportsgeist_login.png',
    city: 'Landshut',
    street: 'Tennisweg 4',
    zip: '84036',
  },
};

/**
 * Extracts and normalizes the list of clubs for a user or person.
 * Robust against legacy formats (single string `vereinsId`, `tenantId`, `clubId`, `clubIds`, `clubs`).
 */
export function getUserClubs(user: Partial<User | Person> | null | undefined, systemClubs?: any[]): UserClub[] {
  if (!user || typeof user !== 'object') return [];

  const clubMap = new Map<string, UserClub>();

  const getSystemClubMeta = (vId: string) => {
    if (!systemClubs || !Array.isArray(systemClubs)) return null;
    const norm = getCanonicalClubId(vId);
    return systemClubs.find((c) => {
      const cId = getCanonicalClubId(c.vereinsId || c.id || '');
      return cId === norm;
    }) || null;
  };

  const addClub = (
    rawId: any,
    rawName?: string,
    role?: Role,
    logoUrl?: string,
    facilityPhotoUrl?: string,
    street?: string,
    zip?: string,
    city?: string
  ) => {
    if (!rawId) return;
    const vId = typeof rawId === 'string' ? rawId.trim() : String(rawId.vereinsId || rawId.id || '').trim();
    if (!vId) return;
    const canonicalKey = getCanonicalClubId(vId);
    if (!canonicalKey || ['super-admin', 'system', 'api', 'null', 'undefined'].includes(canonicalKey)) return;

    if (!clubMap.has(canonicalKey)) {
      const sysMeta = getSystemClubMeta(canonicalKey);
      const knownMeta = KNOWN_CLUBS_STAMMDATEN[canonicalKey];

      // Dynamic name resolution: Prefer current system master data
      let cleanName: string | undefined = undefined;

      if (sysMeta && (sysMeta.clubName || sysMeta.vereinsName || sysMeta.name)) {
        cleanName = sysMeta.clubName || sysMeta.vereinsName || sysMeta.name;
      }

      if (!cleanName && knownMeta?.clubName) {
        cleanName = knownMeta.clubName;
      }

      // Check rawName or rawId if valid and not an internal ID or personal user name
      if (!cleanName) {
        const candidateName = rawName || (typeof rawId === 'object' ? (rawId.clubName || rawId.vereinsName || rawId.name) : undefined);
        if (candidateName && typeof candidateName === 'string') {
          const trimmed = candidateName.trim();
          const lower = trimmed.toLowerCase();
          const isInvalid = 
            ['api', 'system', 'super-admin', 'default', 'null', 'undefined', 'verein', 'tennis-club', 'tennis club', 'tennisclub'].includes(lower) ||
            lower === canonicalKey ||
            (user && (trimmed === user.name || trimmed === user.klarname || `${user.firstName || ''} ${user.lastName || ''}`.trim() === trimmed));
          if (!isInvalid) {
            cleanName = trimmed;
          }
        }
      }

      if (!cleanName) {
        if (canonicalKey.includes('neuhausen')) cleanName = 'SV Neuhausen';
        else if (canonicalKey.includes('furth')) cleanName = 'DJK Furth';
        else if (canonicalKey.includes('sportsgeist')) cleanName = 'TC Sportsgeist';
        else cleanName = vId;
      }

      // Prioritize login / loading screen logo as per specification
      const cleanLogo = 
        sysMeta?.customLogoUrl || 
        sysMeta?.logoUrl || 
        sysMeta?.customHeaderLogoUrl || 
        sysMeta?.headerLogoUrl ||
        logoUrl || 
        (typeof rawId === 'object' ? (rawId.customLogoUrl || rawId.logoUrl || rawId.customHeaderLogoUrl || rawId.headerLogoUrl) : undefined) ||
        knownMeta?.logoUrl;

      const cleanFacilityPhoto = facilityPhotoUrl || 
        (typeof rawId === 'object' ? rawId.facilityPhotoUrl : undefined) ||
        sysMeta?.facilityPhotoUrl;

      clubMap.set(canonicalKey, {
        vereinsId: canonicalKey,
        clubName: cleanName || canonicalKey,
        role: role || (typeof rawId === 'object' ? rawId.role : undefined) || user.role || Role.MITGLIED,
        logoUrl: cleanLogo,
        facilityPhotoUrl: cleanFacilityPhoto,
        street: street || (typeof rawId === 'object' ? rawId.street : undefined) || sysMeta?.street || knownMeta?.street,
        zip: zip || (typeof rawId === 'object' ? rawId.zip : undefined) || sysMeta?.zip || knownMeta?.zip,
        city: city || (typeof rawId === 'object' ? rawId.city : undefined) || sysMeta?.city || knownMeta?.city,
      });
    }
  };

  // 1. Array in user.clubs
  if (Array.isArray(user.clubs)) {
    user.clubs.forEach((item: any) => {
      if (typeof item === 'string') {
        addClub(item);
      } else if (item && typeof item === 'object') {
        addClub(
          item.vereinsId || item.id,
          item.clubName || item.vereinsName || item.name,
          item.role,
          item.logoUrl,
          item.facilityPhotoUrl,
          item.street,
          item.zip,
          item.city
        );
      }
    });
  }

  // 2. Array in user.clubIds
  if (Array.isArray((user as any).clubIds)) {
    (user as any).clubIds.forEach((item: any) => {
      addClub(item);
    });
  }

  // 3. Array in user.memberships
  if (Array.isArray((user as any).memberships)) {
    (user as any).memberships.forEach((item: any) => {
      if (typeof item === 'string') {
        addClub(item);
      } else if (item && typeof item === 'object') {
        addClub(
          item.vereinsId || item.clubId || item.id,
          item.clubName || item.vereinsName || item.name,
          item.role,
          item.logoUrl,
          item.facilityPhotoUrl,
          item.street,
          item.zip,
          item.city
        );
      }
    });
  }

  // 4. Singular fields: user.vereinsId, user.tenantId, user.clubId, user.vereinId
  const singularId = user.vereinsId || (user as any).tenantId || (user as any).clubId || (user as any).vereinId;
  if (singularId && typeof singularId === 'string') {
    addClub(singularId, undefined, user.role);
  }

  return Array.from(clubMap.values()).sort((a, b) => 
    a.clubName.localeCompare(b.clubName, 'de', { sensitivity: 'base' })
  );
}

/**
 * Checks if a user has Super Admin privileges.
 */
export function isSuperAdmin(user: Partial<User | Person> | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === Role.SUPER_ADMIN ||
    (user.role as any) === 'super-admin' ||
    user.id === 'superadmin' ||
    (user as any).username?.toLowerCase() === 'superadmin' ||
    user.name?.toLowerCase() === 'superadmin' ||
    user.vereinsId === 'super-admin' ||
    (user as any).tenantId === 'system'
  );
}

/**
 * Context-aware check if a user is an Admin in the specified club context.
 * Super Admins are automatically admins across all clubs.
 */
export function isClubAdmin(
  user: Partial<User | Person> | null | undefined,
  currentClubId?: string | null,
  systemClubs?: any[]
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!currentClubId) {
    return user.role === Role.ADMIN || (user.role as any) === 'admin' || user.hauptAdmin === true;
  }

  const normTarget = String(currentClubId).toLowerCase().replace(/\s/g, '');
  const clubs = getUserClubs(user, systemClubs);
  const matchedClub = clubs.find(c => String(c.vereinsId).toLowerCase().replace(/\s/g, '') === normTarget);

  if (matchedClub) {
    return matchedClub.role === Role.ADMIN || (matchedClub.role as any) === 'admin';
  }

  // Fallback: check if user's singular vereinsId matches target and role is admin
  const singularId = user.vereinsId || (user as any).tenantId || (user as any).clubId || (user as any).vereinId;
  if (singularId && String(singularId).toLowerCase().replace(/\s/g, '') === normTarget) {
    return user.role === Role.ADMIN || (user.role as any) === 'admin' || user.hauptAdmin === true;
  }

  return false;
}

/**
 * Checks if a user is a member of a specific club.
 */
export function isUserMemberOfClub(user: Partial<User | Person> | null | undefined, vereinsId: string): boolean {
  if (!user || !vereinsId) return false;
  const normTarget = String(vereinsId).toLowerCase().replace(/\s/g, '');
  const clubs = getUserClubs(user);
  return clubs.some(c => String(c.vereinsId).toLowerCase().replace(/\s/g, '') === normTarget);
}
