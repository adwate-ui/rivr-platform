import { useKycDocumentRetake, type KycCandidate, type KycDocumentKind } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';
import { DeskCamera, DeskDocument } from './DeskPhotos.tsx';

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

/** Taking again the photos a super admin sent back, each saved as it is kept. The rest of the member's check stands. */
export function RetakeForm({ venueId, member, onDone, onCancel }: RetakeFormProps) {
  const retake = useKycDocumentRetake(venueId);
  const [saved, setSaved] = useState<readonly KycDocumentKind[]>([]);
  const [taking, setTaking] = useState<KycDocumentKind | null>(null);
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
  if (taking !== null) {
    return <DeskCamera kind={taking} place={saved.length + 1} total={member.retakes.length} onPhoto={(photo) => void save(taking, photo)} onCancel={() => setTaking(null)} />;
  }
  if (retake.isPending) return <LoadState />;
  return (
    <Stack gap={4}>
      <Text tone="muted">{t('console.kycInPerson.retakeHint', { name: member.fullName })}</Text>
      {owed.map(({ kind, reason }) => <DeskDocument key={kind} kind={kind} name={member.fullName} reason={reason} onTake={() => setTaking(kind)} />)}
      <Button variant="subtle" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      {problem === null ? null : <ErrorMessage>{t(problem)}</ErrorMessage>}
    </Stack>
  );
}
