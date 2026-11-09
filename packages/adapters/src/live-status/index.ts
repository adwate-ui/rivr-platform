// The lock-screen live status (decision 0323): one interface over Apple's push service and Firebase, its fake, and the
// live implementations, which need only fetch and Web Crypto.
export type { LiveStatus, LiveStatusAdapter, LiveStatusDevice, LiveStatusFailure, LiveStatusShow, PhoneAlert, PhoneAlertFailure } from './types.ts';
export { createFakeLiveStatus, type FakeLiveStatus } from './fake.ts';
export { createLiveStatus } from './byPlatform.ts';
export { createApnsLiveActivity, type ApnsLiveActivityOptions } from './apns.ts';
export { createFcmOngoing, type FcmOngoingOptions } from './fcm.ts';
