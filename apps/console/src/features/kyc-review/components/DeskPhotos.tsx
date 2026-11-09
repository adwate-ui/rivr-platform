import { shrinkPhoto, toBase64, type KycDocumentKind } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { AADHAAR_FRONT_COVERS, Button, CameraCapture, DocumentCamera, Inline, KycPhoto, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** A photo the desk takes: the member's face, or one of their cards (decision 0573). */
export type DeskPhotoKind = 'face' | KycDocumentKind;

/** A photo as it is sent, and as staff see it. */
export interface DeskPhoto {
  jpeg: Blob;
  preview: string;
}

/**
 * The photo the camera took, ready to send and to show; null for one the browser cannot read. The face is made small, as
 * for the app's selfie; a card stays as the card camera made it, or its characters could not be read later.
 */
async function readyPhoto(kind: DeskPhotoKind, taken: Blob): Promise<DeskPhoto | null> {
  const jpeg = kind === 'face' ? await shrinkPhoto(taken).catch(() => null) : taken;
  return jpeg === null ? null : { jpeg, preview: `data:image/jpeg;base64,${await toBase64(jpeg)}` };
}

/**
 * The photos of one check and the one being taken. Each photo kept opens the camera for the next still missing, so the
 * desk goes straight through; a photo taken again goes back to the form when the others are there.
 */
export function useDeskPhotos(kinds: readonly DeskPhotoKind[], onProblem: (problem: MessageKey | null) => void) {
  const [photos, setPhotos] = useState<Partial<Record<DeskPhotoKind, DeskPhoto>>>({});
  const [taking, setTaking] = useState<DeskPhotoKind | null>(null);
  const keep = async (kind: DeskPhotoKind, taken: Blob) => {
    const ready = await readyPhoto(kind, taken);
    if (ready === null) {
      setTaking(null);
      onProblem('console.kycInPersonFailures.noPhoto');
      return;
    }
    const kept = { ...photos, [kind]: ready };
    setPhotos(kept);
    onProblem(null);
    setTaking(kinds.find((other) => kept[other] === undefined) ?? null);
  };
  return { photos, taking, take: setTaking, cancel: () => setTaking(null), keep };
}

interface DeskCameraProps {
  kind: DeskPhotoKind;
  place: number;
  total: number;
  onPhoto: (photo: Blob) => void;
  onCancel: () => void;
}

/** The camera for one photo, in the form's place until it is kept. Never a file: the card is in the hand of the person taking it. */
export function DeskCamera({ kind, place, total, onPhoto, onCancel }: DeskCameraProps) {
  const phoneUrl = window.location.href;
  return (
    <Stack gap={3}>
      <Text variant="secondary" tone="muted">{t('console.kycInPerson.photoStep', { place, total })}</Text>
      {kind === 'face' ? <CameraCapture facing="environment" phoneUrl={phoneUrl} onPhoto={onPhoto} /> : (
        <DocumentCamera
          key={kind}
          label={t(`console.kycInPerson.document.${kind}`)}
          covers={kind === 'aadhaar_front' ? AADHAAR_FRONT_COVERS : undefined}
          coverConfirm={kind === 'aadhaar_front' ? t('console.kycInPerson.coverConfirm') : undefined}
          phoneUrl={phoneUrl}
          onPhoto={onPhoto}
        />
      )}
      <Button variant="text" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
    </Stack>
  );
}

interface DeskDocumentProps {
  kind: KycDocumentKind;
  name: string;
  photo?: DeskPhoto | undefined;
  /** Why a super admin sent it back, when they did. */
  reason?: string | undefined;
  onTake: () => void;
}

/** One card to photograph: its name, the way to take it, why it came back if it did, and the photo once kept. */
export function DeskDocument({ kind, name, photo, reason, onTake }: DeskDocumentProps) {
  const document = t(`console.kycInPerson.document.${kind}`);
  return (
    <Stack gap={2}>
      <Inline gap={3} align="center" justify="between">
        <Text weight="medium">{document}</Text>
        <Button variant="subtle" size="small" onClick={onTake}
          aria-label={t(photo === undefined ? 'console.kycInPerson.takeDocumentName' : 'console.kycInPerson.retakeDocumentName', { document })}>
          {t(photo === undefined ? 'console.kycInPerson.takeDocument' : 'console.kycInPerson.retakeDocument')}
        </Button>
      </Inline>
      {reason === undefined ? null : <Text variant="secondary" tone="muted">{t('console.kycInPerson.sentBackReason', { reason })}</Text>}
      {photo === undefined ? null : <KycPhoto shape="card" alt={t('console.kycInPerson.documentOf', { document, name })} src={photo.preview} />}
    </Stack>
  );
}
