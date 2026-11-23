"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ReaderView } from "../../lib/reader/reader-session";
import { CluePanel, DanmakuPanel, getReaderRecords, ScenePanel } from "./reader-panels";
import "./reader.css";

const readerStatus = {
  advancing: "自主推进中",
  waiting_for_player: "等待你的弹幕",
  no_action: "当前没有可推进的行动",
  completed: "故事已结束",
};

type Command =
  | { action: "start" }
  | { action: "step"; id: string; revision: number }
  | { action: "danmaku"; id: string; requestId: string; text: string };

export function StoryPreview({ onComplete }: { onComplete?: () => void }) {
  const [view, setView] = useState<ReaderView>();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ command: Command; message: string; expired: boolean }>();
  const started = useRef(false);
  const busy = useRef(false);

  const send = useCallback(async (command: Command) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure(undefined);
    let expired = false;
    try {
      const response = await fetch("/api/reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        expired = response.status === 404;
        const { error } = await response.json().catch(() => ({}));
        throw new Error(error || "阅读器暂时无法连接，请重试。");
      }
      const next: ReaderView = await response.json();
      setView(next);
      if (command.action === "danmaku") setText("");
    } catch (error) {
      setFailure({
        command,
        message: error instanceof TypeError ? "阅读器暂时无法连接，请重试。" : (error as Error).message,
        expired,
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send({ action: "start" });
  }, [send]);

  useEffect(() => {
    if (!view || view.mode !== "advancing" || pending || failure) return;
    const timer = window.setTimeout(() => {
      void send({ action: "step", id: view.id, revision: view.revision });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [view, pending, failure, send]);

  useEffect(() => {
    if (view?.mode === "completed") onComplete?.();
  }, [view?.mode, onComplete]);

  const canSend = view && (view.mode === "advancing" || view.mode === "waiting_for_player") && !pending && !failure;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || !text.trim()) return;
    void send({ action: "danmaku", id: view.id, text: text.trim(), requestId: crypto.randomUUID() });
  }

  const { story, messages, clues } = getReaderRecords(view);
  return (
    <main className="reader" aria-label={view?.title ?? "叙事记录"}>
      <div className="reader-layout">
        <ScenePanel
          key={view?.id}
          scene={view?.scene}
          sceneId={view?.sceneId}
          story={story}
          clues={clues}
          status={view ? readerStatus[view.mode] : failure ? "会话启动失败" : "正在开启故事…"}
          error={failure && (
            <div className="mt-4">
              <p className="reader-fault" role="alert">{failure.message}</p>
              <button type="button" onClick={() => void send(failure.expired ? { action: "start" } : failure.command)}>
                {failure.expired ? "重新开始" : "重试"}
              </button>
            </div>
          )}
        />
        <aside className="reader-side" aria-label="弹幕与线索">
          <DanmakuPanel
            key={view?.id}
            messages={messages}
            character={view?.character}
            complete={view?.mode === "completed"}
            input={
              <form className="reader-form" onSubmit={submit}>
                <input
                  aria-label="弹幕"
                  disabled={!view || view.mode === "completed" || view.mode === "no_action" || !!failure}
                  maxLength={500}
                  onChange={(event) => setText(event.target.value)}
                  readOnly={pending}
                  placeholder="给曲别针发一条弹幕"
                  value={text}
                />
                <button type="submit" disabled={!canSend || !text.trim()}>发送</button>
              </form>
            }
          />
          <CluePanel clues={clues} />
        </aside>
      </div>
    </main>
  );
}
