import { useHouseRules, type HouseRules } from '@rivr/db/houseRules';
import { formatNumber, t } from '@rivr/i18n';
import { BackButton, Figure, Heading, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';

/** The rules, each with its number in gold, then the legal standing and its cases, each between hairlines (brief 3.10). */
function Rules({ rules }: { rules: HouseRules }) {
  return (
    <Stack gap={8}>
      <Stack gap={3} divided>
        {rules.rules.map((rule, index) => (
          <Inline key={`${String(index)}-${rule}`} gap={4} align="start">
            <Figure size="numeral" tone="money">{formatNumber(index + 1)}</Figure>
            <Text>{rule}</Text>
          </Inline>
        ))}
      </Stack>
      {rules.legal === null ? null : (
        <Stack gap={3}>
          <Heading level={2} variant="serif" serifSize={28}>{rules.legal.heading ?? t('player.houseRules.legal')}</Heading>
          {rules.legal.intro === null ? null : <Text tone="muted">{rules.legal.intro}</Text>}
          <Stack gap={3} divided>
            {rules.legal.cases.map((legalCase) => (
              <Stack key={`${legalCase.when}-${legalCase.title}`} gap={1}>
                <Text variant="small" tone="accent">{legalCase.when}</Text>
                <Text weight="medium">{legalCase.title}</Text>
                {legalCase.text === null ? null : <Text variant="small" tone="muted">{legalCase.text}</Text>}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * House rules (brief 3.10; #637), from Profile: back to Profile, the title and its line, the club's rules numbered in gold,
 * then that poker is a game of skill and the cases that say so. The club writes them (decision 0296).
 */
export function HouseRulesScreen() {
  const rules = useHouseRules();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Back to where it was opened from, or to /profile in its place: never a new entry on top (owner, 8 Nov).
  const toProfile = () => (canGoBack ? router.history.back() : void navigate({ to: '/profile', replace: true }));
  const title = t('player.houseRules.title');
  const back = <BackButton label={t('player.profile.title')} onBack={toProfile} />;
  const look = { titleLook: 'serif' } as const;
  if (rules.isError) return <Stack gap={2}>{back}<Screen {...look} title={title} status="error" onRetry={() => void rules.refetch()} /></Stack>;
  if (rules.data === undefined) return <Stack gap={2}>{back}<Screen {...look} title={title} status="loading" loadingLook="skeleton" /></Stack>;
  if (rules.data.rules.length === 0 && rules.data.legal === null) {
    return <Stack gap={2}>{back}<Screen {...look} title={title} status="empty" emptyText={t('player.houseRules.empty')} /></Stack>;
  }
  return (
    <Stack gap={2}>
      {back}
      <Screen {...look} title={title}>
        <Stack gap={6}>
          <Text tone="muted">{rules.data.intro ?? t('player.houseRules.appliesAtEveryTable')}</Text>
          <Rules rules={rules.data} />
        </Stack>
      </Screen>
    </Stack>
  );
}
