// DigiLocker's record for the complete step (decision 0676): what Zoop delivered to kyc-digilocker for the member's session,
// or the vendor's answer when asked (the fake's record; Zoop's "not yet"). The decisions are @rivr/adapters' deliveryStep.
import { err, ok, type Result } from '@rivr/contracts';
import { deliveryStep, heldDelivery, type AdapterFailure, type DigiLockerRecord, type KycAdapter } from '@rivr/adapters';
import { rpc } from './server.ts';

const EXPIRED: AdapterFailure = { code: 'rejected', reason: 'Zoop expired' };

/**
 * The record for the member's session: the one delivered, why none came, or the vendor's answer. Zoop is asked where a session
 * stands at most every 30 seconds for each member (may_ask_kyc_digilocker_status), and never for a session no longer held; in
 * between, the member still waits.
 */
export async function digiLockerRecord(memberId: string, sessionId: string, kyc: KycAdapter): Promise<Result<DigiLockerRecord | 'waiting', AdapterFailure>> {
  const held = heldDelivery(await rpc('kyc_digilocker_delivery', { p_member_id: memberId }, null));
  const step = deliveryStep(held, Date.now(), kyc.readDigiLockerDelivery !== undefined);
  if (step.kind === 'record') return ok(step.record);
  if (step.kind === 'refused') return err({ code: 'rejected', reason: step.reason });
  if (step.kind === 'expired') return err(EXPIRED);
  if (held !== null && (await rpc('may_ask_kyc_digilocker_status', { p_member_id: memberId }, null)) !== true) return ok('waiting');
  return await kyc.pullDigiLocker({ sessionId });
}
