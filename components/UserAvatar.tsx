import React, { useState, useEffect } from "react";
import { User, Person } from "../types";
import {
  Trophy,
  Star,
  Flame,
  User as UserIcon,
  Medal,
  Zap,
  Shield,
  Crown,
  Beer,
  Coffee,
  Glasses as Sunglasses,
  Dumbbell,
  Target,
  Rocket,
  Heart,
} from "lucide-react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;

const KNOWN_ICON_IDS = new Set([
  "tennis-ball",
  "racket",
  "trophy",
  "medal",
  "flame",
  "zap",
  "shield",
  "crown",
  "star",
  "beer",
  "coffee",
  "sunglasses",
  "dumbbell",
  "target",
  "rocket",
  "heart",
  "user",
]);

export interface UserAvatarProps {
  user?: Partial<User | Person> | null;
  avatarUrl?: string | null;
  avatarIcon?: string | null;
  name?: string;
  initials?: string;
  size?: AvatarSize;
  className?: string;
  showBorder?: boolean;
  borderColor?: string;
  fallbackMode?: "initials" | "icon";
  variant?: "green" | "dark" | "neutral" | "default";
}

export type PlayerAvatarProps = UserAvatarProps;

const sizeClasses: Record<string, { box: string; icon: string; text: string }> = {
  xs: { box: "w-6 h-6", icon: "w-3.5 h-3.5", text: "text-[9px]" },
  sm: { box: "w-8 h-8", icon: "w-4 h-4", text: "text-xs" },
  md: { box: "w-10 h-10", icon: "w-5 h-5", text: "text-sm" },
  lg: { box: "w-14 h-14", icon: "w-7 h-7", text: "text-lg" },
  xl: { box: "w-20 h-20", icon: "w-10 h-10", text: "text-2xl" },
  "2xl": { box: "w-28 h-28", icon: "w-14 h-14", text: "text-3xl" },
};

/**
 * 0-Byte Bandwidth Tennisball Vektor SVG
 */
export const TennisBallSvg: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="10" fill="#c3d928" stroke="#a3b817" strokeWidth="1.5" />
    <path
      d="M4.5 5.5C8 8.5 8 15.5 4.5 18.5"
      stroke="#ffffff"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.5 5.5C16 8.5 16 15.5 19.5 18.5"
      stroke="#ffffff"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 0-Byte Bandwidth Tennisschläger Vektor SVG
 */
export const TennisRacketSvg: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <ellipse cx="14.5" cy="9.5" rx="6.5" ry="7.5" transform="rotate(45 14.5 9.5)" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Bespannung */}
    <path d="M12 4.5L17 14.5" stroke="currentColor" strokeWidth="0.75" opacity="0.6" strokeDasharray="1.5 1.5" />
    <path d="M9.5 7L19.5 12" stroke="currentColor" strokeWidth="0.75" opacity="0.6" strokeDasharray="1.5 1.5" />
    {/* Griff & Schaft */}
    <path d="M9.2 14.8L4 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M3.5 19.5L4.5 20.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  avatarUrl: explicitUrl,
  avatarIcon: explicitIcon,
  name: explicitName,
  initials: explicitInitials,
  size = "md",
  className = "",
  showBorder = false,
  borderColor = "border-white",
  fallbackMode = "initials",
  variant = "default",
}) => {
  const url = explicitUrl !== undefined ? explicitUrl : user?.avatarUrl;
  const rawIconId = explicitIcon !== undefined ? explicitIcon : user?.avatarIcon;

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [url]);

  // Name ermitteln für Initialen oder Alt-Text
  const displayName =
    explicitName ||
    (user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.name || user?.klarname || "Benutzer");

  const getInitials = (str: string) => {
    if (!str) return "";
    const clean = str.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (!clean) return "";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0] || "").toUpperCase();
  };

  const initials = explicitInitials || (user as any)?.initials || getInitials(displayName);

  // Größenklassen auflösen
  const sizeConfig =
    typeof size === "string" ? sizeClasses[size] || sizeClasses.md : null;

  const dynamicStyle: React.CSSProperties =
    typeof size === "number"
      ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }
      : {};

  const borderClass = showBorder ? `border-2 ${borderColor}` : "";

  // 1. HIERARCHIE-STUFE 1: Wenn Bild-URL vorhanden ist und noch kein Ladefehler aufgetreten ist:
  // Rendere WebP/Bild im runden Badge mit object-cover rounded-full
  if (url && !imageError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none shadow-xs ${
          sizeConfig ? sizeConfig.box : ""
        } ${borderClass} ${className}`}
        style={dynamicStyle}
        title={displayName}
      >
        <img
          src={url}
          alt={displayName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    );
  }

  // 2. HIERARCHIE-STUFE 2: Welches Icon soll angezeigt werden?
  let iconId = "user"; // Standard fallback
  
  if (rawIconId === "initials" && initials) {
    iconId = "initials";
  } else if (rawIconId && KNOWN_ICON_IDS.has(rawIconId)) {
    iconId = rawIconId;
  } else if (initials && fallbackMode === "initials") {
    iconId = "initials";
  }

  const hasCustomBg = className.includes("bg-");
  let defaultBg = "bg-[var(--color-primary)] text-white font-black";
  if (variant === "green") {
    defaultBg = "bg-emerald-600 text-white font-black";
  } else if (variant === "dark") {
    defaultBg = "bg-slate-700 text-slate-100 font-bold";
  } else if (variant === "neutral") {
    defaultBg = "bg-slate-200 text-slate-700 font-bold";
  }

  const iconBg =
    iconId === "tennis-ball"
      ? "bg-slate-900/5 text-amber-600"
      : iconId === "racket"
      ? "bg-emerald-50 text-emerald-700"
      : iconId === "trophy"
      ? "bg-yellow-50 text-yellow-700"
      : iconId === "medal"
      ? "bg-amber-50 text-amber-700"
      : iconId === "flame"
      ? "bg-rose-50 text-rose-600"
      : iconId === "zap"
      ? "bg-yellow-50 text-yellow-600"
      : iconId === "shield"
      ? "bg-blue-50 text-blue-700"
      : iconId === "crown"
      ? "bg-purple-50 text-purple-700"
      : iconId === "star"
      ? "bg-indigo-50 text-indigo-700"
      : iconId === "coffee"
      ? "bg-amber-50 text-amber-800"
      : iconId === "beer"
      ? "bg-orange-50 text-orange-700"
      : iconId === "sunglasses"
      ? "bg-amber-50 text-amber-700"
      : iconId === "dumbbell"
      ? "bg-slate-100 text-slate-700"
      : iconId === "target"
      ? "bg-red-50 text-red-600"
      : iconId === "rocket"
      ? "bg-violet-50 text-violet-700"
      : iconId === "heart"
      ? "bg-pink-50 text-pink-600"
      : iconId === "user"
      ? "bg-slate-100 text-slate-500"
      : defaultBg;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none transition-colors shadow-xs ${
        sizeConfig ? sizeConfig.box : ""
      } ${borderClass} ${hasCustomBg ? "" : iconBg} ${className}`}
      style={dynamicStyle}
      title={displayName}
    >
      {iconId === "tennis-ball" && (
        <TennisBallSvg className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} />
      )}
      {iconId === "racket" && (
        <TennisRacketSvg className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} />
      )}
      {iconId === "trophy" && (
        <Trophy className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "medal" && (
        <Medal className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "flame" && (
        <Flame className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "zap" && (
        <Zap className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "shield" && (
        <Shield className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "crown" && (
        <Crown className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "star" && (
        <Star className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "beer" && (
        <Beer className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "coffee" && (
        <Coffee className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "sunglasses" && (
        <Sunglasses className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "dumbbell" && (
        <Dumbbell className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "target" && (
        <Target className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "rocket" && (
        <Rocket className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "heart" && (
        <Heart className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "user" && (
        <UserIcon className={sizeConfig ? sizeConfig.icon : "w-1/2 h-1/2"} strokeWidth={2.2} />
      )}
      {iconId === "initials" && (
        <span className={`font-black tracking-wider uppercase ${sizeConfig ? sizeConfig.text : "text-xs"}`}>
          {initials}
        </span>
      )}
    </div>
  );
};

export const PlayerAvatar = UserAvatar;
