import React, { useRef, useMemo } from "react";
import {
  Type,
  MousePointerClick,
  Image as ImageIcon,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Sparkles,
  Link,
  ChevronLeft,
  Minus,
  Plus,
  Palette,
  Columns2,
  LayoutTemplate,
  X,
  Trash2,
} from "lucide-react";
import {
  TemplateBlock,
  TextBlockConfig,
  ButtonBlockConfig,
  ImageBlockConfig,
  HeaderBlockConfig,
  EmailTemplateGlobalSettings,
  NotificationEventDefinition,
} from "../../../types/notifications";
import {
  VARIABLE_BADGE_MAP,
  AVAILABLE_DYNAMIC_LINKS,
} from "../../../services/blockTemplateCompiler";
import { AVAILABLE_TEMPLATE_VARIABLES } from "../../../services/notificationTemplates";
import { ColumnsInspector } from "./ColumnsInspector";
import { HeaderInspector } from "./HeaderInspector";

interface InspectorPanelProps {
  selectedBlock: TemplateBlock | null;
  onUpdateBlock: (updated: TemplateBlock) => void;
  onDeselect: () => void;
  onDeleteBlock?: () => void;
  draftSubject: string;
  onChangeSubject: (subject: string) => void;
  globalSettings: EmailTemplateGlobalSettings;
  onChangeGlobalSettings: (settings: EmailTemplateGlobalSettings) => void;
  currentEventDef?: NotificationEventDefinition;
  totalBlocksCount: number;
  tenantColors?: string[];
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedBlock,
  onUpdateBlock,
  onDeselect,
  onDeleteBlock,
  draftSubject,
  onChangeSubject,
  globalSettings,
  onChangeGlobalSettings,
  currentEventDef,
  totalBlocksCount,
  tenantColors,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic color palette: Always includes white (#ffffff), black (#000000), plus tenant branding colors from admin menu
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

  // Helper for Stepper value adjustment
  const adjustValue = (
    current: number,
    delta: number,
    min: number = 0,
    max: number = 100
  ) => {
    return Math.min(Math.max((current || 0) + delta, min), max);
  };

  // Logo upload handler for Header block
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlock || selectedBlock.type !== "header") return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onUpdateBlock({
          ...selectedBlock,
          config: {
            ...(selectedBlock.config as HeaderBlockConfig),
            logoUrl: dataUrl,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Insert variable badge at cursor position of focused input or into appropriate active block field
  const handleInsertVariableGlobally = (badgeText: string) => {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const isInputActive =
      activeEl &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

    if (isInputActive && activeEl) {
      const start = activeEl.selectionStart ?? activeEl.value.length;
      const end = activeEl.selectionEnd ?? activeEl.value.length;
      const prevVal = activeEl.value;
      const nextVal = prevVal.substring(0, start) + badgeText + prevVal.substring(end);
      const field = activeEl.getAttribute("data-field");

      if (field === "subject") {
        onChangeSubject(nextVal);
      } else if (
        (field === "header-text" || field === "header-title") &&
        selectedBlock &&
        selectedBlock.type === "header"
      ) {
        onUpdateBlock({
          ...selectedBlock,
          config: {
            ...selectedBlock.config,
            textContent: nextVal,
            title: undefined,
            subtitle: undefined,
          },
        });
      } else if (field === "header-subtitle" && selectedBlock && selectedBlock.type === "header") {
        onUpdateBlock({
          ...selectedBlock,
          config: { ...selectedBlock.config, subtitle: nextVal },
        });
      } else if (field === "text-content" && selectedBlock && selectedBlock.type === "text") {
        onUpdateBlock({
          ...selectedBlock,
          config: { ...selectedBlock.config, content: nextVal },
        });
      } else if (field === "button-label" && selectedBlock && selectedBlock.type === "button") {
        onUpdateBlock({
          ...selectedBlock,
          config: { ...selectedBlock.config, label: nextVal },
        });
      } else {
        // Fallback: trigger input event on element
        const nativeSetter = Object.getOwnPropertyDescriptor(
          activeEl.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(activeEl, nextVal);
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      setTimeout(() => {
        activeEl.focus();
        activeEl.setSelectionRange(start + badgeText.length, start + badgeText.length);
      }, 10);
      return;
    }

    // Fallback if no input was actively focused
    if (selectedBlock) {
      if (selectedBlock.type === "header") {
        const cfg = selectedBlock.config as HeaderBlockConfig;
        const currentText =
          cfg.textContent !== undefined
            ? cfg.textContent
            : cfg.title
            ? cfg.subtitle
              ? `${cfg.title}\n${cfg.subtitle}`
              : cfg.title
            : "[Vereinsname]";
        onUpdateBlock({
          ...selectedBlock,
          config: {
            ...cfg,
            textContent: `${currentText} ${badgeText}`.trim(),
            title: undefined,
            subtitle: undefined,
          },
        });
      } else if (selectedBlock.type === "text") {
        const cfg = selectedBlock.config as TextBlockConfig;
        onUpdateBlock({
          ...selectedBlock,
          config: { ...cfg, content: `${cfg.content || ""} ${badgeText}`.trim() },
        });
      } else if (selectedBlock.type === "button") {
        const cfg = selectedBlock.config as ButtonBlockConfig;
        onUpdateBlock({
          ...selectedBlock,
          config: { ...cfg, label: `${cfg.label || ""} ${badgeText}`.trim() },
        });
      }
    } else {
      onChangeSubject(`${draftSubject || ""} ${badgeText}`.trim());
    }
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlock || selectedBlock.type !== "image") return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onUpdateBlock({
          ...selectedBlock,
          config: {
            ...(selectedBlock.config as ImageBlockConfig),
            imageUrl: dataUrl,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Render selected block or template settings
  const renderInspectorContent = () => {
    // If no block selected: Vorlagen-Einstellungen
    if (!selectedBlock) {
      return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Vorlagen-Einstellungen
              </h3>
              <p className="text-xs font-medium text-slate-600">
                Globale Konfiguration für die gewählte E-Mail
              </p>
            </div>
          </div>
        </div>

        {/* Schriftart Dropdown (100% lokal & datenschutzkonform) */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Schriftart
            </label>
            <span className="text-[11px] font-semibold text-emerald-800">
              100% lokal / DSGVO
            </span>
          </div>
          <select
            value={
              globalSettings.fontFamily === "sans"
                ? "system-sans"
                : globalSettings.fontFamily === "serif"
                ? "georgia"
                : globalSettings.fontFamily === "mono"
                ? "courier"
                : globalSettings.fontFamily || "system-sans"
            }
            onChange={(e) =>
              onChangeGlobalSettings({
                ...globalSettings,
                fontFamily: e.target.value as any,
              })
            }
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors cursor-pointer shadow-2xs"
          >
            <option value="system-sans">System Sans (Modern)</option>
            <option value="arial">Arial / Helvetica (Neutral)</option>
            <option value="trebuchet">Trebuchet MS (Prägnant)</option>
            <option value="georgia">Georgia (Elegant Serif)</option>
            <option value="times">Times New Roman (Klassisch)</option>
            <option value="courier">Courier New (Monospace)</option>
            <option value="verdana">Verdana (Hohe Lesbarkeit)</option>
          </select>
        </div>

        {/* Event Details Card */}
        {currentEventDef && (
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-300/80 text-xs space-y-1.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Zielgruppe & Auslöser
            </div>
            <div className="font-extrabold text-slate-900 text-sm">
              {currentEventDef.label}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {currentEventDef.description}
            </p>
            <div className="text-xs text-emerald-800 font-bold pt-0.5">
              Empfänger: {currentEventDef.targetAudience}
            </div>
          </div>
        )}
      </div>
    );
  }

  // When COLUMNS Block is selected
  if (selectedBlock.type === "columns") {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        <ColumnsInspector
          block={selectedBlock}
          onUpdate={onUpdateBlock}
          onDelete={onDeleteBlock || (() => {})}
          tenantColors={tenantColors}
        />
      </div>
    );
  }

  // When TEXT Block is selected
  if (selectedBlock.type === "text") {
    const cfg = selectedBlock.config as TextBlockConfig;

    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Type className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Textblock bearbeiten
            </h3>
          </div>
          {onDeleteBlock && (
            <button
              type="button"
              onClick={onDeleteBlock}
              title="Diesen Textblock löschen"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Löschen</span>
            </button>
          )}
        </div>

        {/* Typography & Controls */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Typografie & Layout
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-700">
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
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, fontFamily: e.target.value as any },
                  })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="system-sans">System Sans (Modern)</option>
                <option value="arial">Arial / Helvetica (Neutral)</option>
                <option value="trebuchet">Trebuchet MS (Prägnant)</option>
                <option value="georgia">Georgia (Elegant Serif)</option>
                <option value="times">Times New Roman (Klassisch)</option>
                <option value="courier">Courier New (Monospace)</option>
                <option value="verdana">Verdana (Hohe Lesbarkeit)</option>
              </select>
            </div>

            {/* Font Size Stepper */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Schriftgröße
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        fontSize: adjustValue(cfg.fontSize || 15, -1, 11, 28),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.fontSize || 15}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        fontSize: adjustValue(cfg.fontSize || 15, 1, 11, 28),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Line Height & Alignment */}
          <div className="grid grid-cols-2 gap-3">
            {/* Line Height */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Zeilenabstand
              </label>
              <select
                value={cfg.lineHeight || 1.6}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, lineHeight: parseFloat(e.target.value) },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
              >
                <option value={1.3}>1.3 (Kompakt)</option>
                <option value={1.5}>1.5 (Normal)</option>
                <option value={1.6}>1.6 (Angenehm)</option>
                <option value={1.8}>1.8 (Luftig)</option>
                <option value={2.0}>2.0 (Weit)</option>
              </select>
            </div>

            {/* Alignment */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Ausrichtung
              </label>
              <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                {[
                  { id: "left", icon: AlignLeft },
                  { id: "center", icon: AlignCenter },
                  { id: "right", icon: AlignRight },
                ].map((a) => {
                  const Icon = a.icon;
                  const isActive = (cfg.textAlign || "left") === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: { ...cfg, textAlign: a.id as any },
                        })
                      }
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        isActive
                          ? "bg-white text-emerald-800 shadow-2xs font-bold"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Padding Steppers: Vertikal & Horizontal (No more hardcoded outer padding) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Padding Y */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Abstand Oben/Unten
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {cfg.paddingY ?? 12}px
                </span>
              </div>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingY: adjustValue(cfg.paddingY ?? 12, -2, 0, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.paddingY ?? 12}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingY: adjustValue(cfg.paddingY ?? 12, 2, 0, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Padding X */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Rand Links/Rechts
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {cfg.paddingX ?? 20}px
                </span>
              </div>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingX: adjustValue(cfg.paddingX ?? 20, -2, 0, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.paddingX ?? 20}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingX: adjustValue(cfg.paddingX ?? 20, 2, 0, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Hintergrund */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">
              Hintergrund
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={
                  cfg.backgroundColor && cfg.backgroundColor !== "transparent"
                    ? cfg.backgroundColor
                    : "#ffffff"
                }
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, backgroundColor: e.target.value },
                  })
                }
                className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={cfg.backgroundColor || "transparent"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, backgroundColor: e.target.value },
                  })
                }
                placeholder="transparent"
                className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono lowercase bg-slate-50"
              />
              {/* Presets */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, backgroundColor: "transparent" },
                    })
                  }
                  title="Kein Hintergrund (Transparent)"
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                    !cfg.backgroundColor || cfg.backgroundColor === "transparent"
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Keine
                </button>
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      onUpdateBlock({
                        ...selectedBlock,
                        config: { ...cfg, backgroundColor: c },
                      })
                    }
                    className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Text Color */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 block">
              Textfarbe
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={cfg.color || "#334155"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, color: e.target.value },
                  })
                }
                className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={cfg.color || "#334155"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, color: e.target.value },
                  })
                }
                className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
              />
              {/* Presets */}
              <div className="flex items-center gap-1 ml-auto">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      onUpdateBlock({
                        ...selectedBlock,
                        config: { ...cfg, color: c },
                      })
                    }
                    className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Block Action */}
        {onDeleteBlock && (
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onDeleteBlock}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Textblock löschen</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // When BUTTON Block is selected
  if (selectedBlock.type === "button") {
    const cfg = selectedBlock.config as ButtonBlockConfig;

    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Button bearbeiten
            </h3>
          </div>
          {onDeleteBlock && (
            <button
              type="button"
              onClick={onDeleteBlock}
              title="Diesen Button löschen"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Löschen</span>
            </button>
          )}
        </div>

        {/* Button Label */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Button-Beschriftung
          </label>
          <input
            type="text"
            data-field="button-label"
            value={cfg.label !== undefined ? cfg.label : "Buchung verwalten oder stornieren"}
            onChange={(e) =>
              onUpdateBlock({
                ...selectedBlock,
                config: { ...cfg, label: e.target.value },
              })
            }
            placeholder="z. B. Buchung verwalten oder stornieren"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Link-Type Switcher */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Link-Typ & Ziel-URL
          </label>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, linkType: "dynamic" },
                })
              }
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                cfg.linkType === "dynamic"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Dynamischer Link
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, linkType: "static" },
                })
              }
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                cfg.linkType === "static"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Statischer Web-Link
            </button>
          </div>

          {/* Link Target Input depending on linkType */}
          {cfg.linkType === "dynamic" ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Dynamischen Ziellink wählen:
              </label>
              <select
                value={cfg.dynamicLinkKey || "cancellation_link"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, dynamicLinkKey: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                {AVAILABLE_DYNAMIC_LINKS.map((d, idx) => (
                  <option key={`${d.key}_${idx}`} value={d.key}>
                    {d.label} &ndash; {d.description}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Wird beim Versenden automatisch durch den personalisierten Link für den Empfänger ersetzt.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Web-Adresse (URL)
              </label>
              <div className="relative">
                <Link className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="url"
                  value={cfg.staticUrl || ""}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, staticUrl: e.target.value },
                    })
                  }
                  placeholder="https://mein-tennisverein.de"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Shape & Positioning */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Shape */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Button-Form (Shape)
              </label>
              <select
                value={cfg.shape || "rounded"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, shape: e.target.value as any },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
              >
                <option value="pill">Pill (stark abgerundet)</option>
                <option value="rounded">Rounded (leicht abgerundet)</option>
                <option value="square">Square (eckig)</option>
              </select>
            </div>

            {/* Positioning / Align */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Ausrichtung
              </label>
              <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                {[
                  { id: "left", icon: AlignLeft },
                  { id: "center", icon: AlignCenter },
                  { id: "right", icon: AlignRight },
                ].map((a) => {
                  const Icon = a.icon;
                  const isActive = (cfg.align || "left") === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: { ...cfg, align: a.id as any },
                        })
                      }
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        isActive
                          ? "bg-white text-emerald-800 shadow-2xs font-bold"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Padding Steppers (Vertical & Horizontal) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                <span>Innenabstand Y</span>
                <span>{cfg.paddingY ?? 12}px</span>
              </div>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingY: adjustValue(cfg.paddingY ?? 12, -2, 4, 30),
                      },
                    })
                  }
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.paddingY ?? 12}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingY: adjustValue(cfg.paddingY ?? 12, 2, 4, 30),
                      },
                    })
                  }
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                <span>Innenabstand X</span>
                <span>{cfg.paddingX ?? 24}px</span>
              </div>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingX: adjustValue(cfg.paddingX ?? 24, -4, 8, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.paddingX ?? 24}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        paddingX: adjustValue(cfg.paddingX ?? 24, 4, 8, 60),
                      },
                    })
                  }
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Color & Background */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            {/* Primary Button Color */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 block">
                Button-Primärfarbe
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.buttonColor || "#047857"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, buttonColor: e.target.value },
                    })
                  }
                  className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={cfg.buttonColor || "#047857"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, buttonColor: e.target.value },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
                />
                <div className="flex items-center gap-1 ml-auto">
                  {defaultColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      style={{ backgroundColor: col }}
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: { ...cfg, buttonColor: col },
                        })
                      }
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                      title={col}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 block">
                Button-Textfarbe
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.textColor || "#ffffff"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, textColor: e.target.value },
                    })
                  }
                  className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={cfg.textColor || "#ffffff"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, textColor: e.target.value },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
                />
                <div className="flex items-center gap-1 ml-auto">
                  {defaultColors.map((tc) => (
                    <button
                      key={tc}
                      type="button"
                      style={{ backgroundColor: tc }}
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: { ...cfg, textColor: tc },
                        })
                      }
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                      title={tc}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Background Color */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 block">
                Hintergrundfarbe (Streifen)
              </label>
              <select
                value={cfg.backgroundColor || "transparent"}
                onChange={(e) =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: { ...cfg, backgroundColor: e.target.value },
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                <option value="transparent">Transparent (Standard)</option>
                <option value="#ffffff">Weiß (#ffffff)</option>
                <option value="#000000">Schwarz (#000000)</option>
                {defaultColors
                  .filter((c) => c !== "#ffffff" && c !== "#000000")
                  .map((c, idx) => (
                    <option key={c} value={c}>
                      Vereinsfarbe {idx + 1} ({c})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When GRAFIK Block is selected
  if (selectedBlock.type === "image") {
    const cfg = selectedBlock.config as ImageBlockConfig;

    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Grafikblock bearbeiten
            </h3>
          </div>
          {onDeleteBlock && (
            <button
              type="button"
              onClick={onDeleteBlock}
              title="Diesen Grafikblock löschen"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Löschen</span>
            </button>
          )}
        </div>

        {/* Image Source & Upload */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Bildquelle (URL oder Upload)
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={cfg.imageUrl || ""}
              onChange={(e) =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, imageUrl: e.target.value },
                })
              }
              placeholder="https://.../mein-logo.png"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
            />

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Bild von Festplatte hochladen</span>
              </button>
            </div>

            {/* Quick Banner Presets */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Beispiel-Bilder:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    name: "Tennis Sandplatz",
                    url: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
                  },
                  {
                    name: "Tennis Match Ball",
                    url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
                  },
                  {
                    name: "Sponsoren Banner",
                    url: "https://placehold.co/600x120/047857/ffffff?text=Vereinssponsoren+2026",
                  },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      onUpdateBlock({
                        ...selectedBlock,
                        config: { ...cfg, imageUrl: preset.url },
                      })
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Padding Stepper (Vertikal & Horizontal) */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
              <span>Abstand Y</span>
              <span>{cfg.paddingY ?? 12}px</span>
            </div>
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      paddingY: adjustValue(cfg.paddingY ?? 12, -2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {cfg.paddingY ?? 12}px
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      paddingY: adjustValue(cfg.paddingY ?? 12, 2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
              <span>Rand X</span>
              <span>{cfg.paddingX ?? 0}px</span>
            </div>
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      paddingX: adjustValue(cfg.paddingX ?? 0, -2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {cfg.paddingX ?? 0}px
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      paddingX: adjustValue(cfg.paddingX ?? 0, 2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Alt-Text */}
        <div className="space-y-1 pt-1 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Alternativtext (Alt-Text)
          </label>
          <input
            type="text"
            value={cfg.altText || ""}
            onChange={(e) =>
              onUpdateBlock({
                ...selectedBlock,
                config: { ...cfg, altText: e.target.value },
              })
            }
            placeholder="z. B. Vereinslogo Tennis-Club e.V."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Width Control (% / px) */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Bildbreite
            </label>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      widthUnit: "%",
                      widthValue: cfg.widthUnit === "%" ? cfg.widthValue : 100,
                    },
                  })
                }
                className={`px-2 py-0.5 rounded ${
                  (cfg.widthUnit || "%") === "%"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                % (Prozent)
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      widthUnit: "px",
                      widthValue: cfg.widthUnit === "px" ? cfg.widthValue : 280,
                    },
                  })
                }
                className={`px-2 py-0.5 rounded ${
                  cfg.widthUnit === "px"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                px (Pixel)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={cfg.widthUnit === "px" ? 50 : 20}
              max={cfg.widthUnit === "px" ? 580 : 100}
              step={cfg.widthUnit === "px" ? 10 : 5}
              value={cfg.widthValue || 100}
              onChange={(e) =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, widthValue: parseInt(e.target.value) },
                })
              }
              className="flex-1 accent-emerald-600 cursor-pointer"
            />
            <span className="w-16 text-right font-mono text-xs font-bold text-slate-800">
              {cfg.widthValue || 100}
              {cfg.widthUnit || "%"}
            </span>
          </div>
        </div>

        {/* Alignment & Destination Link */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {/* Alignment */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Ausrichtung
            </label>
            <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              {[
                { id: "left", icon: AlignLeft },
                { id: "center", icon: AlignCenter },
                { id: "right", icon: AlignRight },
              ].map((a) => {
                const Icon = a.icon;
                const isActive = (cfg.align || "center") === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      onUpdateBlock({
                        ...selectedBlock,
                        config: { ...cfg, align: a.id as any },
                      })
                    }
                    className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                      isActive
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Hyperlink */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Optionaler Klick-Link (Hyperlink)
            </label>
            <input
              type="url"
              value={cfg.targetUrl || ""}
              onChange={(e) =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, targetUrl: e.target.value },
                })
              }
              placeholder="https://mein-tennisverein.de/partner"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Delete Block Action */}
        {onDeleteBlock && (
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onDeleteBlock}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Grafikblock löschen</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // When HEADER Block (Kopfzeile) is selected
  if (selectedBlock.type === "header") {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        <HeaderInspector
          block={selectedBlock}
          onUpdate={onUpdateBlock}
          onDelete={onDeleteBlock || (() => {})}
        />

        {/* Dynamic Variable Chips for Header */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Variablen in den Text einfügen
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {eventAvailableVars.map((vKey) => (
              <button
                key={vKey}
                type="button"
                onClick={() => handleInsertVariable(`[${vKey}]`)}
                className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
              >
                + [{vKey}]
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Active block or template settings */}
      {renderInspectorContent()}

      {/* Dedicated Section: VERFÜGBARE DYNAMISCHE VARIABLEN */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
              Verfügbare dynamische Variablen
            </h4>
            <p className="text-[10px] text-slate-500">
              Klick fügt die Variable an die Cursor-Position des aktiven Felds ein
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {AVAILABLE_TEMPLATE_VARIABLES.map((v) => {
            const label = (VARIABLE_BADGE_MAP[v.key] || v.label).replace(/^\[|\]$/g, "");
            return (
              <button
                key={v.key}
                type="button"
                onMouseDown={(e) => {
                  // Crucial: prevents active input or textarea from blurring!
                  e.preventDefault();
                }}
                onClick={() => handleInsertVariableGlobally(`[${label}]`)}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer select-none active:scale-95"
                title={`${v.label} (Beispiel: ${v.example})`}
              >
                +{label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
