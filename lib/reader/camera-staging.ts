// Stage directions for the security camera: where each character stands after a story event.
// Coordinates are feet positions on the 320 x 176 camera image.
import type { Pose } from "./camera-scene.ts";

type Spot = [number, number];

export type ActorCue = {
  at: Spot;
  pose?: Pose;
  run?: boolean;
  exit?: boolean;
};

export type Cue = {
  qu: ActorCue;
  hei?: ActorCue;
};

type SceneStaging = {
  enterFrom: Spot;
  heiExit: Spot;
  opening: Cue;
  events: Record<string, Cue>;
};

const s1 = { desk: [150, 150], backCabinet: [94, 104], lowCabinet: [70, 134], door: [217, 104] } satisfies Record<string, Spot>;
const s2 = { office: [106, 103], storage: [146, 103], stairs: [34, 146], door: [217, 104], mid: [170, 132], hide: [86, 106] } satisfies Record<string, Spot>;
const s3 = { terminal: [120, 122], partition: [38, 156], door: [217, 104] } satisfies Record<string, Spot>;
const s4 = { lab: [146, 103], storeroom: [106, 103], quStand: [232, 132], heiStand: [118, 132] } satisfies Record<string, Spot>;
const s5 = { backCabinet: [120, 104], desk: [150, 150], door: [217, 104], heiDoor: [222, 112] } satisfies Record<string, Spot>;
const s6 = { duty: [120, 142], door: [184, 104], mid: [200, 134], heiDoor: [196, 112] } satisfies Record<string, Spot>;

const offRight: Spot = [345, 150];
const offLeft: Spot = [-25, 150];

export const staging: Record<string, SceneStaging> = {
  s01: {
    enterFrom: s1.desk,
    heiExit: s1.door,
    opening: { qu: { at: s1.desk, pose: "read" } },
    events: {
      e001: { qu: { at: s1.desk, pose: "read" } },
      e002: { qu: { at: s1.lowCabinet, pose: "crouch" } },
      e003: { qu: { at: s1.desk, pose: "read" } },
      e004: { qu: { at: s1.desk, pose: "phone" } },
      e005: { qu: { at: s1.desk, pose: "phone" } },
      e006: { qu: { at: s1.backCabinet, pose: "read" } },
      e007: { qu: { at: s1.door, pose: "listen" } },
      e008: { qu: { at: s1.door, exit: true } },
      "leave-now": { qu: { at: s1.door, exit: true } },
    },
  },
  s02: {
    enterFrom: s2.door,
    heiExit: offLeft,
    opening: { qu: { at: [196, 112] }, hei: { at: [40, 136] } },
    events: {
      e009: { qu: { at: s2.office, exit: true }, hei: { at: [60, 134] } },
      e010: { qu: { at: s2.hide, pose: "crouch" }, hei: { at: [150, 140] } },
      e011: { qu: { at: s2.stairs, run: true }, hei: { at: [120, 140] } },
      e012: { qu: { at: s2.storage, exit: true }, hei: { at: [90, 138] } },
      e013: { qu: { at: s2.hide, pose: "crouch" }, hei: { at: s2.mid } },
      e014: { qu: { at: s2.hide, pose: "crouch" }, hei: { at: offRight, exit: true } },
      e015: { qu: { at: s2.hide, pose: "read" } },
      e016: { qu: { at: s2.stairs, run: true }, hei: { at: [150, 136], run: true } },
      e017: { qu: { at: s2.stairs, pose: "phone" } },
      e018: { qu: { at: s2.stairs, pose: "listen" } },
      e019: { qu: { at: offLeft, run: true, exit: true } },
      e020: { qu: { at: offLeft, exit: true } },
    },
  },
  s03: {
    enterFrom: s3.door,
    heiExit: s3.door,
    opening: { qu: { at: s3.terminal } },
    events: {
      e021: { qu: { at: s3.terminal, pose: "read" } },
      e022: { qu: { at: s3.terminal, pose: "read" } },
      e023: { qu: { at: s3.terminal, pose: "read" } },
      e024: { qu: { at: s3.terminal, pose: "read" } },
      e025: { qu: { at: s3.terminal, pose: "read" } },
      "compare-after-memo": { qu: { at: s3.terminal, pose: "read" } },
      e026: { qu: { at: s3.partition, pose: "crouch", run: true }, hei: { at: [222, 108] } },
      e027: { qu: { at: s3.partition, pose: "crouch" }, hei: { at: [222, 108] } },
      e028: { qu: { at: s3.partition, pose: "crouch" }, hei: { at: [200, 116] } },
      e029: { qu: { at: offLeft, exit: true } },
    },
  },
  s04: {
    enterFrom: offRight,
    heiExit: offLeft,
    opening: { qu: { at: s4.quStand }, hei: { at: s4.heiStand } },
    events: {
      e030: { qu: { at: s4.quStand }, hei: { at: s4.heiStand } },
      e031: { qu: { at: s4.quStand }, hei: { at: s4.heiStand } },
      e032: { qu: { at: s4.quStand }, hei: { at: s4.heiStand } },
      e033: { qu: { at: [214, 132] }, hei: { at: s4.heiStand } },
      e034: { qu: { at: [276, 140], pose: "knife" }, hei: { at: [140, 132] } },
      e035: { qu: { at: s4.lab, pose: "crouch" }, hei: { at: [90, 140] } },
      e036: { qu: { at: s4.storeroom, exit: true }, hei: { at: [190, 140] } },
      e037: { qu: { at: [120, 108] }, hei: { at: [260, 146] } },
      e038: { qu: { at: offRight, run: true, exit: true }, hei: { at: [230, 138], run: true } },
      e039: { qu: { at: [178, 132], pose: "knife" }, hei: { at: s4.heiStand } },
      e040: { qu: { at: [140, 133], pose: "knife", run: true }, hei: { at: [124, 132] } },
      e041: { qu: { at: [262, 138] }, hei: { at: s4.heiStand } },
      e042: { qu: { at: offRight, exit: true }, hei: { at: [180, 136] } },
    },
  },
  s05: {
    enterFrom: s5.door,
    heiExit: s5.door,
    opening: { qu: { at: s5.backCabinet } },
    events: {
      e043: { qu: { at: s5.backCabinet, pose: "read" } },
      e044: { qu: { at: s5.desk, pose: "read" } },
      e045: { qu: { at: s5.desk, pose: "read" } },
      e046: { qu: { at: s5.desk, pose: "read" } },
      e047: { qu: { at: s5.desk, pose: "read" } },
      e048: { qu: { at: s5.desk, pose: "phone" } },
      e049: { qu: { at: [200, 120], pose: "listen" } },
      e050: { qu: { at: [160, 128] }, hei: { at: s5.heiDoor } },
      e051: { qu: { at: [160, 128] }, hei: { at: s5.heiDoor } },
      e052: { qu: { at: [160, 128] }, hei: { at: s5.heiDoor } },
      e053: { qu: { at: [178, 124] }, hei: { at: s5.heiDoor } },
      e054: { qu: { at: [130, 132] }, hei: { at: [206, 118] } },
      e055: { qu: { at: [190, 122], pose: "read" }, hei: { at: s5.heiDoor } },
      e056: { qu: { at: s5.door, exit: true } },
    },
  },
  s06: {
    enterFrom: offRight,
    heiExit: s6.door,
    opening: { qu: { at: s6.mid } },
    events: {
      e057: { qu: { at: [170, 132] } },
      e058: { qu: { at: s6.duty } },
      "request-witness": { qu: { at: s6.duty } },
      e059: { qu: { at: s6.duty, pose: "read" } },
      e060: { qu: { at: s6.duty, pose: "phone" } },
      e061: { qu: { at: s6.duty }, hei: { at: s6.heiDoor } },
      e062: { qu: { at: [150, 136] }, hei: { at: s6.heiDoor } },
      e063: { qu: { at: [184, 122], pose: "knife", run: true }, hei: { at: [198, 116] } },
      e064: { qu: { at: [150, 136] }, hei: { at: s6.heiDoor } },
      e065: { qu: { at: s6.duty, pose: "read" }, hei: { at: s6.heiDoor } },
      e066: { qu: { at: [182, 120] }, hei: { at: s6.heiDoor } },
      e067: { qu: { at: offRight, exit: true } },
      e068: { qu: { at: [170, 134] }, hei: { at: [198, 118], pose: "down" } },
      e069: { qu: { at: [170, 134] }, hei: { at: [198, 118], pose: "crouch" } },
    },
  },
};

// The latest cue for a scene: the most recent event with stage directions, or the scene opening.
export function cueFor(sceneId: string, eventIds: readonly string[]): Cue | undefined {
  const scene = staging[sceneId];
  if (!scene) return;
  for (let i = eventIds.length - 1; i >= 0; i--) {
    const cue = scene.events[eventIds[i]];
    if (cue) return cue;
  }
  return scene.opening;
}
