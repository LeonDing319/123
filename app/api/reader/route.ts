import { z } from "zod";
import { getReaderSession, readerView, startReaderSession, stepReader, submitReaderDanmaku } from "../../../lib/reader/reader-session.ts";

export const runtime = "nodejs";

const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start") }),
  z.strictObject({ action: z.literal("step"), id: z.uuid(), revision: z.int().nonnegative() }),
  z.strictObject({ action: z.literal("danmaku"), id: z.uuid(), requestId: z.uuid(), text: z.string().trim().min(1).max(500) }),
]);

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (origin && origin !== url.origin && origin !== `${url.protocol}//${host}`) {
    return json({ error: "请求来源无效。" }, 403);
  }

  const command = commandSchema.safeParse(await request.json().catch(() => undefined));
  if (!command.success) return json({ error: "请求无效。" }, 400);

  try {
    const input = command.data;
    if (input.action === "start") {
      const view = await startReaderSession();
      return view ? json(view) : json({ error: "会话已满，请稍后再试。" }, 503);
    }

    const session = getReaderSession(input.id);
    if (!session) return json({ error: "会话已失效，请重新开始。" }, 404);
    if (session.busy) return json({ error: "上一条操作尚未完成，请重试。" }, 409);

    session.busy = true;
    try {
      if (input.action === "step") await stepReader(session, input.revision);
      else await submitReaderDanmaku(session, input.text, input.requestId);
      return json(readerView(input.id, session));
    } finally {
      session.busy = false;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Request ID conflict") {
      return json({ error: "这条弹幕的请求编号已被使用。" }, 409);
    }
    console.error("Reader operation failed", error);
    return json({ error: "阅读器暂时无法继续，请重试。" }, 500);
  }
}
