import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InvitePreview, SignupResult } from '../../shared/api';
import { BANDS, TIMES, fairPlay, timeLabel } from '../../shared/catalog';
import type { Band } from '../../shared/catalog';
import { api, rememberAccount, setSession, useSession } from '../../src/api';
import { ChallengeView } from '../../src/components/ChallengeView';
import { Chips, TextField, Wheel } from '../../src/inputs';
import { scheduleReminders } from '../../src/notifications';
import { colors, space } from '../../src/theme';
import { Button, Card, ErrorText, Header, Page, T, TextLink } from '../../src/ui';

/** Where an invite link lands. You see the challenge and its consequence before making an account. */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const session = useSession();
  const top = useSafeAreaInsets().top;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'look' | 'details'>('look');
  const [name, setName] = useState('');
  const [band, setBand] = useState<Band>('active');
  const [time, setTime] = useState('07:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    api<InvitePreview>(`/invites/${token}`).then((p) => {
      if (p.alreadyMember && p.challenge) router.replace(`/challenge/${p.challenge.id}`);
      else setPreview(p);
    }, (e) => setLoadError((e as Error).message));
  }, [token, session.token]);

  // Protected screens open only after the new session has rendered, so navigate from an effect.
  useEffect(() => {
    if (session.token && destination) router.replace(destination as never);
  }, [session.token, destination]);

  const imIn = async () => {
    if (!session.token) return setStep('details');
    setBusy(true);
    setError(null);
    try {
      const { challengeId } = await api<{ challengeId: string | null }>(`/invites/${token}/accept`, { body: {} });
      setDestination(challengeId ? `/challenge/${challengeId}` : '/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<SignupResult>('/signup', { body: { name: name.trim(), workoutTime: time, band, inviteToken: token } });
      setDestination(res.challengeId ? `/challenge/${res.challengeId}` : '/');
      await rememberAccount({ token: res.token, name: res.user.name, avatar: res.user.avatar });
      await setSession(res.token);
      scheduleReminders({ enabled: true, time, friendName: preview?.inviterName ?? null, ask: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const spacer = <View style={{ height: top + space.touch, backgroundColor: colors.paper }} />;

  if (!preview) {
    return (
      <Page header={spacer}>
        {loadError ? (
          <Card>
            <T>{loadError}</T>
          </Card>
        ) : null}
      </Page>
    );
  }

  if (step === 'details') {
    return (
      <Page
        header={<Header onBack={() => setStep('look')} />}
        footer={
          <>
            <ErrorText>{error}</ErrorText>
            <Button title={preview.challenge ? 'Join the challenge' : 'Join the crew'} disabled={!name.trim()} busy={busy} onPress={createAccount} />
          </>
        }
      >
        <T variant="display">What should we call you?</T>
        <TextField placeholder="Your name" value={name} onChangeText={setName} autoFocus maxLength={30} autoCapitalize="words" />
        {preview.challenge && fairPlay(preview.challenge.type, preview.challenge.house) ? (
          <>
            <T variant="title" style={{ marginTop: space.gap }}>How active are you?</T>
            <Chips wrap options={BANDS.map((b) => ({ key: b.key, label: b.label }))} value={band} onChange={setBand} />
            <T color={colors.stone}>Sets your own target, so this stays a fair fight.</T>
          </>
        ) : null}
        <T variant="title" style={{ marginTop: space.gap }}>When do you usually work out?</T>
        <Wheel label="Workout time" values={TIMES} value={time} onChange={setTime} format={timeLabel} itemWidth={156} />
        <T color={colors.stone}>We'll remind you once a day.</T>
      </Page>
    );
  }

  const footer = (
    <>
      <ErrorText>{error}</ErrorText>
      {preview.ended ? (
        <T center color={colors.stone}>This challenge has ended.</T>
      ) : (
        <>
          <Button title="I'm in" busy={busy} onPress={imIn} />
          {!session.token ? (
            <TextLink title="Already have an account? Sign in" onPress={() => router.push(`/signin?invite=${token}`)} />
          ) : null}
        </>
      )}
    </>
  );

  if (!preview.challenge) {
    return (
      <Page header={spacer} footer={footer}>
        <T variant="display">{preview.inviterName} wants you in their crew.</T>
        <T color={colors.stone}>Start challenges together and keep each other honest.</T>
      </Page>
    );
  }

  return (
    <ChallengeView
      detail={preview.challenge}
      onChange={() => {}}
      header={spacer}
      eyebrow={`${preview.inviterName} invited you`}
      footer={footer}
    />
  );
}
