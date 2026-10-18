/** Joins the class names that apply, skipping `false`, `null` and `undefined`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
