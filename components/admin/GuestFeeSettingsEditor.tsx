import React, { useState, useId } from 'react';
import {
  GripVertical,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Calculator,
  Sliders,
  Check,
  Scale,
  Info,
} from 'lucide-react';
import {
  ClubFeeSettings,
  AdvancedRule,
  ConditionRow,
  RuleAction,
  BookingFeeContext,
} from '../../types';
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  ACTION_TYPES,
  generateRuleSentence,
  calculateBookingFee,
  validateFeeSettings,
  describeAction,
} from '../../utils/guestFeeCalculator';

interface GuestFeeSettingsEditorProps {
  feeSettings: ClubFeeSettings;
  onChange: (updated: ClubFeeSettings) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export const GuestFeeSettingsEditor: React.FC<GuestFeeSettingsEditorProps> = ({
  feeSettings,
  onChange,
  onValidationChange,
}) => {
  const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);
  const [draggedRuleIndex, setDraggedRuleIndex] = useState<number | null>(null);

  // Mini simulation state
  const [simGuests, setSimGuests] = useState(1);
  const [simMembers, setSimMembers] = useState(1);
  const [simDuration, setSimDuration] = useState(60);

  const currentMode = feeSettings.fee_calculation_mode || 'SIMPLE';

  // Run validation
  const validation = validateFeeSettings(feeSettings);
  React.useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.isValid);
    }
  }, [validation.isValid, onValidationChange]);

  // Handle Mode Switch
  const handleRequestModeSwitch = (newMode: 'SIMPLE' | 'ADVANCED') => {
    if (newMode === currentMode) return;

    if (currentMode === 'ADVANCED' && newMode === 'SIMPLE') {
      const hasAdvancedRules = (feeSettings.advanced_config?.rules || []).length > 0;
      if (hasAdvancedRules) {
        setShowModeSwitchModal(true);
        return;
      }
    }

    applyModeSwitch(newMode);
  };

  const applyModeSwitch = (newMode: 'SIMPLE' | 'ADVANCED') => {
    onChange({
      ...feeSettings,
      fee_calculation_mode: newMode,
    });
    setShowModeSwitchModal(false);
  };

  // --- Simple Mode Handlers ---
  const simpleConfig = feeSettings.simple_config || {
    rate_type: 'PER_GUEST_HOUR',
    amount_cents: 250,
  };

  const handleSimpleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    const parsed = parseFloat(raw);
    const amount_cents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    onChange({
      ...feeSettings,
      simple_config: {
        ...simpleConfig,
        amount_cents,
      },
    });
  };

  const handleSimpleRateTypeChange = (rate_type: RuleAction['type']) => {
    onChange({
      ...feeSettings,
      simple_config: {
        ...simpleConfig,
        rate_type: rate_type as any,
      },
    });
  };

  // --- Advanced Mode Handlers ---
  const advancedConfig = feeSettings.advanced_config || {
    rules: [],
    default_rule: { type: 'PER_GUEST_HOUR', amount_cents: 250 },
  };
  const rules = advancedConfig.rules || [];

  const handleAddRule = () => {
    const newRuleId = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRule: AdvancedRule = {
      id: newRuleId,
      name: `Regel ${rules.length + 1}`,
      priority: rules.length,
      match_type: 'ALL',
      conditions: [
        {
          id: `cond_${Date.now()}_1`,
          logicOperator: 'AND',
          field: 'anzahl_gaeste',
          operator: 'GREATER_THAN_EQUAL',
          value: 1,
        },
      ],
      action: {
        type: 'PER_GUEST_HOUR',
        amount_cents: 300,
      },
    };

    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        rules: [...rules, newRule],
      },
    });
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<AdvancedRule>) => {
    const updatedRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r));
    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        rules: updatedRules,
      },
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = rules
      .filter((r) => r.id !== ruleId)
      .map((r, idx) => ({ ...r, priority: idx }));
    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        rules: updatedRules,
      },
    });
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    const reIndexed = newRules.map((r, idx) => ({ ...r, priority: idx }));
    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        rules: reIndexed,
      },
    });
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRuleIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedRuleIndex === null || draggedRuleIndex === index) return;

    const newRules = [...rules];
    const draggedItem = newRules[draggedRuleIndex];
    newRules.splice(draggedRuleIndex, 1);
    newRules.splice(index, 0, draggedItem);

    const reIndexed = newRules.map((r, idx) => ({ ...r, priority: idx }));
    setDraggedRuleIndex(index);
    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        rules: reIndexed,
      },
    });
  };

  const handleDragEnd = () => {
    setDraggedRuleIndex(null);
  };

  // Conditions
  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newCond: ConditionRow = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      logicOperator: 'AND',
      field: 'anzahl_gesamt',
      operator: 'EQUALS',
      value: 2,
    };

    handleUpdateRule(ruleId, {
      conditions: [...rule.conditions, newCond],
    });
  };

  const handleUpdateCondition = (
    ruleId: string,
    condId: string,
    updates: Partial<ConditionRow>
  ) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updatedConds = rule.conditions.map((c) => (c.id === condId ? { ...c, ...updates } : c));
    handleUpdateRule(ruleId, { conditions: updatedConds });
  };

  const handleDeleteCondition = (ruleId: string, condId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    handleUpdateRule(ruleId, {
      conditions: rule.conditions.filter((c) => c.id !== condId),
    });
  };

  // Default Rule
  const handleDefaultRuleChange = (updates: Partial<RuleAction>) => {
    onChange({
      ...feeSettings,
      advanced_config: {
        ...advancedConfig,
        default_rule: {
          ...advancedConfig.default_rule,
          ...updates,
        },
      },
    });
  };

  // Simulation run
  const simContext: BookingFeeContext = {
    anzahl_gaeste: simGuests,
    anzahl_mitglieder: simMembers,
    anzahl_gesamt: simGuests + simMembers,
    dauer_minuten: simDuration,
  };
  const simResult = calculateBookingFee(simContext, feeSettings);

  return (
    <div id="guest-fee-settings-panel" className="space-y-6">
      {/* SECTION HEADER & 2-TIER MODE SWITCHER */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100/60">
                <Scale className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Gastspiel-Gebührenordnung
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wähle zwischen dem einfachen Standardmodell oder dynamischen Bedingungs-Regeln.
                </p>
              </div>
            </div>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <button
              type="button"
              id="fee-mode-simple-btn"
              onClick={() => handleRequestModeSwitch('SIMPLE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentMode === 'SIMPLE'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Einfach (Standard)</span>
            </button>
            <button
              type="button"
              id="fee-mode-advanced-btn"
              onClick={() => handleRequestModeSwitch('ADVANCED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentMode === 'ADVANCED'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Erweitert (Condition Builder)</span>
            </button>
          </div>
        </div>

        {/* --- TIER 1: SIMPLE MODE UI --- */}
        {currentMode === 'SIMPLE' && (
          <div className="pt-5 space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700">Einfaches Gebührenmodell: </span>
                Alle Gastbuchungen werden nach einem einheitlichen Satz pro Stunde oder pro Gast abgerechnet.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Gebühr (€)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="simple-fee-amount-input"
                    value={((simpleConfig.amount_cents || 0) / 100).toFixed(2).replace('.', ',')}
                    onChange={handleSimpleAmountChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-semibold text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all pr-8"
                    placeholder="2,50"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-400 pointer-events-none">
                    €
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Abrechnungstyp
                </label>
                <select
                  id="simple-fee-rate-type-select"
                  value={simpleConfig.rate_type}
                  onChange={(e) => handleSimpleRateTypeChange(e.target.value as RuleAction['type'])}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
                >
                  <option value="PER_GUEST_HOUR">Pro Gast und Stunde</option>
                  <option value="PER_COURT_HOUR">Pauschal pro Platzstunde</option>
                  <option value="PER_GUEST">Pro Gast (einmalig)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* --- TIER 2: ADVANCED MODE UI (WORKDAY CONDITION BUILDER) --- */}
        {currentMode === 'ADVANCED' && (
          <div className="pt-5 space-y-6 animate-in fade-in duration-200">
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Top-Down Auswertung (Prioritätsreihenfolge): </span>
                Die Regeln werden strikt von oben nach unten geprüft. Die erste Regel, deren Bedingungen zutreffen, bestimmt den Buchungspreis. Nutze den Drag-Griff <span className="font-mono font-bold">:::</span>, um Prioritäten zu ändern.
              </div>
            </div>

            {/* Rules List */}
            <div className="space-y-4" id="advanced-rules-container">
              {rules.map((rule, index) => {
                const ruleError =
                  validation.errors[`rule_${rule.id}_name`] ||
                  validation.errors[`rule_${rule.id}_conditions`] ||
                  validation.errors[`rule_${rule.id}_amount`];

                const isDragging = draggedRuleIndex === index;

                return (
                  <div
                    key={rule.id}
                    id={`advanced-rule-card-${rule.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-slate-50/70 border rounded-2xl p-4 sm:p-5 transition-all shadow-2xs ${
                      ruleError
                        ? 'border-red-300 ring-2 ring-red-100'
                        : isDragging
                        ? 'border-emerald-400 opacity-60 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Rule Top Row: Drag Handle + Priority + Name + Match Type + Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Drag Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Priorität per Drag-and-Drop verschieben"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Priority Badge */}
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-700 shrink-0">
                          #{index + 1}
                        </span>

                        {/* Rule Name Input */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={rule.name}
                            onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                            placeholder="Regel-Name (z.B. Einzel mit 1 Gast)"
                            className={`w-full max-w-sm px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border rounded-lg outline-none transition-all ${
                              validation.errors[`rule_${rule.id}_name`]
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-slate-200 focus:border-emerald-600'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Reorder Buttons & Delete */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        {/* Reorder Buttons */}
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveRule(index, 'up')}
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-colors"
                            title="Nach oben verschieben"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === rules.length - 1}
                            onClick={() => handleMoveRule(index, 'down')}
                            className="p-1 hover:bg-slate-100 border-l border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-colors"
                            title="Nach unten verschieben"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Delete Rule */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Regel löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Conditions List */}
                    <div className="pt-3 space-y-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Bedingungen</span>
                        {validation.errors[`rule_${rule.id}_conditions`] && (
                          <span className="text-red-500 font-normal">
                            {validation.errors[`rule_${rule.id}_conditions`]}
                          </span>
                        )}
                      </div>

                      {rule.conditions.map((cond, cIdx) => {
                        const fieldError = validation.errors[`rule_${rule.id}_cond_${cond.id}_field`];
                        const valError = validation.errors[`rule_${rule.id}_cond_${cond.id}_value`];

                        return (
                          <div
                            key={cond.id}
                            className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-3xs"
                          >
                            {cIdx === 0 ? (
                              <span className="text-[11px] font-bold text-slate-500 w-14 text-center py-1 bg-slate-100/90 rounded-lg select-none shrink-0">
                                WENN
                              </span>
                            ) : (
                              <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-[10px] font-bold shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCondition(rule.id, cond.id, {
                                      logicOperator: 'AND',
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded transition-colors ${
                                    (cond.logicOperator || 'AND') === 'AND'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title="UND-Verknüpfung"
                                >
                                  UND
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCondition(rule.id, cond.id, {
                                      logicOperator: 'OR',
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded transition-colors ${
                                    cond.logicOperator === 'OR'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title="ODER-Verknüpfung"
                                >
                                  ODER
                                </button>
                              </div>
                            )}

                            {/* Variable Dropdown */}
                            <select
                              value={cond.field}
                              onChange={(e) =>
                                handleUpdateCondition(rule.id, cond.id, {
                                  field: e.target.value as ConditionRow['field'],
                                })
                              }
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-white outline-none transition-all ${
                                fieldError ? 'border-red-400' : 'border-slate-200 focus:border-emerald-600'
                              }`}
                            >
                              {CONDITION_FIELDS.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>

                            {/* Operator Dropdown */}
                            <select
                              value={cond.operator}
                              onChange={(e) =>
                                handleUpdateCondition(rule.id, cond.id, {
                                  operator: e.target.value as ConditionRow['operator'],
                                })
                              }
                              className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-600 transition-all"
                            >
                              {CONDITION_OPERATORS.map((op) => (
                                <option key={op.id} value={op.id}>
                                  {op.label}
                                </option>
                              ))}
                            </select>

                            {/* Numeric Value Input */}
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                value={cond.value ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                  handleUpdateCondition(rule.id, cond.id, { value: isNaN(val as number) ? null : val });
                                }}
                                placeholder="Wert"
                                className={`w-20 px-2 py-1.5 text-xs font-bold rounded-lg border bg-white outline-none transition-all ${
                                  valError ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-200 focus:border-emerald-600'
                                }`}
                              />
                              {cond.field === 'dauer_minuten' && (
                                <span className="text-[10px] text-slate-400 ml-1">Min.</span>
                              )}
                            </div>

                            {/* Remove Condition */}
                            {rule.conditions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCondition(rule.id, cond.id)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors ml-auto"
                                title="Bedingung entfernen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Condition Button */}
                      <button
                        type="button"
                        onClick={() => handleAddCondition(rule.id)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 py-1 px-2 hover:bg-emerald-50/60 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Bedingung hinzufügen</span>
                      </button>
                    </div>

                    {/* Action Section: Price + Calculation Type */}
                    <div className="mt-4 pt-3.5 border-t border-slate-200/70">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          DANN berechne:
                        </span>

                        {rule.action.type !== 'FREE' && (
                          <div className="relative">
                            <input
                              type="text"
                              value={((rule.action.amount_cents || 0) / 100).toFixed(2).replace('.', ',')}
                              onChange={(e) => {
                                const raw = e.target.value.replace(',', '.');
                                const parsed = parseFloat(raw);
                                handleUpdateRule(rule.id, {
                                  action: {
                                    ...rule.action,
                                    amount_cents: isNaN(parsed) ? 0 : Math.round(parsed * 100),
                                  },
                                });
                              }}
                              className="w-24 px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-emerald-600 transition-all pr-6"
                            />
                            <span className="absolute right-2.5 top-1.5 text-xs font-semibold text-slate-400 pointer-events-none">
                              €
                            </span>
                          </div>
                        )}

                        <select
                          value={rule.action.type}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              action: {
                                ...rule.action,
                                type: e.target.value as RuleAction['type'],
                              },
                            })
                          }
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-600 transition-all"
                        >
                          {ACTION_TYPES.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Live Business Sentence Preview */}
                      <div className="mt-3 p-2.5 bg-emerald-50/50 border border-emerald-100/70 rounded-xl text-xs font-medium text-emerald-950 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="italic leading-relaxed">{generateRuleSentence(rule)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Rule Button */}
            <button
              type="button"
              id="add-new-rule-btn"
              onClick={handleAddRule}
              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Neue Bedingungs-Regel hinzufügen</span>
            </button>

            {/* STANDARD-REGEL SECTION (ANCHORED AT THE BOTTOM) */}
            <div
              id="standard-rule-section"
              className="bg-slate-100/80 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-3xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Standard-Regel (Greift, wenn keine obige Regel zutrifft)
                  </span>
                </div>
              </div>

              <div className="pt-3.5 flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-slate-600">Standard-Gebühr:</span>
                {advancedConfig.default_rule?.type !== 'FREE' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={(
                        (advancedConfig.default_rule?.amount_cents ?? 250) / 100
                      )
                        .toFixed(2)
                        .replace('.', ',')}
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.');
                        const parsed = parseFloat(raw);
                        handleDefaultRuleChange({
                          amount_cents: isNaN(parsed) ? 0 : Math.round(parsed * 100),
                        });
                      }}
                      className="w-24 px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-emerald-600 transition-all pr-6"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs font-semibold text-slate-400 pointer-events-none">
                      €
                    </span>
                  </div>
                )}

                <select
                  value={advancedConfig.default_rule?.type || 'PER_GUEST_HOUR'}
                  onChange={(e) =>
                    handleDefaultRuleChange({
                      type: e.target.value as RuleAction['type'],
                    })
                  }
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-600 transition-all"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 italic">
                Wenn keine obige Bedingung erfüllt ist, {describeAction(advancedConfig.default_rule || { type: 'PER_GUEST_HOUR', amount_cents: 250 })}.
              </div>
            </div>
          </div>
        )}

        {/* --- INTEGRATED LIVE INTERACTIVE TEST SIMULATOR (INSIDE MAIN CARD) --- */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 pb-3">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Live-Regelprüfer & Gebühren-Simulator
            </h4>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Gäste
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimGuests(Math.max(0, simGuests - 1))}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold text-slate-800">
                  {simGuests}
                </span>
                <button
                  type="button"
                  onClick={() => setSimGuests(simGuests + 1)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Mitglieder
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimMembers(Math.max(0, simMembers - 1))}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold text-slate-800">
                  {simMembers}
                </span>
                <button
                  type="button"
                  onClick={() => setSimMembers(simMembers + 1)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Dauer
              </label>
              <select
                value={simDuration}
                onChange={(e) => setSimDuration(parseInt(e.target.value, 10))}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-600"
              >
                <option value={30}>30 Min.</option>
                <option value={60}>60 Min. (1h)</option>
                <option value={90}>90 Min. (1.5h)</option>
                <option value={120}>120 Min. (2h)</option>
              </select>
            </div>
          </div>

          {/* Calculation Result Banner */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase block">
                Berechnetes Ergebnis ({simResult.mode}-Modus)
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {simResult.matchedRuleName
                  ? `Angewendet: ${simResult.matchedRuleName}`
                  : simResult.description}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-emerald-700">
                {simResult.totalEuro.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Switching from Advanced to Simple */}
      {showModeSwitchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-900 text-sm">
                Zum einfachen Modus wechseln?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deine erweiterten Regeln bleiben im Hintergrund erhalten, werden jedoch solange der einfache Modus aktiv ist, nicht zur Gebührenberechnung herangezogen.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowModeSwitchModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => applyModeSwitch('SIMPLE')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
              >
                Ja, zum einfachen Modus wechseln
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
