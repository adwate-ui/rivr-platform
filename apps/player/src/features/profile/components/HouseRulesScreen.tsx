import { useHouseRules, type HouseRules } from '@rivr/db/houseRules';
import { formatNumber, t } from '@rivr/i18n';
import { Button, Heading, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The house rules, numbered, then the cases behind poker's legal standing, as the club publishes them on its website. */
function Rules({ rules }: { rules: HouseRules }) {
  return (
    <Stack gap={8}>
      <Stack gap={3}>
        {rules.intro === null ? null : <Text tone="muted">{rules.intro}</Text>}
        {rules.rules.map((rule, index) => (
          <Text key={`${String(index)}-${rule}`}>{t('player.houseRules.rule', { number: formatNumber(index + 1), rule })}</Text>
        ))}
      </Stack>
      {rules.legal === null ? null : (
        <Stack gap={3}>
          <Heading level={2}>{rules.legal.heading ?? t('player.houseRules.legal')}</Heading>
          {rules.legal.intro === null ? null : <Text tone="muted">{rules.legal.intro}</Text>}
          <Stack gap={3} divided>
            {rules.legal.cases.map((legalCase) => (
              <Stack key={`${legalCase.when}-${legalCase.title}`} gap={1}>
                <Text weight="medium">{t('player.houseRules.case', { when: legalCase.when, title: legalCase.title })}</Text>
                {legalCase.text === null ? null : <Text variant="small" tone="muted">{legalCase.text}</Text>}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

/** House rules in Settings (#637): the club's house rules and the legal standing, whatever the member's tier. */
export function HouseRulesScreen() {
  const rules = useHouseRules();
  const navigate = useNavigate();
  const title = t('player.houseRules.title');
  const back = <Button variant="text" icon="chevronLeft" onClick={() => void navigate({ to: '/profile' })}>{t('common.back')}</Button>;
  if (rules.isError) return <Screen title={title} actions={back} status="error" onRetry={() => void rules.refetch()} />;
  if (rules.data === undefined) return <Screen title={title} actions={back} status="loading" />;
  if (rules.data.rules.length === 0 && rules.data.legal === null) {
    return <Screen title={title} actions={back} status="empty" emptyText={t('player.houseRules.empty')} />;
  }
  return <Screen title={title} actions={back}><Rules rules={rules.data} /></Screen>;
}
