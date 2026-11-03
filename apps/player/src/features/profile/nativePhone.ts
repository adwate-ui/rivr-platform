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
  register(options: { channelName: string }): Promise<{ platform: string; token: string }>;
  /** The token and key the phone kept when it last registered; nulls when it has not, or was turned off. */
  current(): Promise<{ token: string | null; deviceKey: string | null }>;
  /** Keeps the key the database gave the phone. */
  keepDeviceKey(options: { deviceKey: string }): Promise<void>;
  /** Ends what the lock screen shows and forgets the key: the token to forget, or null when there was none. */
  unregister(): Promise<{ token: string | null }>;
}

/** The plugin in the native app; null in a browser, where web push does the same work. */
export const LIVE_STATUS_PLUGIN: LiveStatusPlugin | null = Capacitor.isNativePlatform() ? registerPlugin<LiveStatusPlugin>('LiveStatus') : null;

/** On signing out: ends what the lock screen shows and forgets the key, so a shared phone stops showing the member's status. */
export async function unregisterOnSignOut(plugin = LIVE_STATUS_PLUGIN): Promise<string | null> {
  if (plugin === null) return null;
  return (await plugin.unregister()).token;
}
