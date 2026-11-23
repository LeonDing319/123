import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ReaderView } from "../../lib/reader/reader-session";
import type { NarrativeBlock } from "../../lib/engine/narrative-block";
import { formatTime, StudyFeed } from "./study-feed";

type Entry = ReaderView["entries"][number];
type Clue = Extract<NarrativeBlock, { kind: "clue" }>;

const decisions = {
  accept: "接受", reject: "拒绝", question: "质疑", infer: "推测", defer: "暂缓",
};

const followThreshold = 48;

function isTurnReply(entry: Entry) {
  // The Timeline links scene openings to session start or scene transition.
  return entry.type === "narrative_block" && entry.content.kind === "narration" && entry.causedBy === undefined;
}

export function getReaderRecords(view?: ReaderView) {
  const entries = view?.entries ?? [];
  const clues: Clue[] = [];
  const story: Entry[] = [];
  const messages: Entry[] = [];
  for (const entry of entries) {
    if (entry.type === "danmaku_submitted" || isTurnReply(entry) ||
        (entry.type === "narrative_block" && ["decision", "ai_inference", "system_event"].includes(entry.content.kind))) {
      messages.push(entry);
    } else {
      story.push(entry);
      if (entry.type === "narrative_block" && entry.content.kind === "clue") clues.push(entry.content);
    }
  }
  return { clues, story, messages };
}

export function ScenePanel({ scene, sceneId, story, clues, status, error }: {
  scene?: string;
  sceneId?: string;
  story: Entry[];
  clues: Clue[];
  status: string;
  error?: ReactNode;
}) {
  const [showClues, setShowClues] = useState(false);
  return (
    <section className="reader-panel reader-scene-panel" aria-labelledby="reader-scene-title">
      <div className="reader-device reader-camera-device">
        <header className="reader-panel-head">
          <h2 id="reader-scene-title">{scene ? `${scene}监视画面` : "场景监视画面"}</h2>
          <span className="reader-meta">CAM {sceneId?.match(/^s(\d+)$/)?.[1] ?? "01"}</span>
        </header>
        <StudyFeed sceneId={sceneId} scene={scene} timestamp={story[0]?.timestamp} />
        <div className="reader-device-foot" aria-hidden="true" />
      </div>
      <article className="reader-story" aria-label="剧情记录">
        <h2 className="reader-paper-title">现场记录</h2>
        <div className="reader-scroll reader-story-log" role="log" tabIndex={0} aria-label="曲别针的剧情">
          {story.map(entry => {
            if (entry.type === "autonomous_action_executed") return <p key={entry.id}>{entry.content.result}</p>;
            if (entry.type === "session_completed") return <p className="reader-signal" key={entry.id}>结局 · {entry.content.title}</p>;
            if (entry.type !== "narrative_block") return null;
            const block = entry.content;
            if (block.kind === "visual") return <img key={entry.id} src={block.src} alt={block.alt} />;
            if ("text" in block) return <p key={entry.id}>{block.text}</p>;
            return null;
          })}
          {error}
        </div>
        <footer className="reader-scene-footer">
          <div className="reader-scene-actions">
            <span className="reader-meta reader-signal" role="status">{status}</span>
            <button
              type="button"
              className="reader-clue-button"
              aria-expanded={showClues}
              aria-controls="reader-clue-note"
              disabled={!clues.length}
              onClick={() => setShowClues(open => !open)}
            >
              查看线索{clues.length > 0 && ` · ${clues.length} 件`}
            </button>
          </div>
          <div id="reader-clue-note" className="reader-scroll reader-clue-note" role="region" aria-label="记录摘录" tabIndex={0} hidden={!showClues || !clues.length}>
            <strong>记录摘录</strong>
            {clues.map(clue => <p key={clue.clueId}>{clue.text}</p>)}
          </div>
        </footer>
      </article>
    </section>
  );
}

export function DanmakuPanel({ messages, character, input, complete }: {
  messages: Entry[];
  character?: string;
  input: ReactNode;
  complete: boolean;
}) {
  const [pauseAt, setPauseAt] = useState<number | null>(null);
  const paused = pauseAt !== null;
  const visible = paused ? messages.filter(entry => entry.sequence <= pauseAt) : messages;
  const log = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const latestSequence = visible.at(-1)?.sequence;

  useLayoutEffect(() => {
    const viewport = log.current;
    if (viewport && followLatest.current) viewport.scrollTop = viewport.scrollHeight;
  }, [latestSequence]);

  return (
    <section className="reader-panel reader-device reader-terminal" aria-labelledby="reader-danmaku-title">
      <header className="reader-panel-head">
        <h2 id="reader-danmaku-title">弹幕记录</h2>
        <button
          type="button"
          aria-pressed={paused}
          aria-controls="reader-danmaku-log"
          onClick={() => setPauseAt(paused ? null : (messages.at(-1)?.sequence ?? 0))}
        >
          {paused ? "恢复弹幕" : "暂停弹幕"}
        </button>
      </header>
      <div
        ref={log}
        id="reader-danmaku-log"
        className="reader-scroll reader-danmaku-log"
        role="log"
        aria-label="实时弹幕"
        tabIndex={0}
        onScroll={({ currentTarget }) => {
          const { scrollHeight, scrollTop, clientHeight } = currentTarget;
          followLatest.current = scrollHeight - scrollTop - clientHeight <= followThreshold;
        }}
      >
        {visible.length === 0 ? <p className="reader-empty">暂无弹幕。</p> : (
          <ol className="reader-list">
            {visible.map(entry => <DanmakuRecord key={entry.id} entry={entry} character={character} />)}
          </ol>
        )}
      </div>
      <footer className="reader-danmaku-footer">
        {input}
        <div className="reader-bar">
          <span className="reader-meta reader-signal" role="status">
            {paused ? "显示已暂停" : complete ? "接收结束" : "接收中"}
          </span>
        </div>
      </footer>
    </section>
  );
}

function DanmakuRecord({ entry, character }: { entry: Entry; character?: string }) {
  const time = <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>;
  if (entry.type === "danmaku_submitted") {
    return <li><div className="reader-meta">{time} · 你</div><p>{entry.content.text}</p></li>;
  }
  if (entry.type !== "narrative_block") return null;
  const block = entry.content;
  if (block.kind === "decision") {
    // The Timeline follows an inference decision with a separate inference block.
    if (block.decision === "infer") return null;
    return (
      <li>
        <div className="reader-meta">
          {time} · {character} · <span className={block.decision === "reject" ? "reader-fault" : "reader-signal"}>{decisions[block.decision]}</span>
        </div>
        <p>{block.reason}</p>
      </li>
    );
  }
  if (block.kind === "ai_inference" || block.kind === "system_event" || block.kind === "narration") {
    const sender = block.kind === "ai_inference" ? `${character} · AI 推测`
      : block.kind === "narration" ? character : "系统反馈";
    return (
      <li>
        <div className="reader-meta">
          {time} · <span className="reader-signal">{sender}</span>
        </div>
        <p>{block.text}</p>
      </li>
    );
  }
  return null;
}

export function CluePanel({ clues }: { clues: Clue[] }) {
  return (
    <section className="reader-panel" aria-labelledby="reader-clues-title">
      <header className="reader-panel-head">
        <h2 id="reader-clues-title">已发现线索</h2>
        <span className="reader-meta reader-evidence" aria-live="polite">{clues.length} 件</span>
      </header>
      {clues.length === 0 ? <p className="reader-empty">暂无线索。</p> : (
        <ol className="reader-list reader-scroll reader-clue-list" aria-label="线索记录" tabIndex={0}>
          {clues.map((clue, index) => (
            <li key={clue.clueId}>
              <span className="reader-meta reader-evidence">线索 {String(index + 1).padStart(2, "0")}</span>
              <p>{clue.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
