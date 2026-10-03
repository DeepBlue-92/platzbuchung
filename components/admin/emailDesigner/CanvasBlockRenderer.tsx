import React, { useRef, useEffect, useState } from "react";
import {
  Trash2,
  ExternalLink,
  Plus,
  Type,
  MousePointerClick,
  Image as ImageIcon,
  LayoutTemplate,
  X,
} from "lucide-react";
import {
  TemplateBlock,
  TemplateBlockType,
  TextBlockConfig,
  ButtonBlockConfig,
  ImageBlockConfig,
  HeaderBlockConfig,
  ColumnsBlockConfig,
} from "../../../types/notifications";
import {
  VARIABLE_BADGE_MAP,
  getFontFamilyCss,
} from "../../../services/blockTemplateCompiler";
import { ColumnsBlockView } from "./ColumnsBlockView";

interface CanvasBlockRendererProps {
  block: TemplateBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateBlock?: (updated: TemplateBlock) => void;
  onDelete: () => void;
  previewMode?: boolean;
  canAddColumn?: boolean;
  canAddColumnLeft?: boolean;
  canAddColumnRight?: boolean;
  onInsertColumn?: (side: "left" | "right", type: TemplateBlockType) => void;
}

export const CanvasBlockRenderer: React.FC<CanvasBlockRendererProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdateBlock,
  onDelete,
  previewMode,
  canAddColumn = true,
  canAddColumnLeft,
  canAddColumnRight,
  onInsertColumn,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverSide, setPopoverSide] = useState<"left" | "right" | null>(null);

  const showAddLeft =
    (canAddColumnLeft !== undefined ? canAddColumnLeft : canAddColumn) &&
    !previewMode &&
    block.type !== "header" &&
    block.type !== "columns";
  const showAddRight =
    (canAddColumnRight !== undefined ? canAddColumnRight : canAddColumn) &&
    !previewMode &&
    block.type !== "header" &&
    block.type !== "columns";

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setPopoverSide(null);
      }
    }
    if (popoverSide) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverSide]);

  // Auto-resize textarea height to fit content exactly without artificial min-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [block.config, isSelected]);

  // Helper to render text with unified italic dynamic variable tokens
  const renderTextContent = (text: string) => {
    if (!text) {
      return (
        <span className="italic text-slate-400">
          (Leerer Text &ndash; klicke hier zum Bearbeiten)
        </span>
      );
    }

    // Split text by badge tokens [Label], {{key}}, or clean badge names
    const badgeEntries = Object.entries(VARIABLE_BADGE_MAP);
    const cleanBadges = badgeEntries.map(([_, v]) => v.replace(/^\[|\]$/g, ""));

    const escapedCleanBadges = cleanBadges
      .filter((b) => b.includes("-") || b.includes("/"))
      .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const patternParts = [
      "\\[[^\\]\\n\\r]+\\]",
      "\\{\\{[^}\\n\\r]+\\}\\}",
      ...escapedCleanBadges.map((b) => `\\b${b}\\b`),
    ];
    const pattern = new RegExp(`(${patternParts.join("|")})`, "gi");

    const parts = text.split(pattern);

    return (
      <div className="whitespace-pre-line m-0 p-0" style={{ lineHeight: "inherit" }}>
        {parts.map((part, idx) => {
          if (!part) return null;

          // Check if part is a badge or variable tag
          let cleanLabel = "";

          // Check [Badge] format
          const bracketMatch = part.match(/^\[(.*)\]$/);
          if (bracketMatch) {
            cleanLabel = bracketMatch[1].trim();
          }

          // Check {{variable}} format
          const handlebarsMatch = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
          if (handlebarsMatch) {
            const varKey = handlebarsMatch[1].trim();
            cleanLabel = VARIABLE_BADGE_MAP[varKey] || varKey;
          }

          // Check clean badge format
          if (!cleanLabel) {
            const isCleanBadge = cleanBadges.some(
              (b) => b.toLowerCase() === part.trim().toLowerCase()
            );
            if (isCleanBadge) {
              cleanLabel = part.trim();
            }
          }

          if (cleanLabel) {
            // Strip any remaining brackets
            const displayLabel = cleanLabel.replace(/^\[+|\]+$/g, "");
            return (
              <span
                key={idx}
                className="inline-flex items-center mx-0.5 my-0.5 px-1.5 py-0.5 rounded text-xs font-semibold italic text-slate-800 bg-slate-100 border border-slate-300 select-none"
              >
                [{displayLabel}]
              </span>
            );
          }

          // Handle normal text
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  const isMultiColumn = block.columnSpan === "half" || block.columnSpan === "third";

  const handleSelectSideBlock = (side: "left" | "right", type: TemplateBlockType) => {
    onInsertColumn?.(side, type);
    setPopoverSide(null);
  };

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`group relative rounded-none transition-none cursor-pointer border-0 ${
        isMultiColumn ? "h-full" : ""
      }`}
    >
      {/* Frame on Selection */}
      {isSelected && (
        <div
          className={`absolute inset-0 pointer-events-none z-10 ${
            block.type === "button"
              ? "border border-dashed border-emerald-500/70"
              : "border-2 border-slate-700"
          }`}
          style={{ boxSizing: "border-box" }}
        />
      )}

      {/* Subtle border on hover when not selected */}
      {!isSelected && (
        <div
          className="absolute inset-0 pointer-events-none border border-transparent group-hover:border-slate-300 z-10 transition-colors"
          style={{ boxSizing: "border-box" }}
        />
      )}

      {/* Top-Right Delete Button (only visible on hover to keep preview clean) */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        className="absolute top-2 right-2 z-40 w-7 h-7 flex items-center justify-center bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded shadow-xs transition-all cursor-pointer opacity-0 group-hover:opacity-100"
        title="Kachel löschen"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Lateral Plus Icon on LEFT */}
      {showAddLeft && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-40">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setPopoverSide((prev) => (prev === "left" ? null : "left"));
            }}
            title="Kachel links hinzufügen"
            className={`w-6 h-6 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-300 shadow-md flex items-center justify-center cursor-pointer transition-all duration-150 ${
              popoverSide === "left"
                ? "opacity-100 bg-slate-900 text-white scale-110 ring-2 ring-slate-400"
                : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            }`}
          >
            {popoverSide === "left" ? <X className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {/* Left Popover to pick Block Type (Text, Button, Grafik) */}
          {popoverSide === "left" && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-300 p-2 shadow-xl rounded-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => handleSelectSideBlock("left", "text")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Text"
              >
                <Type className="w-3.5 h-3.5 text-slate-600" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSideBlock("left", "button")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Button"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-slate-600" />
                <span>Button</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSideBlock("left", "image")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Grafik"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Grafik</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lateral Plus Icon on RIGHT */}
      {showAddRight && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-40">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setPopoverSide((prev) => (prev === "right" ? null : "right"));
            }}
            title="Kachel rechts hinzufügen"
            className={`w-6 h-6 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-300 shadow-md flex items-center justify-center cursor-pointer transition-all duration-150 ${
              popoverSide === "right"
                ? "opacity-100 bg-slate-900 text-white scale-110 ring-2 ring-slate-400"
                : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            }`}
          >
            {popoverSide === "right" ? <X className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {/* Right Popover to pick Block Type (Text, Button, Grafik) */}
          {popoverSide === "right" && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-300 p-2 shadow-xl rounded-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => handleSelectSideBlock("right", "text")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Text"
              >
                <Type className="w-3.5 h-3.5 text-slate-600" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSideBlock("right", "button")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Button"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-slate-600" />
                <span>Button</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSideBlock("right", "image")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Grafik"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Grafik</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Render Block Content */}
      <div className="relative rounded-none">
        {/* COLUMNS BLOCK */}
        {block.type === "columns" && (
          <ColumnsBlockView
            block={block}
            isSelected={isSelected}
            onSelect={onSelect}
            onUpdate={(updated) => onUpdateBlock && onUpdateBlock(updated)}
          />
        )}

        {/* HEADER BLOCK (KOPFZEILE: 2 Spalten - Quadratisches Logo links, frei formatierbarer Text rechts) */}
        {block.type === "header" && (
          (() => {
            const cfg = block.config as HeaderBlockConfig;
            const fontCss = getFontFamilyCss(cfg.fontFamily);
            const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 16;
            const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
            const bgColor = cfg.backgroundColor || "transparent";
            const logoWidth = cfg.logoWidth || 72;
            const fontSize = cfg.fontSize || 18;
            const lineHeight = cfg.lineHeight || 1.4;
            const textAlign = cfg.textAlign || "left";
            const textColor = cfg.textColor || cfg.color || "#0f172a";

            const rawText =
              cfg.textContent !== undefined
                ? cfg.textContent
                : cfg.title
                ? cfg.subtitle
                  ? `${cfg.title}\n${cfg.subtitle}`
                  : cfg.title
                : "";

            return (
              <div
                style={{
                  paddingTop: `${paddingY}px`,
                  paddingBottom: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                  backgroundColor: bgColor,
                  backgroundImage: cfg.backgroundImageUrl ? `url(${cfg.backgroundImageUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
                className="w-full flex items-center gap-4 select-none box-border"
              >
                {/* Left: Square Logo Box */}
                <div
                  style={{
                    width: `${logoWidth}px`,
                    height: `${logoWidth}px`,
                    minWidth: `${logoWidth}px`,
                    minHeight: `${logoWidth}px`,
                  }}
                  className="relative group/logo rounded-lg border border-dashed border-slate-300 hover:border-emerald-600 bg-white flex items-center justify-center overflow-hidden transition-colors cursor-pointer shrink-0 shadow-2xs mx-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                    const inputEl = document.getElementById(`header-logo-upload-${block.id}`) as HTMLInputElement;
                    inputEl?.click();
                  }}
                  title="Wappen/Logo hochladen / ändern"
                >
                  <input
                    id={`header-logo-upload-${block.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (dataUrl && onUpdateBlock) {
                          onUpdateBlock({
                            ...block,
                            config: { ...cfg, logoUrl: dataUrl },
                          });
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {cfg.logoUrl ? (
                    <>
                      <img
                        src={cfg.logoUrl}
                        alt={cfg.logoAlt || "Wappen/Logo"}
                        className="w-full h-full object-contain p-1 mx-auto block"
                      />
                      <div className="absolute inset-0 bg-slate-900/50 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                        Ändern
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-1 text-slate-400">
                      <ImageIcon className="w-5 h-5 mx-auto mb-0.5 text-slate-400" />
                      <span className="text-[9px] font-bold block leading-tight text-slate-600">Wappen/Logo</span>
                    </div>
                  )}
                </div>

                {/* Right: 2 getrennte Eingabefelder für Vereinsname und Untertitel */}
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontFamily: fontCss,
                      fontSize: `${fontSize}px`,
                      lineHeight,
                      textAlign,
                      color: textColor,
                    }}
                    className="w-full space-y-1"
                  >
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
                          <input
                            type="text"
                            value={titleLine}
                            onChange={(e) => {
                              if (onUpdateBlock) {
                                const nextVal = subtitleLine
                                  ? `${e.target.value}\n${subtitleLine}`
                                  : e.target.value;
                                onUpdateBlock({
                                  ...block,
                                  config: {
                                    ...cfg,
                                    textContent: nextVal,
                                    title: undefined,
                                    subtitle: undefined,
                                  },
                                });
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect();
                            }}
                            placeholder="Vereinsname"
                            style={{
                              fontFamily: fontCss,
                              fontSize: `${fontSize}px`,
                              lineHeight,
                              textAlign,
                              color: textColor,
                            }}
                            className="w-full font-extrabold bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-white rounded px-1.5 py-0.5 transition-colors focus:outline-none"
                          />

                          <input
                            type="text"
                            value={subtitleLine}
                            onChange={(e) => {
                              if (onUpdateBlock) {
                                const nextVal = `${titleLine}\n${e.target.value}`;
                                onUpdateBlock({
                                  ...block,
                                  config: {
                                    ...cfg,
                                    textContent: nextVal,
                                    title: undefined,
                                    subtitle: undefined,
                                  },
                                });
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect();
                            }}
                            placeholder="Untertitel"
                            style={{
                              fontFamily: fontCss,
                              fontSize: `${Math.max(12, fontSize - 4)}px`,
                              lineHeight,
                              textAlign,
                              color: textColor,
                              opacity: 0.85,
                            }}
                            className="w-full font-medium bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-white rounded px-1.5 py-0.5 transition-colors focus:outline-none"
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* TEXT BLOCK */}
        {block.type === "text" && (
          (() => {
            const cfg = block.config as TextBlockConfig;
            const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
            const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 20;

            return (
              <div
                style={{
                  paddingTop: `${paddingY}px`,
                  paddingBottom: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                  backgroundColor: cfg.backgroundColor || "transparent",
                  textAlign: cfg.textAlign || "left",
                  fontSize: `${cfg.fontSize || 15}px`,
                  lineHeight: cfg.lineHeight || 1.6,
                  color: cfg.color || "#334155",
                  fontFamily: getFontFamilyCss(cfg.fontFamily),
                }}
                className="rounded-none"
              >
                {/* When in preview mode, render evaluated text with real sample data */}
                {previewMode ? (
                  renderTextContent(cfg.content)
                ) : isSelected ? (
                  <textarea
                    ref={textareaRef}
                    data-field="text-content"
                    value={cfg.content || ""}
                    onChange={(e) => {
                      onUpdateBlock?.({
                        ...block,
                        config: { ...cfg, content: e.target.value },
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Schreibe deinen Text direkt hier hinein..."
                    className="w-full block overflow-hidden bg-transparent border-0 outline-none resize-none p-0 m-0 focus:ring-0 focus:outline-none placeholder-slate-400"
                    style={{
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      lineHeight: "inherit",
                      color: "inherit",
                      textAlign: cfg.textAlign || "left",
                    }}
                    autoFocus
                  />
                ) : (
                  <div className="relative group/text">
                    {renderTextContent(cfg.content)}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* BUTTON BLOCK */}
        {block.type === "button" && (
          (() => {
            const cfg = block.config as ButtonBlockConfig;
            const justifyClass =
              cfg.align === "left"
                ? "justify-start text-left"
                : cfg.align === "right"
                ? "justify-end text-right"
                : "justify-center text-center";

            let shapeClass = "rounded-none";
            if (cfg.shape === "pill") shapeClass = "rounded-full";
            else if (cfg.shape === "rounded") shapeClass = "rounded-md";

            const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
            const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 20;

            return (
              <div
                style={{
                  backgroundColor: cfg.backgroundColor || "transparent",
                  paddingTop: `${paddingY}px`,
                  paddingBottom: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                  textAlign: cfg.align || "center",
                }}
                className={`w-full flex ${justifyClass} rounded-none border-0`}
              >
                <div
                  style={{
                    backgroundColor: cfg.buttonColor || "#047857",
                    color: cfg.textColor || "#ffffff",
                    paddingTop: "12px",
                    paddingBottom: "12px",
                    paddingLeft: "24px",
                    paddingRight: "24px",
                  }}
                  className={`inline-flex w-auto max-w-full items-center justify-center gap-2 font-bold text-sm shadow-xs transition-transform select-none whitespace-nowrap ${shapeClass}`}
                >
                  {isSelected && !previewMode ? (
                    <input
                      type="text"
                      data-field="button-label"
                      value={cfg.label !== undefined ? cfg.label : "Buchung verwalten oder stornieren"}
                      onChange={(e) => {
                        onUpdateBlock?.({
                          ...block,
                          config: { ...cfg, label: e.target.value },
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Buttonbeschriftung..."
                      className="bg-transparent border-0 outline-none text-center font-bold text-sm focus:ring-0 p-0 m-0 w-auto min-w-[260px] whitespace-nowrap"
                      style={{
                        color: cfg.textColor || "#ffffff",
                        width: `${Math.max(26, (cfg.label || "Buchung verwalten oder stornieren").length + 2)}ch`,
                      }}
                    />
                  ) : (
                    <span className="whitespace-nowrap">{cfg.label || "Buchung verwalten oder stornieren"}</span>
                  )}
                  <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                </div>
              </div>
            );
          })()
        )}

        {/* IMAGE BLOCK */}
        {block.type === "image" && (
          (() => {
            const cfg = block.config as ImageBlockConfig;
            const alignClass =
              cfg.align === "left"
                ? "justify-start text-left"
                : cfg.align === "right"
                ? "justify-end text-right"
                : "justify-center text-center";

            const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
            const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;

            const widthStyle =
              cfg.widthUnit === "%"
                ? `${cfg.widthValue || 100}%`
                : `${cfg.widthValue || 250}px`;

            return (
              <div
                style={{
                  paddingTop: `${paddingY}px`,
                  paddingBottom: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                }}
                className={`flex ${alignClass} rounded-none`}
              >
                <div style={{ width: widthStyle, maxWidth: "100%" }}>
                  <img
                    src={cfg.imageUrl || "https://placehold.co/600x160/047857/ffffff?text=Vereinsgrafik"}
                    alt={cfg.altText || "Grafik"}
                    className="w-full h-auto rounded-none object-cover shadow-2xs border border-slate-100"
                  />
                  {cfg.altText && (
                    <div className="text-[10px] text-slate-400 text-center mt-1">
                      {cfg.altText}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
