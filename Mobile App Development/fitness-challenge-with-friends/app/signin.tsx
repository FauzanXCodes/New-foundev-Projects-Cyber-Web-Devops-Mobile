import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SignupResult } from '../shared/api';
import { api, rememberAccount, setSession } from '../src/api';
import { PinPad, TextField } from '../src/inputs';
import { colors, space } from '../src/theme';
import { Button, ErrorText, Header, Page, T, TextLink } from '../src/ui';

/** Signing in on a device that doesn't already remember you. Two questions, one each. */
export default function SignIn() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useSafeAreaInsets().top;

  const digits = phone.replace(/\D/g, '');

  const submit = async (finalPin: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<SignupResult>('/signin', { body: { phone: digits, pin: finalPin } });
      await rememberAccount({ token: res.token, name: res.user.name, avatar: res.user.avatar });
      await setSession(res.token);
      if (invite) router.replace(`/invite/${invite}`);
    } catch (e) {
      setError((e as Error).message);
      setPin('');
      setBusy(false);
    }
  };

  const header = step > 0 ? <Header onBack={() => setStep(0)} /> : <View style={{ height: top + space.touch }} />;

  if (step === 0) {
    return (
      <Page
        header={header}
        backdrop="checkin"
        footer={
          <>
            <Button title="Next" disabled={digits.length !== 10} onPress={() => setStep(1)} />
            <TextLink title="Don't have an account? Create one" onPress={() => router.replace('/signup')} />
          </>
        }
      >
        <T variant="display">What's your phone number?</T>
        <TextField
          placeholder="(555) 010-2030"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoFocus
          maxLength={20}
          onSubmitEditing={() => digits.length === 10 && setStep(1)}
        />
        <T color={colors.stone}>The number you added when you set up your PIN.</T>
      </Page>
    );
  }

  return (
    <Page header={header} backdrop="checkin" footer={<ErrorText>{error}</ErrorText>}>
      <T variant="display" center>Enter your PIN</T>
      <View style={{ marginTop: space.gap * 2 }}>
        <PinPad
          value={pin}
          onChange={(v) => {
            if (busy) return;
            setPin(v);
            setError(null);
            if (v.length === 4) submit(v);
          }}
        />
      </View>
    </Page>
  );
}
