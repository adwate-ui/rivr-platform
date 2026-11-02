import { useFeature, useKycImageUrl, useMember, useMembershipCard, usePreferences, useSignedInPhone } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Box, Button, DetailRow, FeatureGate, Heading, Inline, KycPhoto, kycPhotoStatus, ProfileMark, Screen, Stack, Text } from '@rivr/ui';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
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

/** The member's verified selfie (decision 0300), filling the mark. */
function HeadPhoto({ path }: { path: string }) {
  const photo = useKycImageUrl(path);
  return <KycPhoto isFilling alt={t('player.card.photo')} src={photo.data ?? null} status={kycPhotoStatus(path, photo)} />;
}

/** "Founders' Circle · +91 90000 00901", once both are known. */
function TierPhone({ tier }: { tier: string }) {
  const phone = useSignedInPhone().data ?? null;
  return phone === null ? null : <Text variant="small" tone="muted">{t('player.profile.tierPhone', { tier, phone: formatMobile(phone) })}</Text>;
}

/** The member at the top: their verified selfie or initial, their name, and their tier with their number. */
function ProfileHead() {
  const member = useMember().data;
  const card = useMembershipCard().data ?? null;
  const path = card?.photoPath ?? null;
  return (
    <Inline gap={4} align="center">
      <ProfileMark initial={member?.initial ?? ''} photo={path === null ? undefined : <HeadPhoto path={path} />} />
      <Stack gap={1}>
        <Heading level={1} variant="serif" serifSize={28}>{member?.fullName ?? ''}</Heading>
        {card === null ? null : <TierPhone tier={card.tierName} />}
      </Stack>
    </Inline>
  );
}

/** Club: House rules, Learn and Events where the member has them, Send feedback, and how to have their data erased. */
function ClubGroup({ onFeedback }: { onFeedback: () => void }) {
  const navigate = useNavigate();
  const learn = useFeature('learn.library');
  const events = useFeature('events.book');
  return (
    <Group title={t('player.profile.club')}>
      <DetailRow label={t('player.houseRules.title')} onOpen={() => void navigate({ to: '/profile/rules' })} />
      {/* Learn and Events lost their tabs in the redesign; the owner decides where they live (decision 0322). */}
      <FeatureGate access={learn}><DetailRow label={t('player.profile.learn')} onOpen={() => void navigate({ to: '/learn' })} /></FeatureGate>
      <FeatureGate access={events}><DetailRow label={t('player.profile.events')} onOpen={() => void navigate({ to: '/events' })} /></FeatureGate>
      <DetailRow label={t('player.profile.sendFeedback')} onOpen={onFeedback} />
      <Box paddingY={3} hairline="top"><Text variant="small" tone="muted">{t('player.profile.erasure')}</Text></Box>
    </Group>
  );
}

/**
 * Profile (brief 3.9), behind the member's initial, with no tab: Back to the last tab; the member; Account (the card, the
 * identity check); Notifications; Club; Sign out. The games, limits and break sections are gone from the app (decision
 * 0322); their data and the server's enforcement stay.
 */
export function ProfileScreen() {
  const preferences = usePreferences();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [isFeedbackOpen, setFeedbackOpen] = useState(false);
  const back = <Box><Button variant="text" icon="chevronLeft" onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}>{t('player.profile.back')}</Button></Box>;
  if (preferences.data === undefined) {
    // Sign out works offline, so it stays within reach when Profile cannot load.
    return (
      <Stack gap={4}>
        {back}
        <Screen title={t('player.profile.title')} isTitleHidden status={preferences.isError ? 'error' : 'loading'} loadingLook="skeleton" onRetry={() => void preferences.refetch()} />
        <SignOutSection />
      </Stack>
    );
  }
  return (
    <Stack gap={6}>
      {back}
      <ProfileHead />
      <Group title={t('player.profile.account')}>
        <DetailRow label={t('player.profile.card')} onOpen={() => void navigate({ to: '/card' })} />
        <DetailRow label={t('player.profile.identity')} value={t('player.profile.verified')} valueTone="accent" isLast />
      </Group>
      <Group title={t('player.profile.notifications')}><NotificationsSection preferences={preferences.data} /></Group>
      <ClubGroup onFeedback={() => setFeedbackOpen(true)} />
      <SignOutSection />
      <FeedbackSheet isOpen={isFeedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Stack>
  );
}
