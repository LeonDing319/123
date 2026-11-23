"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Monitor, Mail, Radio, LockKeyhole, X, FolderClosed, Paperclip } from "lucide-react";
import { StoryPreview } from "./story-preview";
import { CameraImage } from "./study-feed";
import "./desktop.css";

type App = "inbox" | "files" | "system";
type Phase = "desktop" | "frozen" | "fault" | "online";
const apps = [
  { id: "inbox", title: "收件箱", Icon: Mail },
  { id: "files", title: "我的文件", Icon: FolderClosed },
  { id: "system", title: "本机信息", Icon: Monitor },
] as const;

export function GameDesktop() {
  const [phase, setPhase] = useState<Phase>("desktop");
  const [app, setApp] = useState<App>();
  const [read, setRead] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishStory = useCallback(() => setFinished(true), []);
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const monitor = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (phase !== "frozen" && phase !== "fault") return;
    const timer = setTimeout(() => setPhase(phase === "frozen" ? "fault" : "online"), phase === "frozen" ? 780 : 640);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const reset = () => setPosition(undefined);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  function launch(id: App) {
    if (phase === "desktop") setPhase("frozen");
    if (phase === "online") setApp(id);
  }
  function move(e: PointerEvent<HTMLElement>) {
    if (!drag.current || !monitor.current) return;
    const { width, height } = monitor.current.getBoundingClientRect();
    setPosition({
      x: Math.max(0, Math.min(innerWidth - width, e.clientX - drag.current.dx)),
      y: Math.max(0, Math.min(innerHeight - height - 34, e.clientY - drag.current.dy)),
    });
  }
  return <div className={`os phase-${phase}`}>
    <div className="os-wall" aria-hidden="true">
      <div className="wall-print"><div className="wall-emblem"><Paperclip strokeWidth={0.7}/></div><b>夜班工作站</b><small>NIGHT SHIFT TERMINAL</small></div>
    </div>
    <nav className="shortcuts" aria-label="桌面软件">{apps.map(({id,title,Icon}) =>
      <button key={id} onClick={() => launch(id)} disabled={phase === "frozen" || phase === "fault"}>
        <span className="icon-frame"><Icon/>{id === "inbox" && phase === "online" && !read && <i>1</i>}</span>{title}
      </button>)}</nav>
    {phase === "fault" && <div className="signal-fault" role="status" aria-label="显示信号中断"/>}
    {phase === "online" && <section ref={monitor} className="os-monitor os-window" aria-label="监控终端"
      style={position && { left: position.x, top: position.y }}>
      <header className="window-bar draggable" onPointerDown={e => {
        if (e.button !== 0) return;
        const box = monitor.current!.getBoundingClientRect();
        drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
        e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={move} onLostPointerCapture={() => { drag.current = null; }}>
        <span><Radio size={16}/> 监控终端</span><span><LockKeyhole size={13}/> 系统锁定</span>
      </header>
      {playing ? <StoryPreview onComplete={finishStory}/> : <div className="intercept">
        <CameraImage sceneId="s01"/><div className="cam-caption"><b>● REC</b>　CAM / 01</div>
        <div className="cam-location">一楼档案室</div></div>}
    </section>}
    {app && <section className="utility os-window" aria-label={apps.find(a=>a.id===app)?.title}>
      <header className="window-bar"><span>{apps.find(a=>a.id===app)?.title}</span><button aria-label="关闭窗口" onClick={()=>setApp(undefined)}><X size={16}/></button></header>
      <div className="utility-body">{app === "inbox" ? <>
        <small>系统邮局　/　收件箱</small>
        <button className="mail-row" onClick={()=>setRead(true)}><Mail size={20}/><strong>强制协助通知</strong><small>{read ? "已读" : "未读"}</small></button>
        {read && <article><small>发件人　系统管理员</small><h2>强制协助通知</h2><p>监控通道已绑定本机。你必须协助曲别针完成今晚的调查。</p><p>留意监控中的现场记录。在他需要判断时，通过弹幕把你的建议发给他。任务期间，监控连接将保持开启。</p>
          <button className="assist" onClick={()=>{ setPlaying(true); setApp(undefined); }}>{playing ? "返回监控" : "接入协助通道"} →</button></article>}
      </> : app === "files" ? <><small>本地磁盘　/　工作目录</small><h2>我的文件</h2>{finished ? <ul>{["完整叙事文本", "人物与世界设定", "故事分析", "弹幕交互设计"].map(name =>
          <li key={name}><a href={`/story-archive/${name}.txt`} download>{name} ↓</a></li>)}</ul> : <p>调查结束后，本次任务的剧本档案将在这里开放。</p>}</> :
        <><small>终端系统　/　设备状态</small><h2>本机信息</h2><p>工作模式　夜班值守</p><p>监控通道　已连接</p><p>关闭权限　由系统管理</p></>}</div>
    </section>}
    <footer className="os-taskbar"><span><Monitor size={15}/> 工作站</span><div>
      {phase === "online" && <button onClick={()=>setApp("inbox")}><Mail size={15}/> {read ? "收件箱" : "1 封未读"}</button>}
      <span>{phase === "frozen" ? "程序未响应" : phase === "fault" ? "信号中断" : "21:30"}</span></div></footer>
  </div>;
}
