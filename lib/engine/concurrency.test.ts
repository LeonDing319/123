import assert from "node:assert/strict";
import { test } from "node:test";
import { mockAgent } from "../agent/mock-agent.ts";
import { loadStoryPack } from "../skills/skill-loader.ts";
import { startSession } from "./narrative-engine.ts";

const pack = await loadStoryPack("demo-story");
const action = { kind: "intervention", text: "比对蓝线" } as const;

test("new arrivals invalidate in-flight proposals, retry processes the entire FIFO exactly once", async () => {
  let release!: () => void;
  let calls = 0;
  const session = startSession(pack, async input => {
    if (++calls === 1) await new Promise<void>(resolve => { release = resolve; });
    return mockAgent(input);
  });
  const first = session.submitDanmaku(action, "first");
  session.advanceNarrative();
  const pending = session.processIntervention();
  await assert.rejects(session.processIntervention(), /already being processed/);
  const second = session.submitDanmaku({ kind: "advice", text: "看看" }, "second");
  release();
  await assert.rejects(pending, /Stale/);
  const snapshot = session.getSnapshot();
  assert.deepEqual(snapshot.pendingDanmaku, [first, second]);
  assert.equal(snapshot.state.turn, 0);
  const result = await session.processIntervention();
  assert.deepEqual(result.timeline.filter(entry =>
    entry.type === "narrative_block" && entry.content.kind === "decision",
  ).map(entry => entry.relatedDanmakuId), [first.id, second.id]);
  assert.deepEqual(session.submitDanmaku(action, "first"), first);
  assert.deepEqual(session.getSnapshot(), result);
  assert.throws(() => session.submitDanmaku({ ...action, text: "看看" }, "first"), /conflict/);
});

test("nested context is frozen and caller-owned snapshot mutations stay isolated", async () => {
  const session = startSession(pack, async input => {
    assert.throws(() => input.scene.transitions[0].requiresClueIds.pop(), TypeError);
    assert.throws(() => input.availableEvents[0].revealsClueIds.pop(), TypeError);
    assert.throws(() => { input.danmaku[0].text = "changed"; }, TypeError);
    return mockAgent(input);
  });
  session.submitDanmaku(action);
  session.advanceNarrative().state.knownFactIds.push("invented");
  const { state } = await session.processIntervention();
  assert.ok(!state.knownFactIds.includes("invented"));
  assert.deepEqual(state.discoveredClueIds, ["clue-blue-thread"]);
});
