import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** What opens a website band of cards or moments: a gold line, the band's heading, and a lead beneath; nothing when none is given. */
export function BandIntro({ eyebrow, heading, intro }: { eyebrow?: string | undefined; heading?: string | undefined; intro?: string | undefined }) {
  if (!eyebrow && !heading && !intro) return null;
  return (
    <div className="flex flex-col gap-4">
      {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {intro ? <div className="max-w-text"><Text variant="lead" tone="muted">{intro}</Text></div> : null}
    </div>
  );
}
