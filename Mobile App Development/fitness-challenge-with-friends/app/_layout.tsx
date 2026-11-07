import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, useFonts } from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { restoreSession, useSession } from '../src/api';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold });
  const { ready, token } = useSession();

  useEffect(() => {
    restoreSession();
  }, []);

  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  const signedIn = !!token;
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          // Native UINavigationController push: interruptible, and the swipe back works from
          // anywhere on the screen instead of only the left edge.
          animation: 'default',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="challenge/[id]" />
          <Stack.Screen name="join" />
          <Stack.Screen name="settings" />
          {/* A real iOS modal card: drag it down to dismiss, let go early and it springs back. */}
          <Stack.Screen name="create" options={{ presentation: 'modal', gestureEnabled: true, contentStyle: { backgroundColor: colors.paperRaised } }} />
          <Stack.Screen name="log/[id]" options={{ presentation: 'modal', gestureEnabled: true, contentStyle: { backgroundColor: colors.paperRaised } }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="signup" />
          <Stack.Screen name="signin" />
        </Stack.Protected>
        <Stack.Screen name="invite/[token]" />
      </Stack>
    </SafeAreaProvider>
  );
}
