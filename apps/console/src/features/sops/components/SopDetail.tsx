import { useSopActions, type Sop, type SopFailure, type SopVersion } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { AckTable } from './AckTable.tsx';
import { SopForm } from './SopForm.tsx';
import { bodyLines, rolesText, sopFailureText, standingText, versionText, waitingText } from './sopCopy.ts';

/** A version's text, a line at a time. */
function Body({ version }: { version: SopVersion }) {
  return <Stack gap={2}>{bodyLines(version.body).map((line, at) => <Text key={`${at}:${line}`}>{line}</Text>)}</Stack>;
}

/** Acknowledge, while the staff member's role must and they have not; hidden while a manager writes a version. */
function AcknowledgeButton({ venueId, versionId }: { venueId: string; versionId: string }) {
  const { acknowledge } = useSopActions(venueId);
  const [failure, setFailure] = useState<SopFailure | null>(null);
  const send = async () => {
    const done = await acknowledge.mutateAsync(versionId);
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={2}>
      <Inline><Button variant="primary" isLoading={acknowledge.isPending} onClick={() => void send()}>{t('console.sops.acknowledge')}</Button></Inline>
      {failure === null ? null : <ErrorMessage>{sopFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}

/** The version in force: who owns it, who must acknowledge it, its text, and where the staff member stands. */
function CurrentVersion({ venueId, sop, current, canAcknowledge }: { venueId: string; sop: Sop; current: SopVersion; canAcknowledge: boolean }) {
  const standing = standingText(sop);
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{versionText(current)}</Text>
        <Text variant="small" tone="muted">{rolesText(current.ackRoles)}</Text>
      </Stack>
      <Body version={current} />
      {standing === null ? null : <Text weight="medium">{standing}</Text>}
      {canAcknowledge && sop.mustAcknowledge && sop.acknowledgedAt === null ? <AcknowledgeButton venueId={venueId} versionId={current.versionId} /> : null}
    </Stack>
  );
}

/** The next version, waiting for its day: when, who owns it, who must acknowledge it, and its text. */
function NextVersion({ next }: { next: SopVersion }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.sops.nextVersion')}</Heading>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{waitingText(next)}</Text>
        <Text variant="small" tone="muted">{t('console.sops.nextOwner', { owner: next.owner })}</Text>
        <Text variant="small" tone="muted">{rolesText(next.ackRoles)}</Text>
      </Stack>
      <Body version={next} />
    </Stack>
  );
}

interface SopDetailProps {
  venueId: string;
  sop: Sop;
  canManage: boolean;
  onBack: () => void;
}

/** One SOP: its version in force to read and acknowledge, each version waiting for its day, and for managers who has acknowledged and New version. */
export function SopDetail({ venueId, sop, canManage, onBack }: SopDetailProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  return (
    <Screen title={sop.title} actions={<Button variant="text" onClick={onBack}>{t('console.sops.back')}</Button>}>
      <Stack gap={8}>
        {sop.current === null ? null : <CurrentVersion venueId={venueId} sop={sop} current={sop.current} canAcknowledge={!isPublishing} />}
        {sop.waiting.map((version) => <NextVersion key={version.versionId} next={version} />)}
        {canManage && sop.current !== null ? <AckTable versionId={sop.current.versionId} /> : null}
        {canManage ? (
          <Stack gap={4}>
            <Heading level={2}>{t('console.sops.newVersion')}</Heading>
            {isPublishing
              ? <SopForm venueId={venueId} sop={sop} onDone={() => setIsPublishing(false)} />
              : <Inline><Button variant="secondary" onClick={() => setIsPublishing(true)}>{t('console.sops.newVersion')}</Button></Inline>}
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}
