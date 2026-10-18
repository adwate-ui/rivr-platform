import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useT } from './react.tsx';

function RetryLabel() {
  const t = useT();
  return <>{t('common.retry')}</>;
}

describe('useT', () => {
  it('gives a component its copy, with no provider needed', () => {
    render(<RetryLabel />);
    expect(screen.getByText('Try again')).toBeDefined();
  });
});
