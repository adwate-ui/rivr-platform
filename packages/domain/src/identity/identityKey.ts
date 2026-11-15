import { plainName } from './names.ts';

/**
 * The identity two KYC checks of one person share (#474; decision 0197): the document's name in plain letters
 * (case, spacing and punctuation ignored; Devanagari vowel signs kept), the date of birth and the Aadhaar's last
 * four digits, as `rahul sharma|1995-02-02|5647`. Null when the name has no letters or the masked Aadhaar no four
 * digits at its end. The database keeps only a keyed hash of it.
 */
export function kycIdentityKey(documentName: string, dateOfBirth: string, maskedAadhaar: string): string | null {
  const name = plainName(documentName);
  const lastFour = /(\d{4})$/.exec(maskedAadhaar.trim())?.[1];
  return name === '' || lastFour === undefined ? null : `${name}|${dateOfBirth}|${lastFour}`;
}
