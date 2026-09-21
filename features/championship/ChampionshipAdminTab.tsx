import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Layers,
  Plus,
  Play,
  Archive,
  Trash2,
  RotateCcw,
  ExternalLink,
  Lock,
  Copy,
  Edit2,
  Calendar,
  Users,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  FileText,
  Eye,
} from 'lucide-react';
import {
  TournamentTemplate,
  TournamentInstance,
  TournamentStatus,
} from '../../types/championship';
import { User } from '../../types';
import {
  listenToChampionshipTemplates,
  listenToChampionshipTournaments,
  deleteChampionshipTemplate,
  saveChampionshipTemplate,
  softDeleteChampionshipTournament,
  restoreChampionshipTournament,
  archiveChampionshipTournament,
  activateChampionshipTournament,
  purgeExpiredTrashTournaments,
  championshipService,
} from '../../services/championshipService';
import { ChampionshipTemplateEditor } from './ChampionshipTemplateEditor';
import { ChampionshipTournamentStartWizard } from './ChampionshipTournamentStartWizard';

interface ChampionshipAdminTabProps {
  clubId: string;
  users: Record<string, User>;
  currentUser?: User | null;
  onNavigateToPlayerView?: (tournamentId?: string) => void;
}

export const ChampionshipAdminTab: React.FC<ChampionshipAdminTabProps> = ({
  clubId,
  users,
  currentUser,
  onNavigateToPlayerView,
}) => {
  const [subTab, setSubTab] = useState<'tournaments' | 'templates'>('tournaments');

  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter for Tournaments Sub-Tab
  const [statusFilter, setStatusFilter] = useState<'all' | TournamentStatus>('all');

  // Template Editor State (In-Page)
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [templateToEdit, setTemplateToEdit] = useState<TournamentTemplate | null>(null);

  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [wizardTemplateId, setWizardTemplateId] = useState<string | undefined>(undefined);

  const [actionFeedback, setActionFeedback] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Deletion confirmation state
  const [templateToDelete, setTemplateToDelete] = useState<TournamentTemplate | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState<boolean>(false);

  // Tournament trash confirmation state
  const [tournamentToTrash, setTournamentToTrash] = useState<TournamentInstance | null>(null);
  const [isTrashingTournament, setIsTrashingTournament] = useState<boolean>(false);

  // Subscribe to real-time templates and tournaments
  useEffect(() => {
    setLoading(true);
    const unsubTemplates = listenToChampionshipTemplates(clubId, (tpls) => {
      setTemplates(tpls);
    });

    const unsubTournaments = listenToChampionshipTournaments(clubId, (tourns) => {
      setTournaments(tourns);
      setLoading(false);
      // Auto-purge trash older than 30 days
      purgeExpiredTrashTournaments(clubId, tourns);
    });

    return () => {
      unsubTemplates();
      unsubTournaments();
    };
  }, [clubId]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setActionFeedback({ text, type });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  // Helper: check if a template is used in any active/archived tournament
  const isTemplateLocked = (template: TournamentTemplate): boolean => {
    if (template.isLocked) return true;
    return tournaments.some(
      (t) => t.templateId === template.id && t.status !== 'trash'
    );
  };

  // Handlers for Templates
  const handleOpenNewTemplate = () => {
    setTemplateToEdit(null);
    setIsEditingTemplate(true);
  };

  const handleEditTemplate = (tpl: TournamentTemplate) => {
    setTemplateToEdit(tpl);
    setIsEditingTemplate(true);
  };

  const handleDuplicateTemplate = async (tpl: TournamentTemplate) => {
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
      showFeedback(`Vorlage "${duplicated.title}" erfolgreich erstellt.`);
    } catch (e: any) {
      showFeedback(e?.message || 'Kopieren fehlgeschlagen.', 'error');
    }
  };

  const handleDeleteTemplate = (tpl: TournamentTemplate) => {
    if (isTemplateLocked(tpl)) {
      showFeedback('Gesperrte Vorlagen in aktiver Verwendung können nicht gelöscht werden.', 'error');
      return;
    }
    setTemplateToDelete(tpl);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const tpl = templateToDelete;
    setIsDeletingTemplate(true);

    try {
      // Sofort reaktiv die Liste im UI aktualisieren (ohne Seiten-Reload)
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));

      // Löschen über championshipService
      await championshipService.deleteTemplate(clubId, tpl.id);

      showFeedback('Vorlage gelöscht.');
      setTemplateToDelete(null);
    } catch (e: any) {
      showFeedback(e?.message || 'Fehler beim Löschen.', 'error');
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const handleStartTournamentWithTemplate = (tpl: TournamentTemplate) => {
    setWizardTemplateId(tpl.id);
    setIsWizardOpen(true);
  };

  // Handlers for Tournaments
  const handleArchiveTournament = async (t: TournamentInstance) => {
    try {
      await archiveChampionshipTournament(clubId, t.id);
      showFeedback(`Meisterschaft "${t.title}" wurde archiviert.`);
    } catch (e: any) {
      showFeedback(e?.message || 'Archivieren fehlgeschlagen.', 'error');
    }
  };

  const handleActivateTournament = async (t: TournamentInstance) => {
    try {
      await activateChampionshipTournament(clubId, t.id);
      showFeedback(`Meisterschaft "${t.title}" wurde aktiviert.`);
    } catch (e: any) {
      showFeedback(e?.message || 'Aktivieren fehlgeschlagen.', 'error');
    }
  };

  const handleTrashTournament = (t: TournamentInstance) => {
    setTournamentToTrash(t);
  };

  const handleConfirmTrashTournament = async () => {
    if (!tournamentToTrash) return;
    const t = tournamentToTrash;
    setIsTrashingTournament(true);

    try {
      // Optimistic UI update: immediately move to trash in local state
      setTournaments((prev) =>
        prev.map((item) =>
          item.id === t.id
            ? {
                ...item,
                status: 'trash' as TournamentStatus,
                deletedAt: new Date().toISOString(),
              }
            : item
        )
      );

      await softDeleteChampionshipTournament(clubId, t.id);
      showFeedback(`"${t.title}" in den Papierkorb verschoben.`);
      setTournamentToTrash(null);
    } catch (e: any) {
      showFeedback(e?.message || 'Verschieben fehlgeschlagen.', 'error');
    } finally {
      setIsTrashingTournament(false);
    }
  };

  const handleRestoreTournament = async (t: TournamentInstance) => {
    try {
      await restoreChampionshipTournament(clubId, t.id);
      showFeedback(`"${t.title}" wurde erfolgreich wiederhergestellt.`);
    } catch (e: any) {
      showFeedback(e?.message || 'Wiederherstellen fehlgeschlagen.', 'error');
    }
  };

  // Filtered Tournaments
  const filteredTournaments = useMemo(() => {
    if (statusFilter === 'all') {
      return tournaments.filter((t) => t.status !== 'trash');
    }
    return tournaments.filter((t) => t.status === statusFilter);
  }, [tournaments, statusFilter]);

  // Counts for Badges
  const counts = useMemo(() => {
    const active = tournaments.filter((t) => t.status === 'active').length;
    const draft = tournaments.filter((t) => t.status === 'draft').length;
    const archived = tournaments.filter((t) => t.status === 'archived').length;
    const trash = tournaments.filter((t) => t.status === 'trash').length;
    const totalNonTrash = tournaments.filter((t) => t.status !== 'trash').length;
    return { active, draft, archived, trash, totalNonTrash };
  }, [tournaments]);

  // In-Page Template Editor View
  if (subTab === 'templates' && isEditingTemplate) {
    return (
      <div className="w-full">
        <ChampionshipTemplateEditor
          clubId={clubId}
          templateToEdit={templateToEdit}
          onBack={() => {
            setIsEditingTemplate(false);
            setTemplateToEdit(null);
          }}
          onSaved={(saved) => {
            showFeedback(`Vorlage "${saved.title}" erfolgreich gespeichert.`);
            setIsEditingTemplate(false);
            setTemplateToEdit(null);
          }}
        />
      </div>
    );
  }

  // In-Page Tournament Start Wizard View (integrated directly into the page instead of popup)
  if (isWizardOpen) {
    return (
      <div className="w-full">
        <ChampionshipTournamentStartWizard
          isOpen={true}
          inline={true}
          onClose={() => {
            setIsWizardOpen(false);
            setWizardTemplateId(undefined);
          }}
          clubId={clubId}
          templates={templates}
          users={users}
          initialSelectedTemplateId={wizardTemplateId}
          onTournamentCreated={(tourn) => {
            showFeedback(`Meisterschaft "${tourn.title}" erfolgreich gestartet!`);
            setIsWizardOpen(false);
            setWizardTemplateId(undefined);
            setSubTab('tournaments');
            setStatusFilter('active');
          }}
          onCreateNewTemplate={() => {
            setIsWizardOpen(false);
            setWizardTemplateId(undefined);
            handleOpenNewTemplate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-[var(--color-primary)]">
              <Trophy className="w-5 h-5 shrink-0" />
              <span>Meisterschafts-Verwaltung</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Konfiguriere Vorlagen und steuere laufende, archivierte sowie geplante Clubmeisterschaften.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('tournaments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'tournaments'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Laufende & Archivierte Turniere</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                subTab === 'tournaments'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.totalNonTrash}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('templates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'templates'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Turnier-Vorlagen</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                subTab === 'templates'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {templates.length}
            </span>
          </button>
        </div>
      </div>

      {/* Action Toast / Feedback */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* SUB-TAB A: TURNIER-VORLAGEN */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Gespeicherte Turnier-Vorlagen</h3>
              <p className="text-xs text-slate-500">
                Wiederverwendbare Regel-Sets für Sommer- und Wintermeisterschaften.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewTemplate}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Vorlage</span>
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">Keine Vorlagen vorhanden</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Erstelle eine erste Vorlage, um das Regelwerk (Satz-Format, Gruppenphase, K.-o.-Baum)
                festzulegen.
              </p>
              <button
                type="button"
                onClick={handleOpenNewTemplate}
                className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + Erste Vorlage erstellen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((tpl) => {
                const locked = isTemplateLocked(tpl);
                const groupStage = tpl.stages?.find((s) => s.type === 'group');
                const koStages = tpl.stages?.filter((s) => s.type === 'knockout') || [];

                return (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Header with Title & Lock Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{tpl.title}</h4>
                        {locked ? (
                          <span
                            title="Vorlage ist in Meisterschaften aktiv und schreibgeschützt"
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 shrink-0"
                          >
                            <Lock className="w-3 h-3 text-amber-700" />
                            <span>Gesperrt</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 shrink-0">
                            <span>Bearbeitbar</span>
                          </span>
                        )}
                      </div>

                      {/* Meta badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {tpl.discipline === 'doubles' ? 'Doppel (2 vs. 2)' : 'Einzel (1 vs. 1)'}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {tpl.tieBreakRule === 'head_to_head'
                            ? 'Direkter Vergleich'
                            : 'Satzdifferenz'}
                        </span>
                      </div>

                      {/* Pipeline summary */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-[11px] text-slate-600">
                        <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
                          Phasen-Pipeline:
                        </div>
                        <div className="space-y-1">
                          {groupStage && (
                            <div className="flex items-center gap-1.5 text-blue-800 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              <span>
                                {groupStage.name} ({groupStage.groupCount || 2} Gruppen mit je{' '}
                                {groupStage.playersPerGroup || 4} Spielern, Top{' '}
                                {groupStage.advancingPerGroup || 2} weiter)
                              </span>
                            </div>
                          )}
                          {koStages.map((ks, kIdx) => (
                            <div
                              key={ks.id || kIdx}
                              className="flex items-center gap-1.5 text-purple-800 font-semibold"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                              <span>
                                {ks.name} ({ks.bracketSize || 4}er Feld)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(tpl)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Vorlage ansehen"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(tpl)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Vorlage bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDuplicateTemplate(tpl)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Als neue Vorlage duplizieren"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {!locked && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Vorlage löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartTournamentWithTemplate(tpl)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Starten</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB B: LAUFENDE & ARCHIVIERTE TURNIERE */}
      {subTab === 'tournaments' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Alle ({counts.totalNonTrash})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Aktiv ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'archived'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Archiviert ({counts.archived})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('trash')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'trash'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Papierkorb ({counts.trash})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setWizardTemplateId(undefined);
                setIsWizardOpen(true);
              }}
              className="px-3 py-1.5 bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Meisterschaft</span>
            </button>
          </div>

          {/* Tournament Cards List */}
          {filteredTournaments.length === 0 ? (
            <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                Keine Meisterschaften in dieser Ansicht
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Starte eine Meisterschaft über den Button „Neue Meisterschaft“ oder wähle einen anderen Statusfilter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredTournaments.map((tourn) => {
                const matchCount = tourn.matches?.length || 0;
                const completedMatches =
                  tourn.matches?.filter((m) => m.status === 'completed' || m.status === 'walkover')
                    .length || 0;
                const progress =
                  matchCount > 0 ? Math.round((completedMatches / matchCount) * 100) : 0;

                return (
                  <div
                    key={tourn.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Top status & Discipline */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          {tourn.status !== 'trash' && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full mb-1.5 ${
                                tourn.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  : tourn.status === 'archived'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  tourn.status === 'active'
                                    ? 'bg-emerald-600'
                                    : tourn.status === 'archived'
                                    ? 'bg-slate-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                              <span>
                                {tourn.status === 'active'
                                  ? 'Aktiv'
                                  : tourn.status === 'archived'
                                  ? 'Archiviert'
                                  : 'Entwurf'}
                              </span>
                            </span>
                          )}

                          <h4 className="font-bold text-base text-slate-900 leading-snug">
                            {tourn.title}
                          </h4>
                        </div>

                        {onNavigateToPlayerView && tourn.status !== 'trash' && (
                          <button
                            type="button"
                            onClick={() => onNavigateToPlayerView(tourn.id)}
                            className="p-2 text-slate-500 hover:text-[var(--color-primary)] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="Zur Meisterschafts-Ansicht"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Meta Pills */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {tourn.discipline === 'doubles' ? 'Doppel' : 'Einzel'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {tourn.participants?.length || 0} Teilnehmer
                        </span>
                        {tourn.groups && tourn.groups.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                            {tourn.groups.length} Gruppen
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between text-[11px]">
                          <span>Matches gespielt:</span>
                          <span className="font-bold text-slate-800">
                            {completedMatches} von {matchCount} ({progress}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Trash notice if in trash */}
                      {tourn.status === 'trash' && tourn.deletedAt && (
                        <div className="mt-2.5 p-2 bg-rose-50 text-rose-800 text-[11px] rounded-lg border border-rose-200">
                          Wurde gelöscht am{' '}
                          {new Date(tourn.deletedAt).toLocaleDateString('de-DE')}. Wird nach 30 Tagen
                          automatisch endgültig entfernt.
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {tourn.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleArchiveTournament(tourn)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Meisterschaft archivieren"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archivieren</span>
                          </button>
                        )}

                        {tourn.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleActivateTournament(tourn)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Wieder auf aktiv setzen"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Wieder aktivieren</span>
                          </button>
                        )}

                        {tourn.status === 'trash' && (
                          <button
                            type="button"
                            onClick={() => handleRestoreTournament(tourn)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Wiederherstellen</span>
                          </button>
                        )}
                      </div>

                      {tourn.status !== 'trash' && (
                        <button
                          type="button"
                          onClick={() => handleTrashTournament(tourn)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="In den Papierkorb verschieben (30 Tage Frist)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bestätigungsdialog: Vorlage löschen */}
      {templateToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isDeletingTemplate && setTemplateToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-black text-slate-900">
                  Vorlage löschen
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Vorlage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                {templateToDelete.title && (
                  <div className="mt-1 text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                    {templateToDelete.title}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                disabled={isDeletingTemplate}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTemplate}
                disabled={isDeletingTemplate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingTemplate ? 'Löschen...' : 'Löschen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bestätigungsdialog: Meisterschaft in den Papierkorb verschieben */}
      {tournamentToTrash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isTrashingTournament && setTournamentToTrash(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0 border border-amber-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-black text-slate-900">
                  In den Papierkorb verschieben
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Möchtest du die Meisterschaft <strong>"{tournamentToTrash.title}"</strong> in den Papierkorb verschieben?
                </p>
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 font-medium space-y-1">
                  <div>ℹ️ Im Papierkorb bleibt die Meisterschaft <strong>30 Tage lang</strong> erhalten und kann jederzeit wiederhergestellt werden.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTournamentToTrash(null)}
                disabled={isTrashingTournament}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmTrashTournament}
                disabled={isTrashingTournament}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isTrashingTournament ? 'Verschieben...' : 'In den Papierkorb'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
