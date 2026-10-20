import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Money } from './Money.tsx';

describe('Money', () => {
  it('formats paise as rupees with Indian grouping and tabular figures', () => {
    renderIn(<Money paise={12_000_000n} />);
    expect(screen.getByText('₹1,20,000')).toHaveClass('tabular-nums', 'whitespace-nowrap', 'text-content');
  });

  it('shows player money in gold', () => {
    renderIn(<Money paise={400_000n} tone="player" />);
    expect(screen.getByText('₹4,000')).toHaveClass('text-money');
  });

  it('sets the jackpot figure large in the display face', () => {
    renderIn(<Money paise={34_260_000n} size="jackpot" />);
    expect(screen.getByText('₹3,42,600')).toHaveClass('font-display', 'text-96');
  });

  it('writes negatives with a minus sign and shows paise only when present', () => {
    renderIn(
      <>
        <Money paise={-100_000n} />
        <Money paise={12_000_050n} />
      </>,
    );
    expect(screen.getByText('−₹1,000')).toBeInTheDocument();
    expect(screen.getByText('₹1,20,000.50')).toBeInTheDocument();
  });

  it('writes a gain with a plus sign when signed, and nothing or a loss as ever', () => {
    renderIn(
      <>
        <Money paise={4_650_000n} signed />
        <Money paise={-2_000_000n} signed />
        <Money paise={0n} signed />
      </>,
    );
    expect(screen.getByText('+₹46,500')).toBeInTheDocument();
    expect(screen.getByText('−₹20,000')).toBeInTheDocument();
    expect(screen.getByText('₹0')).toBeInTheDocument();
  });
});
