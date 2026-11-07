import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { Me } from '../shared/api';
import { BANDS, TIMES, TRACK_TYPES, TYPES, timeLabel } from '../shared/catalog';
import { shortDate } from '../shared/copy';
import type { TrackType } from '../shared/catalog';
import { api, setSession, useLoad } from '../src/api';
import { Chips, PinPad, TextField, Wheel } from '../src/inputs';
import { scheduleReminders } from '../src/notifications';
import { colors, space } from '../src/theme';
import { Button, Card, ErrorText, Header, Page, Sheet, T, TextLink, Waiting } from '../src/ui';

type Patch = Partial<Pick<Me, 'name' | 'workoutTime' | 'trackedTypes' | 'notifications' | 'band'>>;

function formatPhone(digits: string): string {
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

export default function Settings() {
  const { data, setData, error: loadError, reload } = useLoad<Me>('/me');
  const [name, setName] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (patch: Patch) => {
    setError(null);
    try {
      const next = await api<Me>('/me', { method: 'PATCH', body: patch });
      setData(next);
      if (patch.workoutTime || patch.notifications !== undefined) {
        scheduleReminders({ enabled: next.notifications, time: next.workoutTime, friendName: null, ask: patch.notifications === true });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const resetName = async () => {
    setError(null);
    try {
      setData(await api<Me>('/me/name/reset', { body: {} }));
      setName(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openPhoneSheet = () => {
    setPhoneDraft(data?.phone ?? '');
    setPinDraft('');
    setPhoneError(null);
    setPhoneSheet(true);
  };

  const savePhonePin = async () => {
    const digits = phoneDraft.replace(/\D/g, '');
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const next = await api<Me>('/me', { method: 'PATCH', body: { phone: digits, pin: pinDraft } });
      setData(next);
      setPhoneSheet(false);
    } catch (e) {
      setPhoneError((e as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  };

  if (!data) {
    return (
      <Page header={<Header />}>
        <Waiting error={loadError} onRetry={reload} blocks={[40, 90, 90, 90]} />
      </Page>
    );
  }

  return (
    <>
      <Page header={<Header />}>
        <T variant="display">Settings</T>
        <ErrorText>{error}</ErrorText>

        <Card style={{ gap: space.gap }}>
          <T variant="label">Name</T>
          <TextField
            value={name ?? data.name}
            onChangeText={setName}
            maxLength={30}
            editable={!data.nameChange}
            onBlur={() => name?.trim() && name.trim() !== data.name && save({ name })}
            onSubmitEditing={() => name?.trim() && name.trim() !== data.name && save({ name })}
            style={{ backgroundColor: colors.paper, opacity: data.nameChange ? 0.6 : 1 }}
          />
          {data.nameChange ? (
            <>
              <T variant="small">
                {data.nameChange.by} picked your last name after {data.nameChange.challengeName}. It goes back on its own
                on {shortDate(data.nameChange.until)}.
              </T>
              <TextLink title="Change it back now" onPress={resetName} />
            </>
          ) : null}
        </Card>

        <Card style={{ gap: space.gap }}>
          <T variant="label">Workout reminder</T>
          <Wheel
            label="Workout reminder time"
            values={TIMES}
            value={data.workoutTime}
            format={timeLabel}
            itemWidth={156}
            onChange={(v) => {
              setData({ ...data, workoutTime: v });
              if (timeTimer.current) clearTimeout(timeTimer.current);
              timeTimer.current = setTimeout(() => save({ workoutTime: v }), 600);
            }}
          />
        </Card>

        <Card style={{ gap: space.gap }}>
          <T variant="label">What you track</T>
          <Chips
            wrap
            multi
            max={3}
            options={TRACK_TYPES.map((t) => ({ key: t, label: TYPES[t].label }))}
            value={data.trackedTypes}
            onChange={(v: TrackType[]) => {
              if (!v.length) return;
              setData({ ...data, trackedTypes: v });
              save({ trackedTypes: v });
            }}
          />
          <T variant="small">Pick up to three.</T>
        </Card>

        <Card style={{ gap: space.gap }}>
          <T variant="label">How active are you</T>
          <Chips
            wrap
            options={BANDS.map((b) => ({ key: b.key, label: b.label }))}
            value={data.band}
            onChange={(v) => {
              setData({ ...data, band: v });
              save({ band: v });
            }}
          />
          <T variant="small">Sets your own step and mile goals in fair play challenges.</T>
        </Card>

        <Card style={{ gap: space.gap }}>
          <T variant="label">Notifications</T>
          <Chips
            options={[{ key: 'on', label: 'On' }, { key: 'off', label: 'Off' }]}
            value={data.notifications ? 'on' : 'off'}
            onChange={(v) => save({ notifications: v === 'on' })}
          />
        </Card>

        <Card style={{ gap: space.gap }}>
          <T variant="label">Sign-in phone</T>
          {data.hasPin ? (
            <>
              <T>{formatPhone(data.phone ?? '')}</T>
              <Button variant="outline" title="Change PIN" style={{ alignSelf: 'flex-start' }} onPress={openPhoneSheet} />
            </>
          ) : (
            <>
              <T color={colors.stone}>Add a phone number and PIN so you can sign in on a new phone.</T>
              <Button variant="outline" title="Add a PIN" style={{ alignSelf: 'flex-start' }} onPress={openPhoneSheet} />
            </>
          )}
        </Card>

        <Button variant="outline" title="Log out" onPress={() => setConfirmLogout(true)} />
      </Page>

      <Sheet visible={phoneSheet} onClose={() => setPhoneSheet(false)} title="Sign-in phone and PIN">
        <TextField
          placeholder="(555) 010-2030"
          value={phoneDraft}
          onChangeText={setPhoneDraft}
          keyboardType="phone-pad"
          maxLength={20}
        />
        <View style={{ alignItems: 'center', marginTop: space.gap }}>
          <PinPad value={pinDraft} onChange={setPinDraft} />
        </View>
        <ErrorText>{phoneError}</ErrorText>
        <Button
          title="Save"
          busy={phoneBusy}
          disabled={phoneDraft.replace(/\D/g, '').length !== 10 || pinDraft.length !== 4}
          onPress={savePhonePin}
        />
      </Sheet>

      <Sheet visible={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <T>
          {data.hasPin
            ? 'You can sign back in with your phone and PIN, or Face ID on this phone.'
            : "You haven't added a phone and PIN, so logging out means starting over unless this phone still remembers you."}
        </T>
        <View style={{ gap: space.gap }}>
          <Button
            title="Log out"
            onPress={async () => {
              await scheduleReminders({ enabled: false, time: data.workoutTime, friendName: null });
              await setSession(null);
            }}
          />
          {!data.hasPin ? (
            <TextLink
              title="Add a PIN first"
              onPress={() => {
                setConfirmLogout(false);
                openPhoneSheet();
              }}
            />
          ) : null}
          <Button variant="outline" title="Stay logged in" onPress={() => setConfirmLogout(false)} />
        </View>
      </Sheet>
    </>
  );
}
