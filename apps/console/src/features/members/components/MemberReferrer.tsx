import { topMatches, useMemberSearch, useSetReferrer, type MemberRow, type MemberSignUp, type ReferrerFailure, type ReferrerOutcome } from '@rivr/db';
import { formatDate, t } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmQuestion, DetailRow, ErrorMessage, Inline, Input, LoadState, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/** What the last Yes did: set, paid now or at the first seat; or why not. */
type Said = { readonly done: ReferrerOutcome } | { readonly failure: ReferrerFailure } | null;

/** Who referred them, with their member number, and when it was paid; None when no one did. */
function referrerWords(signUp: MemberSignUp): string {
  if (signUp.referrer === null) return t('console.members.signUp.referrer.none');
  const who = t('console.members.signUp.referrer.who', { name: signUp.referrer.fullName, number: String(signUp.referrer.memberNumber) });
  return signUp.referralCompletedAt === null ? who
    : t('console.members.signUp.referrer.paidOn', { who, date: formatDate(new Date(signUp.referralCompletedAt)) });
}

interface FindProps {
  venueId: string;
  memberId: string;
  chosen: MemberRow | null;
  onChoose: (member: MemberRow | null) => void;
}

/** The referrer found by name, mobile or member number through the member search, as the floor seats one; never the member themselves. */
function FindReferrer({ venueId, memberId, chosen, onChoose }: FindProps) {
  const [typed, setTyped] = useState('');
  const found = useMemberSearch(venueId, typed);
  const isTyped = typed.trim() !== '';
  const rows = topMatches(found.data ?? [], typed).filter((row) => row.memberId !== memberId);
  return (
    <Stack gap={2}>
      <Input variant="subtle" label={t('console.members.signUp.referrer.search')} value={typed} autoComplete="off" autoFocus
        onChange={(event) => { setTyped(event.target.value); onChoose(null); }} />
      {isTyped && found.isError ? <LoadState isError errorText={t('console.members.signUp.referrer.searchFailed')} onRetry={() => void found.refetch()} /> : null}
      {isTyped && found.isSuccess && rows.length === 0 ? <Text tone="muted">{t('console.members.signUp.referrer.noMatch')}</Text> : null}
      {rows.length === 0 ? null : (
        <ChoiceChips look="subtle" mode="one" label={t('console.members.signUp.referrer.matches')} isLabelVisuallyHidden selected={chosen === null ? [] : [chosen.memberId]}
          options={rows.map((row) => ({ value: row.memberId, label: t('console.members.signUp.referrer.who', { name: row.fullName, number: String(row.memberNumber) }) }))}
          onChange={([value]) => onChoose(rows.find((row) => row.memberId === value) ?? null)} />
      )}
    </Stack>
  );
}

/** What the last Yes did, said where a screen reader hears it; a refusal in words. */
function SaidLine({ said }: { said: Said }) {
  return (
    <>
      <StatusMessage>{said !== null && 'done' in said ? t(`console.members.signUp.referrer.done.${said.done}`) : null}</StatusMessage>
      {said !== null && 'failure' in said ? <ErrorMessage>{t(`console.members.signUp.referrer.failures.${said.failure}`)}</ErrorMessage> : null}
    </>
  );
}

/**
 * Finding a referrer, then Yes or Cancel: Yes says whether both are paid now (they have sat) or at the first seat, and the
 * search closes once it is set. Cancel, or a refusal, leaves the search as it was, so the focus goes back to the member chosen.
 */
function SetReferrer({ venueId, memberId, signUp, onSaid }: { venueId: string; memberId: string; signUp: MemberSignUp; onSaid: (said: Said) => void }) {
  const [chosen, setChosen] = useState<MemberRow | null>(null);
  const set = useSetReferrer(venueId, memberId);
  const confirm = async (referrer: MemberRow) => {
    const done = await set.mutateAsync(referrer.memberId);
    setChosen(null);
    onSaid(done.ok ? { done: done.value } : { failure: done.error });
  };
  return (
    <Stack gap={2}>
      <FindReferrer venueId={venueId} memberId={memberId} chosen={chosen} onChoose={setChosen} />
      {chosen === null ? null : (
        <ConfirmQuestion confirm={t('console.members.signUp.referrer.confirm')} isBusy={set.isPending} onConfirm={() => void confirm(chosen)}
          onCancel={() => setChosen(null)}
          question={t(signUp.hasSat ? 'console.members.signUp.referrer.askPaidNow' : 'console.members.signUp.referrer.askPaidLater', { name: chosen.fullName })} />
      )}
    </Stack>
  );
}

/**
 * Who referred the member, on their Sign-up (the owner, 25 Nov; #1133); the floor and up (members.referrer) add or change it
 * until it is paid: search, choose, then Yes.
 */
export function MemberReferrer({ venueId, memberId, signUp, canSet }: { venueId: string; memberId: string; signUp: MemberSignUp; canSet: boolean }) {
  const [isFinding, setIsFinding] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const mayChange = canSet && signUp.referralCompletedAt === null;
  return (
    <Stack gap={2}>
      <DetailRow label={t('console.members.signUp.referrer.label')} value={referrerWords(signUp)} labelTone="muted" size="small" isLast />
      {mayChange ? (
        <Inline>
          <Button variant="subtle" size="compact" aria-expanded={isFinding} onClick={() => { setIsFinding(!isFinding); setSaid(null); }}>
            {t(signUp.referrer === null ? 'console.members.signUp.referrer.add' : 'console.members.signUp.referrer.change')}
          </Button>
        </Inline>
      ) : null}
      {mayChange && isFinding ? (
        <SetReferrer venueId={venueId} memberId={memberId} signUp={signUp} onSaid={(next) => { setSaid(next); if (next !== null && 'done' in next) setIsFinding(false); }} />
      ) : null}
      <SaidLine said={said} />
    </Stack>
  );
}
