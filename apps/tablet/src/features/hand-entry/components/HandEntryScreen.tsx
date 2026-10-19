import { useCurrentDown, useMyDevice, useTableRules } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen } from '@rivr/ui';
import { HandForm } from './HandForm.tsx';
import { LastHands } from './LastHands.tsx';

/**
 * Hand entry (#42), during a dealer's down (the frame asks for sign-in between downs), as in the
 * prototype: the down's last hands beside the pot keypad, the game, the rake, drop and pull as the
 * pot is typed, and Log hand. A new down starts with an empty keypad.
 */
export function HandEntryScreen() {
  const device = useMyDevice();
  const tableId = device.data?.tableId ?? null;
  const down = useCurrentDown(tableId);
  const rules = useTableRules(tableId);
  const title = t('tablet.handEntry.title');
  if (tableId === null) return <Screen title={title} status="empty" emptyText={t('tablet.handEntry.empty')} />;
  if (rules.isPending) return <Screen title={title} status="loading" />;
  if (rules.data === undefined) return <Screen title={title} status="error" onRetry={() => void rules.refetch()} />;
  if (rules.data === null) return <Screen title={title} status="empty" emptyText={t('tablet.handEntry.noRake')} />;
  const downId = down.data?.downId ?? null;
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        <LastHands downId={downId} />
        <HandForm key={downId} rules={rules.data} />
      </Grid>
    </Screen>
  );
}
