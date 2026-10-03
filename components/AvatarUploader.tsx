import React, { useState, useEffect, useRef } from "react";
import { User, Person } from "../types";
import { UserAvatar, TennisBallSvg, TennisRacketSvg, hexToRgba } from "./UserAvatar";
import { AvatarCropModal } from "./AvatarCropModal";
import {
  validateAvatarFile,
  AVATAR_ICON_OPTIONS,
  AVATAR_COLOR_PRESETS,
  deleteAvatarFromStorage,
} from "../services/avatarStorage";
import {
  Upload,
  Crop,
  Trash2,
  Sparkles,
  Trophy,
  Star,
  Flame,
  User as UserIcon,
  AlertCircle,
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
  ShieldCheck,
  Palette,
  Pipette,
  Check,
  RotateCcw,
} from "lucide-react";

interface AvatarUploaderProps {
  user: Partial<User | Person>;
  userId: string;
  avatarUrl?: string | null;
  avatarIcon?: string | null;
  avatarColor?: string | null;
  onChange: (data: { avatarUrl?: string | null; avatarIcon?: string | null; avatarColor?: string | null }) => void;
  primaryColor?: string;
  hideTitle?: boolean;
  compact?: boolean;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  user,
  userId,
  avatarUrl: explicitUrl,
  avatarIcon: explicitIcon,
  avatarColor: explicitColor,
  onChange,
  primaryColor = "var(--color-primary)",
  hideTitle = false,
  compact = false,
}) => {
  const [internalAvatarUrl, setInternalAvatarUrl] = useState<string | null | undefined>(
    explicitUrl !== undefined ? explicitUrl : user?.avatarUrl
  );
  const [internalAvatarIcon, setInternalAvatarIcon] = useState<string>(
    explicitIcon !== undefined && explicitIcon !== null
      ? explicitIcon
      : user?.avatarIcon || "initials"
  );
  const [internalAvatarColor, setInternalAvatarColor] = useState<string | null | undefined>(
    explicitColor !== undefined ? explicitColor : (user as any)?.avatarColor || null
  );

  useEffect(() => {
    if (explicitUrl !== undefined) {
      setInternalAvatarUrl(explicitUrl);
    } else if (user?.avatarUrl !== undefined) {
      setInternalAvatarUrl(user.avatarUrl);
    }
  }, [explicitUrl, user?.avatarUrl]);

  useEffect(() => {
    if (explicitIcon !== undefined && explicitIcon !== null) {
      setInternalAvatarIcon(explicitIcon);
    } else if (user?.avatarIcon) {
      setInternalAvatarIcon(user.avatarIcon);
    }
  }, [explicitIcon, user?.avatarIcon]);

  useEffect(() => {
    if (explicitColor !== undefined) {
      setInternalAvatarColor(explicitColor);
    } else if ((user as any)?.avatarColor !== undefined) {
      setInternalAvatarColor((user as any).avatarColor);
    }
  }, [explicitColor, (user as any)?.avatarColor]);

  const activeAvatarUrl = internalAvatarUrl !== undefined ? internalAvatarUrl : user?.avatarUrl;
  const activeAvatarIcon = internalAvatarIcon || user?.avatarIcon || "initials";
  const activeAvatarColor = internalAvatarColor !== undefined ? internalAvatarColor : ((user as any)?.avatarColor || null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [showIconSelector, setShowIconSelector] = useState(!explicitUrl && !user?.avatarUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setSuccessInfo(null);

    // 1. VALIDIERUNG VOR DEM READ:
    // Format (JPEG, PNG, WEBP, HEIC) & Größe (max 10 MB)
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Ungültige Datei.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Einlesen im Browser
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setCropModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setErrorMessage("Fehler beim Einlesen des Bildes.");
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleCropConfirm = (result: { avatarUrl: string | null; sizeKB?: number }) => {
    if (result.avatarUrl) {
      setInternalAvatarUrl(result.avatarUrl);
      setInternalAvatarIcon("initials");
      setShowIconSelector(false);
      onChange({ avatarUrl: result.avatarUrl, avatarIcon: null, avatarColor: activeAvatarColor });
      setSuccessInfo("Foto erfolgreich gespeichert.");
    } else {
      // Foto wurde entfernt
      setInternalAvatarUrl(null);
      setInternalAvatarIcon(activeAvatarIcon || "initials");
      onChange({ avatarUrl: null, avatarIcon: activeAvatarIcon || "initials", avatarColor: activeAvatarColor });
      setSuccessInfo("Profilbild erfolgreich entfernt.");
    }
  };

  const handleRemoveAvatar = async () => {
    setErrorMessage(null);
    try {
      if (activeAvatarUrl) {
        await deleteAvatarFromStorage(activeAvatarUrl);
      }
      setInternalAvatarUrl(null);
      setInternalAvatarIcon(activeAvatarIcon || "initials");
      onChange({ avatarUrl: null, avatarIcon: activeAvatarIcon || "initials", avatarColor: activeAvatarColor });
      setSuccessInfo("Profilbild erfolgreich entfernt.");
    } catch (err) {
      console.warn("Fehler beim Entfernen:", err);
    }
  };

  const handleSelectIcon = (iconId: string) => {
    setInternalAvatarUrl(null);
    setInternalAvatarIcon(iconId);
    onChange({ avatarUrl: null, avatarIcon: iconId, avatarColor: activeAvatarColor });
  };

  const handleSelectColor = (color: string | null) => {
    setSuccessInfo(null);
    setInternalAvatarColor(color);
    onChange({ avatarUrl: activeAvatarUrl, avatarIcon: activeAvatarIcon, avatarColor: color });
  };

  const isPresetColor = Boolean(
    activeAvatarColor &&
    AVATAR_COLOR_PRESETS.some(
      (p) => p.value.toLowerCase() === activeAvatarColor.toLowerCase()
    )
  );
  const isCustomColor = Boolean(activeAvatarColor && !isPresetColor);

  return (
    <div
      className={`bg-slate-50/70 border border-slate-200/80 rounded-2xl ${
        compact ? "p-3 space-y-3" : "p-4 sm:p-5 space-y-4"
      }`}
    >
      <div className={`flex flex-col sm:flex-row items-center ${compact ? "gap-3" : "gap-4"}`}>
        {/* Avatar Display */}
        <div className="relative group shrink-0">
          <UserAvatar
            user={user}
            avatarUrl={activeAvatarUrl}
            avatarIcon={activeAvatarIcon}
            avatarColor={activeAvatarColor}
            size={compact ? "lg" : "xl"}
            showBorder
            borderColor="border-white shadow-xs"
            className="ring-2 ring-slate-200/80"
          />

          {activeAvatarUrl && (
            <button
              type="button"
              onClick={() => {
                setSelectedImageSrc(activeAvatarUrl);
                setCropModalOpen(true);
              }}
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-slate-300 shadow-xs flex items-center justify-center text-slate-600 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors cursor-pointer"
              title="Ausschnitt anpassen"
            >
              <Crop className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
        </div>

        {/* Content & Actions */}
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
          {!hideTitle && (
            <h4 className="text-sm font-bold text-slate-900 tracking-tight">
              Profilbild &amp; Avatar
            </h4>
          )}

          <p className="text-xs text-slate-500 font-normal leading-relaxed">
            {activeAvatarUrl
              ? "Aktuelles Profilbild gespeichert. Du kannst jederzeit ein neues Foto hochladen oder ein Icon wählen."
              : "Lade ein Foto hoch oder wähle eines unserer Sport-Icons als Profilbild."}
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
            <input
              ref={fileInputRef}
              id="avatar-file-upload-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/*"
              onChange={handleInputChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                fileInputRef.current?.click();
              }}
              className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Bild hochladen
            </button>

            <button
              type="button"
              onClick={() => setShowIconSelector(!showIconSelector)}
              className={`h-9 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                showIconSelector
                  ? "bg-amber-50/80 border-amber-300 text-amber-900 ring-2 ring-amber-400/20"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Icon &amp; Farbe wählen
            </button>

            {activeAvatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Foto entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Entfernen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Icon Selector Drawer / Grid (Zero Storage Cost) */}
      {showIconSelector && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Icons
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2.5 sm:gap-3 items-center justify-items-center py-1.5">
            {AVATAR_ICON_OPTIONS.map((opt) => {
              const isSelected = !activeAvatarUrl && activeAvatarIcon === opt.id;
              
              // Helper to compute initials just for the button
              const displayName = user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.firstName || user?.name || user?.klarname || "TK";
              const parts = displayName.trim().split(/\s+/);
              const initials = parts.length >= 2 
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
                : displayName.slice(0, 2).toUpperCase();

              // If a custom color is active and this icon is selected, preview it in the custom color
              const buttonCustomStyle = isSelected && activeAvatarColor
                ? {
                    backgroundColor: hexToRgba(activeAvatarColor, 0.18),
                    color: activeAvatarColor,
                  }
                : {};

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectIcon(opt.id)}
                  title={opt.name}
                  style={buttonCustomStyle}
                  className={`w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected && activeAvatarColor ? "" : `${opt.bgClass} ${opt.colorClass}`
                  } shadow-2xs transition-all duration-150 cursor-pointer outline-none ${
                    isSelected
                      ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-white font-bold"
                      : "hover:scale-105 active:scale-95 opacity-85 hover:opacity-100"
                  }`}
                >
                  {opt.id === "initials" && <span className="font-bold text-xs tracking-wider select-none">{initials}</span>}
                  {opt.id === "user" && <UserIcon className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "tennis-ball" && <TennisBallSvg className="w-4.5 h-4.5 shrink-0" color={isSelected && activeAvatarColor ? activeAvatarColor : undefined} />}
                  {opt.id === "racket" && <TennisRacketSvg className="w-4.5 h-4.5 shrink-0" />}
                  {opt.id === "trophy" && <Trophy className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "medal" && <Medal className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "flame" && <Flame className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "shield" && <Shield className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "crown" && <Crown className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "star" && <Star className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "coffee" && <Coffee className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "beer" && <Beer className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "sunglasses" && <Sunglasses className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "dumbbell" && <Dumbbell className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "zap" && <Zap className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "target" && <Target className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "rocket" && <Rocket className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                  {opt.id === "heart" && <Heart className="w-4.5 h-4.5 shrink-0" strokeWidth={2} />}
                </button>
              );
            })}
          </div>

          {/* Farbzeile */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-500" />
                Farbe
              </span>
              {activeAvatarColor && (
                <button
                  type="button"
                  onClick={() => handleSelectColor(null)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1 hover:underline transition-colors cursor-pointer"
                  title="Auf Standard zurücksetzen"
                >
                  <RotateCcw className="w-3 h-3" />
                  Zurücksetzen
                </button>
              )}
            </div>

            {/* Farbpalette */}
            <div className="flex items-center justify-between gap-1.5 py-0.5 max-w-md">
              {AVATAR_COLOR_PRESETS.map((preset) => {
                const isSelected = activeAvatarColor?.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleSelectColor(preset.value)}
                    title={preset.name}
                    className={`flex-1 aspect-square max-w-[30px] min-w-[20px] rounded-full transition-all duration-150 cursor-pointer relative flex items-center justify-center shadow-2xs outline-none ${
                      isSelected
                        ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-white scale-110 z-10"
                        : "hover:scale-110 active:scale-95"
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-white drop-shadow-xs" strokeWidth={3} />
                    )}
                  </button>
                );
              })}

              {/* Pipette / Regenbogen-Knopf */}
              <label
                title={isCustomColor ? `Eigene Farbe: ${activeAvatarColor}` : "Beliebige eigene Farbe wählen"}
                className={`flex-1 aspect-square max-w-[30px] min-w-[20px] rounded-full transition-all duration-150 relative flex items-center justify-center cursor-pointer shadow-2xs outline-none ${
                  isCustomColor
                    ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-white scale-110 z-10"
                    : "border border-slate-300 hover:border-slate-500 hover:scale-110 active:scale-95 bg-linear-to-tr from-rose-400 via-amber-300 via-emerald-400 to-indigo-500"
                }`}
                style={isCustomColor ? { backgroundColor: activeAvatarColor } : {}}
              >
                <input
                  type="color"
                  value={activeAvatarColor || "#1b4332"}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                {isCustomColor ? (
                  <Check className="w-3 h-3 text-white drop-shadow-xs" strokeWidth={3} />
                ) : (
                  <Pipette className="w-3 h-3 text-white drop-shadow-xs" />
                )}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Notice */}
      {successInfo && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successInfo}</span>
        </div>
      )}

      {/* Cropper Modal */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={selectedImageSrc}
        userId={userId}
        currentAvatarUrl={internalAvatarUrl}
        onClose={() => {
          setCropModalOpen(false);
          setSelectedImageSrc(null);
        }}
        onConfirm={handleCropConfirm}
        primaryColor={primaryColor}
      />
    </div>
  );
};

