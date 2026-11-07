import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CheckinData } from '../../shared/api';
import { useLoad } from '../../src/api';
import { LogFlow } from '../../src/components/LogFlow';
import { colors, space } from '../../src/theme';
import { Header, Waiting } from '../../src/ui';

/** Log today from a challenge. The same flow as Check-in, counting toward this challenge from the start. */
export default function LogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad<CheckinData>('/checkin');
  const bottom = Math.max(useSafeAreaInsets().bottom, space.screen);
  const close = () => router.back();

  return (
    <View style={{ flex: 1, backgroundColor: colors.paperRaised }}>
      <Header close={close} />
      {data ? (
        <LogFlow data={data} preset={id} bottomSpace={bottom} onFinish={close} onNotToday={close} />
      ) : (
        <View style={{ padding: space.screen }}>
          <Waiting error={error} onRetry={reload} blocks={[34, 200]} />
        </View>
      )}
    </View>
  );
}
