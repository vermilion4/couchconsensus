// Verdict (TV-8, TV-9): the pick with its reason, then Done / Runner-up / Rematch.
// A dead heat plays the coin toss first: the coin flips for 1.5 s, the winner lifts, the others fade.
// Sound (TV-8): a coin ring with the toss, the referee's whistle as the verdict lands.
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, Text, View} from 'react-native';
import type {TitleCard, TvView} from '@couch/protocol';
import {color} from '@couch/theme';
import {playSound} from '../sound';
import {tossLede} from '../tv-screen';
import {posterSource} from '../useHost';
import type {Send} from '../App';
import {Button, Chip, Header, t, k, sheet} from '../ui';

type VerdictView = NonNullable<TvView['verdict']>;

export function Verdict({view, send, onDone}: {view: TvView; send: Send; onDone: () => void}) {
  const v = view.verdict!;
  // Toss once per verdict, and never for a runner-up (it is not a new decision).
  const tossKey = v.coinToss && !v.isRunnerUp ? `${view.roomCode}:${v.coinToss.winnerId}` : undefined;
  const [tossed, setTossed] = useState<string>();
  const tossing = !!tossKey && tossed !== tossKey;

  // Whistle once per new verdict, after any coin toss; stepping to a runner-up stays quiet.
  const whistled = useRef<string>(undefined);
  const verdictKey = `${view.roomCode}:${v.title.id}`;
  useEffect(() => {
    if (tossing || v.isRunnerUp || whistled.current === verdictKey) return;
    whistled.current = verdictKey;
    void playSound('whistle');
  }, [tossing, v.isRunnerUp, verdictKey]);

  if (tossing) return <CoinToss toss={v.coinToss!} onDone={() => setTossed(tossKey)} />;

  const title = v.title;
  const eyebrow = v.isRunnerUp ? 'The runner-up' : v.viaSuddenDeath ? 'Decided in sudden death' : "The referee's pick";
  return (
    <View style={t.screen}>
      <Header />
      <View style={s.columns}>
        <Image source={posterSource(title.posterUrl)} style={s.poster} accessibilityIgnoresInvertColors />
        <View style={s.info}>
          <Text style={t.eyebrow}>{eyebrow}</Text>
          <Text style={[t.h1, s.title]} numberOfLines={3}>
            {title.title}
          </Text>
          <View style={t.row}>
            <Chip label={`${title.runtimeMin} min`} />
            {title.genres.slice(0, 2).map(g => (
              <Chip key={g} label={g} />
            ))}
            {title.availability[0] ? <Chip label={`Watch on ${title.availability[0].serviceName}`} /> : null}
          </View>
          <Text style={[t.body, s.reason]}>“{v.reason}”</Text>
          <View style={t.row}>
            <Button label="Done" primary preferred onPress={onDone} />
            <Button label="Runner-up" disabled={!v.hasNextRunnerUp} onPress={() => send({type: 'runnerUp'})} />
            <Button label="Rematch" onPress={() => send({type: 'rematch'})} />
          </View>
        </View>
      </View>
    </View>
  );
}

function CoinToss({toss, onDone}: {toss: NonNullable<VerdictView['coinToss']>; onDone: () => void}) {
  const flip = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(false);
  // New views keep arriving during the toss; a fresh onDone must not restart the animation.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    void playSound('coin');
    const anim = Animated.sequence([
      Animated.timing(flip, {toValue: 6, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true}),
      Animated.timing(settle, {toValue: 1, duration: 600, useNativeDriver: true}),
      Animated.delay(900),
    ]);
    const landedAt = setTimeout(() => setLanded(true), 1500);
    anim.start(({finished}) => finished && done.current());
    return () => {
      clearTimeout(landedAt);
      anim.stop();
    };
  }, [flip, settle]);

  // 0..6 half-turns → the coin's width squeezes through zero six times, like a coin seen edge-on.
  const scaleX = flip.interpolate({inputRange: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6], outputRange: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]});
  const lift = settle.interpolate({inputRange: [0, 1], outputRange: [0, -28 * k]});
  const fade = settle.interpolate({inputRange: [0, 1], outputRange: [1, 0.3]});
  const style = (c: TitleCard) => (c.id === toss.winnerId ? {transform: [{translateY: lift}]} : {opacity: fade});
  const n = toss.candidates.length;

  const coin = (
    <View style={s.coinCol}>
      <Animated.View style={[s.coin, n > 2 && s.coinSmall, {transform: [{scaleX}]}]}>
        <Text style={[s.coinText, n > 2 && s.coinTextSmall]}>CC</Text>
      </Animated.View>
      <Text style={[t.eyebrow, s.flipping]}>{landed ? 'Called it.' : 'Flipping…'}</Text>
    </View>
  );
  const card = (c: TitleCard, width?: number) => (
    <Animated.View key={c.id} style={style(c)}>
      <TossCard card={c} width={width} />
    </Animated.View>
  );

  return (
    <View style={t.screen}>
      <Header />
      <Text style={t.h1}>Dead heat.</Text>
      <Text style={[t.muted, s.tossLede]}>{tossLede(n)}</Text>
      {n === 2 ? (
        // The Figma layout: the coin between the two cards.
        <View style={s.toss}>
          {card(toss.candidates[0]!)}
          {coin}
          {card(toss.candidates[1]!)}
        </View>
      ) : (
        // A wider tie (e.g. a sudden death where nobody said yes): every card in a row, coin above.
        <View style={s.wideToss}>
          {coin}
          <View style={s.wideRow}>{toss.candidates.map(c => card(c, (TOSS_ROW - TOSS_GAP * (n - 1)) / n))}</View>
        </View>
      )}
    </View>
  );
}

const TOSS_ROW = 1728;
const TOSS_GAP = 24;

const TossCard = ({card, width}: {card: TitleCard; width?: number}) => (
  <View style={[s.tossCard, width !== undefined && {width: width * k}]}>
    <Image source={posterSource(card.posterUrl)} style={[s.tossPoster, width !== undefined && {width: width * k, height: width * 0.65 * k}]} />
    <View style={s.tossBody}>
      <Text style={s.tossTitle} numberOfLines={2}>
        {card.title}
      </Text>
      <Text style={t.muted}>{`${card.runtimeMin} min`}</Text>
    </View>
  </View>
);

export const Thinking = () => (
  <View style={t.screen}>
    <Header />
    <View style={s.center}>
      <Text style={t.h1}>The referee is thinking…</Text>
    </View>
  </View>
);

export const Closed = ({onHome}: {onHome: () => void}) => (
  <View style={t.screen}>
    <Header />
    <View style={s.center}>
      <Text style={t.h1}>That's a wrap.</Text>
      <Text style={[t.muted, s.tossLede]}>Enjoy the movie.</Text>
      <Button label="Back to start" primary preferred onPress={onHome} style={s.self} />
    </View>
  </View>
);

const s = sheet({
  columns: {flex: 1, flexDirection: 'row', gap: 80, alignItems: 'center'},
  poster: {width: 520, height: 780, borderRadius: 28, backgroundColor: color.couch},
  info: {flex: 1},
  title: {marginTop: 12, marginBottom: 28},
  reason: {marginTop: 36, marginBottom: 48, maxWidth: 1000},
  tossLede: {marginTop: 12, marginBottom: 56},
  toss: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 48},
  tossCard: {width: 460, borderRadius: 24, overflow: 'hidden', backgroundColor: color.couch},
  tossPoster: {width: 460, height: 300},
  tossBody: {padding: 28, gap: 6},
  tossTitle: {color: color.glow, fontSize: 38, fontWeight: '800'},
  coinCol: {alignItems: 'center'},
  wideToss: {alignItems: 'center', gap: 28},
  wideRow: {flexDirection: 'row', gap: TOSS_GAP},
  coin: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: color.fireOrange,
    borderWidth: 14,
    borderColor: '#FFC23D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {color: color.night, fontSize: 120, fontWeight: '800'},
  // The wide tie needs the height for its row of cards.
  coinSmall: {width: 180, height: 180, borderRadius: 90, borderWidth: 10},
  coinTextSmall: {fontSize: 72},
  flipping: {marginTop: 28},
  center: {flex: 1, justifyContent: 'center'},
  self: {alignSelf: 'flex-start'},
});
