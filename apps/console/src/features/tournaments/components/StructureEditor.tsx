import { zodResolver } from '@hookform/resolvers/zod';
import { blindStructureSchema } from '@rivr/contracts/tournaments';
import { useTournamentSetupActions, type BlindStructure } from '@rivr/db';
import { structureProblem, type Stage } from '@rivr/domain/tournament';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CalculatorForm } from './CalculatorForm.tsx';
import { SaveRow, type SaveOutcome } from './SaveRow.tsx';
import { NEW_BREAK, NEW_LEVEL, StageRows, type StageValues, type StructureValues } from './StageRows.tsx';

/** A stage as the editor holds it, every figure as text. */
function stageValues(stage: Stage): StageValues {
  if (stage.kind === 'break') return { ...NEW_BREAK, minutes: String(stage.minutes) };
  return { kind: 'level', smallBlind: String(stage.smallBlind), bigBlind: String(stage.bigBlind), ante: String(stage.ante), minutes: String(stage.minutes) };
}

const valuesOf = (structure: BlindStructure | null): StructureValues =>
  ({ name: structure?.name ?? '', stages: structure === null ? [] : structure.stages.map(stageValues) });

interface StructureEditorProps {
  venueId: string;
  structure: BlindStructure | null;
  onDone: () => void;
}

/**
 * Adds a blind structure, or changes the one chosen (#115, decision 0200): its name, then its levels and
 * breaks, filled in by the calculator or added one by one, each figure editable. Tournaments already made keep their levels.
 */
export function StructureEditor({ venueId, structure, onDone }: StructureEditorProps) {
  const { saveStructure } = useTournamentSetupActions(venueId);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [resolver] = useState(() => zodResolver(blindStructureSchema));
  const form = useForm<StructureValues, unknown, z.output<typeof blindStructureSchema>>({ resolver, defaultValues: valuesOf(structure) });
  const stages = useFieldArray({ control: form.control, name: 'stages' });
  const name = form.register('name');
  const submit = form.handleSubmit(async (values) => {
    const problem = structureProblem(values.stages);
    if (problem !== null) return setOutcome({ ok: false, text: t(`console.tournaments.problems.${problem}`) });
    const saved = await saveStructure.mutateAsync({ structureId: structure?.id ?? null, name: values.name, stages: values.stages });
    if (!saved.ok) return setOutcome({ ok: false, text: t(`console.tournaments.failures.${saved.error}`) });
    setOutcome({ ok: true, text: t('console.tournaments.saved', { name: values.name }) });
    if (structure === null) form.reset(valuesOf(null));
    else onDone();
  });
  const heading = structure === null ? t('console.tournaments.newStructure') : t('console.tournaments.editStructure', { name: structure.name });
  return (
    <Stack gap={6}>
      <Heading level={2} variant="section">{heading}</Heading>
      <Input {...name} label={t('console.tournaments.name')} autoComplete="off"
        error={form.formState.errors.name ? t('console.tournaments.invalidName') : undefined} />
      <CalculatorForm onPlan={(planned) => stages.replace(planned.map(stageValues))} />
      <Heading level={3} variant="subsection">{t('console.tournaments.levels')}</Heading>
      <StageRows form={form} fields={stages.fields} onRemove={stages.remove} />
      <Inline gap={4} align="center" wrap>
        <Button variant="text" onClick={() => stages.append(NEW_LEVEL)}>{t('console.tournaments.addLevel')}</Button>
        <Button variant="text" onClick={() => stages.append(NEW_BREAK)}>{t('console.tournaments.addBreak')}</Button>
      </Inline>
      <SaveRow isSaving={saveStructure.isPending} onSave={() => void submit()} onCancel={structure === null ? undefined : onDone} outcome={outcome} />
    </Stack>
  );
}
