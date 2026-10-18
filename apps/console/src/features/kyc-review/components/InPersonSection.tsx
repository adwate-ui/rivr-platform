import { useKycInPersonCandidates, type KycCandidate } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { InPersonForm } from './InPersonForm.tsx';

/** The last check in person and where it ended, said once the form closes. */
interface Outcome {
  name: string;
  status: 'verified' | 'refused';
}

/**
 * A check in person (#246, while no KYC vendor is live): the reviewer finds a member at the club by
 * name or the last digits of their number, then checks them against their original documents. Only
 * members with no check, or one the app never finished, are found; never the reviewer themselves.
 */
export function InPersonSection({ venueId }: { venueId: string }) {
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
      <Heading level={2}>{t('console.kycInPerson.title')}</Heading>
      <Text tone="muted">{t('console.kycInPerson.hint')}</Text>
      {outcome === null ? null : (
        <Text weight="medium">
          {t(outcome.status === 'verified' ? 'console.kycInPerson.verified' : 'console.kycInPerson.refused', { name: outcome.name })}
        </Text>
      )}
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
  if (found.isPending) return <Text tone="muted">{t('common.loading')}</Text>;
  if (found.isError) return <ErrorMessage>{t('console.kycInPersonFailures.unavailable')}</ErrorMessage>;
  if (found.data.length === 0) return <Text tone="muted">{t('console.kycInPerson.noMatch')}</Text>;
  return (
    <Stack gap={4} divided>
      {found.data.map((member) => (
        <Inline key={member.memberId} gap={4} align="center" justify="between">
          <Stack gap={1}>
            <Text weight="medium">{member.fullName}</Text>
            <Text variant="small" tone="muted">{t('console.kycInPerson.phoneEnding', { digits: member.phoneLast4 })}</Text>
            {member.status === null ? null : <Text variant="small" tone="muted">{t('console.kycInPerson.startedOnApp')}</Text>}
          </Stack>
          <Button variant="secondary" onClick={() => onChoose(member)}>
            {t('console.kycInPerson.checkName', { name: member.fullName })}
          </Button>
        </Inline>
      ))}
    </Stack>
  );
}
