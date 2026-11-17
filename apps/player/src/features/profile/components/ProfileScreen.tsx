import { useFeature, useKycImageUrl, useKycRecord, useMember, useMyPhotoPath, usePreferences, useSignedInPhone } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Box, DeskHelp, DetailRow, FeatureGate, ProfileCard, Screen, Stack, Text, useHeadingFocus, usePageTitle } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useId, useState, type ReactNode } from 'react';
import { DeleteAccountRow } from './DeleteAccount.tsx';
import { FeedbackSheet } from './FeedbackSection.tsx';
import { NotificationsSection } from './NotificationsSection.tsx';
import { SignOutSection } from './SignOutSection.tsx';

/** A group of rows under its gold eyebrow: Account, Notifications, Club. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="accent">{title}</Text>
      <Box>{children}</Box>
    </Stack>
  );
}

/**
 * The identity check: verified, or, for a member let in by their selfie (decision 0502), at the desk on the first visit,
 * which opens what to bring.
 */
function IdentityRow() {
  const navigate = useNavigate();
  const kyc = useKycRecord();
  if (kyc.data?.status === 'started' && kyc.data.isAtTheClub) {
    return <DetailRow label={t('player.profile.identity')} value={t('player.profile.atTheDesk')} onOpen={() => void navigate({ to: '/kyc' })} isLast />;
  }
  return <DetailRow label={t('player.profile.identity')} value={t('player.profile.verified')} valueTone="accent" isLast />;
}

/**
 * The member at the top, from their own record, as one card (the owner, 17 Nov): their own photo or initial, their name,
 * their tier with their phone ("Founders' Circle · +91 90000 00901", once both are known), and their member number.
 */
function ProfileHead({ headingId }: { headingId: string }) {
  const member = useMember().data;
  const phone = useSignedInPhone().data ?? null;
  // Their own photo, before the desk has checked them too (decision 0588), filling the mark; the initial until it comes.
  const photo = useKycImageUrl(useMyPhotoPath().data ?? null).data ?? undefined;
  if (!member) return <ProfileCard initial="" photo={photo} name="" headingId={headingId} details={[]} />;
  const tierPhone = phone === null ? [] : [t('player.profile.tierPhone', { tier: member.tierName, phone: formatMobile(phone) })];
  const details = [...tierPhone, t('player.profile.memberNumber', { number: member.memberNumber })];
  return <ProfileCard initial={member.initial} photo={photo} name={member.fullName} headingId={headingId} details={details} />;
}

/** Club: House rules, Send feedback, and Delete my account. */
function ClubGroup({ onFeedback }: { onFeedback: () => void }) {
  const navigate = useNavigate();
  const deleteAccount = useFeature('account.delete');
  return (
    <Group title={t('player.profile.club')}>
      <DetailRow label={t('player.houseRules.title')} onOpen={() => void navigate({ to: '/profile/rules' })} />
      <DetailRow label={t('player.profile.sendFeedback')} onOpen={onFeedback} />
      <FeatureGate access={deleteAccount}><DeleteAccountRow /></FeatureGate>
    </Group>
  );
}

/**
 * Profile, the fourth tab (redesign, 15 Nov): the member; Account (the identity check); Notifications; Club; Sign out.
 * The games, limits and break sections are gone from the app (decision 0322); their data and the server's enforcement stay.
 */
export function ProfileScreen() {
  const preferences = usePreferences();
  const [isFeedbackOpen, setFeedbackOpen] = useState(false);
  const headingId = useId();
  // Drawn without a Screen's title, so it names the page and takes the focus as a Screen would (WCAG 2.4.2).
  usePageTitle(t('player.profile.title'), preferences.data !== undefined);
  useHeadingFocus(headingId, preferences.data !== undefined);
  if (preferences.data === undefined) {
    // Sign out works offline, so it stays within reach when Profile cannot load.
    return (
      <Stack gap={4}>
        <Screen title={t('player.profile.title')} isTitleHidden status={preferences.isError ? 'error' : 'loading'} loadingLook="skeleton" onRetry={() => void preferences.refetch()} />
        <SignOutSection />
        <DeskHelp />
      </Stack>
    );
  }
  return (
    <Stack gap={6}>
      <ProfileHead headingId={headingId} />
      <Group title={t('player.profile.account')}>
        <IdentityRow />
      </Group>
      <Group title={t('player.profile.notifications')}><NotificationsSection preferences={preferences.data} /></Group>
      <ClubGroup onFeedback={() => setFeedbackOpen(true)} />
      <SignOutSection />
      {/* The way to the front desk, last, as at the foot of every step (WCAG 3.2.6). */}
      <DeskHelp />
      <FeedbackSheet isOpen={isFeedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Stack>
  );
}
