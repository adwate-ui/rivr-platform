import { SITE_BLOCK_KINDS } from '@rivr/contracts';
import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Heading, Input, Stack, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { fieldsOf, setAt, type BlockField } from './blockFields.ts';

// Words longer than this are edited in a box of several lines.
const LONG = 80;

/** A field's name: "Heading", or "Title 2" for the second in a list. */
function labelOf(field: BlockField): string {
  const name = t(`console.website.fields.${field.key}`);
  return field.number === null ? name : t('console.website.fieldNumber', { field: name, number: String(field.number) });
}

/** A block's kind in words: "Hero", "Cards"; "Block" for a kind the website does not know. */
function kindOf(kind: string): string {
  const known = SITE_BLOCK_KINDS.find((each) => each === kind);
  return known === undefined ? t('console.website.kinds.other') : t(`console.website.kinds.${known}`);
}

/** One block of a page in the editor (#129): its kind, and each of its words to change in place. */
export function BlockEditor({ block, position, onChange }: { block: EditorBlock; position: number; onChange: (next: EditorBlock) => void }) {
  const fields = fieldsOf(block.content);
  // Long words get a box of several lines, chosen once, so a field never changes under the typing.
  const [long] = useState(() => new Set(fields.filter((field) => field.value.length > LONG).map((field) => field.path.join('.'))));
  return (
    <Stack gap={2}>
      <Heading level={3} variant="section">{t('console.website.block', { number: String(position), kind: kindOf(block.kind) })}</Heading>
      {fields.map((field) => {
        const change = (value: string) => onChange({ ...block, content: setAt(block.content, field.path, value) });
        const shared = { label: labelOf(field), value: field.value };
        return long.has(field.path.join('.'))
          ? <TextArea key={field.path.join('.')} {...shared} onChange={(event) => change(event.target.value)} />
          : <Input key={field.path.join('.')} {...shared} autoComplete="off" onChange={(event) => change(event.target.value)} />;
      })}
    </Stack>
  );
}
