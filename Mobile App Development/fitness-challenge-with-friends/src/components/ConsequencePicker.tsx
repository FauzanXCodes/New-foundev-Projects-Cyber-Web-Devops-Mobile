import { View } from 'react-native';
import { CONSEQUENCE_SUGGESTIONS, offLimitsReason } from '../../shared/copy';
import { Chips, TextField } from '../inputs';
import { useConsequenceIdeas } from '../intelligence';
import { space } from '../theme';
import { Button, ErrorText, T } from '../ui';

export const consequenceProblem = (text: string) => (text.trim() ? offLimitsReason(text) : null);

/**
 * Suggestion chips plus one line for writing your own. Tapping a picked chip again clears it. With
 * Apple Intelligence, "Suggest more" adds a few fresh ideas written on the phone for this challenge
 * (`context`); picking one puts it in the text line, where it can still be edited.
 */
export function ConsequencePicker({ value, onChange, context }: { value: string; onChange: (v: string) => void; context: string }) {
  const suggested = CONSEQUENCE_SUGGESTIONS.includes(value);
  const ai = useConsequenceIdeas(context);
  return (
    <View style={{ gap: space.gap }}>
      <Chips
        wrap
        options={CONSEQUENCE_SUGGESTIONS.map((s) => ({ key: s, label: s }))}
        value={suggested ? value : null}
        onChange={(v) => onChange(v === value ? '' : v)}
      />
      {ai.available ? (
        <>
          {ai.ideas.length ? (
            <Chips wrap options={ai.ideas.map((s) => ({ key: s, label: s }))} value={ai.ideas.includes(value) ? value : null} onChange={(v) => onChange(v === value ? '' : v)} />
          ) : null}
          <Button
            variant="outline"
            icon="star"
            title={ai.ideas.length ? 'More ideas' : 'Suggest more'}
            busy={ai.busy}
            onPress={ai.ask}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 20 }}
          />
          {ai.failed ? <T variant="small">No new ideas this time. Try again, or write your own.</T> : null}
        </>
      ) : null}
      <TextField placeholder="Or write your own" value={suggested ? '' : value} onChangeText={onChange} maxLength={80} />
      <ErrorText>{consequenceProblem(value)}</ErrorText>
    </View>
  );
}
