import { FNB_ITEM_KINDS, type FnbItemKind } from '@rivr/contracts';
import { useFnbActions, useFnbItems, type FnbFailure, type FnbItem } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, LoadState, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';

const KINDS = FNB_ITEM_KINDS.map((kind) => ({ value: kind, label: t(`console.fnb.kinds.${kind}`) }));

/** Adds an item to the end of the menu: its name and kind. */
function AddItem({ venueId, next }: { venueId: string; next: number }) {
  const { saveItem } = useFnbActions(venueId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FnbItemKind>('food');
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const add = async () => {
    const saved = await saveItem.mutateAsync({ itemId: null, name, kind, isAvailable: true, position: Math.min(next, 999) });
    setFailure(saved.ok ? null : saved.error);
    if (saved.ok) setName('');
  };
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input label={t('console.fnb.itemName')} value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} />
        <ChoiceChips label={t('console.fnb.kind')} mode="one" options={KINDS} selected={[kind]}
          onChange={([picked]) => { const found = FNB_ITEM_KINDS.find((known) => known === picked); if (found) setKind(found); }} />
        <Button variant="secondary" isDisabled={name.trim() === ''} isLoading={saveItem.isPending} onClick={() => void add()}>{t('console.fnb.addItem')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t('console.fnb.invalidItem')}</ErrorMessage>}
    </Stack>
  );
}

/** Each item on offer or off the menu; a switch that did not save says why. */
function ItemSwitches({ venueId, items }: { venueId: string; items: readonly FnbItem[] }) {
  const { saveItem } = useFnbActions(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const toggle = async (item: FnbItem, isOn: boolean) => {
    const saved = await saveItem.mutateAsync({ ...item, isAvailable: isOn });
    setFailure(saved.ok ? null : saved.error);
  };
  if (items.length === 0) return <Text>{t('console.fnb.empty')}</Text>;
  return (
    <Stack gap={3}>
      {items.map((item) => (
        <Inline key={item.itemId} gap={4} align="center" justify="between">
          <Text>{`${item.name} · ${t(`console.fnb.kinds.${item.kind}`)}`}</Text>
          <Switch label={item.isAvailable ? t('console.fnb.onOffer') : t('console.fnb.offMenu')} isOn={item.isAvailable}
            isDisabled={saveItem.isPending} onChange={(isOn) => void toggle(item, isOn)} />
        </Inline>
      ))}
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/** Glaza's menu as the tables see it: each item on offer or off the menu, and a new item at the end. */
export function MenuItems({ venueId }: { venueId: string }) {
  const items = useFnbItems(venueId);
  if (items.data === undefined) return <LoadState isError={items.isError} onRetry={() => void items.refetch()} />;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.fnb.items')}</Heading>
      <ItemSwitches venueId={venueId} items={items.data} />
      <AddItem venueId={venueId} next={(items.data.at(-1)?.position ?? 0) + 1} />
    </Stack>
  );
}
