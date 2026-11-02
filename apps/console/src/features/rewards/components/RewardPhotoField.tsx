import { useItemPhotoUpload, useRewardItems, type ItemPhotoFailure, type RewardItem } from '@rivr/db';
import { t } from '@rivr/i18n';
import { CameraButton, ErrorMessage, Inline, ItemPhoto, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

/**
 * A reward's photo on its form (AS-11): the one the app shows, read fresh from the catalogue so a new one shows at once,
 * and the club's own photo from this computer to add or replace it.
 */
export function RewardPhotoField({ venueId, item }: { venueId: string; item: RewardItem }) {
  const upload = useItemPhotoUpload(venueId);
  const shown = useRewardItems(venueId).data?.find((reward) => reward.id === item.id) ?? item;
  const [outcome, setOutcome] = useState<ItemPhotoFailure | 'saved' | null>(null);
  const put = async (photo: File) => {
    setOutcome(null);
    const done = await upload.mutateAsync({ kind: 'reward', itemId: item.id, photo });
    setOutcome(done.ok ? 'saved' : done.error);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} align="center">
        <ItemPhoto src={shown.photoUrl} name={shown.name} />
        <CameraButton variant="secondary" camera="none" accept="image/jpeg,image/png,image/webp" isLoading={upload.isPending}
          onPhoto={(photo) => void put(photo)}>
          {t(shown.photoUrl === null ? 'console.itemPhoto.add' : 'console.itemPhoto.replace')}
        </CameraButton>
      </Inline>
      <StatusMessage>{outcome === 'saved' ? t('console.itemPhoto.saved') : null}</StatusMessage>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{t(`console.itemPhoto.failures.${outcome}`)}</ErrorMessage> : null}
    </Stack>
  );
}
