import React, { useState, useRef, useEffect } from "react";
import { Plus, Type, MousePointerClick, Image as ImageIcon, LayoutTemplate, X } from "lucide-react";
import { TemplateBlockType } from "../../../types/notifications";

interface InlineBlockInsertProps {
  onInsert: (type: TemplateBlockType) => void;
  label?: string;
  isEdge?: boolean;
}

export const InlineBlockInsert: React.FC<InlineBlockInsertProps> = ({
  onInsert,
  label = "Neuen Block einfügen",
  isEdge = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (type: TemplateBlockType) => {
    onInsert(type);
    setIsOpen(false);
  };

  return (
    <div
      ref={popoverRef}
      className="relative group h-0 z-30 flex items-center justify-center pointer-events-auto"
    >
      {/* Invisible hover capture area (20px tall) that does not take document flow space */}
      <div className="absolute inset-x-0 -top-2.5 -bottom-2.5 z-0 cursor-pointer pointer-events-auto" />

      {/* Subtle divider line that appears only on hover */}
      <div
        className={`absolute inset-x-0 top-0 h-[2px] -translate-y-1/2 transition-opacity duration-150 pointer-events-none z-10 ${
          isOpen
            ? "bg-slate-800 opacity-100 shadow-xs"
            : "bg-emerald-600 opacity-0 group-hover:opacity-100"
        }`}
      />

      {/* Trigger Plus Button - invisible until hovered over border */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={label}
        className={`absolute top-0 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 rounded-full text-white shadow-md transition-all duration-150 transform cursor-pointer ${
          isOpen
            ? "bg-slate-900 scale-110 opacity-100 ring-2 ring-slate-400"
            : "bg-emerald-700 hover:bg-emerald-800 scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 border border-emerald-500"
        }`}
      >
        {isOpen ? <X className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-2 z-50 bg-white border border-slate-300 rounded-xl p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 w-80 max-w-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
            Baustein hinzufügen
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {/* Kopfzeile Block (Logo links, Text rechts) */}
            <button
              type="button"
              onClick={() => handleSelect("header")}
              className="flex flex-col items-center justify-center p-2 rounded-none border border-slate-200 hover:border-slate-700 hover:bg-slate-50 transition-all text-slate-700 hover:text-slate-900 group/btn cursor-pointer"
            >
              <div className="w-8 h-8 rounded-none bg-slate-100 text-slate-800 flex items-center justify-center mb-1 group-hover/btn:scale-105 transition-transform">
                <LayoutTemplate className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold">Kopfzeile</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Logo & Text</span>
            </button>

            {/* Text Block */}
            <button
              type="button"
              onClick={() => handleSelect("text")}
              className="flex flex-col items-center justify-center p-2 rounded-none border border-slate-200 hover:border-slate-700 hover:bg-slate-50 transition-all text-slate-700 hover:text-slate-900 group/btn cursor-pointer"
            >
              <div className="w-8 h-8 rounded-none bg-slate-100 text-slate-800 flex items-center justify-center mb-1 group-hover/btn:scale-105 transition-transform">
                <Type className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold">Text</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Fließtext</span>
            </button>

            {/* Button Block */}
            <button
              type="button"
              onClick={() => handleSelect("button")}
              className="flex flex-col items-center justify-center p-2 rounded-none border border-slate-200 hover:border-slate-700 hover:bg-slate-50 transition-all text-slate-700 hover:text-slate-900 group/btn cursor-pointer"
            >
              <div className="w-8 h-8 rounded-none bg-slate-100 text-slate-800 flex items-center justify-center mb-1 group-hover/btn:scale-105 transition-transform">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold">Button</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Link / CTA</span>
            </button>

            {/* Image Block */}
            <button
              type="button"
              onClick={() => handleSelect("image")}
              className="flex flex-col items-center justify-center p-2 rounded-none border border-slate-200 hover:border-slate-700 hover:bg-slate-50 transition-all text-slate-700 hover:text-slate-900 group/btn cursor-pointer"
            >
              <div className="w-8 h-8 rounded-none bg-slate-100 text-slate-800 flex items-center justify-center mb-1 group-hover/btn:scale-105 transition-transform">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold">Grafik</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Bild/Banner</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
