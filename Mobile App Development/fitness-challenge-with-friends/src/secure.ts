// Secrets live in the iOS Keychain (via expo-secure-store), not in AsyncStorage, which is a plain,
// unencrypted file. The session token is a bearer credential, so it gets Apple's storage for
// exactly that: encrypted at rest, and `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keeps it off iCloud
// Keychain sync and out of device backups that restore onto another phone.
//
// One consequence worth knowing: the Keychain survives deleting the app. Reinstalling brings the
// remembered account back, which is what makes "Welcome back" work after a reinstall.
//
// SecureStore has no web implementation, so the web build falls back to AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function setSecret(key: string, value: string): Promise<void> {
  if (!native) return AsyncStorage.setItem(key, value);
  await SecureStore.setItemAsync(key, value, options);
}

export async function getSecret(key: string): Promise<string | null> {
  if (!native) return AsyncStorage.getItem(key);
  const stored = await SecureStore.getItemAsync(key, options).catch(() => null);
  if (stored !== null) return stored;
  // One-time migration: builds before this kept these in AsyncStorage. Move the value across and
  // remove the unencrypted copy so a signed-in user is not signed out by the upgrade.
  const legacy = await AsyncStorage.getItem(key).catch(() => null);
  if (legacy !== null) {
    await SecureStore.setItemAsync(key, legacy, options).catch(() => {});
    await AsyncStorage.removeItem(key).catch(() => {});
  }
  return legacy;
}

export async function deleteSecret(key: string): Promise<void> {
  if (!native) return AsyncStorage.removeItem(key);
  await SecureStore.deleteItemAsync(key, options).catch(() => {});
  await AsyncStorage.removeItem(key).catch(() => {});
}
