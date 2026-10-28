import { Text } from '../Text/Text.tsx';

export interface WebPreviewProps {
  /** What the frame shows, for a screen reader: "Preview of House rules". */
  label: string;
  /** The page's address on the website; null while there is none to show. */
  src: string | null;
  /** What shows instead while there is none: "Save a draft to preview it." */
  emptyText: string;
}

/** A page of the website inside the console (#129): the draft as the website itself draws it, in a frame of its own. */
export function WebPreview({ label, src, emptyText }: WebPreviewProps) {
  if (src === null) return <Text tone="muted">{emptyText}</Text>;
  return <iframe title={label} src={src} className="aspect-video w-full rounded-md border border-hairline bg-surface" />;
}
