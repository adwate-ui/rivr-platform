import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Heading, Input, Stack, TextArea } from '@rivr/ui';
import { fieldsOf, setAt, type BlockField } from './blockFields.ts';

// Words longer than this are edited in a box of several lines.
const LONG = 80;

/** A field's name: "Heading", or "Title 2" for the second in a list. */
function labelOf(field: BlockField): string {
  const name = t(`console.website.fields.${field.key}`);
  return field.number === null ? name : t('console.website.fieldNumber', { field: name, number: String(field.number) });
}

/** One block of a page in the editor (#129): its kind, and each of its words to change in place. */
export function BlockEditor({ block, position, onChange }: { block: EditorBlock; position: number; onChange: (next: EditorBlock) => void }) {
  const fields = fieldsOf(block.content);
  return (
    <Stack gap={2}>
      <Heading level={3} variant="section">{t('console.website.block', { number: String(position), kind: block.kind })}</Heading>
      {fields.map((field) => {
        const change = (value: string) => onChange({ ...block, content: setAt(block.content, field.path, value) });
        const shared = { label: labelOf(field), value: field.value };
        return field.value.length > LONG
          ? <TextArea key={field.path.join('.')} {...shared} onChange={(event) => change(event.target.value)} />
          : <Input key={field.path.join('.')} {...shared} autoComplete="off" onChange={(event) => change(event.target.value)} />;
      })}
    </Stack>
  );
}
