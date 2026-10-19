import { useRakeChangeActions, type RakeChangeFailure, type TableTypeRake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Stakes, Text } from '@rivr/ui';
import { useState } from 'react';
import { rakeFailureText, ruleText, whenOf } from './rakeCopy.ts';

/** One table type: its stakes, the rule in force now, and the changes to come, each of which can be withdrawn. */
export function TableTypeRakeRow({ venueId, type }: { venueId: string; type: TableTypeRake }) {
  const { withdraw } = useRakeChangeActions(venueId);
  const [failure, setFailure] = useState<RakeChangeFailure | null>(null);
  const withdrawChange = async (settingId: string) => {
    const withdrawn = await withdraw.mutateAsync(settingId);
    setFailure(withdrawn.ok ? null : withdrawn.error);
  };
  return (
    <Stack gap={2}>
      <Inline gap={3}>
        <Text weight="semibold">{type.name}</Text>
        <Stakes smallBlind={type.smallBlind} bigBlind={type.bigBlind} tone="muted" />
      </Inline>
      <Text>{type.inForce === null ? t('console.rake.noRule') : ruleText(type.inForce)}</Text>
      {type.scheduled.length === 0 ? <Text variant="small" tone="muted">{t('console.rake.noChanges')}</Text> : null}
      {type.scheduled.map((change) => (
        <Inline key={change.settingId} gap={4} justify="between" wrap>
          <Text variant="small">{t('console.rake.scheduled', { ...whenOf(change), rule: ruleText(change) })}</Text>
          <Button variant="text" isLoading={withdraw.isPending && withdraw.variables === change.settingId}
            onClick={() => void withdrawChange(change.settingId)}>
            {t('console.rake.withdraw', whenOf(change))}
          </Button>
        </Inline>
      ))}
      {failure === null ? null : <ErrorMessage>{rakeFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
