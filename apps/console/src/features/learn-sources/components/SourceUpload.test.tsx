import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SourceUpload } from './SourceUpload.tsx';

afterEach(cleanup);

describe('SourceUpload', () => {
  it('says a file the browser could not read could not be read, rather than checking it for ever (F2-30)', async () => {
    render(<SourceUpload venueId="v1" />);
    const file = new File(['{}'], 'encoding.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('NotReadableError')) });
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('That file could not be read. Choose it again, or another copy of it.')).toBeDefined();
    expect(screen.queryByText(/^Checking/)).toBeNull();
  });
});
