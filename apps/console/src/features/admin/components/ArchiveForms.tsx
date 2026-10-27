import { isMemberQuery, useMemberSearch, type MemberRow } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Input, Stack, Switch, Text, TextArea, LoadState } from '@rivr/ui';
import { useState } from 'react';

/** The full archive: KYC photos only with a written reason of ten characters or more. */
export function FullArchiveForm({ isRunning, onMake }: { isRunning: boolean; onMake: (kycReason: string | null) => void }) {
  const [withPhotos, setWithPhotos] = useState(false);
  const [reason, setReason] = useState('');
  const [isShort, setIsShort] = useState(false);
  const make = () => {
    const isTooShort = withPhotos && reason.trim().length < 10;
    setIsShort(isTooShort);
    if (!isTooShort) onMake(withPhotos ? reason.trim() : null);
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.exportArchive.fullTitle')}</Heading>
      <Text>{t('console.exportArchive.fullIntro')}</Text>
      <Switch label={t('console.exportArchive.kycPhotos')} hint={t('console.exportArchive.kycPhotosHint')} isOn={withPhotos} onChange={setWithPhotos} isDisabled={isRunning} />
      {withPhotos ? (
        <TextArea label={t('console.exportArchive.kycReason')} rows={2} value={reason} onChange={(event) => setReason(event.target.value)}
          error={isShort ? t('console.exportArchiveFailures.reasonShort') : undefined} />
      ) : null}
      <Stack gap={3} align="start">
        <Button variant="primary" isLoading={isRunning} onClick={make}>{t('console.exportArchive.make')}</Button>
      </Stack>
    </Stack>
  );
}

/** The members a search finds, each with its export button; the search's own loading, empty and error states. */
function MemberChoices({ query, isRunning, onExport, venueId }: { query: string; isRunning: boolean; onExport: (member: MemberRow) => void; venueId: string }) {
  const found = useMemberSearch(venueId, query);
  if (!isMemberQuery(query)) return null;
  if (found.isPending) return <LoadState />;
  if (found.isError) return <ErrorMessage>{t('console.exportArchiveFailures.unavailable')}</ErrorMessage>;
  if (found.data.length === 0) return <Text tone="muted">{t('console.exportArchive.memberNone')}</Text>;
  return (
    <Stack gap={2} align="start">
      {found.data.slice(0, 10).map((member) => (
        <Button key={member.memberId} isDisabled={isRunning} onClick={() => onExport(member)}>
          {t('console.exportArchive.memberExport', { name: member.fullName, number: String(member.memberNumber) })}
        </Button>
      ))}
    </Stack>
  );
}

/** One member's data, for an access request: find the member, then export. */
export function MemberArchiveForm({ venueId, isRunning, onExport }: { venueId: string; isRunning: boolean; onExport: (member: MemberRow) => void }) {
  const [query, setQuery] = useState('');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.exportArchive.memberTitle')}</Heading>
      <Text>{t('console.exportArchive.memberIntro')}</Text>
      <Input label={t('console.exportArchive.memberSearch')} type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      <MemberChoices query={query} isRunning={isRunning} onExport={onExport} venueId={venueId} />
    </Stack>
  );
}
