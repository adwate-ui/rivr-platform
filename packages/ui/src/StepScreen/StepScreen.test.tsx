import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
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

  it('puts the action after the content, in a footer', () => {
    renderStep();
    expect(screen.getByRole('contentinfo')).toContainElement(screen.getByRole('button', { name: 'Verify' }));
  });

  it('goes back from Back, which comes first in focus order', async () => {
    const onBack = vi.fn();
    renderStep(onBack);
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
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('main')).toHaveClass('items-center', 'justify-center');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep();
    expect(await axeViolations(container)).toEqual([]);
  });
});
