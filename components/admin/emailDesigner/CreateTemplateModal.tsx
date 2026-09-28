import React, { useState, useMemo } from "react";
import { X, Sparkles, Copy, Layers, AlertCircle } from "lucide-react";
import { NotificationEventKey, EmailTemplate } from "../../../types/notifications";
import { NOTIFICATION_EVENT_DEFINITIONS } from "../../../services/notificationTemplates";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, eventType: NotificationEventKey, baseTemplateId?: string) => void;
  existingTemplates: EmailTemplate[];
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  existingTemplates,
}) => {
  const [templateName, setTemplateName] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<NotificationEventKey>(
    "RESERVATION_CONFIRMED"
  );
  const [creationMode, setCreationMode] = useState<"default" | "duplicate">("default");
  const [selectedBaseTemplateId, setSelectedBaseTemplateId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Filter templates of the selected event type that could be cloned
  const candidateDuplicates = useMemo(() => {
    return existingTemplates.filter(
      (t) => t.eventType === selectedEventType && !t.deletedAt
    );
  }, [existingTemplates, selectedEventType]);

  // If candidate duplicates change, update selection
  React.useEffect(() => {
    if (candidateDuplicates.length > 0) {
      setSelectedBaseTemplateId(candidateDuplicates[0].id);
    } else {
      setSelectedBaseTemplateId("");
      if (creationMode === "duplicate") {
        setCreationMode("default");
      }
    }
  }, [candidateDuplicates, creationMode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = templateName.trim();
    if (!trimmed) {
      setError("Bitte gib einen Namen für die Vorlage an.");
      return;
    }

    onCreate(
      trimmed,
      selectedEventType,
      creationMode === "duplicate" && selectedBaseTemplateId ? selectedBaseTemplateId : undefined
    );
    // Reset state & close
    setTemplateName("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Neue Nachrichtenvorlage anlegen</h3>
              <p className="text-[11px] text-slate-600 font-medium">
                Erstelle ein neues E-Mail-Design für deine Bibliothek
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Name der Vorlage */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Name der Vorlage <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="z. B. Buchungsbestätigung 2026 (Modern)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors shadow-2xs"
            />
          </div>

          {/* Event-Typ Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Event-Typ <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                Nach Erstellung fest zugeordnet
              </span>
            </div>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as NotificationEventKey)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors shadow-2xs cursor-pointer"
            >
              {NOTIFICATION_EVENT_DEFINITIONS.map((def) => (
                <option key={def.key} value={def.key}>
                  {def.label} ({def.targetAudience})
                </option>
              ))}
            </select>
          </div>

          {/* Basis-Auswahl: Standard oder Duplizieren */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Inhaltlicher Startpunkt
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCreationMode("default")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  creationMode === "default"
                    ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950 font-bold"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Standard-Design</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 font-normal">
                  Startet mit den Standardbausteinen für dieses Event.
                </p>
              </button>

              <button
                type="button"
                disabled={candidateDuplicates.length === 0}
                onClick={() => setCreationMode("duplicate")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  candidateDuplicates.length === 0
                    ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : creationMode === "duplicate"
                    ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950 font-bold cursor-pointer"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Vorlage duplizieren</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 font-normal">
                  {candidateDuplicates.length > 0
                    ? `Kopiert ein bestehendes Design (${candidateDuplicates.length} verfügbar).`
                    : "Keine Vorlage dieses Typs vorhanden."}
                </p>
              </button>
            </div>

            {/* If Duplicate chosen, select which template */}
            {creationMode === "duplicate" && candidateDuplicates.length > 0 && (
              <div className="pt-2 animate-in fade-in duration-150">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Kopiervorlage auswählen:
                </label>
                <select
                  value={selectedBaseTemplateId}
                  onChange={(e) => setSelectedBaseTemplateId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
                >
                  {candidateDuplicates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Vorlage anlegen & bearbeiten</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
