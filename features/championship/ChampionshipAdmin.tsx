import React, { useState } from 'react';
import {
  Trophy,
  Plus,
  Settings,
  Users,
  Calendar,
  Trash2,
  RefreshCw,
  Layers,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  TournamentInstance,
  TournamentTemplate,
  Participant,
  Group,
} from '../../types/championship';
import {
  saveChampionshipTournament,
  softDeleteChampionshipTournament,
  restoreChampionshipTournament,
  saveChampionshipTemplate,
} from '../../services/championshipService';
import {
  generateGroupMatches,
  generateKnockoutMatches,
} from '../../utils/championshipCalculator';
import { ChampionshipPipelineBuilder } from './ChampionshipPipelineBuilder';
import { ChampionshipPlayerAssigner } from './ChampionshipPlayerAssigner';
import { ChampionshipTemplatesModal } from './ChampionshipTemplatesModal';
import { User } from '../../types';

interface ChampionshipAdminProps {
  tournaments: TournamentInstance[];
  templates: TournamentTemplate[];
  clubId: string;
  currentUser: User | null;
  users: Record<string, User>;
  onSelectTournament: (tournamentId: string) => void;
  activeTournamentId: string;
}

export const ChampionshipAdmin: React.FC<ChampionshipAdminProps> = ({
  tournaments,
  templates,
  clubId,
  currentUser,
  users,
  onSelectTournament,
  activeTournamentId,
}) => {
  const [adminTab, setAdminTab] = useState<'manage' | 'trash'>('manage');
  const [isAssignerOpen, setIsAssignerOpen] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tournament creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('Vereinsmeisterschaft 2026');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');

  const activeTournaments = tournaments.filter((t) => t.status !== 'trash');
  const trashTournaments = tournaments.filter((t) => t.status === 'trash');

  const currentTournament =
    activeTournaments.find((t) => t.id === activeTournamentId) || activeTournaments[0] || null;

  // Handle Create Tournament
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (!tpl) {
      setMessage({ type: 'error', text: 'Keine Vorlage ausgewählt.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // 1. Lock template to guarantee tamper protection
      if (!tpl.isLocked) {
        await saveChampionshipTemplate(clubId, {
          ...tpl,
          isLocked: true,
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Initialize default groups if template has group stage
      const groupStage = tpl.stages.find((s) => s.type === 'group');
      const groups: Group[] = [];
      if (groupStage) {
        const count = groupStage.groupCount || 2;
        for (let i = 0; i < count; i++) {
          const letter = String.fromCharCode(65 + i); // 'A', 'B', 'C'...
          groups.push({
            id: `grp_${letter.toLowerCase()}_${Date.now()}`,
            stageId: groupStage.id,
            name: `Gruppe ${letter}`,
            participantIds: [],
          });
        }
      }

      // 3. Create tournament instance
      const now = new Date().toISOString();
      const newInst: TournamentInstance = {
        id: `turnier_${Date.now()}`,
        tenantId: clubId,
        templateId: tpl.id,
        templateSnapshot: tpl,
        title: newTitle.trim() || 'Neue Meisterschaft',
        discipline: tpl.discipline,
        stages: tpl.stages,
        tieBreakRule: tpl.tieBreakRule,
        matchFormat: tpl.matchFormat,
        participants: [],
        groups,
        matches: [],
        stageDeadlines: {},
        status: 'draft',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await saveChampionshipTournament(clubId, newInst);
      onSelectTournament(newInst.id);
      setIsCreateOpen(false);
      setMessage({
        type: 'success',
        text: `Turnier "${newInst.title}" erfolgreich angelegt. Bitte weise nun Teilnehmer zu.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Fehler beim Erstellen des Turniers.' });
    } finally {
      setSaving(false);
    }
  };

  // Generate / Regenerate Matches
  const handleGenerateMatches = async () => {
    if (!currentTournament) return;
    if (currentTournament.participants.length < 2) {
      setMessage({
        type: 'error',
        text: 'Bitte weise zuerst mindestens 2 Teilnehmer zu.',
      });
      return;
    }

    if (
      currentTournament.matches.length > 0 &&
      !window.confirm(
        'Achtung: Beim Neugenerieren werden noch offene Spiele neu berechnet. Möchtest du fortfahren?'
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const groupStage = currentTournament.stages.find((s) => s.type === 'group');
      let groupMatches: any[] = [];
      if (groupStage && currentTournament.groups.length > 0) {
        groupMatches = generateGroupMatches(groupStage.id, currentTournament.groups);
      }

      const koMatches = generateKnockoutMatches(currentTournament.stages);
      const allMatches = [...groupMatches, ...koMatches];

      const updated = {
        ...currentTournament,
        matches: allMatches,
        status: 'active' as const,
        updatedAt: new Date().toISOString(),
      };

      await saveChampionshipTournament(clubId, updated);
      setMessage({
        type: 'success',
        text: `${allMatches.length} Begegnungen erfolgreich generiert! Turnier ist jetzt aktiv.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Fehler beim Generieren der Spiele.' });
    } finally {
      setSaving(false);
    }
  };

  // Soft Delete Tournament
  const handleSoftDelete = async (tournamentId: string, title: string) => {
    if (
      !window.confirm(
        `Möchtest du die Meisterschaft "${title}" in den Papierkorb verschieben? Sie kann 30 Tage lang wiederhergestellt werden.`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await softDeleteChampionshipTournament(clubId, tournamentId);
      setMessage({
        type: 'success',
        text: `Meisterschaft in den Papierkorb verschoben (30 Tage Wiederherstellungsfrist).`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Fehler beim Verschieben in den Papierkorb.' });
    } finally {
      setSaving(false);
    }
  };

  // Restore Tournament
  const handleRestore = async (tournamentId: string) => {
    setSaving(true);
    try {
      await restoreChampionshipTournament(clubId, tournamentId);
      setMessage({ type: 'success', text: 'Meisterschaft erfolgreich wiederhergestellt!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Fehler beim Wiederherstellen.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Player Assignments
  const handleSaveAssignments = async (
    updatedParticipants: Participant[],
    updatedGroups: Group[]
  ) => {
    if (!currentTournament) return;
    const updated: TournamentInstance = {
      ...currentTournament,
      participants: updatedParticipants,
      groups: updatedGroups,
      updatedAt: new Date().toISOString(),
    };
    await saveChampionshipTournament(clubId, updated);
    setMessage({
      type: 'success',
      text: `${updatedParticipants.length} Teilnehmer und Gruppenzuweisungen gespeichert.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-slate-100 text-[var(--color-primary)] rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Meisterschafts-Verwaltung & Einstellungen
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Pipeline konfigurieren, Auslosung generieren, Teilnehmer verwalten und Papierkorb einsehen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTemplatesOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Vorlagen ({templates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Turnier</span>
          </button>
        </div>
      </div>

      {/* Admin Subtabs: Manage vs Trash */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAdminTab('manage')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'manage'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Aktive Turniere ({activeTournaments.length})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('trash')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'trash'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Papierkorb ({trashTournaments.length})</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* TAB 1: MANAGE ACTIVE TOURNAMENT */}
      {adminTab === 'manage' && (
        <>
          {currentTournament ? (
            <div className="space-y-6">
              {/* Tournament Controls Card */}
              <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Ausgewähltes Turnier
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{currentTournament.title}</h2>
                    <span className="text-xs text-slate-500 font-medium">
                      Status:{' '}
                      <span className="font-bold text-[var(--color-primary)] uppercase">
                        {currentTournament.status}
                      </span>{' '}
                      · {currentTournament.participants.length} Teilnehmer ·{' '}
                      {currentTournament.matches.length} Spiele
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAssignerOpen(true)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span>Teilnehmer zuweisen</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateMatches}
                      disabled={saving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      <span>Spiele generieren / starten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSoftDelete(currentTournament.id, currentTournament.title)
                      }
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="In den Papierkorb verschieben"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pipeline Builder Integration */}
                <ChampionshipPipelineBuilder
                  stages={currentTournament.stages}
                  onChangeStages={async (newStages) => {
                    const updated = {
                      ...currentTournament,
                      stages: newStages,
                      updatedAt: new Date().toISOString(),
                    };
                    await saveChampionshipTournament(clubId, updated);
                  }}
                  tieBreakRule={currentTournament.tieBreakRule}
                  onChangeTieBreakRule={async (rule) => {
                    const updated = {
                      ...currentTournament,
                      tieBreakRule: rule,
                      updatedAt: new Date().toISOString(),
                    };
                    await saveChampionshipTournament(clubId, updated);
                  }}
                  matchFormat={currentTournament.matchFormat}
                  onChangeMatchFormat={async (fmt) => {
                    const updated = {
                      ...currentTournament,
                      matchFormat: fmt,
                      updatedAt: new Date().toISOString(),
                    };
                    await saveChampionshipTournament(clubId, updated);
                  }}
                  stageDeadlines={currentTournament.stageDeadlines || {}}
                  onChangeDeadline={async (stageId, dl) => {
                    const updated = {
                      ...currentTournament,
                      stageDeadlines: {
                        ...(currentTournament.stageDeadlines || {}),
                        [stageId]: dl,
                      },
                      updatedAt: new Date().toISOString(),
                    };
                    await saveChampionshipTournament(clubId, updated);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-3">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">Noch kein Turnier angelegt</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Erstelle eine neue Vereinsmeisterschaft basierend auf einer flexiblen Vorlage.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Jetzt Meisterschaft anlegen
              </button>
            </div>
          )}
        </>
      )}

      {/* TAB 2: TRASH (30-DAY RETENTION) */}
      {adminTab === 'trash' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Papierkorb-Schutz:</strong> Gelöschte Meisterschaften verbleiben hier 30 Tage lang und können jederzeit mit einem Klick vollständig samt aller Ergebnisse und Historien wiederhergestellt werden. Nach 30 Tagen werden sie automatisch bereinigt.
            </div>
          </div>

          {trashTournaments.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Der Papierkorb ist leer.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {trashTournaments.map((t) => {
                const deletedDate = t.deletedAt ? new Date(t.deletedAt) : new Date();
                const daysRemaining = Math.max(
                  0,
                  30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
                );

                return (
                  <div
                    key={t.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <strong className="text-slate-900 block font-bold">{t.title}</strong>
                      <span className="text-[11px] text-slate-400">
                        Gelöscht am {deletedDate.toLocaleDateString('de-DE')} · Verbleibend:{' '}
                        <span className="text-amber-700 font-bold">{daysRemaining} Tage</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(t.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Wiederherstellen</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Tournament */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Neue Vereinsmeisterschaft anlegen</h3>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Titel</label>
                <input
                  type="text"
                  required
                  value={newTitle || ''}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vorlage auswählen
                </label>
                <select
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-white"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} ({tpl.discipline === 'singles' ? 'Einzel' : 'Doppel'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Verwendete Vorlagen werden manipulationssicher verriegelt.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Erstelle...' : 'Turnier erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Player Assigner */}
      {currentTournament && (
        <ChampionshipPlayerAssigner
          isOpen={isAssignerOpen}
          onClose={() => setIsAssignerOpen(false)}
          tournament={currentTournament}
          users={users}
          onSaveAssignments={handleSaveAssignments}
        />
      )}

      {/* Modal: Templates Management */}
      <ChampionshipTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        templates={templates}
        clubId={clubId}
        onSelectTemplateToCreate={(tpl) => {
          setSelectedTemplateId(tpl.id);
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
};
