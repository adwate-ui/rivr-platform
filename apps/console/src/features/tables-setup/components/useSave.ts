import { useRef, useState } from 'react';

/**
 * A setup panel's save. One at a time: a second press while the first is on its way sends nothing. `run` gives the words
 * of what it was refused for, or null once saved; the words stay until the admin edits a field (`clearFailure`).
 */
export function useSave(run: () => Promise<string | null>) {
  const [failure, setFailure] = useState<string | null>(null);
  const isSending = useRef(false);
  const save = async () => {
    if (isSending.current) return;
    isSending.current = true;
    try {
      setFailure(await run());
    } finally {
      isSending.current = false;
    }
  };
  return { failure, save, clearFailure: () => setFailure(null) };
}
