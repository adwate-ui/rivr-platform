import { tokens } from '@rivr/tokens';
import type { SocialFormat } from '@rivr/ui';
import { describe, expect, it } from 'vitest';
import { renderToPng } from './render.ts';
import type { TemplateName, TemplateProps } from './templates/index.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const VENUE = 'Upper floor, Glaza, M3M 65th Avenue, Gurugram';

const FORMATS: readonly SocialFormat[] = ['feed', 'story'];

// Each card is drawn at its format's exact size and compared with its baseline; after a deliberate
// design change, RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test -- social rewrites them.
describe.each(FORMATS)('social cards, %s', (format) => {
  const { width, height } = tokens.viewport[format];

  async function expectDrawn<Name extends TemplateName>(template: Name, props: TemplateProps<Name>, baseline: string) {
    const png = await renderToPng({ template, props, width, height });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', width, height });
    expect(await differenceFromBaseline(png, `social-${baseline}-${format}`)).toBeLessThanOrEqual(allowedDifference(width, height));
  }

  it('draws the tournament poster: the guarantee, when it starts and the buy-in', async () => {
    // 19:00 IST on Sunday 15 November.
    const props = { format, name: 'RIVR Sunday', startsAt: '2026-11-15T13:30:00Z', buyInPaise: 500_000n, guaranteePaise: 50_000_000n, venue: VENUE };
    await expectDrawn('social.tournamentPoster', props, 'tournament-poster');
  });

  it('draws the promotion card, with no figure', async () => {
    await expectDrawn('social.promoCard', { format, title: 'Double points', runs: 'Thursday, 14:00 to 20:00', who: '100/200', venue: VENUE }, 'promo-card');
  });

  it('draws the winner card: who, the prize, what and when', async () => {
    const props = { format, playerName: 'Arjun M.', eventName: 'RIVR Sunday', prizePaise: 12_000_000n, wonAt: '2026-11-15T20:10:00Z', venue: VENUE };
    await expectDrawn('social.winnerCard', props, 'winner-card');
  });

  it('draws the high-hand card: the hand, the bonus, who, where and when', async () => {
    const props = { format, hand: 'Straight flush', playerName: 'Arjun M.', tableName: 'Table 3', bonusPaise: 1_000_000n, at: '2026-11-15T19:42:00Z', venue: VENUE };
    await expectDrawn('social.highHandCard', props, 'high-hand-card');
  });
});
