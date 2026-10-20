import { useMyTvScreen } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Stack, Text } from '@rivr/ui';
import { JackpotMode } from './JackpotMode.tsx';
import { PromotionsMode } from './PromotionsMode.tsx';
import { WaitlistMode } from './WaitlistMode.tsx';

/**
 * A paired TV: the mode the console gave it. It asks again every ten seconds, so a new mode shows
 * without a reload, and an unpaired TV signs itself out and shows a new code. The waitlist board and
 * the jackpot are built (#65), and the promotions rotation (#86); the other modes show their name under the TV's until they are.
 */
export function ModeScreen() {
  const screen = useMyTvScreen();
  if (screen.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(screen.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  // Null while an unpaired TV signs itself out; the code follows.
  if (screen.data === null) return null;
  if (screen.data.mode === 'waitlist') return <WaitlistMode venueId={screen.data.venueId} />;
  if (screen.data.mode === 'jackpot') return <JackpotMode venueId={screen.data.venueId} />;
  if (screen.data.mode === 'promotions') return <PromotionsMode venueId={screen.data.venueId} />;
  return (
    <Stack gap={4}>
      <Heading level={1} variant="display">{t(`tv.modes.${screen.data.mode}`)}</Heading>
      <Text variant="tvBody" tone="muted">{screen.data.name}</Text>
    </Stack>
  );
}
