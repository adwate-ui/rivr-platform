import { z } from 'zod';

/** The six-digit code staff read out from the console to pair a dealer tablet or TV (#41). */
export const pairingCodeSchema = z.string().regex(/^\d{6}$/);

/** What a device sends to device-pair, signed out. */
export const devicePairSchema = z.object({ code: pairingCodeSchema });
