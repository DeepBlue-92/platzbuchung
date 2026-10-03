import React, { useState, useEffect, useMemo } from "react";
import { BentoItem } from "../../types";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  CloudFog,
  ArrowRight,
  Droplets,
  Radio,
  MapPin,
} from "lucide-react";
import { RainRadarModal } from "./RainRadarModal";

interface WorkletWeatherProps {
  item: BentoItem;
  clubCity?: string;
}

interface WeatherData {
  temperature: number;
  precipitation: number;
  weatherCode: number;
  maxPrecipProb: number;
  hourlyProbs: number[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

export const WorkletWeather: React.FC<WorkletWeatherProps> = ({
  item,
  clubCity,
}) => {
  const city = item.city || clubCity || "Furth";
  const latitude = typeof item.latitude === "number" ? item.latitude : 48.59;
  const longitude = typeof item.longitude === "number" ? item.longitude : 12.02;

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRadarOpen, setIsRadarOpen] = useState<boolean>(false);

  useEffect(() => {
    const cacheKey = `v2_weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

    // Try cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed: WeatherData = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
          setWeather(parsed);
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    // Fetch from Open-Meteo
    let isCancelled = false;
    setIsLoading(true);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code&hourly=precipitation_probability&forecast_days=1`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Wetterabfrage fehlgeschlagen");
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;

        const current = data.current || {};
        const hourlyProbs: number[] = data.hourly?.precipitation_probability || [];
        const maxPrecipProb = hourlyProbs.length > 0 ? Math.max(...hourlyProbs) : 0;

        const result: WeatherData = {
          temperature: Math.round(current.temperature_2m ?? 16),
          precipitation: current.precipitation ?? 0,
          weatherCode: current.weather_code ?? 0,
          maxPrecipProb,
          hourlyProbs: hourlyProbs.slice(0, 12),
          fetchedAt: Date.now(),
        };

        setWeather(result);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}
      })
      .catch((err) => {
        console.warn("Weather fetch failed, using fallback:", err);
        // Fallback default
        if (!isCancelled) {
          setWeather({
            temperature: 18,
            precipitation: 0,
            weatherCode: 1,
            maxPrecipProb: 10,
            hourlyProbs: [5, 5, 10, 10, 5, 0],
            fetchedAt: Date.now(),
          });
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude]);

  // Weather Code to Label & Icon
  const { conditionLabel, IconComponent, iconColor } = useMemo(() => {
    const code = weather?.weatherCode ?? 0;

    if (code === 0) {
      return { conditionLabel: "Sonnig / Klar", IconComponent: Sun, iconColor: "text-amber-500" };
    }
    if (code === 1 || code === 2) {
      return { conditionLabel: "Leicht bewölkt", IconComponent: CloudSun, iconColor: "text-amber-600" };
    }
    if (code === 3) {
      return { conditionLabel: "Bedeckt", IconComponent: Cloud, iconColor: "text-slate-500" };
    }
    if (code === 45 || code === 48) {
      return { conditionLabel: "Nebel", IconComponent: CloudFog, iconColor: "text-slate-400" };
    }
    if ([51, 53, 55, 56, 57].includes(code)) {
      return { conditionLabel: "Leichter Nieselregen", IconComponent: CloudDrizzle, iconColor: "text-sky-500" };
    }
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
      return { conditionLabel: "Regenschauer", IconComponent: CloudRain, iconColor: "text-blue-500" };
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return { conditionLabel: "Schneefall", IconComponent: CloudSnow, iconColor: "text-sky-300" };
    }
    if ([95, 96, 99].includes(code)) {
      return { conditionLabel: "Gewitter", IconComponent: CloudLightning, iconColor: "text-purple-600" };
    }

    return { conditionLabel: "Heiter", IconComponent: Sun, iconColor: "text-amber-500" };
  }, [weather?.weatherCode]);

  const isRaining = (weather?.precipitation ?? 0) > 0;

  return (
    <div className="flex flex-col justify-between h-full w-full">
      <div>
        {/* Header */}
        <div className="pb-3 mb-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              {item.title || "Wetter & Platzkondition"}
            </h3>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg shrink-0">
            <MapPin className="w-3 h-3 text-[var(--color-primary)]" />
            <span className="truncate max-w-[100px]">{city}</span>
          </div>
        </div>

        {/* Structured Inner Container */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
          {isLoading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-emerald-700"></i>
              <span>Lade Wetterdaten für {city}...</span>
            </div>
          ) : (
            <>
              {/* Temperature & Icon */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
                      {weather?.temperature}°
                    </span>
                    <span className="text-sm font-semibold text-slate-400">C</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                    {conditionLabel}
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                  <IconComponent className={`w-7 h-7 ${iconColor}`} />
                </div>
              </div>

              {/* Platzampel Badge */}
              <div className="pt-2 border-t border-slate-200/60">
                {!isRaining ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs w-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                    <span className="truncate">Plätze trocken &amp; bespielbar</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs w-full">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
                    <span className="truncate">
                      Regen am Platz ({weather?.precipitation} mm)
                    </span>
                  </div>
                )}
              </div>

              {/* Rain Probability Info */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  <span>Regenrisiko heute:</span>
                </span>
                <span className="font-mono font-bold text-slate-800">
                  max. {weather?.maxPrecipProb ?? 0}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Radar Trigger Button in Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsRadarOpen(true)}
          className="w-full h-10 px-3.5 bg-white hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-all shadow-2xs group cursor-pointer active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-700 group-hover:animate-pulse" />
            <span>Live-Regenradar öffnen</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Interactive Modal */}
      <RainRadarModal
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        city={city}
        latitude={latitude}
        longitude={longitude}
      />
    </div>
  );
};
