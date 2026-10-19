// Verdict (TV-5, TV-6, TV-8), built to Figma "TV / Verdict" and "TV / Verdict · coin toss": the pick
// with its reason, then Done / Runner-up / Rematch. A dead heat plays the coin toss first: the coin
// flips for 1.5 s, the winner lifts, the others fade. Sound: a coin ring with the toss, the whistle as
// the verdict lands.
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, Text, View} from 'react-native';
import type {TitleCard, TvView} from '@couch/protocol';
import {color} from '@couch/theme';
import {playSound} from '../sound';
import {tossLede, tossMeta, verdictTitleSize} from '../tv-screen';
import {posterSource} from '../useHost';
import type {Send} from '../App';
import {Button, Chip, Header, at, k, sheet, t} from '../ui';

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

  if (tossing) return <CoinToss toss={v.coinToss!} meta={tossMeta(v.stats)} onDone={() => setTossed(tossKey)} />;

  const title = v.title;
  const size = verdictTitleSize(title.title);
  const eyebrow = v.isRunnerUp ? 'The runner-up' : v.viaSuddenDeath ? 'Decided in sudden death' : "The referee's pick";
  return (
    <View style={t.screen}>
      <Header />
      <Image source={posterSource(title.posterUrl)} style={[s.poster, at(120, 200)]} accessibilityIgnoresInvertColors />
      <View style={[s.info, at(700, 200)]}>
        <Text style={t.eyebrow}>{eyebrow}</Text>
        <Text style={[t.displayXL, s.title, {fontSize: size * k, lineHeight: size * 0.95 * k}]} numberOfLines={2}>
          {title.title}
        </Text>
        <View style={[t.row, s.chips]}>
          <Chip label={`${title.runtimeMin} min`} />
          {title.genres.slice(0, 2).map(g => (
            <Chip key={g} label={g} />
          ))}
          {title.availability[0] ? <Chip label={`Watch on ${title.availability[0].serviceName}`} raised /> : null}
        </View>
        <Text style={[t.large, s.reason]}>“{v.reason}”</Text>
        <View style={[t.row, s.actions]}>
          <Button label="Done" primary preferred onPress={onDone} />
          <Button label="Runner-up" disabled={!v.hasNextRunnerUp} onPress={() => send({type: 'runnerUp'})} />
          <Button label="Rematch" onPress={() => send({type: 'rematch'})} />
        </View>
      </View>
    </View>
  );
}

function CoinToss({toss, meta, onDone}: {toss: NonNullable<VerdictView['coinToss']>; meta: string; onDone: () => void}) {
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
  const motion = (c: TitleCard) => (c.id === toss.winnerId ? {transform: [{translateY: lift}]} : {opacity: fade});
  const n = toss.candidates.length;
  const label = <Text style={s.flipping}>{landed ? 'Called it.' : 'Flipping…'}</Text>;

  return (
    <View style={t.screen}>
      <Header />
      <Text style={[t.display, at(120, 190)]}>Dead heat.</Text>
      <Text style={[t.lede, s.tossLede, at(120, 310)]}>{tossLede(n)}</Text>
      {n === 2 ? (
        // Figma: two finalists either side of the coin.
        <>
          {toss.candidates.map((c, i) => (
            <Animated.View key={c.id} style={[at(i === 0 ? 180 : 1300, 420), motion(c)]}>
              <TossCard card={c} meta={meta} width={440} />
            </Animated.View>
          ))}
          <Animated.View style={[s.coin, at(810, 490), {transform: [{scaleX}]}]}>
            <Text style={s.coinText}>cc</Text>
          </Animated.View>
          <View style={[s.centered, at(0, 820)]}>{label}</View>
        </>
      ) : (
        // A wider tie (e.g. a sudden death where nobody said yes): the coin above every finalist.
        <>
          <Animated.View style={[s.coin, s.coinSmall, at(880, 372), {transform: [{scaleX}]}]}>
            <Text style={[s.coinText, s.coinTextSmall]}>cc</Text>
          </Animated.View>
          <View style={[s.centered, at(0, 540)]}>{label}</View>
          <View style={[s.wideRow, at(120, 600)]}>
            {toss.candidates.map(c => (
              <Animated.View key={c.id} style={motion(c)}>
                <TossCard card={c} meta={meta} width={(1680 - 24 * (n - 1)) / n} />
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** Finalist card: poster on top (290 of 460 at full size), title and the tied votes below. */
function TossCard({card, meta, width}: {card: TitleCard; meta: string; width: number}) {
  const r = width / 440;
  const titleSize = (card.title.length <= 16 ? 44 : 36) * Math.max(0.7, r);
  return (
    <View style={[s.tossCard, {width: width * k, height: 460 * r * k + (r < 1 ? 40 * k : 0)}]}>
      <Image source={posterSource(card.posterUrl)} style={{width: width * k, height: 290 * r * k}} />
      <View style={{paddingHorizontal: 32 * r * k, paddingTop: 26 * r * k, gap: 14 * r * k}}>
        <Text style={[s.tossTitle, {fontSize: titleSize * k, lineHeight: titleSize * 1.2 * k}]} numberOfLines={r < 1 ? 2 : 1}>
          {card.title}
        </Text>
        <Text style={[s.tossMeta, {fontSize: 30 * Math.max(0.8, r) * k, lineHeight: 36 * Math.max(0.8, r) * k}]}>{meta}</Text>
      </View>
    </View>
  );
}

const s = sheet({
  poster: {width: 480, height: 720, borderRadius: 28, backgroundColor: color.couch},
  info: {width: 1100},
  title: {marginTop: 9},
  chips: {marginTop: 26},
  reason: {marginTop: 38, width: 1060},
  actions: {marginTop: 32, gap: 12, alignItems: 'flex-start'},
  tossLede: {lineHeight: 41},
  tossCard: {borderRadius: 24, overflow: 'hidden', backgroundColor: color.couch},
  tossTitle: {color: color.glow, fontSize: 44, fontFamily: 'display', fontWeight: '700'},
  tossMeta: {color: color.mist, fontSize: 30, fontWeight: '600'},
  coin: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: color.fireOrange,
    borderWidth: 12,
    borderColor: '#FFC23D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {color: color.night, fontSize: 140, fontWeight: '800', lineHeight: 168},
  coinSmall: {width: 160, height: 160, borderRadius: 80, borderWidth: 8},
  coinTextSmall: {fontSize: 72, lineHeight: 86},
  centered: {width: 1920, alignItems: 'center'},
  flipping: {color: color.ember, fontSize: 34, fontWeight: '700', lineHeight: 41},
  wideRow: {flexDirection: 'row', gap: 24},
});

export const Thinking = () => (
  <View style={t.screen}>
    <Header />
    <Text style={[t.display, at(120, 420)]}>The referee is thinking…</Text>
  </View>
);

export const Closed = ({onHome}: {onHome: () => void}) => (
  <View style={t.screen}>
    <Header />
    <Text style={[t.display, at(120, 360)]}>That's a wrap.</Text>
    <Text style={[t.lede, at(120, 500)]}>Enjoy the movie.</Text>
    <View style={at(120, 600)}>
      <Button label="Back to start" primary preferred onPress={onHome} />
    </View>
  </View>
);
