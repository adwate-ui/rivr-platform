import { useKycDeskClaim, type KycCandidate, type KycDeskClaim, type KycDeskHolder } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';
import { useEffect, useRef, useState } from 'react';
import { IN_PERSON_FAILURE_COPY } from './checkText.ts';

/** A member's check done elsewhere: who checked them and when, where known (the owner, 20 Nov). */
export type DecidedClaim = Extract<KycDeskClaim, { status: 'decided' }>;

/**
 * Start claims the member for this reviewer (the owner, 20 Nov), so no one else starts them while the five steps are
 * taken: one being checked elsewhere says by whom and since when, and one checked already closes the check with who did
 * it and when. The claim is let go when the check closes undone: Choose another member, or the sheet closed.
 */
/**
 * A claim's two marks: held by this check, and the check closed. As the check closes the claim it holds is let go, and a
 * claim that comes back after that is let go at once, not held for 15 minutes.
 */
function useLetGoOnClose(memberId: string, letGo: (memberId: string) => void) {
  const isHeld = useRef(false);
  const isClosed = useRef(false);
  useEffect(() => {
    isClosed.current = false;
    return () => {
      isClosed.current = true;
      if (isHeld.current) letGo(memberId);
    };
  }, [memberId, letGo]);
  return { isHeld, isClosed };
}

export function useStart({ venueId, member, onStarted, onChecked }: {
  venueId: string; member: KycCandidate; onStarted: () => void; onChecked: (claim: DecidedClaim) => void;
}) {
  const { claim, release } = useKycDeskClaim(venueId);
  const [holder, setHolder] = useState<KycDeskHolder | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const { memberId } = member;
  const letGo = release.mutate;
  const { isHeld, isClosed } = useLetGoOnClose(memberId, letGo);
  const ask = async () => {
    setProblem(null);
    const answer = await claim.mutateAsync(memberId);
    if (!answer.ok) setProblem(IN_PERSON_FAILURE_COPY[answer.error]);
    return answer.ok ? answer.value : null;
  };
  const start = async () => {
    const answer = await ask();
    if (answer?.status === 'claimed' && isClosed.current) return letGo(memberId);
    if (answer?.status === 'claimed') {
      isHeld.current = true;
      setHolder(null);
      onStarted();
    }
    if (answer?.status === 'taken') setHolder(answer);
    if (answer?.status === 'decided') onChecked(answer);
  };
  // Verify refused the check as decided: who checked them, and the check closes; false where that cannot be said.
  const whoChecked = async () => {
    const answer = await ask();
    if (answer?.status !== 'decided') return false;
    onChecked(answer);
    return true;
  };
  return { start: () => void start(), isStarting: claim.isPending, holder, problem, whoChecked };
}

export type Start = ReturnType<typeof useStart>;
