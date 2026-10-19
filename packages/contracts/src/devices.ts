import { z } from 'zod';

/** The six-digit code staff read out from the console to pair a dealer tablet or TV (#41). */
export const pairingCodeSchema = z.string().regex(/^\d{6}$/);

/** What a device sends to device-pair, signed out. */
export const devicePairSchema = z.object({ code: pairingCodeSchema });

/** What device-pair returns: the device's own session, which the app keeps. */
export const deviceSessionSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1) });

/** A device's session. */
export type DeviceSession = z.infer<typeof deviceSessionSchema>;

/** Staff add a dealer tablet by name, on the console. */
export const dealerTabletAddSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Staff revoke a device, and say why. */
export const deviceRevokeSchema = z.object({ reason: z.string().trim().min(1).max(200) });
