import type { blindStructureSchema } from '@rivr/contracts/tournaments';
import { t } from '@rivr/i18n';
import { Button, Inline, Input, Stack, Text } from '@rivr/ui';
import type { FieldArrayWithId, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

export type StructureValues = z.input<typeof blindStructureSchema>;
export type StageValues = StructureValues['stages'][number];
export type StructureFormApi = UseFormReturn<StructureValues, unknown, z.output<typeof blindStructureSchema>>;

/** A new level or break as the editor holds it. */
export const NEW_LEVEL: StageValues = { kind: 'level', smallBlind: '', bigBlind: '', ante: '0', minutes: '20' };
export const NEW_BREAK: StageValues = { kind: 'break', smallBlind: '', bigBlind: '', ante: '', minutes: '10' };

interface StageRowProps {
  form: StructureFormApi;
  index: number;
  /** "Level 3", or "Break". */
  name: string;
  isBreak: boolean;
  onRemove: () => void;
}

function StageRow({ form, index, name, isBreak, onRemove }: StageRowProps) {
  const errors = form.formState.errors.stages?.[index];
  const wrong = (isWrong: boolean) => (isWrong ? t('console.tournaments.invalidWhole') : undefined);
  return (
    <Inline gap={4} align="end" wrap>
      <Text weight="medium">{name}</Text>
      {isBreak ? null : (
        <>
          <Input {...form.register(`stages.${index}.smallBlind`)} label={t('console.tournaments.smallBlind')} inputMode="numeric" autoComplete="off"
            error={errors?.smallBlind?.message === 'above_big_blind' ? t('console.tournaments.problems.blinds') : wrong(errors?.smallBlind !== undefined)} />
          <Input {...form.register(`stages.${index}.bigBlind`)} label={t('console.tournaments.bigBlind')} inputMode="numeric" autoComplete="off"
            error={wrong(errors?.bigBlind !== undefined)} />
          <Input {...form.register(`stages.${index}.ante`)} label={t('console.tournaments.anteLabel')} inputMode="numeric" autoComplete="off"
            error={wrong(errors?.ante !== undefined)} />
        </>
      )}
      <Input {...form.register(`stages.${index}.minutes`)} label={t('console.tournaments.minutes')} inputMode="numeric" autoComplete="off"
        error={wrong(errors?.minutes !== undefined)} />
      <Button variant="text" aria-label={t('console.tournaments.removeStageName', { stage: name })} onClick={onRemove}>{t('console.tournaments.removeStage')}</Button>
    </Inline>
  );
}

/** Each stage's name: levels counted in order, breaks named as breaks. */
function stageNames(stages: readonly StageValues[]): string[] {
  let level = 0;
  return stages.map((stage) => {
    if (stage.kind === 'break') return t('console.tournaments.breakRow');
    level += 1;
    return t('console.tournaments.levelNumber', { level });
  });
}

interface StageRowsProps {
  form: StructureFormApi;
  fields: readonly FieldArrayWithId<StructureValues, 'stages'>[];
  onRemove: (index: number) => void;
}

/** The structure's levels and breaks in order, each figure editable, each removable. */
export function StageRows({ form, fields, onRemove }: StageRowsProps) {
  const names = stageNames(fields);
  if (fields.length === 0) return <Text tone="muted">{t('console.tournaments.noStages')}</Text>;
  return (
    <Stack gap={3} divided>
      {fields.map((field, index) => (
        <StageRow key={field.id} form={form} index={index} name={names[index] ?? ''} isBreak={field.kind === 'break'} onRemove={() => onRemove(index)} />
      ))}
    </Stack>
  );
}
