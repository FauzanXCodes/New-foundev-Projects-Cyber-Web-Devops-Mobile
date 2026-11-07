import * as Contacts from 'expo-contacts/legacy';
import * as SMS from 'expo-sms';
import { Platform, Share } from 'react-native';

export type Sent = 'sent' | 'copied' | 'cancelled';

const onWeb = Platform.OS === 'web';

/** Opens Messages with the text filled in. Falls back to the share sheet, or the clipboard on a computer. */
export async function sendText(body: string, phone?: string): Promise<Sent> {
  if (onWeb) {
    const phoneBrowser = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (phoneBrowser && navigator.share) {
      return navigator.share({ text: body }).then(() => 'sent' as const, () => 'cancelled' as const);
    }
    return navigator.clipboard.writeText(body).then(() => 'copied' as const, () => 'cancelled' as const);
  }
  if (await SMS.isAvailableAsync()) {
    const { result } = await SMS.sendSMSAsync(phone ? [phone] : [], body);
    return result === 'cancelled' ? 'cancelled' : 'sent';
  }
  const shared = await Share.share({ message: body });
  return shared.action === Share.dismissedAction ? 'cancelled' : 'sent';
}

/** The system share sheet: AirDrop, WhatsApp, Notes, copy. For when Messages is not how this friend is reached. */
export async function shareSheet(body: string): Promise<Sent> {
  if (onWeb) return sendText(body);
  const shared = await Share.share({ message: body });
  return shared.action === Share.dismissedAction ? 'cancelled' : 'sent';
}

export const canPickContacts = !onWeb;

/** Opens the phone's contact picker, then texts the first number on the contact that was picked. */
export async function textContact(body: string): Promise<Sent> {
  const contact = await Contacts.presentContactPickerAsync().catch(() => null);
  const phone = contact?.phoneNumbers?.[0]?.number;
  return phone ? sendText(body, phone) : 'cancelled';
}
