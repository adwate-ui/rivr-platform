import { sha256Hex } from '../shared/hash.ts';
import type { GoogleAdsClickConversion, OfflineConversion } from './types.ts';

/** `2026-11-16T18:40:00.000Z` becomes `2026-11-16 18:40:00+00:00`, the format Google requires. */
function googleDateTime(instant: Date): string {
  return `${instant.toISOString().slice(0, 19).replace('T', ' ')}+00:00`;
}

/**
 * Builds the conversion Google receives. Google wants the phone in E.164 (`+919876543210`)
 * SHA-256 hashed; nothing personal is sent in clear.
 */
export async function toClickConversion(conversion: OfflineConversion): Promise<GoogleAdsClickConversion> {
  return {
    orderId: conversion.orderId,
    conversionAction: conversion.conversionAction,
    conversionDateTime: googleDateTime(conversion.conversionTime),
    ...(conversion.gclid === null ? {} : { gclid: conversion.gclid }),
    userIdentifiers: [{ hashedPhoneNumber: await sha256Hex(conversion.phone) }],
  };
}
