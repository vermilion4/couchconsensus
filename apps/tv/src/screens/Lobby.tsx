// Lobby (TV-2, TV-3): QR + room code, live voter heads, ground rules, Start voting.
// Ground rules editor (TV-7): which services you have and the longest movie you'll sit through.
import React, {useEffect, useState} from 'react';
import {BackHandler, StyleSheet, Text, View} from 'react-native';
import QRCode from '@amazon-devices/react-native-qrcode-svg';
import {MAX_RUNTIME_STEPS, type GroundRules, type ServiceId, type TvView} from '@couch/protocol';
import {color} from '@couch/theme';
import {lobbyHint, regionName, rulesChips, runtimeLabel} from '../tv-screen';
import type {Send} from '../App';
import {Button, Chip, Header, Heads, t, k, sheet} from '../ui';

export function Lobby({view, send}: {view: TvView; send: Send}) {
  const [editing, setEditing] = useState(false);
  return (
    <View style={t.screen}>
      <Header />
      <View style={s.columns}>
        <View style={s.left}>
          <View style={s.qrBox}>
            <QRCode value={view.joinUrl} size={400 * k} ecl="M" quietZone={0} />
          </View>
          <Text style={[t.muted, s.scan]}>{'Scan with your phone camera.\nNo app, no account.'}</Text>
        </View>
        <View style={s.right}>
          <Text style={t.label}>Room code</Text>
          <View style={s.code} accessibilityLabel={`Room code ${view.roomCode.split('').join(' ')}`}>
            {view.roomCode.split('').map((ch, i) => (
              <View key={i} style={s.tile}>
                <Text style={s.letter}>{ch}</Text>
              </View>
            ))}
          </View>
          <Text style={[t.label, s.gap]}>Ground rules</Text>
          <View style={t.row}>
            {rulesChips(view.rules).map(c => (
              <Chip key={c} label={c} />
            ))}
            <Button small label="Change" preferred={!view.canStart} onPress={() => setEditing(true)} />
          </View>
          <View style={[t.row, s.gap]}>
            <Button label="Start voting" primary preferred={view.canStart} disabled={!view.canStart} onPress={() => send({type: 'startRound'})} />
            <Text style={[t.muted, s.hint]}>{lobbyHint(view)}</Text>
          </View>
        </View>
      </View>
      <Heads names={view.voters.map(v => v.nickname)} />
      {editing ? <RulesEditor rules={view.rules} send={send} onClose={() => setEditing(false)} /> : null}
    </View>
  );
}

function RulesEditor({rules, send, onClose}: {rules: TvView['rules']; send: Send; onClose: () => void}) {
  const [services, setServices] = useState<ServiceId[]>(rules.services);
  const [maxRuntimeMin, setMax] = useState<GroundRules['maxRuntimeMin']>(rules.maxRuntimeMin);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const toggle = (id: ServiceId) => setServices(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  const save = async () => {
    setSaving(true);
    const ok = await send({type: 'setRules', rules: {services, maxRuntimeMin}});
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <View style={s.overlay}>
      <View style={s.scrim} />
      <View style={s.panel}>
        <Text style={t.h2}>Ground rules</Text>
        <Text style={[t.muted, s.panelLede]}>Every card in the deck follows these rules.</Text>

        <Text style={t.label}>Services you have</Text>
        <View style={t.row}>
          {rules.availableServices.map((sv, i) => (
            <Button key={sv.id} small preferred={i === 0} label={sv.name} selected={services.includes(sv.id)} onPress={() => toggle(sv.id)} />
          ))}
        </View>
        <Text style={[t.muted, s.note]}>{services.length ? '' : 'None picked means all of them.'}</Text>

        <Text style={t.label}>Longest movie</Text>
        <View style={t.row}>
          {[...MAX_RUNTIME_STEPS, null].map(m => (
            <Button key={String(m)} small label={runtimeLabel(m)} selected={maxRuntimeMin === m} onPress={() => setMax(m)} />
          ))}
        </View>

        <Text style={[t.label, s.gap]}>Where to watch</Text>
        <View style={t.row}>
          <Chip label={regionName(rules.region)} />
          <Text style={t.muted}>Detected from your connection</Text>
        </View>

        <View style={[t.row, s.actions]}>
          <Button small label={saving ? 'Saving…' : 'Save rules'} disabled={saving} onPress={save} />
          <Button small label="Cancel" onPress={onClose} />
        </View>
      </View>
    </View>
  );
}

const s = sheet({
  columns: {flex: 1, flexDirection: 'row', gap: 96},
  left: {width: 480},
  qrBox: {backgroundColor: '#ffffff', padding: 40, borderRadius: 28, alignSelf: 'flex-start'},
  scan: {marginTop: 24, fontSize: 26, lineHeight: 36},
  right: {flex: 1, paddingTop: 8},
  code: {flexDirection: 'row', gap: 16},
  tile: {width: 150, height: 180, borderRadius: 18, backgroundColor: color.couch, alignItems: 'center', justifyContent: 'center'},
  letter: {color: color.glow, fontSize: 128, fontWeight: '800'},
  gap: {marginTop: 40},
  hint: {flexShrink: 1, maxWidth: 560, fontSize: 26},
  overlay: {...StyleSheet.absoluteFillObject, flexDirection: 'row'},
  scrim: {flex: 1, backgroundColor: 'rgba(14, 22, 38, 0.72)'},
  panel: {width: 960, backgroundColor: color.couch, paddingHorizontal: 72, paddingVertical: 72, gap: 6},
  panelLede: {marginTop: 8, marginBottom: 28},
  note: {fontSize: 22, minHeight: 34, marginTop: 6},
  actions: {marginTop: 48},
});
