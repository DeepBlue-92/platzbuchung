import React, { useState, useMemo, useEffect } from 'react';

/**
 * Konfigurierbare Bildpfade für die Vereinswappen im Hobbyliga-Banner.
 * Beinhaltet SV Neuhausen, DJK Furth und TC Sportsgeist.
 */
export const DEFAULT_BANNER_CREST_1 = "/images/wappen_svn_login.png";
export const DEFAULT_BANNER_CREST_2 = "/images/wappen_djk_furth_login.png";
export const DEFAULT_BANNER_CREST_3 = "/images/wappen_tc_sportsgeist_login.png";

export interface BannerClubItem {
  id: string;
  name: string;
  logoUrl?: string;
  fallbackSrc?: string;
  alt?: string;
  variant?: 1 | 2 | 3;
  scale?: number;
}

export const DEFAULT_BANNER_CLUBS: BannerClubItem[] = [
  {
    id: "sv-neuhausen",
    name: "SV Neuhausen",
    logoUrl: DEFAULT_BANNER_CREST_1,
    fallbackSrc: "/images/wappen_svn_login.webp",
    alt: "SV Neuhausen Wappen",
    variant: 1,
  },
  {
    id: "djk-furth",
    name: "DJK Furth",
    logoUrl: DEFAULT_BANNER_CREST_2,
    fallbackSrc: "/images/wappen_djk_furth_login.webp",
    alt: "DJK Furth Wappen",
    variant: 2,
  },
];

/**
 * Mathematische Symmetrie-Anordnung für das bereinigte Array aktiver Liga-Vereine:
 * - Ungerade Anzahl (z. B. 1 oder 3):
 *   Das Haupt-/Zentrum-Logo steht exakt in der Mitte (vertikale Mittelachse),
 *   die verbleibenden Partner-Vereine verteilen sich paarweise gleichmäßig links und rechts.
 * - Gerade Anzahl (z. B. 2 oder 4):
 *   Achsensymmetrische Verteilung um die vertikale Mittelachse (gleicher Abstand nach links und rechts).
 */
export function arrangeSymmetricalClubs(clubs: BannerClubItem[]): BannerClubItem[] {
  if (!clubs || clubs.length <= 1) {
    return clubs || [];
  }

  const count = clubs.length;

  // Ungerade Anzahl aktiver Vereine (z. B. 1 oder 3)
  if (count % 2 === 1) {
    if (count === 3) {
      // Zentriertes Logo in der Mitte (clubs[0]), links clubs[1], rechts clubs[2]
      return [clubs[1], clubs[0], clubs[2]];
    }
    const center = clubs[0];
    const left: BannerClubItem[] = [];
    const right: BannerClubItem[] = [];
    for (let i = 1; i < count; i += 2) {
      left.unshift(clubs[i]);
      if (i + 1 < count) {
        right.push(clubs[i + 1]);
      }
    }
    return [...left, center, ...right];
  }

  // Gerade Anzahl aktiver Vereine (z. B. 2 oder 4):
  // Achsensymmetrische Verteilung um die vertikale Mitte
  if (count === 2) {
    return [clubs[0], clubs[1]];
  }

  if (count === 4) {
    return [clubs[2], clubs[0], clubs[1], clubs[3]];
  }

  return clubs;
}

interface HobbyligaBannerProps {
  pointsText: string;
  rankText: string;
  hasActiveScheduledMatch?: boolean;
  onOpenResultDrawer?: () => void;
  crestLeftUrl?: string;
  crestRightUrl?: string;
  clubs?: BannerClubItem[];
}

/**
 * Einzelnes Wasserzeichen-Wappen:
 * Skaliert alle Wappen/Logos einheitlich exakt auf die Höhe des DJK-Furth-Logos.
 * Schaltet bei Fehler oder fehlender lokaler Datei nahtlos auf ein SVG-Schild-Wappen um.
 */
const WatermarkCrest: React.FC<{
  src?: string;
  fallbackSrc?: string;
  alt: string;
  variant?: 1 | 2 | 3;
  scale?: number;
  className?: string;
}> = ({ src, fallbackSrc, alt, variant = 1, scale = 1, className = "" }) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className={`relative h-11 sm:h-14 md:h-16 w-auto transition-all duration-300 flex items-center justify-center shrink-0 ${className}`}>
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          onError={handleError}
          referrerPolicy="no-referrer"
          className="h-full w-auto max-h-full object-contain filter drop-shadow-[0px_2px_8px_rgba(0,0,0,0.7)]"
          style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
        />
      ) : null}

      {/* SVG Placeholder / Fallback Shield falls Datei lokal fehlt */}
      {hasError || !currentSrc ? (
        <svg
          viewBox="0 0 100 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-auto aspect-[100/120] text-white/95 filter drop-shadow-[0px_2px_8px_rgba(0,0,0,0.7)]"
        >
          {/* Shield Outline */}
          <path
            d="M50 4L12 18V56C12 84 50 114 50 114C50 114 88 84 88 56V18L50 4Z"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner Border */}
          <path
            d="M50 12L20 23V54C20 76 50 102 50 102C50 102 80 76 80 54V23L50 12Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            strokeDasharray="3 3"
          />
          {variant === 1 ? (
            /* Variant 1: Crossed Tennis Rackets Emblem */
            <g transform="translate(50, 52) scale(0.65)" stroke="currentColor" strokeWidth="2.5" fill="none">
              {/* Racket 1 */}
              <ellipse cx="-12" cy="-14" rx="16" ry="20" transform="rotate(-30 -12 -14)" />
              <line x1="-4" y1="2" x2="18" y2="38" strokeWidth="3.5" strokeLinecap="round" />
              {/* Racket 2 */}
              <ellipse cx="12" cy="-14" rx="16" ry="20" transform="rotate(30 12 -14)" />
              <line x1="4" y1="2" x2="-18" y2="38" strokeWidth="3.5" strokeLinecap="round" />
              {/* Tennis Ball */}
              <circle cx="0" cy="-6" r="6" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
            </g>
          ) : variant === 2 ? (
            /* Variant 2: Heraldic Chevron & Crown / Ball Emblem */
            <g transform="translate(50, 52) scale(0.65)" stroke="currentColor" strokeWidth="2.5" fill="none">
              {/* Heraldic Chevrons */}
              <path d="M-24 -8 L0 -24 L24 -8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M-24 6 L0 -10 L24 6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {/* Star / Laurel Emblem */}
              <circle cx="0" cy="18" r="8" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
              <path d="M-12 18 C-12 28, 0 32, 0 32 C0 32, 12 28, 12 18" strokeWidth="2" strokeLinecap="round" />
            </g>
          ) : (
            /* Variant 3: Tennis Ball Emblem */
            <g transform="translate(50, 54) scale(0.65)" stroke="currentColor" strokeWidth="2.5" fill="none">
              <circle cx="0" cy="0" r="22" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.8" />
              <path d="M-15 -15 C-5 -5, -5 5, -15 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M15 -15 C5 -5, 5 5, 15 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      ) : null}
    </div>
  );
};

export const HobbyligaBanner: React.FC<HobbyligaBannerProps> = ({
  pointsText,
  rankText,
  hasActiveScheduledMatch = false,
  onOpenResultDrawer,
  crestLeftUrl,
  crestRightUrl,
  clubs,
}) => {
  const displayClubs = useMemo(() => {
    let rawClubs: BannerClubItem[];
    if (clubs && clubs.length > 0) {
      rawClubs = clubs;
    } else if (crestLeftUrl && crestRightUrl && !clubs) {
      rawClubs = [
        {
          id: "crest-1",
          name: "Verein 1",
          logoUrl: crestLeftUrl,
          fallbackSrc: "/images/wappen_svn_login.png",
          alt: "Vereinswappen 1",
          variant: 1 as const,
        },
        {
          id: "crest-2",
          name: "Verein 2",
          logoUrl: crestRightUrl,
          fallbackSrc: "/images/wappen_djk_furth_login.png",
          alt: "Vereinswappen 2",
          variant: 2 as const,
        },
      ];
    } else {
      rawClubs = DEFAULT_BANNER_CLUBS;
    }

    // Strikte Filterung: Nur Vereine mit aktivierter Liga im Banner anzeigen
    const filtered = rawClubs.filter((c: any) => {
      if (!c) return false;
      if (c.modules) {
        if (c.modules.liga === false || c.modules.league === false) return false;
      }
      if (c.isLigaActive === false || c.enableLeague === false) return false;

      // TC Sportsgeist hat das Modul LIGA deaktiviert - strikt filtern, außer es ist explizit aktiv
      const key = (c.id || c.vereinsId || c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key.includes('sportsgeist')) {
        const isExplicitActive =
          c.modules?.liga === true ||
          c.modules?.league === true ||
          c.isLigaActive === true ||
          c.enableLeague === true;
        if (!isExplicitActive) {
          return false;
        }
      }
      return true;
    });

    // Mathematische Symmetrie-Logik auf das bereinigte Array anwenden
    return arrangeSymmetricalClubs(filtered);
  }, [clubs, crestLeftUrl, crestRightUrl]);

  return (
    <div className="relative w-full h-[46px] sm:h-[98px] md:h-[105px] rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex items-center bg-slate-900 border border-slate-200">
      {/* Background Cover Image: positioniert auf center 25% für perfekten Kopfausschnitt */}
      <img 
        src="https://raw.githubusercontent.com/DeepBlue-92/platzbuchung/5d032958bd4003163d9a57f31aa0e5dc4b4e801a/public/images/collage_3.png" 
        onError={(e) => {
          // Fallback to secondary path if primary path is missing
          (e.target as HTMLImageElement).src = "/images/collage_2.png";
        }}
        alt="Hobbyliga Collage" 
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
      />

      {/* Dark gradient overlay with increased transparency for better banner visibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-900/35 to-slate-950/60"></div>

      {/* Zentrum: Mathematisch symmetrisch zentrierte Vereins-Wappen der teilnehmenden Liga-Vereine (NUR AUF DESKTOP/TABLET, MOBIL ENTFERNT) */}
      <div 
        className={`hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${
          displayClubs.length === 2 
            ? 'gap-6 sm:gap-8 md:gap-12' 
            : 'gap-3 sm:gap-5 md:gap-7'
        } opacity-98 pointer-events-none select-none z-0 max-w-[48%] sm:max-w-[56%] md:max-w-[62%]`}
        aria-hidden="true"
      >
        {displayClubs.map((club, idx) => (
          <WatermarkCrest
            key={club.id || idx}
            src={club.logoUrl}
            fallbackSrc={club.fallbackSrc}
            alt={club.alt || `${club.name} Wappen`}
            variant={club.variant || ((idx % 3 === 0 ? 1 : idx % 3 === 1 ? 2 : 3) as 1 | 2 | 3)}
            scale={club.scale}
            className="scale-95 sm:scale-100 origin-center filter drop-shadow-[0px_2px_8px_rgba(0,0,0,0.6)]"
          />
        ))}
      </div>

      {/* Foreground Content: Links = Titel "Hobbyliga", Rechts = Badge für Punkte & Rang */}
      <div className="relative z-10 px-3.5 sm:px-6 md:px-8 py-1.5 sm:py-3 flex items-center justify-between w-full h-full">
        {/* Links: Nur Hauptüberschrift */}
        <div className="flex items-center shrink-0">
          <h2 
            className="text-base sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-white drop-shadow-md whitespace-nowrap"
            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
          >
            Hobbyliga
          </h2>
        </div>
        
        {/* Rechts: Badge für Punkte und Rang ganz am rechten Rand mit opakem Hintergrund */}
        <div className="flex items-center shrink-0 ml-auto z-10">
          <div className="inline-flex items-center gap-1.5 sm:gap-3 px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-black/65 backdrop-blur-md border border-white/20 text-white shadow-md">
            <span className="font-black text-xs sm:text-sm md:text-base tracking-normal flex items-center gap-1.5 whitespace-nowrap">
              {pointsText}
            </span>
            <span className="text-white/40 font-light">|</span>
            <span className="font-bold text-[11px] sm:text-xs md:text-sm text-slate-200 tracking-normal whitespace-nowrap">
              {rankText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

