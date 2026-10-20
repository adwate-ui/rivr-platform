import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Text } from '../Text/Text.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DocumentPage } from './DocumentPage.tsx';

const ISSUER = { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, Gurugram', gstin: '06AAAAA0000A1Z5' };

function invoice(note?: string) {
  return (
    <DocumentPage issuer={ISSUER} title="Tax invoice" details={[{ label: 'Invoice number', value: 'RIVR/S26/41' }]} note={note}>
      <Text tone="inherit">The lines</Text>
    </DocumentPage>
  );
}

describe('DocumentPage', () => {
  it('heads with the club, its GSTIN and the title, then the details and the body', () => {
    renderIn(invoice());
    expect(screen.getByRole('heading', { level: 1, name: 'Tax invoice' })).toHaveClass('font-display');
    expect(screen.getByText('RIVR Hospitality LLP')).toBeInTheDocument();
    expect(screen.getByText('GSTIN 06AAAAA0000A1Z5')).toBeInTheDocument();
    expect(screen.getByText('Invoice number').nextElementSibling).toHaveTextContent('RIVR/S26/41');
    expect(screen.getByText('The lines')).toBeInTheDocument();
  });

  it('prints no GSTIN line for a club without one', () => {
    renderIn(
      <DocumentPage issuer={{ legalName: 'RIVR Hospitality LLP', address: 'Gurugram' }} title="Statement" details={[]}>
        <Text>Rows</Text>
      </DocumentPage>,
    );
    expect(screen.queryByText(/GSTIN/)).toBeNull();
  });

  it('fills the page in ink on cream, with the note at the foot only when given', () => {
    const { unmount } = renderIn(invoice());
    expect(screen.getByRole('article', { name: 'Tax invoice' })).toHaveClass('min-h-dvh', 'bg-cream', 'text-on-cream');
    expect(screen.getByRole('article').lastElementChild).toHaveTextContent('The lines');
    unmount();
    renderIn(invoice('Computer-generated.'));
    expect(screen.getByRole('article').lastElementChild).toHaveTextContent('Computer-generated.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(invoice('Computer-generated.'));
    expect(await axeViolations(container)).toEqual([]);
  });
});
