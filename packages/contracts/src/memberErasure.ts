import { z } from 'zod';

/**
 * Removing an erased member's KYC files (#424, decision 0207), as the console asks the member-erase Edge Function
 * once the database has erased the member: the member alone. The function finds their folder through the database,
 * which names it only for a member already erased.
 */
export const erasedKycFilesSchema = z.object({
  memberId: z.uuid(),
});

/** A request to remove an erased member's KYC files. */
export type ErasedKycFilesRequest = z.output<typeof erasedKycFilesSchema>;
