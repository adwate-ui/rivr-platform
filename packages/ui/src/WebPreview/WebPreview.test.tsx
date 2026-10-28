import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WebPreview } from './WebPreview.tsx';

afterEach(cleanup);

describe('WebPreview', () => {
  it('frames the page, named for a screen reader', () => {
    render(<WebPreview label="Preview of House rules" src="https://rivr.invalid/preview/abc" emptyText="Save a draft to preview it." />);
    expect(screen.getByTitle('Preview of House rules').getAttribute('src')).toBe('https://rivr.invalid/preview/abc');
  });

  it('says what to do while there is nothing to show', () => {
    render(<WebPreview label="Preview of House rules" src={null} emptyText="Save a draft to preview it." />);
    expect(screen.getByText('Save a draft to preview it.')).toBeDefined();
    expect(screen.queryByTitle('Preview of House rules')).toBeNull();
  });
});
