import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { RulesBlock } from './RulesBlock.tsx';

const RULES = ['One player to a hand.', 'English at the table while a hand is on.'];

describe('RulesBlock', () => {
  it('shows its heading and the rules as a numbered list, in order', () => {
    renderIn(<RulesBlock heading="House rules" rules={RULES} />);
    expect(screen.getByRole('heading', { level: 2, name: 'House rules' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(RULES);
    expect(screen.getByRole('list').tagName).toBe('OL');
  });

  it('has no heading when it has none', () => {
    renderIn(<RulesBlock rules={RULES} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<RulesBlock heading="House rules" rules={RULES} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
