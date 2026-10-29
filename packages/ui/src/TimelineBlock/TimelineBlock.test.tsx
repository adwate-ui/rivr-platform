import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TimelineBlock } from './TimelineBlock.tsx';

const ITEMS = [{ when: '1996', title: 'The predominance test', text: 'Skill over chance.' }, { when: '2026', title: 'RIVR opens' }];

describe('TimelineBlock', () => {
  it('lists each moment in order, when beside what', () => {
    renderIn(<TimelineBlock heading="On the record" items={ITEMS} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1996The predominance testSkill over chance.');
  });

  it('links a moment to where to read more, such as the judgment', () => {
    renderIn(<TimelineBlock items={[{ when: '1996', title: 'The predominance test', link: { label: 'Read the judgment', href: 'https://indiankanoon.org/doc/1248365/' } }]} />);
    expect(screen.getByRole('link', { name: 'Read the judgment: The predominance test' })).toHaveAttribute('href', 'https://indiankanoon.org/doc/1248365/');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TimelineBlock heading="On the record" items={[...ITEMS, { when: '2013', title: 'Poker', link: { label: 'Read the judgment', href: 'https://indiankanoon.org/doc/28000869/' } }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
