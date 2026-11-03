import { Fragment, type ReactNode } from 'react';

export interface NoticeTextProps {
  /** The notice as staff wrote it: a blank line starts a paragraph, a line break is kept, an https address is a link. */
  text: string;
}

// An https address whose plain host comes straight after https:// (letters, digits and hyphens, dot-separated), then an
// optional port and path, ending at a blank space, the line's end or punctuation; what ends a sentence after it is not
// part of it. Extra slashes, a user part, a lookalike letter or a hidden mark make no link, so a link always goes where
// it reads (decision 0424).
const ADDRESS = /https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?::\d{1,5})?(?:[/?#][^\s<>"]*)?(?=$|[\s<>"'.,;:!?)\]])/g;
const SENTENCE_END = /[.,;:!?)\]'"]+$/;

/** One line's words with each https address a link that opens in a new tab, shown without its https://. */
function linked(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const match of line.matchAll(ADDRESS)) {
    const href = match[0].replace(SENTENCE_END, '');
    parts.push(line.slice(from, match.index));
    // dir="ltr": a right-to-left mark before it cannot turn the address round.
    parts.push(
      <a key={`${String(match.index)}-${href}`} href={href} target="_blank" rel="noopener noreferrer" dir="ltr"
        className="font-semibold underline underline-offset-4">{href.slice('https://'.length)}</a>,
    );
    from = match.index + href.length;
  }
  parts.push(line.slice(from));
  return parts;
}

/**
 * A club notice's words (decision 0424): paragraphs on blank lines, its line breaks kept, and every https address a link
 * that opens in a new tab. Plain text only: nothing in it is read as HTML, and no other address becomes a link.
 */
export function NoticeText({ text }: NoticeTextProps) {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph !== '');
  return (
    <div className="flex flex-col gap-2 font-text text-14 leading-snug wrap-anywhere">
      {paragraphs.map((paragraph, position) => (
        <p key={`${String(position)}-${paragraph}`}>
          {paragraph.split('\n').map((line, row) => (
            <Fragment key={`${String(row)}-${line}`}>
              {row > 0 ? <br /> : null}
              {linked(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
