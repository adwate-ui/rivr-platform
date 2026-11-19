/** A name as compared: one Unicode form, lower case, letters and their marks only, single spaces. */
export function plainName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name's words in plain letters, in the order written. */
function wordsOf(name: string): string[] {
  return plainName(name).split(' ').filter((word) => word !== '');
}

/** Whether every word of `part` is in `whole`, each as often as it appears. */
function within(part: readonly string[], whole: readonly string[]): boolean {
  const left = [...whole];
  return part.every((word) => {
    const place = left.indexOf(word);
    if (place === -1) return false;
    left.splice(place, 1);
    return true;
  });
}

/**
 * Whether a document's name is the name a member gave (decision 0671): the same words in any order, with case, spacing
 * and punctuation set aside, so the PAN's `SHARMA RAHUL` is `Rahul Sharma`. A middle name may be on one and not the other
 * (the owner, #1021, decision 0698): then the shorter name, of two words or more, is all in the longer one, and the member's
 * first and last names are the document's, read as written or with its surname first (`SHARMA RAHUL KUMAR` is
 * `Rahul Sharma`, never `Kumar Sharma`). An initial for a name, or a first or last name on one only, is not a match: the
 * check then goes to staff. Never a match when either name has no letters.
 */
export function namesMatch(documentName: string, givenName: string): boolean {
  const document = wordsOf(documentName);
  const given = wordsOf(givenName);
  if (document.length === 0 || given.length === 0) return false;
  if (document.length === given.length) return within(document, given);
  const [shorter, longer] = document.length < given.length ? [document, given] : [given, document];
  if (shorter.length < 2 || !within(shorter, longer)) return false;
  const [first, last] = [given[0], given[given.length - 1]];
  const surnameFirst = [...document.slice(1), ...document.slice(0, 1)];
  return [document, surnameFirst].some((reading) => reading[0] === first && reading[reading.length - 1] === last);
}
