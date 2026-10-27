import { z } from 'zod';

/** A six-digit pairing code: staff read one out to a dealer tablet (#41), and type in the one a TV shows (#49). */
export const pairingCodeSchema = z.string().regex(/^\d{6}$/);

/** The secret a TV asks device-pair with while it waits to be paired: 64 hex characters (#49). */
export const tvSecretSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** What a dealer tablet sends to device-pair, signed out: the code staff read out. */
export const devicePairSchema = z.object({ code: pairingCodeSchema });

/** What a TV sends to device-pair, signed out: it asks for a code to show, then asks again with its secret until staff type that code in. */
export const tvPairingSchema = z.discriminatedUnion('tv', [
  z.object({ tv: z.literal('start') }),
  z.object({ tv: z.literal('check'), secret: tvSecretSchema }),
]);

/** Everything device-pair takes. */
export const devicePairRequestSchema = z.union([devicePairSchema, tvPairingSchema]);
export type DevicePairRequest = z.infer<typeof devicePairRequestSchema>;

/** What a TV shows (additions "TV modes"), as public.tv_mode lists them. */
export const TV_MODES = ['waitlist', 'call_time', 'jackpot', 'tournament_clock', 'promotions', 'rewards', 'league', 'social_wall', 'spin_wheel'] as const;
export type TvMode = (typeof TV_MODES)[number];

/** Staff pair a TV on the console: the code it shows, a name, and what it shows. */
export const tvPairSchema = z.object({
  code: pairingCodeSchema,
  name: z.string().trim().min(1).max(60),
  mode: z.enum(TV_MODES),
});

/** Staff add a dealer tablet by name, on the console. */
export const dealerTabletAddSchema = z.object({ name: z.string().trim().min(1).max(60) });

/**
 * What the cage agent asks the cage-agent function (#168, #123; decision 0260): to enrol, the six-digit code staff read
 * it and the SHA-256 of the token it keeps, in hex; then, sending the token itself, the newest offline pack, the KOTs to
 * print as the outbox consumer bar_printer, and how each went (`retry_after_seconds` null fails it for good).
 */
export const cageAgentRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enrol'), code: pairingCodeSchema, token_hash: z.string().regex(/^[0-9a-f]{64}$/) }),
  z.object({ action: z.literal('pack') }),
  z.object({ action: z.literal('claim_kots'), limit: z.int().min(1).max(20) }),
  z.object({
    action: z.literal('finish_kot'), delivery_id: z.uuid(), delivered: z.boolean(), error: z.string().max(200).nullable(),
    retry_after_seconds: z.int().min(0).max(21_600).nullable(),
  }),
]);
export type CageAgentRequest = z.infer<typeof cageAgentRequestSchema>;

/** A cage or admin computer's name as it is enrolled (#384): as a tablet's. */
export const computerEnrolSchema = dealerTabletAddSchema;

/** Staff revoke a device, and say why. */
export const deviceRevokeSchema = z.object({ reason: z.string().trim().min(1).max(200) });

/** A CCTV camera as staff add it (#122): a name, and the recorder's channel for its feed (`private.save_camera` checks the same). */
export const cameraSchema = z.object({
  name: z.string().trim().min(1).max(80),
  channel: z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,40}$/).refine((channel) => !/^\.+$/.test(channel)),
});

/** A dealer's PIN, as the console sets it (#41): four digits, not one digit four times. */
export const dealerPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).refine((pin) => !/^(\d)\1{3}$/.test(pin)),
});

/** A PIN as a dealer enters it on the tablet: four digits, which the database checks. */
export const dealerPinEntrySchema = z.object({ pin: z.string().regex(/^\d{4}$/) });
