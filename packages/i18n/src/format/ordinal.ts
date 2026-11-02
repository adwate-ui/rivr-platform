/** A place in English: `1st`, `2nd`, `3rd`, `4th`, `11th`, `21st` (decision 0320, a place on a waitlist). */
export function formatOrdinal(place: number): string {
  const lastTwo = place % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[place % 10] ?? 'th';
  return `${place}${suffix}`;
}
