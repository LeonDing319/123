// Pixel-art drawing for the six fixed security cameras.
// The room art follows the original camera sketches; figures are drawn live on top of it.

export const CAMERA_WIDTH = 320;
export const CAMERA_HEIGHT = 176;

export const palette = [
  "#101b19", "#1b2c24", "#293c30", "#364b39", "#465c43",
  "#5b7251", "#728764", "#8e9e77", "#abb48b", "#ced1a3",
];

type Ctx = CanvasRenderingContext2D;
type Point = [number, number];

// Scanline polygon fill keeps every edge on whole pixels, so the limited palette stays crisp.
export function fillPoly(ctx: Ctx, points: Point[], color: string) {
  const ys = points.map(([, y]) => y);
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const bottom = Math.min(CAMERA_HEIGHT - 1, Math.ceil(Math.max(...ys)));
  ctx.fillStyle = color;
  for (let y = top; y <= bottom; y++) {
    const row = y + 0.5;
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= row && y2 > row) || (y2 <= row && y1 > row)) {
        hits.push(x1 + ((row - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const from = Math.round(hits[i]);
      const to = Math.round(hits[i + 1]);
      if (to > from) ctx.fillRect(from, y, to - from, 1);
    }
  }
}

function drawLine(ctx: Ctx, points: Point[], color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i + 1 < points.length; i++) {
    let [x0, y0] = points[i].map(Math.round);
    const [x1, y1] = points[i + 1].map(Math.round);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

export function drawRoom(ctx: Ctx, scene: number) {
  const box = (x: number, y: number, w: number, h: number, c: number) => {
    ctx.fillStyle = palette[c];
    ctx.fillRect(x, y, w, h);
  };
  const poly = (pts: Point[], c: number) => fillPoly(ctx, pts, palette[c]);
  const line = (pts: Point[], c: number) => drawLine(ctx, pts, palette[c]);

  box(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT, 2);
  // Back wall, floor tiles and ceiling light wells share a single vanishing point.
  poly([[0, 0], [77, 27], [254, 27], [320, 0]], 2);
  poly([[77, 27], [254, 27], [254, 99], [77, 99]], 4);
  poly([[0, 0], [77, 27], [77, 99], [0, 150]], 3);
  poly([[320, 0], [254, 27], [254, 99], [320, 150]], 2);
  poly([[0, 150], [77, 99], [254, 99], [320, 150], [320, 176], [0, 176]], 4);
  for (let x = -360; x <= 700; x += 60) line([[158 + Math.floor((x - 158) / 6), 99], [x, 176]], 3);
  for (const y of [105, 115, 130, 154]) line([[0, y], [320, y]], 3);
  for (const y of [29, 95, 98]) line([[77, y], [254, y]], 2);
  for (const x of [119, 159, 198, 236]) line([[x, 29], [x, 94]], 3);
  for (const x of [108, 178]) poly([[x, 14], [x + 39, 14], [x + 33, 18], [x + 6, 18]], 7);

  // Metal door frame and inset observation pane.
  const bx = scene === 6 ? 169 : 202;
  box(bx, 41, 31, 58, 1); box(bx + 2, 43, 27, 55, 3); box(bx + 7, 49, 15, 14, 1);
  box(bx + 8, 50, 13, 10, 5); box(bx + 22, 72, 3, 2, 7);

  const cabinet = (x: number, y: number, w: number, h: number) => {
    box(x + 3, y + 2, w, h, 1); box(x, y, w, h, 4);
    line([[x, y + h - 1], [x, y], [x + w - 1, y]], 6);
    for (let cy = y + 3; cy < y + h - 9; cy += 12) {
      box(x + 2, cy, w - 4, 10, 3); line([[x + 3, cy], [x + w - 4, cy]], 5);
      box(x + Math.floor(w / 2) - 3, cy + 3, 7, 2, 7);
    }
  };
  const desk = (x: number, y: number) => {
    poly([[x, y], [x + 48, y], [x + 62, y + 8], [x + 7, y + 8]], 6);
    box(x + 7, y + 9, 55, 4, 2); box(x + 8, y + 13, 3, 18, 1); box(x + 56, y + 13, 3, 18, 1);
  };

  if (scene === 1 || scene === 5) {
    for (const x of [80, 106, 132]) cabinet(x, 44, 24, 53);
    for (const x of [9, 38]) cabinet(x, 57, 27, 68);
    desk(108, 111);
    for (let i = 0; i < 4; i++) box(127 + i * 2, 112 + i, 11, 2, 8);
    if (scene === 5) {
      for (const [x, y] of [[181, 113], [199, 127], [177, 101]]) {
        box(x, y, 20, 13, 3); box(x, y, 20, 2, 6); box(x + 8, y + 2, 3, 8, 5);
      }
    }
  } else if (scene === 2 || scene === 4) {
    for (const x of [95, 135]) { box(x, 42, 23, 55, 1); box(x + 2, 44, 19, 52, 3); box(x + 5, 48, 13, 14, 5); }
    if (scene === 2) for (let j = 0; j < 6; j++) box(6 + j * 4, 145 - j * 6, 46, 4, 5);
  } else {
    desk(94, 84); box(106, 65, 28, 18, 1); box(108, 67, 24, 13, 5); box(117, 83, 5, 4, 2);
    if (scene === 3) { box(145, 40, 45, 28, 1); box(147, 42, 41, 24, 3); desk(12, 116); }
    else { desk(54, 111); cabinet(235, 51, 17, 45); }
  }
}

export type Pose = "stand" | "read" | "phone" | "crouch" | "listen" | "knife" | "down";

export type FigureLook = {
  body: number;
  face: number;
  arm: number;
  flashlight?: boolean;
};

export const protagonistLook: FigureLook = { body: 1, face: 5, arm: 5 };
export const pursuerLook: FigureLook = { body: 0, face: 4, arm: 3, flashlight: true };

// Draws one figure with its feet at (fx, fy). `step` drives the walking cycle, `face` mirrors it.
export function drawFigure(ctx: Ctx, opts: {
  fx: number; fy: number; face: 1 | -1; pose: Pose; step: number; walking: boolean; look: FigureLook; tick: number;
}) {
  const { fx, fy, face, pose, step, walking, look, tick } = opts;
  const s = Math.min(1.2, Math.max(0.7, 0.7 + ((fy - 100) / 76) * 0.5));
  const p = (dx: number, dy: number): Point => [fx + dx * s * face, fy + dy * s];
  const poly = (pts: Point[], c: number | string) => fillPoly(ctx, pts, typeof c === "number" ? palette[c] : c);
  const rect = (dx: number, dy: number, w: number, h: number, c: number | string) =>
    poly([p(dx, dy), p(dx + w, dy), p(dx + w, dy + h), p(dx, dy + h)], c);
  const line = (pts: Point[], c: number) => drawLine(ctx, pts.map(([dx, dy]) => p(dx, dy)), palette[c]);

  // Floor shadow.
  poly([p(-6, -1), p(6, 0), p(22, 4), p(6, 4)], 3);

  if (pose === "down") {
    rect(-14, -6, 24, 6, look.body);
    rect(10, -7, 7, 7, look.body);
    rect(13, -6, 3, 3, look.face);
    return;
  }

  const lift = pose === "crouch" ? 10 : 0;
  const lean = pose === "listen" ? 2 : 0;
  const head = -33 + lift;

  // Legs: a two-phase swing while walking, folded when crouching.
  const swing = walking ? Math.round(Math.sin(step) * 2) : 0;
  if (pose === "crouch") {
    rect(-5, -6, 4, 6, look.body);
    rect(1, -5, 4, 5, look.body);
  } else {
    rect(-4 + swing, -11, 3, walking && swing > 0 ? 10 : 11, look.body);
    rect(2 - swing, -11, 3, walking && swing < 0 ? 10 : 11, look.body);
  }

  // Torso and head.
  poly([p(-4 + lean, head + 7), p(3 + lean, head + 7), p(7, -11 + (lift ? 5 : 0)), p(-7, -11 + (lift ? 5 : 0))], look.body);
  rect(-4 + lean * 1.5, head, 8, 8, look.body);
  rect(2 + lean * 1.5, head + 2, 3, 4, look.face);

  // Arm and whatever the hand is doing.
  const shoulder: Point = [3 + lean, head + 10];
  const idleWave = walking ? 0 : (tick % 2);
  if (pose === "read" || pose === "phone") {
    line([shoulder, [8, head + 13], [10, head + 9]], look.arm);
    rect(9, head + 6, pose === "phone" ? 3 : 5, pose === "phone" ? 4 : 6, pose === "phone" ? 9 : 8);
  } else if (pose === "knife") {
    line([shoulder, [10, head + 12], [14, head + 12]], look.arm);
    line([[15, head + 12], [19, head + 11]], 9);
  } else if (pose === "listen") {
    line([shoulder, [8, head + 8], [8, head + 5]], look.arm);
  } else {
    line([shoulder, [7, head + 14], [10, head + 12 + idleWave]], look.arm);
  }

  if (look.flashlight && pose !== "crouch") {
    rect(9, head + 9, 6, 4, 6);
    rect(14, head + 8, 2, 6, 8);
  }
}

// The flashlight cone is the one translucent element; it sweeps slowly and flickers.
export function drawFlashlight(ctx: Ctx, fx: number, fy: number, face: 1 | -1, time: number) {
  const s = Math.min(1.2, Math.max(0.7, 0.7 + ((fy - 100) / 76) * 0.5));
  const hx = fx + 16 * s * face;
  const hy = fy - 22 * s;
  const sweep = Math.sin(time / 1300) * 14;
  const flicker = Math.sin(time / 90) > 0.93 ? 0.02 : 0;
  ctx.save();
  // Three overlapping cones of growing length make the beam fade out with distance.
  for (const length of [60, 110, 160]) {
    const k = length / 160;
    ctx.globalAlpha = 0.05 + flicker;
    fillPoly(ctx, [
      [hx, hy - 2],
      [hx + length * face, hy + (fy - 40 + sweep - hy) * k],
      [hx + length * face, hy + (fy + 22 + sweep - hy) * k],
      [hx, hy + 2],
    ], palette[9]);
  }
  ctx.restore();
}

// Seated duty officer behind the lobby desk in the last scene.
export function drawSeatedGuard(ctx: Ctx, tick: number) {
  const x = 84, top = 92;
  fillPoly(ctx, [[x - 5, top + 8], [x + 5, top + 8], [x + 8, 111], [x - 8, 111]], palette[2]);
  ctx.fillStyle = palette[2]; ctx.fillRect(x - 4, top, 8, 8);
  ctx.fillStyle = palette[6]; ctx.fillRect(x - 2 + (tick % 8 < 4 ? 0 : 1), top + 2, 3, 3);
}

// Live sensor noise, an occasional horizontal tear and a slow rolling band.
export function drawInterference(ctx: Ctx, time: number, random: () => number) {
  ctx.fillStyle = palette[3];
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(random() * CAMERA_WIDTH);
    const y = 100 + Math.floor(random() * 76);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = palette[8];
  for (let i = 0; i < 28; i++) {
    ctx.fillRect(Math.floor(random() * CAMERA_WIDTH), Math.floor(random() * CAMERA_HEIGHT), 1, 1);
  }
  const band = Math.floor((time / 40) % (CAMERA_HEIGHT + 40)) - 20;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = palette[9];
  ctx.fillRect(0, band, CAMERA_WIDTH, 6);
  ctx.restore();
  if (random() < 0.018) {
    const y = Math.floor(random() * CAMERA_HEIGHT);
    const h = 2 + Math.floor(random() * 6);
    const shift = (random() < 0.5 ? -1 : 1) * (3 + Math.floor(random() * 8));
    ctx.drawImage(ctx.canvas, 0, y, CAMERA_WIDTH, h, shift, y, CAMERA_WIDTH, h);
  }
}
