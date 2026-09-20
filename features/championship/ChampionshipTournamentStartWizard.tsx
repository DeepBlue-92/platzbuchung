import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Calendar,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Plus,
  Shuffle,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Search,
  UserCheck,
  UserPlus,
  Trash2,
  Info,
  Flag,
} from 'lucide-react';
import {
  TournamentTemplate,
  TournamentInstance,
  Participant,
  Group,
  Match,
} from '../../types/championship';
import { User } from '../../types';
import {
  saveChampionshipTournament,
  saveChampionshipTemplate,
} from '../../services/championshipService';
import {
  generateGroupMatches,
  generateKnockoutMatches,
} from '../../utils/championshipCalculator';

interface ChampionshipTournamentStartWizardProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  templates: TournamentTemplate[];
  users: Record<string, User>;
  onTournamentCreated?: (created: TournamentInstance) => void;
  initialSelectedTemplateId?: string;
  onCreateNewTemplate?: () => void;
  inline?: boolean;
}

export const ChampionshipTournamentStartWizard: React.FC<ChampionshipTournamentStartWizardProps> = ({
  isOpen,
  onClose,
  clubId,
  templates,
  users,
  onTournamentCreated,
  initialSelectedTemplateId,
  onCreateNewTemplate,
  inline = true,
}) => {
  const [step, setStep] = useState<number>(1); // 1: Vorlage, 2: Zeitraum/Deadlines, 3: Teilnehmer/Gruppen

  // Step 1: Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialSelectedTemplateId || templates[0]?.id || ''
  );

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Step 2: Settings
  const [tournamentTitle, setTournamentTitle] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split('T')[0];
  });
  const [stageDeadlines, setStageDeadlines] = useState<Record<string, string>>({});

  // Step 3: Participants & Groups
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize title & deadlines when template changes
  React.useEffect(() => {
    if (selectedTemplate) {
      const year = new Date().getFullYear();
      setTournamentTitle(
        `Clubmeisterschaft ${year} - ${selectedTemplate.discipline === 'doubles' ? 'Doppel' : 'Einzel'}`
      );

      // Default deadlines for each stage in this tournament instance (dynamically calculated for this season)
      const deadlines: Record<string, string> = {};
      const stages = selectedTemplate.stages || [];
      stages.forEach((st, idx) => {
        const d = new Date();
        if (st.type === 'finals_day' || st.isFinalsDay) {
          // Finals day default: 2-3 months out
          d.setDate(d.getDate() + Math.max(stages.length * 21, 60));
          deadlines[st.id] = d.toISOString().split('T')[0];
        } else {
          d.setDate(d.getDate() + (idx + 1) * 21); // 3 weeks per stage
          deadlines[st.id] = d.toISOString().split('T')[0];
        }
      });
      setStageDeadlines(deadlines);

      // Initialize default groups from template config
      const groupStage = stages.find((s) => s.type === 'group');
      if (groupStage) {
        const count = groupStage.groupCount || 2;
        const letterArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const initialGroups: Group[] = [];
        for (let i = 0; i < count; i++) {
          initialGroups.push({
            id: `grp_${groupStage.id}_${i + 1}`,
            stageId: groupStage.id,
            name: `Gruppe ${letterArray[i] || i + 1}`,
            participantIds: [],
          });
        }
        setGroups(initialGroups);
      } else {
        setGroups([]);
      }
    }
  }, [selectedTemplate]);

  if (!isOpen) return null;

  const allUsersList = Object.values(users) as User[];
  const filteredUsers = allUsersList.filter((u) => {
    const q = searchMemberQuery.toLowerCase();
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const firstMatch = (u.firstName || '').toLowerCase().includes(q);
    const lastMatch = (u.lastName || '').toLowerCase().includes(q);
    return nameMatch || firstMatch || lastMatch;
  });

  const isUserSelected = (userId: string): boolean => {
    return participants.some((p) => p.playerIds.includes(userId));
  };

  const handleAddMember = (user: User) => {
    if (isUserSelected(user.id)) return;

    const firstGroup = groups[0]?.id || null;
    const newParticipantId = `part_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const displayName =
      user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name;

    const newPart: Participant = {
      id: newParticipantId,
      playerIds: [user.id],
      displayNames: [displayName],
      groupAssignment: firstGroup,
      withdrawn: false,
    };

    setParticipants((prev) => [...prev, newPart]);

    if (firstGroup) {
      setGroups((prevGroups) =>
        prevGroups.map((g) =>
          g.id === firstGroup
            ? { ...g, participantIds: [...g.participantIds, newParticipantId] }
            : g
        )
      );
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    setGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        participantIds: g.participantIds.filter((id) => id !== participantId),
      }))
    );
  };

  const handleChangeParticipantGroup = (participantId: string, newGroupId: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === participantId ? { ...p, groupAssignment: newGroupId || null } : p))
    );
    setGroups((prevGroups) =>
      prevGroups.map((g) => {
        const without = g.participantIds.filter((id) => id !== participantId);
        if (g.id === newGroupId) {
          return { ...g, participantIds: [...without, participantId] };
        }
        return { ...g, participantIds: without };
      })
    );
  };

  // Randomize / shuffle draw
  const handleRandomDraw = () => {
    if (groups.length === 0 || participants.length === 0) return;

    // Fisher-Yates shuffle
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const newGroups = groups.map((g) => ({ ...g, participantIds: [] as string[] }));
    const updatedParticipants = [...participants];

    shuffled.forEach((p, idx) => {
      const targetGroup = newGroups[idx % newGroups.length];
      targetGroup.participantIds.push(p.id);

      const pIndex = updatedParticipants.findIndex((item) => item.id === p.id);
      if (pIndex !== -1) {
        updatedParticipants[pIndex] = {
          ...updatedParticipants[pIndex],
          groupAssignment: targetGroup.id,
        };
      }
    });

    setGroups(newGroups);
    setParticipants(updatedParticipants);
  };

  const handleFinishWizard = async () => {
    if (!selectedTemplate) {
      setError('Bitte wähle eine gültige Vorlage aus.');
      return;
    }
    const trimmedTitle = tournamentTitle.trim();
    if (!trimmedTitle) {
      setError('Bitte gib einen Titel für die Meisterschaft an.');
      return;
    }
    if (participants.length < 2) {
      setError('Eine Meisterschaft benötigt mindestens 2 zugewiesene Teilnehmer.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const tournamentId = `tourn_${Date.now()}`;
      const groupStage = selectedTemplate.stages.find((s) => s.type === 'group');

      let generatedMatches: Match[] = [];

      // Generate group matches
      if (groupStage && groups.length > 0) {
        generatedMatches = [
          ...generatedMatches,
          ...generateGroupMatches(groupStage.id, groups),
        ];
      }

      // Generate knockout & finals day placeholder matches
      const koOrFinalsStages = selectedTemplate.stages.filter(
        (s) => s.type === 'knockout' || s.type === 'finals_day' || s.isFinalsDay
      );
      if (koOrFinalsStages.length > 0) {
        generatedMatches = [
          ...generatedMatches,
          ...generateKnockoutMatches(selectedTemplate.stages),
        ];
      }

      // Configure stages specifically for this tournament instance with deadlines
      const instanceStages = selectedTemplate.stages.map((st) => {
        const isFinals = st.type === 'finals_day' || !!st.isFinalsDay;
        const dl = stageDeadlines[st.id] || '';
        return {
          ...st,
          deadlineDate: !isFinals ? dl || undefined : undefined,
          eventDate: isFinals ? dl || undefined : undefined,
        };
      });

      // Populate matches with stage deadlines
      const instanceMatches = generatedMatches.map((m) => {
        const st = selectedTemplate.stages.find((s) => s.id === m.stageId);
        const isFinals = st?.type === 'finals_day' || !!st?.isFinalsDay;
        const dl = stageDeadlines[m.stageId];
        return {
          ...m,
          deadlineDate: !isFinals ? dl || undefined : undefined,
          scheduledDate: isFinals ? dl || m.scheduledDate : m.scheduledDate,
        };
      });

      const newTournament: TournamentInstance = {
        id: tournamentId,
        tenantId: clubId,
        templateId: selectedTemplate.id,
        templateSnapshot: {
          ...selectedTemplate,
          stages: selectedTemplate.stages.map((s) => ({
            ...s,
            deadlineDate: undefined,
            eventDate: undefined,
          })),
        },
        title: trimmedTitle,
        discipline: selectedTemplate.discipline,
        stages: instanceStages,
        tieBreakRule: selectedTemplate.tieBreakRule,
        matchFormat: selectedTemplate.matchFormat,
        participants,
        groups,
        matches: instanceMatches,
        stageDeadlines,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveChampionshipTournament(clubId, newTournament);

      // Lock template to protect structural blueprint, ensuring clean stage definitions without dates
      if (!selectedTemplate.isLocked) {
        await saveChampionshipTemplate(clubId, {
          ...selectedTemplate,
          stages: selectedTemplate.stages.map((s) => ({
            ...s,
            deadlineDate: undefined,
            eventDate: undefined,
          })),
          isLocked: true,
          updatedAt: new Date().toISOString(),
        });
      }

      if (onTournamentCreated) onTournamentCreated(newTournament);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Starten der Meisterschaft.');
    } finally {
      setSaving(false);
    }
  };

  const renderStepTwo = () => (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
          2. Titel & Fristen (Deadlines)
        </h4>
        <p className="text-xs text-slate-600">
          Lege den Meisterschaftszeitraum sowie die Spielfristen für jede Phase fest.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1.5">
          Titel der Meisterschaft <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={tournamentTitle || ''}
          onChange={(e) => setTournamentTitle(e.target.value)}
          placeholder="z. B. Vereinsmeisterschaft Sommer 2026 Einzel"
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">Startdatum</label>
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">Final-Wochenende / Ende</label>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Phase Deadlines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800">
            Saison-Fristen & Finaltag (Meisterschaftsebene)
          </label>
          <span className="text-[11px] text-slate-500 font-medium">
            Gilt für diese Meisterschaft
          </span>
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <span>
            Die Fristen („Zu spielen bis“) und das Datum des Finaltags werden im Meisterschafts-Objekt gespeichert. Die Vorlage bleibt dadurch neutral und jedes Jahr wiederverwendbar.
          </span>
        </div>

        <div className="space-y-2">
          {selectedTemplate?.stages?.map((stage, idx) => {
            const isFinals = stage.type === 'finals_day' || !!stage.isFinalsDay;
            return (
              <div
                key={stage.id}
                className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs ${
                  isFinals
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full text-white font-bold text-[10px] flex items-center justify-center ${
                      isFinals ? 'bg-amber-700' : 'bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 block">{stage.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {stage.type === 'group'
                        ? 'Gruppenphase'
                        : isFinals
                        ? 'Finaltag & Platzierungsspiele'
                        : 'K.-o.-Runde'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isFinals ? (
                    <span className="flex items-center gap-1 text-[11px] text-amber-900 font-bold">
                      <Flag className="w-3.5 h-3.5 text-amber-600" />
                      <span>Datum:</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Zu spielen bis:</span>
                    </span>
                  )}
                  <input
                    type="date"
                    value={stageDeadlines[stage.id] || ''}
                    onChange={(e) =>
                      setStageDeadlines({ ...stageDeadlines, [stage.id]: e.target.value })
                    }
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (inline) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-200">
        {/* Top Header with Step Navigator */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-bold text-xs"
              title="Zurück zur Übersicht"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[var(--color-primary)] text-white rounded-xl shadow-xs">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Meisterschaft starten</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Schritt {step} von 3: {step === 1 ? 'Vorlage wählen' : step === 2 ? 'Zeitraum & Deadlines' : 'Teilnehmer & Gruppen'}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Step Navigator */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { num: 1, label: 'Vorlage' },
              { num: 2, label: 'Zeitraum & Format' },
              { num: 3, label: 'Teilnehmer & Gruppen' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num === 1) setStep(1);
                  else if (s.num === 2 && selectedTemplate) setStep(2);
                  else if (s.num === 3 && selectedTemplate) setStep(3);
                }}
                disabled={s.num > 1 && !selectedTemplate}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  step === s.num
                    ? 'bg-slate-900 text-white shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step > s.num ? 'bg-emerald-600 text-white' : 'bg-black/10'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[var(--color-primary)] h-1.5 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* In-Page Card for Step Content */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* STEP 1: VORLAGE AUSWÄHLEN */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  1. Wähle eine Spiel-Vorlage
                </h4>
                <p className="text-xs text-slate-600">
                  Die gewählte Vorlage bestimmt automatisch Spielmodus, Sätze, Tiebreaks und die Phasen-Pipeline.
                </p>
              </div>

              {templates.length === 0 ? (
                <div className="p-10 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Keine Vorlagen vorhanden</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Um eine Vereinsmeisterschaft zu starten, wird eine Spiel-Vorlage benötigt (z. B. Einzel, Doppel, Gruppenphase mit K.-o.-Runde).
                  </p>
                  {onCreateNewTemplate && (
                    <button
                      type="button"
                      onClick={onCreateNewTemplate}
                      className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Jetzt erste Vorlage erstellen</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {templates.map((tpl) => {
                    const isSel = (selectedTemplate?.id || '') === tpl.id;
                    const groupStage = tpl.stages?.find((s) => s.type === 'group');
                    const koStages = tpl.stages?.filter((s) => s.type === 'knockout') || [];
                    const finalsDayStage = tpl.stages?.find((s) => s.type === 'finals_day' || s.isFinalsDay);

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                          isSel
                            ? 'border-[var(--color-primary)] bg-emerald-50/50 shadow-xs ring-2 ring-[var(--color-primary)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-sm text-slate-900 leading-snug">{tpl.title}</h5>
                          {isSel && (
                            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {tpl.discipline === 'doubles' ? 'Doppel (2 vs. 2)' : 'Einzel (1 vs. 1)'}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {tpl.tieBreakRule === 'head_to_head' ? 'Direkter Vergleich' : 'Satzdifferenz'}
                          </span>
                        </div>

                        {/* Pipeline visualization */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                          {groupStage && (
                            <span className="font-bold text-blue-700">
                              {groupStage.groupCount || 2} Gruppen (Top {groupStage.advancingPerGroup || 2})
                            </span>
                          )}
                          {groupStage && koStages.length > 0 && <span>➔</span>}
                          {koStages.map((ks, kIdx) => (
                            <React.Fragment key={ks.id}>
                              <span className="font-bold text-purple-700">
                                {ks.name || (ks.bracketSize === 4 ? 'Halbfinale' : ks.bracketSize === 2 ? 'Finale' : 'K.-o.-Runde')}
                              </span>
                              {kIdx < koStages.length - 1 && <span>➔</span>}
                            </React.Fragment>
                          ))}
                          {(groupStage || koStages.length > 0) && finalsDayStage && <span>➔</span>}
                          {finalsDayStage && (
                            <span className="font-bold text-amber-700">
                              {finalsDayStage.name || 'Finaltag'}
                              {finalsDayStage.placementMatchesMaxRank
                                ? ` (Plätze bis ${finalsDayStage.placementMatchesMaxRank})`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ZEITRAUM & DEADLINES */}
          {step === 2 && renderStepTwo()}

          {/* STEP 3: TEILNEHMER & AUSLOSUNG */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-0.5">
                    3. Teilnehmer zuweisen & Gruppen auslosen
                  </h4>
                  <p className="text-xs text-slate-600">
                    Wähle Mitglieder aus und weise sie den Gruppen zu oder lose sie per Zufall aus.
                  </p>
                </div>

                {groups.length > 0 && participants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRandomDraw}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Zufällig auslosen</span>
                  </button>
                )}
              </div>

              {/* Two column layout: Left = Search Members, Right = Groups & Assigned */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Member Directory */}
                <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col min-h-[440px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800">Vereinsmitglieder</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {participants.length} ausgewählt
                    </span>
                  </div>

                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchMemberQuery || ''}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Mitglied suchen..."
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[360px]">
                    {filteredUsers.slice(0, 50).map((u) => {
                      const selected = isUserSelected(u.id);
                      const name =
                        u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name;

                      return (
                        <div
                          key={u.id}
                          className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                            selected
                              ? 'bg-emerald-100/60 text-emerald-900 border border-emerald-200'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60'
                          }`}
                        >
                          <span className="font-semibold truncate">{name}</span>
                          {selected ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Dabei</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddMember(u)}
                              className="px-2.5 py-1 bg-[var(--color-primary)] hover:opacity-90 text-white font-bold text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Hinzufügen</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Groups and Participants */}
                <div className="lg:col-span-7 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col min-h-[440px] overflow-y-auto space-y-3 max-h-[460px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">
                      {groups.length > 0 ? 'Gruppen-Einteilung' : 'Teilnehmerfeld'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Gesamt: {participants.length}
                    </span>
                  </div>

                  {groups.length > 0 ? (
                    groups.map((group) => {
                      const groupParticipants = participants.filter((p) =>
                        group.participantIds.includes(p.id)
                      );

                      return (
                        <div
                          key={group.id}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{group.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-600">
                              {groupParticipants.length} Spieler
                            </span>
                          </div>

                          {groupParticipants.length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic py-1">
                              Noch keine Spieler zugewiesen
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {groupParticipants.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-xs"
                                >
                                  <span className="font-medium text-slate-800">
                                    {p.displayNames?.[0] || p.id}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {/* Move to other group selector */}
                                    <select
                                      value={group.id}
                                      onChange={(e) =>
                                        handleMoveToGroup(p.id, group.id, e.target.value)
                                      }
                                      className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5"
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          {g.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveParticipant(p.id)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                      title="Entfernen"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-1.5">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {p.displayNames?.[0] || p.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* In-Page Footer Navigation Controls */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Zurück</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Abbrechen
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={!selectedTemplate}
                  className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>Weiter</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishWizard}
                  disabled={saving || participants.length < 2}
                  className="px-6 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Meisterschaft wird erstellt...' : 'Meisterschaft jetzt starten'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Step Indicator */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--color-primary)] text-white rounded-xl shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Meisterschaft starten</h3>
              <p className="text-xs text-slate-500 font-medium">
                Schritt {step} von 3: {step === 1 ? 'Vorlage wählen' : step === 2 ? 'Zeitraum & Deadlines' : 'Teilnehmer & Gruppen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 h-1">
          <div
            className="bg-[var(--color-primary)] h-1 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: VORLAGE AUSWÄHLEN */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  1. Wähle eine Spiel-Vorlage
                </h4>
                <p className="text-xs text-slate-600">
                  Die gewählte Vorlage bestimmt automatisch Spielmodus, Sätze, Tiebreaks und die Phasen-Pipeline.
                </p>
              </div>

              {templates.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Keine Vorlagen vorhanden</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bitte erstelle zuerst im Tab „Turnier-Vorlagen“ eine Vorlage.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((tpl) => {
                    const isSel = (selectedTemplate?.id || '') === tpl.id;
                    const groupStage = tpl.stages?.find((s) => s.type === 'group');
                    const koStages = tpl.stages?.filter((s) => s.type === 'knockout') || [];
                    const finalsDayStage = tpl.stages?.find((s) => s.type === 'finals_day' || s.isFinalsDay);

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                          isSel
                            ? 'border-[var(--color-primary)] bg-emerald-50/50 shadow-xs ring-2 ring-[var(--color-primary)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-sm text-slate-900 leading-snug">{tpl.title}</h5>
                          {isSel && (
                            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {tpl.discipline === 'doubles' ? 'Doppel (2 vs. 2)' : 'Einzel (1 vs. 1)'}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {tpl.tieBreakRule === 'head_to_head' ? 'Direkter Vergleich' : 'Satzdifferenz'}
                          </span>
                        </div>

                        {/* Pipeline visualization */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                          {groupStage && (
                            <span className="font-bold text-blue-700">
                              {groupStage.groupCount || 2} Gruppen (Top {groupStage.advancingPerGroup || 2})
                            </span>
                          )}
                          {groupStage && koStages.length > 0 && <span>➔</span>}
                          {koStages.map((ks, kIdx) => (
                            <React.Fragment key={ks.id}>
                              <span className="font-bold text-purple-700">
                                {ks.name || (ks.bracketSize === 4 ? 'Halbfinale' : ks.bracketSize === 2 ? 'Finale' : 'K.-o.-Runde')}
                              </span>
                              {kIdx < koStages.length - 1 && <span>➔</span>}
                            </React.Fragment>
                          ))}
                          {(groupStage || koStages.length > 0) && finalsDayStage && <span>➔</span>}
                          {finalsDayStage && (
                            <span className="font-bold text-amber-700">
                              {finalsDayStage.name || 'Finaltag'}
                              {finalsDayStage.placementMatchesMaxRank
                                ? ` (Plätze bis ${finalsDayStage.placementMatchesMaxRank})`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ZEITRAUM & DEADLINES */}
          {step === 2 && renderStepTwo()}

          {/* STEP 3: TEILNEHMER & AUSLOSUNG */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-0.5">
                    3. Teilnehmer zuweisen & Gruppen auslosen
                  </h4>
                  <p className="text-xs text-slate-600">
                    Wähle Mitglieder aus und weise sie den Gruppen zu oder lose sie per Zufall aus.
                  </p>
                </div>

                {groups.length > 0 && participants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRandomDraw}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Zufällig auslosen</span>
                  </button>
                )}
              </div>

              {/* Two column layout: Left = Search Members, Right = Groups & Assigned */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Member Directory */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col h-80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Vereinsmitglieder</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {participants.length} ausgewählt
                    </span>
                  </div>

                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchMemberQuery || ''}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Mitglied suchen..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {filteredUsers.slice(0, 50).map((u) => {
                      const selected = isUserSelected(u.id);
                      const name =
                        u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name;

                      return (
                        <div
                          key={u.id}
                          className={`p-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                            selected
                              ? 'bg-emerald-100/60 text-emerald-900 border border-emerald-200'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60'
                          }`}
                        >
                          <span className="font-semibold truncate">{name}</span>
                          {selected ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Dabei</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddMember(u)}
                              className="px-2 py-0.5 bg-[var(--color-primary)] hover:opacity-90 text-white font-bold text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Hinzufügen</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Groups and Participants */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col h-80 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">
                      {groups.length > 0 ? 'Gruppen-Einteilung' : 'Teilnehmerfeld'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Gesamt: {participants.length}
                    </span>
                  </div>

                  {groups.length > 0 ? (
                    groups.map((group) => {
                      const groupParticipants = participants.filter((p) =>
                        group.participantIds.includes(p.id)
                      );

                      return (
                        <div
                          key={group.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{group.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-600">
                              {groupParticipants.length} Spieler
                            </span>
                          </div>

                          {groupParticipants.length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic py-1">
                              Noch keine Spieler zugewiesen
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {groupParticipants.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between gap-1 text-[11px] bg-slate-50 px-2 py-1 rounded-lg"
                                >
                                  <span className="font-medium text-slate-800 truncate">
                                    {p.displayNames?.[0] || p.id}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={group.id}
                                      onChange={(e) =>
                                        handleChangeParticipantGroup(p.id, e.target.value)
                                      }
                                      className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-700"
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          {g.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveParticipant(p.id)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-1.5">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {p.displayNames?.[0] || p.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Abbrechen
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!selectedTemplate}
                className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Weiter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishWizard}
                disabled={saving || participants.length < 2}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Meisterschaft wird erstellt...' : 'Meisterschaft jetzt starten'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
