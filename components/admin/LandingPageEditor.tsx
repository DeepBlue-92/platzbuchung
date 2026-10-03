import React, { useState, useEffect } from "react";
import {
  LandingPageConfig,
  BentoItem,
  BentoItemType,
} from "../../types";
import {
  saveLandingPageConfig,
  getLandingPageConfig,
} from "../../services/landingPageService";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Check,
  LayoutGrid,
  Eye,
  Edit3,
  Calendar,
  PartyPopper,
  Trophy,
  FileText,
  CloudSun,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import { RichTextRenderer } from "../RichText";
import { WorkletCourts } from "../bento/WorkletCourts";
import { WorkletEvents } from "../bento/WorkletEvents";
import { WorkletChampionship } from "../bento/WorkletChampionship";
import { WorkletWeather } from "../bento/WorkletWeather";
import { WorkletHeroBanner } from "../bento/WorkletHeroBanner";

interface LandingPageEditorProps {
  vereinsId: string;
  authorName?: string;
  onSaved?: (updatedConfig: LandingPageConfig) => void;
  clubName?: string;
  primaryColor?: string;
}

const TILE_TYPES: {
  type: BentoItemType;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  defaultTitle: string;
  defaultColSpan: 4 | 6 | 8 | 12;
}[] = [
  {
    type: "hero_banner",
    label: "Hero-Banner",
    icon: Sparkles,
    defaultTitle: "Willkommen beim Verein",
    defaultColSpan: 8,
  },
  {
    type: "rich_text",
    label: "Text / News",
    icon: FileText,
    defaultTitle: "Vereinsinformation",
    defaultColSpan: 4,
  },
  {
    type: "worklet_courts",
    label: "Platzampel",
    icon: Calendar,
    defaultTitle: "Platzreservierung",
    defaultColSpan: 8,
  },
  {
    type: "worklet_events",
    label: "Veranstaltungen",
    icon: PartyPopper,
    defaultTitle: "Veranstaltungen & Termine",
    defaultColSpan: 4,
  },
  {
    type: "worklet_championship",
    label: "Meisterschaft",
    icon: Trophy,
    defaultTitle: "Vereinsmeisterschaft",
    defaultColSpan: 4,
  },
  {
    type: "worklet_weather",
    label: "Wetter & Radar",
    icon: CloudSun,
    defaultTitle: "Wetter & Platzkondition",
    defaultColSpan: 4,
  },
];

export const LandingPageEditor: React.FC<LandingPageEditorProps> = ({
  vereinsId,
  authorName,
  onSaved,
  clubName = "Tennisclub",
  primaryColor = "#1b4332",
}) => {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isBottomAddMenuOpen, setIsBottomAddMenuOpen] = useState(false);

  // Load configuration
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    getLandingPageConfig(vereinsId, true)
      .then((cfg) => {
        if (isMounted) {
          setConfig(cfg);
          if (cfg.items && cfg.items.length > 0) {
            setExpandedId(cfg.items[0].id);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading landing page config:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [vereinsId]);

  if (isLoading || !config) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium text-sm flex items-center justify-center gap-2">
        <i className="fa-solid fa-spinner fa-spin text-emerald-600"></i>
        <span>Startseiten-Konfiguration wird geladen...</span>
      </div>
    );
  }

  const items = config.items || [];

  const handleUpdateItem = (id: string, partial: Partial<BentoItem>) => {
    setConfig({
      ...config,
      items: items.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    });
    setSaveSuccess(false);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const ordered = newItems.map((it, idx) => ({ ...it, order: idx }));
    setConfig({ ...config, items: ordered });
    setSaveSuccess(false);
  };

  const handleDeleteItem = (id: string) => {
    const filtered = items
      .filter((it) => it.id !== id)
      .map((it, idx) => ({ ...it, order: idx }));
    setConfig({ ...config, items: filtered });
    if (expandedId === id) setExpandedId(filtered[0]?.id || null);
    if (previewId === id) setPreviewId(null);
    setSaveSuccess(false);
  };

  const handleAddItem = (type: BentoItemType = "rich_text", targetIndex?: number) => {
    const meta = TILE_TYPES.find((t) => t.type === type);
    const newId = `bento_${Date.now()}`;
    const newItem: BentoItem = {
      id: newId,
      type,
      col_span: meta?.defaultColSpan || 4,
      order: 0,
      title: meta?.defaultTitle || "Information",
      eyebrow: type === "hero_banner" ? "HERZLICH WILLKOMMEN" : undefined,
      content:
        type === "hero_banner"
          ? "Erlebe erstklassige Plätze, modernes Flutlicht und eine herzliche Vereinsgemeinschaft mitten im Grünen. Jetzt Platz buchen oder bei unseren Events vorbeischauen!"
          : type === "rich_text"
          ? "Hier steht der Text für Ankündigungen, Termine und Vereinsinformationen."
          : "",
      image_url:
        type === "hero_banner"
          ? "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80"
          : undefined,
      bg_color_start: type === "hero_banner" ? "#064e3b" : undefined,
      bg_color_end: type === "hero_banner" ? "#0f172a" : undefined,
      cta_text: type === "hero_banner" ? "Jetzt Platz buchen" : undefined,
      cta_link: type === "hero_banner" ? "reservation" : undefined,
      default_view: type === "worklet_courts" ? "day" : undefined,
      city: type === "worklet_weather" ? "Furth" : undefined,
      latitude: type === "worklet_weather" ? 48.59 : undefined,
      longitude: type === "worklet_weather" ? 12.02 : undefined,
    };

    let updatedList: BentoItem[];
    if (typeof targetIndex === "number" && targetIndex >= 0 && targetIndex <= items.length) {
      updatedList = [...items.slice(0, targetIndex), newItem, ...items.slice(targetIndex)];
    } else {
      updatedList = [...items, newItem];
    }

    const ordered = updatedList.map((it, idx) => ({ ...it, order: idx }));
    setConfig({ ...config, items: ordered });
    setExpandedId(newId);
    setIsAddMenuOpen(false);
    setIsBottomAddMenuOpen(false);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveLandingPageConfig(vereinsId, config, authorName);
      setSaveSuccess(true);
      if (onSaved) onSaved(config);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error("Error saving landing page config:", err);
      alert(`Fehler beim Speichern: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 select-text">
      {/* Top Toolbar: Harmonized styling matching theme */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Startseiten-Designer
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Kacheln und Module für die öffentliche Vereinsstartseite konfigurieren.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 relative flex-wrap sm:flex-nowrap">
          {/* Add Tile Button */}
          <div className="relative flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="w-full sm:w-auto h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Plus className="w-4 h-4 text-slate-600" />
              <span>Kachel hinzufügen</span>
            </button>

            {isAddMenuOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-11 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Kacheltyp wählen
                </div>
                {TILE_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => handleAddItem(t.type)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save Button (Primary Action) */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            style={{ backgroundColor: primaryColor }}
            className="flex-1 sm:flex-none h-9 px-4 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:brightness-95 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Wird gespeichert...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Gespeichert!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Änderungen speichern</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accordion List of Grid Cards or Empty State */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <LayoutGrid className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Keine Kacheln vorhanden</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Die Startseite ist aktuell leer. Klicke auf „Kachel hinzufügen“, um ein Modul anzulegen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddMenuOpen(true)}
            className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Erste Kachel erstellen</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const isPreview = previewId === item.id;
            const currentMeta = TILE_TYPES.find((t) => t.type === item.type) || TILE_TYPES[0];
            const IconComp = currentMeta.icon;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-2xs overflow-hidden ${
                  isExpanded
                    ? "border-slate-300 ring-1 ring-slate-200 shadow-sm"
                    : "border-slate-200/90 hover:border-slate-300"
                }`}
              >
                {/* Collapsed Header Summary Bar */}
                <div
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none bg-white hover:bg-slate-50/70 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Position Badge */}
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200/60">
                      {index + 1}
                    </span>

                    {/* Type Icon & Label */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold shrink-0 border border-slate-200/50">
                      <IconComp className="w-3.5 h-3.5 text-slate-600" />
                      <span>{currentMeta.label}</span>
                    </div>

                    {/* Title */}
                    <span className="text-sm font-semibold text-slate-900 truncate min-w-0">
                      {item.title || "Unbenannte Kachel"}
                    </span>

                    {/* Width Badge */}
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md shrink-0 hidden sm:inline">
                      {item.col_span === 4 ? "1/3 Schmal" : item.col_span === 8 ? "2/3 Breit" : "Vollbild (3/3)"}
                    </span>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Preview Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewId(isPreview ? null : item.id);
                        if (!isExpanded) setExpandedId(item.id);
                      }}
                      className={`h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                        isPreview
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      title="Live-Vorschau dieser Kachel"
                    >
                      {isPreview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span className="hidden sm:inline">{isPreview ? "Editor" : "Vorschau"}</span>
                    </button>

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                      title="Nach oben schieben"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => handleMove(index, "down")}
                      className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                      title="Nach unten schieben"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="w-7 h-7 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                      title="Kachel entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Chevron Expand/Collapse */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors ml-0.5 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Body: Editor Form or Preview */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in duration-150">
                    {isPreview ? (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
                          <span>Live-Vorschau</span>
                          <span className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded">
                            Breite: {item.col_span === 4 ? "1/3 (Schmal)" : item.col_span === 8 ? "2/3 (Breit)" : "3/3 (Vollbild)"}
                          </span>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
                          {item.type === "hero_banner" ? (
                            <WorkletHeroBanner
                              item={item}
                              primaryColor={primaryColor}
                              clubName={clubName}
                            />
                          ) : item.type === "worklet_courts" ? (
                            <WorkletCourts
                              item={item}
                              courts={["Platz 1", "Platz 2", "Platz 3"]}
                              bookings={[]}
                              onNavigateToBooking={() => {}}
                              primaryColor={primaryColor}
                            />
                          ) : item.type === "worklet_events" ? (
                            <WorkletEvents
                              item={item}
                              tournaments={[]}
                              currentUser={null}
                              onOpenLogin={() => {}}
                              onNavigateToEvents={() => {}}
                            />
                          ) : item.type === "worklet_championship" ? (
                            <WorkletChampionship
                              item={item}
                              clubId={vereinsId}
                              onNavigateToChampionship={() => {}}
                            />
                          ) : item.type === "worklet_weather" ? (
                            <WorkletWeather
                              item={item}
                              clubCity={item.city || clubName}
                            />
                          ) : (
                            <div className="space-y-2">
                              {item.title && <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>}
                              <div className="text-sm text-slate-700 leading-relaxed">
                                <RichTextRenderer text={item.content || ""} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Row 1: Fixed Modultyp & Fixed Raster Width Display */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                          {/* Modultyp */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                              Modultyp
                            </label>
                            <div className="h-10 px-3.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
                              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                <IconComp className="w-3.5 h-3.5 text-slate-600" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {currentMeta.label}
                              </span>
                            </div>
                          </div>

                          {/* Feste Rasterbreite (Systemvorgabe) */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                              Rasterbreite (durch Typ vorgegeben)
                            </label>
                            <div className="h-10 px-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between shadow-2xs text-xs font-medium text-slate-700">
                              <span className="font-bold text-slate-800">
                                {currentMeta.defaultColSpan === 4
                                  ? "1/3 Spalte (Kompakt)"
                                  : currentMeta.defaultColSpan === 8
                                  ? "2/3 Spalte (Breit)"
                                  : "3/3 Spalten (Vollbild)"}
                              </span>
                              <span className="text-[10.5px] font-mono text-slate-400 bg-white border border-slate-200/70 px-2 py-0.5 rounded-md">
                                {currentMeta.defaultColSpan}/12 Spalten
                              </span>
                            </div>
                          </div>
                        </div>

                      {/* Row 2: Category / Dachzeile & Title */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1 space-y-1">
                          <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                            Kategorie / Dachzeile (optional)
                          </label>
                          <input
                            type="text"
                            value={item.eyebrow || ""}
                            onChange={(e) => handleUpdateItem(item.id, { eyebrow: e.target.value })}
                            placeholder="z. B. AKTUELLES"
                            className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                            Titel der Kachel
                          </label>
                          <input
                            type="text"
                            value={item.title || ""}
                            onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                            placeholder="Titel eingeben"
                            className="w-full h-9 px-3 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Module-specific fields */}
                      {item.type === "hero_banner" && (
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-3">
                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Hero-Banner Einstellungen</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10.5px] font-semibold text-slate-600">
                                Hintergrundbild URL
                              </label>
                              <input
                                type="text"
                                value={item.image_url || ""}
                                onChange={(e) => handleUpdateItem(item.id, { image_url: e.target.value })}
                                placeholder="https://..."
                                className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[10.5px] font-semibold text-slate-600">
                                  Verlauf Start
                                </label>
                                <div className="flex items-center gap-1.5 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2">
                                  <input
                                    type="color"
                                    value={item.bg_color_start || "#064e3b"}
                                    onChange={(e) => handleUpdateItem(item.id, { bg_color_start: e.target.value })}
                                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                                  />
                                  <span className="text-[11px] font-mono text-slate-600">{item.bg_color_start || "#064e3b"}</span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[10.5px] font-semibold text-slate-600">
                                  Verlauf Ende
                                </label>
                                <div className="flex items-center gap-1.5 h-8 bg-slate-50 border border-slate-200 rounded-lg px-2">
                                  <input
                                    type="color"
                                    value={item.bg_color_end || "#0f172a"}
                                    onChange={(e) => handleUpdateItem(item.id, { bg_color_end: e.target.value })}
                                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                                  />
                                  <span className="text-[11px] font-mono text-slate-600">{item.bg_color_end || "#0f172a"}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <label className="block text-[10.5px] font-semibold text-slate-600">
                                Button-Beschriftung (optional)
                              </label>
                              <input
                                type="text"
                                value={item.cta_text || ""}
                                onChange={(e) => handleUpdateItem(item.id, { cta_text: e.target.value })}
                                placeholder="z. B. Jetzt Platz buchen"
                                className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10.5px] font-semibold text-slate-600">
                                Button-Ziel
                              </label>
                              <select
                                value={item.cta_link || "reservation"}
                                onChange={(e) => handleUpdateItem(item.id, { cta_link: e.target.value })}
                                className="w-full h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer"
                              >
                                <option value="reservation">Platzbuchung (Intern)</option>
                                <option value="tournaments">Veranstaltungen & Turniere</option>
                                <option value="championship">Vereinsmeisterschaft</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {item.type === "worklet_courts" && (
                        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
                          <span className="text-xs font-semibold text-slate-700">Standard-Ansicht</span>
                          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { default_view: "day" })}
                              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                (item.default_view || "day") === "day"
                                  ? "bg-white text-slate-900 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Tagesansicht
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { default_view: "week" })}
                              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                item.default_view === "week"
                                  ? "bg-white text-slate-900 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Wochenansicht
                            </button>
                          </div>
                        </div>
                      )}

                      {item.type === "worklet_weather" && (
                        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10.5px] font-semibold text-slate-600">
                              Stadt / Ort
                            </label>
                            <input
                              type="text"
                              value={item.city || ""}
                              onChange={(e) => handleUpdateItem(item.id, { city: e.target.value })}
                              placeholder="z. B. Furth"
                              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10.5px] font-semibold text-slate-600">
                              Breitengrad (Latitude)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.latitude ?? 48.59}
                              onChange={(e) => handleUpdateItem(item.id, { latitude: parseFloat(e.target.value) || 0 })}
                              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10.5px] font-semibold text-slate-600">
                              Längengrad (Longitude)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.longitude ?? 12.02}
                              onChange={(e) => handleUpdateItem(item.id, { longitude: parseFloat(e.target.value) || 0 })}
                              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Content Textarea (for rich_text and hero_banner) */}
                      {(item.type === "rich_text" || item.type === "hero_banner") && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                            Inhaltstext
                          </label>
                          <textarea
                            value={item.content || ""}
                            onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                            rows={4}
                            placeholder="Text für die Kachel eingeben..."
                            className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none leading-relaxed transition-all font-sans"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Backdrop for closing popups */}
      {(isAddMenuOpen || isBottomAddMenuOpen) && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setIsAddMenuOpen(false);
            setIsBottomAddMenuOpen(false);
          }}
        />
      )}

      {/* Bottom Add Tile Bar */}
      <div className="pt-2 flex items-center justify-center relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBottomAddMenuOpen((prev) => !prev)}
            className="h-9 px-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Weitere Kachel am Ende hinzufügen</span>
          </button>

          {isBottomAddMenuOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-11 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3.5 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Kacheltyp wählen
              </div>
              {TILE_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => handleAddItem(t.type)}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
