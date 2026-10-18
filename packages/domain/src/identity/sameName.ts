/** A name as compared: one Unicode form, lower case, letters and their marks only, single spaces. */
function plain(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether the name on an identity document is the member's registered name, ignoring case, spacing
 * and punctuation (D'Souza is DSouza). Vowel signs count, so राम is not रमा. A name with no letters
 * matches nothing. A different name means someone else's document, which staff review.
 */
export function isSameName(documentName: string, registeredName: string): boolean {
  const document = plain(documentName);
  return document !== '' && document === plain(registeredName);
}
