// 60 players on the waitlist: each joins the 100/200 list from the app, then watches their
// position as the floor would see it refresh.
import { check, sleep } from 'k6';
import { idempotencyKey, phoneFor, read, rpc, signIn } from './lib/rivr.js';

export const options = {
  scenarios: {
    waitlist: { executor: 'per-vu-iterations', vus: 60, iterations: 1, maxDuration: '5m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:join_waitlist}': ['p(95)<800'],
    'http_req_duration{name:waitlist_entry}': ['p(95)<500'],
  },
};

export default function () {
  const token = signIn(phoneFor(__VU));
  const joined = rpc('join_waitlist', { p_venue: __ENV.VENUE_ID, p_stake: '100/200', p_game: 'nlh', p_idempotency_key: idempotencyKey() }, token);
  check(joined, { 'joined the waitlist': (response) => response.status === 200 });
  for (let poll = 0; poll < 20; poll += 1) {
    check(read('waitlist_entry?select=id,status', token), { 'position read': (response) => response.status === 200 });
    sleep(5);
  }
}
