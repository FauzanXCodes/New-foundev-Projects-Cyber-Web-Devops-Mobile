import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localDate } from '../shared/catalog';
import { deleteSecret, getSecret, setSecret } from './secure';

const TOKEN_KEY = 'session-token';
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// In development the API runs next to the Expo dev server, on port 8787 of the same machine.
export function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (isWeb) return `${window.location.protocol}//${window.location.hostname}:8787`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:8787`;
}

export function inviteLink(token: string): string {
  const configured = process.env.EXPO_PUBLIC_INVITE_URL;
  if (configured) return `${configured.replace(/\/$/, '')}/invite/${token}`;
  if (isWeb) return `${window.location.origin}/invite/${token}`;
  return Linking.createURL(`/invite/${token}`);
}

// ---------- session ----------

type SessionState = { ready: boolean; token: string | null };
let session: SessionState = { ready: false, token: null };
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  session = next;
  listeners.forEach((l) => l());
}

export async function restoreSession() {
  const token = await getSecret(TOKEN_KEY).catch(() => null);
  emit({ ready: true, token });
}

export async function setSession(token: string | null) {
  // Cached screens belong to whoever was signed in; never let them show up for someone else.
  if (token !== session.token) await clearCache();
  if (token) await setSecret(TOKEN_KEY, token);
  else await deleteSecret(TOKEN_KEY);
  emit({ ready: true, token });
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => session,
  );
}

// ---------- the account this device remembers ----------
// Separate from the active session token: logging out clears `session-token` (so the API stops
// sending it) but keeps this, so the Welcome screen can still say "Welcome back, Dana" and offer
// Face ID instead of making a returning user re-enter their phone and PIN every time.

const LOCKED_KEY = 'locked-account';
export type LockedAccount = { token: string; name: string; avatar: number };

export async function rememberAccount(a: LockedAccount) {
  await setSecret(LOCKED_KEY, JSON.stringify(a)).catch(() => {});
}

export async function getRememberedAccount(): Promise<LockedAccount | null> {
  const raw = await getSecret(LOCKED_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LockedAccount;
  } catch {
    return null;
  }
}

/** "Not you?" — forgets this device ever had an account, back to the new-or-returning choice. */
export async function forgetAccount() {
  await deleteSecret(LOCKED_KEY);
}

// ---------- data freshness ----------

// Every write bumps this so mounted screens refetch. Focus alone is not enough: Home sits
// under the create modal and never loses focus, so it would keep showing stale challenges.
let version = 0;
const dataListeners = new Set<() => void>();

function dataChanged() {
  version++;
  dataListeners.forEach((l) => l());
}

function useDataVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      dataListeners.add(cb);
      return () => dataListeners.delete(cb);
    },
    () => version,
  );
}

// ---------- requests ----------

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// A request that has not answered in this long is not going to. Without a limit, iOS waits a full
// minute on a host that has changed address or a Wi-Fi that dropped, and the screen just sits there.
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function attempt(url: string, init: RequestInit): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch (e) {
    // What an aborted fetch rejects with differs by runtime, so ask our own controller instead.
    throw Object.assign(e instanceof Error ? e : new Error('Request failed'), { timedOut: abort.signal.aborted });
  } finally {
    clearTimeout(timer);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const url = `${apiBase()}/api${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Today': localDate(),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  };
  // Reads are safe to repeat, so one dropped connection (a reused socket the server had already
  // closed, a Wi-Fi blip) is retried quietly. Writes are never repeated: a second POST could log twice.
  const tries = method === 'GET' ? 2 : 1;
  let res: Response | null = null;
  let timedOut = false;
  for (let i = 0; i < tries && !res; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);
    try {
      res = await attempt(url, init);
    } catch (e) {
      timedOut = (e as { timedOut?: boolean }).timedOut === true;
    }
  }
  if (!res) {
    throw new ApiError(
      0,
      timedOut
        ? 'The server is taking too long to answer. Check your connection and try again.'
        : "Can't reach the server. Check your connection and try again.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) await setSession(null);
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Try again.');
  if (method !== 'GET') dataChanged();
  return data as T;
}

// ---------- last-known data, on disk ----------
// Each screen's last response is kept so a cold launch shows real content immediately and the app
// stays usable when the connection drops, then quietly refreshes. It is only trusted for the same
// calendar day it was saved: streaks, "logged today" and per-period progress all turn over at
// midnight, and a stale "You're in for today" flashing up would be worse than a blank moment.
// Check-in is never cached, because that screen is precisely a statement about today.

const CACHE_PREFIX = 'cache:';
const cacheable = (path: string) => !path.startsWith('/checkin');

async function readCache<T>(path: string): Promise<T | null> {
  if (!cacheable(path)) return null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    const hit = JSON.parse(raw) as { date: string; data: T };
    return hit.date === localDate() ? hit.data : null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown) {
  if (!cacheable(path)) return;
  AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ date: localDate(), data })).catch(() => {});
}

// The same responses, held in memory for the life of the app. A screen that mounts after one of these
// has landed starts with real content on its very first frame instead of a blank one.
const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Fetches a view once however many screens ask for it at the same moment, and remembers the answer. */
function fetchView<T>(path: string): Promise<T> {
  const key = `${session.token ?? ''}${path}`;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const request = api<T>(path)
    .then((fresh) => {
      if (cacheable(path)) {
        memory.set(path, fresh);
        writeCache(path, fresh);
      }
      return fresh;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** Warms the views behind the tabs so the first tap on one does not start from nothing. */
export function prefetch(paths: string[]) {
  for (const path of paths) fetchView(path).catch(() => {});
}

export async function clearCache() {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(CACHE_PREFIX)));
  } catch {
    // Nothing useful to do; a stale entry is bounded by the same-day rule anyway.
  }
}

/** Loads a view every time its screen comes into focus, keeping the last copy on screen meanwhile. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(() => (path ? ((memory.get(path) as T | undefined) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const reload = useCallback(async () => {
    if (!path) return;
    // Two loads can overlap (focus, then a write bumping the data version). Only the newest applies,
    // so a slow older answer can never land on top of a fresher one.
    const mine = ++latest.current;
    try {
      const fresh = await fetchView<T>(path);
      if (mine !== latest.current) return;
      setData(fresh);
      setError(null);
    } catch (e) {
      if (mine === latest.current) setError((e as Error).message);
    }
  }, [path]);
  // Show what we had last time straight away, unless the network has already beaten it here.
  useEffect(() => {
    if (!path) return;
    let alive = true;
    readCache<T>(path).then((hit) => {
      if (alive && hit) setData((current) => current ?? hit);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const version = useDataVersion();
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    // A write just happened, so an answer already in flight may predate it. Start over.
    inflight.delete(`${session.token ?? ''}${path}`);
    reload();
  }, [version, reload, path]);
  return { data, setData, error, reload };
}
