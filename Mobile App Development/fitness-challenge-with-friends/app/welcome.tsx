import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { biometricsAvailable, biometricsLabel, unlockWithBiometrics } from '../src/biometrics';
import { forgetAccount, getRememberedAccount, setSession, type LockedAccount } from '../src/api';
import { Backdrop } from '../src/backdrop';
import { InviteCodeSheet } from '../src/components/InviteCodeSheet';
import { space } from '../src/theme';
import { Avatar, Button, ErrorText, T, TextLink } from '../src/ui';

/** The very first thing a signed-out device sees. A device that already has an account jumps
 * straight to "welcome back" instead of asking someone to create a second one by mistake. */
export default function Welcome() {
  const top = useSafeAreaInsets().top;
  const [checked, setChecked] = useState(false);
  const [remembered, setRemembered] = useState<LockedAccount | null>(null);
  const [bioLabel, setBioLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [acct, bio] = await Promise.all([getRememberedAccount(), biometricsAvailable()]);
      setRemembered(acct);
      if (bio) setBioLabel(await biometricsLabel());
      setChecked(true);
    })();
  }, []);

  const continueAs = async (acct: LockedAccount, viaBiometrics: boolean) => {
    setBusy(true);
    setError(null);
    if (viaBiometrics) {
      const ok = await unlockWithBiometrics(`Sign in as ${acct.name}`);
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    await setSession(acct.token);
  };

  if (!checked) return <View style={{ flex: 1 }} />;

  if (remembered) {
    return (
      <View style={{ flex: 1, paddingTop: top + space.screen * 2, paddingHorizontal: space.screen }}>
        <Backdrop scene="welcome" />
        <View style={{ flex: 1, alignItems: 'center', gap: space.gap, justifyContent: 'center' }}>
          <Avatar person={remembered} size={72} />
          <T variant="display" center>Welcome back, {remembered.name}.</T>
          <ErrorText>{error}</ErrorText>
        </View>
        <View style={{ gap: space.gap, paddingBottom: space.screen }}>
          <Button
            title={bioLabel ? `Unlock with ${bioLabel}` : 'Continue'}
            busy={busy}
            onPress={() => continueAs(remembered, !!bioLabel)}
          />
          <TextLink
            title="Not you? Use a different account"
            onPress={async () => {
              await forgetAccount();
              setRemembered(null);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: top + space.screen * 2, paddingHorizontal: space.screen }}>
      <Backdrop scene="welcome" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.gap }}>
        <Image source={require('../assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 24 }} />
        <T variant="display" center>Rally</T>
        <T center style={{ maxWidth: 280 }}>A friend invites you to a challenge. You log one thing a day. The app keeps score.</T>
      </View>
      <View style={{ gap: space.gap, paddingBottom: space.screen }}>
        <Button title="Create account" onPress={() => router.push('/signup')} />
        <Button variant="outline" title="Sign in" onPress={() => router.push('/signin')} />
        <TextLink title="Have an invite?" onPress={() => setInviteOpen(true)} />
      </View>
      <InviteCodeSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </View>
  );
}
