import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { Input } from '../Input/Input.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StepScreen } from './StepScreen.tsx';

function renderStep(onBack = vi.fn()) {
  return renderIn(
    <StepScreen
      title="Code"
      back={{ label: 'Back', onBack }}
      footer={
        <Button variant="primary" fullWidth>
          Verify
        </Button>
      }
    >
      <p>Six digits</p>
    </StepScreen>,
  );
}

describe('StepScreen', () => {
  it('titles the step with a level-one heading and holds the content in main', () => {
    renderStep();
    expect(screen.getByRole('heading', { level: 1, name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Six digits');
  });

  it('puts the action in main, after the content', () => {
    renderStep();
    const action = screen.getByRole('button', { name: 'Verify' });
    expect(screen.getByRole('main')).toContainElement(action);
    expect(screen.getByText('Six digits').compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('goes back from Back, in the header and first in focus order', async () => {
    const onBack = vi.fn();
    renderStep(onBack);
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: 'Back' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('centres content without a title, as the first sign-in step does', () => {
    renderIn(
      <StepScreen align="center" footer={<Button variant="primary">Send code</Button>}>
        <p>The lockup</p>
      </StepScreen>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByText('The lockup').parentElement).toHaveClass('items-center', 'justify-center');
  });

  it('is a form when it takes onSubmit: Enter in the field or the submit button sends it', async () => {
    const onSubmit = vi.fn();
    renderIn(
      <StepScreen
        onSubmit={onSubmit}
        footer={
          <Button variant="primary" type="submit">
            Send code
          </Button>
        }
      >
        <Input label="Mobile number" />
      </StepScreen>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Mobile number' }), '9876543210{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[0]?.[0].defaultPrevented).toBe(true);
  });

  it('is not a form without onSubmit', () => {
    const { container } = renderStep();
    expect(container.querySelector('form')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('sets the redesign\'s title in the display face, between its eyebrow and subtitle (decision 0320)', () => {
    renderIn(<StepScreen title="Enter the code" look={{ subtitle: 'Sent on WhatsApp to +91 90000 00901' }} footer={null}>{null}</StepScreen>);
    expect(screen.getByRole('heading', { name: 'Enter the code' })).toHaveClass('font-display', 'text-36');
    expect(screen.getByText('Sent on WhatsApp to +91 90000 00901')).toBeDefined();
  });

  it('shows sign-up\'s bar of steps with an icon Back named for a screen reader (decision 0320)', async () => {
    const onBack = vi.fn();
    renderIn(<StepScreen title="About you" back={{ label: 'Back', onBack }} look={{ progress: { step: 1, of: 2, label: '1 of 2' } }} footer={null}>{null}</StepScreen>);
    expect(screen.getByText('1 of 2')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('sets a ruled footer\'s action 12 px under its rule, not the plain footer\'s 24 (owner, 3 Nov)', () => {
    renderIn(<StepScreen title="About you" look={{ isFooterRuled: true }} footer={<Button variant="primary">Continue</Button>}>{null}</StepScreen>);
    const footer = screen.getByRole('button', { name: 'Continue' }).parentElement;
    expect(footer).toHaveClass('border-t', 'pt-3');
    expect(footer).not.toHaveClass('pt-6');
  });
});
