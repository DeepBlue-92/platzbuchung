import React, { useRef } from "react";
import {
  LayoutTemplate,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import {
  TemplateBlock,
  ColumnsBlockConfig,
  TextBlockConfig,
  ButtonBlockConfig,
  ImageBlockConfig,
} from "../../../types/notifications";
import { getFontFamilyCss } from "../../../services/blockTemplateCompiler";

interface ColumnsBlockViewProps {
  block: TemplateBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updated: TemplateBlock) => void;
  previewDevice?: "desktop" | "mobile";
  onSelectChildBlock?: (blockId: string) => void;
}

export const ColumnsBlockView: React.FC<ColumnsBlockViewProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdate,
  previewDevice = "desktop",
}) => {
  const cfg = block.config as ColumnsBlockConfig;
  const columns = cfg.columns || [];
  const gap = 0; // Fest auf 0px fixiert
  const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
  const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
  const bgColor = cfg.backgroundColor || "transparent";
  const verticalAlign = "middle"; // Immer fest vertikal zentriert

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadTarget = useRef<{
    colId: string;
    childId: string;
  } | null>(null);

  // Helper to update column config
  const updateColumns = (newCols: typeof columns) => {
    onUpdate({
      ...block,
      config: {
        ...cfg,
        gap: 0,
        verticalAlign: "middle",
        columns: newCols,
      },
    });
  };

  // Update a child block's config
  const handleUpdateChild = (
    colId: string,
    childId: string,
    partialConfig: any
  ) => {
    const nextCols = columns.map((col) => {
      if (col.id === colId) {
        return {
          ...col,
          blocks: (col.blocks || []).map((b) =>
            b.id === childId ? { ...b, config: { ...b.config, ...partialConfig } } : b
          ),
        };
      }
      return col;
    });
    updateColumns(nextCols);
  };

  // File upload for column image/logo
  const handleTriggerUpload = (colId: string, childId: string) => {
    activeUploadTarget.current = { colId, childId };
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadTarget.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && activeUploadTarget.current) {
        handleUpdateChild(
          activeUploadTarget.current.colId,
          activeUploadTarget.current.childId,
          { imageUrl: reader.result, align: "center" }
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const vAlignClass = "items-center"; // Fest vertikal zentriert
  const isMobile = previewDevice === "mobile";

  // Font and color styles from block config
  const titleFont = getFontFamilyCss(cfg.titleFontFamily);
  const titleSize = cfg.titleFontSize || 18;
  const titleColor = cfg.titleColor || "#0f172a";

  const subtitleFont = getFontFamilyCss(cfg.subtitleFontFamily);
  const subtitleSize = cfg.subtitleFontSize || 13;
  const subtitleColor = cfg.subtitleColor || "#64748b";

  return (
    <div
      onClick={onSelect}
      style={{
        backgroundColor: bgColor,
        backgroundImage: cfg.backgroundImageUrl ? `url(${cfg.backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        boxSizing: "border-box",
      }}
      className={`relative group transition-all rounded-lg cursor-pointer ${
        isSelected
          ? "ring-2 ring-emerald-600 ring-offset-2 shadow-sm"
          : "hover:ring-1 hover:ring-slate-300"
      }`}
    >
      {/* Hidden file input for logo */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Badge for Selected Block */}
      {isSelected && (
        <div className="absolute -top-3 left-4 z-20 bg-slate-900 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs pointer-events-none select-none">
          <LayoutTemplate className="w-3 h-3 text-emerald-400" />
          <span>KOPFZEILE</span>
        </div>
      )}

      {/* 2-Columns Container (Gap = 0px) */}
      <div
        style={{
          gap: "0px",
          boxSizing: "border-box",
        }}
        className={`flex ${isMobile ? "flex-col" : "flex-row"} ${vAlignClass} w-full`}
      >
        {columns.map((col, idx) => {
          const widthStyle = isMobile
            ? { width: "100%", boxSizing: "border-box" as const }
            : {
                width: `${col.widthPercent}%`,
                flexBasis: `${col.widthPercent}%`,
                boxSizing: "border-box" as const,
              };

          const textBlocks = (col.blocks || []).filter((b) => b.type === "text");
          const hasMultipleTextBlocks = textBlocks.length >= 2;

          return (
            <div
              key={col.id || idx}
              style={widthStyle}
              className="relative p-1 rounded-lg flex flex-col min-w-0"
            >
              {/* Column Child Blocks (Wappen/Logo links, Text rechts) */}
              <div className="space-y-1.5 flex-1 min-w-0">
                {(col.blocks || []).map((child, childIdx) => {
                  if (child.type === "image") {
                    const imgCfg = child.config as ImageBlockConfig;
                    return (
                      <div
                        key={child.id}
                        className="group/child relative p-1 rounded-md flex flex-col items-center justify-center text-center w-full"
                      >
                        {imgCfg.imageUrl ? (
                          <div className="relative group/img flex flex-col items-center justify-center text-center w-full mx-auto">
                            <img
                              src={imgCfg.imageUrl}
                              alt={imgCfg.altText || "Wappen/Logo"}
                              className="max-w-full max-h-24 h-auto object-contain rounded mx-auto block shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerUpload(col.id, child.id);
                              }}
                              className="absolute inset-0 bg-slate-900/40 text-white text-[10px] font-bold flex items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity rounded cursor-pointer"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Ändern</span>
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerUpload(col.id, child.id);
                            }}
                            className="w-full max-w-[150px] border border-dashed border-slate-300 rounded-lg p-3 text-center hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors cursor-pointer mx-auto flex flex-col items-center justify-center"
                          >
                            <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                            <div className="text-[11px] font-bold text-slate-700">
                              Wappen/Logo
                            </div>
                            <div className="text-[9px] text-slate-400">
                              Klicken zum Hochladen
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (child.type === "button") {
                    const btnCfg = child.config as ButtonBlockConfig;
                    return (
                      <div
                        key={child.id}
                        className="group/child relative p-1 rounded-md"
                      >
                        <div
                          style={{
                            backgroundColor: btnCfg.buttonColor || "#047857",
                            color: btnCfg.textColor || "#ffffff",
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-center inline-block shadow-2xs"
                        >
                          {btnCfg.label || "Aktion"}
                        </div>
                      </div>
                    );
                  }

                  // Default text block handling (2 getrennte Eingabefelder für Vereinsname & Untertitel)
                  const txtCfg = child.config as TextBlockConfig;

                  if (hasMultipleTextBlocks) {
                    const isTitleBlock = childIdx === 0;
                    return (
                      <div key={child.id}>
                        <input
                          type="text"
                          value={txtCfg.content || ""}
                          onChange={(e) =>
                            handleUpdateChild(col.id, child.id, {
                              content: e.target.value,
                            })
                          }
                          placeholder={isTitleBlock ? "Vereinsname" : "Untertitel"}
                          style={
                            isTitleBlock
                              ? {
                                  fontFamily: titleFont,
                                  fontSize: `${titleSize}px`,
                                  color: titleColor,
                                }
                              : {
                                  fontFamily: subtitleFont,
                                  fontSize: `${subtitleSize}px`,
                                  color: subtitleColor,
                                }
                          }
                          className={`w-full bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-2 py-1 outline-none transition-colors ${
                            isTitleBlock ? "font-extrabold" : "font-medium"
                          }`}
                        />
                      </div>
                    );
                  }

                  // Single text block with title and subtitle lines
                  const fullContent = txtCfg.content || "";
                  const lines = fullContent.split("\n");
                  let titleLine = lines[0] || "";
                  let subtitleLine = lines.slice(1).join("\n") || "";

                  // Remove pre-filled static defaults so empty fields display placeholders
                  if (titleLine.trim() === "[Vereinsname]") {
                    titleLine = "";
                  }
                  if (subtitleLine.trim() === "Offizielle Mitteilung") {
                    subtitleLine = "";
                  }

                  return (
                    <div key={child.id} className="space-y-1">
                      {/* 1. Eingabefeld: Vereinsname (Keine redundante Doppelzeile darunter) */}
                      <div>
                        <input
                          type="text"
                          value={titleLine}
                          onChange={(e) => {
                            const newTitle = e.target.value;
                            const nextContent = subtitleLine
                              ? `${newTitle}\n${subtitleLine}`
                              : newTitle;
                            handleUpdateChild(col.id, child.id, {
                              content: nextContent,
                            });
                          }}
                          placeholder="Vereinsname"
                          style={{
                            fontFamily: titleFont,
                            fontSize: `${titleSize}px`,
                            color: titleColor,
                          }}
                          className="w-full font-extrabold bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-2 py-0.5 outline-none transition-colors"
                        />
                      </div>

                      {/* 2. Eingabefeld: Untertitel (Keine redundante Doppelzeile darunter) */}
                      <div>
                        <input
                          type="text"
                          value={subtitleLine}
                          onChange={(e) => {
                            const newSubtitle = e.target.value;
                            const nextContent = `${titleLine}\n${newSubtitle}`;
                            handleUpdateChild(col.id, child.id, {
                              content: nextContent,
                            });
                          }}
                          placeholder="Untertitel"
                          style={{
                            fontFamily: subtitleFont,
                            fontSize: `${subtitleSize}px`,
                            color: subtitleColor,
                          }}
                          className="w-full font-medium bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-2 py-0.5 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
