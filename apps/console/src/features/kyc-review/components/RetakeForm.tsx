import { useKycAadhaarCovers, useKycDocumentRetake, type KycCandidate, type KycDocumentKind } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, LoadState, Stack, Stepper, Text } from '@rivr/ui';
import { useState } from 'react';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument, StepHeading } from './DeskPhotos.tsx';
import { stepNames, STEPS } from './deskSteps.ts';

/** Only photos are owed: the check itself is over, and a super admin sent one or both back (decision 0573). */
export function owesPhotosOnly(member: KycCandidate): boolean {
  return member.retakes.length > 0 && member.status !== null && member.status !== 'started' && member.status !== 'needs_pan';
}

/** The photos sent back, in the steps' own order: the database lists them by name, the Aadhaar front before the PAN card. */
const inStepOrder = (member: KycCandidate) => [...member.retakes].sort((a, b) => STEPS.indexOf(a.kind) - STEPS.indexOf(b.kind));

interface RetakeFormProps {
  venueId: string;
  member: KycCandidate;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Taking again the photos a super admin sent back, each saved as it is kept. The rest of the member's check stands, so
 * the check opens on the first of those photos' steps (redesign RD-21), its camera ready and why it came back above it,
 * and moves to the next one owed. A photo not saved, or its camera left, shows what is still owed. The bar stays while a
 * photo is saved, and each view takes the focus as it opens.
 */
export function RetakeForm({ venueId, member, onDone, onCancel }: RetakeFormProps) {
  const retake = useKycDocumentRetake(venueId);
  const hasCovers = useKycAadhaarCovers(venueId);
  const [retakes] = useState(() => inStepOrder(member));
  const [saved, setSaved] = useState<readonly KycDocumentKind[]>([]);
  const [taking, setTaking] = useState<KycDocumentKind | null>(retakes[0]?.kind ?? null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const owed = retakes.filter(({ kind }) => !saved.includes(kind));
  const save = async (kind: KycDocumentKind, photo: Blob) => {
    setTaking(null);
    // Under the bars, a kept Aadhaar photo has had them confirmed: the camera does not give one up before.
    const done = await retake.mutateAsync({ memberId: member.memberId, kind, coversConfirmed: kind === 'aadhaar_front' && hasCovers, photo });
    if (!done.ok) return setProblem(IN_PERSON_FAILURE_COPY[done.error]);
    setProblem(null);
    setSaved([...saved, kind]);
    const next = owed.find((other) => other.kind !== kind);
    return next === undefined ? onDone() : setTaking(next.kind);
  };
  const at = taking ?? owed[0]?.kind;
  return (
    <Stack gap={4}>
      {at === undefined ? null : <Stepper look="progress" label={t('console.kycInPerson.title')} steps={stepNames()} current={STEPS.indexOf(at)} />}
      <RetakeBody member={member} owed={owed} taking={taking} place={saved.length + 1} total={retakes.length} isSaving={retake.isPending} problem={problem} hasCovers={hasCovers}
        onTake={setTaking} onPhoto={(kind, photo) => void save(kind, photo)} onCancel={onCancel} />
    </Stack>
  );
}

interface RetakeBodyProps {
  member: KycCandidate;
  owed: KycCandidate['retakes'];
  taking: KycDocumentKind | null;
  place: number;
  total: number;
  isSaving: boolean;
  problem: MessageKey | null;
  hasCovers: boolean;
  onTake: (kind: KycDocumentKind | null) => void;
  onPhoto: (kind: KycDocumentKind, photo: Blob) => void;
  onCancel: () => void;
}

/** Under the bar: the camera for the photo being taken; a photo being saved; or what is still owed, each with its reason. */
function RetakeBody({ member, owed, taking, place, total, isSaving, problem, hasCovers, onTake, onPhoto, onCancel }: RetakeBodyProps) {
  if (taking !== null) {
    return (
      <Stack gap={3}>
        <StepHeading key={taking} step={taking} />
        <DeskCamera kind={taking} place={place} total={total} reason={owed.find((one) => one.kind === taking)?.reason} hasCovers={hasCovers}
          onPhoto={(photo) => onPhoto(taking, photo)} />
        <Button variant="text" size="compact" onClick={() => onTake(null)}>{t('common.back')}</Button>
      </Stack>
    );
  }
  if (isSaving) return <LoadState />;
  const first = owed[0]?.kind;
  return (
    <Stack gap={4}>
      {first === undefined ? null : <StepHeading step={first} />}
      <Text tone="muted">{t('console.kycInPerson.retakeHint', { name: member.fullName })}</Text>
      {owed.map(({ kind, reason }) => <DeskDocument key={kind} kind={kind} name={member.fullName} reason={reason} onTake={() => onTake(kind)} />)}
      <Button variant="subtle" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
    </Stack>
  );
}
