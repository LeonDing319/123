"use client";

import { useEffect, useRef, useState } from "react";
import {
  CAMERA_HEIGHT, CAMERA_WIDTH, drawFigure, drawFlashlight, drawInterference, drawRoom, drawSeatedGuard,
  protagonistLook, pursuerLook, type Pose,
} from "../../lib/reader/camera-scene";
import { cueFor, staging, type ActorCue } from "../../lib/reader/camera-staging";

type Actor = {
  x: number; y: number;
  face: 1 | -1;
  step: number;
  visible: boolean;
  target?: ActorCue;
};

const WALK_SPEED = 24; // camera pixels per second
const RUN_SPEED = 54;
const FRAME_MS = 1000 / 12; // a low frame rate reads as security footage

function moveActor(actor: Actor, dt: number) {
  const target = actor.target;
  if (!actor.visible || !target) return false;
  const [tx, ty] = target.at;
  const dx = tx - actor.x, dy = ty - actor.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5) {
    if (target.exit) actor.visible = false;
    return false;
  }
  const travel = Math.min(distance, (target.run ? RUN_SPEED : WALK_SPEED) * dt);
  actor.x += (dx / distance) * travel;
  actor.y += (dy / distance) * travel;
  actor.step += travel * 0.45;
  if (Math.abs(dx) > 0.5) actor.face = dx > 0 ? 1 : -1;
  return true;
}

function poseOf(actor: Actor, walking: boolean): Pose {
  const pose = actor.target?.pose ?? "stand";
  if (!walking) return pose;
  return pose === "knife" ? "knife" : "stand";
}

export function CameraFeed({ sceneId, eventIds = [] }: { sceneId: string; eventIds?: readonly string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = useRef<{ scene: string; image: HTMLCanvasElement } | null>(null);
  const qu = useRef<Actor>({ x: 0, y: 0, face: 1, step: 0, visible: false });
  const hei = useRef<Actor>({ x: 0, y: 0, face: 1, step: 0, visible: false });
  const shownScene = useRef<string | null>(null);

  const scene = staging[sceneId];
  const cue = cueFor(sceneId, eventIds);
  const cueKey = JSON.stringify(cue);

  // Apply the newest stage directions whenever the story moves on.
  useEffect(() => {
    if (!scene || !cue) return;
    const firstShot = shownScene.current === null;
    if (shownScene.current !== sceneId) {
      shownScene.current = sceneId;
      const [x, y] = firstShot ? cue.qu.at : scene.enterFrom;
      Object.assign(qu.current, { x, y, step: 0, visible: true });
      hei.current.visible = false;
    }
    qu.current.target = cue.qu;
    qu.current.visible ||= !cue.qu.exit;

    const pursuer = hei.current;
    if (cue.hei) {
      if (!pursuer.visible) {
        const [x, y] = firstShot ? cue.hei.at : scene.heiExit;
        Object.assign(pursuer, { x, y, step: 0, visible: true, face: x < cue.qu.at[0] ? 1 : -1 });
      }
      pursuer.target = cue.hei;
    } else if (pursuer.visible) {
      pursuer.target = { at: scene.heiExit, exit: true };
    }
    // cueKey captures every field of the cue, so the effect reruns only when the directions change.
  }, [sceneId, cueKey]);

  useEffect(() => {
    const target = canvas.current;
    const ctx = target?.getContext("2d");
    if (!target || !ctx || !scene) return;
    const sceneNumber = Number(sceneId.slice(1));
    if (room.current?.scene !== sceneId) {
      const image = document.createElement("canvas");
      image.width = CAMERA_WIDTH;
      image.height = CAMERA_HEIGHT;
      drawRoom(image.getContext("2d")!, sceneNumber);
      room.current = { scene: sceneId, image };
    }
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();
    let sinceDraw = FRAME_MS;
    let tick = 0;

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const walkingQu = moveActor(qu.current, dt);
      const walkingHei = moveActor(hei.current, dt);
      sinceDraw += dt * 1000;
      if (sinceDraw >= FRAME_MS) {
        sinceDraw = 0;
        tick++;
        ctx.drawImage(room.current!.image, 0, 0);
        if (sceneNumber === 6) drawSeatedGuard(ctx, tick);

        const cast = [
          { actor: qu.current, walking: walkingQu, look: protagonistLook },
          { actor: hei.current, walking: walkingHei, look: pursuerLook },
        ].filter(({ actor }) => actor.visible).sort((a, b) => a.actor.y - b.actor.y);
        // Idle characters turn toward each other.
        if (cast.length === 2) {
          for (const [me, other] of [[cast[0], cast[1]], [cast[1], cast[0]]]) {
            if (!me.walking) me.actor.face = other.actor.x > me.actor.x ? 1 : -1;
          }
        }
        for (const { actor, walking, look } of cast) {
          const pose = poseOf(actor, walking);
          drawFigure(ctx, {
            fx: Math.round(actor.x), fy: Math.round(actor.y), face: actor.face,
            pose, step: actor.step, walking, look, tick,
          });
          if (look.flashlight && pose !== "down" && pose !== "crouch") {
            drawFlashlight(ctx, actor.x, actor.y, actor.face, now);
          }
        }
        if (!reduceMotion) drawInterference(ctx, now, Math.random);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [scene, sceneId]);

  return <canvas ref={canvas} className="camera-image" width={CAMERA_WIDTH} height={CAMERA_HEIGHT}
    role="img" aria-label="研究中心监控实时画面" />;
}

// In-fiction clock: the night shift starts at 21:30 when the page opens.
const shiftStart = typeof performance === "undefined" ? 0 : performance.now();
export function useShiftClock(withSeconds = true) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(performance.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const total = 21 * 3600 + 30 * 60 + Math.floor(((now ?? shiftStart) - shiftStart) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(Math.floor(total / 3600) % 24), mm = pad(Math.floor(total / 60) % 60), ss = pad(total % 60);
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}
