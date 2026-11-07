import { useLocalSearchParams } from 'expo-router';
import type { ChallengeDetail } from '../../shared/api';
import { useLoad } from '../../src/api';
import { ChallengeView } from '../../src/components/ChallengeView';
import { Header, Page, Waiting } from '../../src/ui';

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<ChallengeDetail>(`/challenges/${id}`);

  if (!data) {
    return (
      <Page header={<Header />}>
        <Waiting error={error} onRetry={reload} blocks={[40, 76, 110, 160]} />
      </Page>
    );
  }
  return <ChallengeView detail={data} onChange={setData} />;
}
