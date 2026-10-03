import React from "react";
import { BentoItem } from "../../types";
import { ArrowRight, Sparkles } from "lucide-react";
import { RichTextRenderer } from "../RichText";

interface WorkletHeroBannerProps {
  item: BentoItem;
  primaryColor?: string;
  clubName?: string;
  onNavigateToBooking?: () => void;
}

export const WorkletHeroBanner: React.FC<WorkletHeroBannerProps> = ({
  item,
  primaryColor = "#0c3823",
  clubName = "Tennisclub",
  onNavigateToBooking,
}) => {
  const bgStart = item.bg_color_start || primaryColor || "#0c3823";
  const bgEnd = item.bg_color_end || "#14532d";
  const imageUrl =
    item.image_url ||
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1600&auto=format&fit=crop";

  const defaultGreeting = (() => {
    const hour = new Date().getHours();
    if (hour < 11) return "GUTEN MORGEN,";
    if (hour < 17) return "GUTEN TAG,";
    return "GUTEN ABEND,";
  })();

  const eyebrow = item.eyebrow?.trim() || defaultGreeting;
  const title = item.title?.trim() || `Willkommen bei der ${clubName}`;
  const content =
    item.content?.trim() ||
    "Hier findest du alle wichtigen Informationen rund um die Tennisabteilung. Entdecke unsere Plätze, Veranstaltungen und aktuellen Ranglisten.";

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 min-h-[220px] sm:min-h-[250px] lg:min-h-[260px] flex items-stretch select-none group">
      {/* Background Image Layer on the Right */}
      <div className="absolute inset-0 z-0">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover object-center lg:object-right transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {/* Fallback subtle dark overlay to guarantee contrast on right side */}
        <div className="absolute inset-0 bg-black/15 z-0 pointer-events-none" />
      </div>

      {/* Dynamic Angled Gradient Overlay (Left to Right) */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(108deg, ${bgStart}FA 0%, ${bgStart}F0 42%, ${bgEnd}D9 58%, ${bgEnd}80 72%, transparent 100%)`,
        }}
      />

      {/* Content Container (Left Column) */}
      <div className="relative z-20 w-full lg:w-3/5 p-5 sm:p-7 md:p-8 flex flex-col justify-between select-text text-white">
        <div className="space-y-2">
          {eyebrow && (
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-emerald-300 drop-shadow-sm">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>{eyebrow}</span>
            </div>
          )}

          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-sm"
            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
          >
            {title}
          </h2>

          <div className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal pt-1 max-w-xl drop-shadow-xs">
            {content.includes("<p>") || content.includes("<") ? (
              <RichTextRenderer text={content} />
            ) : (
              <p className="whitespace-pre-line">{content}</p>
            )}
          </div>
        </div>

        {/* Optional CTA Button */}
        {item.cta_text && (
          <div className="pt-4 mt-2">
            {item.cta_link?.startsWith("http") ? (
              <a
                href={item.cta_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[var(--color-primary)] hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>{item.cta_text}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToBooking) {
                    onNavigateToBooking();
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[var(--color-primary)] hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>{item.cta_text}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
