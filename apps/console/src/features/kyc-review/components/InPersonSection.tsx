import { useKycDeskClaims, useKycDueTonight, useKycDuplicateHolder, useKycInPersonCandidates, type KycCandidate, type KycDeskHolder, type KycInPersonOutcome } from '@rivr/db';
import { formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, Heading, Inline, Input, MemberLink, Stack, StatusMessage, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';
import type { DecidedClaim } from './deskStart.ts';
import { InPersonSteps } from './InPersonSteps.tsx';
import { owesPhotosOnly, RetakeForm } from './RetakeForm.tsx';

/** The last check in person and where it ended, said once the form closes. */
interface Outcome {
  memberId: string;
  name: string;
  status: KycInPersonOutcome | 'retaken' | 'checked';
  /** For a member checked elsewhere: who checked them and when, if anyone did (the owner, 20 Nov). */
  checked?: DecidedClaim;
}

const OUTCOME_COPY: Readonly<Record<Outcome['status'], MessageKey>> = {
  verified: 'console.kycInPerson.verified',
  refused: 'console.kycInPerson.refused',
  needs_review: 'console.kycInPerson.needsReview',
  retaken: 'console.kycInPerson.retaken',
  checked: 'console.kycInPerson.alreadyDecided',
};

/** What the last check says once it closes; a member checked elsewhere by whom and when, where that is known. */
function outcomeText({ status, name, checked }: Outcome): string {
  if (status === 'checked' && checked?.staffName && checked.at) {
    return t('console.kycInPerson.checkedBy', { by: checked.staffName, name, time: formatTime(checked.at) });
  }
  return t(OUTCOME_COPY[status], { name });
}

/**
 * A check in person (#246, while no KYC vendor is live): the reviewer finds a member at the club by
 * name or the last digits of their number, then checks them against their original documents, in five steps under a
 * progress bar (redesign RD-21). Only
 * members with no check, one the app never finished, or a photo a super admin sent back are found; never the reviewer themselves. In its sheet
 * (`hasHeading` false) the sheet's title and subtitle say what the heading and hint say here. `initialSearch` starts the
 * search with a member's name, from the waitlist's Check ID (decision 0503).
 */
export function InPersonSection({ venueId, hasHeading = true, initialSearch }: { venueId: string; hasHeading?: boolean; initialSearch?: string | undefined }) {
  const [search, setSearch] = useState(initialSearch ?? '');
  const [member, setMember] = useState<KycCandidate | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const choose = (chosen: KycCandidate) => {
    setOutcome(null);
    setMember(chosen);
  };
  const decided = (status: Outcome['status'], checked?: DecidedClaim) => {
    setOutcome(member === null ? null : { memberId: member.memberId, name: member.fullName, status, ...(checked ? { checked } : {}) });
    setMember(null);
    setSearch('');
  };
  // Who other staff are checking now, beside each member listed (the owner, 20 Nov).
  const holders = useKycDeskClaims(venueId).data;
  return (
    <Stack gap={4}>
      {hasHeading ? <Heading level={2}>{t('console.kycInPerson.title')}</Heading> : null}
      {hasHeading ? <Text tone="muted">{t('console.kycInPerson.hint')}</Text> : null}
      {/* Always there, so the outcome is read out as it appears (F1-23). */}
      <StatusMessage>{outcome === null ? null : outcomeText(outcome)}</StatusMessage>
      <HeldBy outcome={outcome} />
      {member === null ? (
        <Stack gap={4}>
          <Input type="search" label={t('console.kycInPerson.search')} value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
          {/* On the full screen, for the floor and hosts; reviewers work from the queue beside the sheet. */}
          {search.trim().length < 2 && hasHeading ? <DueTonight venueId={venueId} holders={holders} onChoose={choose} /> : null}
          <Candidates venueId={venueId} search={search} holders={holders} onChoose={choose} />
        </Stack>
      ) : owesPhotosOnly(member) ? (
        // Keyed by the member, here and below: a photo, a detail or a consent taken for one never carries to another.
        <RetakeForm key={member.memberId} venueId={venueId} member={member} onDone={() => decided('retaken')} onCancel={() => setMember(null)} />
      ) : (
        <InPersonSteps key={member.memberId} venueId={venueId} member={member} onDecided={decided} onChecked={(claim) => decided('checked', claim)}
          onCancel={() => setMember(null)} />
      )}
    </Stack>
  );
}

/**
 * After a check refused as a duplicate: which member holds the documents (decision 0583), so the desk sees at once a check
 * saved on the wrong member. Nothing for any other refusal.
 */
function HeldBy({ outcome }: { outcome: Outcome | null }) {
  const memberId = outcome?.status === 'refused' ? outcome.memberId : null;
  const holder = useKycDuplicateHolder(memberId).data;
  if (memberId === null || !holder) return null;
  return <Text>{t('console.kycInPerson.heldBy', { name: holder.fullName, number: String(holder.memberNumber) })}</Text>;
}

/** Who other staff are checking now, by member; none known yet while the list loads. */
type Holders = ReadonlyMap<string, KycDeskHolder> | undefined;

interface CandidatesProps {
  venueId: string;
  search: string;
  holders: Holders;
  onChoose: (member: KycCandidate) => void;
}

/**
 * Who the desk should check tonight, under the search before anything is typed (audit F-091): members in the room or on a
 * list whose check is not done, the longest waiting first.
 */
function DueTonight({ venueId, holders, onChoose }: { venueId: string; holders: Holders; onChoose: (member: KycCandidate) => void }) {
  const due = useKycDueTonight(venueId);
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.kycInPerson.dueTonight')}</Heading>
      {due.isPending ? <LoadState /> : null}
      {due.isError ? <LoadState isError onRetry={() => void due.refetch()} /> : null}
      {due.data?.length === 0 ? <Text tone="muted">{t('console.kycInPerson.noneDue')}</Text> : null}
      {due.data !== undefined && due.data.length > 0 ? <CandidateRows members={due.data} holders={holders} onChoose={onChoose} /> : null}
    </Stack>
  );
}

/** The members the search finds, each with the way to check them; nothing until two characters are typed. */
function Candidates({ venueId, search, holders, onChoose }: CandidatesProps) {
  const found = useKycInPersonCandidates(venueId, search);
  if (search.trim().length < 2) return null;
  if (found.isPending) return <LoadState />;
  if (found.isError) return <LoadState isError onRetry={() => void found.refetch()} />;
  if (found.data.length === 0) return <Text tone="muted">{t('console.kycInPerson.noMatch')}</Text>;
  return <CandidateRows members={found.data} holders={holders} onChoose={onChoose} />;
}

/** Each member with the last digits of their number, where their check stands, who else is checking them, and Check. */
function CandidateRows({ members, holders, onChoose }: { members: readonly KycCandidate[]; holders: Holders; onChoose: (member: KycCandidate) => void }) {
  return (
    <Stack gap={4} divided>
      {members.map((member) => (
        <Inline key={member.memberId} gap={4} align="center" justify="between">
          <Stack gap={1}>
            <Text variant="row" weight="medium"><MemberLink memberId={member.memberId}>{member.fullName}</MemberLink></Text>
            <Text variant="secondary" tone="muted">{t('console.kycInPerson.phoneEnding', { digits: member.phoneLast4 })}</Text>
            {member.status === null ? null : (
              <Text variant="secondary" tone="muted">{t(candidateLine(member))}</Text>
            )}
            <HolderLine holder={holders?.get(member.memberId)} />
          </Stack>
          {/* One short word on a row's button (console v3), its full name read out, so it never wraps in the sheet. */}
          <Button variant="subtle" size="small" aria-label={t('console.kycInPerson.checkName', { name: member.fullName })} onClick={() => onChoose(member)}>
            {t('console.kycInPerson.check')}
          </Button>
        </Inline>
      ))}
    </Stack>
  );
}

/** Who else is checking a member now, and since when; nothing for a member no one else has started. */
function HolderLine({ holder }: { holder: KycDeskHolder | undefined }) {
  if (holder === undefined) return null;
  return <Text variant="secondary" weight="medium">{t('console.kycInPerson.beingChecked', { name: holder.staffName, time: formatTime(holder.since) })}</Text>;
}

/** Where a member's check stands: a photo sent back, waiting for its PAN, let in by their selfie, or started in the app and never finished. */
function candidateLine(member: KycCandidate): MessageKey {
  if (member.retakes.length > 0) return 'console.kycInPerson.sentBack';
  if (member.status === 'needs_pan') return 'console.kycInPerson.heldForPan';
  return member.clubSelfiePath === null ? 'console.kycInPerson.startedOnApp' : 'console.kycInPerson.atTheClub';
}
