import React, { useRef } from "react";
import {
  LayoutTemplate,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
} from "lucide-react";
import {
  TemplateBlock,
  HeaderBlockConfig,
  EmailFontFamily,
} from "../../../types/notifications";

interface HeaderInspectorProps {
  block: TemplateBlock;
  onUpdate: (updated: TemplateBlock) => void;
  onDelete: () => void;
}

const defaultColors = [
  "#0f172a", // Slate 900
  "#334155", // Slate 700
  "#047857", // Emerald 700
  "#1d4ed8", // Blue 700
  "#b91c1c", // Red 700
  "#ffffff", // White
];

export const HeaderInspector: React.FC<HeaderInspectorProps> = ({
  block,
  onUpdate,
  onDelete,
}) => {
  const cfg = block.config as HeaderBlockConfig;
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const rawText =
    cfg.textContent !== undefined
      ? cfg.textContent
      : cfg.title
      ? cfg.subtitle
        ? `${cfg.title}\n${cfg.subtitle}`
        : cfg.title
      : "";

  const fontSize = cfg.fontSize || 18;
  const lineHeight = cfg.lineHeight || 1.4;
  const textAlign = cfg.textAlign || "left";
  const textColor = cfg.textColor || cfg.color || "#0f172a";
  const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 16;
  const bgColor = cfg.backgroundColor || "transparent";
  const logoWidth = cfg.logoWidth || 72;

  const updateConfig = (partial: Partial<HeaderBlockConfig>) => {
    onUpdate({
      ...block,
      config: {
        ...cfg,
        ...partial,
      },
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        updateConfig({ logoUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const adjustValue = (curr: number, delta: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, curr + delta));
  };

  return (
    <div className="space-y-4">
      {/* Title Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Kopfzeile
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Logo links &bull; Text rechts &bull; Vertikal zentriert
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
          title="Kopfzeile löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Löschen</span>
        </button>
      </div>

      {/* Vereinslogo Section (Links, quadratisch) */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-slate-700 block">
          Vereinslogo (Links)
        </label>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {cfg.logoUrl ? (
              <img
                src={cfg.logoUrl}
                alt={cfg.logoAlt || "Logo"}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>{cfg.logoUrl ? "Ändern" : "Logo hochladen"}</span>
              </button>
              {cfg.logoUrl && (
                <button
                  type="button"
                  onClick={() => updateConfig({ logoUrl: "" })}
                  className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                  title="Logo entfernen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              Optimal für quadratische Vereinslogos ({logoWidth} &times; {logoWidth} px)
            </p>
          </div>
        </div>
      </div>

      {/* Textinhalt Section (Rechts: 2 getrennte Eingabefelder) */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-bold uppercase text-slate-700 block">
          Textinhalt (Rechts)
        </label>
        <div className="space-y-2">
          {(() => {
            const lines = rawText.split("\n");
            let titleLine = lines[0] || "";
            let subtitleLine = lines.slice(1).join("\n") || "";

            if (titleLine.trim() === "[Vereinsname]") {
              titleLine = "";
            }
            if (subtitleLine.trim() === "Offizielle Mitteilung") {
              subtitleLine = "";
            }

            return (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Vereinsname</span>
                  <input
                    type="text"
                    data-field="header-text-title"
                    value={titleLine}
                    onChange={(e) => {
                      const nextVal = subtitleLine
                        ? `${e.target.value}\n${subtitleLine}`
                        : e.target.value;
                      updateConfig({
                        textContent: nextVal,
                        title: undefined,
                        subtitle: undefined,
                      });
                    }}
                    placeholder="Vereinsname"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Untertitel</span>
                  <input
                    type="text"
                    data-field="header-text-subtitle"
                    value={subtitleLine}
                    onChange={(e) => {
                      const nextVal = `${titleLine}\n${e.target.value}`;
                      updateConfig({
                        textContent: nextVal,
                        title: undefined,
                        subtitle: undefined,
                      });
                    }}
                    placeholder="Untertitel"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                  />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Typografie & Formatierung */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Text-Formatierung
        </div>

        {/* Schriftart */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-slate-700 block">
            Schriftart
          </label>
          <select
            value={
              cfg.fontFamily === "sans"
                ? "system-sans"
                : cfg.fontFamily === "serif"
                ? "georgia"
                : cfg.fontFamily === "mono"
                ? "courier"
                : cfg.fontFamily || "system-sans"
            }
            onChange={(e) =>
              updateConfig({ fontFamily: e.target.value as EmailFontFamily })
            }
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            <option value="system-sans">System Sans (Modern / Standard)</option>
            <option value="georgia">Georgia (Serif / Traditionell)</option>
            <option value="courier">Courier (Monospace)</option>
          </select>
        </div>

        {/* Schriftgröße & Zeilenhöhe */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-700 block">
              Schriftgröße
            </label>
            <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    fontSize: adjustValue(fontSize, -1, 12, 36),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-900">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    fontSize: adjustValue(fontSize, 1, 12, 36),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-700 block">
              Zeilenhöhe
            </label>
            <select
              value={lineHeight}
              onChange={(e) =>
                updateConfig({ lineHeight: parseFloat(e.target.value) })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="1.2">Kompakt (1.2)</option>
              <option value="1.4">Normal (1.4)</option>
              <option value="1.6">Luftig (1.6)</option>
              <option value="1.8">Weit (1.8)</option>
            </select>
          </div>
        </div>

        {/* Ausrichtung */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-slate-700 block">
            Text-Ausrichtung
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => updateConfig({ textAlign: "left" })}
              className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                textAlign === "left"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Links</span>
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ textAlign: "center" })}
              className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                textAlign === "center"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
              <span>Zentriert</span>
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ textAlign: "right" })}
              className={`py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                textAlign === "right"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <AlignRight className="w-3.5 h-3.5" />
              <span>Rechts</span>
            </button>
          </div>
        </div>

        {/* Textfarbe */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-slate-700 block">
            Textfarbe
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={textColor}
              onChange={(e) => updateConfig({ textColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
            />
            <input
              type="text"
              value={textColor}
              onChange={(e) => updateConfig({ textColor: e.target.value })}
              className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
            />
            <div className="flex items-center gap-1 ml-auto">
              {defaultColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  onClick={() => updateConfig({ textColor: c })}
                  className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hintergrund & Innenabstand */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Layout & Hintergrund
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-slate-700 block">
            Hintergrundfarbe
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgColor === "transparent" ? "#ffffff" : bgColor}
              onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
            />
            <button
              type="button"
              onClick={() => updateConfig({ backgroundColor: "transparent" })}
              className={`px-2 py-1 rounded text-xs font-semibold border ${
                bgColor === "transparent"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Transparent
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ backgroundColor: "#ffffff" })}
              className={`px-2 py-1 rounded text-xs font-semibold border ${
                bgColor === "#ffffff"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Weiß
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ backgroundColor: "#f8fafc" })}
              className={`px-2 py-1 rounded text-xs font-semibold border ${
                bgColor === "#f8fafc"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Hellgrau
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-slate-700">
              Abstand Oben/Unten
            </label>
            <span className="text-xs font-bold text-slate-900">{paddingY}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={2}
            value={paddingY}
            onChange={(e) => updateConfig({ paddingY: Number(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
        </div>
      </div>
    </div>
  );
};
