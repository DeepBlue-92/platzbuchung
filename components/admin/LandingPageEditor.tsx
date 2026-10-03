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
  Info,
  MapPin,
} from "lucide-react";
import { RichTextRenderer } from "../RichText";
import { WorkletCourts } from "../bento/WorkletCourts";
import { WorkletEvents } from "../bento/WorkletEvents";
import { WorkletChampionship } from "../bento/WorkletChampionship";
import { WorkletWeather } from "../bento/WorkletWeather";

interface LandingPageEditorProps {
  vereinsId: string;
  authorName?: string;
  onSaved?: (updatedConfig: LandingPageConfig) => void;
}

const TILE_TYPES: {
  type: BentoItemType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultTitle: string;
  defaultColSpan: 4 | 6 | 8 | 12;
}[] = [
  {
    type: "rich_text",
    label: "Formatierter Text / Ankündigung",
    shortLabel: "Text",
    icon: FileText,
    description: "Freier Fließtext für Ankündigungen, Öffnungszeiten, Termine & News.",
    defaultTitle: "Vereins-Information",
    defaultColSpan: 6,
  },
  {
    type: "worklet_courts",
    label: "Platzreservierung (Live-Belegung)",
    shortLabel: "Plätze",
    icon: Calendar,
    description: "Live-Buchungsmatrix mit Tages- & Wochenansicht, Statusfarben und Direktlink.",
    defaultTitle: "Platzreservierung",
    defaultColSpan: 8,
  },
  {
    type: "worklet_events",
    label: "Veranstaltungen & Turniere",
    shortLabel: "Events",
    icon: PartyPopper,
    description: "Kommende Events mit Datums-Badges, Teilnehmerzahl und Direktanmeldung.",
    defaultTitle: "Veranstaltungen & Termine",
    defaultColSpan: 4,
  },
  {
    type: "worklet_championship",
    label: "Vereinsmeisterschaft",
    shortLabel: "Meisterschaft",
    icon: Trophy,
    description: "K.o.-Ast-Fragment / Finalpaarungen und Absprung zum Turnierbaum.",
    defaultTitle: "Vereinsmeisterschaft",
    defaultColSpan: 6,
  },
  {
    type: "worklet_weather",
    label: "Wetter & Live-Regenradar",
    shortLabel: "Wetter",
    icon: CloudSun,
    description: "Open-Meteo Messwerte, Platz-Ampel und interaktives RainViewer Regenradar.",
    defaultTitle: "Wetter & Platz-Kondition",
    defaultColSpan: 4,
  },
];

export const LandingPageEditor: React.FC<LandingPageEditorProps> = ({
  vereinsId,
  authorName,
  onSaved,
}) => {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Load configuration
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    getLandingPageConfig(vereinsId, true)
      .then((cfg) => {
        if (isMounted) {
          setConfig(cfg);
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
      <div className="p-8 text-center text-slate-400 font-medium text-sm flex items-center justify-center gap-2">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <span>Lade Startseiten-Konfiguration...</span>
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

  const handleChangeType = (id: string, newType: BentoItemType) => {
    const meta = TILE_TYPES.find((t) => t.type === newType);
    setConfig({
      ...config,
      items: items.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          type: newType,
          title:
            it.title.trim() === "Neuer Textbereich" ||
            it.title.trim() === "Unbenannte Kachel" ||
            !it.title.trim()
              ? meta?.defaultTitle || "Information"
              : it.title,
          default_view: newType === "worklet_courts" ? it.default_view || "day" : undefined,
          city: newType === "worklet_weather" ? it.city || "Furth" : it.city,
          latitude: newType === "worklet_weather" ? it.latitude ?? 48.59 : it.latitude,
          longitude: newType === "worklet_weather" ? it.longitude ?? 12.02 : it.longitude,
        };
      }),
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
    if (items.length <= 1) {
      alert("Es muss mindestens eine Kachel auf der Startseite verbleiben.");
      return;
    }
    const filtered = items
      .filter((it) => it.id !== id)
      .map((it, idx) => ({ ...it, order: idx }));
    setConfig({ ...config, items: filtered });
    setSaveSuccess(false);
  };

  const handleAddItem = (type: BentoItemType = "rich_text") => {
    const meta = TILE_TYPES.find((t) => t.type === type);
    const newId = `bento_${Date.now()}`;
    const newItem: BentoItem = {
      id: newId,
      type,
      col_span: meta?.defaultColSpan || 6,
      order: items.length,
      title: meta?.defaultTitle || "Information",
      content:
        type === "rich_text"
          ? "Hier steht der formatierte Fließtext für Ankündigungen, Termine und Informationen.\n\n* Wichtiger Punkt 1\n* Wichtiger Punkt 2\n\nNutze **fett**, _kursiv_ oder Links."
          : "",
      default_view: type === "worklet_courts" ? "day" : undefined,
      city: type === "worklet_weather" ? "Furth" : undefined,
      latitude: type === "worklet_weather" ? 48.59 : undefined,
      longitude: type === "worklet_weather" ? 12.02 : undefined,
    };
    setConfig({
      ...config,
      items: [...items, newItem],
    });
    setIsAddMenuOpen(false);
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
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Startseite bearbeiten (Bento-Grid)
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Gestalte die Kacheln der Startseite im flexiblen 12-Spalten-Raster. Wähle zwischen formatierten Textbereichen und interaktiven Modul-Worklets für Plätze, Events, Meisterschaft und Live-Wetter.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 relative">
          <div className="relative flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="w-full sm:w-auto h-9 px-3.5 rounded-xl border border-slate-200 hover:border-[var(--color-primary)] bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Kachel hinzufügen</span>
            </button>

            {isAddMenuOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-11 w-68 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Kachel-Typ auswählen
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
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 leading-tight">
                          {t.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className={`flex-1 sm:flex-none h-9 px-5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer ${
              saveSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[var(--color-primary)] hover:brightness-95"
            }`}
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Speichert...</span>
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

      {/* Grid of Tile Editors */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const isPreviewing = activePreviewId === item.id;
          const currentMeta = TILE_TYPES.find((t) => t.type === item.type) || TILE_TYPES[0];
          const IconComp = currentMeta.icon;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 transition-all hover:border-slate-300"
            >
              {/* Tile Header Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                    {item.title || "Unbenannte Kachel"}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-primary)] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                    <IconComp className="w-3 h-3" />
                    <span>{currentMeta.shortLabel}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                    Spalten: {item.col_span} / 12
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Preview Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setActivePreviewId(isPreviewing ? null : item.id)
                    }
                    className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      isPreviewing
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Vorschau umschalten"
                  >
                    {isPreviewing ? (
                      <>
                        <Edit3 className="w-3 h-3" />
                        <span className="hidden sm:inline">Editor</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">Vorschau</span>
                      </>
                    )}
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                    title="Nach oben verschieben"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => handleMove(index, "down")}
                    className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                    title="Nach unten verschieben"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Tile */}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="w-7 h-7 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                    title="Kachel löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tile Content Form or Preview */}
              {isPreviewing ? (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-3 flex items-center justify-between">
                    <span>Live-Vorschau der Kachel</span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[9px] font-semibold text-slate-500">
                      Desktop-Breite: {item.col_span}/12
                    </span>
                  </div>

                  {item.type === "worklet_courts" ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                      <WorkletCourts
                        item={item}
                        courts={["Platz 1", "Platz 2", "Platz 3"]}
                        bookings={[
                          {
                            id: "demo_1",
                            court: "Platz 1",
                            date: new Date().toISOString().split("T")[0],
                            time: "09:00",
                            players: ["M. Mustermann", "T. Test"],
                          } as any,
                          {
                            id: "demo_2",
                            court: "Platz 2",
                            date: new Date().toISOString().split("T")[0],
                            time: "17:00",
                            is_locked: true,
                          } as any,
                        ]}
                        onNavigateToBooking={() => {}}
                      />
                    </div>
                  ) : item.type === "worklet_events" ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                      <WorkletEvents
                        item={item}
                        tournaments={[
                          {
                            id: "demo_ev_1",
                            title: "Saison-Eröffnungsturnier",
                            date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
                            startTime: "10:00",
                            participants: ["Spieler 1", "Spieler 2"],
                            maxParticipants: 16,
                          } as any,
                          {
                            id: "demo_ev_2",
                            title: "Sommerfest & Schleifchenturnier",
                            date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                            startTime: "14:00",
                            participants: ["Mitglied A", "Mitglied B", "Mitglied C"],
                            maxParticipants: 24,
                          } as any,
                        ]}
                        currentUser={null}
                        onOpenLogin={() => {}}
                        onNavigateToEvents={() => {}}
                      />
                    </div>
                  ) : item.type === "worklet_championship" ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                      <WorkletChampionship
                        item={item}
                        clubId={vereinsId}
                        onNavigateToChampionship={() => {}}
                      />
                    </div>
                  ) : item.type === "worklet_weather" ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                      <WorkletWeather
                        item={item}
                        clubCity={item.city || "Furth"}
                      />
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                      <div className="pb-3 mb-3 border-b border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                          {item.eyebrow || "VEREINSINFO"}
                        </span>
                        <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                          {item.title}
                        </h3>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm text-slate-600 leading-relaxed font-normal">
                        <RichTextRenderer text={item.content || ""} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Type Selector (Segmented) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Kachel-Typ
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {TILE_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = (item.type || "rich_text") === t.type;
                        return (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => handleChangeType(item.id, t.type)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              isSelected
                                ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-400" : "text-[var(--color-primary)]"}`} />
                              <span className="text-[11px] font-bold leading-tight truncate">
                                {t.shortLabel}
                              </span>
                            </div>
                            <span className={`text-[9px] line-clamp-1 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title, Eyebrow and Width Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Eyebrow Input */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Eyebrow-Badge (Optional)
                      </label>
                      <input
                        type="text"
                        value={item.eyebrow || ""}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { eyebrow: e.target.value })
                        }
                        placeholder="z. B. NEWS, WETTER"
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs font-bold text-slate-900 transition-all uppercase placeholder:normal-case"
                      />
                    </div>

                    {/* Title Input */}
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Titel der Kachel
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { title: e.target.value })
                        }
                        placeholder="z. B. Platzreservierung oder Willkommen"
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs font-bold text-slate-900 transition-all"
                      />
                    </div>

                    {/* Width Buttons */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Spaltenbreite (Desktop)
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { val: 4, label: "1/3 (col-4)" },
                          { val: 6, label: "1/2 (col-6)" },
                          { val: 8, label: "2/3 (col-8)" },
                          { val: 12, label: "Voll (col-12)" },
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() =>
                              handleUpdateItem(item.id, {
                                col_span: btn.val as any,
                              })
                            }
                            className={`h-9 px-1 rounded-xl text-[10px] font-bold border transition-colors cursor-pointer ${
                              item.col_span === btn.val
                                ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Type-Specific Content Area */}
                  {item.type === "worklet_courts" ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                        <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                        <span>Worklet: Live-Platzreservierung</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Spiegelt die Buchungsmatrix mit Live-Status (Frei, Gebucht, Gesperrt), Segmented-Control-Umschalter für Tag / Woche und Direktlink zur Platzreservierung.
                      </p>

                      <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700">
                          Initial-Ansicht beim Laden:
                        </span>
                        <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(item.id, { default_view: "day" })}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              (item.default_view || "day") === "day"
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Tagesansicht
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(item.id, { default_view: "week" })}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              item.default_view === "week"
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Wochenansicht
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : item.type === "worklet_events" ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                        <PartyPopper className="w-4 h-4 text-[var(--color-primary)]" />
                        <span>Worklet: Veranstaltungen &amp; Turniere</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Bindet automatisch die nächsten anstehenden Vereinstermine mit Datums-Badges, Uhrzeiten und Teilnehmerzahlen ein. Die Höhe der Kachel wächst dynamisch mit der Anzahl der Events mit. Angemeldete Mitglieder können sich direkt per Klick anmelden.
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Keine manuelle Texteingabe nötig — Daten werden automatisch aus den Vereins-Veranstaltungen bezogen.</span>
                      </div>
                    </div>
                  ) : item.type === "worklet_championship" ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>Worklet: Vereinsmeisterschaft</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Zeigt aktuelle Spitzen- und Finalpaarungen der Vereinsmeisterschaft mit Spieler-Pills, Sieger-Abzeichen und Ergebnissen im selben visuellen Design wie der offizielle Turnierbaum.
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Daten werden automatisch aus der aktiven Vereinsmeisterschaft geladen.</span>
                      </div>
                    </div>
                  ) : item.type === "worklet_weather" ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                        <CloudSun className="w-4 h-4 text-[var(--color-primary)]" />
                        <span>Worklet: Wetter &amp; Live-Regenradar</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Zeigt Live-Wetterdaten von Open-Meteo, eine automatische Platzampel (trocken vs. Regen) und bietet ein interaktives Leaflet/RainViewer Regenradar mit Zeitschleife.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Ort / Stadt
                          </label>
                          <input
                            type="text"
                            value={item.city || "Furth"}
                            onChange={(e) => handleUpdateItem(item.id, { city: e.target.value })}
                            placeholder="z. B. Furth"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Breitengrad (Latitude)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={item.latitude ?? 48.59}
                            onChange={(e) => handleUpdateItem(item.id, { latitude: parseFloat(e.target.value) || 0 })}
                            placeholder="48.59"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Längengrad (Longitude)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={item.longitude ?? 12.02}
                            onChange={(e) => handleUpdateItem(item.id, { longitude: parseFloat(e.target.value) || 0 })}
                            placeholder="12.02"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Zero Firebase Cost: Daten werden clientseitig über Open-Meteo &amp; RainViewer geladen und 20 Min. im Browser gecacht.</span>
                      </div>
                    </div>
                  ) : (
                    /* Content Textarea for Rich Text */
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Fließtext / Inhalt
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Formatierung: **fett**, *kursiv*, __unterstrichen__, * Listenpunkte, [Link-Text](https://url)
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={item.content}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { content: e.target.value })
                        }
                        placeholder="Trage hier wichtige Mitteilungen, Termine oder sportliche Ereignisse ein..."
                        className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs text-slate-800 font-normal leading-relaxed transition-all resize-y"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Save Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleAddItem("rich_text")}
            className="h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>+ Text</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddItem("worklet_courts")}
            className="h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>+ Plätze</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddItem("worklet_events")}
            className="h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PartyPopper className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>+ Events</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddItem("worklet_championship")}
            className="h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>+ Meisterschaft</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddItem("worklet_weather")}
            className="h-9 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Wetter</span>
          </button>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className={`h-9 px-6 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer ${
            saveSuccess
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-[var(--color-primary)] hover:brightness-95"
          }`}
        >
          {isSaving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Speichert...</span>
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
  );
};
