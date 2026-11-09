import { zodResolver } from '@hookform/resolvers/zod';
import { kycInPersonSchema } from '@rivr/contracts';
import { useKycImageUrl, useKycInPerson, type KycCandidate, type KycDocumentKind, type KycInPersonOutcome } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, KycPhoto, kycPhotoStatus, Stack, Switch } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument, useDeskPhotos, type DeskPhoto, type DeskPhotoKind } from './DeskPhotos.tsx';

// The typed details; the photos and the consent are held beside the form.
const detailsSchema = kycInPersonSchema.pick({ dateOfBirth: true, aadhaarLast4: true, pan: true });
type DetailsForm = UseFormReturn<z.input<typeof detailsSchema>, unknown, z.output<typeof detailsSchema>>;

// In the order the desk takes them (decision 0573).
const PHOTO_KINDS: readonly DeskPhotoKind[] = ['face', 'pan', 'aadhaar_front'];

/**
 * The photo being taken, and beside it the selfie the member took in the app to be checked at the club (decision 0502),
 * so staff compare the two faces; the photo alone for anyone else.
 */
function Photos({ member, photo }: { member: KycCandidate; photo: DeskPhoto | undefined }) {
  const appSelfie = useKycImageUrl(member.clubSelfiePath);
  const taken = <KycPhoto alt={t('console.kycReview.photoOf', { name: member.fullName })} src={photo?.preview ?? null} status={photo === undefined ? 'missing' : 'ready'} />;
  if (member.clubSelfiePath === null) return taken;
  return (
    <Inline gap={3} align="start">
      {taken}
      <KycPhoto alt={t('console.kycInPerson.appSelfieOf', { name: member.fullName })} src={appSelfie.data ?? null}
        status={kycPhotoStatus(member.clubSelfiePath, appSelfie)} />
    </Inline>
  );
}

interface InPersonFormProps {
  venueId: string;
  member: KycCandidate;
  /** The check went through the gate: verified, refused, or sent to review by a clash with another check. */
  onDecided: (outcome: KycInPersonOutcome) => void;
  onCancel: () => void;
}

/**
 * Checking one member in person against their original documents: photos of their face, PAN and Aadhaar front, the date of
 * birth, the last four Aadhaar digits and the PAN, and their consent, asked there. The database keeps the gate.
 */
export function InPersonForm({ venueId, member, onDecided, onCancel }: InPersonFormProps) {
  const { check } = useKycInPerson(venueId);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const desk = useDeskPhotos(PHOTO_KINDS, setProblem);
  const [resolver] = useState(() => zodResolver(detailsSchema));
  const form: DetailsForm = useForm({ resolver, defaultValues: { dateOfBirth: '', aadhaarLast4: '', pan: '' } });
  const { face, pan, aadhaar_front: aadhaar } = desk.photos;
  // A reopened check can also have a photo sent back: the desk is told why here too.
  const reasonFor = (kind: KycDocumentKind) => member.retakes.find((one) => one.kind === kind)?.reason;
  const submit = form.handleSubmit(async (details) => {
    if (face === undefined || pan === undefined || aadhaar === undefined || !consent) return setProblem('console.kycInPerson.invalid');
    // A kept Aadhaar photo has had its bars confirmed: the camera does not give one up before.
    const done = await check.mutateAsync({
      ...details, memberId: member.memberId, consent: true, coversConfirmed: true, photo: face.jpeg, panPhoto: pan.jpeg, aadhaarPhoto: aadhaar.jpeg,
    });
    return done.ok ? onDecided(done.value) : setProblem(IN_PERSON_FAILURE_COPY[done.error]);
  }, () => setProblem('console.kycInPerson.invalid'));
  if (desk.taking !== null) {
    const { taking } = desk;
    return <DeskCamera kind={taking} place={PHOTO_KINDS.indexOf(taking) + 1} total={PHOTO_KINDS.length} onPhoto={(taken) => void desk.keep(taking, taken)} onCancel={desk.cancel} />;
  }
  // The photos above the fields (console v3), so the form fits the 440 px sheet it opens in.
  return (
    <Stack gap={4}>
      <Photos member={member} photo={face} />
      <Button variant="subtle" size="compact" onClick={() => desk.take('face')}>{t(face === undefined ? 'console.kycInPerson.takePhoto' : 'console.kycInPerson.retakePhoto')}</Button>
      <DeskDocument kind="pan" name={member.fullName} photo={pan} reason={reasonFor('pan')} onTake={() => desk.take('pan')} />
      <DeskDocument kind="aadhaar_front" name={member.fullName} photo={aadhaar} reason={reasonFor('aadhaar_front')} onTake={() => desk.take('aadhaar_front')} />
      <DetailsFields form={form} name={member.fullName} consent={consent} onConsent={setConsent} />
      <Inline gap={3} wrap>
        <Button variant="primary" size="compact" isLoading={check.isPending} onClick={() => void submit()}>
          {t('console.kycInPerson.verifyName', { name: member.fullName })}
        </Button>
        <Button variant="subtle" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
      {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
    </Stack>
  );
}

interface DetailsFieldsProps {
  form: DetailsForm;
  name: string;
  consent: boolean;
  onConsent: (consent: boolean) => void;
}

/** What the reviewer enters from the originals, and the member's consent. */
function DetailsFields({ form, name, consent, onConsent }: DetailsFieldsProps) {
  const dateOfBirth = form.register('dateOfBirth');
  const aadhaarLast4 = form.register('aadhaarLast4');
  const pan = form.register('pan');
  return (
    <Stack gap={3}>
      <Input {...dateOfBirth} type="date" label={t('console.kycReview.dateOfBirthFor', { name })} />
      <Input {...aadhaarLast4} label={t('console.kycInPerson.aadhaarLast4For', { name })} inputMode="numeric" maxLength={4} autoComplete="off" />
      <Input {...pan} label={t('console.kycReview.panFor', { name })} maxLength={10} autoComplete="off" />
      <Switch label={t('console.kycInPerson.consentFor', { name })} hint={t('console.kycInPerson.consentHint')} isOn={consent} onChange={onConsent} />
    </Stack>
  );
}
