// Shared TV pieces, built to the Figma frames (page "Screens", 1920×1080). Positions are Figma
// coordinates; text line heights match Figma's (Auto ≈ 1.2 × size, Display XL 95 %), so a block at
// top: y in code sits where the frame puts it.
import React, {useState} from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {color} from '@couch/theme';
import {withFont} from './type';

/**
 * Screens are designed at 1920×1080 (Figma). Vega lays out in density-independent units (960×540 on a
 * 1080p TV), so every size goes through k. Unitless values (flex, opacity, zIndex, transforms) stay as is.
 */
export const k = Dimensions.get('window').width / 1920;
const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'aspectRatio',
  'transform',
  'elevation',
]);
const scaleStyle = (o: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(o).map(([key, v]) => [
      key,
      typeof v === 'number' && !UNITLESS.has(key) ? v * k : v,
    ]),
  );
/** StyleSheet.create with 1920-based sizes and the brand fonts (type.ts). */
export function sheet<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const out: Record<string, unknown> = {};
  for (const [name, style] of Object.entries(styles))
    out[name] = withFont(scaleStyle(style as Record<string, unknown>));
  return StyleSheet.create(out as T);
}
/** One-off Figma position: {left, top} scaled. */
export const at = (left: number, top: number) => ({
  position: 'absolute' as const,
  left: left * k,
  top: top * k,
});

/** Brand / Lockup (horizontal): the mark and the wordmark, top left of every screen but Home. */
export const Header = () => (
  <>
    <Image source={require('../assets/image/mark.png')} style={s.mark} />
    <Text style={s.wordmark}>CouchConsensus</Text>
  </>
);

type ButtonProps = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  preferred?: boolean;
  /** The surface behind the button: the focus ring is drawn in it when unfocused, so nothing shifts. */
  on?: string;
  style?: StyleProp<ViewStyle>;
  /** False while a panel covers the button, so the remote cannot reach it. */
  focusable?: boolean;
};

/**
 * Button (Figma: "Button / primary / focused"): 108 tall, Figtree Bold 40, radius 20. Primary is Fire
 * TV orange with Night text (5.3:1); secondary is Couch. Focus adds a 6 px Glow ring outside the button.
 */
export function Button({
  label,
  onPress,
  primary,
  disabled,
  preferred,
  on = color.night,
  style,
  focusable = true,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      disabled={disabled}
      focusable={focusable}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      accessibilityLabel={label}
      style={[
        s.ring,
        {borderColor: focused ? color.glow : on},
        disabled && s.disabled,
        style,
      ]}>
      <View style={[s.button, (primary || focused) && s.orange]}>
        <Text style={[s.buttonText, (primary || focused) && s.onOrange]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Chip / option (rules editor): Cushion, orange with a check when selected, Glow ring when focused. */
export function Option(p: {
  label: string;
  selected?: boolean;
  preferred?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={p.preferred}
      disabled={p.disabled}
      onPress={p.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{selected: p.selected, disabled: p.disabled}}
      accessibilityLabel={p.label}
      style={[
        s.optionRing,
        {borderColor: focused ? color.glow : color.couch},
        p.disabled && s.disabled,
      ]}>
      <View style={[s.option, (p.selected || focused) && s.orange]}>
        <Text style={[s.optionText, (p.selected || focused) && s.onOrange]}>
          {p.selected ? `✓ ${p.label}` : p.label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Chip / rule: a fact, not a control. Couch, or Cushion to stand out ("Watch on …"). */
export const Chip = ({label, raised}: {label: string; raised?: boolean}) => (
  <View style={[s.chip, raised && {backgroundColor: color.cushion}]}>
    <Text style={s.chipText}>{label}</Text>
  </View>
);

export type Seat = {label: string; fill: string; open?: boolean};

/** People along the bottom edge (Figma: "audience" / "seat"): 220 heads at y 830, shoulders from y 1010. */
export function Heads({seats, xs}: {seats: Seat[]; xs: number[]}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {seats.map((p, i) => (
        <React.Fragment key={`${p.label}-${i}`}>
          <View
            style={[
              s.shoulders,
              at(xs[i]! - 60, 1010),
              {backgroundColor: p.fill},
            ]}
          />
          <View style={[s.head, at(xs[i]!, 830), {backgroundColor: p.fill}]}>
            {p.label ? (
              <Text numberOfLines={1} style={p.open ? s.plus : s.headText}>
                {p.label}
              </Text>
            ) : null}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Head x positions for n seats, 260 apart, ending with the last head at x = last. */
export const seatXs = (n: number, last: number) =>
  Array.from({length: n}, (_, i) => last - 260 * (n - 1 - i));

export const Toast = ({text}: {text?: string}) =>
  text ? (
    <View style={s.toast} accessibilityLiveRegion="polite">
      <Text style={s.toastText}>{text}</Text>
    </View>
  ) : null;

/** Figma text styles (TV/…). */
export const t = sheet({
  screen: {flex: 1, backgroundColor: color.night, overflow: 'hidden'},
  displayXL: {
    color: color.glow,
    fontSize: 160,
    fontWeight: '800',
    lineHeight: 152,
    letterSpacing: -3.2,
  },
  display: {
    color: color.glow,
    fontSize: 96,
    fontWeight: '800',
    lineHeight: 115,
  },
  title: {
    color: color.glow,
    fontSize: 56,
    fontFamily: 'display',
    fontWeight: '700',
    lineHeight: 67,
  },
  eyebrow: {
    color: color.ember,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
  },
  lede: {color: color.mist, fontSize: 34, fontWeight: '500', lineHeight: 47.6},
  large: {color: color.glow, fontSize: 40, fontWeight: '500', lineHeight: 48},
  label: {color: color.mist, fontSize: 28, fontWeight: '600', lineHeight: 34},
  hint: {color: color.mist, fontSize: 30, fontWeight: '500', lineHeight: 36},
  row: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16},
});

const s = sheet({
  mark: {position: 'absolute', left: 118, top: 76, width: 74, height: 74},
  wordmark: {
    position: 'absolute',
    left: 218,
    top: 82,
    color: color.glow,
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 50,
  },
  ring: {borderWidth: 6, borderRadius: 26, alignSelf: 'flex-start'},
  button: {
    paddingVertical: 30,
    paddingHorizontal: 56,
    borderRadius: 20,
    backgroundColor: color.couch,
  },
  buttonText: {
    color: color.glow,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
  },
  optionRing: {borderWidth: 6, borderRadius: 22},
  option: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: color.cushion,
  },
  optionText: {
    color: color.glow,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
  },
  orange: {backgroundColor: color.fireOrange},
  onOrange: {color: color.night},
  disabled: {opacity: 0.4},
  chip: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: color.couch,
  },
  chipText: {
    color: color.glow,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
  },
  head: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  headText: {
    color: color.night,
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 58,
  },
  plus: {color: color.mist, fontSize: 72, fontWeight: '800', lineHeight: 86},
  shoulders: {width: 340, height: 220, borderRadius: 150},
  toast: {
    position: 'absolute',
    left: 120,
    bottom: 40,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: color.cushion,
  },
  toastText: {
    color: color.error,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
  },
});
