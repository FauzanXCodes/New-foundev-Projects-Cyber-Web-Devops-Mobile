import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SignupResult } from '../shared/api';
import { BANDS, TIMES, TRACK_TYPES, TYPES, timeLabel } from '../shared/catalog';
import type { Band, TrackType } from '../shared/catalog';
import { api, rememberAccount, setSession } from '../src/api';
import { Chips, PinPad, TextField, Wheel } from '../src/inputs';
import { scheduleReminders } from '../src/notifications';
import { colors, space } from '../src/theme';
import { Button, ErrorText, Header, Page, T } from '../src/ui';

/** First open without an invite: five screens, one question each. The last one is skippable. */
export default function Signup() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [tracked, setTracked] = useState<TrackType[]>([]);
  const [band, setBand] = useState<Band>('active');
  const [time, setTime] = useState('07:00');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = useSafeAreaInsets().top;

  const phoneDigits = phone.replace(/\D/g, '');
  const canSignIn = phoneDigits.length === 10 && pin.length === 4;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim(), trackedTypes: tracked, band, workoutTime: time };
      if (canSignIn) {
        body.phone = phoneDigits;
        body.pin = pin;
      }
      const res = await api<SignupResult>('/signup', { body });
      await rememberAccount({ token: res.token, name: res.user.name, avatar: res.user.avatar });
      await setSession(res.token);
      scheduleReminders({ enabled: true, time, friendName: null, ask: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const header = step > 0 ? <Header onBack={() => setStep(step - 1)} /> : <View style={{ height: top + space.touch }} />;

  if (step === 0) {
    return (
      <Page header={header} footer={<Button title="Next" disabled={!name.trim()} onPress={() => setStep(1)} />}>
        <T variant="display">What should we call you?</T>
        <TextField
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={30}
          autoCapitalize="words"
          onSubmitEditing={() => name.trim() && setStep(1)}
        />
      </Page>
    );
  }

  if (step === 1) {
    return (
      <Page header={header} footer={<Button title="Next" disabled={tracked.length < 2} onPress={() => setStep(2)} />}>
        <T variant="display">What do you want to keep track of?</T>
        <Chips wrap multi max={3} options={TRACK_TYPES.map((t) => ({ key: t, label: TYPES[t].label }))} value={tracked} onChange={setTracked} />
        <T variant="small">Pick two or three.</T>
      </Page>
    );
  }

  if (step === 2) {
    return (
      <Page header={header} footer={<Button title="Next" onPress={() => setStep(3)} />}>
        <T variant="display">How active are you?</T>
        <Chips wrap options={BANDS.map((b) => ({ key: b.key, label: b.label }))} value={band} onChange={setBand} />
        <T color={colors.stone}>Sets your own step and mile goals, so a steps challenge is a fair fight either way.</T>
      </Page>
    );
  }

  if (step === 3) {
    return (
      <Page header={header} footer={<Button title="Next" onPress={() => setStep(4)} />}>
        <T variant="display">When do you usually work out?</T>
        <Wheel label="Workout time" values={TIMES} value={time} onChange={setTime} format={timeLabel} itemWidth={156} />
        <T color={colors.stone}>We'll remind you once a day.</T>
      </Page>
    );
  }

  return (
    <Page
      header={header}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button title="Done" busy={busy} onPress={finish} />
        </>
      }
    >
      <T variant="display">Save your account?</T>
      <TextField
        placeholder="(555) 010-2030"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={20}
      />
      <View style={{ alignItems: 'center', marginTop: space.gap }}>
        <PinPad value={pin} onChange={setPin} />
      </View>
      <T color={colors.stone}>Add a phone number and a 4 digit PIN so you can sign back in on a new phone. Optional — skip it and Done still creates your account.</T>
    </Page>
  );
}
