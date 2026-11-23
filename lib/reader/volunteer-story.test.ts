import assert from "node:assert/strict";
import { test } from "node:test";
import { loadStoryPack } from "../skills/skill-loader.ts";
import { getReaderSession, readerView, startReaderSession, stepReader, submitReaderDanmaku } from "./reader-session.ts";

process.env.READER_STORY_PACK = "volunteer-17";
process.env.READER_LLM_PROVIDER = "mock";
const pack = await loadStoryPack("volunteer-17");

for (const [ending, conflict, trade, final] of [
  ["end-a", "e041", "e054", "e058"],
  ["end-b1", "e040", "e054", "e063"],
  ["end-b2", "e041", "e055", "e063"],
  ["end-c", "e041", "e053", "e066"],
]) {
  test(`Reader plays six scenes and resolves ${ending}`, async () => {
    const view = (await startReaderSession())!;
    const session = getReaderSession(view.id)!;
    const choices = ["e002", "e009", "e025", "e027", "e031", conflict, trade, final];
    const scenes = new Set<string>();
    for (let turn = 0; turn < 100; turn++) {
      const current = readerView(view.id, session);
      scenes.add(current.sceneId);
      if (current.mode === "completed") break;
      if (current.mode === "waiting_for_player") {
        const id = choices.shift();
        assert.ok(session.engine.getSnapshot().openEventIds.includes(id!), `Unexpected window: ${id}`);
        const event = pack.events.find(event => event.id === id)!;
        await submitReaderDanmaku(session, event.description.slice(0, 100), crypto.randomUUID());
      } else {
        assert.equal(current.mode, "advancing");
        await stepReader(session, current.revision);
      }
    }
    assert.equal(scenes.size, 6);
    assert.equal(choices.length, 0);
    assert.equal(session.engine.getSnapshot().state.endingId, ending);
  });
}
