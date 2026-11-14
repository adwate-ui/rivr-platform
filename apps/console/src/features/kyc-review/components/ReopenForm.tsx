import { isReasonInWords } from '@rivr/contracts';
import { useKycReviewActions, type KycReviewFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './checkText.ts';

/** This form has only the reason: the review form's "invalid" also names a date of birth and a PAN. */
const failureKey = (failure: KycReviewFailure): MessageKey => (failure === 'invalid' ? 'console.kycInPerson.sendBackFailures.invalid' : FAILURE_COPY[failure]);

interface ReopenFormProps {
  venueId: string;
  memberId: string;
  fullName: string;
}

/**
 * A super admin reopens a refused check done in person (#267), with the reason, so a member wrongly
 * matched can be checked in person again. The database keeps who may, and the reason in the audit log.
 */
export function ReopenForm({ venueId, memberId, fullName }: ReopenFormProps) {
  const { reopen } = useKycReviewActions(venueId);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<KycReviewFailure | null>(null);
  const submit = async () => {
    // The database refuses a short reason or one with a digit: the form says so first.
    if (!isReasonInWords(reason, 500)) return setFailure('invalid');
    const done = await reopen.mutateAsync({ memberId, reason: reason.trim() });
    return setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={3}>
      <Input
        label={t('console.kycInPerson.reopenFor', { name: fullName })}
        hint={t('console.kycInPerson.reopenHint')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        autoComplete="off"
      />
      <Inline gap={3}>
        <Button variant="subtle" size="compact" isLoading={reopen.isPending} onClick={() => void submit()}>
          {t('console.kycInPerson.reopen')}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(failureKey(failure))}</ErrorMessage>}
    </Stack>
  );
}
