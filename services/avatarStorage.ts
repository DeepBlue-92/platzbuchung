import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../lib/firebase";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB vor dem Read
export const MAX_AVATAR_BLOB_SIZE_BYTES = 25 * 1024; // 25 KB Hard Limit für Firebase Storage
export const TARGET_DIMENSION = 200; // 200x200 px

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
}

export interface CompressedAvatarResult {
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
  sizeKB: number;
  width: number;
  height: number;
  quality: number;
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Validiert die Rohdatei vor dem Einlesen im Browser.
 * Prüft Dateityp (JPEG, PNG, WEBP, HEIC) und Dateigröße (max 10 MB).
 */
export function validateAvatarFile(file: File): AvatarValidationResult {
  if (!file) {
    return { valid: false, error: "Keine Datei ausgewählt." };
  }

  // 1. Größenprüfung vor dem Einlesen
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Die Datei ist mit ${sizeInMB} MB zu groß. Maximal erlaubt sind 10 MB.`,
    };
  }

  // 2. Formatprüfung (MIME-Type und Extension)
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

  const mimeValid = allowedMimeTypes.includes(file.type.toLowerCase());
  const extValid = allowedExtensions.includes(ext);

  if (!mimeValid && !extValid) {
    return {
      valid: false,
      error:
        "Ungültiges Dateiformat. Erlaubt sind ausschließlich JPEG, PNG, WEBP und HEIC.",
    };
  }

  return { valid: true };
}

export function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/webp";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Hilfsfunktion zum Erstellen eines HTMLImageElement aus Source
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // crossOrigin darf nur für HTTP(S) gesetzt werden, niemals für data: oder blob:
    if (url.startsWith("http://") || url.startsWith("https://")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
    }
  });
}

/**
 * Schneidet das Bild gemäß Ausschnitt zu, skaliert auf 200x200 Pixel
 * und komprimiert es dynamisch und robust.
 */
export async function cropAndCompressAvatar(
  imageSrc: string,
  pixelCrop: PixelCrop
): Promise<CompressedAvatarResult> {
  const image = await createImage(imageSrc);

  const dimension = TARGET_DIMENSION;
  const canvas = document.createElement("canvas");
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas Context konnte nicht initialisiert werden.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, dimension, dimension);

  const cropW = pixelCrop.width > 0 ? pixelCrop.width : (image.naturalWidth || dimension);
  const cropH = pixelCrop.height > 0 ? pixelCrop.height : (image.naturalHeight || dimension);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    cropW,
    cropH,
    0,
    0,
    dimension,
    dimension
  );

  // Synchrones, blockierungsfreies Generieren via toDataURL & dataURLToBlob
  // Dynamische Qualitätsanpassung, damit das Bild immer kompakt bleibt
  let finalBlob: Blob | null = null;
  let dataUrl = "";
  let quality = 0.8;

  const qualitySteps = [0.8, 0.7, 0.6, 0.5, 0.4];
  for (const q of qualitySteps) {
    quality = q;
    try {
      dataUrl = canvas.toDataURL("image/webp", q);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", q);
      }
      finalBlob = dataURLToBlob(dataUrl);
      if (finalBlob.size <= MAX_AVATAR_BLOB_SIZE_BYTES) {
        break;
      }
    } catch {
      // Weiterer Schritt
    }
  }

  if (!finalBlob || !dataUrl) {
    try {
      dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      finalBlob = dataURLToBlob(dataUrl);
    } catch {
      throw new Error("Fehler beim Komprimieren des Bildes.");
    }
  }

  const sizeKB = Number((finalBlob.size / 1024).toFixed(2));

  return {
    blob: finalBlob,
    dataUrl,
    sizeBytes: finalBlob.size,
    sizeKB,
    width: dimension,
    height: dimension,
    quality,
  };
}

/**
 * Lädt das komprimierte Avatar-Bild in Firebase Storage hoch.
 * Besitzt ein Timeout, damit der Vorgang bei Netzwerkproblemen niemals unendlich hängen bleibt.
 */
export async function uploadAvatarToStorage(
  userId: string,
  blob: Blob,
  oldAvatarUrl?: string | null,
  timeoutMs: number = 5000
): Promise<string> {
  const safeUserId = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, "_") : "user";
  const timestamp = Date.now();
  const filePath = `avatars/${safeUserId}_v${timestamp}.webp`;
  const storageRef = ref(storage, filePath);

  const metadata = {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  };

  const uploadTask = async (): Promise<string> => {
    await uploadBytes(storageRef, blob, metadata);
    const downloadUrl = await getDownloadURL(storageRef);

    if (oldAvatarUrl) {
      deleteAvatarFromStorage(oldAvatarUrl).catch(() => {});
    }

    return downloadUrl;
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Timeout beim Hochladen in den Cloud-Speicher.")),
      timeoutMs
    );
  });

  return await Promise.race([uploadTask(), timeoutPromise]);
}

/**
 * Löscht ein altes Avatar-Bild aus Firebase Storage
 */
export async function deleteAvatarFromStorage(avatarUrl: string): Promise<void> {
  if (!avatarUrl || typeof avatarUrl !== "string") return;

  // Nur Firebase Storage URLs löschen
  if (
    avatarUrl.includes("firebasestorage.googleapis.com") ||
    avatarUrl.includes("storage.googleapis.com")
  ) {
    try {
      const oldRef = ref(storage, avatarUrl);
      await deleteObject(oldRef);
    } catch (err) {
      // Schlägt z.B. fehl wenn das Bild bereits gelöscht oder der Link extern ist - silent ignore
      console.warn("Konnte vorherigen Avatar nicht aus Storage löschen:", err);
    }
  }
}

/**
 * Standard Vektor-Icons (Zero-Bandwidth Fallback)
 * Werden lokal im Frontend-Bundle gerendert und verbrauchen 0 Byte Firebase-Traffic!
 */
export interface AvatarIconOption {
  id: string;
  name: string;
  category: "sport" | "achievement" | "neutral";
  colorClass: string;
  bgClass: string;
}

export const AVATAR_ICON_OPTIONS: AvatarIconOption[] = [
  // Reihe 1: Basis & Tennis-Kern
  {
    id: "initials",
    name: "Initialen",
    category: "neutral",
    colorClass: "text-[var(--color-primary)]",
    bgClass: "bg-[var(--color-primary)]/10",
  },
  {
    id: "user",
    name: "Spieler",
    category: "neutral",
    colorClass: "text-slate-700",
    bgClass: "bg-slate-100",
  },
  {
    id: "tennis-ball",
    name: "Tennisball",
    category: "sport",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-100",
  },
  {
    id: "racket",
    name: "Tennisschläger",
    category: "sport",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-100",
  },
  {
    id: "trophy",
    name: "Pokal",
    category: "achievement",
    colorClass: "text-yellow-700",
    bgClass: "bg-yellow-100",
  },
  {
    id: "medal",
    name: "Medaille",
    category: "achievement",
    colorClass: "text-amber-700",
    bgClass: "bg-amber-100",
  },
  // Reihe 2: Tennis-Taktik & Vereinsleben
  {
    id: "flame",
    name: "Flamme",
    category: "achievement",
    colorClass: "text-rose-600",
    bgClass: "bg-rose-100",
  },
  {
    id: "shield",
    name: "Schild",
    category: "achievement",
    colorClass: "text-blue-700",
    bgClass: "bg-blue-100",
  },
  {
    id: "crown",
    name: "Krone",
    category: "achievement",
    colorClass: "text-purple-700",
    bgClass: "bg-purple-100",
  },
  {
    id: "star",
    name: "Stern",
    category: "achievement",
    colorClass: "text-indigo-700",
    bgClass: "bg-indigo-100",
  },
  {
    id: "coffee",
    name: "Kaffee",
    category: "neutral",
    colorClass: "text-amber-800",
    bgClass: "bg-amber-100",
  },
  {
    id: "beer",
    name: "Drinks",
    category: "neutral",
    colorClass: "text-orange-700",
    bgClass: "bg-orange-100",
  },
  // Reihe 3: Spielstil, Fitness & Leidenschaft
  {
    id: "sunglasses",
    name: "Sonnenbrille",
    category: "neutral",
    colorClass: "text-amber-700",
    bgClass: "bg-amber-100",
  },
  {
    id: "dumbbell",
    name: "Fitness",
    category: "sport",
    colorClass: "text-slate-700",
    bgClass: "bg-slate-200",
  },
  {
    id: "zap",
    name: "Blitz",
    category: "sport",
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-100",
  },
  {
    id: "target",
    name: "Zielscheibe",
    category: "sport",
    colorClass: "text-red-600",
    bgClass: "bg-red-100",
  },
  {
    id: "rocket",
    name: "Rakete",
    category: "achievement",
    colorClass: "text-violet-700",
    bgClass: "bg-violet-100",
  },
  {
    id: "heart",
    name: "Herz",
    category: "neutral",
    colorClass: "text-pink-600",
    bgClass: "bg-pink-100",
  },
];
