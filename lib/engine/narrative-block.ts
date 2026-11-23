import type { AgentTurnOutput } from "../schemas/agent-protocol.ts";

type TextBlock = {
  kind: "narration" | "ai_inference" | "character_action";
  text: string;
};

export type NarrativeBlock =
  | TextBlock
  | { kind: "visual"; src: string; alt: string }
  | { kind: "clue"; clueId: string; text: string }
  | ({ kind: "decision" } & AgentTurnOutput["danmakuDecisions"][number])
  | { kind: "system_event"; text: string };
