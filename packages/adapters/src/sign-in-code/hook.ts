import { sendSmsHookSchema } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { sendSignInCode, type SignInCodeChannels } from './send.ts';

/** What the Edge Function answers Auth: HTTP 200, with an empty body or an error for the app. */
export interface HookReply {
  readonly status: 200;
  readonly body: Record<string, never> | { readonly error: { readonly http_code: number; readonly message: string } };
}

/**
 * A refusal Auth passes on to the app. Auth reads an error only from an HTTP 200 reply; for any
 * other status it drops the body and answers the app with a bare 500, so the app could not tell
 * "wait a minute" from "cannot send". `httpCode` and `message` are what the app receives.
 */
export function hookError(httpCode: number, message: string): HookReply {
  return { status: 200, body: { error: { http_code: httpCode, message } } };
}

function replyTo(failure: AdapterFailure): HookReply {
  switch (failure.code) {
    case 'not_configured':
      return hookError(503, 'Sign-in codes cannot be sent yet.');
    case 'rate_limited':
      return hookError(429, 'Too many codes were sent. Wait a minute and try again.');
    default:
      return hookError(502, 'The code could not be sent. Try again.');
  }
}

/**
 * Answers Supabase Auth's Send SMS hook once its signature is checked: sends the code through the
 * live channels and replies the way Auth expects. Named after Supabase's hook, though the code goes
 * by WhatsApp first. The code is never logged or stored (decision 0025).
 */
export async function handleSendSmsHook(payload: unknown, channels: SignInCodeChannels): Promise<HookReply> {
  const hook = sendSmsHookSchema.safeParse(payload);
  if (!hook.success) return hookError(400, 'The hook payload is not a sign-in code for an Indian mobile.');
  const sent = await sendSignInCode(channels, hook.data);
  return sent.ok ? { status: 200, body: {} } : replyTo(sent.error);
}
