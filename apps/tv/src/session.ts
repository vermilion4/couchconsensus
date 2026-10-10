// The TV remembers its open room so a relaunch can offer "Resume room" (US-12).
// The host token is the only secret on the TV; it lives in app-private storage, never on screen.
import {uuid} from '@couch/client';

type Store = {getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void>};

/**
 * Vega's async-storage port is not in every OS profile. If its native module is missing, keep the session
 * in memory: Resume then only survives a remount, not a relaunch, but the TV still works.
 */
const AsyncStorage: Store = (() => {
  try {
    const mod = require('@amazon-devices/react-native-async-storage__async-storage');
    const store = (mod.default ?? mod) as Store;
    if (typeof store?.getItem === 'function') return store;
  } catch {
    // fall through
  }
  const mem = new Map<string, string>();
  return {
    getItem: async k => mem.get(k) ?? null,
    setItem: async (k, v) => void mem.set(k, v),
    removeItem: async k => void mem.delete(k),
  };
})();

export type HostSession = {roomCode: string; joinUrl: string; hostToken: string};

const SESSION_KEY = 'couch.hostSession.v1';
const INSTALL_KEY = 'couch.installId.v1';

export async function loadSession(): Promise<HostSession | undefined> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as Partial<HostSession>) : undefined;
    return s?.roomCode && s.joinUrl && s.hostToken ? (s as HostSession) : undefined;
  } catch {
    return undefined;
  }
}

export const saveSession = (s: HostSession) => AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s)).catch(() => undefined);
export const clearSession = () => AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);

/** Stable per install; the server uses it to rate-limit room creation (DATA_MODEL §4). */
export async function installId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(INSTALL_KEY);
    if (saved) return saved;
    const id = `tv-${uuid()}`;
    await AsyncStorage.setItem(INSTALL_KEY, id);
    return id;
  } catch {
    return `tv-${uuid()}`;
  }
}
