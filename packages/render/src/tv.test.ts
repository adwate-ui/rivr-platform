import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { renderToPng } from './render.ts';
import type { TemplateName, TemplateProps } from './templates/index.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';
import { CLOCK } from './test/tv.ts';

const { width, height } = tokens.viewport.tv;

// Each TV layout (#64) is drawn at 1920 by 1080 and compared with its baseline; after a deliberate
// design change, RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test -- tv rewrites them.
async function expectDrawn<Name extends TemplateName>(template: Name, props: TemplateProps<Name>, baseline: string) {
  const png = await renderToPng({ template, props, width, height });
  expect(pngSize(png)).toEqual({ chunk: 'IHDR', width, height });
  expect(await differenceFromBaseline(png, `tv-${baseline}`)).toBeLessThanOrEqual(allowedDifference(width, height));
}

describe('TV slides', () => {
  it('draws the waitlist board: each stake with its places, and a stake nobody waits for', async () => {
    const stakes = [
      { id: 'a', stake: 'NLH 50/100', detail: '1 table open', places: [] },
      {
        id: 'b', stake: 'NLH 100/200', detail: '2 tables open',
        places: [
          { id: '1', place: '1', name: 'Kabir S.', status: 'Called to Table 3' },
          { id: '2', place: '2', name: 'Naina K.' },
          { id: '3', place: '3', name: 'Rohan B.', status: 'Away' },
        ],
      },
    ];
    await expectDrawn('tv.waitlist', { stakes }, 'waitlist');
  });

  it('draws the jackpot with tonight\'s high hand', async () => {
    const highHand = { title: 'Four of a kind, Queens', line: 'Table 2 · 22:18 · ₹2,000' };
    await expectDrawn('tv.badBeatJackpot', { amountPaise: 34_260_000n, highHand }, 'jackpot-high-hand');
  });

  it('draws the tournament clock: level, time left, blinds, the field and the payouts', async () => {
    await expectDrawn('tv.tournamentClock', CLOCK, 'tournament-clock');
  });

  it('draws a promotion slide with its place in the rotation', async () => {
    const props = { title: 'High hands', detail: 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', when: 'Every night',
      position: { current: 2, count: 3 } };
    await expectDrawn('tv.promotion', props, 'promotion');
  });
});
