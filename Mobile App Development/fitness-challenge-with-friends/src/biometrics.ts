// Apple's LocalAuthentication framework (Face ID / Touch ID), via expo-local-authentication.
// This gates the *local* re-entry to a session this device already holds — it never talks to
// the server. The phone and PIN (server/logic.ts) are the actual portable credential, for a
// device that doesn't already remember you.
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** The specific kind enrolled, so the button can say "Unlock with Face ID" vs "Unlock with Touch ID". */
export async function biometricsLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
    return 'Face ID';
  } catch {
    return 'Face ID';
  }
}

export async function unlockWithBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Use PIN instead' });
    return result.success;
  } catch {
    return false;
  }
}
