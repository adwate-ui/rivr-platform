import { zodResolver } from '@hookform/resolvers/zod';
import { SOCIAL_CHANNELS, socialPostSchema, type SocialChannel } from '@rivr/contracts';
import { usePublishSocialPost } from '@rivr/db/social';
import { t } from '@rivr/i18n';
import { Box, Button, CameraButton, ChoiceChips, ErrorMessage, Inline, Stack, StatusMessage, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

type PostValues = z.input<typeof socialPostSchema>;
const EMPTY: PostValues = { caption: '', channels: [...SOCIAL_CHANNELS] };
const CAPTION_MOST = 2200;

/** The channels a post goes to, every one at first. */
function Channels({ selected, onChange }: { selected: readonly SocialChannel[]; onChange: (channels: SocialChannel[]) => void }) {
  return (
    <ChoiceChips label={t('console.social.publish.channels')} mode="many" look="subtle" selected={selected}
      options={SOCIAL_CHANNELS.map((channel) => ({ value: channel, label: t(`console.social.channels.${channel}`) }))}
      onChange={(chosen) => onChange(SOCIAL_CHANNELS.filter((channel) => chosen.includes(channel)))} />
  );
}

/** A new post (#154): its image and caption, and the channels it goes to, every one at first. */
export function PublishPost({ venueId }: { venueId: string }) {
  const publish = usePublishSocialPost(venueId);
  const [resolver] = useState(() => zodResolver(socialPostSchema));
  const form = useForm<PostValues, unknown, z.output<typeof socialPostSchema>>({ resolver, defaultValues: EMPTY });
  const [image, setImage] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = form.handleSubmit(async (values) => {
    if (image === null) {
      setOutcome({ ok: false, text: t('console.social.publish.failures.invalid') });
      return;
    }
    const done = await publish.mutateAsync({ caption: values.caption, image, channels: values.channels });
    setOutcome(done.ok ? { ok: true, text: t('console.social.publish.done') } : { ok: false, text: t(`console.social.publish.failures.${done.error}`) });
    if (done.ok) {
      form.reset(EMPTY);
      setImage(null);
    }
  });
  const caption = form.register('caption');
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Inline>
          <CameraButton camera="none" accept="image/jpeg,image/png,image/webp" variant="subtle" onPhoto={(file) => { setOutcome(null); setImage(file); }}>
            {image === null ? t('console.social.publish.chooseImage') : t('console.social.publish.imageChosen', { name: image.name })}
          </CameraButton>
        </Inline>
        <TextArea {...caption} label={t('console.social.publish.caption')} rows={6} maxLength={CAPTION_MOST} />
        <Controller control={form.control} name="channels" render={({ field }) => <Channels selected={field.value} onChange={field.onChange} />} />
        {isInvalid ? <ErrorMessage>{t('console.social.publish.failures.invalid')}</ErrorMessage> : null}
        <Inline>
          <Button variant="primary" size="compact" isLoading={publish.isPending} onClick={() => void submit()}>{t('console.social.publish.publish')}</Button>
        </Inline>
        <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
    </Box>
  );
}
