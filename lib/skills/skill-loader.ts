import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { idSchema } from "../schemas/common.ts";
import {
  storyPackManifestSchema,
  storyPackSchema,
  type StoryPack,
} from "../schemas/story-pack.ts";
import { validateStoryPackReferences } from "./validate-story-pack.ts";

/** Load a bundled pack in a Node.js server or CLI process. */
export async function loadStoryPack(packId: string): Promise<StoryPack> {
  const id = idSchema.parse(packId);
  let directory: string;
  try {
    const root = join(await realpath(process.cwd()), "content", "packs");
    if (relative(root, await realpath(root)) !== "") {
      throw new Error("content/packs must resolve inside the project at its expected path");
    }
    const candidate = join(root, id);
    directory = await realpath(candidate);
    if (relative(candidate, directory) !== "" || !(await lstat(candidate)).isDirectory()) {
      throw new Error("Pack must be a direct directory under content/packs");
    }
  } catch (cause) {
    throw new Error(`Cannot open story pack "${id}": ${errorMessage(cause)}`, { cause });
  }

  async function readText(file: string): Promise<string> {
    try {
      const candidate = join(directory, file);
      const canonical = await realpath(candidate);
      if (relative(candidate, canonical) !== "" || !(await lstat(candidate)).isFile()) {
        throw new Error("Expected a regular file inside the pack directory");
      }
      return (await readFile(canonical, "utf8")).replace(/^\uFEFF/, "");
    } catch (cause) {
      throw new Error(`Cannot read ${id}/${file}: ${errorMessage(cause)}`, { cause });
    }
  }

  async function readJson(file: string): Promise<unknown> {
    const content = await readText(file);
    try {
      return JSON.parse(content);
    } catch (cause) {
      throw new Error(`Invalid JSON in ${id}/${file}: ${errorMessage(cause)}`, { cause });
    }
  }

  const manifest = storyPackManifestSchema.parse(await readJson("manifest.json"));
  if (manifest.id !== id) {
    throw new Error(`manifest.json.id "${manifest.id}" must match directory "${id}"`);
  }

  const [skillMarkdown, characterMarkdown, worldMarkdown, facts, clues, scenes, events, endings] =
    await Promise.all([
      readText("SKILL.md"),
      readText("character.md"),
      readText("world.md"),
      readJson("facts.json"),
      readJson("clues.json"),
      readJson("scenes.json"),
      readJson("events.json"),
      readJson("endings.json"),
    ]);

  const pack = storyPackSchema.parse({
    manifest, skillMarkdown, characterMarkdown, worldMarkdown, facts, clues, scenes, events, endings,
  });
  validateStoryPackReferences(pack);
  return pack;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
