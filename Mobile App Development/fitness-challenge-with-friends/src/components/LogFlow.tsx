import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Animated, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { CheckinData, CheckinResult } from '../../shared/api';
import { ACTIVITIES, TYPES, fmt, localDate, logOptions, longDate } from '../../shared/catalog';
import type { Activity, ChallengeType } from '../../shared/catalog';
import { api } from '../api';
import { Chips, SwipeCard, Wheel, type SwipeCardHandle } from '../inputs';
import { easeOut, nativeDriver } from '../motion';
import { colors, space } from '../theme';
import { Button, Card, ErrorText, Icon, T, TextLink } from '../ui';
import { ChallengeCard } from './ChallengeCard';

type Phase = 'ask' | 'what' | 'no' | 'logged';

const START_AMOUNT: Partial<Record<ChallengeType, number>> = { steps: 6000, miles: 2 };

type Props = {
  data: CheckinData;
  /** Challenge to count toward from the start (the Log today button). */
  preset?: string;
  bottomSpace: number;
  onLogged?: () => void;
  onFinish: () => void;
  onNotToday?: () => void;
};

/** Yes or no, what you did, which challenges it counts toward, how many if numeric, log it. */
export function LogFlow({ data, preset, bottomSpace, onLogged, onFinish, onNotToday }: Props) {
  const [phase, setPhaseState] = useState<Phase>('ask');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [picked, setPicked] = useState<string[]>(preset ? [preset] : []);
  const [pickedByHand, setPickedByHand] = useState(!!preset);
  const [amounts, setAmounts] = useState(START_AMOUNT);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const swipe = useRef<SwipeCardHandle>(null);
  const appear = useRef(new Animated.Value(1)).current;
  const lineIn = useRef(new Animated.Value(0)).current;

  const setPhase = (next: Phase) => {
    setPhaseState(next);
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 200, easing: easeOut, useNativeDriver: nativeDriver }).start();
  };

  useEffect(() => {
    if (phase !== 'logged') return;
    lineIn.setValue(0);
    Animated.timing(lineIn, { toValue: 1, duration: 200, delay: 400, easing: easeOut, useNativeDriver: nativeDriver }).start();
  }, [phase, lineIn]);

  const open = data.challenges.filter((c) => !c.loggedToday);
  const chosen = open.filter((c) => picked.includes(c.id));
  const numericTypes = [...new Set(chosen.filter((c) => c.numeric).map((c) => c.type))];

  const chooseActivity = (a: Activity) => {
    setActivity(a);
    if (pickedByHand) return;
    const fits = open.filter((c) => ACTIVITIES.find((x) => x.key === a)?.fits.includes(c.type));
    setPicked(fits.length === 1 ? [fits[0].id] : []);
  };

  const logIt = async () => {
    if (!activity) return;
    setBusy(true);
    setError(null);
    try {
      const entries = chosen.map((c) => ({ challengeId: c.id, amount: amounts[c.type] }));
      const res = await api<CheckinResult>('/checkin', { body: { activity, entries } });
      setResult(res);
      setPhase('logged');
      onLogged?.();
      // The system's own "that worked" pattern, distinct from the tap feedback on the button.
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Everyone taps the wrong thing sometimes. Right after logging, one tap takes it back.
  const undo = async () => {
    if (!result) return;
    setError(null);
    try {
      await api('/checkin/undo', { body: { checkinId: result.checkinId } });
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onFinish();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (phase === 'ask') {
    body = (
      <>
        <T variant="display" center>Did you work out today?</T>
        <SwipeCard ref={swipe} onDecide={(d) => setPhase(d === 'yes' ? 'what' : 'no')}>
          <Icon name="activity" size={56} color={colors.ink} />
          <T variant="label" color={colors.stone} center style={{ marginTop: 16 }}>
            Swipe right for yes.{'\n'}Swipe left for not today.
          </T>
        </SwipeCard>
      </>
    );
    footer = (
      <View style={styles.pair}>
        <Button variant="outline" title="Not today" style={{ flex: 1 }} onPress={() => swipe.current?.decide('no')} />
        <Button title="Yes" style={{ flex: 1 }} onPress={() => swipe.current?.decide('yes')} />
      </View>
    );
  } else if (phase === 'no') {
    body = (
      <Card style={styles.bigCard}>
        <T variant="title" center>{new Date().getHours() < 18 ? "There's still time today." : 'All right. We lock in tomorrow.'}</T>
      </Card>
    );
    footer = <Button title="Got it" onPress={() => (onNotToday ? onNotToday() : setPhase('ask'))} />;
  } else if (phase === 'what') {
    body = (
      <Card style={{ gap: space.gap }}>
        <T variant="title">Nice. What did you do?</T>
        <Chips wrap options={ACTIVITIES.map((a) => ({ key: a.key, label: a.label }))} value={activity} onChange={chooseActivity} />
        {data.challenges.length ? (
          <>
            <T variant="label" style={{ marginTop: 8 }}>Count it toward</T>
            <Chips
              wrap
              multi
              options={data.challenges.map((c) => ({
                key: c.id,
                label: c.loggedToday ? `${c.name}, done today` : c.name,
                disabled: c.loggedToday,
              }))}
              value={picked}
              onChange={(v) => {
                setPicked(v);
                setPickedByHand(true);
              }}
            />
          </>
        ) : null}
        {numericTypes.map((t) => (
          <View key={t} style={{ gap: 8, marginTop: 8 }}>
            <T variant="label">How many {TYPES[t].many}?</T>
            <Wheel
              label={`How many ${TYPES[t].many}`}
              values={logOptions(t)}
              value={amounts[t] ?? logOptions(t)[0]}
              onChange={(v) => setAmounts((a) => ({ ...a, [t]: v }))}
              format={fmt}
              itemWidth={t === 'steps' ? 136 : 96}
            />
          </View>
        ))}
        <ErrorText>{error}</ErrorText>
      </Card>
    );
    footer = <Button title="Log it" disabled={!activity} busy={busy} onPress={logIt} />;
  } else if (result) {
    body = (
      <>
        {result.cards.map((c) => (
          <ChallengeCard key={c.id} card={c} from={result.previous[c.id]} preview />
        ))}
        <Animated.View style={{ opacity: lineIn }}>
          <T variant="title">{result.line}</T>
        </Animated.View>
      </>
    );
    footer = (
      <>
        <ErrorText>{error}</ErrorText>
        <Button title="Done" onPress={onFinish} />
        <TextLink title="Undo this log" onPress={undo} />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={phase === 'what' || phase === 'logged'}>
        <T variant="small">{longDate(localDate())}</T>
        <Animated.View
          style={{
            gap: space.gap * 2,
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          }}
        >
          {body}
        </Animated.View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottomSpace }]}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.screen, gap: space.gap * 2, flexGrow: 1 },
  footer: { paddingHorizontal: space.screen, paddingTop: space.gap, gap: space.gap },
  pair: { flexDirection: 'row', gap: space.gap },
  bigCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
});
