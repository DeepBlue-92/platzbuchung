import React, { useState } from 'react';
import { X, Lock, Copy, Plus, Trash2, Check, Shield } from 'lucide-react';
import { TournamentTemplate } from '../../types/championship';
import { saveChampionshipTemplate, championshipService } from '../../services/championshipService';

interface ChampionshipTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TournamentTemplate[];
  clubId: string;
  onSelectTemplateToCreate?: (template: TournamentTemplate) => void;
}

export const ChampionshipTemplatesModal: React.FC<ChampionshipTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  clubId,
  onSelectTemplateToCreate,
}) => {
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<TournamentTemplate | null>(null);

  if (!isOpen) return null;

  const handleDuplicate = async (tpl: TournamentTemplate) => {
    setSaving(true);
    try {
      const duplicated: TournamentTemplate = {
        ...tpl,
        id: `tpl_${Date.now()}`,
        title: `${tpl.title} (Kopie)`,
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveChampionshipTemplate(clubId, duplicated);
      setMessage(`Vorlage "${duplicated.title}" erfolgreich erstellt.`);
    } catch (e: any) {
      setMessage(`Fehler: ${e?.message || 'Kopieren fehlgeschlagen'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tpl: TournamentTemplate) => {
    if (tpl.isLocked) {
      setMessage('Gesperrte Vorlagen können nicht gelöscht werden, da sie in Turnieren genutzt werden.');
      return;
    }
    setTemplateToDelete(tpl);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    const tpl = templateToDelete;
    setSaving(true);
    try {
      await championshipService.deleteTemplate(clubId, tpl.id);
      setMessage(`Vorlage gelöscht.`);
      setTemplateToDelete(null);
    } catch (e: any) {
      setMessage(`Fehler beim Löschen: ${e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl xl:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Turnier-Vorlagen (Templates)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Vorlagen definieren den Spielmodus, Stufen und Regeln. Verwendete Vorlagen sind manipulationssicher gesperrt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold">
            {message}
          </div>
        )}

        {/* List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{tpl.title}</h4>
                  {tpl.isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                      <Lock className="w-3 h-3" />
                      Gesperrt (in Verwendung)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Entwurf
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  {tpl.discipline === 'singles' ? 'Einzel' : 'Doppel'} ·{' '}
                  {tpl.stages.length} Phasen ({tpl.stages.map((s) => s.name).join(' ➔ ')}) ·{' '}
                  {tpl.tieBreakRule === 'head_to_head' ? 'Direkter Vergleich' : 'Satzdifferenz'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onSelectTemplateToCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTemplateToCreate(tpl);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Turnier starten</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDuplicate(tpl)}
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="Duplizieren, um Anpassungen vorzunehmen"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopieren</span>
                </button>

                {!tpl.isLocked && (
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl)}
                    disabled={saving}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Vorlage löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {templateToDelete && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => !saving && setTemplateToDelete(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 space-y-4 animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1.5">
                <h4 className="text-sm font-black text-slate-900">Vorlage löschen</h4>
                <p className="text-xs text-slate-600">
                  Vorlage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 truncate">
                  {templateToDelete.title}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTemplateToDelete(null)}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={saving}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Löschen...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
