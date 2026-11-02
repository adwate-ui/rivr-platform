import { zodResolver } from '@hookform/resolvers/zod';
import {
  GAMES_PLAYED, OCCUPATIONS, PLAY_TIMES, useAuthStatus, useMember, useSignedInPhone, useSignOut, useSignUp, type SignUpFailure,
} from '@rivr/db';
import { formatMobile, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Input, PickerSheet, Stack, StepScreen, Text } from '@rivr/ui';
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Control, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

// The name as on Aadhaar and the city in English letters, as the database requires; one occupation, when they usually play
// (one, kept as a list as the database has it, #631) and any games (#653).
const signUpForm = z.object({
  fullName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z .'-]*$/),
  city: z.string().trim().min(2).max(60).regex(/^[A-Za-z][A-Za-z .'-]*$/),
  occupation: z.enum(OCCUPATIONS),
  playTimes: z.array(z.enum(PLAY_TIMES)),
  gamesPlayed: z.array(z.enum(GAMES_PLAYED)),
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

/** "Your game": the occupation (one, required), when they usually play (one) and the games they play (any). */
function YourGame({ control, occupationError }: { control: Control<SignUpForm>; occupationError: string | undefined }) {
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" tone="accent">{t('player.signUp.yourGame')}</Text>
      <Controller control={control} name="occupation" render={({ field }) => (
        <PickerSheet label={t('player.signUp.occupationLabel')} placeholder={t('player.signUp.select')} error={occupationError}
          selected={field.value === undefined ? [] : [field.value]} onChange={([value]) => field.onChange(value)}
          options={OCCUPATIONS.map((value) => ({ value, label: t(`player.signUp.occupations.${value}`) }))} />
      )} />
      <Controller control={control} name="playTimes" render={({ field }) => (
        <PickerSheet label={t('player.signUp.playTimesLabel')} placeholder={t('player.signUp.select')} selected={field.value}
          onChange={(values) => field.onChange(values.slice(0, 1))}
          options={PLAY_TIMES.map((value) => ({ value, label: t(`player.signUp.playTimes.${value}`) }))} />
      )} />
      <Controller control={control} name="gamesPlayed" render={({ field }) => (
        <PickerSheet label={t('player.signUp.gamesLabel')} placeholder={t('player.signUp.selectAny')} mode="many" selected={field.value}
          onChange={field.onChange} options={GAMES_PLAYED.map((value) => ({ value, label: t(`player.signUp.games.${value}`) }))} />
      )} />
    </Stack>
  );
}

type Form = UseFormReturn<SignUpForm, unknown, z.output<typeof signUpForm>>;

/** The name as on Aadhaar and the city, each a box with its label inside, then their game. */
function SignUpFields({ form }: { form: Form }) {
  const { errors } = form.formState;
  const nameField = form.register('fullName');
  const cityField = form.register('city');
  return (
    <Stack gap={8}>
      <Stack gap={3}>
        <Input {...nameField} variant="inset" label={t('player.signUp.nameLabel')} placeholder={t('player.signUp.namePlaceholder')}
          autoComplete="name" maxLength={100} error={errors.fullName ? t('player.signUp.nameInvalid') : undefined} />
        <Input {...cityField} variant="inset" label={t('player.signUp.cityLabel')} placeholder={t('player.signUp.cityPlaceholder')}
          autoComplete="address-level2" maxLength={60} error={errors.city ? t('player.signUp.cityInvalid') : undefined} />
      </Stack>
      <YourGame control={form.control} occupationError={errors.occupation ? t('player.signUp.occupationNeeded') : undefined} />
    </Stack>
  );
}

/**
 * Joining the club, after the code (decision 0320): "About you", step 1 of 2, with the number they signed up with; the name
 * on their Aadhaar, which the identity check later matches, their city, and their game. Back signs out, to the number step.
 * They become a member with the codes of the link they arrived by, and land on the screen the link pointed at (`?next=`).
 */
export function SignUpScreen() {
  const authStatus = useAuthStatus();
  const member = useMember();
  const signUp = useSignUp();
  const signOut = useSignOut();
  const phone = useSignedInPhone().data ?? null;
  const navigate = useNavigate();
  const { next } = useSearch({ from: '/sign-up' });
  const [failure, setFailure] = useState<SignUpFailure | null>(null);
  const [resolver] = useState(() => zodResolver(signUpForm));
  const form = useForm<SignUpForm, unknown, z.output<typeof signUpForm>>({ resolver, defaultValues: { fullName: '', city: '', playTimes: [], gamesPlayed: [] } });

  const join = form.handleSubmit(async (answers) => {
    const joined = await signUp.mutateAsync({ ...answers, photo: null });
    setFailure(joined.ok ? null : joined.error);
    if (joined.ok) await navigate({ href: next ?? '/', replace: true });
  });
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next }} replace />;
  if (member.data) return <GoTo href={next ?? '/'} />;
  return (
    <StepScreen
      title={t('player.signUp.title')}
      // Back is the number step: this screen sends a signed-out phone to sign-in.
      back={{ label: t('player.signUp.back'), onBack: () => signOut.mutate() }}
      look={{ serifSize: 40, subtitle: phone === null ? undefined : t('player.signUp.phone', { phone: formatMobile(phone) }),
        progress: { step: 1, of: 2, label: t('player.signUp.progress') }, isFooterRuled: true }}
      onSubmit={join}
      footer={
        <Button variant="primary" size="tall" type="submit" fullWidth isLoading={signUp.isPending || member.isPending}>
          {t('player.signUp.submit')}
        </Button>
      }
    >
      <SignUpFields form={form} />
      {failure === null ? null : <ErrorMessage look="dot">{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </StepScreen>
  );
}
