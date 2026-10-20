import { encode } from 'uqr';

export interface QrCodeProps {
  /** What the code holds: the door's scanner reads it. */
  value: string;
  /** What the code is, for a screen reader: `Your door code`. */
  label: string;
}

/** The dark modules of a QR code as one SVG path, a unit square each. */
function modulesPath(rows: readonly (readonly boolean[])[]): string {
  return rows.flatMap((row, y) => row.map((isDark, x) => (isDark ? `M${String(x)} ${String(y)}h1v1h-1z` : ''))).join('');
}

/**
 * A QR code in ink, filling its container square: the membership card's cream square, which is its quiet
 * zone. Medium error correction, so a scratched or dimmed phone screen still scans. `data-value` carries
 * what it holds, for software that reads it and for tests.
 */
export function QrCode({ value, label }: QrCodeProps) {
  const { data, size } = encode(value, { ecc: 'M', border: 0 });
  return (
    <svg role="img" aria-label={label} data-value={value} viewBox={`0 0 ${String(size)} ${String(size)}`} shapeRendering="crispEdges"
      className="size-full text-on-cream">
      <path d={modulesPath(data)} fill="currentColor" />
    </svg>
  );
}
