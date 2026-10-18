/** An Indian mobile number as people read it: `+919876543210` to `+91 98765 43210`. */
export function formatMobile(e164: string): string {
  const digits = e164.slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
