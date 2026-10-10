// Shared TV pieces (Figma: Foundations). 10-foot type: body ≥ 28 px at 1080p (ARCHITECTURE §8).
import React, {useState} from 'react';
import {Dimensions, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {color, voterColor} from '@couch/theme';
import {MAX_VOTERS} from '@couch/protocol';

/**
 * Screens are designed at 1920×1080 (Figma). Vega lays out in density-independent units (960×540 on a
 * 1080p TV), so every size goes through k. Unitless values (flex, opacity, zIndex, transforms) stay as is.
 */
export const k = Dimensions.get('window').width / 1920;
const UNITLESS = new Set(['flex', 'flexGrow', 'flexShrink', 'opacity', 'zIndex', 'aspectRatio', 'transform', 'elevation']);
const scaleStyle = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([key, v]) => [key, typeof v === 'number' && !UNITLESS.has(key) ? v * k : v]));
/** StyleSheet.create with 1920-based sizes. */
export function sheet<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const out: Record<string, unknown> = {};
  for (const [name, style] of Object.entries(styles)) out[name] = scaleStyle(style as Record<string, unknown>);
  return StyleSheet.create(out as T);
}

export const Header = () => (
  <View style={s.header}>
    <Image source={require('../assets/image/mark.png')} style={s.mark} />
    <Text style={s.wordmark}>CouchConsensus</Text>
  </View>
);

type ButtonProps = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  /** Toggle chips: on = orange with a check, like the rules editor. */
  selected?: boolean;
  disabled?: boolean;
  preferred?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Focus = Fire TV orange + Glow ring and a small lift; text on orange is always Night (5.3:1). */
export function Button({label, onPress, primary, selected, disabled, preferred, small, style}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const orange = focused || primary || selected;
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{disabled, selected}}
      accessibilityLabel={label}
      style={[
        small ? s.chipButton : s.button,
        orange && s.orange,
        focused && s.focused,
        disabled && s.disabled,
        style,
      ]}>
      <Text style={[small ? s.chipText : s.buttonText, orange && s.onOrange]}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

export const Chip = ({label}: {label: string}) => (
  <View style={s.chip}>
    <Text style={s.chipText}>{label}</Text>
  </View>
);

/** The row of people along the bottom edge: one head per voter in their colour, plus open seats. */
export function Heads({names, openSeat = true}: {names: string[]; openSeat?: boolean}) {
  const open = openSeat && names.length < MAX_VOTERS ? 1 : 0;
  const shown = names.slice(-4); // the newest four fit; the scoreboard lists everyone
  const offset = names.length - shown.length;
  return (
    <View style={s.heads} pointerEvents="none">
      {shown.map((n, i) => (
        <Person key={`${n}-${i}`} label={n} fill={voterColor(offset + i)} />
      ))}
      {open ? <Person label="+" fill={color.cushion} muted /> : null}
    </View>
  );
}

const Person = ({label, fill, muted}: {label: string; fill: string; muted?: boolean}) => (
  <View style={s.person}>
    <View style={[s.head, {backgroundColor: fill}]}>
      <Text numberOfLines={1} style={[s.headText, muted && {color: color.mist}]}>
        {label}
      </Text>
    </View>
    <View style={[s.shoulders, {backgroundColor: fill}]} />
  </View>
);

export const Toast = ({text}: {text?: string}) =>
  text ? (
    <View style={s.toast} accessibilityLiveRegion="polite">
      <Text style={s.toastText}>{text}</Text>
    </View>
  ) : null;

export const t = sheet({
  screen: {flex: 1, backgroundColor: color.night, paddingHorizontal: 96, paddingTop: 72, paddingBottom: 56},
  display: {color: color.glow, fontSize: 132, fontWeight: '800', lineHeight: 140, letterSpacing: -2},
  h1: {color: color.glow, fontSize: 88, fontWeight: '800', lineHeight: 96},
  h2: {color: color.glow, fontSize: 48, fontWeight: '800'},
  eyebrow: {color: color.ember, fontSize: 30, fontWeight: '700'},
  body: {color: color.glow, fontSize: 32, lineHeight: 44},
  muted: {color: color.mist, fontSize: 28, lineHeight: 40},
  label: {color: color.mist, fontSize: 26, marginBottom: 14},
  row: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20},
});

const s = sheet({
  header: {flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 36},
  mark: {width: 64, height: 64},
  wordmark: {color: color.glow, fontSize: 36, fontWeight: '800'},
  button: {
    paddingVertical: 24,
    paddingHorizontal: 48,
    borderRadius: 18,
    backgroundColor: color.couch,
    borderWidth: 5,
    borderColor: 'transparent',
  },
  chipButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: color.cushion,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  orange: {backgroundColor: color.fireOrange},
  focused: {borderColor: color.glow, transform: [{scale: 1.05}]},
  disabled: {opacity: 0.4},
  buttonText: {color: color.glow, fontSize: 36, fontWeight: '700'},
  chipText: {color: color.glow, fontSize: 28, fontWeight: '600'},
  onOrange: {color: color.night},
  chip: {paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: color.cushion},
  heads: {position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end'},
  person: {width: 260, alignItems: 'center', marginLeft: -50},
  head: {width: 220, height: 220, borderRadius: 110, alignItems: 'center', justifyContent: 'center', zIndex: 1, paddingHorizontal: 16},
  headText: {color: color.night, fontSize: 44, fontWeight: '800'},
  shoulders: {width: 320, height: 110, marginTop: -40, borderTopLeftRadius: 160, borderTopRightRadius: 160},
  toast: {position: 'absolute', left: 96, bottom: 40, paddingVertical: 18, paddingHorizontal: 28, borderRadius: 16, backgroundColor: color.cushion},
  toastText: {color: color.error, fontSize: 28, fontWeight: '600'},
});
