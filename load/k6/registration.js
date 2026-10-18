// A 100-entry tournament registration burst: 100 members register from the app within about
// ten seconds of registration opening.
import { check } from 'k6';
import { idempotencyKey, phoneFor, rpc, signIn } from './lib/rivr.js';

export const options = {
  scenarios: {
    burst: { executor: 'per-vu-iterations', vus: 100, iterations: 1, maxDuration: '2m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:register_tournament_entry}': ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const token = signIn(phoneFor(__VU));
  const entered = rpc('register_tournament_entry', { p_tournament: __ENV.TOURNAMENT_ID, p_method: 'wallet', p_idempotency_key: idempotencyKey() }, token);
  check(entered, { registered: (response) => response.status === 200 });
}
