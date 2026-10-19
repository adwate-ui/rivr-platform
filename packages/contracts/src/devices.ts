import { z } from 'zod';

/** The six-digit code staff read out from the console to pair a dealer tablet or TV (#41). */
export const pairingCodeSchema = z.string().regex(/^\d{6}$/);

/** What a device sends to device-pair, signed out. */
export const devicePairSchema = z.object({ code: pairingCodeSchema });

/** Staff add a dealer tablet by name, on the console. */
export const dealerTabletAddSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Staff revoke a device, and say why. */
export const deviceRevokeSchema = z.object({ reason: z.string().trim().min(1).max(200) });

/** A dealer's PIN, as the console sets it (#41): four digits, not one digit four times. */
export const dealerPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).refine((pin) => !/^(\d)\1{3}$/.test(pin)),
});

/** A PIN as a dealer enters it on the tablet: four digits, which the database checks. */
export const dealerPinEntrySchema = z.object({ pin: z.string().regex(/^\d{4}$/) });
