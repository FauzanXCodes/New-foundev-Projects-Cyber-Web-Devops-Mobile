import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendData, HomeData, Person } from '../../shared/api';
import { localDate } from '../../shared/catalog';
import { bannerFor, crewInviteMessage, formatInviteCode } from '../../shared/copy';
import { api, inviteLink, useLoad } from '../../src/api';
import { Backdrop } from '../../src/backdrop';
import { ChallengeCard } from '../../src/components/ChallengeCard';
import { useLargeText } from '../../src/appearance';
import { Enter } from '../../src/motion';
import { scheduleReminders } from '../../src/notifications';
import { canPickContacts, sendText, shareSheet, textContact } from '../../src/share';
import { colors, radius, space } from '../../src/theme';
import { Avatar, Button, Card, ErrorText, Icon, Sheet, Skeleton, T, TextLink, useTabBarSpace } from '../../src/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export default function Home() {
  const { data, error, reload } = useLoad<HomeData>('/home');
  const [friend, setFriend] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);
  const top = useSafeAreaInsets().top;
  const tabSpace = useTabBarSpace();
  const largeText = useLargeText();

  const firstFriend = data?.crew[0]?.name ?? null;
  useEffect(() => {
    if (data) scheduleReminders({ enabled: data.user.notifications, time: data.user.workoutTime, friendName: firstFriend });
    // Only reschedule when something the reminder depends on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.user.notifications, data?.user.workoutTime, firstFriend]);

  const actions = (
    <>
      <Button title="Start a challenge" onPress={() => router.push('/create')} />
      <Button variant="outline" title="Join a challenge" onPress={() => router.push('/join')} />
    </>
  );

  return (
    <View style={styles.screen}>
      <Backdrop scene="home" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + space.gap }]}>
        {data ? (
          <>
            <Enter index={0}>
              <T variant="display">{greeting()}, {data.user.name}.</T>
            </Enter>

            <Enter index={1}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crewScroll} contentContainerStyle={styles.crewRow}>
              {data.crew.map((f) => (
                <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={f.loggedToday ? `${f.name}, logged today` : f.name} onPress={() => setFriend(f)} style={styles.crewItem}>
                  <Avatar person={f} size={56} dot={f.loggedToday} />
                  <T variant="small" color={colors.ink} numberOfLines={1}>{f.name}</T>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel="Add to your crew" onPress={() => setAdding(true)} style={styles.crewItem}>
                <View style={styles.addCircle}>
                  <Icon name="plus" size={24} color={colors.ink} />
                </View>
                <T variant="small" color={colors.ink}>Add</T>
              </Pressable>
            </ScrollView>
            </Enter>

            <Enter index={2}>
              <Card tint style={styles.banner}>
                <T>{bannerFor(localDate())}</T>
              </Card>
            </Enter>

            <View style={{ gap: space.gap }}>
              <Enter index={3}>
                <T variant="title">Your challenges</T>
              </Enter>
              {data.challenges.length ? (
                data.challenges.map((c, i) => (
                  <Enter key={c.id} index={4 + i}>
                    <ChallengeCard card={c} />
                  </Enter>
                ))
              ) : (
                <Enter index={4}>
                  <Card>
                    <T>No challenges yet. Start one or join one below.</T>
                  </Card>
                </Enter>
              )}
            </View>
          </>
        ) : error ? (
          <Card style={{ gap: space.gap }}>
            <T>{error}</T>
            <Button variant="outline" title="Try again" onPress={reload} />
          </Card>
        ) : (
          <View accessible accessibilityLabel="Loading" style={{ gap: space.gap }}>
            <Skeleton width="70%" height={34} round={10} />
            <Skeleton height={56} round={radius.card} />
            <Skeleton height={110} round={radius.card} />
            <Skeleton height={110} round={radius.card} />
          </View>
        )}
        {largeText && data ? <View style={{ gap: space.gap, paddingBottom: tabSpace }}>{actions}</View> : null}
      </ScrollView>

      {/* Pinned above the tab bar so they are always in reach; at large text sizes they would fill the
          screen, so they scroll with the page instead. */}
      {largeText ? null : <View style={[styles.actions, { paddingBottom: tabSpace + space.gap }]}>{actions}</View>}

      <FriendSheet friend={friend} onClose={() => setFriend(null)} />
      <AddCrewSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function FriendSheet({ friend, onClose }: { friend: Person | null; onClose: () => void }) {
  const [info, setInfo] = useState<FriendData | null>(null);
  useEffect(() => {
    setInfo(null);
    if (friend) api<FriendData>(`/crew/${friend.id}`).then(setInfo, () => {});
  }, [friend]);

  return (
    <Sheet visible={!!friend} onClose={onClose}>
      {friend ? (
        <View style={styles.friendTop}>
          <Avatar person={friend} size={56} />
          <T variant="title">{friend.name}</T>
        </View>
      ) : null}
      <View style={styles.friendRow}>
        <T color={colors.stone}>Challenges completed</T>
        <T variant="label">{info ? info.completed : ' '}</T>
      </View>
      <View style={styles.friendRow}>
        <T color={colors.stone}>Biggest win</T>
        <T variant="label" style={{ flexShrink: 1, textAlign: 'right' }}>{info ? info.biggestWin ?? 'No wins yet' : ' '}</T>
      </View>
    </Sheet>
  );
}

function AddCrewSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (how: 'text' | 'contacts' | 'share') => {
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/crew/invite', { body: {} });
      const message = `${crewInviteMessage(inviteLink(token))}\n\nOr open Rally and enter the code ${formatInviteCode(token)}.`;
      const outcome = how === 'text' ? await sendText(message) : how === 'share' ? await shareSheet(message) : await textContact(message);
      if (outcome === 'sent') onClose();
      if (outcome === 'copied') setNote('Link copied. Paste it into a text.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setNote(null);
        onClose();
      }}
      title="Add to your crew"
    >
      <Button title="Text a link" onPress={() => send('text')} />
      {canPickContacts ? <Button variant="outline" title="Find from contacts" onPress={() => send('contacts')} /> : null}
      <TextLink title="Share another way" onPress={() => send('share')} />
      {note ? <T variant="label">{note}</T> : null}
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  banner: { padding: space.card },
  content: { paddingHorizontal: space.screen, paddingBottom: space.gap, gap: space.gap * 2 },
  crewScroll: { marginHorizontal: -space.screen, flexGrow: 0 },
  crewRow: { paddingHorizontal: space.screen, gap: space.gap },
  crewItem: { alignItems: 'center', gap: 4, width: 64 },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { paddingHorizontal: space.screen, paddingTop: space.gap, gap: space.gap },
  friendTop: { flexDirection: 'row', alignItems: 'center', gap: space.gap },
  friendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.gap, minHeight: 32 },
});
