import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The native app's own LiveStatus plugin (decision 0361; android/app/src/main/java/club/rivr/player/LiveStatusPlugin.java
 * and ios/App/App/LiveStatusPlugin.swift): the phone's push token for the lock-screen live status and its key. The frame
 * listens to it for the page a tapped status opens (features/frame/notificationLinks.ts).
 */
export interface LiveStatusPlugin {
  /** Whether the phone may show notifications: granted, denied, or not asked yet. */
  checkPermissions(): Promise<{ notifications: PermissionState | 'prompt-with-rationale' }>;
  /** Asks the member's leave when not asked yet, then gives the phone's push token; rejects when refused or not set up. */
  register(options: { channelName: string }): Promise<{ platform: string; token: string; alertToken?: string | null }>;
  /** The token and key the phone kept when it last registered; nulls when it has not, or was turned off. */
  current(): Promise<{ token: string | null; deviceKey: string | null }>;
  /** Keeps the key the database gave the phone. */
  keepDeviceKey(options: { deviceKey: string }): Promise<void>;
  /** Ends what the lock screen shows and forgets the key: the token to forget, or null when there was none. */
  unregister(): Promise<{ token: string | null }>;
}

/** The plugin in the native app; null in a browser, where web push does the same work. */
export const LIVE_STATUS_PLUGIN: LiveStatusPlugin | null = Capacitor.isNativePlatform() ? registerPlugin<LiveStatusPlugin>('LiveStatus') : null;

/**
 * Turning the live status off, or signing out: the phone is forgotten while the member is still signed in, then it ends
 * what its lock screen shows and drops its key, so a shared phone stops showing the member's status. `removeDevice`'s
 * answer, or null when the phone had it off.
 */
export async function forgetPhone<Removed>(removeDevice: (token: string) => Promise<Removed>, plugin = LIVE_STATUS_PLUGIN): Promise<Removed | null> {
  if (plugin === null) return null;
  const { token, deviceKey } = await plugin.current();
  const removed = token === null || deviceKey === null ? null : await removeDevice(token);
  await plugin.unregister();
  return removed;
}
