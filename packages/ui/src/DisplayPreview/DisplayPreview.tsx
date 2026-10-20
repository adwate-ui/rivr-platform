import { useCallback, useState, type ReactNode } from 'react';
import { DisplayStage, TV_HEIGHT, TV_WIDTH } from '../internal/displayStage.tsx';

export interface DisplayPreviewProps {
  /** What the preview shows, for a screen reader: "TV slide". */
  label: string;
  /** A TV mode, as on the TV: a slide, a board. */
  children: ReactNode;
}

// The console's preview column is about a quarter of the TV's width before it is measured.
const FIRST_SCALE = 0.25;

/** The scale that fits the TV's width into the box, following the box as it resizes. */
function useBoxScale(): [(node: HTMLDivElement | null) => (() => void) | undefined, number] {
  const [scale, setScale] = useState(FIRST_SCALE);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (node === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? TV_WIDTH * FIRST_SCALE) / TV_WIDTH));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [measure, scale];
}

/**
 * A TV screen in miniature on the console (#84): the TV's 1920 by 1080 stage, wordmark and all,
 * scaled to the width of its box, so a slide is previewed exactly as the TV will show it.
 */
export function DisplayPreview({ label, children }: DisplayPreviewProps) {
  const [measure, scale] = useBoxScale();
  return (
    <div ref={measure} role="group" aria-label={label} className="relative w-full overflow-hidden rounded-md border border-hairline" style={{ height: TV_HEIGHT * scale }}>
      <div className="absolute top-0 left-0">
        <DisplayStage scale={scale} origin="top left" body="div">{children}</DisplayStage>
      </div>
    </div>
  );
}
