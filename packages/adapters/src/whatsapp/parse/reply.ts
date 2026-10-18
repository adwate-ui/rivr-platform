/** Meta's replies to a send, checked at the boundary. Only the fields the adapter uses are read. */
import { z } from 'zod';

const acceptedReplySchema = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) });
const errorReplySchema = z.object({ error: z.object({ code: z.number() }) });

/** The message id from an accepted reply, or undefined when the reply is not the shape Meta documents. */
export function messageIdFrom(reply: unknown): string | undefined {
  const accepted = acceptedReplySchema.safeParse(reply);
  return accepted.success ? accepted.data.messages[0]?.id : undefined;
}

/** Meta's error code from a refusal, or undefined. */
export function errorCodeFrom(reply: unknown): number | undefined {
  const refused = errorReplySchema.safeParse(reply);
  return refused.success ? refused.data.error.code : undefined;
}
