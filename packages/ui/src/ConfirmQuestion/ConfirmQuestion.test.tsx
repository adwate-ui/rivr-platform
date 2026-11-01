import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ConfirmQuestion } from './ConfirmQuestion.tsx';

const QUESTION = "Change Ayesha Thomas's role to Host?";

describe('ConfirmQuestion', () => {
  it('asks the question, then saves on Yes or turns back on Cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderIn(<ConfirmQuestion question={QUESTION} confirm="Yes, change it" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, change it' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('works from the keyboard: Tab to Yes, Enter saves; Tab to Cancel, Enter turns back', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderIn(<ConfirmQuestion question={QUESTION} confirm="Yes, change it" onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has the question read on the Yes button, and no accessibility violations', async () => {
    const { container } = renderIn(<ConfirmQuestion question={QUESTION} confirm="Yes, change it" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Yes, change it' })).toHaveAccessibleDescription(QUESTION);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('takes no press while the change is saved, Cancel neither, so it is never sent twice or seems undone', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderIn(<ConfirmQuestion question={QUESTION} confirm="Yes, change it" isBusy onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /Yes, change it|Loading/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('gives the focus back to what asked once it is answered', async () => {
    /** A switch-like button that asks, as a staff row's switch does. */
    function Asker() {
      const [isAsking, setAsking] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setAsking(true)}>Active: Ayesha Thomas</button>
          {isAsking ? <ConfirmQuestion question={QUESTION} confirm="Yes, change it" onConfirm={() => setAsking(false)} onCancel={() => setAsking(false)} /> : null}
        </>
      );
    }
    renderIn(<Asker />);
    await userEvent.click(screen.getByRole('button', { name: 'Active: Ayesha Thomas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Active: Ayesha Thomas' })).toHaveFocus();
  });
});
