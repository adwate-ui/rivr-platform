import { zodResolver } from '@hookform/resolvers/zod';
import { kycInPersonSchema } from '@rivr/contracts';
import { shrinkPhoto, toBase64, useKycInPerson, type KycCandidate, type KycInPersonFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, CameraButton, ErrorMessage, Inline, Input, KycPhoto, Stack, Switch } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

// The typed details; the photo and the consent are held beside the form.
const detailsSchema = kycInPersonSchema.pick({ dateOfBirth: true, aadhaarLast4: true, pan: true });
type DetailsForm = UseFormReturn<z.input<typeof detailsSchema>, unknown, z.output<typeof detailsSchema>>;

const FAILURE_COPY: Readonly<Record<KycInPersonFailure, MessageKey>> = {
  not_allowed: 'console.kycInPersonFailures.notAllowed',
  decided: 'console.kycInPersonFailures.decided',
  no_photo: 'console.kycInPersonFailures.noPhoto',
  invalid: 'console.kycInPersonFailures.invalid',
  stopped: 'console.kycInPersonFailures.stopped',
  unavailable: 'console.kycInPersonFailures.unavailable',
};

/** The photo as it is sent, and as the reviewer sees it. */
interface Photo {
  jpeg: Blob;
  preview: string;
}

/** The photo the camera took, made ready to send and to show; null for a file that is not an image. */
async function photoFrom(taken: File): Promise<Photo | null> {
  const jpeg = await shrinkPhoto(taken).catch(() => null);
  return jpeg === null ? null : { jpeg, preview: `data:image/jpeg;base64,${await toBase64(jpeg)}` };
}

interface InPersonFormProps {
  venueId: string;
  member: KycCandidate;
  /** The check went through the gate: verified, or refused (under 18, or a PAN a verified member holds). */
  onDecided: (outcome: 'verified' | 'refused') => void;
  onCancel: () => void;
}

/**
 * Checking one member in person against their original documents: their photo, the date of birth,
 * the last four Aadhaar digits and the PAN, and their consent, asked there. The database keeps the gate.
 */
export function InPersonForm({ venueId, member, onDecided, onCancel }: InPersonFormProps) {
  const { check } = useKycInPerson(venueId);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [resolver] = useState(() => zodResolver(detailsSchema));
  const form: DetailsForm = useForm({ resolver, defaultValues: { dateOfBirth: '', aadhaarLast4: '', pan: '' } });
  const takePhoto = async (taken: File) => {
    const ready = await photoFrom(taken);
    setPhoto(ready);
    setProblem(ready === null ? 'console.kycInPersonFailures.noPhoto' : null);
  };
  const submit = form.handleSubmit(async (details) => {
    if (photo === null || !consent) return setProblem('console.kycInPerson.invalid');
    const done = await check.mutateAsync({ ...details, memberId: member.memberId, consent: true, photo: photo.jpeg });
    return done.ok ? onDecided(done.value) : setProblem(FAILURE_COPY[done.error]);
  }, () => setProblem('console.kycInPerson.invalid'));
  return (
    <Inline gap={6} align="start">
      <KycPhoto alt={t('console.kycReview.photoOf', { name: member.fullName })} src={photo?.preview ?? null} status={photo === null ? 'missing' : 'ready'} />
      <Stack gap={3} grow>
        <CameraButton variant="secondary" camera="environment" onPhoto={(taken) => void takePhoto(taken)}>
          {t(photo === null ? 'console.kycInPerson.takePhoto' : 'console.kycInPerson.retakePhoto')}
        </CameraButton>
        <DetailsFields form={form} name={member.fullName} consent={consent} onConsent={setConsent} />
        <Inline gap={3}>
          <Button variant="primary" isLoading={check.isPending} onClick={() => void submit()}>
            {t('console.kycInPerson.verifyName', { name: member.fullName })}
          </Button>
          <Button variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        </Inline>
        {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
      </Stack>
    </Inline>
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
