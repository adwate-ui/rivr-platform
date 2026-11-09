import { SITE_BLOCK_KINDS } from '@rivr/contracts';
import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Heading, Input, Stack, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { fieldGroups, fieldsOf, setAt, type BlockField } from './blockFields.ts';

// Words longer than this are edited in a box of several lines.
const LONG = 80;

// The lists of things a block can hold, each named in the editor.
const ITEM_LISTS = ['cards', 'questions', 'roles', 'figures', 'links', 'items'] as const;

/** A field's own word: a card's link or a band's button named apart from a card's own label (F-094). */
function nameOf(field: BlockField): string {
  const parent = field.path.at(-2);
  if (field.key === 'label' && parent === 'link') return t('console.website.fields.linkLabel');
  if (field.key === 'label' && parent === 'action') return t('console.website.fields.actionLabel');
  return t(`console.website.fields.${field.key}`);
}

/** A field's name: "Heading"; "Point 2" for the second in a list of words; "Figure 2 label" for a figure (F-094). Under an item's heading, as "Answer", the heading has the number. */
function labelOf(field: BlockField): string {
  const [list, index] = field.path;
  if (list === 'figures' && typeof index === 'number') return t(field.key === 'label' ? 'console.website.figureLabel' : 'console.website.figureValue', { number: String(index + 1) });
  return field.number !== null && typeof field.path.at(-1) === 'number' ? t('console.website.fieldNumber', { field: nameOf(field), number: String(field.number) }) : nameOf(field);
}

/** An item's heading: "Question 1"; "Item 1" for a list the editor has no word for. */
function itemName(list: string, number: number): string {
  const known = ITEM_LISTS.find((each) => each === list);
  return t('console.website.fieldNumber', { field: t(`console.website.items.${known ?? 'items'}`), number: String(number) });
}

/** A block's kind in words: "Hero", "Cards"; "Block" for a kind the website does not know. */
function kindOf(kind: string): string {
  const known = SITE_BLOCK_KINDS.find((each) => each === kind);
  return known === undefined ? t('console.website.kinds.other') : t(`console.website.kinds.${known}`);
}

/** One block of a page in the editor (#129): its kind, and each of its words to change in place. */
export function BlockEditor({ block, position, onChange }: { block: EditorBlock; position: number; onChange: (next: EditorBlock) => void }) {
  const fields = fieldsOf(block.kind, block.content);
  // Long words get a box of several lines, chosen once, so a field never changes under the typing.
  const [long] = useState(() => new Set(fields.filter((field) => field.value.length > LONG).map((field) => field.path.join('.'))));
  return (
    <Stack gap={2}>
      <Heading level={3} variant="subsection">{t('console.website.block', { number: String(position), kind: kindOf(block.kind) })}</Heading>
      {fieldGroups(fields).map((group) => (
        <Stack key={group.fields[0]?.path.join('.')} gap={2}>
          {group.list !== null && group.number !== null ? <Heading level={4} variant="subsection">{itemName(group.list, group.number)}</Heading> : null}
          {group.fields.map((field) => {
            const change = (value: string) => onChange({ ...block, content: setAt(block.content, field.path, value) });
            const shared = { label: labelOf(field), value: field.value };
            return long.has(field.path.join('.'))
              ? <TextArea key={field.path.join('.')} {...shared} onChange={(event) => change(event.target.value)} />
              : <Input key={field.path.join('.')} {...shared} autoComplete="off" onChange={(event) => change(event.target.value)} />;
          })}
        </Stack>
      ))}
    </Stack>
  );
}
