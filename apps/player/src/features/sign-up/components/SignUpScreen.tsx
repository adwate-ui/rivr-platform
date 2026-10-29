import { zodResolver } from '@hookform/resolvers/zod';
import {
  OCCUPATIONS, PLAY_TIMES, shrinkPhoto, useAuthStatus, useMember, useSignedInPhone, useSignOut, useSignUp, type SignUpFailure,
} from '@rivr/db';
import { formatMobile, t, type MessageKey } from '@rivr/i18n';
import { Button, CameraButton, ChoiceChips, ErrorMessage, Input, StepScreen, Text } from '@rivr/ui';
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Control, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

// The name as on Aadhaar and the city in English letters, as the database requires; one occupation, any play times (#631).
const signUpForm = z.object({
  fullName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z .'-]*$/),
  city: z.string().trim().min(2).max(60).regex(/^[A-Za-z][A-Za-z .'-]*$/),
  occupation: z.enum(OCCUPATIONS),
  playTimes: z.array(z.enum(PLAY_TIMES)),
});
type SignUpForm = z.input<typeof signUpForm>;

const FAILURE_COPY: Readonly<Record<SignUpFailure, MessageKey>> = {
  invalid_name: 'player.signUp.nameInvalid',
  invalid_answers: 'player.signUp.answersInvalid',
  photo_failed: 'player.signUp.photoFailed',
  staff: 'player.signUp.staff',
  stopped: 'player.signUp.stopped',
  unavailable: 'player.signUp.unavailable',
};

/** Opens a path in the app (a checked `?next=`, never an outside address) in place of this screen. */
function GoTo({ href }: { href: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ href, replace: true });
  }, [href, navigate]);
  return null;
}

/**
 * The optional photo (#631): taken or chosen from the phone, made a JPEG as the selfie is, kept until sign-up sends it, or
 * taken off again. A file the browser cannot read as an image adds none.
 */
function PhotoField({ photo, onPhoto }: { photo: Blob | null; onPhoto: (photo: Blob | null) => void }) {
  if (photo === null) {
    const choose = (file: File) => void shrinkPhoto(file).then(onPhoto, () => onPhoto(null));
    return <CameraButton variant="secondary" camera="none" fullWidth onPhoto={choose}>{t('player.signUp.addPhoto')}</CameraButton>;
  }
  return (
    <>
      <Text tone="muted">{t('player.signUp.photoAdded')}</Text>
      <Button variant="text" fullWidth onClick={() => onPhoto(null)}>{t('player.signUp.removePhoto')}</Button>
    </>
  );
}

/** What best describes the member, one choice, and when they usually play, any of them (#631). */
function Choices({ control, occupationError }: { control: Control<SignUpForm>; occupationError: string | undefined }) {
  return (
    <>
      <Controller control={control} name="occupation" render={({ field }) => (
        <ChoiceChips label={t('player.signUp.occupationLabel')} mode="one" selected={field.value === undefined ? [] : [field.value]}
          options={OCCUPATIONS.map((value) => ({ value, label: t(`player.signUp.occupations.${value}`) }))}
          onChange={([value]) => field.onChange(value)} />
      )} />
      {occupationError === undefined ? null : <ErrorMessage>{occupationError}</ErrorMessage>}
      <Controller control={control} name="playTimes" render={({ field }) => (
        <ChoiceChips label={t('player.signUp.playTimesLabel')} mode="many" selected={field.value}
          options={PLAY_TIMES.map((value) => ({ value, label: t(`player.signUp.playTimes.${value}`) }))} onChange={field.onChange} />
      )} />
    </>
  );
}

type Form = UseFormReturn<SignUpForm, unknown, z.output<typeof signUpForm>>;

/** The fields, in the order the owner asked: the number, the photo, the name, the city, then the two choices (#631). */
function SignUpFields({ form, photo, onPhoto }: { form: Form; photo: Blob | null; onPhoto: (photo: Blob | null) => void }) {
  const phone = useSignedInPhone().data ?? null;
  const { errors } = form.formState;
  const nameField = form.register('fullName');
  const cityField = form.register('city');
  return (
    <>
      {phone === null ? null : <Text>{t('player.signUp.phone', { phone: formatMobile(phone) })}</Text>}
      <PhotoField photo={photo} onPhoto={onPhoto} />
      <Text tone="muted">{t('player.signUp.intro')}</Text>
      <Input {...nameField} label={t('player.signUp.nameLabel')} autoComplete="name" maxLength={100} autoFocus
        error={errors.fullName ? t('player.signUp.nameInvalid') : undefined} />
      <Input {...cityField} label={t('player.signUp.cityLabel')} autoComplete="address-level2" maxLength={60}
        error={errors.city ? t('player.signUp.cityInvalid') : undefined} />
      <Choices control={form.control} occupationError={errors.occupation ? t('player.signUp.occupationNeeded') : undefined} />
    </>
  );
}

/**
 * Joining the club, after the code: the number they signed in with, an optional photo, the name on their Aadhaar, which
 * the identity check later matches, their city, what best describes them and when they usually play (#631). They become
 * a member with the codes of the link they arrived by, and land on the screen the link pointed at (`?next=`), or on Tonight.
 */
export function SignUpScreen() {
  const authStatus = useAuthStatus();
  const member = useMember();
  const signUp = useSignUp();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { next } = useSearch({ from: '/sign-up' });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [failure, setFailure] = useState<SignUpFailure | null>(null);
  const [resolver] = useState(() => zodResolver(signUpForm));
  const form = useForm<SignUpForm, unknown, z.output<typeof signUpForm>>({ resolver, defaultValues: { fullName: '', city: '', playTimes: [] } });

  const join = form.handleSubmit(async (answers) => {
    const joined = await signUp.mutateAsync({ ...answers, photo });
    setFailure(joined.ok ? null : joined.error);
    if (joined.ok) await navigate({ href: next ?? '/', replace: true });
  });
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next }} replace />;
  if (member.data) return <GoTo href={next ?? '/'} />;
  return (
    <StepScreen
      title={t('player.signUp.title')}
      onSubmit={join}
      footer={
        <>
          <Button variant="primary" type="submit" fullWidth isLoading={signUp.isPending || member.isPending}>
            {t('player.signUp.submit')}
          </Button>
          {/* A mistyped number signs out and starts again: this screen sends a signed-out phone to sign-in. */}
          <Button variant="text" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
            {t('player.signUp.otherNumber')}
          </Button>
        </>
      }
    >
      <SignUpFields form={form} photo={photo} onPhoto={setPhoto} />
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </StepScreen>
  );
}
