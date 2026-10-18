// Six dealer tablets, each logging a hand every 90 seconds for half an hour. Each virtual user is
// a tablet signed in as its device account (LOAD_PHONES holds the six tablets' test numbers).
import { check } from 'k6';
import { idempotencyKey, phoneFor, rpc, signIn } from './lib/rivr.js';

export const options = {
  scenarios: {
    tablets: { executor: 'constant-arrival-rate', rate: 6, timeUnit: '90s', duration: '30m', preAllocatedVUs: 6 },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:log_hand}': ['p(95)<800'],
  },
};

const tokens = {};

export default function () {
  tokens[__VU] = tokens[__VU] || signIn(phoneFor(__VU));
  // Pots are multiples of ₹50, in paise, between ₹2,000 and ₹1,50,000.
  const pot = String(5000 * (40 + Math.floor(Math.random() * 2960)));
  const logged = rpc('log_hand', { p_table: __ENV[`TABLE_${__VU}`], p_pot: pot, p_variant: 'holdem', p_idempotency_key: idempotencyKey() }, tokens[__VU]);
  check(logged, { 'hand logged': (response) => response.status === 200 });
}
