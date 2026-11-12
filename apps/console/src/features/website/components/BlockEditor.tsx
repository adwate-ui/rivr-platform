import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, TextArea } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { fieldGroups, fieldsOf, itemAdded, itemRemoved, listAt, setAt, type BlockField, type FieldGroup } from './blockFields.ts';
import { kindName } from './sections.ts';

// Words longer than this are edited in a box of several lines.
const LONG = 80;

// The lists of things a block can hold, each named in the editor.
const ITEM_LISTS = ['cards', 'questions', 'roles', 'figures', 'links', 'items'] as const;

// The lists the editor can add to, each with its own button (#906).
const ADDABLE_LISTS = ['rules', 'points', 'lines', 'paragraphs', 'phrases', ...ITEM_LISTS] as const;

type Path = readonly (string | number)[];

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

/** The list a field is one word of, and its place there: the third house rule is `rules`, 2. Null for any other field. */
function wordOf(field: BlockField): { list: Path; index: number } | null {
  const index = field.path.at(-1);
  return typeof index === 'number' ? { list: field.path.slice(0, -1), index } : null;
}

const isSamePath = (one: Path, other: Path) => one.length === other.length && one.every((step, place) => step === other[place]);

interface ListProps {
  readonly block: EditorBlock;
  readonly onChange: (next: EditorBlock) => void;
}

/** "Add a rule" at a list's end: a new item like the last, its words empty (#906). */
function AddItem({ block, onChange, list }: ListProps & { list: Path }) {
  const name = list.findLast((step): step is string => typeof step === 'string');
  const known = ADDABLE_LISTS.find((each) => each === name);
  return (
    <Inline gap={2}>
      <Button variant="subtle" onClick={() => onChange({ ...block, content: itemAdded(block.content, list) })}>
        {t(`console.website.add.${known ?? 'items'}`)}
      </Button>
    </Inline>
  );
}

/** Taking one item out of a list; never its last, which the website needs (#906). */
function RemoveItem({ block, onChange, list, index, name }: ListProps & { list: Path; index: number; name: string }) {
  const isLast = (listAt(block.content, list)?.length ?? 0) <= 1;
  return (
    <Button variant="text" isDisabled={isLast} aria-label={t('console.website.removeItem', { item: name })}
      onClick={() => onChange({ ...block, content: itemRemoved(block.content, list, index) })}>
      {t('console.website.remove')}
    </Button>
  );
}

/** One field's box: several lines for long words. */
function FieldInput({ field, isLong, onType }: { field: BlockField; isLong: boolean; onType: (value: string) => void }) {
  const shared = { label: labelOf(field), value: field.value };
  return isLong
    ? <TextArea {...shared} onChange={(event) => onType(event.target.value)} />
    : <Input {...shared} autoComplete="off" onChange={(event) => onType(event.target.value)} />;
}

interface GroupProps extends ListProps {
  readonly group: FieldGroup;
  /** The group after it, to tell where a list ends. */
  readonly after: FieldGroup | undefined;
  readonly long: ReadonlySet<string>;
}

/** A run of fields: an item of a list under its heading, with Remove; a word of a list with Remove; "Add …" at a list's end (#906). */
function Group({ block, onChange, group, after, long }: GroupProps) {
  const list = { block, onChange };
  const item = group.list !== null && group.number !== null ? { list: group.list, number: group.number } : null;
  return (
    <Stack gap={2}>
      {item === null ? null : (
        <Inline gap={2} align="center" justify="between">
          <Heading level={4} variant="subsection">{itemName(item.list, item.number)}</Heading>
          <RemoveItem {...list} list={[item.list]} index={item.number - 1} name={itemName(item.list, item.number)} />
        </Inline>
      )}
      {group.fields.map((field, place) => {
        const key = field.path.join('.');
        const input = <FieldInput field={field} isLong={long.has(key)} onType={(value) => onChange({ ...block, content: setAt(block.content, field.path, value) })} />;
        const word = wordOf(field);
        if (word === null) return <Stack key={key} gap={1}>{input}</Stack>;
        const next = group.fields[place + 1];
        const nextWord = next === undefined ? null : wordOf(next);
        return (
          <Stack key={key} gap={2}>
            <Inline gap={2} align="end">
              <Stack gap={1} grow>{input}</Stack>
              <RemoveItem {...list} list={word.list} index={word.index} name={labelOf(field)} />
            </Inline>
            {nextWord !== null && isSamePath(nextWord.list, word.list) ? null : <AddItem {...list} list={word.list} />}
          </Stack>
        );
      })}
      {item !== null && after?.list !== item.list ? <AddItem {...list} list={[item.list]} /> : null}
    </Stack>
  );
}

/**
 * One block of a page in the editor (#129): its kind, each of its words to change in place, and each list's items to add
 * and take away (#906). `tools`, beside its heading, act on the block as a whole.
 */
export function BlockEditor({ block, position, onChange, tools }: { block: EditorBlock; position: number; onChange: (next: EditorBlock) => void; tools?: ReactNode }) {
  const fields = fieldsOf(block.kind, block.content);
  // Long words get a box of several lines, chosen once, so a field never changes under the typing.
  const [long] = useState(() => new Set(fields.filter((field) => field.value.length > LONG).map((field) => field.path.join('.'))));
  const groups = fieldGroups(fields);
  return (
    <Stack gap={2}>
      <Inline gap={3} align="center" justify="between">
        <Heading level={3} variant="subsection">{t('console.website.block', { number: String(position), kind: kindName(block.kind) })}</Heading>
        {tools}
      </Inline>
      {groups.map((group, place) => (
        <Group key={group.fields[0]?.path.join('.')} block={block} onChange={onChange} group={group} after={groups[place + 1]} long={long} />
      ))}
    </Stack>
  );
}
