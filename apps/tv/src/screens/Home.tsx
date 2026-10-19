// Home (TV-1) and Resume room (US-12), built to Figma "TV / Home" and "TV / Resume room".
import React from 'react';
import {Text, View} from 'react-native';
import {color, voterColor, voterColors} from '@couch/theme';
import type {TvView} from '@couch/protocol';
import {Button, Header, Heads, at, k, sheet, t, type Seat} from '../ui';

/** Figma's audience: teal, violet, lime, pink, at these exact head positions. */
const CROWD: Seat[] = [0, 1, 2, 4].map(i => ({label: '', fill: voterColors[i]!}));
const CROWD_XS = [1020, 1280, 1540, 1780];

export function Home({onStart, busy, note}: {onStart: () => void; busy: boolean; note?: string}) {
  return (
    <View style={t.screen}>
      <Header />
      <Text style={[t.displayXL, at(120, 240)]}>{"Can't agree\non a movie?"}</Text>
      <Text style={[t.lede, at(120, 610)]}>{'Everyone votes on their own phone.\nThe referee picks one in under three minutes.'}</Text>
      <View style={at(120, 760)}>
        <Button label={busy ? 'Starting…' : 'Start a room'} primary preferred disabled={busy} onPress={onStart} />
      </View>
      <Text style={[s.hint, at(120, 900)]}>{note ?? 'Press OK to start'}</Text>
      <Heads seats={CROWD} xs={CROWD_XS} />
    </View>
  );
}

export function Resume({view, onResume, onNew}: {view: TvView; onResume: () => void; onNew: () => void}) {
  const n = view.voters.length;
  const people = n === 1 ? '1 person' : `${n} people`;
  const shown = view.voters.slice(-4);
  const offset = view.voters.length - shown.length;
  return (
    <View style={t.screen}>
      <Header />
      <Text style={[t.displayXL, at(120, 300)]}>Welcome back.</Text>
      <Text style={[t.lede, at(120, 520)]}>{`Room ${view.roomCode} is still open with ${people} in it.\nTheir votes so far are saved.`}</Text>
      <View style={[t.row, at(120, 680), {gap: 24 * k, alignItems: 'flex-start'}]}>
        <Button label="Resume room" primary preferred onPress={onResume} />
        <Button label="Start a new room" onPress={onNew} />
      </View>
      <Heads seats={shown.map((v, i) => ({label: v.nickname, fill: voterColor(offset + i)}))} xs={CROWD_XS.slice(-shown.length)} />
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
  hint: {color: color.mist, fontSize: 28, fontWeight: '600', lineHeight: 34},
});
