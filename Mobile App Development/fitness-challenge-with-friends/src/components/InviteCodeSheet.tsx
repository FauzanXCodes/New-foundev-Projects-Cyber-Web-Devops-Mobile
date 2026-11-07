import { router } from 'expo-router';
import { useState } from 'react';
import { parseInviteInput } from '../../shared/copy';
import { TextField } from '../inputs';
import { Button, ErrorText, Sheet, T } from '../ui';

/**
 * For a friend who has the app but never tapped a link: custom-scheme links do not tap in Messages, and
 * someone who installs first has nothing to tap afterwards. Paste the whole text or just the code.
 */
export function InviteCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    const token = parseInviteInput(text);
    if (!token) return setError("That doesn't look like an invite. Paste the link or type the code from the text.");
    setText('');
    setError(null);
    onClose();
    router.push(`/invite/${encodeURIComponent(token)}`);
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Have an invite?"
    >
      <T>Paste the link your friend sent, or type the code from their text.</T>
      <TextField
        placeholder="Link or code"
        value={text}
        onChangeText={(v) => {
          setError(null);
          setText(v);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel="Invite link or code"
        onSubmitEditing={go}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Continue" disabled={!text.trim()} onPress={go} />
    </Sheet>
  );
}
