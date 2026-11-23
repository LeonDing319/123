import assert from "node:assert/strict";
import { test } from "node:test";
import { startSession } from "../engine/narrative-engine.ts";
import { createMockProvider } from "../providers/mock-provider.ts";
import { ProviderRegistry } from "../providers/provider-registry.ts";
import { storyPackSchema } from "../schemas/story-pack.ts";
import { createNarrativeAgent } from "./narrative-agent.ts";
import { mockAgent } from "./mock-agent.ts";

const sceneId = "study";
const makePack = () => storyPackSchema.parse({
  manifest: { schemaVersion: 1, id: "autonomous-demo", title: "自主调查", entrySceneId: sceneId,
    character: { id: "investigator", name: "调查员", initialTrust: 40, knownFactIds: [] } },
  skillMarkdown: "调查", characterMarkdown: "先检查线索。", worldMarkdown: "一间书房。",
  facts: [{ id: "fact-label", description: "标签写有编号。" }],
  scenes: [{ id: sceneId, title: "书房", opening: "桌上有一只信封。", goal: "确认信封编号", transitions: [] }],
  clues: [
    { id: "clue-envelope", sceneId, description: "信封上有标签。", factIds: [] },
    { id: "clue-label", sceneId, description: "标签上写有编号。", factIds: ["fact-label"] },
  ],
  events: [
    { id: "inspect", sceneId, trigger: "autonomous", description: "检查信封", result: "调查员查看了信封。",
      requiresClueIds: [], revealsClueIds: ["clue-envelope"] },
    { id: "read-label", sceneId, trigger: "autonomous", description: "核对标签", result: "调查员核对了标签。",
      requiresClueIds: ["clue-envelope"], revealsClueIds: ["clue-label"] },
  ],
  endings: [{ id: "finished", priority: 1, sceneId, title: "结束", requiresClueIds: ["clue-label"],
    excludesClueIds: [], narrativeGoal: "完成调查。" }],
});

function setup(story = makePack(), reply: (context: {
  scene: { goal: string }; playerInput: { id: string }[]; availableActions: { id: string; description: string }[];
}) => object = context => ({ actionId: context.availableActions[0].id })) {
  const registry = new ProviderRegistry();
  let calls = 0;
  registry.register(createMockProvider("mock-autonomous", true, ({ messages }) => {
    calls++;
    const context = JSON.parse(messages[1].content);
    if (context.playerInput.length === 0) assert.match(messages[0].content, /只能提出行动意图/);
    return JSON.stringify(reply(context));
  }));
  return { session: startSession(story, createNarrativeAgent(story, registry)), calls: () => calls };
}

test("chooses one action without danmaku and commits authored results and causal links", async () => {
  const { session, calls } = setup(makePack(), context => {
    assert.equal(context.scene.goal, "确认信封编号");
    assert.deepEqual(context.playerInput, []);
    assert.deepEqual(context.availableActions, [{ id: "inspect", description: "检查信封" }]);
    return { actionId: "inspect" };
  });
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "executed", actionId: "inspect" });
  const { state, timeline, pendingDanmaku } = session.getSnapshot();
  assert.equal(calls(), 1);
  assert.equal(state.turn, 1);
  assert.deepEqual(pendingDanmaku, []);
  assert.deepEqual(state.discoveredClueIds, ["clue-envelope"]);
  assert.deepEqual(state.knownFactIds, []);
  assert.equal(state.eventHistory[0].danmakuId, undefined);
  const [proposal, executed, clue] = timeline.slice(-4);
  assert.equal(proposal.type, "autonomous_action_proposed");
  assert.equal(executed.type, "autonomous_action_executed");
  assert.deepEqual(executed.content, { actionId: "inspect", result: "调查员查看了信封。" });
  assert.equal(executed.causedBy, proposal.id);
  assert.equal(clue.causedBy, executed.id);
  assert.deepEqual(clue.relatedClueIds, ["clue-envelope"]);
  assert.ok([proposal, executed, clue].every(entry => entry.source === "protagonist"));
});

for (const [name, reply, error] of [
  ["unknown action", { actionId: "invented" }, /not eligible/],
  ["locked action", { actionId: "read-label" }, /not eligible/],
  ["fabricated observation", { actionId: "inspect", result: "听到脚步。", clueId: "invented" }, /Unrecognized key/],
  ["unknown clue from authored action", { actionId: "inspect" }, /Unknown clue/],
] as const) {
  test(name + " is rejected without a partial commit", async () => {
    const story = makePack();
    if (name.startsWith("unknown clue")) story.events[0].revealsClueIds.push("missing");
    const { session } = setup(story, () => reply);
    const before = session.getSnapshot();
    await assert.rejects(session.advanceAutonomousStep(), error);
    assert.deepEqual(session.getSnapshot(), before);
  });
}

test("two calls perform two actions, then completion prevents further calls to the model", async () => {
  const { session, calls } = setup();
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "executed", actionId: "inspect" });
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "executed", actionId: "read-label" });
  assert.deepEqual(session.getSnapshot().state.knownFactIds, ["fact-label"]);
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "completed" });
  const completed = session.getSnapshot();
  assert.equal(completed.state.endingId, "finished");
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "completed" });
  assert.deepEqual(session.getSnapshot(), completed);
  assert.equal(calls(), 2);
});

test("unlocking an intervention pauses autonomous progress until player processing", async () => {
  const story = makePack();
  story.events.push({ id: "player-check", sceneId, trigger: "danmaku-intervention", description: "等待玩家确认。",
    requiresClueIds: ["clue-envelope"], revealsClueIds: [] });
  const { session, calls } = setup(story, context => {
    const player = context.playerInput[0];
    const actionId = context.availableActions[0].id;
    if (!player) return { actionId };
    return {
      narration: "收到确认。", danmakuDecisions: [{ danmakuId: player.id, decision: "accept", reason: "确认继续。" }],
      proposedEvents: [{ storyEventId: actionId, danmakuId: player.id }],
      nextStep: { kind: "stay" }, memories: [], trustDelta: 0,
    };
  });
  await session.advanceAutonomousStep();
  const waiting = session.getSnapshot();
  assert.deepEqual(waiting.openEventIds, ["player-check"]);
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "waiting_for_player" });
  assert.deepEqual(session.getSnapshot(), waiting);
  assert.equal(calls(), 1);
  session.submitDanmaku({ kind: "intervention", text: "确认继续。" });
  await session.processIntervention();
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "executed", actionId: "read-label" });
  assert.equal(calls(), 3);
});

test("no legal action returns immediately without asking the model", async () => {
  const story = makePack();
  story.events.shift();
  const { session, calls } = setup(story);
  const before = session.getSnapshot();
  assert.deepEqual(await session.advanceAutonomousStep(), { status: "no_action" });
  assert.deepEqual(session.getSnapshot(), before);
  assert.equal(calls(), 0);
});

test("a new player message invalidates an in-flight autonomous choice", async () => {
  const agent = Object.assign(async (...args: Parameters<typeof mockAgent>) => mockAgent(...args), {
    chooseAutonomousAction: async () => ({ actionId: "inspect" }),
  });
  const session = startSession(makePack(), agent);
  const pending = session.advanceAutonomousStep();
  session.submitDanmaku({ kind: "advice", text: "等一下" });
  const before = session.getSnapshot();
  await assert.rejects(pending, /Stale autonomous step/);
  assert.deepEqual(session.getSnapshot(), before);
});
