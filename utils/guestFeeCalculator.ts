import {
  ClubFeeSettings,
  AdvancedRule,
  ConditionRow,
  RuleAction,
  BookingFeeContext,
  BookingFeeCalculationResult,
  FeeCalculationMode
} from '../types';

export const CONDITION_FIELDS: { id: ConditionRow['field']; label: string; sentenceLabel: string; unit: string }[] = [
  { id: 'anzahl_gaeste', label: 'Anzahl Gäste', sentenceLabel: 'Anzahl der Gäste', unit: '' },
  { id: 'anzahl_mitglieder', label: 'Anzahl Mitglieder', sentenceLabel: 'Anzahl der Mitglieder', unit: '' },
  { id: 'anzahl_gesamt', label: 'Gesamtzahl Spieler', sentenceLabel: 'Gesamtzahl der Spieler', unit: '' },
  { id: 'dauer_minuten', label: 'Spieldauer (Minuten)', sentenceLabel: 'Spieldauer', unit: ' Min.' },
];

export const CONDITION_OPERATORS: { id: ConditionRow['operator']; symbol: string; label: string; sentenceLabel: string }[] = [
  { id: 'GREATER_THAN_EQUAL', symbol: '>=', label: '>= (mindestens)', sentenceLabel: 'mindestens' },
  { id: 'EQUALS', symbol: '=', label: '= (exakt)', sentenceLabel: 'exakt' },
  { id: 'LESS_THAN_EQUAL', symbol: '<=', label: '<= (höchstens)', sentenceLabel: 'höchstens' },
  { id: 'GREATER_THAN', symbol: '>', label: '> (mehr als)', sentenceLabel: 'mehr als' },
  { id: 'LESS_THAN', symbol: '<', label: '< (weniger als)', sentenceLabel: 'weniger als' },
  { id: 'NOT_EQUALS', symbol: '!=', label: '!= (ungleich)', sentenceLabel: 'ungleich' },
];

export const ACTION_TYPES: { id: RuleAction['type']; label: string; unitLabel: string }[] = [
  { id: 'PER_COURT_HOUR', label: 'Pauschal pro Platzstunde', unitLabel: 'pauschal pro Platzstunde' },
  { id: 'PER_GUEST', label: 'Pro Gast (einmalig)', unitLabel: 'pro Gast' },
  { id: 'PER_GUEST_HOUR', label: 'Pro Gast und Stunde', unitLabel: 'pro Gast und Stunde' },
  { id: 'FREE', label: 'Kostenlos (0,00 €)', unitLabel: 'kostenlos' },
];

/**
 * Returns default ClubFeeSettings based on legacy reservation rules or defaults.
 */
export function getDefaultFeeSettings(legacyRules?: any): ClubFeeSettings {
  const legacyAmount = legacyRules?.guestFeePerHour ?? 2.5;
  const legacyCents = Math.round(legacyAmount * 100);
  const legacyRateType: RuleAction['type'] =
    legacyRules?.guestBillingMode === 'per_court' ? 'PER_COURT_HOUR' : 'PER_GUEST_HOUR';

  return {
    fee_calculation_mode: 'SIMPLE',
    simple_config: {
      rate_type: legacyRateType,
      amount_cents: legacyCents,
    },
    advanced_config: {
      rules: [],
      default_rule: {
        type: legacyRateType,
        amount_cents: legacyCents,
      },
    },
  };
}

/**
 * Evaluates a single condition against a booking fee context.
 */
export function evaluateCondition(condition: ConditionRow, context: BookingFeeContext): boolean {
  if (condition.value === null || condition.value === undefined || isNaN(condition.value)) {
    return false;
  }
  const contextVal = context[condition.field];
  if (contextVal === undefined || contextVal === null) {
    return false;
  }

  const target = condition.value;

  switch (condition.operator) {
    case 'EQUALS':
      return contextVal === target;
    case 'NOT_EQUALS':
      return contextVal !== target;
    case 'GREATER_THAN_EQUAL':
      return contextVal >= target;
    case 'LESS_THAN_EQUAL':
      return contextVal <= target;
    case 'GREATER_THAN':
      return contextVal > target;
    case 'LESS_THAN':
      return contextVal < target;
    default:
      return false;
  }
}

/**
 * Evaluates whether an advanced rule matches the booking fee context.
 * Supports row-by-row / left-to-right boolean operator chains (UND / ODER).
 */
export function evaluateRule(rule: AdvancedRule, context: BookingFeeContext): boolean {
  if (!rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  // Row 1 is the base condition
  let accumulator = evaluateCondition(rule.conditions[0], context);

  // Subsequent rows are chained with their row-level operator (default 'AND')
  for (let i = 1; i < rule.conditions.length; i++) {
    const cond = rule.conditions[i];
    const condResult = evaluateCondition(cond, context);
    const op = cond.logicOperator || (rule.match_type === 'ANY' ? 'OR' : 'AND');

    if (op === 'OR') {
      accumulator = accumulator || condResult;
    } else {
      accumulator = accumulator && condResult;
    }
  }

  return accumulator;
}

/**
 * Computes total cents and formatted euro from an action and context.
 */
export function computeActionFee(action: RuleAction, context: BookingFeeContext): number {
  if (action.type === 'FREE') {
    return 0;
  }

  const hours = Math.max(0, context.dauer_minuten / 60);

  switch (action.type) {
    case 'PER_COURT_HOUR':
      return Math.round(action.amount_cents * hours);
    case 'PER_GUEST':
      return Math.round(action.amount_cents * Math.max(0, context.anzahl_gaeste));
    case 'PER_GUEST_HOUR':
      return Math.round(action.amount_cents * Math.max(0, context.anzahl_gaeste) * hours);
    default:
      return 0;
  }
}

export function getActionUnitLabel(actionType: RuleAction['type']): string {
  const item = ACTION_TYPES.find((a) => a.id === actionType);
  return item ? item.unitLabel : 'Gebühr';
}

/**
 * Main Pure Dynamic Evaluation Engine
 * Calculates the booking fee transparently for Simple or Advanced modes.
 */
export function calculateBookingFee(
  context: BookingFeeContext,
  clubFeeSettings?: ClubFeeSettings,
  legacyReservationRules?: any
): BookingFeeCalculationResult {
  const effectiveSettings = clubFeeSettings || getDefaultFeeSettings(legacyReservationRules);
  const mode: FeeCalculationMode = effectiveSettings.fee_calculation_mode || 'SIMPLE';

  // 1. SIMPLE MODE
  if (mode === 'SIMPLE') {
    // If no guests in simple mode, no guest fee applies
    if (context.anzahl_gaeste <= 0) {
      const freeAction: RuleAction = { type: 'FREE', amount_cents: 0 };
      return {
        action: freeAction,
        totalCents: 0,
        totalEuro: 0,
        mode: 'SIMPLE',
        ratePerUnitEuro: 0,
        unitLabel: 'kostenlos',
        description: 'Keine Gäste eingetragen (kostenfrei)',
      };
    }

    let action: RuleAction;
    if (effectiveSettings.simple_config) {
      action = {
        type: effectiveSettings.simple_config.rate_type,
        amount_cents: effectiveSettings.simple_config.amount_cents,
      };
    } else {
      const legacyAmount = legacyReservationRules?.guestFeePerHour ?? 2.5;
      const legacyCents = Math.round(legacyAmount * 100);
      const legacyType: RuleAction['type'] =
        legacyReservationRules?.guestBillingMode === 'per_court' ? 'PER_COURT_HOUR' : 'PER_GUEST_HOUR';
      action = {
        type: legacyType,
        amount_cents: legacyCents,
      };
    }

    const totalCents = computeActionFee(action, context);
    const unitLabel = getActionUnitLabel(action.type);
    const rateEuro = action.amount_cents / 100;

    return {
      action,
      totalCents,
      totalEuro: totalCents / 100,
      mode: 'SIMPLE',
      ratePerUnitEuro: rateEuro,
      unitLabel,
      description: `${rateEuro.toFixed(2).replace('.', ',')} € ${unitLabel}`,
    };
  }

  // 2. ADVANCED MODE
  const advancedConfig = effectiveSettings.advanced_config || {
    rules: [],
    default_rule: { type: 'PER_GUEST_HOUR', amount_cents: 250 },
  };

  // Sort rules by priority ASC (order index: 0, 1, 2...)
  const sortedRules = [...(advancedConfig.rules || [])].sort((a, b) => a.priority - b.priority);

  // Evaluate Top-Down / First Match Wins
  for (const rule of sortedRules) {
    if (evaluateRule(rule, context)) {
      const totalCents = computeActionFee(rule.action, context);
      const unitLabel = getActionUnitLabel(rule.action.type);
      const rateEuro = rule.action.amount_cents / 100;

      return {
        action: rule.action,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        totalCents,
        totalEuro: totalCents / 100,
        mode: 'ADVANCED',
        ratePerUnitEuro: rateEuro,
        unitLabel,
        description: `Regel "${rule.name}": ${rateEuro.toFixed(2).replace('.', ',')} € ${unitLabel}`,
      };
    }
  }

  // Standard-Regel (Greift, wenn keine obige Regel zutrifft)
  const fallbackAction = advancedConfig.default_rule || { type: 'PER_GUEST_HOUR', amount_cents: 250 };
  const fallbackTotalCents = computeActionFee(fallbackAction, context);
  const fallbackUnitLabel = getActionUnitLabel(fallbackAction.type);
  const fallbackRateEuro = fallbackAction.amount_cents / 100;

  return {
    action: fallbackAction,
    matchedRuleId: 'DEFAULT_RULE',
    matchedRuleName: 'Standard-Regel',
    totalCents: fallbackTotalCents,
    totalEuro: fallbackTotalCents / 100,
    mode: 'ADVANCED',
    ratePerUnitEuro: fallbackRateEuro,
    unitLabel: fallbackUnitLabel,
    description: `Standard-Regel: ${fallbackRateEuro.toFixed(2).replace('.', ',')} € ${fallbackUnitLabel}`,
  };
}

/**
 * Builds a BookingFeeContext from a booking, players array, and start/end time or duration.
 */
export function buildBookingFeeContext(params: {
  players: string[];
  durationMinutes?: number;
  time?: string;
  endTime?: string;
  guestCount?: number;
}): BookingFeeContext {
  const { players = [], durationMinutes, time, endTime, guestCount } = params;

  let calculatedGuests = 0;
  let calculatedMembers = 0;

  players.forEach((p) => {
    const trimmed = (p || '').trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.includes('gast') || trimmed.includes('guest')) {
      calculatedGuests++;
    } else {
      calculatedMembers++;
    }
  });

  // If explicit guestCount was supplied and is higher, respect it
  const finalGuests = Math.max(calculatedGuests, guestCount || 0);
  const totalPlayers = Math.max(players.length, finalGuests + calculatedMembers);

  let finalDurationMinutes = 60; // default 60 min
  if (typeof durationMinutes === 'number' && durationMinutes > 0) {
    finalDurationMinutes = durationMinutes;
  } else if (time && endTime) {
    const [startH, startM] = time.split(':').map((n) => parseInt(n) || 0);
    const [endH, endM] = endTime.split(':').map((n) => parseInt(n) || 0);
    const diff = endH * 60 + endM - (startH * 60 + startM);
    if (diff > 0) {
      finalDurationMinutes = diff;
    }
  }

  return {
    anzahl_gaeste: finalGuests,
    anzahl_mitglieder: Math.max(0, totalPlayers - finalGuests),
    anzahl_gesamt: totalPlayers,
    dauer_minuten: finalDurationMinutes,
  };
}

/**
 * Formats a RuleAction into a German action sentence snippet.
 */
export function describeAction(action: RuleAction): string {
  if (action.type === 'FREE') {
    return 'ist die Buchung kostenlos';
  }
  const euro = (action.amount_cents / 100).toFixed(2).replace('.', ',');
  switch (action.type) {
    case 'PER_COURT_HOUR':
      return `berechne ${euro} € pauschal pro Platzstunde`;
    case 'PER_GUEST':
      return `berechne ${euro} € pro Gast`;
    case 'PER_GUEST_HOUR':
      return `berechne ${euro} € pro Gast und Stunde`;
    default:
      return `berechne ${euro} €`;
  }
}

/**
 * Generates the Workday-style live business sentence preview in natural German.
 * Example: "WENN Anzahl der Gäste mindestens 1 UND Spieldauer höchstens 60 Min., DANN berechne 12,00 € pauschal pro Platzstunde."
 */
export function generateRuleSentence(rule: AdvancedRule): string {
  if (!rule.conditions || rule.conditions.length === 0) {
    return `WENN keine Bedingungen definiert sind, DANN ${describeAction(rule.action)}.`;
  }

  let text = 'WENN ';
  rule.conditions.forEach((c, idx) => {
    const fieldItem = CONDITION_FIELDS.find((f) => f.id === c.field);
    const opItem = CONDITION_OPERATORS.find((o) => o.id === c.operator);

    const fieldLabel = fieldItem ? fieldItem.sentenceLabel : c.field;
    const opLabel = opItem ? opItem.sentenceLabel : c.operator;
    const valStr = c.value !== null && c.value !== undefined && !isNaN(c.value) ? c.value : '___';
    const unit = c.field === 'dauer_minuten' ? ' Min.' : '';

    const condPhrase = `${fieldLabel} ${opLabel} ${valStr}${unit}`;

    if (idx === 0) {
      text += condPhrase;
    } else {
      const op = c.logicOperator || (rule.match_type === 'ANY' ? 'OR' : 'AND');
      const opWord = op === 'OR' ? ' ODER ' : ' UND ';
      text += opWord + condPhrase;
    }
  });

  return `${text}, DANN ${describeAction(rule.action)}.`;
}

/**
 * Validates ClubFeeSettings against strict guardrails.
 * Returns valid status and error map.
 */
export function validateFeeSettings(settings: ClubFeeSettings): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!settings) {
    return { isValid: false, errors: { global: 'Keine Einstellungen vorhanden.' } };
  }

  if (settings.fee_calculation_mode === 'SIMPLE') {
    if (settings.simple_config) {
      if (settings.simple_config.amount_cents === null || isNaN(settings.simple_config.amount_cents) || settings.simple_config.amount_cents < 0) {
        errors['simple_amount'] = 'Bitte einen gültigen Betrag ab 0,00 € angeben.';
      }
      if (!settings.simple_config.rate_type) {
        errors['simple_rate_type'] = 'Bitte ein Abrechnungsmodell auswählen.';
      }
    }
  } else if (settings.fee_calculation_mode === 'ADVANCED') {
    const advanced = settings.advanced_config;
    if (!advanced) {
      errors['advanced_config'] = 'Erweiterte Konfiguration fehlt.';
      return { isValid: false, errors };
    }

    // Validate default rule (Standard-Regel)
    if (!advanced.default_rule) {
      errors['default_rule'] = 'Die Standard-Regel ist erforderlich.';
    } else {
      if (advanced.default_rule.type !== 'FREE') {
        if (
          advanced.default_rule.amount_cents === null ||
          isNaN(advanced.default_rule.amount_cents) ||
          advanced.default_rule.amount_cents < 0
        ) {
          errors['default_rule_amount'] = 'Bitte einen gültigen Betrag ab 0,00 € für die Standard-Regel angeben.';
        }
      }
    }

    // Validate each rule
    const rules = advanced.rules || [];
    rules.forEach((rule, rIdx) => {
      const rulePrefix = `rule_${rule.id || rIdx}`;
      if (!rule.name || rule.name.trim() === '') {
        errors[`${rulePrefix}_name`] = 'Regel-Name darf nicht leer sein.';
      }

      if (!rule.conditions || rule.conditions.length === 0) {
        errors[`${rulePrefix}_conditions`] = 'Mindestens eine Bedingung erforderlich.';
      } else {
        rule.conditions.forEach((cond, cIdx) => {
          const condPrefix = `${rulePrefix}_cond_${cond.id || cIdx}`;
          if (!cond.field) {
            errors[`${condPrefix}_field`] = 'Bitte ein Feld auswählen.';
          }
          if (!cond.operator) {
            errors[`${condPrefix}_operator`] = 'Bitte einen Operator auswählen.';
          }
          if (cond.value === null || cond.value === undefined || isNaN(cond.value) || cond.value < 0) {
            errors[`${condPrefix}_value`] = 'Bitte einen gültigen numerischen Wert (≥ 0) eingeben.';
          }
        });
      }

      // Validate action
      if (!rule.action) {
        errors[`${rulePrefix}_action`] = 'Bitte eine Aktion festlegen.';
      } else if (rule.action.type !== 'FREE') {
        if (rule.action.amount_cents === null || isNaN(rule.action.amount_cents) || rule.action.amount_cents < 0) {
          errors[`${rulePrefix}_amount`] = 'Bitte einen gültigen Betrag ab 0,00 € angeben.';
        }
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
