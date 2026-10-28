import { usePushSubscriptionActions } from '@rivr/db';
import { useEffect, useState } from 'react';
import { currentSubscription, pushBrowser, subscribePhone, unsubscribePhone, type PushBrowser } from '../phonePush.ts';

/** Where this phone stands for push: no push here, blocked in the browser, off, on, or not known yet. */
export type PhonePushState = 'unsupported' | 'blocked' | 'off' | 'on' | 'loading';

/** Where a change left the phone, and whether it did not take. */
interface Outcome {
  readonly state: PhonePushState;
  readonly failed: boolean;
}

type Actions = ReturnType<typeof usePushSubscriptionActions>;

/** Subscribes the phone with the member's leave and saves it. */
async function turnOn(browser: PushBrowser, { save }: Actions): Promise<Outcome> {
  const subscribed = await subscribePhone(browser);
  if (subscribed === 'blocked') return { state: 'blocked', failed: false };
  if (subscribed === 'failed') return { state: 'off', failed: true };
  const saved = await save.mutateAsync(subscribed);
  return { state: saved.ok ? 'on' : 'off', failed: !saved.ok };
}

/** Unsubscribes the phone and forgets it; off either way, as the browser no longer has it. */
async function turnOff(browser: PushBrowser, { remove }: Actions): Promise<Outcome> {
  const endpoint = await unsubscribePhone(browser);
  const removed = endpoint === null ? null : await remove.mutateAsync(endpoint);
  return { state: 'off', failed: removed?.ok === false };
}

/**
 * Whether this phone gets push notifications (#139), and turning them on or off. A phone already subscribed is saved
 * again on opening, so a browser now signed in by another member moves to them. `failed` when the last change did not
 * take.
 */
export function usePhonePush() {
  const [browser] = useState(pushBrowser);
  const [state, setState] = useState<PhonePushState>(browser === null ? 'unsupported' : 'loading');
  const [isBusy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const actions = usePushSubscriptionActions();
  const { mutateAsync: saveSubscription } = actions.save;

  useEffect(() => {
    if (browser === null) return;
    if (browser.permission() === 'denied') {
      setState('blocked');
      return;
    }
    void currentSubscription(browser).then(async (found) => {
      if (found !== null) await saveSubscription(found);
      setState(found === null ? 'off' : 'on');
    }, () => setState('off'));
  }, [browser, saveSubscription]);

  async function change(isOn: boolean) {
    if (browser === null) return;
    setBusy(true);
    const outcome = await (isOn ? turnOn(browser, actions) : turnOff(browser, actions));
    setState(outcome.state);
    setFailed(outcome.failed);
    setBusy(false);
  }

  return { state, isBusy, failed, change };
}
