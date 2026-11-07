import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LENGTHS, TRACK_TYPES, TYPES, fmt, targetOptions, targetText } from '../shared/catalog';
import type { ChallengeType, TrackType } from '../shared/catalog';
import { api } from '../src/api';
import { ConsequencePicker, consequenceProblem } from '../src/components/ConsequencePicker';
import { useInviteComposer } from '../src/components/InviteComposer';
import { Chips, TextField, Wheel } from '../src/inputs';
import { colors, radius, space } from '../src/theme';
import { Button, Card, ErrorText, IconButton, Page, T, TextLink } from '../src/ui';

const TITLES = ['What kind of challenge?', 'How much and how long?', 'Consequence for last place?', 'Invite your crew.'];

export default function Create() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<TrackType | null>(null);
  const [name, setName] = useState('');
  const [per, setPer] = useState<'day' | 'week'>('week');
  const [target, setTarget] = useState(3);
  const [lengthDays, setLengthDays] = useState(28);
  const [consequence, setConsequence] = useState('');
  const [error, setError] = useState<string | null>(null);
  const created = useRef<Promise<{ id: string; token: string }> | null>(null);

  const kind: ChallengeType = type ?? 'custom';
  const spec = {
    type: kind, target, per, lengthDays,
    name: name.trim() || TYPES[kind].defaultName,
    consequence: consequence.trim() || null,
  };

  const pickType = (t: TrackType) => {
    setType(t);
    setPer(TYPES[t].defaultPer);
    setTarget(TYPES[t].defaultTarget);
  };

  const changePer = (next: 'day' | 'week') => {
    setPer(next);
    const options = targetOptions(kind, next);
    if (!options.includes(target)) {
      setTarget(options.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), options[0]));
    }
  };

  // The challenge is created on the first send (or skip), so closing early leaves nothing behind.
  const create = () => {
    created.current ??= api<{ id: string; token: string }>('/challenges', {
      body: { type: kind, name: name.trim() || undefined, target, per, lengthDays, consequence: consequence.trim() || undefined },
    }).catch((e) => {
      created.current = null;
      throw e;
    });
    return created.current;
  };

  const invite = useInviteComposer({
    spec,
    getToken: async () => (await create()).token,
    onFinish: () => router.back(),
    onSkip: async () => {
      try {
        await create();
        router.back();
      } catch (e) {
        setError((e as Error).message);
      }
    },
  });

  let body: React.ReactNode;
  let footer: React.ReactNode;
  if (step === 0) {
    body = (
      <>
        <Chips wrap options={TRACK_TYPES.map((t) => ({ key: t, label: TYPES[t].label }))} value={type} onChange={pickType} />
        <TextField placeholder="Or name your own" value={name} onChangeText={setName} maxLength={40} />
      </>
    );
    footer = <Button title="Next" disabled={!type && !name.trim()} onPress={() => setStep(1)} />;
  } else if (step === 1) {
    body = (
      <>
        <Wheel label="Target" values={targetOptions(kind, per)} value={target} onChange={setTarget} format={fmt} itemWidth={kind === 'steps' ? 136 : 88} />
        <Chips options={[{ key: 'day', label: 'Per day' }, { key: 'week', label: 'Per week' }]} value={per} onChange={changePer} />
        <Chips options={LENGTHS.map((l) => ({ key: String(l.days), label: l.label }))} value={String(lengthDays)} onChange={(v) => setLengthDays(Number(v))} />
        <Card>
          <T variant="title">{targetText(spec)}</T>
        </Card>
      </>
    );
    footer = <Button title="Next" onPress={() => setStep(2)} />;
  } else if (step === 2) {
    body = (
      <>
        <ConsequencePicker value={consequence} onChange={setConsequence} context={`${spec.name}, ${targetText(spec)}`} />
        <T variant="small">Your crew votes on this once they're in. No money, nothing mean.</T>
      </>
    );
    footer = (
      <>
        <Button title="Next" disabled={!!consequenceProblem(consequence)} onPress={() => setStep(3)} />
        <TextLink
          title="Skip for now"
          onPress={() => {
            setConsequence('');
            setStep(3);
          }}
        />
      </>
    );
  } else {
    body = (
      <>
        {invite.content}
        <ErrorText>{error}</ErrorText>
      </>
    );
    footer = invite.actions;
  }

  return (
    <Page raised header={<StepHeader step={step} onBack={() => setStep(step - 1)} />} footer={footer} contentStyle={{ gap: space.gap * 2 }}>
      <T variant="display">{TITLES[step]}</T>
      {body}
    </Page>
  );
}

function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const top = useSafeAreaInsets().top;
  return (
    <View style={[styles.header, { paddingTop: top + 4 }]}>
      {step > 0 ? <IconButton name="arrow-left" label="Back" onPress={onBack} /> : <View style={styles.spacer} />}
      <View style={styles.dots} accessible accessibilityLabel={`Step ${step + 1} of ${TITLES.length}`}>
        {TITLES.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step ? styles.dotOn : null]} />
        ))}
      </View>
      <IconButton name="x" label="Close" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  spacer: { width: space.touch },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.ink },
});
