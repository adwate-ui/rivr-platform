import { useCanGoBack, useNavigate, useRouter, type NavigateOptions } from '@tanstack/react-router';

/**
 * Back on a pushed screen (House rules, Order, a session, an invoice): to the screen it was opened from, so Back there
 * goes on back instead of to this one again; or, opened from a link with nothing to go back to, to `fallback` in its
 * place. Never a new entry on top: that is what sent Profile's Back to House rules again.
 */
export function useGoBack(fallback: NonNullable<NavigateOptions['to']>): () => void {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  return () => (canGoBack ? router.history.back() : void navigate({ to: fallback, replace: true }));
}
