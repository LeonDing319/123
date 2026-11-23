import studyCamera from "../../design/reader-crt-study/study-camera.png";

export function CameraImage({ sceneId }: { sceneId: string }) {
  return <img className="camera-image" src={`/cameras/${sceneId}.gif`} alt="研究中心监控影像" />;
}

export function StudyFeed({ scene, sceneId, timestamp }: { scene?: string; sceneId?: string; timestamp?: string }) {
  return (
    <div className="reader-feed" id="reader-feed">
      {sceneId && /^s0[1-6]$/.test(sceneId) && <CameraImage sceneId={sceneId} />}
      {scene === "书房" && <img src={studyCamera.src} width={studyCamera.width} height={studyCamera.height} alt="书房示意图，旧门旁的桌面上摆着一张便签。" />}
      <div className="reader-crt" aria-hidden="true" />
      <div className="reader-feed-label reader-meta">
        <span>{scene === "书房" ? "场景示意" : sceneId ? "监控中" : "正在连接"}</span>
        {timestamp && <time dateTime={timestamp}>{formatTime(timestamp)}</time>}
      </div>
    </div>
  );
}

const clock = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export function formatTime(timestamp: string) {
  return clock.format(new Date(timestamp));
}
