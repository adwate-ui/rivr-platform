import { sendSmsHookSchema } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { sendSignInCode, type SignInCodeChannels } from './send.ts';

/** What the Edge Function answers Auth: 200 with an empty body, or the error shape Auth hooks use. */
export interface HookReply {
  readonly status: number;
  readonly body: Record<string, never> | { readonly error: { readonly http_code: number; readonly message: string } };
}

function failed(status: number, message: string): HookReply {
  return { status, body: { error: { http_code: status, message } } };
}

function replyTo(failure: AdapterFailure): HookReply {
  switch (failure.code) {
    case 'not_configured':
      return failed(503, 'Sign-in codes cannot be sent yet.');
    case 'rate_limited':
      return failed(429, 'Too many codes were sent. Wait a minute and try again.');
    default:
      return failed(502, 'The code could not be sent. Try again.');
  }
}

/**
 * Answers Supabase Auth's Send SMS hook once its signature is checked: sends the code through the
 * live channels and replies the way Auth expects. The code is never logged or stored (decision 0025).
 */
export async function handleSendSmsHook(payload: unknown, channels: SignInCodeChannels): Promise<HookReply> {
  const hook = sendSmsHookSchema.safeParse(payload);
  if (!hook.success) return failed(400, 'The hook payload is not a sign-in code for an Indian mobile.');
  const sent = await sendSignInCode(channels, hook.data);
  return sent.ok ? { status: 200, body: {} } : replyTo(sent.error);
}
