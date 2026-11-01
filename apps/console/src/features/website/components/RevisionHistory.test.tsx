import type { SiteRevision } from '@rivr/db/siteEditor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevisionHistory } from './RevisionHistory.tsx';

afterEach(cleanup);

const REPLACED: SiteRevision = {
  revisionId: 'r1', status: 'replaced', blocks: [], publishAt: null, publishedAt: '2026-10-30T10:00:00Z', createdAt: '2026-10-30T09:00:00Z', previewToken: 'x',
};

describe('RevisionHistory', () => {
  it('publishes an earlier version again only on the second press, as it goes live at once', () => {
    const onRestore = vi.fn();
    render(<RevisionHistory revisions={[REPLACED]} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole('button', { name: /^Publish the version of / }));
    expect(onRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, publish it now' }));
    expect(onRestore).toHaveBeenCalledWith(REPLACED);
  });
});
