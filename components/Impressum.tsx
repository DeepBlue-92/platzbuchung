import React from "react";
import { RichTextRenderer } from "./RichText";

interface ImpressumProps {
  onBack?: () => void;
  impressumText?: string;
}

const Impressum: React.FC<ImpressumProps> = ({ onBack, impressumText }) => {
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
                Impressum
              </h2>
              <p className="text-white font-bold uppercase text-[10px] md:text-xs tracking-[0.3em]">
                Rechtliche Informationen
              </p>
            </div>
          </div>

          {/* Rich content area */}
          <div className="p-6 md:p-8 lg:p-10 flex-1 overflow-y-auto relative">
            <div className="prose max-w-none text-slate-700 font-medium">
              <RichTextRenderer
                text={
                  impressumText ||
                  `Angaben gemäß § 5 TMG\nTennis-Club e.V.\nMusterstraße 1, 12345 Musterstadt\n\nVertreten durch\nVorstand\n\nKontakt\nE-Mail: info@tennis-club.local`
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Impressum;
