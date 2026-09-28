import React, { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Inbox,
  Lock,
} from "lucide-react";
import { EmailTemplate, NotificationEventKey, EmailTemplateAssignments } from "../../../types/notifications";
import { NOTIFICATION_EVENT_DEFINITIONS } from "../../../services/notificationTemplates";
import { CreateTemplateModal } from "./CreateTemplateModal";

interface TemplateLibraryTableProps {
  templates: EmailTemplate[];
  assignments: EmailTemplateAssignments;
  activeEditingId: string | null;
  onSelectEdit: (templateId: string) => void;
  onCreateTemplate: (name: string, eventType: NotificationEventKey, baseTemplateId?: string) => void;
  onSoftDelete: (templateId: string) => void;
  onRestore: (templateId: string) => void;
  onPermanentDelete: (templateId: string) => void;
}

export const TemplateLibraryTable: React.FC<TemplateLibraryTableProps> = ({
  templates,
  assignments,
  activeEditingId,
  onSelectEdit,
  onCreateTemplate,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
}) => {
  const [showTrash, setShowTrash] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Grouped active vs. deleted templates
  const activeTemplates = useMemo(() => {
    return templates.filter((t) => !t.deletedAt);
  }, [templates]);

  const deletedTemplates = useMemo(() => {
    return templates.filter((t) => !!t.deletedAt);
  }, [templates]);

  // Event definitions lookup
  const eventDefMap = useMemo(() => {
    const map = new Map<string, (typeof NOTIFICATION_EVENT_DEFINITIONS)[0]>();
    NOTIFICATION_EVENT_DEFINITIONS.forEach((def) => map.set(def.key, def));
    return map;
  }, []);

  // Filtered list based on active view, search, and event type
  const displayedList = useMemo(() => {
    const base = showTrash ? deletedTemplates : activeTemplates;
    return base.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesEvent =
        filterEventType === "all" || t.eventType === filterEventType;
      return matchesSearch && matchesEvent;
    });
  }, [showTrash, deletedTemplates, activeTemplates, searchTerm, filterEventType]);

  // Handle soft delete with active check
  const handleAttemptDelete = (template: EmailTemplate) => {
    // Check if actively assigned to an event
    if (assignments[template.eventType] === template.id) {
      setDeleteWarning(
        `Die Vorlage „${template.name}“ ist dem Event „${eventDefMap.get(template.eventType)?.label || template.eventType}“ aktuell aktiv zugewiesen. Bitte weise im Reiter „E-Mail-Einstellungen“ zuerst eine andere Vorlage zu, bevor du diese löschst.`
      );
      setTimeout(() => setDeleteWarning(null), 6000);
      return;
    }

    onSoftDelete(template.id);
  };

  // Remaining days in trash helper
  const getRemainingDays = (deletedAt?: string | null) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    if (isNaN(deletedTime)) return 30;
    const daysPassed = Math.floor((Date.now() - deletedTime) / (24 * 60 * 60 * 1000));
    return Math.max(0, 30 - daysPassed);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden space-y-0">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title and View Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Vorlagen-Bibliothek
              </h2>
              <p className="text-[11px] text-slate-600 font-medium">
                {activeTemplates.length} aktive {activeTemplates.length === 1 ? "Vorlage" : "Vorlagen"} im Verein hinterlegt
              </p>
            </div>
          </div>

          {/* Toggle between Active & Trash */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-bold ml-0 sm:ml-4">
            <button
              type="button"
              onClick={() => setShowTrash(false)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                !showTrash
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Aktive Vorlagen ({activeTemplates.length})
            </button>
            <button
              type="button"
              onClick={() => setShowTrash(true)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                showTrash
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Papierkorb ({deletedTemplates.length})</span>
            </button>
          </div>
        </div>

        {/* Action Button: Neue Vorlage anlegen */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Neue Vorlage anlegen</span>
          </button>
        </div>
      </div>

      {/* Delete Restriction Warning Banner */}
      {deleteWarning && (
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3 animate-in fade-in duration-150">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 font-semibold leading-relaxed">
            {deleteWarning}
          </div>
          <button
            type="button"
            onClick={() => setDeleteWarning(null)}
            className="ml-auto text-amber-800 hover:text-amber-950 text-xs font-bold underline cursor-pointer"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Vorlage suchen..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
          />
        </div>

        {/* Filter Event Type */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
          >
            <option value="all">Alle Event-Typen</option>
            {NOTIFICATION_EVENT_DEFINITIONS.map((def) => (
              <option key={def.key} value={def.key}>
                {def.label}
              </option>
            ))}
          </select>
        </div>

        {showTrash && (
          <div className="ml-auto text-[11px] text-slate-600 font-medium flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Papierkorb-Objekte werden nach 30 Tagen automatisch bereinigt</span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200">
              <th className="py-3 px-4 sm:px-5">Name der Vorlage</th>
              <th className="py-3 px-4">Event-Typ</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {displayedList.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-600">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-8 h-8 text-slate-400" />
                    <p className="font-bold text-slate-800">
                      {showTrash
                        ? "Der Papierkorb ist leer."
                        : "Keine Vorlagen gefunden."}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {showTrash
                        ? "Gelöschte Vorlagen werden hier 30 Tage aufbewahrt."
                        : "Lege mit „Neue Vorlage anlegen“ ein neues Design an."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedList.map((tmpl) => {
                const isActiveAssigned = assignments[tmpl.eventType] === tmpl.id && !tmpl.deletedAt;
                const isCurrentlyEditing = activeEditingId === tmpl.id;
                const eventDef = eventDefMap.get(tmpl.eventType);

                return (
                  <tr
                    key={tmpl.id}
                    className={`transition-colors ${
                      isCurrentlyEditing
                        ? "bg-emerald-50/70 border-l-4 border-l-emerald-600"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* 1. Name & Betreff Preview */}
                    <td className="py-3.5 px-4 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActiveAssigned
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{tmpl.name}</span>
                            {isCurrentlyEditing && (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Im Editor geöffnet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Event-Typ */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {eventDef?.label || tmpl.eventType}
                      </span>
                    </td>

                    {/* 3. Status */}
                    <td className="py-3.5 px-4">
                      {tmpl.deletedAt ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-200">
                            <Trash2 className="w-3 h-3" />
                            <span>Im Papierkorb</span>
                          </span>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Noch {getRemainingDays(tmpl.deletedAt)} Tage
                          </div>
                        </div>
                      ) : isActiveAssigned ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Aktiv zugewiesen</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Bereit
                        </span>
                      )}
                    </td>

                    {/* 4. Aktionen */}
                    <td className="py-3.5 px-4 text-right">
                      {tmpl.deletedAt ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onRestore(tmpl.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Vorlage wiederherstellen"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Wiederherstellen</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onPermanentDelete(tmpl.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Endgültig löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Endgültig löschen</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectEdit(tmpl.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              isCurrentlyEditing
                                ? "bg-emerald-700 text-white font-extrabold"
                                : "bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400"
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isCurrentlyEditing ? "Wird bearbeitet" : "Bearbeiten"}</span>
                          </button>

                          {isActiveAssigned ? (
                            <button
                              type="button"
                              onClick={() => handleAttemptDelete(tmpl)}
                              title="Aktive Vorlage kann nicht gelöscht werden"
                              className="p-2 rounded-xl text-slate-400 bg-slate-100 hover:bg-slate-200/80 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAttemptDelete(tmpl)}
                              title="In den Papierkorb verschieben"
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal to create a new template */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={onCreateTemplate}
        existingTemplates={activeTemplates}
      />
    </div>
  );
};
