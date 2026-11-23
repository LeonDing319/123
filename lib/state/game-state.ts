import { z } from "zod";
import { gameEventSchema } from "../schemas/agent-protocol.ts";
import { idListSchema, idSchema, textSchema, trustSchema, turnSchema } from "../schemas/common.ts";

export const gameStateSchema = z.strictObject({
  packId: idSchema,
  currentSceneId: idSchema,
  turn: turnSchema,
  trust: trustSchema,
  discoveredClueIds: idListSchema,
  knownFactIds: idListSchema,
  eventHistory: z.array(gameEventSchema),
  memories: z.array(textSchema),
  endingId: idSchema.nullable(),
});

export type GameState = z.infer<typeof gameStateSchema>;
