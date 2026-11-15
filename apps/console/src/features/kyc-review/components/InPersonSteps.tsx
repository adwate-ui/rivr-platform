import { zodResolver } from '@hookform/resolvers/zod';
import { kycInPersonSchema } from '@rivr/contracts';
import { useKycImageUrl, useKycInPerson, type KycCandidate, type KycInPersonOutcome } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, KycPhoto, kycPhotoStatus, Stack, Stepper, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument } from './DeskPhotos.tsx';
import { PHOTO_KINDS, readyPhoto, stepNames, STEPS, type DeskPhoto, type DeskPhotoKind, type Step } from './deskSteps.ts';

// The typed details; the photos and the consent are held beside the form.
const detailsSchema = kycInPersonSchema.pick({ dateOfBirth: true, aadhaarLast4: true, pan: true });
type DetailsForm = UseFormReturn<z.input<typeof detailsSchema>, unknown, z.output<typeof detailsSchema>>;

type Photos = Partial<Record<DeskPhotoKind, DeskPhoto>>;

/**
 * Where the check is (redesign RD-21): its step, the photos kept, and whether a kept photo is being taken again. "Use
 * photo" moves on to the first photo still missing, else to the details, so a first pass goes step by step and a photo
 * taken again from the details comes back to them. Back goes one step back; nothing taken or typed is lost.
 */
function useSteps(onProblem: (problem: MessageKey | null) => void) {
  const [step, setStep] = useState<Step>('member');
  const [photos, setPhotos] = useState<Photos>({});
  const [isRetaking, setRetaking] = useState(false);
  // A photo the browser could not read opens its camera afresh.
  const [attempt, setAttempt] = useState(0);
  const go = (to: Step, retake = false) => {
    onProblem(null);
    setRetaking(retake);
    setStep(to);
  };
  const keep = async (kind: DeskPhotoKind, taken: Blob) => {
    const ready = await readyPhoto(kind, taken);
    if (ready === null) {
      setAttempt(attempt + 1);
      return onProblem('console.kycInPersonFailures.noPhoto');
    }
    // Added to the photos as they are now: another may have been kept while this one was being made ready.
    setPhotos((now) => ({ ...now, [kind]: ready }));
    const kept = { ...photos, [kind]: ready };
    return go(PHOTO_KINDS.find((other) => kept[other] === undefined) ?? 'details');
  };
  const at = STEPS.indexOf(step);
  return { step, photos, isRetaking, attempt, go, keep, back: () => go(STEPS[at - 1] ?? 'member'), next: () => go(STEPS[at + 1] ?? 'details') };
}

type Steps = ReturnType<typeof useSteps>;

/** The member's face as the desk took it, and beside it the selfie they took in the app (decision 0502), to compare. */
function FacePhotos({ member, photo }: { member: KycCandidate; photo: DeskPhoto | undefined }) {
  const appSelfie = useKycImageUrl(member.clubSelfiePath);
  const taken = photo === undefined ? null : <KycPhoto alt={t('console.kycReview.photoOf', { name: member.fullName })} src={photo.preview} />;
  if (member.clubSelfiePath === null) return taken;
  return (
    <Inline gap={3} align="start">
      {taken}
      <KycPhoto alt={t('console.kycInPerson.appSelfieOf', { name: member.fullName })} src={appSelfie.data ?? null}
        status={kycPhotoStatus(member.clubSelfiePath, appSelfie)} />
    </Inline>
  );
}

/** Step 1: who is being checked, with their app selfie if they took one; Start, or another member. */
function MemberStep({ member, onStart, onCancel }: { member: KycCandidate; onStart: () => void; onCancel: () => void }) {
  return (
    <Stack gap={4}>
      <FacePhotos member={member} photo={undefined} />
      <Stack gap={1}>
        <Text variant="row" weight="medium">{member.fullName}</Text>
        <Text variant="secondary" tone="muted">{t('console.kycInPerson.phoneEnding', { digits: member.phoneLast4 })}</Text>
      </Stack>
      <Button variant="primary" fullWidth onClick={onStart}>{t('console.kycInPerson.start')}</Button>
      <Button variant="text" fullWidth onClick={onCancel}>{t('console.kycInPerson.another')}</Button>
    </Stack>
  );
}

/**
 * Steps 2 to 4, one photo each: its camera until the photo is kept, or when it is taken again; once kept, the photo with
 * Next and the way to take it again. A card a super admin sent back says why above its camera.
 */
function PhotoStep({ kind, member, steps }: { kind: DeskPhotoKind; member: KycCandidate; steps: Steps }) {
  const photo = steps.photos[kind];
  const place = PHOTO_KINDS.indexOf(kind) + 1;
  const back = <Button variant="text" size="compact" onClick={steps.back}>{t('common.back')}</Button>;
  if (photo === undefined || steps.isRetaking) {
    const reason = member.retakes.find((one) => one.kind === kind)?.reason;
    return (
      <Stack gap={3}>
        <DeskCamera key={`${kind}:${steps.attempt}`} kind={kind} place={place} total={PHOTO_KINDS.length} reason={reason} onPhoto={(taken) => void steps.keep(kind, taken)} />
        {back}
      </Stack>
    );
  }
  return (
    <Stack gap={3}>
      <Text variant="secondary" tone="muted">{t('console.kycInPerson.photoStep', { place, total: PHOTO_KINDS.length })}</Text>
      {kind === 'face' ? <FacePhotos member={member} photo={photo} /> : (
        <KycPhoto shape="card" alt={t('console.kycInPerson.documentOf', { document: t(`console.kycInPerson.document.${kind}`), name: member.fullName })} src={photo.preview} />
      )}
      <Inline gap={3} wrap>
        <Button variant="primary" size="compact" onClick={steps.next}>{t('console.kycInPerson.next')}</Button>
        <Button variant="subtle" size="compact" onClick={() => steps.go(kind, true)}>{t('console.kycInPerson.retakePhoto')}</Button>
        {back}
      </Inline>
    </Stack>
  );
}

interface DetailsStepProps {
  member: KycCandidate;
  steps: Steps;
  form: DetailsForm;
  consent: boolean;
  onConsent: (consent: boolean) => void;
  isSaving: boolean;
  onVerify: () => void;
}

/** Step 5: the three photos, each with the way to take it again, the details typed from the originals, the consent, and Verify. */
function DetailsStep({ member, steps, form, consent, onConsent, isSaving, onVerify }: DetailsStepProps) {
  const { face, pan, aadhaar_front: aadhaar } = steps.photos;
  // A reopened check can also have a photo sent back: the desk is told why here too.
  const reasonFor = (kind: DeskPhotoKind) => member.retakes.find((one) => one.kind === kind)?.reason;
  return (
    <Stack gap={4}>
      <FacePhotos member={member} photo={face} />
      <Button variant="subtle" size="compact" onClick={() => steps.go('face', true)}>{t('console.kycInPerson.retakePhoto')}</Button>
      <DeskDocument kind="pan" name={member.fullName} photo={pan} reason={reasonFor('pan')} onTake={() => steps.go('pan', true)} />
      <DeskDocument kind="aadhaar_front" name={member.fullName} photo={aadhaar} reason={reasonFor('aadhaar_front')} onTake={() => steps.go('aadhaar_front', true)} />
      <DetailsFields form={form} name={member.fullName} consent={consent} onConsent={onConsent} />
      <Inline gap={3} wrap>
        <Button variant="primary" size="compact" isLoading={isSaving} onClick={onVerify}>{t('console.kycInPerson.verifyName', { name: member.fullName })}</Button>
        {/* Not while the check is being saved: its answer belongs to this step. */}
        <Button variant="text" size="compact" isDisabled={isSaving} onClick={steps.back}>{t('common.back')}</Button>
      </Inline>
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

interface InPersonStepsProps {
  venueId: string;
  member: KycCandidate;
  /** The check went through the gate: verified, refused, or sent to review by a clash with another check. */
  onDecided: (outcome: KycInPersonOutcome) => void;
  /** Another member is to be chosen: what was taken and typed for this one is dropped. */
  onCancel: () => void;
}

/**
 * Checking one member in person against their original documents, as five steps under a progress bar (redesign RD-21):
 * the member, their face, their PAN card, their Aadhaar front, then the details typed from the originals and their
 * consent, asked there. The checks, the words and the rules are as before; the database keeps the gate.
 */
export function InPersonSteps({ venueId, member, onDecided, onCancel }: InPersonStepsProps) {
  const { check } = useKycInPerson(venueId);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const steps = useSteps(setProblem);
  const [resolver] = useState(() => zodResolver(detailsSchema));
  const form: DetailsForm = useForm({ resolver, defaultValues: { dateOfBirth: '', aadhaarLast4: '', pan: '' } });
  const { face, pan, aadhaar_front: aadhaar } = steps.photos;
  const submit = form.handleSubmit(async (details) => {
    if (face === undefined || pan === undefined || aadhaar === undefined || !consent) return setProblem('console.kycInPerson.invalid');
    // A kept Aadhaar photo has had its bars confirmed: the camera does not give one up before.
    const done = await check.mutateAsync({
      ...details, memberId: member.memberId, consent: true, coversConfirmed: true, photo: face.jpeg, panPhoto: pan.jpeg, aadhaarPhoto: aadhaar.jpeg,
    });
    return done.ok ? onDecided(done.value) : setProblem(IN_PERSON_FAILURE_COPY[done.error]);
  }, () => setProblem('console.kycInPerson.invalid'));
  const { step } = steps;
  return (
    <Stack gap={4}>
      <Stepper look="progress" label={t('console.kycInPerson.title')} steps={stepNames()} current={STEPS.indexOf(step)} />
      {step === 'member' ? <MemberStep member={member} onStart={steps.next} onCancel={onCancel} /> : null}
      {step === 'face' || step === 'pan' || step === 'aadhaar_front' ? <PhotoStep kind={step} member={member} steps={steps} /> : null}
      {step === 'details' ? (
        <DetailsStep member={member} steps={steps} form={form} consent={consent} onConsent={setConsent} isSaving={check.isPending} onVerify={() => void submit()} />
      ) : null}
      {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
    </Stack>
  );
}
