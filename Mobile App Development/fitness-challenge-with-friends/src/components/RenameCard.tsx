import { useState } from 'react';
import { View } from 'react-native';
import type { ChallengeDetail } from '../../shared/api';
import { cleanLastName, shortDate } from '../../shared/copy';
import { TextField } from '../inputs';
import { space } from '../theme';
import { Button, Card, ErrorText, T } from '../ui';

type Props = {
  detail: ChallengeDetail;
  /** Resolves to an error message, or null when it worked. */
  onSet: (userId: string, lastName: string) => Promise<string | null>;
};

/**
 * The last name punishment, once the challenge is over. The winner gets a field and a button; everyone
 * else sees what is happening, in plain words. It stays put after the name is set so the whole crew
 * can see who did it and until when.
 */
export function RenameCard({ detail, onSet }: Props) {
  const rename = detail.rename;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!rename) return null;
  const winner = detail.winnerName ?? 'The winner';

  return (
    <Card style={{ gap: space.gap }}>
      <T variant="title">{rename.canSet ? 'Pick a new last name' : 'New last name'}</T>
      {rename.targets.map((t) => {
        const draft = drafts[t.id] ?? '';
        const valid = !!cleanLastName(draft);
        if (t.status === 'active') {
          return (
            <T key={t.id}>
              {t.isYou ? `You're ${t.newName}` : `${t.name} is now ${t.newName}`} until {shortDate(t.until!)}.
            </T>
          );
        }
        if (t.status === 'over') return <T key={t.id}>{t.isYou ? 'Your' : `${t.name}'s`} new last name has run its course.</T>;
        if (!rename.canSet) {
          return <T key={t.id}>{winner} gets to pick {t.isYou ? 'your' : `${t.name}'s`} new last name.</T>;
        }
        return (
          <View key={t.id} style={{ gap: 8 }}>
            <T>{t.name} is on the hook. Give {t.name} any last name you like. It lasts a week.</T>
            <TextField
              placeholder="New last name"
              value={draft}
              onChangeText={(v) => {
                setError(null);
                setDrafts((d) => ({ ...d, [t.id]: v }));
              }}
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel={`New last name for ${t.name}`}
            />
            <ErrorText>{draft.trim() && !valid ? 'Letters only, up to 20.' : error}</ErrorText>
            <Button
              title={`Change ${t.name}'s last name`}
              disabled={!valid}
              busy={busy === t.id}
              onPress={async () => {
                setBusy(t.id);
                setError(await onSet(t.id, draft));
                setBusy(null);
              }}
            />
          </View>
        );
      })}
    </Card>
  );
}
