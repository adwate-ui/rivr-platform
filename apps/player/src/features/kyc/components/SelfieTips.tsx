import { t } from '@rivr/i18n';
import { Heading, Stack, Text } from '@rivr/ui';

const TIPS = ['tipLight', 'tipCamera', 'tipClear', 'tipAlone', 'tipOnce'] as const;

/**
 * How to take a selfie that passes, before the camera opens (issue 720, owner 2 Nov): a check keeps one selfie, so it is worth
 * getting right the first time.
 */
export function SelfieTips() {
  return (
    <Stack gap={2}>
      <Heading level={2} variant="subsection">{t('player.kyc.tipsTitle')}</Heading>
      <Stack gap={1}>
        {TIPS.map((tip) => <Text key={tip} variant="small" tone="muted">{t(`player.kyc.${tip}`)}</Text>)}
      </Stack>
    </Stack>
  );
}
