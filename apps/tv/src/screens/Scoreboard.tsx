// Scoreboard (TV-4, TV-5), built to Figma "TV / Scoreboard" and "TV / Scoreboard · sudden death":
// countdown, referee-stripe time bar, one progress row per voter. Counts only, never votes (I8).
// OK calls the round early (TV-6): the only focusable thing on screen is the "Press OK" hint.
import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {SUDDEN_DEATH_CARDS, type TvView} from '@couch/protocol';
import {color, voterColor} from '@couch/theme';
import type {HostClient} from '../useHost';
import {formatClock, useSecondsLeft} from '../useHost';
import {progressLabel} from '../tv-screen';
import type {Send} from '../App';
import {Header, at, k, sheet, t} from '../ui';

/** Figma rows: 104 tall, 12 apart, from y 504; more voters share the same 472 px. */
const ROWS_TOP = 504;
const ROWS_SPACE = 472;
const ROW_GAP = 12;

export function Scoreboard({client, view, send}: {client: HostClient; view: TvView; send: Send}) {
  const round = view.round!;
  const seconds = useSecondsLeft(round.timer.endsAt, client.clockOffset);
  const left = Math.min(1, (seconds * 1000) / round.timer.durationMs);
  const sudden = round.kind === 'suddenDeath';
  const n = Math.max(1, view.voters.length);
  const rowH = Math.min(104, (ROWS_SPACE - ROW_GAP * (n - 1)) / n);
  const tight = rowH / 104; // names and counts shrink with the row when more than four people play

  return (
    <View style={t.screen}>
      <Header />
      <Text style={[s.clock, at(112, 170)]} accessibilityLabel={`${seconds} seconds left`}>
        {formatClock(seconds)}
      </Text>
      {sudden ? (
        <>
          <Text style={[t.large, s.sudden, at(560, 250)]}>Sudden death</Text>
          <Text style={[t.hint, at(560, 316)]}>
            {`No title got a yes, so here are ${SUDDEN_DEATH_CARDS} new cards. No vetoes, most points wins.`}
          </Text>
        </>
      ) : (
        <Text style={[t.large, s.leftToVote, at(560, 300)]}>left to vote</Text>
      )}

      <Stripe fraction={left} />

      {view.voters.map((v, i) => {
        const tint = voterColor(i);
        const frac = v.progress.total ? v.progress.done / v.progress.total : 0;
        return (
          <View key={v.id} style={[s.row, at(120, ROWS_TOP + i * (rowH + ROW_GAP)), {height: rowH * k}, !v.connected && s.away]}>
            <View style={[s.dot, {backgroundColor: tint, transform: [{scale: Math.max(0.6, tight)}]}]} />
            <Text style={[s.name, {fontSize: 48 * k * Math.max(0.6, tight), lineHeight: 58 * k * Math.max(0.6, tight)}]} numberOfLines={1}>
              {v.nickname}
            </Text>
            <View style={s.track}>
              <View style={[s.fill, {width: `${frac * 100}%`, backgroundColor: tint}]} />
            </View>
            <Text style={[s.count, v.finished && {color: tint}, {fontSize: 36 * k * Math.max(0.7, tight)}]}>{progressLabel(v)}</Text>
          </View>
        );
      })}

      <Pressable hasTVPreferredFocus onPress={() => send({type: 'endRound'})} style={[s.okRow, at(120, 988)]} accessibilityRole="button" accessibilityLabel="Call it now">
        <View style={s.okKey}>
          <Text style={s.okText}>OK</Text>
        </View>
        <Text style={s.callIt}>Press OK to call it now</Text>
      </Pressable>
      <Text style={[t.hint, s.secret]}>Votes stay secret. The TV only shows progress.</Text>
    </View>
  );
}

const BAR = 1680;
const STRIPE = 34;
const PERIOD = 115;
const FIRST = 80;

/** Timer bar (referee stripes): orange time left with Night stripes, shrinking to the left. */
const Stripe = ({fraction}: {fraction: number}) => (
  <View style={[s.bar, at(120, 440)]}>
    <View style={[s.remaining, {width: `${fraction * 100}%`}]}>
      {Array.from({length: Math.ceil((BAR - FIRST) / PERIOD)}, (_, i) => (
        <View key={i} style={[s.stripe, {left: (FIRST + i * PERIOD) * k}]} />
      ))}
    </View>
  </View>
);

const s = sheet({
  clock: {color: color.glow, fontSize: 200, fontWeight: '800', lineHeight: 240, fontVariant: ['tabular-nums']},
  leftToVote: {color: color.mist},
  sudden: {color: color.ember},
  bar: {width: BAR, height: 28, borderRadius: 14, backgroundColor: color.couch, overflow: 'hidden'},
  remaining: {height: 28, borderRadius: 14, backgroundColor: color.fireOrange, overflow: 'hidden'},
  stripe: {position: 'absolute', top: 0, width: STRIPE, height: 28, backgroundColor: color.night},
  row: {width: 1680, borderRadius: 20, backgroundColor: color.couch, flexDirection: 'row', alignItems: 'center'},
  away: {opacity: 0.55},
  dot: {width: 40, height: 40, borderRadius: 20, marginLeft: 36},
  name: {color: color.glow, fontSize: 48, lineHeight: 58, fontFamily: 'display', fontWeight: '700', width: 300, marginLeft: 24},
  track: {width: 1000, height: 24, borderRadius: 12, backgroundColor: color.cushion, overflow: 'hidden'},
  fill: {height: 24, borderRadius: 12},
  count: {color: color.mist, fontSize: 36, fontWeight: '700', marginLeft: 40, flex: 1},
  okRow: {flexDirection: 'row', alignItems: 'center', gap: 20},
  okKey: {width: 60, height: 60, borderRadius: 30, backgroundColor: color.cushion, alignItems: 'center', justifyContent: 'center'},
  okText: {color: color.glow, fontSize: 22, fontWeight: '700', lineHeight: 26},
  callIt: {color: color.glow, fontSize: 30, fontWeight: '600', lineHeight: 36},
  secret: {position: 'absolute', right: 120, top: 1000},
});
