import React, { useRef } from "react";
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
  Edit3,
  Columns2,
  LayoutTemplate,
  X,
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

interface InspectorPanelProps {
  selectedBlock: TemplateBlock | null;
  onUpdateBlock: (updated: TemplateBlock) => void;
  onDeselect: () => void;
  draftSubject: string;
  onChangeSubject: (subject: string) => void;
  globalSettings: EmailTemplateGlobalSettings;
  onChangeGlobalSettings: (settings: EmailTemplateGlobalSettings) => void;
  currentEventDef?: NotificationEventDefinition;
  totalBlocksCount: number;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedBlock,
  onUpdateBlock,
  onDeselect,
  draftSubject,
  onChangeSubject,
  globalSettings,
  onChangeGlobalSettings,
  currentEventDef,
  totalBlocksCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);

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

  // Insert variable badge into header title
  const handleInsertVariableInHeaderTitle = (badgeText: string) => {
    if (!selectedBlock || selectedBlock.type !== "header") return;
    const cfg = selectedBlock.config as HeaderBlockConfig;
    const current = cfg.title || "";
    onUpdateBlock({
      ...selectedBlock,
      config: { ...cfg, title: `${current} ${badgeText}`.trim() },
    });
  };

  // Insert variable badge into header subtitle
  const handleInsertVariableInHeaderSubtitle = (badgeText: string) => {
    if (!selectedBlock || selectedBlock.type !== "header") return;
    const cfg = selectedBlock.config as HeaderBlockConfig;
    const current = cfg.subtitle || "";
    onUpdateBlock({
      ...selectedBlock,
      config: { ...cfg, subtitle: `${current} ${badgeText}`.trim() },
    });
  };

  // Insert variable into subject line
  const handleInsertVariableInSubject = (badgeText: string) => {
    const input = subjectInputRef.current;
    if (!input) {
      onChangeSubject(`${draftSubject} ${badgeText}`.trim());
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextText =
      draftSubject.substring(0, start) + badgeText + draftSubject.substring(end);
    onChangeSubject(nextText);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + badgeText.length, start + badgeText.length);
    }, 0);
  };

  // Insert variable badge into text block
  const handleInsertVariableInText = (badgeText: string) => {
    if (!selectedBlock || selectedBlock.type !== "text") return;
    const cfg = selectedBlock.config as TextBlockConfig;
    const currentContent = cfg.content || "";

    // Find active canvas textarea or any textarea currently present
    const activeTextarea = (
      document.activeElement?.tagName === "TEXTAREA"
        ? document.activeElement
        : document.querySelector("textarea")
    ) as HTMLTextAreaElement | null;

    if (activeTextarea) {
      const start = activeTextarea.selectionStart ?? currentContent.length;
      const end = activeTextarea.selectionEnd ?? currentContent.length;
      const nextContent =
        currentContent.substring(0, start) + badgeText + currentContent.substring(end);

      onUpdateBlock({
        ...selectedBlock,
        config: { ...cfg, content: nextContent },
      });

      setTimeout(() => {
        activeTextarea.focus();
        activeTextarea.setSelectionRange(start + badgeText.length, start + badgeText.length);
      }, 0);
      return;
    }

    onUpdateBlock({
      ...selectedBlock,
      config: { ...cfg, content: `${currentContent} ${badgeText}`.trim() },
    });
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

        {/* E-Mail Subject Line */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              E-Mail-Betreffzeile
            </label>
            <span className="text-xs font-semibold text-slate-600">
              Im Posteingang sichtbar
            </span>
          </div>
          <input
            ref={subjectInputRef}
            type="text"
            value={draftSubject}
            onChange={(e) => onChangeSubject(e.target.value)}
            placeholder="z. B. Buchung bestätigt: Platz-Bezeichnung am Datum"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
          />

          {/* Quick variable badge pills for Subject (Felder einfügen) */}
          <div className="pt-1.5 space-y-1.5">
            <span className="text-xs font-bold text-slate-800 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Felder einfügen</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TEMPLATE_VARIABLES.slice(0, 7).map((v) => {
                const label = (VARIABLE_BADGE_MAP[v.key] || v.label).replace(/^\[|\]$/g, "");
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsertVariableInSubject(`[${label}]`)}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {label}
                  </button>
                );
              })}
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

        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs leading-relaxed font-medium">
          💡 <strong>Hinweis:</strong> Klicke auf einen beliebigen Block in der linken Vorschau, um Schriftgröße, Abstände, Farben, Links oder Grafiken im Detail anzupassen.
        </div>
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
        </div>

        {/* Direct Template Editing Notice */}
        <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-none text-slate-800 text-xs flex items-start gap-2.5">
          <Edit3 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-extrabold text-slate-900">
              Direkt im Template bearbeiten
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Klicke links direkt in den Textblock auf der Canvas, um deinen Nachrichtentext frei zu schreiben.
            </p>
          </div>
        </div>

        {/* Clickable Variable Badges / Pills */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Dynamische Felder als Pill einfügen:</span>
            </span>
            <span className="text-[9px] text-slate-400">Klick = in Text einfügen</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
            {AVAILABLE_TEMPLATE_VARIABLES.map((v) => {
              const label = (VARIABLE_BADGE_MAP[v.key] || v.label).replace(/^\[|\]$/g, "");
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleInsertVariableInText(`[${label}]`)}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white hover:bg-emerald-100 text-emerald-900 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title={`${v.label} (z.B. ${v.example})`}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
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
                {["#ffffff", "#f8fafc", "#f0fdf4", "#eff6ff", "#fefce8"].map(
                  (c) => (
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
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform"
                      title={c}
                    />
                  )
                )}
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
                {["#0f172a", "#334155", "#64748b", "#047857", "#1e3a8a"].map((c) => (
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
                    className="w-4 h-4 rounded-full border border-white shadow-2xs hover:scale-110 transition-transform"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
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
        </div>

        {/* Button Label */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Button-Beschriftung
          </label>
          <input
            type="text"
            value={cfg.label || ""}
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
                  {["#047857", "#0f172a", "#0284c7", "#e11d48", "#d97706"].map(
                    (col) => (
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
                        className="w-4 h-4 rounded-full border border-white shadow-2xs hover:scale-110 transition-transform"
                      />
                    )
                  )}
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
                  {["#ffffff", "#0f172a", "#fef08a"].map((tc) => (
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
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform"
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
                <option value="#f8fafc">Hellgrau (#f8fafc)</option>
                <option value="#f0fdf4">Sanftes Grün (#f0fdf4)</option>
                <option value="#eff6ff">Sanftes Blau (#eff6ff)</option>
                <option value="#ffffff">Weiß (#ffffff)</option>
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
      </div>
    );
  }

  // When HEADER Block (Kopfleiste) is selected
  if (selectedBlock.type === "header") {
    const cfg = selectedBlock.config as HeaderBlockConfig;

    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Kopfleiste bearbeiten
            </h3>
          </div>
        </div>

        {/* Logo Section (Upload erlauben) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Logo (Upload oder URL)
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={cfg.logoUrl || ""}
              onChange={(e) =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, logoUrl: e.target.value },
                })
              }
              placeholder="https://.../vereinslogo.png"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
            />

            <div className="flex items-center gap-2">
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Logo von Festplatte hochladen</span>
              </button>
              {cfg.logoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, logoUrl: "" },
                    })
                  }
                  className="px-2.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all cursor-pointer"
                  title="Logo entfernen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Logo Height Stepper if logo exists */}
            {cfg.logoUrl && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Logo-Höhe</span>
                    <span>{cfg.logoHeight || 44}px</span>
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: {
                            ...cfg,
                            logoHeight: adjustValue(cfg.logoHeight || 44, -4, 20, 140),
                          },
                        })
                      }
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="flex-1 text-center text-xs font-bold text-slate-800">
                      {cfg.logoHeight || 44}px
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBlock({
                          ...selectedBlock,
                          config: {
                            ...cfg,
                            logoHeight: adjustValue(cfg.logoHeight || 44, 4, 20, 140),
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
                  <label className="text-[10px] font-bold uppercase text-slate-400 block">
                    Alt-Text
                  </label>
                  <input
                    type="text"
                    value={cfg.logoAlt || ""}
                    onChange={(e) =>
                      onUpdateBlock({
                        ...selectedBlock,
                        config: { ...cfg, logoAlt: e.target.value },
                      })
                    }
                    placeholder="Vereinslogo"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Titel Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Haupttitel
          </label>
          <input
            type="text"
            value={cfg.title || ""}
            onChange={(e) =>
              onUpdateBlock({
                ...selectedBlock,
                config: { ...cfg, title: e.target.value },
              })
            }
            placeholder="z. B. Tennis-Club e.V."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
          />

          {/* Quick variable pills for Title */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {AVAILABLE_TEMPLATE_VARIABLES.slice(0, 5).map((v) => {
              const label = (VARIABLE_BADGE_MAP[v.key] || v.label).replace(/^\[|\]$/g, "");
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleInsertVariableInHeaderTitle(`[${label}]`)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 transition-colors cursor-pointer"
                >
                  +{label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Title Font Size */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Titel-Schriftgröße
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        fontSize: adjustValue(cfg.fontSize || 20, -1, 14, 38),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.fontSize || 20}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        fontSize: adjustValue(cfg.fontSize || 20, 1, 14, 38),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Title Color (Textfarbe Style) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Titelfarbe
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={cfg.color || "#0f172a"}
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
                  value={cfg.color || "#0f172a"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, color: e.target.value },
                    })
                  }
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Untertitel Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Untertitel
          </label>
          <input
            type="text"
            value={cfg.subtitle || ""}
            onChange={(e) =>
              onUpdateBlock({
                ...selectedBlock,
                config: { ...cfg, subtitle: e.target.value },
              })
            }
            placeholder="z. B. Platzreservierung & Benachrichtigung"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
          />

          {/* Quick variable pills for Subtitle */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {AVAILABLE_TEMPLATE_VARIABLES.slice(0, 5).map((v) => {
              const label = (VARIABLE_BADGE_MAP[v.key] || v.label).replace(/^\[|\]$/g, "");
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleInsertVariableInHeaderSubtitle(`[${label}]`)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 transition-colors cursor-pointer"
                >
                  +{label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Subtitle Font Size */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Untertitel-Größe
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        subtitleFontSize: adjustValue(cfg.subtitleFontSize || 13, -1, 10, 24),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-800">
                  {cfg.subtitleFontSize || 13}px
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: {
                        ...cfg,
                        subtitleFontSize: adjustValue(cfg.subtitleFontSize || 13, 1, 10, 24),
                      },
                    })
                  }
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Subtitle Color (Textfarbe Style) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Untertitel-Farbe
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={cfg.subtitleColor || "#64748b"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, subtitleColor: e.target.value },
                    })
                  }
                  className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={cfg.subtitleColor || "#64748b"}
                  onChange={(e) =>
                    onUpdateBlock({
                      ...selectedBlock,
                      config: { ...cfg, subtitleColor: e.target.value },
                    })
                  }
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hintergrund (wie bei Text) */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-[10px] font-bold uppercase text-slate-400 block">
            Hintergrund
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={
                cfg.backgroundColor && cfg.backgroundColor !== "transparent"
                  ? cfg.backgroundColor
                  : "#f8fafc"
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
              value={cfg.backgroundColor || "#f8fafc"}
              onChange={(e) =>
                onUpdateBlock({
                  ...selectedBlock,
                  config: { ...cfg, backgroundColor: e.target.value },
                })
              }
              className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono lowercase bg-slate-50"
            />
            {/* Presets */}
            <div className="flex items-center gap-1.5 ml-auto">
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
                  cfg.backgroundColor === "transparent"
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Keine
              </button>
              {["#f8fafc", "#ffffff", "#064e3b", "#0f172a", "#1e3a8a"].map((c) => (
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
                  className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition-transform"
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Textformatierung wie bei Text */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Typografie & Ausrichtung
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
                  const isActive = (cfg.textAlign || "center") === a.id;
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
        </div>

        {/* Padding wie bei Text */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* Padding Y */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Abstand Oben/Unten
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {cfg.paddingY ?? 20}px
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
                      paddingY: adjustValue(cfg.paddingY ?? 20, -2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {cfg.paddingY ?? 20}px
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateBlock({
                    ...selectedBlock,
                    config: {
                      ...cfg,
                      paddingY: adjustValue(cfg.paddingY ?? 20, 2, 0, 60),
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
                {cfg.paddingX ?? 24}px
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
                      paddingX: adjustValue(cfg.paddingX ?? 24, -2, 0, 60),
                    },
                  })
                }
                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors"
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
                      paddingX: adjustValue(cfg.paddingX ?? 24, 2, 0, 60),
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
      </div>
    );
  }

  return null;
};
