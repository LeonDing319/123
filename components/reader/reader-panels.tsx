import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ReaderView } from "../../lib/reader/reader-session";
import type { NarrativeBlock } from "../../lib/engine/narrative-block";
import { formatTime, StudyFeed } from "./study-feed";

type Entry = ReaderView["entries"][number];
type Clue = Extract<NarrativeBlock, { kind: "clue" }>;

const decisions = {
  accept: "接受", reject: "拒绝", question: "质疑", infer: "推测", defer: "暂缓",
};

const followThreshold = 48;
const typeCharsPerTick = 2;
const typeTickMs = 45;

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

type StoryLine =
  | { id: number; kind: "text"; text: string; clue?: boolean }
  | { id: number; kind: "ending"; text: string }
  | { id: number; kind: "image"; src: string; alt: string };

function toStoryLines(story: Entry[]): StoryLine[] {
  return story.flatMap((entry): StoryLine[] => {
    if (entry.type === "autonomous_action_executed") return [{ id: entry.id, kind: "text", text: entry.content.result }];
    if (entry.type === "session_completed") return [{ id: entry.id, kind: "ending", text: `结局 · ${entry.content.title}` }];
    if (entry.type !== "narrative_block") return [];
    const block = entry.content;
    if (block.kind === "visual") return [{ id: entry.id, kind: "image", src: block.src, alt: block.alt }];
    if ("text" in block) return [{ id: entry.id, kind: "text", text: block.text, clue: block.kind === "clue" }];
    return [];
  });
}

// Keeps a scroll container pinned to its newest content unless the reader scrolled up.
function useFollow(dependency: unknown) {
  const log = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    const viewport = log.current;
    if (viewport && following.current) viewport.scrollTop = viewport.scrollHeight;
  }, [dependency]);
  const onScroll = () => {
    const viewport = log.current;
    if (!viewport) return;
    following.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= followThreshold;
  };
  return { log, onScroll };
}

export function ScenePanel({ scene, sceneId, eventIds, story, status, channelOpen, thinking, onTypingChange, error }: {
  scene?: string;
  sceneId?: string;
  eventIds?: readonly string[];
  story: Entry[];
  status: string;
  channelOpen: boolean;
  thinking: boolean;
  onTypingChange: (typing: boolean) => void;
  error?: ReactNode;
}) {
  const lines = toStoryLines(story);
  // Lines before `shown` are complete; line `shown` is being typed up to `chars`.
  const [shown, setShown] = useState(0);
  const [chars, setChars] = useState(0);
  const typing = shown < lines.length;
  const current = lines[shown];

  useEffect(() => {
    onTypingChange(typing);
  }, [typing, onTypingChange]);

  const currentLength = current ? (current.kind === "text" ? current.text.length : -1) : undefined;
  useEffect(() => {
    if (currentLength === undefined) return;
    if (chars >= currentLength) {
      const timer = window.setTimeout(() => { setShown(n => n + 1); setChars(0); }, currentLength > 0 ? 320 : 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setChars(n => n + typeCharsPerTick), typeTickMs);
    return () => window.clearTimeout(timer);
  }, [shown, currentLength, chars]);

  const { log, onScroll } = useFollow(`${shown}:${chars}:${lines.length}:${!!error}`);
  const skip = () => { setShown(lines.length); setChars(0); };

  const renderLine = (line: StoryLine, partial?: number) => {
    if (line.kind === "image") return <img key={line.id} src={line.src} alt={line.alt} />;
    const text = partial === undefined ? line.text : line.text.slice(0, partial);
    const className = line.kind === "ending" ? "reader-ending" : line.clue ? "reader-clue-line" : undefined;
    return <p key={line.id} className={className}>{text}{partial !== undefined && <span className="reader-caret" aria-hidden="true" />}</p>;
  };

  return (
    <section className="reader-panel reader-scene-panel" aria-labelledby="reader-scene-title">
      <div className="reader-device reader-camera-device">
        <header className="reader-panel-head">
          <h2 id="reader-scene-title">{scene ? `${scene}` : "场景监视画面"}</h2>
          <span className="reader-meta">CAM {sceneId?.match(/^s(\d+)$/)?.[1] ?? "01"}</span>
        </header>
        <StudyFeed sceneId={sceneId} scene={scene} eventIds={eventIds} channelOpen={channelOpen} thinking={thinking} />
        <div className="reader-device-foot" aria-hidden="true" />
      </div>
      <article className="reader-paper reader-story" aria-label="剧情记录">
        <h2 className="reader-paper-title">现场记录</h2>
        <div ref={log} onScroll={onScroll} onClick={typing ? skip : undefined}
          className="reader-scroll reader-story-log" role="log" tabIndex={0} aria-label="曲别针的剧情"
          title={typing ? "点击显示全部" : undefined}>
          {lines.slice(0, shown).map(line => renderLine(line))}
          {current && current.kind === "text" && renderLine(current, chars)}
          {error}
        </div>
        <footer className="reader-paper-footer">
          <span className={`reader-status${channelOpen ? " is-open" : ""}`} role="status">{status}</span>
          {typing && <button type="button" className="reader-skip" onClick={skip}>显示全部</button>}
        </footer>
      </article>
    </section>
  );
}

export function DanmakuPanel({ messages, character, input, complete, outgoing, thinking, channelOpen }: {
  messages: Entry[];
  character?: string;
  input: ReactNode;
  complete: boolean;
  outgoing?: string;
  thinking: boolean;
  channelOpen: boolean;
}) {
  const [pauseAt, setPauseAt] = useState<number | null>(null);
  const paused = pauseAt !== null;
  const visible = paused ? messages.filter(entry => entry.sequence <= pauseAt) : messages;
  const { log, onScroll } = useFollow(`${visible.at(-1)?.sequence}:${outgoing}:${thinking}`);

  return (
    <section className={`reader-panel reader-device reader-terminal${channelOpen ? " is-open" : ""}`} aria-labelledby="reader-danmaku-title">
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
        onScroll={onScroll}
      >
        {visible.length === 0 && !outgoing ? <p className="reader-empty">暂无弹幕。</p> : (
          <ol className="reader-chat">
            {visible.map(entry => <DanmakuRecord key={entry.id} entry={entry} character={character} />)}
            {outgoing && <li className="is-me is-sending"><div className="reader-meta">你 · 发送中</div><p>{outgoing}</p></li>}
            {thinking && <li className="is-them"><div className="reader-meta">{character ?? "角色"}</div><p className="reader-thinking">正在考虑你的话<span aria-hidden="true">…</span></p></li>}
          </ol>
        )}
      </div>
      <footer className="reader-danmaku-footer">
        {input}
        <div className="reader-bar">
          <span className="reader-meta reader-signal" role="status">
            {paused ? "显示已暂停" : complete ? "接收结束" : channelOpen ? "通道开放，等待你的弹幕" : "接收中"}
          </span>
        </div>
      </footer>
    </section>
  );
}

function DanmakuRecord({ entry, character }: { entry: Entry; character?: string }) {
  const time = <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>;
  if (entry.type === "danmaku_submitted") {
    return <li className="is-me"><div className="reader-meta">你 · {time}</div><p>{entry.content.text}</p></li>;
  }
  if (entry.type !== "narrative_block") return null;
  const block = entry.content;
  if (block.kind === "decision") {
    // The Timeline follows an inference decision with a separate inference block.
    if (block.decision === "infer") return null;
    return (
      <li className="is-them">
        <div className="reader-meta">
          {character} · {time} <span className={`reader-verdict ${block.decision === "reject" ? "is-reject" : ""}`}>{decisions[block.decision]}</span>
        </div>
        <p>{block.reason}</p>
      </li>
    );
  }
  if (block.kind === "ai_inference" || block.kind === "system_event" || block.kind === "narration") {
    if (block.kind === "system_event") {
      return <li className="is-system"><p>{block.text}</p></li>;
    }
    const sender = block.kind === "ai_inference" ? `${character} · 推测` : character;
    return (
      <li className="is-them">
        <div className="reader-meta">{sender} · {time}</div>
        <p>{block.text}</p>
      </li>
    );
  }
  return null;
}

export function CluePanel({ clues }: { clues: Clue[] }) {
  return (
    <section className="reader-paper reader-clues" aria-labelledby="reader-clues-title">
      <header className="reader-paper-head">
        <h2 id="reader-clues-title" className="reader-paper-title">已发现线索</h2>
        <span className="reader-clue-count" aria-live="polite">{clues.length} 件</span>
      </header>
      {clues.length === 0 ? <p className="reader-empty">暂无线索。</p> : (
        <ol className="reader-list reader-scroll reader-clue-list" aria-label="线索记录" tabIndex={0}>
          {clues.map((clue, index) => (
            <li key={clue.clueId}>
              <span className="reader-clue-no">线索 {String(index + 1).padStart(2, "0")}</span>
              <p>{clue.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
