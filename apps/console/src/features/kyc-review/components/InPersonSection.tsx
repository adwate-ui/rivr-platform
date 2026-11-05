import { useKycInPersonCandidates, type KycCandidate, type KycInPersonOutcome } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, StatusMessage, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';
import { InPersonForm } from './InPersonForm.tsx';

/** The last check in person and where it ended, said once the form closes. */
interface Outcome {
  name: string;
  status: KycInPersonOutcome;
}

const OUTCOME_COPY: Readonly<Record<KycInPersonOutcome, MessageKey>> = {
  verified: 'console.kycInPerson.verified',
  refused: 'console.kycInPerson.refused',
  needs_review: 'console.kycInPerson.needsReview',
};

/**
 * A check in person (#246, while no KYC vendor is live): the reviewer finds a member at the club by
 * name or the last digits of their number, then checks them against their original documents. Only
 * members with no check, or one the app never finished, are found; never the reviewer themselves. In its sheet
 * (`hasHeading` false) the sheet's title and subtitle say what the heading and hint say here.
 */
export function InPersonSection({ venueId, hasHeading = true }: { venueId: string; hasHeading?: boolean }) {
  const [search, setSearch] = useState('');
  const [member, setMember] = useState<KycCandidate | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const choose = (chosen: KycCandidate) => {
    setOutcome(null);
    setMember(chosen);
  };
  const decided = (status: Outcome['status']) => {
    setOutcome(member === null ? null : { name: member.fullName, status });
    setMember(null);
    setSearch('');
  };
  return (
    <Stack gap={4}>
      {hasHeading ? <Heading level={2}>{t('console.kycInPerson.title')}</Heading> : null}
      {hasHeading ? <Text tone="muted">{t('console.kycInPerson.hint')}</Text> : null}
      {/* Always there, so the outcome is read out as it appears (F1-23). */}
      <StatusMessage>{outcome === null ? null : t(OUTCOME_COPY[outcome.status], { name: outcome.name })}</StatusMessage>
      {member === null ? (
        <Stack gap={4}>
          <Input type="search" label={t('console.kycInPerson.search')} value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
          <Candidates venueId={venueId} search={search} onChoose={choose} />
        </Stack>
      ) : (
        <InPersonForm venueId={venueId} member={member} onDecided={decided} onCancel={() => setMember(null)} />
      )}
    </Stack>
  );
}

interface CandidatesProps {
  venueId: string;
  search: string;
  onChoose: (member: KycCandidate) => void;
}

/** The members the search finds, each with the way to check them; nothing until two characters are typed. */
function Candidates({ venueId, search, onChoose }: CandidatesProps) {
  const found = useKycInPersonCandidates(venueId, search);
  if (search.trim().length < 2) return null;
  if (found.isPending) return <LoadState />;
  if (found.isError) return <LoadState isError onRetry={() => void found.refetch()} />;
  if (found.data.length === 0) return <Text tone="muted">{t('console.kycInPerson.noMatch')}</Text>;
  return (
    <Stack gap={4} divided>
      {found.data.map((member) => (
        <Inline key={member.memberId} gap={4} align="center" justify="between">
          <Stack gap={1}>
            <Text variant="row" weight="medium">{member.fullName}</Text>
            <Text variant="secondary" tone="muted">{t('console.kycInPerson.phoneEnding', { digits: member.phoneLast4 })}</Text>
            {member.status === null ? null : (
              <Text variant="secondary" tone="muted">
                {t(member.clubSelfiePath === null ? 'console.kycInPerson.startedOnApp' : 'console.kycInPerson.atTheClub')}
              </Text>
            )}
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
