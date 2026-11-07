import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { ChallengeCard as CardData } from '../../shared/api';
import { ConfettiOnce } from '../motion';
import { colors, radius, space } from '../theme';
import { AvatarStack, CheckCircle, Pressy, ProgressBar, T } from '../ui';

/** The Home card. `preview` renders the same card without navigation, for the check-in confirmation. */
export function ChallengeCard({ card, from, preview }: { card: CardData; from?: number; preview?: boolean }) {
  const inner = (
    <>
      {card.live ? <View style={styles.stripe} /> : null}
      <View style={styles.top}>
        <T variant="title" numberOfLines={2} style={{ flex: 1 }}>{card.name}</T>
        {card.periodDone ? <CheckCircle size={28} /> : null}
      </View>
      <T color={colors.stone}>{card.targetShort}</T>
      <View style={styles.progress}>
        <ProgressBar fraction={card.fraction} tone={card.periodDone ? 'ink' : 'signal'} animKey={`card:${card.id}`} from={from} />
        <T variant="label">{card.progressText}</T>
      </View>
      <View style={styles.bottom}>
        <AvatarStack people={card.members} total={card.memberCount} />
        <T variant="small">{card.waiting ? 'Waiting for your crew' : card.daysLeftText}</T>
      </View>
    </>
  );
  const label = `${card.name}. ${card.progressText}. ${card.waiting ? 'Waiting for your crew' : card.daysLeftText}.`;
  return (
    <View>
      {preview ? (
        <View accessible accessibilityLabel={label} style={styles.card}>{inner}</View>
      ) : (
        <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(`/challenge/${card.id}`)} style={styles.card}>
          {inner}
        </Pressy>
      )}
      <ConfettiOnce id={card.id} active={card.complete} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.card, paddingLeft: space.card + 4, gap: 4, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: colors.signal },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.gap },
  progress: { gap: 8, marginTop: space.gap },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.gap },
});
