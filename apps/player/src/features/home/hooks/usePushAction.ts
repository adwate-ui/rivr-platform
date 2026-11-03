import { useFeature, useSeatCallActions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { useToast } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { WAITLIST_FAILURE_COPY } from '../components/waitlistCopy.ts';

/** What Tonight can act on once its reads are in: the seat call's place, if called, and whether the seat takes more time. */
export interface PushTarget {
  readonly isReady: boolean;
  readonly calledEntryId: string | null;
  /** Seated with a call time, met or not (decision 0305), as Add time on the seat needs. */
  readonly canAddTime: boolean;
}

/**
 * A push's button, as the address it opened (decision 0320): `?sheet=add-time` opens Add time for a seated member with
 * call time, met or not (decision 0305), who may see it (call_time.view);
 * `?accept=<place>` says "I'm on my way" to that seat call, once, with a toast if it does not go through. Either way the
 * address is cleaned, so a refresh does not act again.
 */
export function usePushAction({ isReady, calledEntryId, canAddTime }: PushTarget, onAddTime: () => void) {
  const { sheet, accept } = useSearch({ strict: false });
  const navigate = useNavigate();
  const { acceptCall } = useSeatCallActions();
  const toast = useToast();
  const callTime = useFeature('call_time.view');
  const mayAddTime = canAddTime && callTime.state === 'enabled';
  const { mutateAsync } = acceptCall;
  useEffect(() => {
    if (!isReady || (sheet === undefined && accept === undefined)) return;
    if (sheet === 'add-time' && mayAddTime) onAddTime();
    if (accept !== undefined && accept === calledEntryId) {
      void mutateAsync(accept).then((accepted) => {
        if (!accepted.ok) toast(t(WAITLIST_FAILURE_COPY[accepted.error]));
      });
    }
    void navigate({ to: '/', search: {}, replace: true });
  }, [isReady, sheet, accept, mayAddTime, calledEntryId, onAddTime, mutateAsync, navigate, toast]);
}
