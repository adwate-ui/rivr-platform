import { useStaffVenue } from '@rivr/db';
import { useBonusByHandCap, useGiveBonusChips, type GiveBonusFailure } from '@rivr/db/bonus';
import { formatNumber, t } from '@rivr/i18n';
import { ConfirmButton, ErrorMessage, Heading, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/** The most any addition may be. */
const MOST = 100_000;

/**
 * The whole fifties from 50 to `most` that the database takes from this person, from what was typed (commas allowed); null
 * otherwise.
 */
export function chipsFrom(typed: string, most: number = MOST): number | null {
  const text = typed.replace(/,/g, '').trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const chips = Number(text);
  return chips >= 50 && chips <= most && chips % 50 === 0 ? chips : null;
}

type Outcome = { readonly added: number } | { readonly failure: GiveBonusFailure } | null;

/** What the last press did: the chips added, or why not. */
function GiveOutcome({ outcome }: { outcome: Outcome }) {
  return (
    <>
      <StatusMessage>{outcome !== null && 'added' in outcome ? t('console.members.bonus.give.added', { chips: formatNumber(outcome.added) }) : null}</StatusMessage>
      {outcome !== null && 'failure' in outcome ? <ErrorMessage>{t(`console.members.bonus.give.failures.${outcome.failure}`)}</ErrorMessage> : null}
    </>
  );
}

/**
 * Bonus added by hand on the member's record (redesign of 15 Nov), for super admins, admins and floor managers (the owner,
 * 9 Nov): how many, in whole fifties, and why, asked twice. One request id until it goes through, is refused or what is typed changes, so pressing again after
 * a dropped line never adds twice, and an edited press is a grant of its own. An admin or a floor manager adds no more at
 * once than the club's cap (bonus.by_hand_cap, redesign RD-19), which the hint says; a super admin is not held to it. The
 * database refuses the same.
 */
export function GiveBonusChips({ venueId, memberId }: { venueId: string; memberId: string }) {
  const staff = useStaffVenue();
  const isUncapped = staff.status === 'ready' && staff.venue.role === 'super_admin';
  const give = useGiveBonusChips(venueId, memberId);
  const cap = useBonusByHandCap(venueId).data ?? null;
  const most = isUncapped || cap === null ? MOST : Math.min(cap, MOST);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const chips = chipsFrom(typed, most);
  const submit = async () => {
    if (chips === null) return;
    const done = await give.mutateAsync({ chips, reason: reason.trim(), requestId });
    setOutcome(done.ok ? { added: chips } : { failure: done.error });
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
    if (done.ok) { setTyped(''); setReason(''); }
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.bonus.give.title')}</Heading>
      <Text tone="muted">{t('console.members.bonus.give.intro')}</Text>
      <Input label={t('console.members.bonus.give.chips')} hint={t('console.members.bonus.give.chipsHint', { most: formatNumber(most) })} value={typed} inputMode="numeric"
        autoComplete="off" onChange={(event) => { setTyped(event.target.value); setRequestId(crypto.randomUUID()); }} />
      <Input label={t('console.members.bonus.give.reason')} hint={t('console.members.bonus.give.reasonHint')} value={reason} maxLength={200}
        autoComplete="off" onChange={(event) => { setReason(event.target.value); setRequestId(crypto.randomUUID()); }} />
      <Stack align="start">
        <ConfirmButton variant="subtle" label={t('console.members.bonus.give.add')} isBusy={give.isPending}
          confirm={t('console.members.bonus.give.confirm', { chips: formatNumber(chips ?? 0) })}
          isDisabled={chips === null || reason.trim().length < 3} onConfirm={() => void submit()} />
      </Stack>
      <GiveOutcome outcome={outcome} />
    </Stack>
  );
}
