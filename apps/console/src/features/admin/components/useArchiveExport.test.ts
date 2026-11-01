import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Archive } from './archive.ts';
import { useArchiveExport } from './useArchiveExport.ts';

const { complete, makeArchive } = vi.hoisted(() => ({ complete: vi.fn(), makeArchive: vi.fn() }));
vi.mock('@rivr/db/exports', () => ({ useArchiveSource: () => ({ complete }), archiveFailureOf: () => 'unavailable' }));
vi.mock('./archive.ts', () => ({ makeArchive }));
vi.mock('@rivr/ui', () => ({ saveFile: vi.fn() }));

const ARCHIVE: Archive = { archiveId: 'a1', file: new Uint8Array([1, 2, 3]), rows: 10, tables: 2, files: 0, unread: [] };

describe('useArchiveExport', () => {
  it('says a saved archive the database did not record is unrecorded, and records it again without making it again (F1-27)', async () => {
    makeArchive.mockResolvedValue(ARCHIVE);
    complete.mockRejectedValueOnce(new Error('the answer was lost')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useArchiveExport('v1'));
    await act(() => result.current.run({ memberId: null, memberNumber: null }, null));
    expect(result.current.state.status).toBe('unrecorded');
    await act(() => result.current.recordAgain());
    expect(result.current.state.status).toBe('done');
    expect(makeArchive).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
