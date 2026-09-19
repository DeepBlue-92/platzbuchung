import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  cropAndCompressAvatar,
  uploadAvatarToStorage,
  deleteAvatarFromStorage,
  CompressedAvatarResult,
  MAX_AVATAR_BLOB_SIZE_BYTES,
} from "../services/avatarStorage";
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, ShieldCheck, Check, Trash2, X, Loader2 } from "lucide-react";

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  userId: string;
  currentAvatarUrl?: string | null;
  onClose: () => void;
  onConfirm: (result: { avatarUrl: string | null; sizeKB?: number }) => void;
  primaryColor?: string;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  userId,
  currentAvatarUrl,
  onClose,
  onConfirm,
  primaryColor = "var(--color-primary)",
}) => {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<CompressedAvatarResult | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  if (!isOpen || !imageSrc) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(3, prev + 0.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(1, prev - 0.2));
  const handleResetZoom = () => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus("Bild wird verarbeitet...");

    try {
      // 1. Zuschnitt & dynamische Kompression
      const result = await cropAndCompressAvatar(imageSrc, croppedAreaPixels);
      setPreviewResult(result);
      setProcessingStatus("Wird gespeichert...");

      // 2. Upload in Storage mit sicherem Fallback
      let downloadUrl = result.dataUrl;
      try {
        downloadUrl = await uploadAvatarToStorage(
          userId,
          result.blob,
          currentAvatarUrl,
          5000
        );
      } catch (uploadErr) {
        console.warn(
          "Cloud Storage Upload nicht erreichbar oder verzögert. Speichere komprimiertes Bild direkt:",
          uploadErr
        );
        downloadUrl = result.dataUrl;
      }

      onConfirm({ avatarUrl: downloadUrl, sizeKB: result.sizeKB });
      onClose();
    } catch (err: any) {
      console.error("Fehler beim Verarbeiten des Avatars:", err);
      setErrorMessage(
        err.message || "Fehler beim Verarbeiten des Bildes. Bitte erneut versuchen."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsProcessing(true);
    setProcessingStatus("Wird gespeichert...");
    try {
      if (currentAvatarUrl) {
        await deleteAvatarFromStorage(currentAvatarUrl);
      }
      onConfirm({ avatarUrl: null });
      onClose();
    } catch (err: any) {
      console.error("Fehler beim Entfernen:", err);
      setErrorMessage("Konnte Foto nicht entfernen.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (!isProcessing && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="border-none outline-none bg-white rounded-2xl sm:rounded-3xl shadow-2xl -200 w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 isolate">
        {/* Header */}
        <div
          className="w-full px-5 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between text-white select-none rounded-none shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wider text-white truncate leading-none">
              Profilbild anpassen
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            title="Schließen"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop Stage */}
        <div className="relative w-full h-72 sm:h-80 bg-slate-950 overflow-hidden select-none">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />

          {/* Guide hint */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold pointer-events-none z-10 flex items-center gap-1.5 shadow-md">
            <span>Verschieben &amp; Zoomen zum Anpassen</span>
          </div>
        </div>

        {/* Controls */}
        <div className="p-5 space-y-4 bg-slate-50 border-t border-slate-200">
          {/* Zoom Slider & Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={isProcessing || zoom <= 1}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-700 disabled:opacity-40 transition-colors shadow-2xs"
              title="Verkleinern"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
              />
              <span className="text-[10px] font-black text-slate-500 w-8 text-right">
                {zoom.toFixed(1)}x
              </span>
            </div>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={isProcessing || zoom >= 3}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-700 disabled:opacity-40 transition-colors shadow-2xs"
              title="Vergrößern"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              disabled={isProcessing || (zoom === 1 && crop.x === 0 && crop.y === 0)}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-500 disabled:opacity-40 transition-colors shadow-2xs"
              title="Zurücksetzen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Info & Status */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>{processingStatus || "Wird gespeichert..."}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            {currentAvatarUrl ? (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isProcessing}
                className="w-full sm:w-auto h-8 px-3 py-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Foto entfernen
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
