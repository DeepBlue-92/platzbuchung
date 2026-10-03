import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Radio,
  Clock,
  ExternalLink,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface RainRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  latitude: number;
  longitude: number;
}

interface RadarFrame {
  time: number;
  path: string;
  isForecast?: boolean;
}

export const RainRadarModal: React.FC<RainRadarModalProps> = ({
  isOpen,
  onClose,
  city,
  latitude,
  longitude,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const radarLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [radarHost, setRadarHost] = useState<string>("https://tilecache.rainviewer.com");
  const [error, setError] = useState<string | null>(null);

  // Find index of the latest live past frame (current moment)
  const latestPastIndex = useMemo(() => {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (!frames[i].isForecast) return i;
    }
    return frames.length > 0 ? frames.length - 1 : 0;
  }, [frames]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch RainViewer metadata
  const loadRadarData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      if (!res.ok) throw new Error("Fehler beim Abruf der Radardaten.");
      const data = await res.json();
      const host = data.host || "https://tilecache.rainviewer.com";
      setRadarHost(host);

      const past: RadarFrame[] = (data.radar?.past || []).slice(-6).map((f: any) => ({
        time: f.time,
        path: f.path,
        isForecast: false,
      }));

      const nowcast: RadarFrame[] = (data.radar?.nowcast || []).slice(0, 2).map((f: any) => ({
        time: f.time,
        path: f.path,
        isForecast: true,
      }));

      const combined = [...past, ...nowcast];
      if (combined.length === 0) {
        throw new Error("Keine aktuellen Radardaten verfügbar.");
      }

      setFrames(combined);
      // Default to latest past frame or last frame
      const initialIdx = past.length > 0 ? past.length - 1 : combined.length - 1;
      setActiveFrameIndex(initialIdx);
    } catch (err: any) {
      console.error("Failed loading RainViewer radar data:", err);
      setError(err?.message || "Radar konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRadarData();
    }
  }, [isOpen, loadRadarData]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isCancelled = false;

    // Dynamically load Leaflet if needed
    import("leaflet").then((L) => {
      if (isCancelled || !mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 9,
        minZoom: 6,
        maxZoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      // OpenStreetMap Base Tile Layer (100% kostenfrei, ohne API-Key)
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          subdomains: ["a", "b", "c"],
          maxZoom: 19,
        }
      ).addTo(map);

      // Custom pulse marker for the tennis club
      const customPinHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 18px; height: 18px; border-radius: 9999px; background-color: #047857; border: 2.5px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);"></div>
        </div>
      `;

      const clubIcon = L.divIcon({
        html: customPinHtml,
        className: "custom-club-radar-pin",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([latitude, longitude], { icon: clubIcon }).addTo(map);
      marker.bindPopup(`<b>${city}</b><br><span style="font-size: 11px; color: #64748b;">Tennisanlage</span>`);
      markerRef.current = marker;

      mapInstanceRef.current = map;

      // Force size recalculation once modal renders
      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, latitude, longitude, city]);

  // Update Radar Layer when active frame changes
  useEffect(() => {
    if (!mapInstanceRef.current || frames.length === 0) return;

    import("leaflet").then((L) => {
      const activeFrame = frames[activeFrameIndex];
      if (!activeFrame) return;

      const tileUrl = `${radarHost}${activeFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      if (radarLayerRef.current) {
        mapInstanceRef.current.removeLayer(radarLayerRef.current);
      }

      const radarLayer = L.tileLayer(tileUrl, {
        opacity: 0.72,
        zIndex: 50,
      });

      radarLayer.addTo(mapInstanceRef.current);
      radarLayerRef.current = radarLayer;
    });
  }, [activeFrameIndex, frames, radarHost]);

  // Loop Animation
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    const interval = setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % frames.length);
    }, 750);

    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  if (!isOpen) return null;

  const currentFrame = frames[activeFrameIndex];

  // Helper to format frame time label
  const formatTimeLabel = (timestamp?: number, isForecast?: boolean) => {
    if (!timestamp) return { exact: "--:--", relative: "" };
    const date = new Date(timestamp * 1000);
    const exact = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);

    let relative = "";
    if (isForecast) {
      relative = `+${Math.abs(diffMinutes)} Min. (Vorhersage)`;
    } else if (Math.abs(diffMinutes) <= 4) {
      relative = "Jetzt (Live)";
    } else if (diffMinutes > 0) {
      relative = `Vor ${diffMinutes} Min.`;
    } else {
      relative = `In ${Math.abs(diffMinutes)} Min.`;
    }

    return { exact, relative };
  };

  const { exact, relative } = formatTimeLabel(currentFrame?.time, currentFrame?.isForecast);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[var(--color-primary)] border border-emerald-100 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-0.5">
                LIVE-REGENRADAR
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate flex items-center gap-1.5">
                <span>{city} &amp; Umgebung</span>
                <span className="text-xs font-semibold text-slate-400">({latitude.toFixed(2)}°, {longitude.toFixed(2)}°)</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadRadarData}
              title="Aktualisieren"
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin text-[var(--color-primary)]" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[420px] bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-xs flex items-center justify-center gap-2 text-slate-700 font-bold text-xs">
              <i className="fa-solid fa-spinner fa-spin text-sm text-[var(--color-primary)]"></i>
              <span>Lade aktuelle Radardaten...</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="absolute top-4 left-4 right-4 z-20 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-medium shadow-sm">
              {error}
            </div>
          )}

          {/* Live Badge in Map */}
          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-black text-slate-900 font-mono">{exact} Uhr</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              • {relative}
            </span>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 text-[10px] font-bold text-slate-600 select-none">
            <span className="text-[9px] uppercase tracking-wider text-slate-400">Intensität:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2 rounded-xs bg-[#60a5fa]" title="Leicht"></span>
              <span className="w-2.5 h-2 rounded-xs bg-[#34d399]" title="Mäßig"></span>
              <span className="w-2.5 h-2 rounded-xs bg-[#facc15]" title="Stark"></span>
              <span className="w-2.5 h-2 rounded-xs bg-[#f87171]" title="Sehr stark"></span>
              <span className="w-2.5 h-2 rounded-xs bg-[#c084fc]" title="Unwetter"></span>
            </div>
          </div>
        </div>

        {/* Interactive Controls Bar with Timeline Slider */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            {/* Play/Pause & Step Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`h-9 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 ${
                  isPlaying
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Abspielen</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveFrameIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={activeFrameIndex <= 0}
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                title="10 Min. zurück"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveFrameIndex((prev) => Math.min(frames.length - 1, prev + 1));
                }}
                disabled={activeFrameIndex >= frames.length - 1}
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                title="10 Min. vor"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Jump to current time button */}
              {latestPastIndex !== -1 && activeFrameIndex !== latestPastIndex && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveFrameIndex(latestPastIndex);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title="Auf aktuellen Zeitpunkt springen"
                >
                  Jetzt (Live)
                </button>
              )}
            </div>

            {/* Time Indicator */}
            <div className="text-right">
              <div className="text-sm font-black text-slate-900 font-mono flex items-center gap-1.5 justify-end">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{exact} Uhr</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-700">
                {relative}
              </div>
            </div>
          </div>

          {/* Tageszeit-Slider */}
          {frames.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min={0}
                  max={frames.length - 1}
                  step={1}
                  value={activeFrameIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setActiveFrameIndex(Number(e.target.value));
                  }}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
                />
              </div>

              {/* Scale Labels */}
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5 select-none">
                <span>{formatTimeLabel(frames[0]?.time, frames[0]?.isForecast).exact} Uhr</span>
                {latestPastIndex >= 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveFrameIndex(latestPastIndex);
                    }}
                    className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      activeFrameIndex === latestPastIndex
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-slate-500 hover:text-emerald-700"
                    }`}
                  >
                    ● Jetzt (Live)
                  </button>
                )}
                <span>{formatTimeLabel(frames[frames.length - 1]?.time, frames[frames.length - 1]?.isForecast).exact} Uhr</span>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Datenquelle: RainViewer &amp; OpenStreetMap (100% kostenfrei, kein Key erforderlich)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
