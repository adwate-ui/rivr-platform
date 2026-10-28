import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DrillTable } from './DrillTable.tsx';

const SEATS = [
  { plate: 'Villain 1 · CO', state: 'in_pot' as const, bet: '2.5 BB' },
  { plate: 'You · BTN', state: 'hero' as const, bet: null },
  { plate: 'SB', state: 'folded' as const, bet: null },
];

describe('DrillTable', () => {
  it('draws every seat, the bets, the board, the pot and the hero\'s cards, hidden from screen readers', () => {
    const { container } = renderIn(<DrillTable seats={SEATS} board={['K♦', '7♣', '2♥']} hole={['A♠', 'Q♦']} pot="Pot 6 BB" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    const texts = [...container.querySelectorAll('text')].map((text) => text.textContent);
    expect(texts).toEqual(expect.arrayContaining(['Villain 1 · CO', 'You · BTN', 'SB', '2.5 BB', 'K♦', '7♣', '2♥', 'A♠', 'Q♦', 'Pot 6 BB']));
  });

  it('dims a folded seat, and puts the hero at the bottom', () => {
    const { container } = renderIn(<DrillTable seats={SEATS} board={[]} hole={['A♠', 'Q♦']} pot={null} />);
    const groups = [...container.querySelectorAll('svg > g')];
    expect(groups.some((group) => group.getAttribute('class') === 'opacity-muted' && group.textContent === 'SB')).toBe(true);
    const plates = [...container.querySelectorAll('rect')].filter((rect) => rect.getAttribute('width') === '76');
    const heroY = Number(plates[1]?.getAttribute('y'));
    expect(plates.every((plate) => Number(plate.getAttribute('y')) <= heroY)).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<DrillTable seats={SEATS} board={[]} hole={['A♠', 'Q♦']} pot="Pot 4 BB" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
