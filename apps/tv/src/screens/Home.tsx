// Home (TV-1) and Resume room (US-12).
import React from 'react';
import {Text, View} from 'react-native';
import {color} from '@couch/theme';
import type {TvView} from '@couch/protocol';
import {Button, Header, Heads, t, sheet} from '../ui';

const CROWD = ['', '', '', ''];

export function Home({onStart, busy, note}: {onStart: () => void; busy: boolean; note?: string}) {
  return (
    <View style={t.screen}>
      <Text style={s.brand}>CouchConsensus</Text>
      <View style={s.body}>
        <Text style={t.display}>{"Can't agree\non a movie?"}</Text>
        <Text style={[t.muted, s.lede]}>{'Everyone votes on their own phone.\nThe referee picks one in under three minutes.'}</Text>
        <Button label={busy ? 'Starting…' : 'Start a room'} primary preferred disabled={busy} onPress={onStart} style={s.cta} />
        <Text style={[t.muted, s.hint]}>{note ?? 'Press OK to start'}</Text>
      </View>
      <Heads names={CROWD} openSeat={false} />
    </View>
  );
}

export function Resume({view, onResume, onNew}: {view: TvView; onResume: () => void; onNew: () => void}) {
  const n = view.voters.length;
  const people = n === 1 ? '1 person' : `${n} people`;
  return (
    <View style={t.screen}>
      <Header />
      <View style={s.body}>
        <Text style={t.display}>Welcome back.</Text>
        <Text style={[t.muted, s.lede]}>
          {`Room ${view.roomCode} is still open with ${people} in it.\nTheir votes so far are saved.`}
        </Text>
        <View style={t.row}>
          <Button label="Resume room" primary preferred onPress={onResume} />
          <Button label="Start a new room" onPress={onNew} />
        </View>
      </View>
      <Heads names={view.voters.map(v => v.nickname)} />
    </View>
  );
}

/** Shown for the moment it takes to reach a saved room. */
export const Splash = () => (
  <View style={t.screen}>
    <Header />
  </View>
);

const s = sheet({
  brand: {color: color.glow, fontSize: 36, fontWeight: '800'},
  body: {flex: 1, justifyContent: 'center', maxWidth: 1100},
  lede: {marginTop: 36, marginBottom: 56},
  cta: {alignSelf: 'flex-start'},
  hint: {marginTop: 20, fontSize: 24},
});
