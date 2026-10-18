// 200 app users on Home: each loads what Home shows (feature access, the floor, the jackpot,
// promotions) and refreshes it every 15 seconds for ten minutes.
import { check, sleep } from 'k6';
import { phoneFor, read, rpc, signIn } from './lib/rivr.js';

export const options = {
  scenarios: {
    home: { executor: 'ramping-vus', stages: [{ duration: '1m', target: 200 }, { duration: '10m', target: 200 }, { duration: '30s', target: 0 }] },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const tokens = {};

export default function () {
  tokens[__VU] = tokens[__VU] || signIn(phoneFor(__VU));
  const token = tokens[__VU];
  check(rpc('my_feature_access', {}, token), { 'feature access': (response) => response.status === 200 });
  for (const view of ['public_table_status', 'public_waitlist_length', 'public_jackpot', 'public_promotion_cards']) {
    check(read(`${view}?select=*`, token), { [view]: (response) => response.status === 200 });
  }
  sleep(15);
}
