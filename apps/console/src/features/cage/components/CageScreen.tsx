import { useCageMembers, useStaffVenue, useTreasury } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Grid, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CageQueue } from './CageQueue.tsx';
import { DepositsToConfirm } from './DepositsToConfirm.tsx';
import { MemberPanel } from './MemberPanel.tsx';
import { MemberSearch } from './MemberSearch.tsx';
import { PayoutsToVerify } from './PayoutsToVerify.tsx';

/**
 * The cage (#57), as in the prototype: find a member, or take a buy-in the table asked for from the
 * queue, beside the member's KYC photo, balances and where they sit, and the buy-in itself; and verify
 * the payout accounts members add (#19); and confirm members' UPI deposits against the bank (#29).
 * Cash-out and markers join with #75 and #74.
 */
export function CageScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.cage.title');
  if (!staff.venue.permissions.includes('cage.transact')) {
    return <Screen title={title} status="error" errorText={t('console.cage.notAllowed')} />;
  }
  return <Cage title={title} venueId={staff.venue.venueId} canIssueMarkers={staff.venue.permissions.includes('markers.issue')} />;
}

function Cage({ title, venueId, canIssueMarkers }: { title: string; venueId: string; canIssueMarkers: boolean }) {
  // The member chosen, by id and the search that found them, so a buy-in's reload shows their new wallet.
  const [chosen, setChosen] = useState<{ memberId: string; query: string } | null>(null);
  const found = useCageMembers(venueId, chosen?.query ?? '');
  const member = found.data?.find((candidate) => candidate.memberId === chosen?.memberId);
  // The cage takes and pays nothing while no shift is open (#376); the refusal itself is the database's.
  const treasury = useTreasury(venueId);
  return (
    <Screen title={title}>
      {treasury.data?.shift === null ? (
        <Box surface="alert" padding={3} radius="sm"><Text tone="onAlert">{t('console.cage.noShiftBanner')}</Text></Box>
      ) : null}
      <Grid columns={2} gap={8}>
        <Stack gap={8}>
          <MemberSearch venueId={venueId} onChoose={(picked, query) => setChosen({ memberId: picked.memberId, query })} />
          <CageQueue venueId={venueId} />
          <DepositsToConfirm venueId={venueId} />
          <PayoutsToVerify venueId={venueId} />
        </Stack>
        {member === undefined ? <Text tone="muted">{t('console.cage.choose')}</Text>
          : <MemberPanel key={member.memberId} venueId={venueId} member={member} canIssueMarkers={canIssueMarkers} />}
      </Grid>
    </Screen>
  );
}
