import {
  calculateBookingFee,
  generateRuleSentence,
  buildBookingFeeContext,
  validateFeeSettings,
} from './guestFeeCalculator';
import { ClubFeeSettings, BookingFeeContext, AdvancedRule } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

console.log('=== TEST 1: Legacy Simple Mode Fallback ===');
const legacyRules = {
  guestFeePerHour: 3.5,
  guestBillingMode: 'per_player',
};
const ctxSimple1: BookingFeeContext = {
  anzahl_gaeste: 2,
  anzahl_mitglieder: 1,
  anzahl_gesamt: 3,
  dauer_minuten: 60,
};
const res1 = calculateBookingFee(ctxSimple1, undefined, legacyRules);
assert(res1.mode === 'SIMPLE', 'Uses SIMPLE mode when settings undefined');
assert(res1.totalEuro === 7.0, `Expected 7.00 €, got ${res1.totalEuro} € (2 guests * 3.50 * 1h)`);

console.log('\n=== TEST 2: Simple Mode Zero Guests ===');
const ctxZeroGuests: BookingFeeContext = {
  anzahl_gaeste: 0,
  anzahl_mitglieder: 2,
  anzahl_gesamt: 2,
  dauer_minuten: 90,
};
const resZero = calculateBookingFee(ctxZeroGuests, undefined, legacyRules);
assert(resZero.totalEuro === 0, 'Zero guests result in 0 € in simple mode');
assert(resZero.action.type === 'FREE', 'Action is FREE when 0 guests');

console.log('\n=== TEST 3: Advanced Mode Top-Down Priority Evaluation ===');
const rule1Priority0: AdvancedRule = {
  id: 'rule-single-guest-single-match',
  name: 'Einzel mit 1 Gast',
  priority: 0,
  match_type: 'ALL',
  conditions: [
    { id: 'c1', field: 'anzahl_gaeste', operator: 'EQUALS', value: 1 },
    { id: 'c2', field: 'anzahl_gesamt', operator: 'EQUALS', value: 2 },
  ],
  action: {
    type: 'PER_COURT_HOUR',
    amount_cents: 1000, // 10,00 € per court hour
  },
};

const rule2Priority1: AdvancedRule = {
  id: 'rule-two-guests',
  name: 'Doppel mit 2 Gästen',
  priority: 1,
  match_type: 'ALL',
  conditions: [
    { id: 'c3', field: 'anzahl_gaeste', operator: 'GREATER_THAN_EQUAL', value: 2 },
  ],
  action: {
    type: 'PER_GUEST',
    amount_cents: 600, // 6,00 € flat per guest
  },
};

const advancedSettings: ClubFeeSettings = {
  fee_calculation_mode: 'ADVANCED',
  advanced_config: {
    rules: [rule2Priority1, rule1Priority0], // intentionally unordered to test priority sort
    default_rule: {
      type: 'PER_GUEST_HOUR',
      amount_cents: 400, // 4,00 € fallback
    },
  },
};

// Context matches Rule 1: 1 guest, total 2 players, 90 minutes
const ctxSingle: BookingFeeContext = {
  anzahl_gaeste: 1,
  anzahl_mitglieder: 1,
  anzahl_gesamt: 2,
  dauer_minuten: 90,
};
const resAdv1 = calculateBookingFee(ctxSingle, advancedSettings);
assert(resAdv1.matchedRuleId === 'rule-single-guest-single-match', 'Priority 0 matches first');
assert(resAdv1.totalEuro === 15.0, `Expected 15.00 € (10.00 * 1.5h), got ${resAdv1.totalEuro} €`);

// Context matches Rule 2: 2 guests, total 4 players, 60 minutes
const ctxDouble: BookingFeeContext = {
  anzahl_gaeste: 2,
  anzahl_mitglieder: 2,
  anzahl_gesamt: 4,
  dauer_minuten: 60,
};
const resAdv2 = calculateBookingFee(ctxDouble, advancedSettings);
assert(resAdv2.matchedRuleId === 'rule-two-guests', 'Rule 2 matches');
assert(resAdv2.totalEuro === 12.0, `Expected 12.00 € (2 guests * 6.00 €), got ${resAdv2.totalEuro} €`);

console.log('\n=== TEST 4: Default Fallback Rule When No Rules Match ===');
// Context: 0 guests or condition that doesn't match above (e.g. 1 guest, 3 total players)
const ctxNoMatch: BookingFeeContext = {
  anzahl_gaeste: 1,
  anzahl_mitglieder: 2,
  anzahl_gesamt: 3,
  dauer_minuten: 60,
};
const resFallback = calculateBookingFee(ctxNoMatch, advancedSettings);
assert(resFallback.matchedRuleId === 'DEFAULT_RULE', 'Falls back to DEFAULT_RULE');
assert(resFallback.totalEuro === 4.0, `Expected 4.00 € (1 guest * 4.00 * 1h), got ${resFallback.totalEuro} €`);

console.log('\n=== TEST 5: Workday-style Business Sentence Preview ===');
const sentenceRule: AdvancedRule = {
  id: 'sentence-test',
  name: 'Gast mit 3 Spielern',
  priority: 0,
  match_type: 'ALL',
  conditions: [
    { id: 'c1', field: 'anzahl_gaeste', operator: 'GREATER_THAN_EQUAL', value: 1 },
    { id: 'c2', field: 'anzahl_gesamt', operator: 'EQUALS', value: 3 },
  ],
  action: {
    type: 'PER_COURT_HOUR',
    amount_cents: 1200,
  },
};
const sentence = generateRuleSentence(sentenceRule);
console.log(`Generated Sentence:\n"${sentence}"`);
assert(
  sentence === 'WENN Anzahl der Gäste mindestens 1 UND Gesamtzahl der Spieler exakt 3, DANN berechne 12,00 € pauschal pro Platzstunde.',
  'Generated German sentence matches specification exact requirement'
);

console.log('\n=== TEST 6: Validation Guardrails ===');
const invalidSettings: ClubFeeSettings = {
  fee_calculation_mode: 'ADVANCED',
  advanced_config: {
    rules: [
      {
        id: 'r-bad',
        name: '', // Empty name
        priority: 0,
        match_type: 'ALL',
        conditions: [
          { id: 'c-bad', field: 'anzahl_gaeste', operator: 'EQUALS', value: null }, // null value
        ],
        action: { type: 'PER_GUEST', amount_cents: 500 },
      },
    ],
    default_rule: { type: 'PER_GUEST', amount_cents: -50 }, // negative amount
  },
};
const validationResult = validateFeeSettings(invalidSettings);
assert(!validationResult.isValid, 'Validation correctly flags invalid configuration');
assert(Boolean(validationResult.errors['rule_r-bad_name']), 'Flags empty rule name');
assert(Boolean(validationResult.errors['rule_r-bad_cond_c-bad_value']), 'Flags null condition value');
assert(Boolean(validationResult.errors['default_rule_amount']), 'Flags negative default rule amount');

console.log('\nALL 6 TEST SUITES PASSED SUCCESSFULLY!\n');
