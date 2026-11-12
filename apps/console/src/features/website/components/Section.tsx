import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, Inline, OverflowMenu, Stack } from '@rivr/ui';
import { useState } from 'react';
import { BlockEditor } from './BlockEditor.tsx';
import { kindName } from './sections.ts';

/** Where a new section goes, beside this one; or this one's new kind. */
type Asking = 'above' | 'below' | 'kind';

interface KindChoiceProps {
  readonly label: string;
  /** The kinds to offer: sections.ts kindsFor, without a second hero. */
  readonly kinds: readonly string[];
  readonly current: string | null;
  readonly onPick: (kind: string) => void;
  readonly onCancel: () => void;
}

/** The kinds to choose one from, for a new section or this one, and a way back (#906). */
export function KindChoice({ label, kinds, current, onPick, onCancel }: KindChoiceProps) {
  return (
    <Stack gap={2}>
      <ChoiceChips label={label} mode="one" options={kinds.map((kind) => ({ value: kind, label: kindName(kind) }))} selected={current === null ? [] : [current]}
        onChange={([kind]) => { if (kind !== undefined && kind !== current) onPick(kind); }} />
      <Inline gap={2}><Button variant="subtle" onClick={onCancel}>{t('console.website.cancel')}</Button></Inline>
    </Stack>
  );
}

/** What can be done to a section from its menu. */
export interface SectionActions {
  readonly onChange: (next: EditorBlock) => void;
  readonly onAdd: (kind: string, where: 'above' | 'below') => void;
  readonly onRetype: (kind: string) => void;
  readonly onMove: (by: -1 | 1) => void;
  readonly onDelete: () => void;
}

interface SectionProps {
  readonly block: EditorBlock;
  readonly position: number;
  readonly count: number;
  /** The kinds a new section may be, and this one may become. */
  readonly kinds: { readonly add: readonly string[]; readonly change: readonly string[] };
  readonly actions: SectionActions;
}

/**
 * One section of a page's draft (#906): its words, and from its menu a new section above or below it, another kind for it,
 * a place up or down, or taking it out. A page keeps at least one section.
 */
export function Section({ block, position, count, kinds, actions }: SectionProps) {
  const [asking, setAsking] = useState<Asking | null>(null);
  const number = String(position);
  const pick = (kind: string) => {
    if (asking === 'kind') actions.onRetype(kind);
    else if (asking !== null) actions.onAdd(kind, asking);
    setAsking(null);
  };
  const choice = asking === null ? null : (
    <KindChoice label={t(`console.website.chooseKind.${asking}`, { number })} kinds={asking === 'kind' ? kinds.change : kinds.add}
      current={asking === 'kind' ? block.kind : null} onPick={pick} onCancel={() => setAsking(null)} />
  );
  const menu = (
    <OverflowMenu label={t('console.website.sectionMenu', { number })} items={[
      { id: 'above', label: t('console.website.addAbove'), onSelect: () => setAsking('above') },
      { id: 'below', label: t('console.website.addBelow'), onSelect: () => setAsking('below') },
      { id: 'kind', label: t('console.website.changeKind'), onSelect: () => setAsking('kind') },
      { id: 'up', label: t('console.website.moveUp'), onSelect: () => actions.onMove(-1), isDisabled: position === 1 },
      { id: 'down', label: t('console.website.moveDown'), onSelect: () => actions.onMove(1), isDisabled: position === count },
      { id: 'delete', label: t('console.website.deleteSection'), tone: 'danger', onSelect: actions.onDelete, isDisabled: count === 1 },
    ]} />
  );
  return (
    <Stack gap={3}>
      {asking === 'above' || asking === 'kind' ? choice : null}
      <BlockEditor block={block} position={position} onChange={actions.onChange} tools={menu} />
      {asking === 'below' ? choice : null}
    </Stack>
  );
}

/** A new section at the page's end (#906). */
export function AddAtEnd({ kinds, onAdd }: { kinds: readonly string[]; onAdd: (kind: string) => void }) {
  const [isAsking, setAsking] = useState(false);
  if (!isAsking) return <Inline gap={2}><Button variant="subtle" onClick={() => setAsking(true)}>{t('console.website.addSection')}</Button></Inline>;
  return <KindChoice label={t('console.website.chooseKind.end')} kinds={kinds} current={null} onCancel={() => setAsking(false)} onPick={(kind) => { onAdd(kind); setAsking(false); }} />;
}
