// Audience projections (DATA_MODEL §6, ADR-0004). The ONLY way room state reaches a client:
// the TV view never carries a vote value (TV-4, I8); a voter view carries only that voter's votes.
import {DEMO_REGION, type CatalogFile, type Genre} from '@couch/catalog';
import type {TitleCard, TvView, VoterView} from '@couch/protocol';
import {availabilityFor} from './deck';
import {currentRound, seatedVoters} from './lifecycle';
import type {Ctx, Room, Round} from './model';
import {titleName} from './verdict';

const GENRE_LABEL: Record<Genre, string> = {
  action: 'Action',
  adventure: 'Adventure',
  animation: 'Animation',
  comedy: 'Comedy',
  crime: 'Crime',
  documentary: 'Documentary',
  drama: 'Drama',
  family: 'Family',
  fantasy: 'Fantasy',
  horror: 'Horror',
  mystery: 'Mystery',
  romance: 'Romance',
  scienceFiction: 'Sci-fi',
  thriller: 'Thriller',
  war: 'War',
  western: 'Western',
  music: 'Music',
  history: 'History',
};

export function titleCard(catalog: CatalogFile, region: string, id: string): TitleCard {
  const t = catalog.titles.find(x => x.id === id);
  if (!t) throw new Error(`Unknown title ${id}`);
  const serviceName = (sid: string) => catalog.services.find(s => s.id === sid)?.name ?? sid;
  return {
    id: t.id,
    title: t.title,
    year: t.year,
    runtimeMin: t.runtimeMin,
    genres: t.genres.slice(0, 3).map(g => GENRE_LABEL[g]),
    logline: t.logline,
    posterUrl: t.posterPath,
    availability: availabilityFor(t, region).map(a => ({serviceName: serviceName(a.serviceId), type: a.type})),
  };
}

const isVoting = (room: Room) => room.phase === 'voting' || room.phase === 'suddenDeath';

const timer = (round: Round, now: number) => ({
  endsAt: round.endsAt,
  serverNow: now,
  durationMs: round.endsAt - round.startedAt,
});

/** The round whose ranking the verdict came from (the last one that ended). */
const verdictRound = (room: Room) => [...room.rounds].reverse().find(r => r.result?.kind === 'ranked');

function verdictReason(room: Room, catalog: CatalogFile): string {
  const v = room.verdict!;
  if (room.verdictCursor === 0) return v.reason;
  const id = v.rankingIds[room.verdictCursor]!;
  const score = verdictRound(room)?.result?.scores.find(s => s.titleId === id);
  const yes = score?.yes ?? 0;
  const name = titleName(catalog, id);
  // Aggregates only (never who); and no "got 0 votes" put-down for a title the room may still enjoy.
  if (yes === 0) return `Next on the referee's list: ${name}.`;
  return `Next best: ${yes} of you said yes to ${name}.`;
}

export function projectTv(room: Room, ctx: Ctx): TvView {
  const round = currentRound(room);
  const live = isVoting(room) && round;
  const services = ctx.catalog.services.filter(s => s.regions.includes(room.region) || s.regions.includes(DEMO_REGION));
  const v = room.verdict;
  return {
    audience: 'tv',
    rev: room.rev,
    serverNow: ctx.now,
    roomCode: room.code,
    joinUrl: room.joinUrl,
    phase: room.phase,
    rules: {...room.rules, region: room.region, availableServices: services.map(s => ({id: s.id, name: s.name}))},
    voters: seatedVoters(room).map(voter => {
      const ballot = live ? round.ballots[voter.id] : undefined;
      return {
        id: voter.id,
        nickname: voter.nickname,
        connected: voter.connected,
        moodDone: room.moods.some(m => m.voterId === voter.id),
        // counts only, never values (TV-4, I8)
        progress: {done: ballot?.votes.length ?? 0, total: live ? round.deck.length : 0},
        finished: ballot?.finishedAt !== undefined,
      };
    }),
    canStart: room.phase === 'lobby' && seatedVoters(room).length >= 2,
    ...(live ? {round: {no: round.no, kind: round.kind, timer: timer(round, ctx.now), deckSize: round.deck.length}} : {}),
    ...(v && room.phase === 'verdict'
      ? {
          verdict: {
            title: titleCard(ctx.catalog, room.region, v.rankingIds[room.verdictCursor]!),
            reason: verdictReason(room, ctx.catalog),
            isRunnerUp: room.verdictCursor > 0,
            hasNextRunnerUp: room.verdictCursor + 1 < v.rankingIds.length,
            viaSuddenDeath: v.viaSuddenDeath,
            ...(v.coinToss
              ? {
                  coinToss: {
                    candidates: v.coinToss.candidates.map(id => titleCard(ctx.catalog, room.region, id)),
                    winnerId: v.coinToss.winner,
                  },
                }
              : {}),
            stats: v.stats,
          },
        }
      : {}),
  };
}

export function projectVoter(room: Room, voterId: string, ctx: Ctx): VoterView {
  const voter = room.voters.find(x => x.id === voterId);
  if (!voter) throw new Error(`Unknown voter ${voterId}`);
  const round = currentRound(room);
  const live = isVoting(room) && round;
  const ballot = live ? round.ballots[voterId] : undefined;
  const mood = room.moods.find(m => m.voterId === voterId);
  const v = room.verdict;

  return {
    audience: 'voter',
    rev: room.rev,
    serverNow: ctx.now,
    roomCode: room.code,
    phase: room.phase,
    me: {
      id: voter.id,
      nickname: voter.nickname,
      ...(mood ? {mood: {chips: mood.chips, ...(mood.text ? {text: mood.text} : {}), skipped: mood.skipped}} : {}),
      ...(live
        ? {
            ballot: {
              votes: [...(ballot?.votes ?? [])], // MY votes only
              vetoAvailable: round.allowVeto && !ballot?.votes.includes('veto'),
              superYesAvailable: round.allowSuperYes && !ballot?.votes.includes('superYes'),
              finished: ballot?.finishedAt !== undefined,
            },
          }
        : {}),
    },
    roomSize: seatedVoters(room).length,
    ...(live
      ? {
          round: {
            no: round.no,
            kind: round.kind,
            timer: timer(round, ctx.now),
            deck: round.deck.map(c => titleCard(ctx.catalog, room.region, c.titleId)),
            allowVeto: round.allowVeto,
            allowSuperYes: round.allowSuperYes,
          },
        }
      : {}),
    ...(v && room.phase === 'verdict'
      ? (() => {
          const id = v.rankingIds[room.verdictCursor]!;
          return {
            result: {
              title: titleCard(ctx.catalog, room.region, id),
              reason: verdictReason(room, ctx.catalog),
              myVote: myVoteOn(room, voterId, id),
            },
          };
        })()
      : {}),
  };
}

function myVoteOn(room: Room, voterId: string, titleId: string): VoterView['result'] extends infer R ? R extends {myVote: infer M} ? M : never : never {
  const round = verdictRound(room);
  const voter = room.voters.find(x => x.id === voterId)!;
  if (!round || voter.joinedAt > (round.endedAt ?? Infinity)) return 'notInRound';
  const index = round.deck.findIndex(c => c.titleId === titleId);
  return round.ballots[voterId]?.votes[index] ?? 'notReached';
}
