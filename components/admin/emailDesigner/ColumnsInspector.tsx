import React, { useRef, useMemo } from "react";
import {
  LayoutTemplate,
  Trash2,
  Upload,
  X,
  Minus,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import {
  TemplateBlock,
  ColumnsBlockConfig,
  EmailFontFamily,
} from "../../../types/notifications";
import { EMAIL_FONT_OPTIONS } from "../../../services/blockTemplateCompiler";

interface ColumnsInspectorProps {
  block: TemplateBlock;
  onUpdate: (updated: TemplateBlock) => void;
  onDelete: (blockId: string) => void;
  tenantColors?: string[];
}

export const ColumnsInspector: React.FC<ColumnsInspectorProps> = ({
  block,
  onUpdate,
  onDelete,
  tenantColors,
}) => {
  const cfg = block.config as ColumnsBlockConfig;
  const columns = cfg.columns || [];
  const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
  const bgColor = cfg.backgroundColor || "transparent";
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic branding color swatches from admin settings
  const defaultColors = useMemo(() => {
    const list = ["#ffffff", "#000000", ...(tenantColors || [])];
    if (!tenantColors || tenantColors.length === 0) {
      list.push("#1b4332", "#c04d2b", "#0f172a", "#ccff00");
    }
    const seen = new Set<string>();
    const res: string[] = [];
    for (const c of list) {
      if (c && typeof c === "string") {
        const lower = c.trim().toLowerCase();
        if (lower.startsWith("#") && !seen.has(lower) && lower !== "transparent") {
          seen.add(lower);
          res.push(c.trim());
        }
      }
    }
    return res;
  }, [tenantColors]);

  const w1 = Math.max(15, Math.min(85, Math.round(columns[0]?.widthPercent ?? 25)));
  const w2 = 100 - w1;

  const updateConfig = (partial: Partial<ColumnsBlockConfig>) => {
    onUpdate({
      ...block,
      config: {
        ...cfg,
        gap: 0, // Fest auf 0px
        verticalAlign: "middle", // Immer fest vertikal zentriert
        ...partial,
      },
    });
  };

  const handleSliderChange = (newW1: number) => {
    const clampedW1 = Math.max(15, Math.min(85, newW1));
    const clampedW2 = 100 - clampedW1;
    const col1 = columns[0] ? { ...columns[0], widthPercent: clampedW1 } : { widthPercent: clampedW1, blocks: [] };
    const col2 = columns[1] ? { ...columns[1], widthPercent: clampedW2 } : { widthPercent: clampedW2, blocks: [] };
    updateConfig({
      columns: [col1, col2] as any,
    });
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateConfig({ backgroundImageUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
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
              Wappen/Logo links &bull; Vereinsname &amp; Untertitel rechts
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
          title="Diesen Kopfzeilen-Block löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Löschen</span>
        </button>
      </div>

      {/* Spaltenbreite / Verteilung Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="uppercase">Spaltenbreite</span>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Wappen/Logo ({w1}%) &bull; Text ({w2}%)
          </span>
        </div>
        <div className="pt-1">
          <input
            type="range"
            min={15}
            max={85}
            step={1}
            value={w1}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
        </div>
      </div>

      {/* Hintergrundbild (Upload) */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-slate-700 block">
            Hintergrundbild
          </label>
          {cfg.backgroundImageUrl && (
            <button
              type="button"
              onClick={() => updateConfig({ backgroundImageUrl: undefined })}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              <span>Entfernen</span>
            </button>
          )}
        </div>

        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleBgUpload}
          className="hidden"
        />

        {cfg.backgroundImageUrl ? (
          <div className="relative rounded-xl border border-slate-200 overflow-hidden group/bg">
            <img
              src={cfg.backgroundImageUrl}
              alt="Hintergrund"
              className="w-full h-20 object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/bg:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => bgFileInputRef.current?.click()}
                className="px-2.5 py-1 bg-white text-slate-800 text-[10px] font-bold rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Bild ändern
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ backgroundImageUrl: undefined })}
                className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-rose-700 transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => bgFileInputRef.current?.click()}
            className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-emerald-600 rounded-xl bg-slate-50/50 hover:bg-emerald-50/30 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Hintergrundbild hochladen</span>
          </button>
        )}
      </div>

      {/* Hintergrundfarbe (als Basis / Tönung) */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
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

      {/* Innenabstand Oben/Unten (paddingY) */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-slate-700">
            Abstand Oben/Unten
          </label>
          <span className="text-xs font-bold text-slate-900">{paddingY}px</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* FORMATIERUNG: VEREINSNAME */}
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
          <span>Format: Vereinsname</span>
        </div>

        {/* Schriftart */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Schriftart
          </label>
          <select
            value={cfg.titleFontFamily || "system-sans"}
            onChange={(e) => updateConfig({ titleFontFamily: e.target.value as EmailFontFamily })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            {EMAIL_FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Schriftgröße & Farbe */}
        <div className="grid grid-cols-2 gap-2">
          {/* Schriftgröße */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Schriftgröße
            </label>
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    titleFontSize: Math.max(12, (cfg.titleFontSize || 18) - 1),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {cfg.titleFontSize || 18}px
              </span>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    titleFontSize: Math.min(36, (cfg.titleFontSize || 18) + 1),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Farbe Picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Textfarbe
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={cfg.titleColor || "#0f172a"}
                onChange={(e) => updateConfig({ titleColor: e.target.value })}
                className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 shrink-0"
              />
              <input
                type="text"
                value={cfg.titleColor || "#0f172a"}
                onChange={(e) => updateConfig({ titleColor: e.target.value })}
                className="w-full px-2 py-1 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Dynamische Farb-Paletten-Swatches */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {defaultColors.map((c) => (
            <button
              key={c}
              type="button"
              style={{ backgroundColor: c }}
              onClick={() => updateConfig({ titleColor: c })}
              className={`w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer ${
                (cfg.titleColor || "#0f172a").toLowerCase() === c.toLowerCase()
                  ? "ring-2 ring-emerald-600 ring-offset-1"
                  : ""
              }`}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* FORMATIERUNG: UNTERTITEL */}
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
          <span>Format: Untertitel</span>
        </div>

        {/* Schriftart */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Schriftart
          </label>
          <select
            value={cfg.subtitleFontFamily || "system-sans"}
            onChange={(e) => updateConfig({ subtitleFontFamily: e.target.value as EmailFontFamily })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            {EMAIL_FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Schriftgröße & Farbe */}
        <div className="grid grid-cols-2 gap-2">
          {/* Schriftgröße */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Schriftgröße
            </label>
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    subtitleFontSize: Math.max(10, (cfg.subtitleFontSize || 13) - 1),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {cfg.subtitleFontSize || 13}px
              </span>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    subtitleFontSize: Math.min(24, (cfg.subtitleFontSize || 13) + 1),
                  })
                }
                className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Farbe Picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Textfarbe
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={cfg.subtitleColor || "#64748b"}
                onChange={(e) => updateConfig({ subtitleColor: e.target.value })}
                className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 shrink-0"
              />
              <input
                type="text"
                value={cfg.subtitleColor || "#64748b"}
                onChange={(e) => updateConfig({ subtitleColor: e.target.value })}
                className="w-full px-2 py-1 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Dynamische Farb-Paletten-Swatches */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {defaultColors.map((c) => (
            <button
              key={c}
              type="button"
              style={{ backgroundColor: c }}
              onClick={() => updateConfig({ subtitleColor: c })}
              className={`w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer ${
                (cfg.subtitleColor || "#64748b").toLowerCase() === c.toLowerCase()
                  ? "ring-2 ring-emerald-600 ring-offset-1"
                  : ""
              }`}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
