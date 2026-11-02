/** An Indian mobile number as people read it: `+919876543210` to `+91 98765 43210`. */
export function formatMobile(e164: string): string {
  const digits = e164.slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * A mobile number as it is typed after +91, kept to its ten digits and spaced as people say it: `98765 43210` (S-01). A
 * pasted `+91 98765-43210` or `919876543210` loses its country code, and `09876543210` its trunk 0; anything else that is
 * not a digit goes.
 */
export function formatTypedMobile(typed: string): string {
  const all = typed.replace(/\D/g, '');
  const national = all.length > 10 && all.startsWith('91') ? all.slice(2) : all.length > 10 && all.startsWith('0') ? all.slice(1) : all;
  const digits = national.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
