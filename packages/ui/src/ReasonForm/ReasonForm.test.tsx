import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ReasonForm, type ReasonFormProps } from './ReasonForm.tsx';

/** The tablets screen's revoke form; each test changes what it needs. */
function renderRevoke(props: Partial<ReasonFormProps> = {}) {
  const onRevoke = vi.fn();
  const onCancel = vi.fn();
  renderIn(
    <ReasonForm field={{ name: 'reason' }} label="Why it is revoked" actions={[{ label: 'Revoke the tablet', onClick: onRevoke }]}
      onCancel={onCancel} {...props} />,
  );
  return { onRevoke, onCancel };
}

function ControlledReason() {
  const [reason, setReason] = useState('');
  return (
    <ReasonForm field={{ value: reason, onChange: (event) => setReason(event.target.value) }} label="Why it is unpaired"
      actions={[{ label: 'Unpair the TV', onClick: () => undefined }]} />
  );
}

describe('ReasonForm', () => {
  it('asks for the reason in a required text field named by its label, never filled in by the browser', () => {
    renderRevoke();
    const field = screen.getByRole('textbox', { name: 'Why it is revoked' });
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('name', 'reason');
    expect(field).toHaveAttribute('autocomplete', 'off');
  });

  it('takes the reason typed when controlled', async () => {
    renderIn(<ControlledReason />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Why it is unpaired' }), 'Moved to the bar');
    expect(screen.getByRole('textbox', { name: 'Why it is unpaired' })).toHaveValue('Moved to the bar');
  });

  it("hands the field its ref and change handler, as React Hook Form's register gives them", async () => {
    const elements: HTMLInputElement[] = [];
    const onChange = vi.fn();
    renderRevoke({ field: { name: 'reason', onChange, ref: (element) => { if (element !== null) elements.push(element); } } });
    const field = screen.getByRole('textbox', { name: 'Why it is revoked' });
    await userEvent.type(field, 'Lost');
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(elements).toEqual([field]);
  });

  it('decides with the decision button, and closes with Cancel', async () => {
    const { onRevoke, onCancel } = renderRevoke();
    await userEvent.click(screen.getByRole('button', { name: 'Revoke the tablet' }));
    expect(onRevoke).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('offers no Cancel where the form stays open', () => {
    renderRevoke({ onCancel: undefined });
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('is filled in and decided from the keyboard: the reason, then the decision, then Cancel', async () => {
    const { onRevoke, onCancel } = renderRevoke();
    await userEvent.tab();
    expect(screen.getByRole('textbox', { name: 'Why it is revoked' })).toHaveFocus();
    await userEvent.keyboard('Lost on the floor');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Revoke the tablet' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRevoke).toHaveBeenCalledOnce();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('marks the reason invalid and reads out the error after the hint', () => {
    renderRevoke({ hint: 'In your own words.', error: 'Say why the tablet is revoked.' });
    const field = screen.getByRole('textbox', { name: 'Why it is revoked' });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('In your own words. Say why the tablet is revoked.');
  });

  it('ignores presses on the decision while it is saved', async () => {
    const { onRevoke } = renderRevoke({ isLoading: true });
    const button = screen.getByRole('button', { name: 'Loading' });
    await userEvent.click(button);
    expect(onRevoke).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('draws one decision as a danger button unless told otherwise', () => {
    renderRevoke();
    expect(screen.getByRole('button', { name: 'Revoke the tablet' })).toHaveClass('bg-alert');
  });

  it('offers each decision the reason is for, in order, in the variant given', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderRevoke({ variant: 'secondary', actions: [{ label: 'Approve', onClick: onApprove }, { label: 'Reject', onClick: onReject }], onCancel: undefined });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Approve', 'Reject']);
    expect(buttons[0]).not.toHaveClass('bg-alert');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onReject).toHaveBeenCalledOnce();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('stops the reason at the length given', () => {
    renderRevoke({ maxLength: 500 });
    expect(screen.getByRole('textbox', { name: 'Why it is revoked' })).toHaveAttribute('maxlength', '500');
  });

  it('has no accessibility violations with a hint and an error', async () => {
    renderRevoke({ hint: 'In your own words.', error: 'Say why the tablet is revoked.' });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
