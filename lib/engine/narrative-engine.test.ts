import assert from "node:assert/strict";
import { test } from "node:test";
import { mockAgent } from "../agent/mock-agent.ts";
import { loadStoryPack } from "../skills/skill-loader.ts";
import { startSession } from "./narrative-engine.ts";
import { NarrativeTimeline } from "./narrative-timeline.ts";
import { storyPackSchema } from "../schemas/story-pack.ts";

const pack = await loadStoryPack("demo-story");

test("duplicate and missing ending priorities fail pack validation", () => {
  const story = structuredClone(pack);
  story.endings[1].priority = story.endings[0].priority;
  assert.throws(() => storyPackSchema.parse(story), /priorities must be unique/);
  assert.throws(() => startSession(story), /priorities must be unique/);
  assert.equal(storyPackSchema.safeParse({ ...story, endings: [{ ...story.endings[0], priority: undefined }] }).success, false);
});

test("timeline rejects missing, self and future parents without adding an entry", () => {
  const timeline = new NarrativeTimeline();
  const root = { type: "session_started", source: "ai_system", content: { sceneId: "hall" } } as const;
  timeline.append(root);
  for (const causedBy of [0, 2, 3, 1.5]) {
    assert.throws(() => timeline.append({ ...root, causedBy }), /parent/);
  }
  timeline.append({ ...root, causedBy: 1 });
  assert.deepEqual(timeline.snapshot().map(({ id, causedBy }) => [id, causedBy]), [[1, undefined], [2, 1]]);
});

test("one action is the direct parent of every clue it reveals", async () => {
  const story = structuredClone(pack);
  story.clues.push({ ...story.clues[0], id: "second-clue" });
  story.events[0].revealsClueIds.push("second-clue");
  const { timeline } = await investigate(startSession(story), "比对蓝线");
  const action = timeline.find((e) => e.type === "narrative_block" && e.content.kind === "character_action")!;
  const clues = timeline.filter((e) => e.type === "narrative_block" && e.content.kind === "clue");
  assert.deepEqual(clues.map((e) => e.causedBy), [action.id, action.id]);
});

test("timeout cannot commit a late proposal and the same batch can retry", async () => {
  let release!: () => void;
  let calls = 0;
  const session = startSession(pack, async (input) => {
    if (++calls === 1) await new Promise<void>((resolve) => { release = resolve; });
    return mockAgent(input);
  }, 20);
  session.submitDanmaku({ kind: "intervention", text: "比对蓝线" });
  const before = session.advanceNarrative();
  await assert.rejects(session.processIntervention(), /timed out/);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(session.getSnapshot(), before);
  assert.equal((await session.processIntervention()).state.turn, 1);
});

test("an agent mutating its input and proposing direct state writes cannot change the session", async () => {
  const session = startSession(pack, async (input) => {
    assert.throws(() => input.state.knownFactIds.push("invented-fact"), TypeError);
    return { ...await mockAgent(input), state: input.state };
  });
  session.submitDanmaku({ kind: "information", text: "看看" });
  const before = session.advanceNarrative();
  await assert.rejects(session.processIntervention(), /Unrecognized key/);
  assert.deepEqual(session.getSnapshot(), before);
});

async function investigate(session: ReturnType<typeof startSession>, text: string) {
  session.submitDanmaku({ kind: "intervention", text });
  session.advanceNarrative();
  return session.processIntervention();
}

async function reachStudy(story = pack) {
  const session = startSession(story);
  await investigate(session, "比对蓝线");
  assert.equal(session.advanceNarrative().state.currentSceneId, "scene-archive");
  await investigate(session, "查看图纸背面");
  assert.equal(session.advanceNarrative().state.currentSceneId, "scene-study");
  return session;
}

for (const [target, error] of [
  ["missing-scene", /Unknown scene/],
  ["scene-study", /No exit/],
  ["scene-archive", /Missing exit clues/],
] as const) {
  test(`rejects exit to ${target} atomically`, () => {
    const session = startSession(pack);
    session.submitDanmaku({ kind: "advice", text: "看看" });
    const before = session.advanceNarrative();
    assert.throws(() => session.transitionScene(target), error);
    assert.deepEqual(session.getSnapshot(), before);
  });
}

test("legal exit closes the open node and records destination narration", () => {
  const story = structuredClone(pack);
  story.scenes[0].transitions[0].requiresClueIds = [];
  const session = startSession(story);
  session.advanceNarrative();
  session.submitDanmaku({ kind: "advice", text: "看看" });
  const result = session.transitionScene("scene-archive");
  assert.deepEqual(result.openEventIds, []);
  assert.deepEqual(result.pendingDanmaku, []);
  assert.deepEqual(result.timeline.slice(-4).map(({ type }) => type),
    ["intervention_closed", "danmaku_expired", "scene_transition", "narrative_block"]);
  assert.equal(result.timeline.at(-1)?.sceneId, "scene-archive");
});

test("three-scene investigation with the maintenance log reaches the documented ending", async () => {
  const session = await reachStudy();
  await investigate(session, "核对维修时间");
  const result = session.advanceNarrative();
  assert.equal(result.state.endingId, "ending-documented");
  assert.equal(result.status, "completed");
  assert.equal(result.state.discoveredClueIds.length, 3);
});

test("three-scene investigation without the maintenance log reaches the unresolved ending", async () => {
  const session = await reachStudy();
  assert.equal(session.evaluateEnding(), "ending-unresolved");
  assert.equal(session.getSnapshot().timeline.at(-1)?.type, "session_completed");
});

test("highest priority eligible ending wins in either file order", async () => {
  const story = structuredClone(pack);
  story.endings[0].requiresClueIds = [];
  const expected = story.endings[0].id;
  story.endings.reverse();
  assert.equal((await reachStudy(story)).evaluateEnding(), expected);
  story.endings.reverse();
  assert.equal((await reachStudy(story)).evaluateEnding(), expected);
});

test("completion seals all session operations", async () => {
  const session = await reachStudy();
  session.evaluateEnding();
  const before = session.getSnapshot();
  assert.throws(() => session.submitDanmaku({ kind: "advice", text: "看看" }), /ended/);
  assert.throws(() => session.advanceNarrative(), /ended/);
  assert.throws(() => session.transitionScene("scene-study"), /ended/);
  assert.throws(() => session.evaluateEnding(), /ended/);
  await assert.rejects(session.processIntervention(), /ended/);
  assert.deepEqual(session.getSnapshot(), before);
});

test("timeline traces the exit to a clue, triggered event, decision and player message", async () => {
  const session = startSession(pack);
  await investigate(session, "比对蓝线");
  const { timeline } = session.advanceNarrative();
  const exit = timeline.find((entry) => entry.type === "scene_transition")!;
  const clue = timeline[exit.causedBy! - 1];
  const event = timeline[clue.causedBy! - 1];
  const decision = timeline[event.causedBy! - 1];
  const player = timeline[decision.causedBy! - 1];
  assert.deepEqual(clue.relatedClueIds, ["clue-blue-thread"]);
  assert.ok(event.type === "narrative_block" && event.content.kind === "character_action");
  assert.equal(decision.type === "narrative_block" && decision.content.kind, "decision");
  assert.equal(player.source, "player");
  assert.equal(player.relatedDanmakuId, clue.relatedDanmakuId);
  assert.equal(event.sceneId, "scene-hallway");
});

test("inference remains in the timeline and cannot change canonical facts or unlock an exit", async () => {
  const canonical = structuredClone(pack.facts);
  const session = startSession(pack);
  const before = session.getSnapshot().state;
  session.submitDanmaku({ kind: "information", text: "蓝线肯定来自书房" });
  session.advanceNarrative();
  const result = await session.processIntervention();
  assert.ok(result.timeline.some((e) => e.type === "narrative_block" && e.content.kind === "ai_inference"));
  assert.deepEqual(result.state.knownFactIds, before.knownFactIds);
  assert.deepEqual(result.state.discoveredClueIds, []);
  assert.deepEqual(pack.facts, canonical);
  assert.throws(() => session.transitionScene("scene-archive"), /Missing exit clues/);
});

test("unknown clue in an event aborts discovery", async () => {
  const story = structuredClone(pack);
  story.events[0].revealsClueIds.push("unknown-clue");
  const session = startSession(story);
  await assert.rejects(investigate(session, "比对蓝线"), /Unknown clue/);
  assert.deepEqual(session.getSnapshot().state.discoveredClueIds, []);
});

test("invented agent ending rolls back even after a valid clue proposal", async () => {
  const session = startSession(pack, async (input) => ({
    ...await mockAgent(input), nextStep: { kind: "end", endingId: "invented-ending" },
  }));
  session.submitDanmaku({ kind: "intervention", text: "比对蓝线" });
  const before = session.advanceNarrative();
  await assert.rejects(session.processIntervention(), /Invalid ending/);
  assert.deepEqual(session.getSnapshot(), before);
});

test("agent can use a clue discovered in the same turn to take a legal exit", async () => {
  const session = startSession(pack, async (input) => ({
    ...await mockAgent(input), nextStep: { kind: "transition", sceneId: "scene-archive" },
  }));
  const result = await investigate(session, "比对蓝线");
  assert.equal(result.state.currentSceneId, "scene-archive");
  assert.deepEqual(result.state.discoveredClueIds, ["clue-blue-thread"]);
});

for (const [delta, expected] of [[100, 100], [-100, 0]]) {
  test(`trust is clamped to ${expected}`, async () => {
    const session = startSession(pack, async (input) => ({ ...await mockAgent(input), trustDelta: delta }));
    assert.equal((await investigate(session, "比对蓝线")).state.trust, expected);
  });
}

test("starts in the entry scene and opens its intervention on advance", async () => {
  const session = startSession(pack);
  const initial = session.getSnapshot();
  assert.equal(initial.state.currentSceneId, "scene-hallway");
  assert.equal(initial.state.turn, 0);
  assert.equal(initial.state.trust, 45);
  assert.deepEqual(initial.state.knownFactIds, ["fact-clock-chimes"]);
  assert.deepEqual(initial.timeline.map(({ type }) => type), ["session_started", "narrative_block"]);

  const message = session.submitDanmaku({ kind: "intervention", text: "比对蓝线" });
  await assert.rejects(session.processIntervention(), /No intervention is open/);
  assert.deepEqual(session.getSnapshot().pendingDanmaku, [message]);
  assert.deepEqual(session.advanceNarrative().openEventIds, ["event-compare-thread"]);
});

test("processes four kinds of player input in submission order", async () => {
  const session = startSession(pack);
  const messages = [
    session.submitDanmaku({ kind: "information", text: "书房里一定有人" }),
    session.submitDanmaku({ kind: "intervention", text: "砸开窗户" }),
    session.submitDanmaku({ kind: "advice", text: "再看看" }),
    session.submitDanmaku({ kind: "intervention", text: "比对门边的蓝线和捆扎线" }),
  ];

  session.advanceNarrative();
  const result = await session.processIntervention();
  const decisions = result.timeline.flatMap((entry) =>
    entry.type === "narrative_block" && entry.content.kind === "decision" ? [entry.content] : [],
  );
  assert.deepEqual(decisions.map(({ danmakuId }) => danmakuId), messages.map(({ id }) => id));
  assert.deepEqual(decisions.map(({ decision }) => decision), ["reject", "reject", "defer", "accept"]);
  assert.ok(result.timeline.some((entry) =>
    entry.type === "narrative_block" && entry.content.kind === "ai_inference",
  ));
  assert.deepEqual(result.state.discoveredClueIds, ["clue-blue-thread"]);
  assert.deepEqual(result.state.knownFactIds, ["fact-clock-chimes", "fact-blue-ties"]);
  assert.equal(result.state.eventHistory[0].danmakuId, messages[3].id);
  assert.deepEqual(result.pendingDanmaku, []);
  assert.deepEqual(result.openEventIds, []);
  assert.equal(result.timeline.at(-1)?.type, "intervention_closed");
});

test("retains state, queue and timeline if an agent proposes an invalid event", async () => {
  const session = startSession(pack, async (input) => {
    const output = await mockAgent(input);
    output.proposedEvents.push({ storyEventId: "unknown-event", danmakuId: input.danmaku[0].id });
    return output;
  });
  session.submitDanmaku({ kind: "intervention", text: "比对蓝线" });
  const before = session.advanceNarrative();
  await assert.rejects(session.processIntervention(), /unknown-event/);
  assert.deepEqual(session.getSnapshot(), before);
});
