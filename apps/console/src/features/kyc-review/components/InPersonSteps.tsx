import { zodResolver } from '@hookform/resolvers/zod';
import { kycInPersonSchema } from '@rivr/contracts';
import { useKycAadhaarCovers, useKycImageUrl, useKycInPerson, type KycCandidate, type KycInPersonOutcome } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, KycPhoto, kycPhotoStatus, Stack, Stepper, Switch, Text } from '@rivr/ui';
import { useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument, StepHeading } from './DeskPhotos.tsx';
import { PHOTO_KINDS, readyPhoto, stepNames, STEPS, type DeskPhoto, type DeskPhotoKind, type Step } from './deskSteps.ts';

// The typed details; the photos and the consent are held beside the form.
const detailsSchema = kycInPersonSchema.pick({ dateOfBirth: true, aadhaarLast4: true, pan: true });
type DetailsForm = UseFormReturn<z.input<typeof detailsSchema>, unknown, z.output<typeof detailsSchema>>;

type Photos = Partial<Record<DeskPhotoKind, DeskPhoto>>;

/**
 * Where the check is (redesign RD-21): its step, the photos kept, and whether a kept photo is being taken again. "Use
 * photo" moves on to the first photo still missing, else to the details, so a first pass goes step by step and a photo
 * taken again from the details comes back to them. Back goes one step back, or, from a photo being taken again, to where
 * that was asked; nothing taken or typed is lost.
 */
function useSteps(onProblem: (problem: MessageKey | null) => void) {
  const [step, setStep] = useState<Step>('member');
  const [photos, setPhotos] = useState<Photos>({});
  // Where a photo's retake was asked from: its own step, or the details.
  const [retakeFrom, setRetakeFrom] = useState<Step | null>(null);
  // A photo the browser could not read opens its camera afresh.
  const [attempt, setAttempt] = useState(0);
  // The step as it is this instant, for a photo that is made ready after the person has moved on.
  const here = useRef<Step>('member');
  const go = (to: Step, retake = false) => {
    onProblem(null);
    setRetakeFrom(retake ? here.current : null);
    here.current = to;
    setStep(to);
  };
  const keep = async (kind: DeskPhotoKind, taken: Blob) => {
    const ready = await readyPhoto(kind, taken);
    // The person may have gone to another step while the photo was made ready: they stay where they are.
    const isStillHere = here.current === kind;
    if (ready === null) {
      if (!isStillHere) return;
      setAttempt(attempt + 1);
      onProblem('console.kycInPersonFailures.noPhoto');
      return;
    }
    // Added to the photos as they are now: another may have been kept meanwhile.
    setPhotos((now) => ({ ...now, [kind]: ready }));
    const kept = { ...photos, [kind]: ready };
    if (isStillHere) go(PHOTO_KINDS.find((other) => kept[other] === undefined) ?? 'details');
  };
  const at = STEPS.indexOf(step);
  const back = () => go(retakeFrom ?? STEPS[at - 1] ?? 'member');
  return { step, photos, isRetaking: retakeFrom !== null, attempt, go, keep, back, next: () => go(STEPS[at + 1] ?? 'details') };
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

/** Step 1: who is being checked, their name and number beside their app selfie if they took one; Start, or another member. */
function MemberStep({ member, onStart, onCancel }: { member: KycCandidate; onStart: () => void; onCancel: () => void }) {
  return (
    <Stack gap={4}>
      <StepHeading step="member" />
      <Inline gap={3} align="start">
        <FacePhotos member={member} photo={undefined} />
        <Stack gap={1}>
          <Text variant="row" weight="medium">{member.fullName}</Text>
          <Text variant="secondary" tone="muted">{t('console.kycInPerson.phoneEnding', { digits: member.phoneLast4 })}</Text>
        </Stack>
      </Inline>
      <Button variant="primary" fullWidth onClick={onStart}>{t('console.kycInPerson.start')}</Button>
      <Button variant="text" fullWidth onClick={onCancel}>{t('console.kycInPerson.another')}</Button>
    </Stack>
  );
}

/** What a kept photo's Retake is read out as: the photo for the face, a card by its name. */
const retakeName = (kind: DeskPhotoKind) => (kind === 'face'
  ? t('console.kycInPerson.retakePhotoName')
  : t('console.kycInPerson.retakeDocumentName', { document: t(`console.kycInPerson.document.${kind}`) }));

interface PhotoStepProps {
  kind: DeskPhotoKind;
  member: KycCandidate;
  steps: Steps;
  /** A photo the browser could not read: said under "Photo 1 of 3", beside the camera that takes it again. */
  problem: MessageKey | null;
  /** The Aadhaar front goes under the bars (decision 0663). */
  hasCovers: boolean;
}

/**
 * Steps 2 to 4, one photo each: its camera until the photo is kept, or when it is taken again; once kept, the photo with
 * Next and the way to take it again. A card a super admin sent back says why above its camera.
 */
function PhotoStep({ kind, member, steps, problem, hasCovers }: PhotoStepProps) {
  const photo = steps.photos[kind];
  const place = PHOTO_KINDS.indexOf(kind) + 1;
  const back = <Button variant="text" size="compact" onClick={steps.back}>{t('common.back')}</Button>;
  if (photo === undefined || steps.isRetaking) {
    const reason = member.retakes.find((one) => one.kind === kind)?.reason;
    return (
      <Stack gap={3}>
        <StepHeading step={kind} />
        <DeskCamera key={`${kind}:${String(steps.attempt)}`} kind={kind} place={place} total={PHOTO_KINDS.length} reason={reason}
          problem={problem === null ? undefined : t(problem)} hasCovers={hasCovers} onPhoto={(taken) => void steps.keep(kind, taken)} />
        {back}
      </Stack>
    );
  }
  return (
    <Stack gap={3}>
      <StepHeading step={kind} />
      <Text variant="secondary" tone="muted">{t('console.kycInPerson.photoStep', { place, total: PHOTO_KINDS.length })}</Text>
      {kind === 'face' ? <FacePhotos member={member} photo={photo} /> : (
        <KycPhoto shape="card" alt={t('console.kycInPerson.documentOf', { document: t(`console.kycInPerson.document.${kind}`), name: member.fullName })} src={photo.preview} />
      )}
      <Inline gap={3} wrap>
        <Button variant="primary" size="compact" onClick={steps.next}>{t('console.kycInPerson.next')}</Button>
        <Button variant="subtle" size="compact" aria-label={retakeName(kind)} onClick={() => steps.go(kind, true)}>{t('console.kycInPerson.retakePhoto')}</Button>
        {back}
      </Inline>
    </Stack>
  );
}

interface DetailsStepProps {
  member: KycCandidate;
  steps: Steps;
  details: Details;
}

/**
 * Step 5: the three photos, each with the way to take it again, the details typed from the originals, the consent, and
 * Verify. While the check is being saved nothing here leads away: its answer belongs to this step.
 */
function DetailsStep({ member, steps, details }: DetailsStepProps) {
  const { face, pan, aadhaar_front: aadhaar } = steps.photos;
  const { isSaving } = details;
  // A reopened check can also have a photo sent back: the desk is told why here too.
  const reasonFor = (kind: DeskPhotoKind) => member.retakes.find((one) => one.kind === kind)?.reason;
  return (
    <Stack gap={4}>
      <StepHeading step="details" />
      <FacePhotos member={member} photo={face} />
      <Button variant="subtle" size="compact" aria-label={t('console.kycInPerson.retakePhotoName')} isDisabled={isSaving} onClick={() => steps.go('face', true)}>{t('console.kycInPerson.retakePhoto')}</Button>
      <DeskDocument kind="pan" name={member.fullName} photo={pan} reason={reasonFor('pan')} isDisabled={isSaving} onTake={() => steps.go('pan', true)} />
      <DeskDocument kind="aadhaar_front" name={member.fullName} photo={aadhaar} reason={reasonFor('aadhaar_front')} isDisabled={isSaving} onTake={() => steps.go('aadhaar_front', true)} />
      <DetailsFields details={details} name={member.fullName} />
      <Inline gap={3} wrap>
        <Button variant="primary" size="compact" isLoading={isSaving} onClick={() => void details.verify()}>{t('console.kycInPerson.verifyName', { name: member.fullName })}</Button>
        <Button variant="text" size="compact" isDisabled={isSaving} onClick={steps.back}>{t('common.back')}</Button>
      </Inline>
    </Stack>
  );
}

/** What the reviewer enters from the originals, and the member's consent, each saying under itself what is wrong with it. */
function DetailsFields({ details, name }: { details: Details; name: string }) {
  const { form, onEdit } = details;
  const { errors } = form.formState;
  const fields = { dateOfBirth: form.register('dateOfBirth', { onChange: onEdit }), aadhaarLast4: form.register('aadhaarLast4', { onChange: onEdit }), pan: form.register('pan', { onChange: onEdit }) };
  const errorOf = (field: keyof typeof fields) => (errors[field] === undefined ? undefined : t(`console.kycInPerson.errors.${field}`));
  return (
    <Stack gap={3}>
      <Input {...fields.dateOfBirth} type="date" label={t('console.kycReview.dateOfBirthFor', { name })} error={errorOf('dateOfBirth')} />
      <Input {...fields.aadhaarLast4} label={t('console.kycInPerson.aadhaarLast4For', { name })} inputMode="numeric" maxLength={4} autoComplete="off" error={errorOf('aadhaarLast4')} />
      <Input {...fields.pan} label={t('console.kycReview.panFor', { name })} maxLength={10} autoComplete="off" error={errorOf('pan')} />
      <Switch label={t('console.kycInPerson.consentFor', { name })} hint={t('console.kycInPerson.consentHint')} isOn={details.consent} onChange={details.onConsent} />
      {details.isConsentMissing ? <ErrorMessage>{t('console.kycInPerson.errors.consent')}</ErrorMessage> : null}
    </Stack>
  );
}

interface DetailsOptions {
  venueId: string;
  member: KycCandidate;
  photos: Photos;
  onProblem: (problem: MessageKey | null) => void;
  onDecided: (outcome: KycInPersonOutcome) => void;
  /** The Aadhaar photo was taken under the bars, and the word on them given (decision 0663). */
  hasCovers: boolean;
}

/**
 * The details and the consent, and Verify: what is typed is checked field by field, the consent under its switch, and the
 * check is sent once however often Verify is pressed. Editing anything clears what the last try said; what the server
 * refuses is said in one line under the step.
 */
function useDetails({ venueId, member, photos, onProblem, onDecided, hasCovers }: DetailsOptions) {
  const { check } = useKycInPerson(venueId);
  const [consent, setConsent] = useState(false);
  const [isConsentMissing, setConsentMissing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const sending = useRef(false);
  const [resolver] = useState(() => zodResolver(detailsSchema));
  const form: DetailsForm = useForm({ resolver, defaultValues: { dateOfBirth: '', aadhaarLast4: '', pan: '' } });
  const submit = form.handleSubmit(async (details) => {
    const { face, pan, aadhaar_front: aadhaar } = photos;
    if (!consent) return undefined;
    if (face === undefined || pan === undefined || aadhaar === undefined) return onProblem('console.kycInPerson.invalid');
    // Under the bars, a kept Aadhaar photo has had them confirmed: the camera does not give one up before.
    const done = await check.mutateAsync({
      ...details, memberId: member.memberId, consent: true, coversConfirmed: hasCovers, photo: face.jpeg, panPhoto: pan.jpeg, aadhaarPhoto: aadhaar.jpeg,
    });
    return done.ok ? onDecided(done.value) : onProblem(IN_PERSON_FAILURE_COPY[done.error]);
  });
  const verify = async () => {
    if (sending.current) return;
    sending.current = true;
    setSaving(true);
    setConsentMissing(!consent);
    try {
      await submit();
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };
  const onConsent = (isOn: boolean) => {
    setConsent(isOn);
    setConsentMissing(false);
    onProblem(null);
  };
  return { form, consent, isConsentMissing, isSaving, verify, onConsent, onEdit: () => onProblem(null) };
}

type Details = ReturnType<typeof useDetails>;

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
 * consent, asked there. Each step takes the focus as it opens. The checks, the words and the rules are as before; the
 * database keeps the gate.
 */
export function InPersonSteps({ venueId, member, onDecided, onCancel }: InPersonStepsProps) {
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const steps = useSteps(setProblem);
  const hasCovers = useKycAadhaarCovers(venueId);
  const details = useDetails({ venueId, member, photos: steps.photos, onProblem: setProblem, onDecided, hasCovers });
  const { step } = steps;
  return (
    <Stack gap={4}>
      <Stepper look="progress" label={t('console.kycInPerson.title')} steps={stepNames()} current={STEPS.indexOf(step)} />
      {step === 'member' ? <MemberStep member={member} onStart={steps.next} onCancel={onCancel} /> : null}
      {step === 'face' || step === 'pan' || step === 'aadhaar_front' ? <PhotoStep key={`${step}:${String(steps.isRetaking)}:${String(steps.attempt)}`} kind={step} member={member} steps={steps} problem={problem} hasCovers={hasCovers} /> : null}
      {step === 'details' ? <DetailsStep member={member} steps={steps} details={details} /> : null}
      {step === 'details' && problem !== null ? <ErrorMessage>{t(problem)}</ErrorMessage> : null}
    </Stack>
  );
}
