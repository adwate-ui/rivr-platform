import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Archive } from './archive.ts';
import { ArchiveStatus } from './ArchiveStatus.tsx';

afterEach(cleanup);

const ARCHIVE: Archive = { archiveId: 'a1', file: new Uint8Array([1, 2, 3]), rows: 10, tables: 2, files: 0, unread: [] };

describe('ArchiveStatus', () => {
  it('says an archive saved but not recorded cannot be followed by a purge yet, with Record again (F1-27)', () => {
    const onRecordAgain = vi.fn();
    render(<ArchiveStatus state={{ status: 'unrecorded', archive: ARCHIVE, fileName: 'rivr-archive-2026-11-01.zip.age' }} onRecordAgain={onRecordAgain} />);
    expect(screen.getByRole('alert').textContent).toContain('Saved as rivr-archive-2026-11-01.zip.age, but not recorded, so a purge cannot follow it yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Record again' }));
    expect(onRecordAgain).toHaveBeenCalledOnce();
  });
});
