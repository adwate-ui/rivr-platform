import { t } from '@rivr/i18n';
import { Box, DotStatus, Inline, Input, Stack, Text } from '@rivr/ui';
import { useId, type ReactNode } from 'react';
import type { BuilderForm } from './builderForm.ts';
import type { FormField } from './formTerms.ts';

/** What every section of the builder is given: the fields, the ones to mark, and whether the approver only reads them. */
export interface SectionProps {
  readonly form: BuilderForm;
  readonly errors: ReadonlySet<FormField>;
  readonly onChange: (next: BuilderForm) => void;
  /** The approver's view: the same sections, read only (console v3). */
  readonly isReadOnly: boolean;
  /** The approver's view: the part this section holds differs from the running version's. */
  readonly isChanged?: boolean | undefined;
}

/**
 * One of the builder's numbered cards (console v3 prototype): its eyebrow, and in the approver's view "Changed" beside
 * it when the waiting version changes that part.
 */
export function BuilderCard({ label, isChanged = false, children }: { label: string; isChanged?: boolean | undefined; children: ReactNode }) {
  const labelId = useId();
  return (
    <Box as="section" surface="raised" radius="lg" padding={4} aria-labelledby={labelId}>
      <Stack gap={4}>
        <Inline gap={3} align="center" justify="between">
          <Text id={labelId} variant="eyebrow" tone="muted">{label}</Text>
          {isChanged ? <DotStatus tone="needsYou" label={t('console.promotions.review.changed')} /> : null}
        </Inline>
        {children}
      </Stack>
    </Box>
  );
}

/**
 * The choices a section offers: every one to change, and only those chosen to read in the approver's view, where a
 * dimmed row of every choice would hide which is chosen.
 */
export function offered<Option extends { readonly value: string }>(section: SectionProps, options: readonly Option[], chosen: readonly string[]): Option[] {
  return section.isReadOnly ? options.filter((option) => chosen.includes(option.value)) : [...options];
}

/** A field typed as text in the builder; a play-time bonus's steps are a list of their own. */
export type TextField = Exclude<FormField, 'who' | 'days' | 'steps' | 'tierList'>;

interface FieldProps {
  readonly section: SectionProps;
  readonly field: TextField;
  readonly label: string;
  readonly suffix?: string | undefined;
  readonly type?: 'text' | 'date' | 'url';
  readonly inputMode?: 'decimal' | 'numeric' | 'text';
  readonly placeholder?: string | undefined;
}

/** One typed field of the builder: its value, its change, its mark when the terms refuse it, and read only for the approver. */
export function FormInput({ section, field, label, suffix, type = 'text', inputMode = 'text', placeholder }: FieldProps) {
  const { form, errors, onChange, isReadOnly } = section;
  return (
    <Input label={label} suffix={suffix} type={type} inputMode={inputMode} placeholder={placeholder} value={form[field]} readOnly={isReadOnly}
      error={errors.has(field) ? t(`console.promotions.builder.errors.${field}`) : undefined}
      onChange={(event) => onChange({ ...form, [field]: event.target.value })} />
  );
}
