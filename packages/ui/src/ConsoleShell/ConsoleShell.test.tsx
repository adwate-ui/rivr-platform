import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { consoleSections } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ConsoleShell } from './ConsoleShell.tsx';

function renderShell(onNavigate = vi.fn(), locale: 'en' | 'hi' = 'en') {
  return renderIn(
    <ConsoleShell sections={consoleSections(locale)} currentItem="cage" onNavigate={onNavigate} banner={<p>Venue frozen.</p>}>
      <h1>Cage</h1>
    </ConsoleShell>,
    locale,
  );
}

describe('ConsoleShell', () => {
  it('holds the rail in a complementary landmark and the screen in main', () => {
    renderShell();
    expect(screen.getByRole('complementary')).toContainElement(screen.getByRole('navigation', { name: 'Sections' }));
    expect(screen.getByRole('main')).toHaveTextContent('Cage');
    expect(screen.getByText('Venue frozen.')).toBeInTheDocument();
  });

  it('groups the rail as the design prompt lists it and marks the current screen', () => {
    renderShell();
    for (const group of ['Floor', 'Money', 'Players', 'Growth', 'Team']) {
      expect(screen.getByRole('list', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cage' })).toHaveAttribute('aria-current', 'page');
  });

  it('routes rail links through the app', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    await userEvent.click(screen.getByRole('link', { name: 'KYC review' }));
    expect(onNavigate).toHaveBeenCalledWith('#kycReview');
  });

  it('labels the rail in Hindi', () => {
    renderShell(vi.fn(), 'hi');
    expect(screen.getByRole('navigation', { name: 'सेक्शन' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'केज' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
