// Scoreboard (TV-4, TV-5): countdown, referee-stripe time bar, one progress row per voter.
// Counts only: the TV never learns how anyone voted (I8). OK calls the round early (TV-6).
import React from 'react';
import {Text, View} from 'react-native';
import {SUDDEN_DEATH_CARDS, type TvView} from '@couch/protocol';
import {color, voterColor} from '@couch/theme';
import type {HostClient} from '../useHost';
import {formatClock, useSecondsLeft} from '../useHost';
import {progressLabel} from '../tv-screen';
import type {Send} from '../App';
import {Button, Header, t, sheet} from '../ui';

export function Scoreboard({client, view, send}: {client: HostClient; view: TvView; send: Send}) {
  const round = view.round!;
  const seconds = useSecondsLeft(round.timer.endsAt, client.clockOffset);
  const left = Math.min(1, (seconds * 1000) / round.timer.durationMs);
  const sudden = round.kind === 'suddenDeath';

  return (
    <View style={t.screen}>
      <Header />
      <View style={s.clockRow}>
        <Text style={s.clock} accessibilityLabel={`${seconds} seconds left`}>
          {formatClock(seconds)}
        </Text>
        {sudden ? (
          <View style={s.clockNote}>
            <Text style={[t.eyebrow, s.sudden]}>Sudden death</Text>
            <Text style={t.muted}>
              {`No title got a yes, so here are ${SUDDEN_DEATH_CARDS} new cards. No vetoes, most points wins.`}
            </Text>
          </View>
        ) : (
          <Text style={[t.muted, s.clockNote]}>left to vote</Text>
        )}
      </View>

      <Stripe fraction={left} />

      <View style={s.rows}>
        {view.voters.map((v, i) => {
          const tint = voterColor(i);
          const frac = v.progress.total ? v.progress.done / v.progress.total : 0;
          return (
            <View key={v.id} style={[s.row, !v.connected && s.away]}>
              <View style={[s.dot, {backgroundColor: tint}]} />
              <Text style={s.name} numberOfLines={1}>
                {v.nickname}
              </Text>
              <View style={s.track}>
                <View style={[s.fill, {width: `${frac * 100}%`, backgroundColor: tint}]} />
              </View>
              <Text style={[s.count, v.finished && {color: tint}]}>{progressLabel(v)}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.footer}>
        <Button small preferred label="Call it now" onPress={() => send({type: 'endRound'})} />
        <Text style={s.secret}>Votes stay secret. The TV only shows progress.</Text>
      </View>
    </View>
  );
}

const DASH = 64;
const GAP = 40;
const TRACK = 1728;

/** Time left as a referee's stripe: orange dashes on the cushion track, shrinking to the left. */
const Stripe = ({fraction}: {fraction: number}) => (
  <View style={s.stripe}>
    <View style={[s.stripeFill, {width: `${fraction * 100}%`}]}>
      {Array.from({length: Math.ceil(TRACK / (DASH + GAP))}, (_, i) => (
        <View key={i} style={s.dash} />
      ))}
    </View>
  </View>
);

const s = sheet({
  clockRow: {flexDirection: 'row', alignItems: 'center', gap: 48},
  clock: {color: color.glow, fontSize: 200, fontWeight: '800', lineHeight: 210, fontVariant: ['tabular-nums'], minWidth: 420},
  clockNote: {flexShrink: 1, marginTop: 24},
  sudden: {marginBottom: 8},
  stripe: {height: 22, borderRadius: 11, backgroundColor: color.couch, overflow: 'hidden', marginTop: 28, marginBottom: 36},
  stripeFill: {height: '100%', flexDirection: 'row', overflow: 'hidden', gap: GAP},
  dash: {width: DASH, height: '100%', borderRadius: 4, backgroundColor: color.fireOrange},
  rows: {flex: 1, gap: 18},
  row: {flexDirection: 'row', alignItems: 'center', backgroundColor: color.couch, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 32},
  away: {opacity: 0.55},
  dot: {width: 30, height: 30, borderRadius: 15, marginRight: 24},
  name: {color: color.glow, fontSize: 38, fontWeight: '700', width: 340},
  track: {flex: 1, height: 18, borderRadius: 9, backgroundColor: color.cushion, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 9},
  count: {color: color.mist, fontSize: 30, fontWeight: '700', width: 300, textAlign: 'right'},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24},
  secret: {color: color.mist, fontSize: 24},
});
