import {z} from 'zod';

export const RoomCode = z.string().regex(/^[ABCDEFGHJKMNPQRTUWXY]{4}$/);
export const VoteCommand = z.object({
  type: z.literal('vote'),
  cmdId: z.string().uuid(),
  roundNo: z.number().int().positive(),
  cardIndex: z.number().int().min(0),
  value: z.enum(['yes', 'no', 'superYes', 'veto']),
});
export type VoteCommand = z.infer<typeof VoteCommand>;
export const PROTOCOL_VERSION = 1;
