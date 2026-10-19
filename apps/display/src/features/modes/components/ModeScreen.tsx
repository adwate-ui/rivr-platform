import { useMyTvScreen } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Stack, Text } from '@rivr/ui';

/**
 * A paired TV: the mode the console gave it, under its name. It asks again every ten seconds, so a
 * new mode shows without a reload, and an unpaired TV signs itself out and shows a new code. The
 * modes themselves (waitlist board, jackpot and the rest) replace the mode's name as they are built.
 */
export function ModeScreen() {
  const screen = useMyTvScreen();
  if (screen.data === undefined) {
    return screen.isError ? <Text variant="tvBody" tone="muted">{t('display.screen.unavailable')}</Text> : null;
  }
  // Null while an unpaired TV signs itself out; the code follows.
  if (screen.data === null) return null;
  return (
    <Stack gap={4}>
      <Heading level={1} variant="display">{t(`tv.modes.${screen.data.mode}`)}</Heading>
      <Text variant="tvLabel" tone="muted">{screen.data.name}</Text>
    </Stack>
  );
}
