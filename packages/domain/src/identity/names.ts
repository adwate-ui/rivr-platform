/** A name as compared: one Unicode form, lower case, letters and their marks only, single spaces. */
export function plainName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name's words in plain letters, in alphabetical order. */
function wordsOf(name: string): string[] {
  return plainName(name).split(' ').filter((word) => word !== '').sort();
}

/**
 * Whether a document's name is the name a member gave (decision 0671): the same words in any order, with case, spacing
 * and punctuation set aside, so the PAN's `SHARMA RAHUL` is `Rahul Sharma`. A word missing or added, such as a middle
 * name, is not a match: the check then goes to staff. Never a match when either name has no letters.
 */
export function namesMatch(documentName: string, givenName: string): boolean {
  const document = wordsOf(documentName);
  const given = wordsOf(givenName);
  return document.length > 0 && document.length === given.length && document.every((word, place) => word === given[place]);
}
