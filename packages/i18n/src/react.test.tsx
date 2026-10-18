import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useT } from './react.tsx';

function RetryLabel() {
  const t = useT();
  return <>{t('common.retry')}</>;
}

describe('I18nProvider', () => {
  it('translates into the locale it is given', () => {
    render(
      <I18nProvider locale="hi">
        <RetryLabel />
      </I18nProvider>,
    );
    expect(screen.getByText('फिर से कोशिश करें')).toBeDefined();
  });

  it('defaults to English without a provider', () => {
    render(<RetryLabel />);
    expect(screen.getByText('Try again')).toBeDefined();
  });
});
