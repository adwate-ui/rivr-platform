import { useSopLibrary, useStaffVenue, type Sop } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SopDetail } from './SopDetail.tsx';
import { SopForm } from './SopForm.tsx';
import { standingText, versionText, waitingText } from './sopCopy.ts';

/** One SOP in the library: its version, where the staff member stands, managers' count, and Read. */
function SopRow({ sop, canManage, onRead }: { sop: Sop; canManage: boolean; onRead: () => void }) {
  const standing = standingText(sop);
  return (
    <Stack gap={2}>
      <Text weight="semibold">{sop.title}</Text>
      {sop.current === null ? null : <Text variant="small" tone="muted">{versionText(sop.current)}</Text>}
      {sop.waiting.map((version) => <Text key={version.versionId} variant="small" tone="muted">{waitingText(version)}</Text>)}
      {standing === null ? null : <Text variant="small">{standing}</Text>}
      {canManage && sop.current !== null
        ? <Text variant="small">{t('console.sops.progress', { count: sop.acknowledgedCount, total: sop.requiredCount })}</Text>
        : null}
      <Inline><Button variant="secondary" onClick={onRead}>{t('console.sops.read', { title: sop.title })}</Button></Inline>
    </Stack>
  );
}

type View = { readonly kind: 'list' } | { readonly kind: 'sop'; readonly sopId: string } | { readonly kind: 'add' };

function Library({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const library = useSopLibrary(venueId);
  const [view, setView] = useState<View>({ kind: 'list' });
  const title = t('console.sops.title');
  const toList = () => setView({ kind: 'list' });
  if (library.isPending) return <Screen title={title} status="loading" />;
  // A failed refresh keeps what was known, so a version half written stays.
  if (library.data === undefined) return <Screen title={title} status="error" onRetry={() => void library.refetch()} />;
  const open = view.kind === 'sop' ? library.data.find((sop) => sop.sopId === view.sopId) : undefined;
  if (open !== undefined) return <SopDetail venueId={venueId} sop={open} canManage={canManage} onBack={toList} />;
  if (view.kind === 'add') return <Screen title={t('console.sops.newSop')}><SopForm venueId={venueId} onDone={toList} /></Screen>;
  const add = canManage ? <Button variant="primary" onClick={() => setView({ kind: 'add' })}>{t('console.sops.add')}</Button> : undefined;
  if (library.data.length === 0) return <Screen title={title} actions={add} status="empty" emptyText={t('console.sops.empty')} />;
  return (
    <Screen title={title} actions={add}>
      <Stack gap={6} divided>
        {library.data.map((sop) => <SopRow key={sop.sopId} sop={sop} canManage={canManage} onRead={() => setView({ kind: 'sop', sopId: sop.sopId })} />)}
      </Stack>
    </Screen>
  );
}

/**
 * SOPs (#51; scope-v1 module 11): the venue's library, each SOP at its version in force with its
 * owner and day. Staff read and acknowledge the versions their role must; staff who manage SOPs add
 * SOPs, publish versions from a day, and see who has acknowledged.
 */
export function SopsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  return <Library key={venueId} venueId={venueId} canManage={permissions.includes('sops.manage')} />;
}
