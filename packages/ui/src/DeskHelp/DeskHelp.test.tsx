import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DeskHelp, DeskHelpProvider } from './DeskHelp.tsx';

const CONTACT = { phone: '+918796580435', whatsapp: '918796580435' };

describe('DeskHelp', () => {
  it('calls or messages the front desk on WhatsApp, as one group named for the desk', () => {
    renderIn(<DeskHelpProvider contact={CONTACT}><DeskHelp /></DeskHelpProvider>);
    const help = screen.getByRole('group', { name: 'Front desk' });
    expect(within(help).getByRole('link', { name: 'Call the desk' })).toHaveAttribute('href', 'tel:+918796580435');
    expect(within(help).getByRole('link', { name: 'WhatsApp the desk' })).toHaveAttribute('href', 'https://wa.me/918796580435');
  });

  it('is reached by the keyboard, call first', async () => {
    renderIn(<DeskHelpProvider contact={CONTACT}><DeskHelp /></DeskHelpProvider>);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Call the desk' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'WhatsApp the desk' })).toHaveFocus();
  });

  it('shows nothing where no number is given, as on the console', () => {
    renderIn(<DeskHelp />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<DeskHelpProvider contact={CONTACT}><DeskHelp /></DeskHelpProvider>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
