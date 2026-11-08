import { useSaveFnbMenu, type FnbMenuFailure, type FnbMenuFileItem } from '@rivr/db/fnb';
import { formatNumber, t } from '@rivr/i18n';
import { Button, CameraButton, DietMark, ErrorMessage, Heading, Inline, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { menuItemsToSave, readMenuCsv, type MenuCsv, type MenuCsvLine } from './menuCsv.ts';

// A menu of 300 items fits in a few kilobytes: a larger file is not this one, and is never read.
const MOST_BYTES = 1_048_576;

/** An item as it will be saved, with its mark and description when the file gives them: blank leaves the menu's as they are. */
function PreviewItem({ item }: { item: FnbMenuFileItem }) {
  const { name, isAvailable, diet, description } = item;
  const kind = t(`console.fnb.kinds.${item.kind}`);
  return (
    <Stack gap={1}>
      <Inline gap={2} align="center">
        {diet === null ? null : <DietMark diet={diet} />}
        <Text>{isAvailable === null ? t('console.fnb.menuCsv.itemOnly', { name, kind }) : t('console.fnb.menuCsv.item', { name, kind, offer: t(isAvailable ? 'console.fnb.onOffer' : 'console.fnb.offMenu') })}</Text>
      </Inline>
      {description === null ? null : <Text variant="small" tone="muted">{description}</Text>}
    </Stack>
  );
}

/** One line as the preview shows it: the item as it will be saved, or what is wrong. */
function PreviewLine({ read }: { read: MenuCsvLine }) {
  if (read.ok) return <PreviewItem item={read.item} />;
  const line = formatNumber(read.line);
  if (read.problem === 'twice') return <ErrorMessage>{t('console.fnb.menuCsv.problems.twice', { line, name: read.name })}</ErrorMessage>;
  return <ErrorMessage>{t(`console.fnb.menuCsv.problems.${read.problem}`, { line })}</ErrorMessage>;
}

/** Every line of the file before anything is saved, or what is wrong with the whole file. */
function Preview({ csv }: { csv: MenuCsv }) {
  if (csv.fileProblem !== null) return <ErrorMessage>{t(`console.fnb.menuCsv.${csv.fileProblem}`)}</ErrorMessage>;
  return <Stack gap={2} divided>{csv.lines.map((read) => <PreviewLine key={read.line} read={read} />)}</Stack>;
}

/** Save, for a file with nothing wrong, and why it did not save. */
function SaveFile({ venueId, items, onSaved }: { venueId: string; items: readonly FnbMenuFileItem[]; onSaved: (count: number) => void }) {
  const saveMenu = useSaveFnbMenu(venueId);
  const [failure, setFailure] = useState<FnbMenuFailure | null>(null);
  const save = async () => {
    setFailure(null);
    const done = await saveMenu.mutateAsync(items);
    if (done.ok) onSaved(done.value);
    else setFailure(done.error);
  };
  return (
    <Stack gap={2}>
      <Inline>
        <Button variant="subtle" size="compact" isLoading={saveMenu.isPending} onClick={() => void save()}>{t('console.fnb.menuCsv.save')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.menuCsv.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

const savedText = (count: number) =>
  count === 1 ? t('console.fnb.menuCsv.savedOne') : t('console.fnb.menuCsv.saved', { count: formatNumber(count) });

/**
 * The menu from a CSV (#799): a file of names, types and whether each is on offer, read on the screen and shown line by
 * line with what is wrong, then saved in one go, all or none. A name the menu has is changed; a new one is added. On offer
 * left blank leaves an item as it is.
 */
export function MenuCsvImport({ venueId }: { venueId: string }) {
  const [csv, setCsv] = useState<MenuCsv | null>(null);
  // Each file chosen starts afresh, without the last one's failure.
  const [chosen, setChosen] = useState(0);
  const [fileProblem, setFileProblem] = useState<'unreadable' | 'tooBig' | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const choose = async (file: File) => {
    setSaved(null);
    const text = file.size > MOST_BYTES ? null : await file.text().catch(() => null);
    setFileProblem(text !== null ? null : file.size > MOST_BYTES ? 'tooBig' : 'unreadable');
    setCsv(text === null ? null : readMenuCsv(text));
    setChosen((count) => count + 1);
  };
  const items = csv === null ? null : menuItemsToSave(csv);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.fnb.menuCsv.heading')}</Heading>
      <Text variant="small" tone="muted">{t('console.fnb.menuCsv.format')}</Text>
      <Inline>
        <CameraButton variant="subtle" camera="none" accept=".csv,text/csv" onPhoto={(file) => void choose(file)}>
          {t(csv === null ? 'console.fnb.menuCsv.choose' : 'console.fnb.menuCsv.chooseAnother')}
        </CameraButton>
      </Inline>
      {fileProblem === null ? null : <ErrorMessage>{t(`console.fnb.menuCsv.${fileProblem}`)}</ErrorMessage>}
      {csv === null ? null : <Preview csv={csv} />}
      {items === null ? null : <SaveFile key={chosen} venueId={venueId} items={items} onSaved={(count) => { setSaved(savedText(count)); setCsv(null); }} />}
      <StatusMessage>{saved}</StatusMessage>
    </Stack>
  );
}
