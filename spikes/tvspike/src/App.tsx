// Day-1 risk checks on the Vega Virtual Device:
//   S1 WebSocket: connect, receive 1 tick/s, echo round-trip
//   S2 QR code:   react-native-qrcode-svg renders a scannable code
//   S5 Sound:     w3cmedia AudioPlayer plays a short whistle
// Every result is also sent to the test server over the socket, so it shows up in the server log.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import QRCode from '@amazon-devices/react-native-qrcode-svg';
import {
  AudioPlayer,
  AudioContentType,
  AudioUsageType,
  MediaSource,
} from '@amazon-devices/react-native-w3cmedia';

// The Mac's LAN address, then QEMU's usual alias for the host.
const HOSTS = ['10.77.160.212:8787', '10.0.2.2:8787'];

type Status = {host?: string; state: string; ticks: number; rttMs?: number; err?: string};

export const App = () => {
  const [ws, setWs] = useState<Status>({state: 'connecting', ticks: 0});
  const [http, setHttp] = useState('pending');
  const [sound, setSound] = useState('not tried');
  const sockRef = useRef<WebSocket | null>(null);
  const hostRef = useRef<string | undefined>(undefined);

  const report = useCallback((what: string, detail: unknown) => {
    try {
      sockRef.current?.send(JSON.stringify({type: 'report', what, detail}));
    } catch {}
  }, []);

  // S1: try each host until one socket opens
  useEffect(() => {
    let cancelled = false;
    const tryHost = (i: number) => {
      if (cancelled || i >= HOSTS.length) {
        if (!cancelled) setWs(s => ({...s, state: 'FAILED on all hosts'}));
        return;
      }
      const host = HOSTS[i];
      const s = new WebSocket(`ws://${host}/ws`);
      let opened = false;
      const giveUp = setTimeout(() => {
        if (!opened) {
          s.close();
          tryHost(i + 1);
        }
      }, 4000);
      s.onopen = () => {
        opened = true;
        clearTimeout(giveUp);
        sockRef.current = s;
        hostRef.current = host;
        setWs({host, state: 'open', ticks: 0});
        s.send(JSON.stringify({type: 'ping', t: Date.now()}));
      };
      s.onmessage = e => {
        const m = JSON.parse(String(e.data));
        if (m.type === 'tick') setWs(st => ({...st, ticks: m.seq}));
        if (m.type === 'echo') {
          const sent = JSON.parse(m.data);
          if (sent.type === 'ping') {
            const rtt = Date.now() - sent.t;
            setWs(st => ({...st, rttMs: rtt}));
            report('S1 echo rtt ms', rtt);
          }
        }
      };
      s.onerror = (e: any) => setWs(st => ({...st, err: String(e?.message ?? 'error')}));
      s.onclose = e => {
        if (opened) setWs(st => ({...st, state: `closed ${e.code}`}));
      };
    };
    tryHost(0);
    return () => {
      cancelled = true;
      sockRef.current?.close();
    };
  }, [report]);

  // plain fetch, to compare with the socket
  useEffect(() => {
    if (!ws.host) return;
    fetch(`http://${ws.host}/healthz`)
      .then(r => r.json())
      .then(j => {
        setHttp(`ok, serverNow ${j.serverNow}`);
        report('fetch healthz', 'ok');
      })
      .catch(e => {
        setHttp(`FAILED ${e}`);
        report('fetch healthz', String(e));
      });
  }, [ws.host, report]);

  // report tick progress every 30 s so the log shows the connection holding
  useEffect(() => {
    if (ws.ticks > 0 && ws.ticks % 30 === 0) report('S1 ticks received', ws.ticks);
  }, [ws.ticks, report]);

  // S5: play the whistle. mode "url" = player fetches the file itself;
  // mode "mse" = we fetch the bytes and append them through a MediaSource.
  const busy = useRef(false);
  const play = async (ext: 'mp3' | 'm4a' | 'wav', mode: 'url' | 'mse') => {
    if (!hostRef.current) return setSound('no host yet');
    if (busy.current) return;
    busy.current = true;
    const tag = `${ext}/${mode}`;
    const step = (msg: string, detail?: unknown) => {
      setSound(`${tag}: ${msg}`);
      report(`S5 ${tag} ${msg}`, detail ?? null);
    };
    let p: AudioPlayer | undefined;
    const done = async () => {
      busy.current = false;
      try {
        await p?.deinitialize();
      } catch {}
    };
    const watchdog = setTimeout(() => {
      step('TIMEOUT (no ended/error in 8 s)');
      done();
    }, 8000);
    try {
      const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4; codecs="mp4a.40.2"' : 'audio/wav';
      step('isTypeSupported', MediaSource.isTypeSupported(mime));
      p = new AudioPlayer(AudioContentType.CONTENT_TYPE_SONIFICATION, AudioUsageType.USAGE_MEDIA);
      await p.initialize();
      step('initialized', p.canPlayType(mime));
      p.addEventListener('playing', () => step('playing'));
      p.addEventListener('ended', () => {
        clearTimeout(watchdog);
        step('ended OK');
        done();
      });
      p.addEventListener('error', () => {
        clearTimeout(watchdog);
        step('error', {code: p?.error?.code, message: (p?.error as any)?.message});
        done();
      });
      const url = `http://${hostRef.current}/whistle.${ext}`;
      if (mode === 'url') {
        p.src = url;
      } else {
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        step('fetched bytes', bytes.length);
        const ms = new MediaSource();
        ms.addEventListener('sourceopen', () => {
          try {
            const sb = ms.addSourceBuffer(mime);
            sb.addEventListener('updateend', () => {
              try {
                ms.endOfStream();
              } catch {}
            });
            sb.appendBuffer(bytes);
            step('appended');
          } catch (e) {
            step('mse threw', String(e));
          }
        });
        (p as any).srcObject = ms;
      }
      await p.play();
      step('play() resolved');
    } catch (e) {
      clearTimeout(watchdog);
      step('threw', String(e));
      done();
    }
  };

  const qrValue = `http://${HOSTS[0]}/healthz?from=qr`;

  return (
    <View style={styles.root}>
      <View style={styles.col}>
        <Text style={styles.h1}>CouchConsensus · day-1 checks</Text>
        <Text style={styles.h2}>S1 WebSocket</Text>
        <Text style={styles.body}>host: {ws.host ?? '…'}</Text>
        <Text style={styles.body}>state: {ws.state}</Text>
        <Text style={styles.body}>ticks: {ws.ticks}</Text>
        <Text style={styles.body}>echo rtt: {ws.rttMs ?? '…'} ms</Text>
        {ws.err ? <Text style={styles.err}>error: {ws.err}</Text> : null}
        <Text style={styles.body}>fetch: {http}</Text>

        <Text style={styles.h2}>S5 Sound</Text>
        <View style={styles.row}>
          {([['mp3', 'url'], ['mp3', 'mse'], ['m4a', 'url'], ['m4a', 'mse'], ['wav', 'url']] as const).map(([ext, mode], i) => (
            <Pressable
              key={ext + mode}
              hasTVPreferredFocus={i === 0}
              onPress={() => play(ext, mode)}
              style={({focused}: any) => [styles.btn, focused && styles.btnFocused]}>
              <Text style={styles.btnText}>{ext} {mode}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.body}>{sound}</Text>
      </View>

      <View style={styles.qrCol}>
        <Text style={styles.h2}>S2 QR code</Text>
        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={360} ecl="M" quietZone={16} />
        </View>
        <Text style={styles.small}>{qrValue}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, flexDirection: 'row', backgroundColor: '#101418', padding: 64},
  col: {flex: 3},
  qrCol: {flex: 2, alignItems: 'center'},
  h1: {color: '#fff', fontSize: 44, fontWeight: '700', marginBottom: 24},
  h2: {color: '#9fd3ff', fontSize: 32, fontWeight: '600', marginTop: 24, marginBottom: 8},
  body: {color: '#fff', fontSize: 28, lineHeight: 40},
  err: {color: '#ff8a80', fontSize: 28},
  small: {color: '#bbb', fontSize: 20, marginTop: 12},
  row: {flexDirection: 'row', marginVertical: 12},
  btn: {paddingVertical: 14, paddingHorizontal: 18, marginRight: 12, borderRadius: 12, backgroundColor: '#2a3340', borderWidth: 4, borderColor: 'transparent'},
  btnFocused: {borderColor: '#ffd54f', backgroundColor: '#3a4656'},
  btnText: {color: '#fff', fontSize: 24},
  qrBox: {backgroundColor: '#fff', padding: 8, borderRadius: 8},
});
