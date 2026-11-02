import { FNB_ITEM_KINDS, type FnbItemKind } from '@rivr/contracts';
import { useItemPhotoUpload, type ItemPhotoFailure } from '@rivr/db';
import { useFnbActions, useFnbItems, type FnbFailure, type FnbItem } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, CameraButton, ChoiceChips, ErrorMessage, Heading, Inline, Input, ItemPhoto, LoadState, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';

/** The kinds to choose from, made when the form draws, so t() runs once the app's words are registered (F2-31). */
const kinds = () => FNB_ITEM_KINDS.map((kind) => ({ value: kind, label: t(`console.fnb.kinds.${kind}`) }));

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
        <ChoiceChips label={t('console.fnb.kind')} mode="one" options={kinds()} selected={[kind]}
          onChange={([picked]) => { const found = FNB_ITEM_KINDS.find((known) => known === picked); if (found) setKind(found); }} />
        <Button variant="secondary" isDisabled={name.trim() === ''} isLoading={saveItem.isPending} onClick={() => void add()}>{t('console.fnb.addItem')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t('console.fnb.invalidItem')}</ErrorMessage>}
    </Stack>
  );
}

/** A dish's photo on its row (AS-11): the one the app shows, and the club's own photo from this computer to add or replace it. */
function DishPhoto({ venueId, item }: { venueId: string; item: FnbItem }) {
  const upload = useItemPhotoUpload(venueId);
  const [failure, setFailure] = useState<ItemPhotoFailure | null>(null);
  const put = async (photo: File) => {
    setFailure(null);
    const done = await upload.mutateAsync({ kind: 'menu', itemId: item.itemId, photo });
    setFailure(done.ok ? null : done.error);
  };
  const isNew = item.photoUrl === null;
  return (
    <Stack gap={2}>
      <CameraButton variant="text" camera="none" accept="image/jpeg,image/png,image/webp" isLoading={upload.isPending} onPhoto={(photo) => void put(photo)}
        aria-label={t(isNew ? 'console.itemPhoto.addName' : 'console.itemPhoto.replaceName', { name: item.name })}>
        {t(isNew ? 'console.itemPhoto.add' : 'console.itemPhoto.replace')}
      </CameraButton>
      {failure === null ? null : <ErrorMessage>{t(`console.itemPhoto.failures.${failure}`)}</ErrorMessage>}
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
          <Inline gap={3} align="center">
            <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
            <Text>{`${item.name} · ${t(`console.fnb.kinds.${item.kind}`)}`}</Text>
          </Inline>
          <DishPhoto venueId={venueId} item={item} />
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
