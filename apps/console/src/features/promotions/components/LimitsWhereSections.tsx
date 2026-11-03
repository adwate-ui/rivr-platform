import { PER_MEMBER, type Channels } from '@rivr/contracts/promotionModel';
import { t } from '@rivr/i18n';
import { ChoiceChips, Grid, TextArea } from '@rivr/ui';
import { BuilderCard, FormInput, offered, type SectionProps } from './BuilderCard.tsx';

/** 4 · Limits: how often each member, the most members a club day, and a budget in bonus chips; blank is no limit. */
export function LimitsSection({ section }: { section: SectionProps }) {
  const { form, onChange } = section;
  const noLimit = t('console.promotions.builder.fields.noLimit');
  const limits = PER_MEMBER.map((limit) => ({ value: limit, label: t(`console.promotions.builder.fields.perMemberChoices.${limit}`) }));
  return (
    <BuilderCard label={t('console.promotions.builder.sections.limits')} isChanged={section.isChanged}>
      <ChoiceChips label={t('console.promotions.builder.fields.perMember')} mode="one" look="subtle" selected={[form.perMember]}
        options={offered(section, limits, [form.perMember])}
        onChange={(picked) => onChange({ ...form, perMember: PER_MEMBER.find((limit) => limit === picked[0]) ?? form.perMember })} />
      <Grid columns={2} gap={4} stackBelow="medium">
        <FormInput section={section} field="maxMembersPerDay" label={t('console.promotions.builder.fields.maxMembersPerDay')} inputMode="numeric"
          placeholder={noLimit} />
        <FormInput section={section} field="budgetChips" label={t('console.promotions.builder.fields.budgetChips')} inputMode="numeric" placeholder={noLimit} />
      </Grid>
    </BuilderCard>
  );
}

const CHANNELS: readonly (keyof Channels)[] = ['playerApp', 'tv', 'website', 'whatsapp'];

/** The channels picked, each on or off. */
function channelsOf(picked: readonly string[]): Channels {
  return { playerApp: picked.includes('playerApp'), tv: picked.includes('tv'), website: picked.includes('website'), whatsapp: picked.includes('whatsapp') };
}

/** 5 · Where it shows: the player app, the TVs, the website and a WhatsApp message; the website's rules; the card's link (#776). */
export function WhereSection({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly, errors } = section;
  const chosen = CHANNELS.filter((channel) => form.channels[channel]);
  const channels = CHANNELS.map((channel) => ({ value: channel, label: t(`console.promotions.builder.fields.channelNames.${channel}`) }));
  return (
    <BuilderCard label={t('console.promotions.builder.sections.where')} isChanged={section.isChanged}>
      <ChoiceChips label={t('console.promotions.builder.fields.channels')} isLabelVisuallyHidden look="subtle" selected={chosen}
        options={offered(section, channels, chosen)}
        onChange={(picked) => onChange({ ...form, channels: channelsOf(picked) })} />
      <TextArea label={t('console.promotions.builder.fields.rulesText')} rows={3} value={form.rulesText} readOnly={isReadOnly}
        error={errors.has('rulesText') ? t('console.promotions.builder.errors.rulesText') : undefined}
        onChange={(event) => onChange({ ...form, rulesText: event.target.value })} />
      <FormInput section={section} field="link" label={t('console.promotions.builder.fields.link')} type="url" />
    </BuilderCard>
  );
}
