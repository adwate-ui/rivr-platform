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

/**
 * The identity two KYC checks of one person share (#474; decision 0197): the document's name as isSameName
 * compares it, the date of birth and the Aadhaar's last four digits, as `rahul sharma|1995-02-02|5647`. Null
 * when the name has no letters or the masked Aadhaar no four digits at its end. The database keeps only a
 * keyed hash of it.
 */
export function kycIdentityKey(documentName: string, dateOfBirth: string, maskedAadhaar: string): string | null {
  const name = plain(documentName);
  const lastFour = /(\d{4})$/.exec(maskedAadhaar.trim())?.[1];
  return name === '' || lastFour === undefined ? null : `${name}|${dateOfBirth}|${lastFour}`;
}
