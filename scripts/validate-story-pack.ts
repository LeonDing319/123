import { loadStoryPack } from "../lib/skills/skill-loader.ts";

const packId = process.argv[2] ?? "demo-story";

try {
  const { manifest, facts, clues, scenes, events, endings } = await loadStoryPack(packId);
  console.log(`PASS ${manifest.id} — ${manifest.title}`);
  console.log("Ending priorities:", endings.map(({ id, priority }) => `${id}=${priority}`).join(", "));
  console.log(`Entry: ${manifest.entrySceneId} | Scenes: ${scenes.length} | Facts: ${facts.length} | Clues: ${clues.length} | Events: ${events.length} | Endings: ${endings.length}`);
} catch (error) {
  console.error(`FAIL ${packId}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
