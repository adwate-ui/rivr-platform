import { SOCIAL_CHANNELS } from '@rivr/contracts';
import { usePublishSocialPost, type SocialChannel } from '@rivr/db/social';
import { t } from '@rivr/i18n';
import { Button, CameraButton, ChoiceChips, ErrorMessage, Heading, Stack, StatusMessage, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';

const CAPTION_MOST = 2200;

/** A new post (#154): its image and caption, and the channels it goes to, every one at first. */
export function PublishPost({ venueId }: { venueId: string }) {
  const publish = usePublishSocialPost(venueId);
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [channels, setChannels] = useState<readonly SocialChannel[]>(SOCIAL_CHANNELS);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = () => {
    if (image === null || caption.trim() === '' || channels.length === 0) {
      setOutcome({ ok: false, text: t('console.social.publish.failures.invalid') });
      return;
    }
    void publish.mutateAsync({ caption: caption.trim(), image, channels }).then((done) => {
      setOutcome(done.ok ? { ok: true, text: t('console.social.publish.done') } : { ok: false, text: t(`console.social.publish.failures.${done.error}`) });
      if (done.ok) {
        setCaption('');
        setImage(null);
      }
    });
  };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.social.publish.title')}</Heading>
      <Text variant="small" tone="muted">{t('console.social.publish.hint')}</Text>
      <CameraButton camera="none" accept="image/jpeg,image/png,image/webp" variant="secondary" onPhoto={(file) => { setOutcome(null); setImage(file); }}>
        {image === null ? t('console.social.publish.chooseImage') : t('console.social.publish.imageChosen', { name: image.name })}
      </CameraButton>
      <TextArea label={t('console.social.publish.caption')} value={caption} maxLength={CAPTION_MOST} onChange={(event) => setCaption(event.target.value)} />
      <ChoiceChips label={t('console.social.publish.channels')} mode="many" selected={[...channels]}
        options={SOCIAL_CHANNELS.map((channel) => ({ value: channel, label: t(`console.social.channels.${channel}`) }))}
        onChange={(chosen) => setChannels(SOCIAL_CHANNELS.filter((channel) => chosen.includes(channel)))} />
      <Button variant="primary" isLoading={publish.isPending} onClick={submit}>{t('console.social.publish.publish')}</Button>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
