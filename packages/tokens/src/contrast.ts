/** WCAG 2.x contrast arithmetic, used by the token tests. */

interface Rgba {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** Parses `#RRGGBB` or `#RRGGBBAA`. */
export function parseHex(hex: string): Rgba {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) throw new Error(`Not a hex colour: ${hex}`);
  const channel = (part: string | undefined, fallback: number) => (part ? parseInt(part, 16) : fallback);
  return {
    red: channel(match[1], 0),
    green: channel(match[2], 0),
    blue: channel(match[3], 0),
    alpha: channel(match[4], 255) / 255,
  };
}

/** The opaque colour seen when `top` (possibly translucent) sits on an opaque `bottom`. */
function composite(top: Rgba, bottom: Rgba): Rgba {
  const mix = (a: number, b: number) => a * top.alpha + b * (1 - top.alpha);
  return { red: mix(top.red, bottom.red), green: mix(top.green, bottom.green), blue: mix(top.blue, bottom.blue), alpha: 1 };
}

function relativeLuminance({ red, green, blue }: Rgba): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Contrast ratio of a foreground (translucency allowed) on an opaque background, 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const back = parseHex(background);
  const front = composite(parseHex(foreground), back);
  const [lighter, darker] = [relativeLuminance(front), relativeLuminance(back)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
