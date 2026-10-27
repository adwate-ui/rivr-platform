import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PromptBar } from './PromptBar.tsx';

describe('PromptBar', () => {
  it('says what waits, as an alert, with its actions in reach of the keyboard', async () => {
    const onApprove = vi.fn();
    const { container } = renderIn(
      <PromptBar message="High hand claim · Table 3, seat 4 · Straight flush · ₹10,000"
        actions={<><Button variant="secondary" onClick={onApprove}>Approve ₹10,000</Button><Button variant="text">Reject</Button></>} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('High hand claim · Table 3, seat 4 · Straight flush · ₹10,000');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onApprove).toHaveBeenCalledOnce();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows a form an action opened under the line, outside what is announced', () => {
    renderIn(<PromptBar message="High hand claim" actions={null}><p>Why it is not approved</p></PromptBar>);
    expect(screen.getByText('Why it is not approved')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/^High hand claim$/);
  });
});
