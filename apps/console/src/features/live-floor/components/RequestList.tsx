import type { RequestTargets } from '@rivr/domain/floorRequests';
import type { FloorRequest, FloorTable, SeatAlert } from '@rivr/db';
import { t } from '@rivr/i18n';
import { RequestItem, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { requestActions, type LeaveRequest, type RequestAction } from './requestActions.ts';
import { requestKey } from './useRequestQueue.ts';
import type { RequestChanges } from './useRequestChanges.ts';
import { wordsOf } from './requestView.ts';

export interface RequestListProps {
  /** Oldest first, as the queue shows them. */
  requests: readonly FloorRequest[];
  tables: readonly FloorTable[];
  targets: RequestTargets;
  now: Date;
  /** Those just arrived, in a gold tint that fades. */
  fresh: ReadonlySet<string>;
  changes: RequestChanges;
  /** Leave and Record open the leave sheet. */
  onLeave: (request: LeaveRequest) => void;
  /** A request's name opens the player's sheet, or the record of a member not seated. */
  onOpen: (request: FloorRequest) => void;
  /** Whether that name opens anything for this staff member; if not it is plain text (audit F-025). */
  canOpen: (request: FloorRequest) => boolean;
  /** Whether Check ID leads anywhere for this staff member (audit F-014). */
  canCheckId: boolean;
  /** An approved player's Seat, Check ID or View list. */
  onSeatAlert: (alert: SeatAlert) => void;
  /** A join approved: the seat sheet follows once a seat is free for them. */
  onApproved: (entryId: string) => void;
}

/** The name of the table a request is at, or none. */
export const tableNameOf = (tables: readonly FloorTable[], tableId: string) => tables.find((table) => table.id === tableId)?.name ?? '';

/**
 * The floor's requests (console v3), oldest first: each says what is asked and how long ago (late past the club's target,
 * decision 0479), who asks and where, then its one filled action and the one in words. One that just arrived glows gold.
 */
export function RequestList({ requests, tables, targets, now, fresh, changes, onLeave, onOpen, canOpen, canCheckId, onSeatAlert, onApproved }: RequestListProps) {
  // Which action is in flight, so its button turns while it goes.
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0) return <Text tone="muted">{t('console.floor.requests.allClear')}</Text>;
  const button = (key: string, action: RequestAction) => ({
    label: action.label, isLoading: busy === key,
    onClick: () => {
      setBusy(key);
      void Promise.resolve(action.run()).finally(() => setBusy(null));
    },
  });
  return (
    <Stack gap={0}>
      {requests.map((request) => {
        const key = requestKey(request);
        const tableName = tableNameOf(tables, request.tableId);
        const words = wordsOf(request, { name: tableName, isOpen: tables.find((table) => table.id === request.tableId)?.isOpen ?? true }, now, targets);
        const actions = requestActions(request, { changes, tableName, onLeave, onSeatAlert, onApproved, canCheckId });
        // Marked with its key, so A and D act on the request whose button holds the focus (useFloorKeys).
        return (
          <RequestItem key={key} requestKey={key} kind={words.kind} age={words.age} isLate={words.isLate} title={request.fullName}
            onTitle={canOpen(request) ? () => onOpen(request) : undefined} detail={words.detail} isNew={fresh.has(key)} primary={button(`${key}:primary`, actions.primary)}
            secondary={actions.secondary === undefined ? undefined : button(`${key}:secondary`, actions.secondary)} />
        );
      })}
    </Stack>
  );
}
