import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { HouseCard } from '../shared/api';
import { api, useLoad } from '../src/api';
import { InviteCodeSheet } from '../src/components/InviteCodeSheet';
import { colors, space } from '../src/theme';
import { Button, Card, ErrorText, Header, Page, T, Waiting } from '../src/ui';

export default function Join() {
  const { data, error: loadError, reload } = useLoad<HouseCard[]>('/house');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const join = async (h: HouseCard) => {
    setError(null);
    setBusy(h.id);
    try {
      if (!h.joined) await api(`/challenges/${h.id}/join`, { body: {} });
      router.replace(`/challenge/${h.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page header={<Header />}>
      <T variant="display">Join a challenge</T>
      <Card style={{ gap: 4 }}>
        <T variant="title">Have an invite?</T>
        <T color={colors.stone}>Paste the link or type the code a friend sent you.</T>
        <View style={styles.bottom}>
          <View style={{ flex: 1 }} />
          <Button variant="outline" title="Enter it" style={styles.button} onPress={() => setInviteOpen(true)} />
        </View>
      </Card>
      <ErrorText>{error}</ErrorText>
      {!data ? <Waiting error={loadError} onRetry={reload} blocks={[110, 110, 110]} /> : null}
      {data?.map((h) => (
        <Card key={h.id} style={{ gap: 4 }}>
          <T variant="title">{h.name}</T>
          <T color={colors.stone}>{h.targetText}</T>
          <View style={styles.bottom}>
            <T variant="label">
              {h.joined ? "You're in" : h.memberCount === 0 ? 'Be the first one in' : h.memberCount === 1 ? '1 person in' : `${h.memberCount} people in`}
            </T>
            <Button variant="outline" title={h.joined ? 'Open' : 'Join'} busy={busy === h.id} style={styles.button} onPress={() => join(h)} />
          </View>
        </Card>
      ))}
      <InviteCodeSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.gap },
  button: { minWidth: 112, minHeight: space.touch },
});
