import React from "react";

interface OnboardingBannerProps {
  text?: string;
  desktopText?: string;
  mobileText?: string;
  onDismiss: () => void;
  show: boolean;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  text,
  desktopText,
  mobileText,
  onDismiss,
  show,
}) => {
  if (!show) return null;

  const finalDesktopText = desktopText || text || "";
  const finalMobileText = mobileText || text || "";

  return (
    <>
      {/* Desktop Banner (md and up): Sleek floating / upper info card in club look */}
      <div className="hidden md:flex items-center justify-between gap-4 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl px-4 py-2.5 shadow-sm text-emerald-950 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
        <div className="flex items-center gap-2.5 text-xs font-semibold min-w-0">
          <i className="fa-solid fa-lightbulb text-amber-500 text-sm animate-pulse shrink-0"></i>
          <span className="truncate text-slate-800">{finalDesktopText}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 bg-white hover:bg-emerald-100/90 active:scale-95 text-emerald-900 border border-emerald-300/80 px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-slate-400 text-xs"></i>
          <span>Tipp nicht mehr anzeigen</span>
        </button>
      </div>

      {/* Mobile Banner (sm and down): Compact light green card fixed at bottom above mobile bottom navigation bar */}
      <div className="md:hidden fixed bottom-[72px] left-4 right-4 max-w-[1600px] mx-auto z-[1950] bg-emerald-50/95 border border-emerald-200/90 text-emerald-950 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-lg flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-300 select-none">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-800 min-w-0 flex-1">
          <i className="fa-solid fa-lightbulb text-amber-500 text-xs animate-pulse shrink-0"></i>
          <p className="text-xs font-medium text-slate-800 leading-tight">{finalMobileText}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 bg-white/90 hover:bg-emerald-100/90 active:scale-95 text-emerald-900 border border-emerald-300/80 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-slate-400 text-xs"></i>
          <span>Tipp ausblenden</span>
        </button>
      </div>
    </>
  );
};

export default OnboardingBanner;
