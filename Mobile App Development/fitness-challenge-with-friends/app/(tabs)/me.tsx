import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MeData, TrackedCard } from '../../shared/api';
import { shortDate } from '../../shared/copy';
import { useLoad } from '../../src/api';
import { Backdrop } from '../../src/backdrop';
import { useLargeText } from '../../src/appearance';
import { Enter, PulseRing } from '../../src/motion';
import { colors, radius, space } from '../../src/theme';
import { Avatar, Button, Card, IconButton, Skeleton, T, useTabBarSpace } from '../../src/ui';

export default function Me() {
  const { data, error, reload } = useLoad<MeData>('/me/summary');
  const top = useSafeAreaInsets().top;
  const tabSpace = useTabBarSpace();
  const largeText = useLargeText();

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Backdrop scene="me" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: tabSpace + space.screen }]}>
        {!data ? (
          error ? (
            <Card style={{ gap: space.gap }}>
              <T>{error}</T>
              <Button variant="outline" title="Try again" onPress={reload} />
            </Card>
          ) : (
            <MeSkeleton />
          )
        ) : (
          <>
            <Enter index={0} fade={false} style={styles.header}>
              <Avatar person={data.user} size={56} />
              <T variant="title" numberOfLines={1} style={{ flex: 1 }}>{data.user.name}</T>
              <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} />
            </Enter>

            {data.user.nameChange ? (
              <Enter index={1}>
                <Card tint onPress={() => router.push('/settings')} label="Your name was changed" style={{ gap: 4 }}>
                  <T variant="label">{data.user.nameChange.by} picked your last name</T>
                  <T>You're {data.user.name} until {shortDate(data.user.nameChange.until)}, from {data.user.nameChange.challengeName}.</T>
                </Card>
              </Enter>
            ) : null}

            <Enter index={1} style={styles.hero}>
              {data.streak > 0 ? (
                <PulseRing size={64}>
                  <T variant="display" center>{data.streak}</T>
                </PulseRing>
              ) : null}
              {data.streak > 0 ? (
                <T color={colors.stone} center>day streak</T>
              ) : (
                <T variant="display" center>Start a streak today</T>
              )}
            </Enter>

            <Enter index={2} style={largeText ? styles.statsColumn : styles.stats}>
              <Stat stacked={largeText} value={data.completed} label="Challenges completed" />
              <Stat stacked={largeText} value={data.won} label="Challenges won" />
              <Stat stacked={largeText} value={data.longestStreak} label="Longest streak" />
            </Enter>

            <Enter index={3} style={{ gap: space.gap }}>
              <T variant="title">What you track</T>
              {data.tracked.length ? (
                data.tracked.map((t) => <TrackedRow key={t.type} item={t} />)
              ) : (
                <Card onPress={() => router.push('/settings')} label="Pick what you track">
                  <T>Pick what you want to track in settings.</T>
                </Card>
              )}
            </Enter>

            <Enter index={4} style={{ gap: space.gap }}>
              <T variant="title">Past challenges</T>
              {data.past.length ? (
                <Card style={{ paddingVertical: 4 }}>
                  {data.past.map((p, i) => (
                    <Pressable
                      key={`${p.id}-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${p.rangeText}, ${p.result}`}
                      onPress={() => router.push(`/challenge/${p.id}`)}
                      style={[styles.pastRow, i > 0 ? styles.divider : null]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="label">{p.name}</T>
                        <T variant="small">{p.rangeText}</T>
                      </View>
                      <T variant="label">{p.result}</T>
                    </Pressable>
                  ))}
                </Card>
              ) : (
                <Card>
                  <T>Finish a challenge and it shows up here.</T>
                </Card>
              )}
            </Enter>
          </>
        )}
        </ScrollView>
    </View>
  );
}

/** The Me screen's shape, drawn while its data is on the way, so the tab is never a blank page. */
function MeSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading" style={{ gap: space.gap }}>
      <View style={styles.header}>
        <Skeleton width={56} height={56} round={28} />
        <Skeleton height={28} width="45%" round={10} />
      </View>
      <View style={[styles.hero, { gap: 10 }]}>
        <Skeleton width={64} height={64} round={32} />
        <Skeleton width={90} height={14} />
      </View>
      <View style={styles.stats}>
        <Skeleton height={76} round={radius.card} style={{ flex: 1 }} />
        <Skeleton height={76} round={radius.card} style={{ flex: 1 }} />
        <Skeleton height={76} round={radius.card} style={{ flex: 1 }} />
      </View>
      <Skeleton width="40%" height={22} round={8} style={{ marginTop: 8 }} />
      <Skeleton height={92} round={radius.card} />
      <Skeleton width="50%" height={22} round={8} style={{ marginTop: 8 }} />
      <Skeleton height={120} round={radius.card} />
    </View>
  );
}

function Stat({ value, label, stacked }: { value: number; label: string; stacked?: boolean }) {
  return (
    <View style={[styles.stat, stacked ? styles.statWide : null]}>
      <T variant="title" center={!stacked}>{value}</T>
      <T variant="small" center={!stacked} style={stacked ? { flexShrink: 1, textAlign: 'right' } : null}>{label}</T>
    </View>
  );
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function TrackedRow({ item }: { item: TrackedCard }) {
  const max = Math.max(1, ...item.days.map((d) => d ?? 0));
  return (
    <Card style={styles.tracked}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label" color={colors.stone}>{item.label}</T>
        <T variant="title">{item.totalText}</T>
      </View>
      <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {item.days.map((d, i) => {
          const isToday = i === item.todayIndex;
          const height = d ? Math.max(6, (d / max) * 44) : 6;
          return (
            <View key={i} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={{
                    height,
                    borderRadius: radius.pill,
                    backgroundColor: isToday ? colors.accent : d ? colors.ink : colors.track,
                  }}
                />
              </View>
              <T variant="small" color={isToday ? colors.ink : colors.stone}>{DAY_LETTERS[i]}</T>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.screen, gap: space.gap * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  hero: { alignItems: 'center', paddingVertical: space.gap },
  stats: { flexDirection: 'row', gap: 8 },
  statsColumn: { gap: 8 },
  statWide: { flex: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.gap, paddingHorizontal: space.card },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 8, gap: 2 },
  tracked: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  bars: { flexDirection: 'row', gap: 6 },
  barColumn: { alignItems: 'center', gap: 4 },
  barTrack: { width: 14, height: 44, justifyContent: 'flex-end' },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: space.gap, minHeight: 64, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
