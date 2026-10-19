// Lobby (TV-2, TV-3) and the ground rules editor (TV-7), built to Figma "TV / Lobby" and
// "TV / Lobby · ground rules editor". The rules chips are the focus target that opens the editor.
import React, {useEffect, useState} from 'react';
import {BackHandler, Pressable, Text, View} from 'react-native';
import QRCode from '@amazon-devices/react-native-qrcode-svg';
import {
  MAX_RUNTIME_STEPS,
  MAX_VOTERS,
  type GroundRules,
  type ServiceId,
  type TvView,
} from '@couch/protocol';
import {color, voterColor} from '@couch/theme';
import {lobbyHint, regionName, rulesChips, runtimeLabel} from '../tv-screen';
import type {Send} from '../App';
import {
  Button,
  Chip,
  Header,
  Heads,
  Option,
  at,
  k,
  seatXs,
  sheet,
  t,
  type Seat,
} from '../ui';

export function Lobby({view, send}: {view: TvView; send: Send}) {
  const [editing, setEditing] = useState(false);
  const [rulesFocused, setRulesFocused] = useState(false);
  // Closing the editor unmounts whatever had focus; hand it back to the chips that opened it.
  const [returnFocus, setReturnFocus] = useState(false);

  // The newest people that fit, then the open seat (Figma: last head at x 1670).
  const open = view.voters.length < MAX_VOTERS;
  const shown = view.voters.slice(open ? -3 : -4);
  const offset = view.voters.length - shown.length;
  const seats: Seat[] = [
    ...shown.map((v, i) => ({label: v.nickname, fill: voterColor(offset + i)})),
    ...(open ? [{label: '+', fill: color.couch, open: true}] : []),
  ];

  return (
    <View style={t.screen}>
      <Header />

      <View style={[s.qrCard, at(120, 200)]}>
        <QRCode value={view.joinUrl} size={348 * k} ecl="M" quietZone={0} />
      </View>
      <Text style={[t.label, at(120, 664)]}>
        {'Scan with your phone camera.\nNo app, no account.'}
      </Text>

      <Text style={[t.label, at(680, 200)]}>Room code</Text>
      <View
        style={[s.tiles, at(680, 248)]}
        accessibilityLabel={`Room code ${view.roomCode.split('').join(' ')}`}>
        {view.roomCode.split('').map((ch, i) => (
          <View key={i} style={s.tile}>
            <Text style={s.letter}>{ch}</Text>
          </View>
        ))}
      </View>

      <Text style={[t.label, at(680, 480)]}>Ground rules</Text>
      <Pressable
        style={[
          s.rulesRing,
          at(674, 520),
          {borderColor: rulesFocused ? color.glow : color.night},
        ]}
        hasTVPreferredFocus={!view.canStart || returnFocus}
        // The editor is a panel over the lobby: keep the remote inside it until it closes.
        focusable={!editing}
        onFocus={() => setRulesFocused(true)}
        onBlur={() => {
          setRulesFocused(false);
          setReturnFocus(false);
        }}
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel={`Ground rules: ${rulesChips(view.rules).join(
          ', ',
        )}. Press OK to change.`}>
        <View style={t.row}>
          {rulesChips(view.rules).map((c) => (
            <Chip key={c} label={c} />
          ))}
        </View>
      </Pressable>

      <View style={[t.row, at(680, 626), {gap: 36 * k, flexWrap: 'nowrap'}]}>
        <Button
          label="Start voting"
          primary
          preferred={view.canStart}
          disabled={!view.canStart}
          focusable={!editing}
          onPress={() => send({type: 'startRound'})}
        />
        <Text style={[t.hint, s.hint]}>{lobbyHint(view)}</Text>
      </View>

      <Heads seats={seats} xs={seatXs(seats.length, 1670)} />
      {editing ? (
        <RulesEditor
          rules={view.rules}
          send={send}
          onClose={() => {
            setEditing(false);
            setReturnFocus(true);
          }}
        />
      ) : null}
    </View>
  );
}

function RulesEditor({
  rules,
  send,
  onClose,
}: {
  rules: TvView['rules'];
  send: Send;
  onClose: () => void;
}) {
  const [services, setServices] = useState<ServiceId[]>(rules.services);
  const [maxRuntimeMin, setMax] = useState<GroundRules['maxRuntimeMin']>(
    rules.maxRuntimeMin,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const toggle = (id: ServiceId) =>
    setServices((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const save = async () => {
    setSaving(true);
    const ok = await send({type: 'setRules', rules: {services, maxRuntimeMin}});
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <>
      <View style={s.dim} />
      <View style={s.panel}>
        <Text style={t.title}>Ground rules</Text>
        <Text style={[t.hint, s.gap24]}>
          Every card in the deck follows these rules.
        </Text>

        <Text style={[t.label, s.gap24]}>Services you have</Text>
        <View style={[s.options, s.gap18]}>
          {rules.availableServices.map((sv, i) => (
            <Option
              key={sv.id}
              preferred={i === 0}
              label={sv.name}
              selected={services.includes(sv.id)}
              onPress={() => toggle(sv.id)}
            />
          ))}
        </View>

        <Text style={[t.label, s.gap18]}>Longest movie</Text>
        <View style={[s.options, s.gap18]}>
          {[...MAX_RUNTIME_STEPS, null].map((m) => (
            <Option
              key={String(m)}
              label={runtimeLabel(m)}
              selected={maxRuntimeMin === m}
              onPress={() => setMax(m)}
            />
          ))}
        </View>

        <Text style={[t.label, s.gap18]}>Where to watch</Text>
        <View style={[t.row, s.gap24, {gap: 20 * k}]}>
          <Chip label={regionName(rules.region)} raised />
          <Text style={s.detected}>Detected from your connection</Text>
        </View>

        <View style={[s.options, s.actions]}>
          <Option
            label={saving ? 'Saving…' : 'Save rules'}
            disabled={saving}
            onPress={save}
          />
          <Option label="Cancel" onPress={onClose} />
        </View>
      </View>
    </>
  );
}

const s = sheet({
  qrCard: {
    width: 440,
    height: 440,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {flexDirection: 'row', gap: 20},
  tile: {
    width: 156,
    height: 188,
    borderRadius: 24,
    backgroundColor: color.couch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: color.glow,
    fontSize: 140,
    fontWeight: '800',
    lineHeight: 168,
  },
  rulesRing: {borderWidth: 6, borderRadius: 22},
  hint: {flexShrink: 1, maxWidth: 760},
  dim: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    backgroundColor: color.night,
    opacity: 0.7,
  },
  panel: {
    position: 'absolute',
    left: 1000,
    top: 0,
    width: 920,
    height: 1080,
    backgroundColor: color.couch,
    paddingTop: 96,
    paddingLeft: 80,
    paddingRight: 120,
  },
  // Options carry a 6 px ring (in Couch until focused), so the gaps here are Figma's minus the ring.
  options: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: -6},
  gap24: {marginTop: 24},
  gap18: {marginTop: 18},
  detected: {
    color: color.mist,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 34,
  },
  actions: {marginTop: 58, gap: 12},
});
