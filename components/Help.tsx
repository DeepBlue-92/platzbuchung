import React from "react";
import { RichTextRenderer } from "./RichText";

interface HelpProps {
  onBack?: () => void;
  isLoggedIn: boolean;
  helpText?: string;
}

const Help: React.FC<HelpProps> = ({ onBack, isLoggedIn, helpText }) => {
  if (!helpText) {
    return (
      <div className="flex flex-col h-full items-center justify-center select-none animate-in fade-in duration-300">
        <div className="flex flex-col items-center space-y-3">
          <i className="fa-solid fa-circle-notch animate-spin text-2xl text-[var(--color-primary, #1b4332)] animate-pulse"></i>
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 font-sans">
            Hilfe wird geladen...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:max-w-4xl lg:mx-auto lg:w-full lg:animate-in lg:fade-in lg:slide-in-from-bottom-4 lg:duration-500">
      

      <div className="flex-1 overflow-y-auto lg:overflow-visible lg:flex-none">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full lg:max-h-[85dvh]">
          {/* Desktop-only Header */}
          <div className="hidden lg:block bg-[var(--color-primary)] p-8 md:p-12 text-white relative shrink-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="absolute top-6 left-6 text-white/55 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest cursor-pointer outline-none py-2.5 text-sm font-medium"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i> Zurück
              </button>
            )}
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2">
                Hilfe & Funktionen
              </h2>
              <p className="text-white font-bold uppercase text-[10px] md:text-xs tracking-[0.3em]">
                Häufig gestellte Fragen & Hilfe
              </p>
            </div>
          </div>

          {/* Rich content area */}
          <div className="p-6 md:p-8 lg:p-10 flex-1 overflow-y-auto relative">
            <div className="prose max-w-none text-slate-700 font-medium">
              <RichTextRenderer text={helpText || ""} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
