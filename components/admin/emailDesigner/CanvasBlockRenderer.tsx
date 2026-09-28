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
} from "../../../types/notifications";
import {
  VARIABLE_BADGE_MAP,
  getFontFamilyCss,
} from "../../../services/blockTemplateCompiler";

interface CanvasBlockRendererProps {
  block: TemplateBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateBlock?: (updated: TemplateBlock) => void;
  onDelete: () => void;
  previewMode?: boolean;
  canAddColumn?: boolean;
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
  onInsertColumn,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverSide, setPopoverSide] = useState<"left" | "right" | null>(null);

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

  // Auto-resize textarea height to fit content exactly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(48, textareaRef.current.scrollHeight)}px`;
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
      <div className="whitespace-pre-line leading-relaxed">
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
      {/* Rectangular Dark Gray Overlay Frame on Selection */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none border-2 border-slate-700 z-10"
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

      {/* Top-Right Delete Button only (appears on hover or when block is selected) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={`absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center bg-white/95 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-md shadow-xs transition-all cursor-pointer ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title="Kachel löschen"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Lateral Plus Icon on LEFT (shown on mouseover if row has < 3 columns) */}
      {canAddColumn && !previewMode && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverSide((prev) => (prev === "left" ? null : "left"));
            }}
            title="Kachel links hinzufügen"
            className={`w-6 h-6 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-300 shadow-md flex items-center justify-center cursor-pointer transition-all duration-150 ${
              popoverSide === "left"
                ? "opacity-100 bg-slate-900 text-white scale-110"
                : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            }`}
          >
            {popoverSide === "left" ? <X className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {/* Left Popover to pick Block Type */}
          {popoverSide === "left" && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-300 p-2 shadow-xl rounded-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => handleSelectSideBlock("left", "header")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Kopfleiste"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-600" />
                <span>Kopfleiste</span>
              </button>
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

      {/* Lateral Plus Icon on RIGHT (shown on mouseover if row has < 3 columns) */}
      {canAddColumn && !previewMode && (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverSide((prev) => (prev === "right" ? null : "right"));
            }}
            title="Kachel rechts hinzufügen"
            className={`w-6 h-6 rounded-full bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-300 shadow-md flex items-center justify-center cursor-pointer transition-all duration-150 ${
              popoverSide === "right"
                ? "opacity-100 bg-slate-900 text-white scale-110"
                : "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            }`}
          >
            {popoverSide === "right" ? <X className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {/* Right Popover to pick Block Type */}
          {popoverSide === "right" && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-300 p-2 shadow-xl rounded-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => handleSelectSideBlock("right", "header")}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 hover:border-slate-600 flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-900 text-[10px] font-bold"
                title="Kopfleiste"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-600" />
                <span>Kopfleiste</span>
              </button>
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
        {/* HEADER BLOCK */}
        {block.type === "header" && (
          (() => {
            const cfg = block.config as HeaderBlockConfig;
            const fontCss = getFontFamilyCss(cfg.fontFamily);
            const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 20;
            const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 24;
            const textAlign = cfg.textAlign || "center";
            const alignClass =
              textAlign === "left"
                ? "text-left items-start"
                : textAlign === "right"
                ? "text-right items-end"
                : "text-center items-center";

            return (
              <div
                style={{
                  paddingTop: `${paddingY}px`,
                  paddingBottom: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                  backgroundColor: cfg.backgroundColor || "#f8fafc",
                  textAlign,
                  fontFamily: fontCss,
                }}
                className={`flex flex-col ${alignClass} rounded-none select-none`}
              >
                {cfg.logoUrl && (
                  <div className="mb-2.5">
                    <img
                      src={cfg.logoUrl}
                      alt={cfg.logoAlt || "Logo"}
                      style={{
                        maxHeight: `${cfg.logoHeight || 44}px`,
                        height: "auto",
                        maxWidth: "100%",
                      }}
                      className="inline-block object-contain"
                    />
                  </div>
                )}
                <div
                  style={{
                    fontSize: `${cfg.fontSize || 20}px`,
                    lineHeight: cfg.lineHeight || 1.3,
                    color: cfg.color || "#0f172a",
                  }}
                  className="font-extrabold tracking-tight"
                >
                  {renderTextContent(cfg.title || "[Vereinsname]")}
                </div>
                {cfg.subtitle && (
                  <div
                    style={{
                      fontSize: `${cfg.subtitleFontSize || 13}px`,
                      color: cfg.subtitleColor || "#64748b",
                    }}
                    className="mt-1 font-medium leading-relaxed"
                  >
                    {renderTextContent(cfg.subtitle)}
                  </div>
                )}
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
                    value={cfg.content || ""}
                    onChange={(e) => {
                      onUpdateBlock?.({
                        ...block,
                        config: { ...cfg, content: e.target.value },
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Schreibe deinen Text direkt hier hinein..."
                    className="w-full bg-transparent border-0 outline-none resize-none p-0 m-0 focus:ring-0 focus:outline-none placeholder-slate-400"
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
            const alignClass =
              cfg.align === "center"
                ? "text-center"
                : cfg.align === "right"
                ? "text-right"
                : "text-left";

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
                }}
                className={`${alignClass} rounded-none`}
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
                  className={`inline-flex items-center gap-2 font-bold text-sm shadow-xs transition-transform select-none ${shapeClass}`}
                >
                  <span>{cfg.label || "Aktion ausführen"}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </div>

                {!previewMode && (
                  <div className="mt-1.5 text-[10px] text-slate-400 font-mono truncate max-w-full">
                    {cfg.linkType === "dynamic" ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-none border border-slate-300">
                        Dynamisch: [{cfg.dynamicLinkKey}]
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Link: {cfg.staticUrl || "https://..."}
                      </span>
                    )}
                  </div>
                )}
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
