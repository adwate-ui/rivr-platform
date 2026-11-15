import { LIST_PAGE, useDoorPage, useListChoices, type DoorPlayer, type ListChoices, type ListFilter, type ScopedView } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Stack, StaleNotice, type DataTableRequest } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { doorColumns, doorFiltersInCodes } from './doorColumns.tsx';

/** One chip above the door's table: its words, and what it asks of the server, one of the door's lists or statuses. */
export interface DoorChip {
  readonly id: string;
  readonly label: string;
  /** The door's list the chip shows (`in_club`, `expected`, `left`); none for everyone at the door today. */
  readonly list?: string;
  /** The statuses the chip shows; none for every status. */
  readonly statuses?: readonly string[];
}

interface DoorTableProps {
  readonly venueId: string;
  /** The table's name, and the chips' as a group. */
  readonly label: string;
  readonly chipsLabel: string;
  readonly chips: readonly DoorChip[];
  readonly emptyText: string;
  /** The row's button, where the screen acts on a player: Check in, Check out. */
  readonly action?: ((player: DoorPlayer) => ReactNode) | undefined;
}

/** How many players a chip holds, from the server's counts of the door's lists and statuses over everyone the search leaves. */
function countOf(chip: DoorChip, counted: ListChoices | undefined): number | undefined {
  if (counted === undefined) return undefined;
  const sum = (column: string, values: readonly string[] | undefined) =>
    (counted[column] ?? []).filter((one) => values === undefined || values.includes(one.value)).reduce((total, one) => total + one.count, 0);
  if (chip.statuses !== undefined) return sum('status', chip.statuses);
  return sum('list', chip.list === undefined ? undefined : [chip.list]);
}

/** The table's rows, or that they are loading or did not load. */
function stateOf(page: ReturnType<typeof useDoorPage>, emptyText: string) {
  if (page.data !== undefined) return { rows: page.data.rows, emptyText };
  return page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const };
}

/** A chip's count, once the server has given it. */
const chipCount = (count: number | undefined) => (count === undefined ? {} : { count });

/** The view the server is asked for: the table's own, with the chip's list as its scope and the chip's statuses as a filter. */
function viewOf(request: DataTableRequest | null, chip: DoorChip | undefined): ScopedView | null {
  if (request === null) return null;
  const status: Record<string, ListFilter> = chip?.statuses === undefined ? {} : { status: { kind: 'choice', chosen: chip.statuses } };
  return { ...request, filters: { ...doorFiltersInCodes(request.filters), ...status }, scope: chip?.list === undefined ? {} : { list: chip.list } };
}

/**
 * Everyone at the door today as one table, a page at a time from the server (redesign RD-30): chips choose which of them
 * show, each with its count; the search finds a name or a member number; each column sorts and filters there. Export
 * sends every player the view leaves.
 */
export function DoorTable({ venueId, label, chipsLabel, chips, emptyText, action }: DoorTableProps) {
  const [chipId, setChipId] = useState(chips[0]?.id ?? '');
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const chip = chips.find((one) => one.id === chipId);
  const view = viewOf(request, chip);
  const page = useDoorPage(venueId, view);
  // A menu's counts follow the chip; the chips' own count everyone the search leaves, whichever chip is chosen.
  const counted = useListChoices('door', venueId, view).data;
  const everyone = useListChoices('door', venueId, request === null ? null : { ...request, filters: {}, scope: {} }).data;
  const state = stateOf(page, emptyText);
  const search = { label: t('console.todaysPlayers.filter'), variant: 'subtle' as const, text: (player: DoorPlayer) => player.fullName };
  const chosen = chip === undefined ? '' : t('console.exportFilters.choice', { label: chipsLabel, value: chip.label });
  return (
    <Stack gap={4}>
      {/* A failed refresh keeps the players shown, with a notice, rather than swapping them for an error. */}
      {page.isError && page.data !== undefined ? <StaleNotice since={new Date(page.dataUpdatedAt)} onRetry={() => void page.refetch()} /> : null}
      <DataTable {...state} label={label} columns={doorColumns(counted, action)} rowKey={(player) => player.memberId} narrowLayout="scroll"
        filter={search}
        belowSearch={(
          <ChoiceChips look="subtle" mode="one" isOneRow isLabelVisuallyHidden label={chipsLabel} selected={[chipId]}
            options={chips.map((one) => ({ value: one.id, label: one.label, ...chipCount(countOf(one, everyone)) }))}
            onChange={([picked]) => setChipId(picked ?? chips[0]?.id ?? '')} />
        )}
        server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest, scope: chipId }} exportRows={page.readEvery} exportFilter={chosen} />
    </Stack>
  );
}
