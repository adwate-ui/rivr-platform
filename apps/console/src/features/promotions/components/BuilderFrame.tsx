import { t } from '@rivr/i18n';
import { BackButton, ChoiceChips, Stack, Screen, Text } from '@rivr/ui';
import type { ReactNode } from 'react';
import { BuilderCard, FormInput, type SectionProps } from './BuilderCard.tsx';
import { TEMPLATES, type TemplateKey } from './builderForm.ts';

interface BuilderFrameProps {
  title: string;
  /** One line under the title: what the screen is for, or who submitted the version under review. */
  description: string;
  onBack: () => void;
  children: ReactNode;
}

/** The builder's and the approver's screen: the way back to the list, the title and its line, then the two columns. */
export function BuilderFrame({ title, description, onBack, children }: BuilderFrameProps) {
  return (
    <Stack gap={2}>
      <BackButton label={t('console.promotions.allPromotions')} onBack={onBack} />
      <Screen title={title}>
        <Stack gap={6}>
          <Text variant="secondary" tone="muted">{description}</Text>
          {children}
        </Stack>
      </Screen>
    </Stack>
  );
}

interface StartCardProps {
  section: SectionProps;
  /** The template last applied, or null for one being edited, which offers none. */
  template: TemplateKey | null;
  onTemplate: ((template: TemplateKey) => void) | null;
}

/** The first card: "Start from" a template for a new promotion, and the name members see. */
export function StartCard({ section, template, onTemplate }: StartCardProps) {
  return (
    <BuilderCard label={onTemplate === null ? t('console.promotions.builder.name') : t('console.promotions.builder.startFrom')}>
      {onTemplate === null ? null : (
        <ChoiceChips label={t('console.promotions.builder.startFrom')} isLabelVisuallyHidden mode="one" look="subtle" selected={template === null ? [] : [template]}
          options={TEMPLATES.map((key) => ({ value: key, label: t(`console.promotions.builder.templates.${key}`) }))}
          onChange={(picked) => {
            const chosen = TEMPLATES.find((key) => key === picked[0]);
            if (chosen !== undefined) onTemplate(chosen);
          }} />
      )}
      <FormInput section={section} field="name" label={t('console.promotions.builder.name')} />
    </BuilderCard>
  );
}
