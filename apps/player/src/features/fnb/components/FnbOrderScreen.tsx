import { FNB_ITEM_KINDS, type FnbItemKind } from '@rivr/contracts';
import { useFeatureStatus, useMySeat, useMyUsualFnbItems, type MySeat } from '@rivr/db';
import { useMyFnbMenu, useMyFnbOrders, type FnbMenuItem } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { BackButton, Button, ChoiceChips, FeatureGate, Heading, Inline, ItemPhoto, LoadState, QuantityStepper, Screen, Skeleton, Stack, SuggestionCard, Text } from '@rivr/ui';
import { Navigate, useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { SendBar } from './SendBar.tsx';

type Counts = Readonly<Record<string, number>>;

/** One item: its tile and name, then Add, or how many with one fewer and one more once added. */
function ItemRow({ item, count, onChange }: { item: FnbMenuItem; count: number; onChange: (count: number) => void }) {
  return (
    <Inline gap={3} align="center">
      <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
      <Stack grow><Text>{item.name}</Text></Stack>
      {count === 0 ? (
        <Button variant="outline" shape="pill" aria-label={t('player.order.addName', { name: item.name })} onClick={() => onChange(1)}>
          {t('player.order.add')}
        </Button>
      ) : <QuantityStepper look="round" label={item.name} value={count} onChange={onChange} />}
    </Inline>
  );
}

/** "Your usual": the two items the member orders most, still on their menu, with Add both; nothing without history. */
function Usual({ menu, onAdd }: { menu: readonly FnbMenuItem[]; onAdd: (items: readonly FnbMenuItem[]) => void }) {
  const ids = useMyUsualFnbItems().data ?? [];
  const items = ids.flatMap((id) => menu.filter((item) => item.itemId === id));
  if (items.length === 0) return null;
  return (
    <SuggestionCard title={t('player.order.usual')} text={items.map((item) => item.name).join(t('player.fnb.itemsSeparator'))}
      actionLabel={t(items.length === 2 ? 'player.order.addBoth' : 'player.order.add')} onPress={() => onAdd(items)} />
  );
}

/**
 * The counts an order again starts from: the lines of the order named in `?again=`, when it is tonight's, and only those
 * still on the menu, as the member sees and changes only those.
 */
function useStartingCounts(menu: readonly FnbMenuItem[]): Counts {
  const { again } = useSearch({ strict: false });
  const order = useMyFnbOrders().data?.find((each) => each.orderId === again);
  const lines = (order?.lines ?? []).filter((line) => menu.some((item) => item.itemId === line.itemId));
  return Object.fromEntries(lines.map((line) => [line.itemId, line.quantity]));
}

/** The menu by category (Food, Soft drinks, Bar), the usual on top, each item addable; the send bar once anything is in. */
function Ordering({ seat, menu }: { seat: MySeat; menu: readonly FnbMenuItem[] }) {
  const starting = useStartingCounts(menu);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [kind, setKind] = useState<FnbItemKind>('food');
  const shown = counts ?? starting;
  const set = (itemId: string, count: number) => setCounts({ ...shown, [itemId]: count });
  const kinds = FNB_ITEM_KINDS.filter((each) => menu.some((item) => item.kind === each));
  return (
    <Stack gap={4}>
      <ChoiceChips look="tabs" mode="one" label={t('player.order.categories')} isLabelVisuallyHidden selected={[kind]}
        options={kinds.map((each) => ({ value: each, label: t(`player.fnb.kinds.${each}`) }))} onChange={([each]) => { if (each) setKind(each); }} />
      <Usual menu={menu} onAdd={(items) => setCounts(Object.fromEntries([...Object.entries(shown), ...items.map((item) => [item.itemId, (shown[item.itemId] ?? 0) + 1])]))} />
      <Stack gap={3} divided>
        {menu.filter((item) => item.kind === kind).map((item) => (
          <ItemRow key={item.itemId} item={item} count={shown[item.itemId] ?? 0} onChange={(count) => set(item.itemId, count)} />
        ))}
      </Stack>
      <SendBar seat={seat} counts={shown} onSent={() => setCounts({})} />
    </Stack>
  );
}

/** The menu once the seat and the menu are read: a member not seated goes back to Tonight (brief 2.1). */
function OrderBody() {
  const seat = useMySeat();
  const menu = useMyFnbMenu();
  if (seat.data === null) return <Navigate to="/" replace />;
  // Under the screen's own heading: a skeleton while it loads, or Try again, with no second title.
  if (seat.isError || menu.isError) return <LoadState isError onRetry={() => void Promise.all([seat.refetch(), menu.refetch()])} />;
  if (seat.data === undefined || menu.data === undefined) return <Skeleton rows={4} />;
  if (menu.data.length === 0) return <Text tone="muted">{t('player.fnb.empty')}</Text>;
  return (
    <Stack gap={4}>
      <Text variant="small" tone="muted">{t('player.order.seat', { table: seat.data.tableName, seat: seat.data.seat })}</Text>
      <Ordering seat={seat.data} menu={menu.data} />
    </Stack>
  );
}

/**
 * Order (brief 3.5; #123, feature fnb.table_side): pushed from the seat's Order to my seat or Order again, with Tonight as
 * the way back. Only while seated: a visit not seated goes to Tonight. Paid at the seat on delivery.
 */
export function FnbOrderScreen() {
  const feature = useFeatureStatus('fnb.table_side');
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Back to where it was opened from, or to / in its place: never a new entry on top (owner, 8 Nov).
  const toHome = () => (canGoBack ? router.history.back() : void navigate({ to: '/', replace: true }));
  const title = t('player.order.title');
  if (feature.status === 'loading') return <Screen title={title} isTitleHidden status="loading" loadingLook="skeleton" />;
  if (feature.status === 'error') return <Screen title={title} status="error" onRetry={feature.retry} />;
  return (
    <Stack gap={2}>
      <BackButton label={t('player.order.back')} onBack={toHome} />
      <Heading level={1} variant="serif">{title}</Heading>
      <FeatureGate access={feature.access}><OrderBody /></FeatureGate>
    </Stack>
  );
}
