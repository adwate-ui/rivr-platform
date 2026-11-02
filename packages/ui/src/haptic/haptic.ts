/** A short tap of the phone's vibration, 12 ms. */
const TAP_MS = 12;

/**
 * A short buzz for a moment the member should feel (decision 0320): joining a waitlist, the seat called while the app is
 * open, seated, an order sent. Nothing where the phone or browser cannot vibrate (an iPhone, a desktop).
 */
export function haptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(TAP_MS);
}
