import type { RewardItem } from '@rivr/db';
import { Box, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { CatalogueList } from './CatalogueList.tsx';
import { RewardForm } from './RewardForm.tsx';

/** The reward open in the form: a new one, the one chosen to change, or none. */
export type Editing = 'none' | 'new' | RewardItem;

interface CatalogueTabProps {
  readonly venueId: string;
  /** rewards.manage: the form, and Edit on each reward. */
  readonly canKeep: boolean;
  readonly editing: Editing;
  readonly onEdit: (editing: Editing) => void;
}

/**
 * The catalogue (console v3): the form above the list while a reward is added or changed, opened by New reward beside the
 * heading or a reward's Edit; then every reward, live first and cheapest first.
 */
export function CatalogueTab({ venueId, canKeep, editing, onEdit }: CatalogueTabProps) {
  // Kept here: a change saved closes its form, so the form's own words would go with it (F2-23).
  const [saved, setSaved] = useState<string | null>(null);
  const edit = (next: Editing) => { onEdit(next); setSaved(null); };
  const item = editing === 'none' || editing === 'new' ? null : editing;
  return (
    <Stack gap={6}>
      {canKeep && editing !== 'none' ? (
        <Box surface="raised" radius="md" padding={5}>
          <RewardForm key={item?.id ?? 'new'} venueId={venueId} item={item} onCancel={() => edit('none')}
            onOutcome={(text) => { setSaved(text); if (text !== null) onEdit('none'); }} />
        </Box>
      ) : null}
      <StatusMessage>{saved}</StatusMessage>
      <CatalogueList venueId={venueId} canEdit={canKeep} onEdit={edit} />
    </Stack>
  );
}
