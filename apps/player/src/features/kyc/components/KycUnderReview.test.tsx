import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { KycRefused, KycUnderReview } from './KycUnderReview.tsx';

afterEach(cleanup);

function renderIn(element: React.ReactElement) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient()}>
      {element}
    </RivrDataProvider>,
  );
}

describe('Identity, held', () => {
  it('Identity › Under review: says staff finish the check, with Sign out as the way out', () => {
    renderIn(<KycUnderReview />);
    expect(screen.getByRole('heading', { level: 1, name: 'Details in review' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('Identity › Not verified: names the front desk, with Sign out', () => {
    renderIn(<KycRefused />);
    expect(screen.getByRole('heading', { level: 1, name: 'Not verified' })).toBeDefined();
    expect(screen.getByText('Bring your Aadhaar and PAN to the front desk.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });
});
