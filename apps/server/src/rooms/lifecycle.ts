// Room lifecycle as pure functions over a Room (ARCHITECTURE §6). Time comes in through ctx.now,
// so every rule is testable without timers; RoomManager adds timers, sockets and persistence.
import {
  DEFAULT_RULES,
  MAX_VOTERS,
  MIN_VOTERS_TO_START,
  ROOM_TTL_MS,
  SUDDEN_DEATH_CARDS,
  SUDDEN_DEATH_SECONDS,
  type ClientCommand,
  type HostCommand,
  type VoterCommand,
} from '@couch/protocol';
import {rankTitles} from '@couch/referee';
import {buildDeck} from './deck';
import {OK, fail, type Actor, type Ctx, type Result, type Room, type Round, type Voter} from './model';
import {buildVerdict} from './verdict';

/** A dropped phone stops blocking "everyone finished" after this long (resilience NFR). */
export const ACTIVE_WINDOW_MS = 15_000;
const RECENT_CMD_IDS = 64;

export function newRoom(o: {
  code: string;
  id: string;
  hostTokenHash: string;
  region: string;
  now: number;
  joinUrl?: string;
  clientInstallId?: string;
}): Room {
  return {
    schemaVersion: 1,
    id: o.id,
    code: o.code,
    rev: 0,
    phase: 'lobby',
    createdAt: o.now,
    expiresAt: o.now + ROOM_TTL_MS,
    hostTokenHash: o.hostTokenHash,
    joinUrl: o.joinUrl ?? '',
    ...(o.clientInstallId ? {clientInstallId: o.clientInstallId} : {}),
    region: o.region,
    rules: {...DEFAULT_RULES},
    voters: [],
    moods: [],
    rounds: [],
    verdictCursor: 0,
    hostLastSeenAt: o.now,
  };
}

export const seatedVoters = (room: Room) => room.voters.filter(v => !v.kicked);
export const currentRound = (room: Room): Round | undefined => room.rounds.at(-1);
const voting = (room: Room) => room.phase === 'voting' || room.phase === 'suddenDeath';

export function seatVoter(room: Room, v: {id: string; nickname: string; seatTokenHash: string}, now: number): Result {
  if (room.phase === 'closed') return fail('WRONG_PHASE', 'This room is closed');
  if (seatedVoters(room).length >= MAX_VOTERS) return fail('ROOM_FULL', 'This room is full');
  room.voters.push({
    id: v.id,
    nickname: uniqueNickname(room, v.nickname),
    seatTokenHash: v.seatTokenHash,
    joinIndex: room.voters.length,
    joinedAt: now,
    joinedRoundNo: voting(room) ? currentRound(room)!.no : 0,
    connected: false,
    lastSeenAt: now,
    kicked: false,
    recentCmdIds: [],
  });
  room.rev++;
  return OK;
}

export function setConnected(room: Room, voterId: string, connected: boolean, now: number): void {
  const v = room.voters.find(x => x.id === voterId);
  if (!v) return;
  v.connected = connected;
  v.lastSeenAt = now;
  room.rev++;
}

/** Called on every timer tick: ends the round when time is up, or when everyone still around has finished. */
export function onTick(room: Room, ctx: Ctx): boolean {
  if (!voting(room)) return false;
  const round = currentRound(room)!;
  const reason = ctx.now >= round.endsAt ? 'timer' : everyoneFinished(room, ctx.now) ? 'allDone' : undefined;
  if (!reason) return false;
  endRound(room, reason, ctx);
  // Commands bump rev in apply(); a tick is a change too, or clients drop the new view as stale.
  room.rev++;
  return true;
}

export function apply(room: Room, actor: Actor, cmd: ClientCommand, ctx: Ctx): Result {
  if (room.phase === 'closed') return fail('WRONG_PHASE', 'This room is closed');

  const seen = actor.role === 'host' ? room : findVoter(room, actor.voterId);
  if (!seen) return fail('UNAUTHORIZED', 'You are not in this room');
  if (actor.role === 'host') room.hostLastSeenAt = ctx.now;
  else (seen as Voter).lastSeenAt = ctx.now;

  // Idempotency: a repeated command id is acknowledged without being applied again (ADR-0004).
  const recent = actor.role === 'host' ? (room.hostRecentCmdIds ??= []) : (seen as Voter).recentCmdIds;
  if (recent.includes(cmd.cmdId)) return OK;

  const result =
    actor.role === 'host'
      ? isHostCommand(cmd)
        ? hostCommand(room, cmd, ctx)
        : fail('UNAUTHORIZED', 'Only voters can do that')
      : isHostCommand(cmd)
        ? fail('UNAUTHORIZED', 'Only the TV can do that')
        : voterCommand(room, seen as Voter, cmd, ctx);

  if (result.ok) {
    recent.push(cmd.cmdId);
    if (recent.length > RECENT_CMD_IDS) recent.shift();
    room.rev++;
  }
  return result;
}

const HOST_TYPES = new Set(['setRules', 'startRound', 'endRound', 'runnerUp', 'rematch', 'kickVoter', 'closeRoom']);
const isHostCommand = (cmd: ClientCommand): cmd is HostCommand => HOST_TYPES.has(cmd.type);

function findVoter(room: Room, id: string): Voter | undefined {
  return room.voters.find(v => v.id === id && !v.kicked);
}

function hostCommand(room: Room, cmd: HostCommand, ctx: Ctx): Result {
  switch (cmd.type) {
    case 'setRules': {
      if (room.phase !== 'lobby') return fail('WRONG_PHASE', 'Rules can only change in the lobby');
      const {region, ...rules} = cmd.rules;
      room.rules = {...room.rules, ...rules};
      if (region) room.region = region;
      return OK;
    }
    case 'startRound':
      if (room.phase !== 'lobby') return fail('WRONG_PHASE', 'The round has already started');
      if (seatedVoters(room).length < MIN_VOTERS_TO_START)
        return fail('NOT_ENOUGH_VOTERS', `At least ${MIN_VOTERS_TO_START} people need to join`);
      deal(room, 'main', ctx);
      return OK;
    case 'endRound':
      if (!voting(room)) return fail('WRONG_PHASE', 'No round is running');
      endRound(room, 'host', ctx);
      return OK;
    case 'runnerUp':
      if (room.phase !== 'verdict' || !room.verdict) return fail('WRONG_PHASE', 'There is no verdict yet');
      if (room.verdictCursor + 1 >= room.verdict.rankingIds.length) return fail('NO_RUNNER_UP', 'No other title made the cut');
      room.verdictCursor++;
      return OK;
    case 'rematch':
      if (room.phase !== 'verdict') return fail('WRONG_PHASE', 'Rematch is only available after a verdict');
      delete room.verdict;
      room.verdictCursor = 0;
      deal(room, 'main', ctx);
      return OK;
    case 'kickVoter': {
      const v = findVoter(room, cmd.voterId);
      if (!v) return fail('UNAUTHORIZED', 'No such voter');
      v.kicked = true;
      return OK;
    }
    case 'closeRoom':
      room.phase = 'closed';
      return OK;
  }
}

function voterCommand(room: Room, voter: Voter, cmd: VoterCommand, ctx: Ctx): Result {
  switch (cmd.type) {
    case 'setMood': {
      if (room.phase !== 'lobby') return fail('WRONG_PHASE', 'Moods are set before the round starts');
      room.moods = room.moods.filter(m => m.voterId !== voter.id);
      room.moods.push({
        voterId: voter.id,
        chips: cmd.chips,
        ...(cmd.text ? {text: cmd.text} : {}),
        skipped: cmd.skipped ?? false,
        at: ctx.now,
      });
      return OK;
    }
    case 'vote':
      return castVote(room, voter, cmd, ctx);
    case 'undo': {
      const round = currentRound(room);
      if (!voting(room) || !round || cmd.roundNo !== round.no) return fail('ROUND_OVER', 'This round has ended');
      const ballot = round.ballots[voter.id];
      if (!ballot || cmd.cardIndex !== ballot.votes.length - 1) return fail('STALE_CARD', 'Only the last card can be undone');
      ballot.votes.pop();
      delete ballot.finishedAt;
      return OK;
    }
    case 'leave':
      voter.kicked = true;
      return OK;
  }
}

function castVote(room: Room, voter: Voter, cmd: Extract<VoterCommand, {type: 'vote'}>, ctx: Ctx): Result {
  const round = currentRound(room);
  if (!voting(room) || !round || cmd.roundNo !== round.no || ctx.now >= round.endsAt)
    return fail('ROUND_OVER', 'This round has ended');
  const ballot = (round.ballots[voter.id] ??= {votes: []});
  if (cmd.cardIndex !== ballot.votes.length || cmd.cardIndex >= round.deck.length)
    return fail('STALE_CARD', 'That card is not the current one');
  if (cmd.value === 'veto' && !round.allowVeto) return fail('NOT_ALLOWED_THIS_ROUND', 'No vetoes in sudden death');
  if (cmd.value === 'superYes' && !round.allowSuperYes) return fail('NOT_ALLOWED_THIS_ROUND', 'No super-yes in sudden death');
  if (cmd.value === 'veto' && ballot.votes.includes('veto')) return fail('VETO_USED', 'You already used your veto');
  if (cmd.value === 'superYes' && ballot.votes.includes('superYes'))
    return fail('SUPER_YES_USED', 'You already used your super-yes');

  ballot.votes.push(cmd.value);
  if (ballot.votes.length === round.deck.length) ballot.finishedAt = ctx.now;
  if (everyoneFinished(room, ctx.now)) endRound(room, 'allDone', ctx);
  return OK;
}

/** Every voter who is still around has finished, and at least one has. */
function everyoneFinished(room: Room, now: number): boolean {
  const round = currentRound(room)!;
  const active = seatedVoters(room).filter(v => v.connected || now - v.lastSeenAt < ACTIVE_WINDOW_MS);
  const finished = (v: Voter) => round.ballots[v.id]?.finishedAt !== undefined;
  return seatedVoters(room).some(finished) && active.every(finished);
}

function deal(room: Room, kind: 'main' | 'suddenDeath', ctx: Ctx): void {
  const dealt = room.rounds.flatMap(r => r.deck.map(c => c.titleId));
  const base = {catalog: ctx.catalog, rules: room.rules, region: room.region, moods: room.moods};
  const size = kind === 'main' ? room.rules.deckSize : SUDDEN_DEATH_CARDS;
  let titles = buildDeck({...base, exclude: dealt, size});
  if (titles.length === 0) {
    // Catalog exhausted: reuse what the rules allow (sudden death prefers titles nobody vetoed).
    const parent = currentRound(room);
    const vetoed = new Set(parent?.result?.scores.filter(s => s.vetoed).map(s => s.titleId));
    titles = buildDeck({...base, exclude: [...vetoed], size});
    if (titles.length === 0) titles = buildDeck({...base, exclude: [], size});
  }
  const seconds = kind === 'main' ? room.rules.roundSeconds : SUDDEN_DEATH_SECONDS;
  const parentNo = kind === 'suddenDeath' ? currentRound(room)!.no : undefined;
  room.rounds.push({
    no: room.rounds.length + 1,
    kind,
    ...(parentNo !== undefined ? {parentNo} : {}),
    deck: titles.map((titleId, index) => ({index, titleId})),
    deckSource: 'rules',
    startedAt: ctx.now,
    endsAt: ctx.now + seconds * 1000,
    allowVeto: kind === 'main',
    allowSuperYes: kind === 'main',
    ballots: {},
  });
  room.phase = kind === 'main' ? 'voting' : 'suddenDeath';
}

function endRound(room: Room, reason: 'allDone' | 'timer' | 'host', ctx: Ctx): void {
  const round = currentRound(room)!;
  round.endedAt = ctx.now;
  round.endReason = reason;
  const voterIds = seatedVoters(room).map(v => v.id);
  const tally = rankTitles({
    roundNo: round.no,
    roomId: room.id,
    kind: round.kind,
    deck: round.deck,
    voterIds,
    ballots: Object.fromEntries(Object.entries(round.ballots).map(([id, b]) => [id, b.votes])),
  });
  round.result = tally;
  if (tally.kind === 'suddenDeath') {
    deal(room, 'suddenDeath', ctx);
    return;
  }
  room.verdict = buildVerdict(round, tally, voterIds.length, ctx.catalog, ctx.now);
  room.verdictCursor = 0;
  room.phase = 'verdict';
}

/** "Sam", "Sam 2", … case-insensitive (invariant I9). Stays within 12 chars. */
function uniqueNickname(room: Room, wanted: string): string {
  const taken = new Set(seatedVoters(room).map(v => v.nickname.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = wanted.slice(0, 12 - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
