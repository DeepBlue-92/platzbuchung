import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Check,
  Lock,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Calendar,
  Flag,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  TournamentTemplate,
  TournamentStageConfig,
  DisciplineType,
  TieBreakRuleType,
  StageType,
} from '../../types/championship';
import { saveChampionshipTemplate } from '../../services/championshipService';

const normalizeStages = (rawStages?: TournamentStageConfig[]): TournamentStageConfig[] => {
  if (!rawStages || rawStages.length === 0) {
    return [
      {
        id: 'stage_group_1',
        name: 'Gruppenphase',
        type: 'group',
        order: 0,
        groupCount: 2,
        playersPerGroup: 4,
        advancingPerGroup: 2,
        roundName: '',
        bracketSize: 4,
        isFinalsDay: false,
      },
      {
        id: 'stage_ko_2',
        name: 'Halbfinale',
        type: 'knockout',
        order: 1,
        bracketSize: 4,
        roundName: 'Halbfinale',
        groupCount: 2,
        playersPerGroup: 4,
        advancingPerGroup: 2,
        isFinalsDay: false,
      },
    ];
  }
  return rawStages.map((s, idx) => ({
    ...s,
    order: idx,
    name: s.name || (s.type === 'group' ? `Phase ${idx + 1}: Gruppenphase` : s.type === 'finals_day' ? 'Finaltag / Endspiele' : `Phase ${idx + 1}: K.-o.-Endrunde`),
    type: s.type || (s.isFinalsDay ? 'finals_day' : 'group'),
    groupCount: s.groupCount ?? 2,
    playersPerGroup: s.playersPerGroup ?? 4,
    advancingPerGroup: s.advancingPerGroup ?? 2,
    bracketSize: s.bracketSize ?? 4,
    placementMatchesMaxRank: s.placementMatchesMaxRank ?? (s.type === 'finals_day' ? (s.bracketSize === 4 ? 4 : 2) : undefined),
    roundName: s.roundName || (s.type === 'finals_day' ? 'Großes Finale & Platzierungsspiele' : s.type === 'knockout' ? 'Halbfinale & Finale' : ''),
    isFinalsDay: s.type === 'finals_day' || !!s.isFinalsDay,
  }));
};

interface ChampionshipTemplateEditorProps {
  clubId: string;
  templateToEdit?: TournamentTemplate | null;
  onBack: () => void;
  onSaved?: (savedTemplate: TournamentTemplate) => void;
}

export const ChampionshipTemplateEditor: React.FC<ChampionshipTemplateEditorProps> = ({
  clubId,
  templateToEdit,
  onBack,
  onSaved,
}) => {
  const isEditing = !!templateToEdit;
  const isLocked = !!templateToEdit?.isLocked;

  const [title, setTitle] = useState<string>(templateToEdit?.title || '');
  const [discipline, setDiscipline] = useState<DisciplineType>(templateToEdit?.discipline || 'singles');
  const [tieBreakRule, setTieBreakRule] = useState<TieBreakRuleType>(
    templateToEdit?.tieBreakRule || 'head_to_head'
  );

  const [stages, setStages] = useState<TournamentStageConfig[]>(() =>
    normalizeStages(templateToEdit?.stages)
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with templateToEdit
  useEffect(() => {
    if (templateToEdit) {
      setTitle(templateToEdit.title || '');
      setDiscipline(templateToEdit.discipline || 'singles');
      setTieBreakRule(templateToEdit.tieBreakRule || 'head_to_head');
      setStages(normalizeStages(templateToEdit.stages));
    } else {
      setTitle('Neue Vereinsmeisterschaft Vorlage');
      setDiscipline('singles');
      setTieBreakRule('head_to_head');
      setStages(normalizeStages());
    }
    setError(null);
  }, [templateToEdit]);

  // Reordering stages (Up/Down)
  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    setStages(newStages.map((s, idx) => ({ ...s, order: idx })));
  };

  // Add stage to the END of the pipeline
  const handleAddStage = (type: StageType) => {
    if (isLocked) return;
    const newStageId = `stage_${type}_${Date.now()}`;
    const newOrder = stages.length;

    if (type === 'group') {
      setStages([
        ...stages,
        {
          id: newStageId,
          name: stages.length === 0 ? 'Gruppenphase' : `Gruppenphase ${stages.length + 1}`,
          type: 'group',
          order: newOrder,
          groupCount: 2,
          playersPerGroup: 4,
          advancingPerGroup: 2,
          isFinalsDay: false,
        },
      ]);
    } else if (type === 'finals_day') {
      setStages([
        ...stages,
        {
          id: newStageId,
          name: 'Endrunde / Finaltag',
          type: 'finals_day',
          order: newOrder,
          bracketSize: 4,
          placementMatchesMaxRank: 4,
          roundName: 'Großes Finale & Platzierungsspiele',
          isFinalsDay: true,
        },
      ]);
    } else {
      setStages([
        ...stages,
        {
          id: newStageId,
          name: 'Halbfinale',
          type: 'knockout',
          order: newOrder,
          bracketSize: 4,
          roundName: 'Halbfinale',
          isFinalsDay: false,
        },
      ]);
    }
  };

  const handleRemoveStage = (index: number) => {
    if (isLocked) return;
    if (stages.length <= 1) {
      setError('Eine Vorlage muss mindestens eine Spielphase enthalten.');
      return;
    }
    const updated = stages.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, order: idx }));
    setStages(updated);
  };

  const handleUpdateStage = (index: number, patch: Partial<TournamentStageConfig>) => {
    if (isLocked) return;
    const updated = stages.map((s, idx) => (idx === index ? { ...s, ...patch } : s));
    setStages(updated);
  };

  const KNOCKOUT_ROUND_OPTIONS = [
    { value: 16, title: 'Achtelfinale', label: 'Achtelfinale (16 Spieler / 8 Matches)' },
    { value: 8, title: 'Viertelfinale', label: 'Viertelfinale (8 Spieler / 4 Matches)' },
    { value: 4, title: 'Halbfinale', label: 'Halbfinale (4 Spieler / 2 Matches)' },
    { value: 2, title: 'Finale', label: 'Finale (2 Spieler / 1 Match)' },
  ];

  // Helper to determine the total participants entering the tournament pipeline before finals day
  const getTotalPreliminaryParticipants = () => {
    const firstGroupStage = stages.find((s) => s.type === 'group');
    if (firstGroupStage) {
      const gc = firstGroupStage.groupCount || 2;
      const ppg = firstGroupStage.playersPerGroup || 4;
      return gc * ppg;
    }
    // Check first knockout stage
    const firstKoStage = stages.find((s) => s.type === 'knockout');
    if (firstKoStage) {
      return firstKoStage.bracketSize || 8;
    }
    return 8;
  };

  // Helper generating placement match options up to total preliminary participants in steps of 2
  const getFinalsDayPlacementOptions = () => {
    const total = getTotalPreliminaryParticipants();
    const maxEven = Math.max(2, total % 2 === 0 ? total : total - 1);
    const options: { value: number; label: string; matchesCount: number }[] = [];

    // Rank 2: Only Finale (Platz 1 & 2) -> 1 match
    options.push({
      value: 2,
      label: 'Nur Finale (Platz 1 & 2)',
      matchesCount: 1,
    });

    // Up to maxEven in steps of 2
    for (let r = 4; r <= maxEven; r += 2) {
      const matchForRank = r - 1;
      const totalMatches = r / 2;
      options.push({
        value: r,
        label: `+ Spiel um Platz ${matchForRank} (Ausspielung Plätze 1 bis ${r})`,
        matchesCount: totalMatches,
      });
    }

    return options;
  };

  const handleKnockoutSizeChange = (stageIndex: number, newSize: number) => {
    const opt = KNOCKOUT_ROUND_OPTIONS.find((o) => o.value === newSize);
    const newTitle = opt ? opt.title : 'K.-o.-Runde';
    handleUpdateStage(stageIndex, {
      bracketSize: newSize,
      name: newTitle,
      roundName: newTitle,
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Bitte gib einen aussagekräftigen Titel für die Vorlage ein.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (stages.length === 0) {
      setError('Bitte definiere mindestens eine Spielphase (z. B. Gruppenphase oder K.-o.-Runde).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const templateId = templateToEdit?.id || `tpl_${Date.now()}`;
      const payload: TournamentTemplate = {
        id: templateId,
        tenantId: clubId,
        title: trimmedTitle,
        discipline,
        stages: stages.map((s, idx) => ({
          ...s,
          order: idx,
          name: s.name.trim() || (s.type === 'group' ? `Gruppenphase ${idx + 1}` : s.type === 'finals_day' ? 'Finaltag' : 'K.-o.-Runde'),
          type: s.type || (s.isFinalsDay ? 'finals_day' : 'knockout'),
          groupCount: s.type === 'group' ? Number(s.groupCount) || 2 : undefined,
          playersPerGroup: s.type === 'group' ? Number(s.playersPerGroup) || 4 : undefined,
          advancingPerGroup: s.type === 'group' ? Number(s.advancingPerGroup) || 2 : undefined,
          bracketSize: s.type === 'knockout' || s.type === 'finals_day' ? Number(s.bracketSize) || 2 : undefined,
          roundName: s.type === 'knockout' || s.type === 'finals_day' ? s.roundName || 'Endrunde' : undefined,
          placementMatchesMaxRank: s.type === 'finals_day' ? (Number(s.placementMatchesMaxRank) || 4) : undefined,
          isFinalsDay: s.type === 'finals_day' || !!s.isFinalsDay,
        })),
        tieBreakRule,
        matchFormat: {
          setsToWin: 2,
          tiebreakAt: 6,
          championsTiebreakFinalSet: true,
        },
        isLocked: false,
        createdAt: templateToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveChampionshipTemplate(clubId, payload);
      if (onSaved) onSaved(payload);
    } catch (err: any) {
      console.error('[ChampionshipTemplateEditor] Fehler beim Speichern:', err);
      let msg = 'Fehler beim Speichern der Vorlage.';
      if (typeof err?.message === 'string') {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error?.includes('insufficient permissions')) {
            msg = 'Berechtigungsfehler: Bitte stellen Sie sicher, dass Sie als Administrator angemeldet sind.';
          } else if (parsed.error) {
            msg = `Fehler beim Speichern: ${parsed.error}`;
          }
        } catch {
          msg = err.message;
        }
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateFromLocked = async () => {
    if (!templateToEdit) return;
    setSaving(true);
    try {
      const duplicated: TournamentTemplate = {
        ...templateToEdit,
        id: `tpl_${Date.now()}`,
        title: `${templateToEdit.title} (Kopie)`,
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveChampionshipTemplate(clubId, duplicated);
      if (onSaved) onSaved(duplicated);
    } catch (err: any) {
      console.error('[ChampionshipTemplateEditor] Fehler beim Duplizieren:', err);
      let msg = 'Kopieren fehlgeschlagen.';
      if (typeof err?.message === 'string') {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) msg = `Fehler beim Kopieren: ${parsed.error}`;
        } catch {
          msg = err.message;
        }
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Helper for pipeline transition calculations between adjacent phases
  const getPipelineTransitionInfo = (stageA: TournamentStageConfig, stageB: TournamentStageConfig, idxA: number) => {
    // 1. Transition: Group Stage -> Knockout or Finals Day
    if (stageA.type === 'group' && (stageB.type === 'knockout' || stageB.type === 'finals_day' || stageB.isFinalsDay)) {
      const groupCount = stageA.groupCount || 2;
      const playersPerGroup = stageA.playersPerGroup || 4;
      const advancingPerGroup = stageA.advancingPerGroup || 2;
      const advancingPlayers = groupCount * advancingPerGroup;

      const isFinalsB = stageB.type === 'finals_day' || !!stageB.isFinalsDay;
      const bracketSize = isFinalsB
        ? (stageB.placementMatchesMaxRank ?? (stageB.bracketSize || 4))
        : (stageB.bracketSize || 4);
      const isExact = advancingPlayers === bracketSize;

      return {
        summaryText: `${groupCount} Gruppen à ${playersPerGroup} Spieler → Top ${advancingPerGroup} weiter (${advancingPlayers} Qualifikanten) → Phase ${idxA + 2} (${stageB.name})`,
        totalQualifiers: advancingPlayers,
        bracketSize,
        isExact,
        message: isExact
          ? `Passgenau: ${advancingPlayers} Qualifikanten füllen das ${bracketSize}er Feld (${stageB.name || 'Endrunde'}) exakt aus.`
          : advancingPlayers < bracketSize
          ? `Hinweis: ${advancingPlayers} Qualifikanten aus Phase ${idxA + 1}, aber das Feld ist für ${bracketSize} Teilnehmer ausgelegt (Freilose erforderlich).`
          : `Hinweis: ${advancingPlayers} Qualifikanten aus Phase ${idxA + 1} überschreiten das ${bracketSize}er Feld.`,
      };
    }

    // 2. Transition: Knockout / Finals Day -> Knockout or Finals Day
    if ((stageA.type === 'knockout' || stageA.type === 'finals_day') && (stageB.type === 'knockout' || stageB.type === 'finals_day' || stageB.isFinalsDay)) {
      const playerCountA = stageA.bracketSize || 4;
      const matchCountA = Math.max(1, Math.floor(playerCountA / 2));
      const winnersCountA = matchCountA;
      const losersCountA = matchCountA;

      const isFinalsB = stageB.type === 'finals_day' || !!stageB.isFinalsDay;

      if (isFinalsB) {
        const placementMaxRank = stageB.placementMatchesMaxRank ?? (stageB.bracketSize === 2 ? 2 : 4);

        // Halbfinale (4 Spieler / 2 Matches): 2 Sieger fürs Finale, 2 Verlierer fürs Spiel um Platz 3
        if (placementMaxRank >= 4 || stageB.bracketSize === 4) {
          const isExact = playerCountA === 4 || matchCountA === 2;
          return {
            summaryText: `${winnersCountA} Sieger (Finale) & ${losersCountA} Verlierer (Platz 3) → Phase ${idxA + 2} (${stageB.name})`,
            totalQualifiers: winnersCountA + losersCountA,
            bracketSize: 4,
            isExact: isExact,
            message: isExact
              ? `Aus Stufe ${idxA + 1} (${stageA.name}) gehen ${winnersCountA} Sieger (fürs Finale) und ${losersCountA} Verlierer (für Spiel um Platz 3) hervor – beide Matches am Finaltag sind damit vollständig belegt.`
              : `Hinweis: Teilnehmerzahl aus Stufe ${idxA + 1} passt nicht zum Finaltag.`,
          };
        } else {
          // Nur Großes Finale (Platz 1 & 2)
          const isExact = winnersCountA === 2;
          return {
            summaryText: `${winnersCountA} Sieger ziehen ins Finale von Phase ${idxA + 2} (${stageB.name}) ein`,
            totalQualifiers: winnersCountA,
            bracketSize: 2,
            isExact: isExact,
            message: isExact
              ? `Die ${winnersCountA} Sieger bestreiten das Finale am Finaltag.`
              : `Hinweis: ${winnersCountA} Sieger treffen auf das Finale.`,
          };
        }
      }

      // Reguläre K.-o.-Runde zu nächster K.-o.-Runde
      const playerCountB = stageB.bracketSize || 2;
      const isExact = winnersCountA === playerCountB;

      return {
        summaryText: `${winnersCountA} Sieger aus Phase ${idxA + 1} ziehen in Phase ${idxA + 2} (${stageB.name}) ein`,
        totalQualifiers: winnersCountA,
        bracketSize: playerCountB,
        isExact,
        message: isExact
          ? `Die ${winnersCountA} Sieger bestreiten die Endspiele in Phase ${idxA + 2}.`
          : `Hinweis: ${winnersCountA} Sieger treffen auf ein ${playerCountB}er Feld.`,
      };
    }

    if (stageA.type === 'group' && stageB.type === 'group') {
      const groupCountA = stageA.groupCount || 2;
      const advancingA = stageA.advancingPerGroup || 2;
      const advancingPlayers = groupCountA * advancingA;

      return {
        summaryText: `${groupCountA} Gruppen → Top ${advancingA} weiter → ${advancingPlayers} Spieler erreichen Phase ${idxA + 2} (${stageB.name})`,
        totalQualifiers: advancingPlayers,
        bracketSize: undefined,
        isExact: true,
        message: `${advancingPlayers} Qualifikanten spielen in der nächsten Gruppenphase weiter.`,
      };
    }

    return {
      summaryText: `Teilnehmer aus Phase ${idxA + 1} ziehen in Phase ${idxA + 2} (${stageB.name}) ein`,
      totalQualifiers: undefined,
      bracketSize: undefined,
      isExact: true,
      message: `Die qualifizierten Spieler ziehen direkt in die nächste Runde ein.`,
    };
  };

  // Helper to generate the comprehensive tournament mode summary (Bento card at pipeline end)
  const getOverallPipelineSummary = () => {
    if (stages.length === 0) return null;

    const steps = stages.map((st, idx) => {
      if (st.type === 'group') {
        const gc = st.groupCount || 2;
        const ppg = st.playersPerGroup || 4;
        const adv = st.advancingPerGroup || 2;
        return {
          num: idx + 1,
          name: st.name || `Gruppenphase ${idx + 1}`,
          type: 'group',
          desc: `${gc} ${gc === 1 ? 'Gruppe' : 'Gruppen'} à ${ppg} Spieler (Top ${adv} kommen weiter)`,
          qualifiersOut: gc * adv,
        };
      } else if (st.type === 'finals_day' || st.isFinalsDay) {
        const maxRank = st.placementMatchesMaxRank ?? (st.bracketSize === 2 ? 2 : 4);
        const matchesCount = Math.max(1, Math.floor(maxRank / 2));
        const descText = maxRank === 2
          ? 'Großes Finale (Platz 1 & 2)'
          : maxRank === 4
          ? 'Großes Finale & Spiel um Platz 3'
          : `Platzierungsspiele bis Platz ${maxRank} (${matchesCount} Matches)`;

        return {
          num: idx + 1,
          name: st.name || 'Finaltag',
          type: 'finals_day',
          desc: descText,
          capacityIn: maxRank,
        };
      } else {
        const bs = st.bracketSize || 4;
        const matchesCount = Math.max(1, Math.floor(bs / 2));
        const roundTitle = bs === 16 ? 'Achtelfinale' : bs === 8 ? 'Viertelfinale' : bs === 4 ? 'Halbfinale' : 'Finale';
        return {
          num: idx + 1,
          name: st.name || roundTitle,
          type: 'knockout',
          desc: `${bs} Spieler / ${matchesCount} ${matchesCount === 1 ? 'Match' : 'Matches'} (${roundTitle})`,
          capacityIn: bs,
        };
      }
    });

    // Check pipeline consistency across transitions
    let isConsistent = true;
    const issues: string[] = [];
    const successes: string[] = [];

    for (let i = 0; i < stages.length - 1; i++) {
      const current = stages[i];
      const next = stages[i + 1];
      const trans = getPipelineTransitionInfo(current, next, i);
      if (!trans.isExact) {
        isConsistent = false;
        issues.push(trans.message);
      } else if (trans.bracketSize != null && trans.totalQualifiers != null) {
        successes.push(`${trans.totalQualifiers} Aufsteiger füllen das ${trans.bracketSize}er-Feld (${next.name}) exakt`);
      }
    }

    const validationText = isConsistent
      ? '✓ Pipeline schlüssig: Alle Runden und Teilnehmerzahlen gehen exakt auf.'
      : `Hinweis: ${issues[0] || 'Phasenübertragung erfordert Anpassung'}`;

    return {
      steps,
      isConsistent,
      validationText,
    };
  };

  const pipelineSummary = getOverallPipelineSummary();

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Navigation */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0"
            title="Zurück zur Vorlagen-Übersicht"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>← Zurück zur Vorlagen-Übersicht</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {isLocked
                  ? 'Turnier-Vorlage ansehen'
                  : isEditing
                  ? 'Turnier-Vorlage bearbeiten'
                  : 'Neue Turnier-Vorlage erstellen'}
              </h2>
              {isLocked && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Gesperrt</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Konfiguriere Disziplin, Satz-Format und den chronologischen Phasenablauf.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Abbrechen
          </button>

          {!isLocked ? (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Speichert...' : 'Vorlage speichern'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDuplicateFromLocked}
              disabled={saving}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Als neue Vorlage duplizieren</span>
            </button>
          )}
        </div>
      </div>

      {/* Locked Notice Banner */}
      {isLocked && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-xl shrink-0 text-amber-700 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Vorlage ist gesperrt (Manipulationsschutz)</div>
              <div className="text-xs text-amber-800 leading-relaxed mt-0.5 max-w-2xl">
                Diese Vorlage wird bereits in einer aktiven oder archivierten Meisterschaft verwendet und kann nicht direkt überschrieben werden. Du kannst jedoch eine sofort bearbeitbare Kopie anlegen.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDuplicateFromLocked}
            disabled={saving}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Jetzt Kopie erstellen</span>
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Content (Natural Page Scroll) */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Grunddaten */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[var(--color-primary)] font-black text-xs flex items-center justify-center">
              1
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Grunddaten
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Titel und Regelwerk
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Titel der Vorlage <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title || ''}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLocked}
                placeholder="z. B. Vereinsmeisterschaft Herren-Einzel (Gruppen & K.-o.)"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Discipline Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Disziplin
                </label>
                <div className="relative">
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value as DisciplineType)}
                    disabled={isLocked}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer appearance-none pr-9"
                  >
                    <option value="singles">Einzel (1 vs. 1)</option>
                    <option value="doubles">Doppel (2 vs. 2)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Tie Break Rule */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Regel bei Punktgleichstand
                </label>
                <div className="relative">
                  <select
                    value={tieBreakRule}
                    onChange={(e) => setTieBreakRule(e.target.value as TieBreakRuleType)}
                    disabled={isLocked}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer appearance-none pr-9"
                  >
                    <option value="head_to_head">Direkter Vergleich</option>
                    <option value="set_difference">Satz- &amp; Spieledifferenz</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Phasen-Pipeline (Chronological Layout) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[var(--color-primary)] font-black text-xs flex items-center justify-center">
              2
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Phasen-Pipeline
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Chronologischer Ablauf von Vorrunde bis Endrunde (von oben nach unten)
              </p>
            </div>
          </div>

          {/* Chronological Stages List */}
          <div className="space-y-0">
            {stages.map((stage, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === stages.length - 1;
              const nextStage = !isLast ? stages[idx + 1] : null;
              const transitionInfo = nextStage ? getPipelineTransitionInfo(stage, nextStage, idx) : null;

              return (
                <div key={stage.id || idx} className="flex flex-col items-center">
                  {/* Phase Card */}
                  <div className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 relative">
                    {/* Phase Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Number badge */}
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {idx + 1}
                        </div>

                        {/* Editable Name */}
                        <input
                          type="text"
                          value={stage.name || ''}
                          onChange={(e) => handleUpdateStage(idx, { name: e.target.value })}
                          disabled={isLocked}
                          placeholder="Phasen-Name (z. B. Vorrunde)"
                          className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-transparent disabled:border-transparent min-w-[200px]"
                        />

                        {/* Stage Type Pill */}
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                            stage.type === 'group'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : stage.type === 'finals_day'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {stage.type === 'group'
                            ? 'Gruppenphase'
                            : stage.type === 'finals_day'
                            ? 'Finaltag / Event'
                            : 'K.-o.-Runde'}
                        </span>
                      </div>

                      {/* Phase Action Tools (Up/Down/Delete) */}
                      {!isLocked && (
                        <div className="flex items-center gap-1 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleMoveStage(idx, 'up')}
                            disabled={isFirst}
                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Phase nach oben verschieben"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveStage(idx, 'down')}
                            disabled={isLast}
                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Phase nach unten verschieben"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {stages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStage(idx)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                              title="Phase entfernen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stage Configuration Fields */}
                    {stage.type === 'group' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Anzahl Gruppen
                          </label>
                          <div className="relative">
                            <select
                              value={stage.groupCount || 2}
                              onChange={(e) =>
                                handleUpdateStage(idx, { groupCount: Number(e.target.value) })
                              }
                              disabled={isLocked}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium appearance-none pr-8 cursor-pointer"
                            >
                              <option value={1}>1 Gruppe</option>
                              <option value={2}>2 Gruppen (Gruppe A &amp; B)</option>
                              <option value={4}>4 Gruppen (Gruppe A bis D)</option>
                              <option value={8}>8 Gruppen (Gruppe A bis H)</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Spieler pro Gruppe (Soll)
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={16}
                            value={stage.playersPerGroup ?? 4}
                            onChange={(e) =>
                              handleUpdateStage(idx, {
                                playersPerGroup: e.target.value === '' ? 4 : Number(e.target.value),
                              })
                            }
                            disabled={isLocked}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Weiterkommende pro Gruppe
                          </label>
                          <div className="relative">
                            <select
                              value={stage.advancingPerGroup ?? 2}
                              onChange={(e) =>
                                handleUpdateStage(idx, { advancingPerGroup: Number(e.target.value) })
                              }
                              disabled={isLocked}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium appearance-none pr-8 cursor-pointer"
                            >
                              <option value={1}>Top 1 (Nur Gruppensieger)</option>
                              <option value={2}>Top 2 (Platz 1 &amp; 2)</option>
                              <option value={3}>Top 3</option>
                              <option value={4}>Top 4</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    ) : stage.type === 'finals_day' ? (
                      <div className="pt-1 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Ausspielung der Plätze bis:
                          </label>
                          <div className="relative max-w-md">
                            <select
                              value={stage.placementMatchesMaxRank ?? (stage.bracketSize === 2 ? 2 : 4)}
                              onChange={(e) => {
                                const newRank = Number(e.target.value);
                                handleUpdateStage(idx, {
                                  placementMatchesMaxRank: newRank,
                                  bracketSize: newRank,
                                });
                              }}
                              disabled={isLocked}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium appearance-none pr-8 cursor-pointer"
                            >
                              {getFinalsDayPlacementOptions().map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        {/* Dynamic Summary for Finals Day Matches */}
                        {(() => {
                          const currentMaxRank = stage.placementMatchesMaxRank ?? (stage.bracketSize === 2 ? 2 : 4);
                          const totalMatches = Math.max(1, Math.floor(currentMaxRank / 2));
                          const totalParticipants = getTotalPreliminaryParticipants();
                          const coversAll = currentMaxRank >= totalParticipants;

                          return (
                            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="font-bold">
                                  Insgesamt {totalMatches} {totalMatches === 1 ? 'Match' : 'Matches'} am Finaltag angesetzt.
                                </div>
                                <div className="text-[11px] text-amber-800/90 leading-relaxed">
                                  {coversAll ? (
                                    <span>
                                      Alle {totalParticipants} teilnehmenden Mitglieder bestreiten ihr jeweiliges Platzierungsspiel
                                      (Platz 1 &amp; 2{currentMaxRank >= 4 ? ', Spiel um Platz 3' : ''}
                                      {currentMaxRank >= 6 ? ', Spiel um Platz 5' : ''}
                                      {currentMaxRank >= 8 ? ', Spiel um Platz 7' : ''}
                                      {currentMaxRank > 8 ? ` bis Platz ${currentMaxRank}` : ''}).
                                    </span>
                                  ) : (
                                    <span>
                                      Die Plätze 1 bis {currentMaxRank} werden direkt am Finaltag ausgespielt (Platz 1 &amp; 2
                                      {currentMaxRank >= 4 ? ', Spiel um Platz 3' : ''}
                                      {currentMaxRank >= 6 ? ', Spiel um Platz 5' : ''}
                                      {currentMaxRank >= 8 ? ', Spiel um Platz 7' : ''}
                                      {currentMaxRank > 8 ? ` bis Platz ${currentMaxRank}` : ''}).
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            K.-o.-Spielrunde
                          </label>
                          <div className="relative max-w-md">
                            <select
                              value={stage.bracketSize ?? 4}
                              onChange={(e) =>
                                handleKnockoutSizeChange(idx, Number(e.target.value))
                              }
                              disabled={isLocked}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium appearance-none pr-8 cursor-pointer"
                            >
                              {KNOCKOUT_ROUND_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Discrete Chronological Connector Line with Arrow Icon between adjacent phases */}
                  {!isLast && (
                    <div className="py-2.5 flex flex-col items-center justify-center">
                      <div className="w-0.5 h-3 bg-slate-300"></div>
                      <div className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-2xs">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </div>
                      <div className="w-0.5 h-3 bg-slate-300"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Section 3 Footer: Add Next Phase Action Bar */}
          {!isLocked && (
            <div className="pt-2">
              <div className="border-2 border-dashed border-slate-300 hover:border-[var(--color-primary)] bg-slate-50/60 hover:bg-emerald-50/30 rounded-2xl p-6 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white border border-slate-200 text-[var(--color-primary)] rounded-xl shadow-2xs mt-0.5 shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Weitere Phase anhängen
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Füge der Pipeline chronologisch eine weitere Vorrunde oder K.-o.-Endrunde nach Phase {stages.length} hinzu.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAddStage('group')}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gruppenphase</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddStage('knockout')}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-purple-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>K.-o.-Runde</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddStage('finals_day')}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Finaltag / Event</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Bento Card "Zusammenfassung des Turniermodus" */}
        {pipelineSummary && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-[var(--color-primary)] rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Zusammenfassung des Turniermodus
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Gesamter Ablauf der Meisterschaft auf einen Blick
                  </p>
                </div>
              </div>

              {/* Validation Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 self-start sm:self-center ${
                  pipelineSummary.isConsistent
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                {pipelineSummary.isConsistent ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{pipelineSummary.validationText}</span>
              </div>
            </div>

            {/* Narrative Chain Breakdown */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                Turnier-Kette
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700 leading-relaxed">
                {pipelineSummary.steps.map((step, sIdx) => (
                  <React.Fragment key={step.num}>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {step.num}
                      </span>
                      <span className="font-bold text-slate-900">{step.name}:</span>
                      <span className="text-slate-600">{step.desc}</span>
                    </div>

                    {sIdx < pipelineSummary.steps.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Footer */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zur Übersicht (Änderungen verwerfen)</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Abbrechen
            </button>

            {!isLocked ? (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Wird gespeichert...' : 'Vorlage speichern'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDuplicateFromLocked}
                disabled={saving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Als neue Vorlage duplizieren</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
