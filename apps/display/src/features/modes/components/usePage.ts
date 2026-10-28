import { useEffect, useState } from 'react';

// More than fit take turns, a page every ten seconds.
const PAGE_MS = 10_000;

/** Which page shows: the next every ten seconds, round them all (the call-time board's tables, the spin wheel's prizes). */
export function usePage(pages: number): number {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (pages < 2) return undefined;
    const timer = setInterval(() => setTurn((current) => current + 1), PAGE_MS);
    return () => clearInterval(timer);
  }, [pages]);
  return pages === 0 ? 0 : turn % pages;
}
