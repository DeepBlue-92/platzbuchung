import React, { useState, useEffect, useRef } from "react";
import { User, Person } from "../types";
import { UserAvatar, TennisBallSvg, TennisRacketSvg } from "./UserAvatar";
import { AvatarCropModal } from "./AvatarCropModal";
import {
  validateAvatarFile,
  AVATAR_ICON_OPTIONS,
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
} from "lucide-react";

interface AvatarUploaderProps {
  user: Partial<User | Person>;
  userId: string;
  avatarUrl?: string | null;
  avatarIcon?: string | null;
  onChange: (data: { avatarUrl?: string | null; avatarIcon?: string | null }) => void;
  primaryColor?: string;
  hideTitle?: boolean;
  compact?: boolean;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  user,
  userId,
  avatarUrl: explicitUrl,
  avatarIcon: explicitIcon,
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

  const activeAvatarUrl = internalAvatarUrl !== undefined ? internalAvatarUrl : user?.avatarUrl;
  const activeAvatarIcon = internalAvatarIcon || user?.avatarIcon || "initials";

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [showIconSelector, setShowIconSelector] = useState(false);

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
      onChange({ avatarUrl: result.avatarUrl, avatarIcon: null });
      setSuccessInfo("Foto erfolgreich gespeichert.");
    } else {
      // Foto wurde entfernt
      setInternalAvatarUrl(null);
      setInternalAvatarIcon(activeAvatarIcon || "initials");
      onChange({ avatarUrl: null, avatarIcon: activeAvatarIcon || "initials" });
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
      onChange({ avatarUrl: null, avatarIcon: activeAvatarIcon || "initials" });
      setSuccessInfo("Profilbild erfolgreich entfernt.");
    } catch (err) {
      console.warn("Fehler beim Entfernen:", err);
    }
  };

  const handleSelectIcon = (iconId: string) => {
    setInternalAvatarUrl(null);
    setInternalAvatarIcon(iconId);
    onChange({ avatarUrl: null, avatarIcon: iconId });
    setSuccessInfo("Icon erfolgreich ausgewählt.");
  };

  return (
    <div
      className={`bg-slate-50 border border-slate-200/80 rounded-2xl ${
        compact ? "p-2.5 sm:p-3 space-y-2.5" : "p-4 space-y-4"
      }`}
    >
      <div className={`flex flex-col sm:flex-row items-center ${compact ? "gap-3" : "gap-4"}`}>
        {/* Avatar Display */}
        <div className="relative group shrink-0">
          <UserAvatar
            user={user}
            avatarUrl={activeAvatarUrl}
            avatarIcon={activeAvatarIcon}
            size={compact ? "lg" : "xl"}
            showBorder
            borderColor="border-white shadow-md"
            className="ring-2 ring-slate-200"
          />

          {activeAvatarUrl && (
            <button
              type="button"
              onClick={() => {
                setSelectedImageSrc(activeAvatarUrl);
                setCropModalOpen(true);
              }}
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors cursor-pointer"
              title="Ausschnitt anpassen"
            >
              <Crop className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
        </div>

        {/* Content & Actions */}
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
          {!hideTitle && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Profilbild &amp; Avatar
              </h4>
            </div>
          )}

          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {activeAvatarUrl
              ? "Dein aktuelles Profilbild. Du kannst jederzeit ein neues hochladen oder ein Icon wählen."
              : "Lade ein Foto hoch oder wähle eines unserer Sport-Icons als Profilbild."}
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
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
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[var(--color-primary)] text-slate-700 hover:text-[var(--color-primary)] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Bild hochladen
            </button>

            <button
              type="button"
              onClick={() => setShowIconSelector(!showIconSelector)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Icon wählen
            </button>

            {activeAvatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Icons
            </span>
          </div>

          <div className="grid grid-cols-6 gap-3 items-center justify-items-center py-1">
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

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectIcon(opt.id)}
                  title={opt.name}
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center ${opt.bgClass} ${opt.colorClass} shadow-2xs transition-all duration-150 cursor-pointer outline-none ${
                    isSelected
                      ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-white scale-105"
                      : "hover:scale-105 active:scale-95"
                  }`}
                >
                  {opt.id === "initials" && <span className="font-black text-sm sm:text-base tracking-wider">{initials}</span>}
                  {opt.id === "tennis-ball" && <TennisBallSvg className="w-5 h-5" />}
                  {opt.id === "racket" && <TennisRacketSvg className="w-5 h-5" />}
                  {opt.id === "trophy" && <Trophy className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "medal" && <Medal className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "flame" && <Flame className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "shield" && <Shield className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "crown" && <Crown className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "star" && <Star className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "coffee" && <Coffee className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "beer" && <Beer className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "sunglasses" && <Sunglasses className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "dumbbell" && <Dumbbell className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "zap" && <Zap className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "target" && <Target className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "rocket" && <Rocket className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "heart" && <Heart className="w-5 h-5" strokeWidth={2.2} />}
                  {opt.id === "user" && <UserIcon className="w-5 h-5" strokeWidth={2.2} />}
                </button>
              );
            })}
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
