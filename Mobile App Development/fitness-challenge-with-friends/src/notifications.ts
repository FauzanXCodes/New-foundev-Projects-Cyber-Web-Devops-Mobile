import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { reminderLines } from '../shared/copy';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

type Options = { enabled: boolean; time: string; friendName: string | null; ask?: boolean };

/** One reminder a day at the workout time, scheduled two weeks ahead so the copy can rotate. */
export async function scheduleReminders({ enabled, time, friendName, ask }: Options): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;
    const lines = reminderLines(friendName);
    const [hour, minute] = time.split(':').map(Number);
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
      if (at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { body: lines[Math.floor(at.getTime() / 86400000) % lines.length] },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch {
    // Reminders are a nice extra. Never block the app on them.
  }
}
