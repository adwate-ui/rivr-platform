import { FNB_ITEM_KINDS, type FnbItemKind } from '@rivr/contracts';
import { useItemPhotoUpload, type ItemPhotoFailure } from '@rivr/db';
import { useFnbActions, useFnbItems, type FnbFailure, type FnbItem } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, CameraButton, ChoiceChips, ErrorMessage, Heading, Inline, Input, ItemPhoto, LoadState, Stack, Switch, Text, useIsWide } from '@rivr/ui';
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
      {/* One line, as the console's other add rows (console v3): the field, its kind and Add, on one centre line. */}
      <Inline gap={3} align="center" wrap>
        <Input variant="subtle" label={t('console.fnb.itemName')} value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} />
        <ChoiceChips label={t('console.fnb.kind')} isLabelVisuallyHidden look="subtle" mode="one" options={kinds()} selected={[kind]}
          onChange={([picked]) => { const found = FNB_ITEM_KINDS.find((known) => known === picked); if (found) setKind(found); }} />
        <Button variant="subtle" size="compact" isDisabled={name.trim() === ''} isLoading={saveItem.isPending} onClick={() => void add()}>{t('console.fnb.addItem')}</Button>
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

interface ItemRowProps {
  readonly venueId: string;
  readonly item: FnbItem;
  readonly canManage: boolean;
  readonly isSaving: boolean;
  readonly onToggle: (item: FnbItem, isOn: boolean) => void;
}

/**
 * One item by its name, with its photo to add or replace for staff who run F&B, and on offer or off the menu: on one line
 * from 768 px; below, the name on its own line above them, so it never wraps beside them.
 */
function ItemRow({ venueId, item, canManage, isSaving, onToggle }: ItemRowProps) {
  const isWide = useIsWide('medium');
  const name = (
    <Inline gap={3} align="center" grow>
      <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
      <Text>{item.name}</Text>
    </Inline>
  );
  const actions = (
    <Inline gap={4} align="center" justify="end">
      {canManage ? <DishPhoto venueId={venueId} item={item} /> : null}
      <Switch label={item.isAvailable ? t('console.fnb.onOffer') : t('console.fnb.offMenu')} isOn={item.isAvailable}
        isDisabled={isSaving} onChange={(isOn) => onToggle(item, isOn)} />
    </Inline>
  );
  if (!isWide) return <Stack gap={2}>{name}{actions}</Stack>;
  return <Inline gap={4} align="center" justify="between">{name}{actions}</Inline>;
}

/** Each item under its kind (#799), food first, as the app's menu sorts them; a switch that did not save says why. */
function ItemSwitches({ venueId, items, canManage }: { venueId: string; items: readonly FnbItem[]; canManage: boolean }) {
  const { saveItem } = useFnbActions(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const toggle = async (item: FnbItem, isOn: boolean) => {
    const saved = await saveItem.mutateAsync({ ...item, isAvailable: isOn });
    setFailure(saved.ok ? null : saved.error);
  };
  if (items.length === 0) return <Text>{t('console.fnb.empty')}</Text>;
  const groups = FNB_ITEM_KINDS.map((kind) => ({ kind, items: items.filter((item) => item.kind === kind) })).filter((group) => group.items.length > 0);
  return (
    <Stack gap={6}>
      {groups.map((group) => (
        <Stack key={group.kind} gap={3}>
          <Heading level={2} variant="subsection">{t(`console.fnb.kinds.${group.kind}`)}</Heading>
          {group.items.map((item) => (
            <ItemRow key={item.itemId} venueId={venueId} item={item} canManage={canManage} isSaving={saveItem.isPending} onToggle={(each, isOn) => void toggle(each, isOn)} />
          ))}
        </Stack>
      ))}
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * Glaza's menu as the tables see it: each item under its kind (#799), on offer or off the menu, and a new item at the end;
 * with `canManage` (fnb.manage), each dish's photo. The Menu tab names it, so it has no heading of its own (console v3).
 */
export function MenuItems({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const items = useFnbItems(venueId);
  if (items.data === undefined) return <LoadState isError={items.isError} onRetry={() => void items.refetch()} />;
  return (
    <Stack gap={6}>
      <ItemSwitches venueId={venueId} items={items.data} canManage={canManage} />
      <AddItem venueId={venueId} next={(items.data.at(-1)?.position ?? 0) + 1} />
    </Stack>
  );
}
