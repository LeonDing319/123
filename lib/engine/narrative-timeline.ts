import type { Danmaku } from "../schemas/agent-protocol.ts";
import type { NarrativeBlock } from "./narrative-block.ts";

export type TimelineSource = "player" | "protagonist" | "ai_system";

type TimelineLinks = {
  sceneId?: string;
  causedBy?: number;
  relatedDanmakuId?: string;
  relatedClueIds?: string[];
};

export type TimelineEvent = TimelineLinks & (
  | { type: "autonomous_action_proposed"; source: "protagonist"; content: { actionId: string } }
  | { type: "autonomous_action_executed"; source: "protagonist"; content: { actionId: string; result: string } }
  | { type: "scene_transition"; source: "ai_system"; content: { fromSceneId: string; toSceneId: string } }
  | { type: "session_completed"; source: "ai_system"; content: { endingId: string; title: string } }
  | { type: "danmaku_expired"; source: "ai_system"; content: { danmakuId: string } }
  | { type: "danmaku_submitted"; source: "player"; content: Danmaku }
  | { type: "narrative_block"; source: Exclude<TimelineSource, "player">; content: NarrativeBlock }
  | { type: "session_started"; source: "ai_system"; content: { sceneId: string } }
  | { type: "intervention_opened" | "intervention_closed"; source: "ai_system"; content: { eventIds: string[] } }
  | { type: "intervention_triggered"; source: "ai_system"; content: { storyEventId: string; danmakuId: string } }
  | { type: "turn_committed"; source: "ai_system"; content: { turn: number; trust: number; memoriesAdded: number } });

export type TimelineEntry = TimelineEvent & {
  id: number;
  sequence: number;
  timestamp: string;
};

export class NarrativeTimeline {
  #entries: TimelineEntry[] = [];

  get nextId() { return this.#entries.length + 1; }

  append(event: TimelineEvent): void {
    const previous = this.#entries.at(-1);
    let cause = event.relatedDanmakuId ? this.#entries.findLast(
      (entry) => entry.type === "danmaku_submitted" && entry.content.id === event.relatedDanmakuId,
    ) : undefined;
    if (event.type === "scene_transition" || event.type === "session_completed") {
      cause = this.#entries.findLast((entry) =>
        entry.type === "narrative_block" && entry.content.kind === "clue" &&
        !!event.relatedClueIds?.includes(entry.content.clueId),
      ) ?? this.#entries.findLast((entry) =>
        entry.type === "scene_transition" || entry.type === "session_started",
      );
    } else if (event.type === "narrative_block" && event.content.kind === "narration" &&
        (previous?.type === "scene_transition" || previous?.type === "session_started")) {
      cause = previous;
    }
    const parent = event.causedBy ?? cause?.id;
    if (parent !== undefined && (!Number.isSafeInteger(parent) || parent < 1 || parent >= this.nextId)) {
      throw new Error("Timeline parent must already exist");
    }
    this.#entries.push({
      sceneId: previous?.sceneId,
      ...structuredClone(event),
      causedBy: parent,
      id: this.nextId,
      sequence: this.#entries.length + 1,
      timestamp: new Date().toISOString(),
    });
  }

  snapshot(): TimelineEntry[] {
    return structuredClone(this.#entries);
  }
}
