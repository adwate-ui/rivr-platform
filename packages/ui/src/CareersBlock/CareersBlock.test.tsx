import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CareersBlock } from './CareersBlock.tsx';

const ROLES = [
  { title: 'Dealer', body: 'Deal hold\'em and Omaha on the night shift. We train you.' },
  { title: 'Floor supervisor', body: 'Run the waitlist and the tables on your shift.' },
];

describe('CareersBlock', () => {
  it('shows each role under its own heading, then how to apply', () => {
    renderIn(<CareersBlock heading="Careers" roles={ROLES} apply="Speak to the front desk." />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Dealer', 'Floor supervisor']);
    expect(screen.getByText('Speak to the front desk.')).toBeInTheDocument();
  });

  it('says there are no openings when there are none', () => {
    renderIn(<CareersBlock heading="Careers" roles={[]} />);
    expect(screen.getByText('No openings right now.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CareersBlock heading="Careers" roles={ROLES} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
