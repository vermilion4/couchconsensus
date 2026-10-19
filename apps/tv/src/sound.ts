// Sound effects (TV-8): the referee's whistle when the verdict lands, a coin ring for a dead heat.
// The Vega Virtual Device plays only AAC .m4a, and only fetched in JS and fed through a MediaSource
// (spike S5); a plain src URL fails. Sound is a nicety: any failure is swallowed, never shown.
import {AudioContentType, AudioPlayer, AudioUsageType, MediaSource} from '@amazon-devices/react-native-w3cmedia';
import {SERVER_URL} from './server-url';

export type Sound = 'whistle' | 'coin';

const MIME = 'audio/mp4; codecs="mp4a.40.2"';
/** Longer than either sound; a player that never reports ended or error is released anyway. */
const WATCHDOG_MS = 5_000;

const bytes = new Map<Sound, Promise<Uint8Array>>();

function load(name: Sound): Promise<Uint8Array> {
  let p = bytes.get(name);
  if (!p) {
    p = fetch(`${SERVER_URL}/sounds/${name}.m4a`)
      .then(res => {
        if (!res.ok) throw new Error(`sound ${name}: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buf => new Uint8Array(buf));
    p.catch(() => bytes.delete(name)); // retry on the next play
    bytes.set(name, p);
  }
  return p;
}

/** Fetch both sounds early (in the lobby) so the first play starts at once. */
export function preloadSounds(): void {
  for (const name of ['whistle', 'coin'] as const) load(name).catch(() => undefined);
}

export async function playSound(name: Sound): Promise<void> {
  let player: AudioPlayer | undefined;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(watchdog);
    player?.deinitialize().catch(() => undefined);
  };
  const watchdog = setTimeout(release, WATCHDOG_MS);
  try {
    const data = await load(name);
    player = new AudioPlayer(AudioContentType.CONTENT_TYPE_SONIFICATION, AudioUsageType.USAGE_MEDIA);
    await player.initialize();
    player.addEventListener('ended', release);
    player.addEventListener('error', release);
    const source = new MediaSource();
    source.addEventListener('sourceopen', () => {
      try {
        const buffer = source.addSourceBuffer(MIME);
        buffer.addEventListener('updateend', () => {
          try {
            source.endOfStream();
          } catch {
            // already ended
          }
        });
        buffer.appendBuffer(new Uint8Array(data)); // a copy: the cached bytes are reused on every play
      } catch {
        release();
      }
    });
    (player as unknown as {srcObject: MediaSource}).srcObject = source;
    await player.play();
  } catch {
    release();
  }
}
