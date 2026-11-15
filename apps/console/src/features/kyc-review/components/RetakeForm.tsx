import { useKycDocumentRetake, type KycCandidate, type KycDocumentKind } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, LoadState, Stack, Stepper, Text } from '@rivr/ui';
import { useState } from 'react';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument } from './DeskPhotos.tsx';
import { stepNames, STEPS } from './deskSteps.ts';

/** Only photos are owed: the check itself is over, and a super admin sent one or both back (decision 0573). */
export function owesPhotosOnly(member: KycCandidate): boolean {
  return member.retakes.length > 0 && member.status !== null && member.status !== 'started' && member.status !== 'needs_pan';
}

interface RetakeFormProps {
  venueId: string;
  member: KycCandidate;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Taking again the photos a super admin sent back, each saved as it is kept. The rest of the member's check stands, so
 * the check opens on the first of those photos' steps (redesign RD-21), its camera ready and why it came back above it,
 * and moves to the next one owed. A photo not saved, or its camera left, shows what is still owed.
 */
export function RetakeForm({ venueId, member, onDone, onCancel }: RetakeFormProps) {
  const retake = useKycDocumentRetake(venueId);
  const [saved, setSaved] = useState<readonly KycDocumentKind[]>([]);
  const [taking, setTaking] = useState<KycDocumentKind | null>(member.retakes[0]?.kind ?? null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const owed = member.retakes.filter(({ kind }) => !saved.includes(kind));
  const save = async (kind: KycDocumentKind, photo: Blob) => {
    setTaking(null);
    // A kept Aadhaar photo has had its bars confirmed: the camera does not give one up before.
    const done = await retake.mutateAsync({ memberId: member.memberId, kind, coversConfirmed: kind === 'aadhaar_front', photo });
    if (!done.ok) return setProblem(IN_PERSON_FAILURE_COPY[done.error]);
    setProblem(null);
    setSaved([...saved, kind]);
    const next = owed.find((other) => other.kind !== kind);
    return next === undefined ? onDone() : setTaking(next.kind);
  };
  const at = taking ?? owed[0]?.kind;
  const bar = at === undefined ? null : <Stepper look="progress" label={t('console.kycInPerson.title')} steps={stepNames()} current={STEPS.indexOf(at)} />;
  if (taking !== null) {
    return (
      <Stack gap={3}>
        {bar}
        <DeskCamera kind={taking} place={saved.length + 1} total={member.retakes.length} reason={member.retakes.find((one) => one.kind === taking)?.reason}
          onPhoto={(photo) => void save(taking, photo)} />
        <Button variant="text" size="compact" onClick={() => setTaking(null)}>{t('common.back')}</Button>
      </Stack>
    );
  }
  if (retake.isPending) return <LoadState />;
  return (
    <Stack gap={4}>
      {bar}
      <Text tone="muted">{t('console.kycInPerson.retakeHint', { name: member.fullName })}</Text>
      {owed.map(({ kind, reason }) => <DeskDocument key={kind} kind={kind} name={member.fullName} reason={reason} onTake={() => setTaking(kind)} />)}
      <Button variant="subtle" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
    </Stack>
  );
}
