import { t } from '@rivr/i18n';
import { BackButton, Box, ChoiceChips, Screen, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';
import { BuilderCard, FormInput, type SectionProps } from './BuilderCard.tsx';
import { TEMPLATES, type TemplateKey } from './builderForm.ts';

interface BuilderFrameProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
}

/** The builder's and the approver's screen: the way back to the list, the title, then the two columns. */
export function BuilderFrame({ title, onBack, children }: BuilderFrameProps) {
  return (
    <Stack gap={2}>
      <BackButton label={t('console.promotions.allPromotions')} onBack={onBack} />
      <Screen title={title}>{children}</Screen>
    </Stack>
  );
}

interface StartCardProps {
  section: SectionProps;
  /** The template last applied, or null for one being edited, which offers none. */
  template: TemplateKey | null;
  onTemplate: ((template: TemplateKey) => void) | null;
}

/**
 * The first card: "Start from" a template for a new promotion, and the name members see. A promotion being changed or
 * reviewed offers no template, so its card holds the name alone, under the field's own label.
 */
export function StartCard({ section, template, onTemplate }: StartCardProps) {
  const name = <FormInput section={section} field="name" label={t('console.promotions.builder.name')} />;
  if (onTemplate === null) return <Box surface="raised" radius="lg" padding={4}>{name}</Box>;
  return (
    <BuilderCard label={t('console.promotions.builder.startFrom')}>
      <ChoiceChips label={t('console.promotions.builder.startFrom')} isLabelVisuallyHidden mode="one" look="subtle"
        selected={template === null ? [] : [template]}
        options={TEMPLATES.map((key) => ({ value: key, label: t(`console.promotions.builder.templates.${key}`) }))}
        onChange={(picked) => {
          const chosen = TEMPLATES.find((key) => key === picked[0]);
          if (chosen !== undefined) onTemplate(chosen);
        }} />
      {name}
    </BuilderCard>
  );
}
