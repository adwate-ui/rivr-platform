import { Stack } from '@rivr/ui';
import { SourceTable } from './SourceTable.tsx';
import { SourceUpload } from './SourceUpload.tsx';

/**
 * Learn content (#131; decision 0016): the venue's licensed encodings and their licences, and adding one once it passes the
 * drill engine's checks. The staff's tool alone: Learn stays off for members at launch (decision 0284).
 */
export function LearnTab({ venueId }: { venueId: string }) {
  return (
    <Stack gap={8}>
      <SourceTable venueId={venueId} />
      <SourceUpload venueId={venueId} />
    </Stack>
  );
}
