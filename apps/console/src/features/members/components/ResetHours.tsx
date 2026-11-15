import { useResetMemberHours } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ConfirmButton, ErrorMessage, Heading, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/**
 * A super admin resets one member's counted hours (redesign RD-36; the owner, 15 Nov): a reason, then Reset hours, asked
 * twice. From then the member's hours start from zero on the TV's hours leaderboard, for a play-time Bonus and in the
 * Members list; the visits above stay as they are. Audited, with the reason.
 */
export function ResetHours({ venueId, memberId, name }: { venueId: string; memberId: string; name: string }) {
  const reset = useResetMemberHours(venueId, memberId);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    const done = await reset.mutateAsync(reason);
    setOutcome(done.ok ? { ok: true, text: t('console.members.resetHours.done') } : { ok: false, text: t(`console.members.resetHours.failures.${done.error}`) });
    if (done.ok) setReason('');
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.resetHours.title')}</Heading>
      <Text tone="muted">{t('console.members.resetHours.intro')}</Text>
      <Input label={t('console.members.resetHours.reason')} value={reason} maxLength={200} autoComplete="off"
        onChange={(event) => { setReason(event.target.value); setOutcome(null); }} />
      <Stack align="start">
        <ConfirmButton variant="subtle" label={t('console.members.resetHours.reset')}
          confirm={t('console.members.resetHours.confirm', { name })} isDisabled={reason.trim().length < 3} isBusy={reset.isPending} onConfirm={() => void submit()} />
      </Stack>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
