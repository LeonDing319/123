import type { AgentTurnOutput, Danmaku } from "../schemas/agent-protocol.ts";
import type { StoryEvent, StoryScene } from "../schemas/story-pack.ts";
import type { GameState } from "../state/game-state.ts";

export type NarrativeAgentInput = {
  characterName: string;
  state: GameState;
  scene: StoryScene;
  danmaku: Danmaku[];
  availableEvents: StoryEvent[];
};

export type AutonomousAgentInput = Omit<NarrativeAgentInput, "danmaku" | "availableEvents"> & {
  availableEvents: Extract<StoryEvent, { trigger: "autonomous" }>[];
};

export type NarrativeAgent = ((input: NarrativeAgentInput, signal?: AbortSignal) => Promise<AgentTurnOutput>) & {
  chooseAutonomousAction?: (input: AutonomousAgentInput, signal?: AbortSignal) => Promise<unknown>;
};

// Demo vocabulary belongs to the replaceable agent. The engine only uses pack IDs and rules.
const demoActions = new Map([
  ["event-compare-thread", /(?:比对|比较|核对).*(?:蓝线|捆扎线)/u],
  ["event-check-plan", /(?:查看|翻看|检查).*(?:图纸背面|图纸反面)/u],
  ["event-review-log", /(?:核对|查看|检查).*(?:维修时间|维修记录|维修簿)/u],
]);

export const mockAgent: NarrativeAgent = async ({ characterName, danmaku, availableEvents }) => {
  const proposedEvents: AgentTurnOutput["proposedEvents"] = [];
  const danmakuDecisions = danmaku.map((message): AgentTurnOutput["danmakuDecisions"][number] => {
    const { id: danmakuId, kind, text } = message;

    if (/(?:一定|肯定|断定|显然)/u.test(text) || kind === "information") {
      return { danmakuId, decision: "reject", reason: "这个判断缺少可核对的证据。" };
    }
    if (/^(?:看看|想想|查一下|找找|怎么办|再看看)[。！？?!]?$/u.test(text)) {
      return { danmakuId, decision: "defer", reason: "你想让我具体检查哪一处？" };
    }

    const event = availableEvents.find(({ id }) => demoActions.get(id)?.test(text));
    if (kind === "intervention" && event) {
      if (proposedEvents.some(({ storyEventId }) => storyEventId === event.id)) {
        return { danmakuId, decision: "defer", reason: "这项检查已安排，我先核对手边的证据。" };
      }
      proposedEvents.push({ storyEventId: event.id, danmakuId });
      return { danmakuId, decision: "accept", reason: "这项建议能用现场材料核实，值得检查。" };
    }

    return { danmakuId, decision: "reject", reason: "这里无法执行这项行动，我先查看眼前的材料。" };
  });

  return {
    narration: proposedEvents.length
      ? `${characterName}按建议着手核对现场的材料。`
      : `${characterName}继续观察现场，把还需要核对的问题记了下来。`,
    danmakuDecisions,
    proposedEvents,
    nextStep: { kind: "stay" },
    memories: [],
    trustDelta: Math.min(100, proposedEvents.length * 5),
  };
};

mockAgent.chooseAutonomousAction = async ({ availableEvents }) => ({ actionId: availableEvents[0].id });
