import type { KycDocumentKind } from '@rivr/db';
import { t } from '@rivr/i18n';
import { AADHAAR_FRONT_COVERS, Button, CameraCapture, DocumentCamera, ErrorMessage, Heading, Inline, KycPhoto, Stack, Text } from '@rivr/ui';
import type { DeskPhoto, DeskPhotoKind, Step } from './deskSteps.ts';

/**
 * A step's name, heard and not seen (the progress bar shows it), which takes the focus as the step opens: the button that
 * brought the person here is gone, and the focus would fall to the page behind the panel.
 */
export function StepHeading({ step }: { step: Step }) {
  return <Heading level={3} isVisuallyHidden isFocusedOnMount>{t(`console.kycInPerson.steps.${step}`)}</Heading>;
}

interface DeskCameraProps {
  kind: DeskPhotoKind;
  place: number;
  total: number;
  /** Why a super admin sent this photo back, when they did. */
  reason?: string | undefined;
  /** What went wrong with the photo just taken, said under "Photo 1 of 3", beside the camera that takes it again. */
  problem?: string | undefined;
  /** The photo, once "Use photo" keeps it. */
  onPhoto: (photo: Blob) => void;
}

/**
 * The camera for one photo, on its step until the photo is kept; the step gives the way back. Never a file: the card is in
 * the hand of the person taking it.
 */
export function DeskCamera({ kind, place, total, reason, problem, onPhoto }: DeskCameraProps) {
  const phoneUrl = window.location.href;
  return (
    <Stack gap={3}>
      <Text variant="secondary" tone="muted">{t('console.kycInPerson.photoStep', { place, total })}</Text>
      {problem === undefined ? null : <ErrorMessage>{problem}</ErrorMessage>}
      {reason === undefined ? null : <Text variant="secondary" tone="muted">{t('console.kycInPerson.sentBackReason', { reason })}</Text>}
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
    </Stack>
  );
}

interface DeskDocumentProps {
  kind: KycDocumentKind;
  name: string;
  photo?: DeskPhoto | undefined;
  /** Why a super admin sent it back, when they did. */
  reason?: string | undefined;
  /** Its button is off, such as while the check is being saved. */
  isDisabled?: boolean;
  onTake: () => void;
}

/** One card to photograph: its name, the way to take it, why it came back if it did, and the photo once kept. */
export function DeskDocument({ kind, name, photo, reason, isDisabled = false, onTake }: DeskDocumentProps) {
  const document = t(`console.kycInPerson.document.${kind}`);
  return (
    <Stack gap={2}>
      <Inline gap={3} align="center" justify="between">
        <Text weight="medium">{document}</Text>
        <Button variant="subtle" size="small" isDisabled={isDisabled} onClick={onTake}
          aria-label={t(photo === undefined ? 'console.kycInPerson.takeDocumentName' : 'console.kycInPerson.retakeDocumentName', { document })}>
          {t(photo === undefined ? 'console.kycInPerson.takeDocument' : 'console.kycInPerson.retakeDocument')}
        </Button>
      </Inline>
      {reason === undefined ? null : <Text variant="secondary" tone="muted">{t('console.kycInPerson.sentBackReason', { reason })}</Text>}
      {photo === undefined ? null : <KycPhoto shape="card" alt={t('console.kycInPerson.documentOf', { document, name })} src={photo.preview} />}
    </Stack>
  );
}
