import { useEffect, useRef } from "react";
import { Sparkle } from "../Icons.jsx";

const TAG_LABEL = {
  observer: "Observer",
  auditor: "Auditor",
  treasurer: "Treasurer",
  system: "System",
};

// Live terminal that streams the AI swarm dialogue during a satellite scan.
export default function SwarmConsole({ logs, status, ndvi }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [logs.length]);

  return (
    <div className="swarm" role="log" aria-live="polite" aria-label="Satellite swarm activity">
      <div className="swarm-head">
        <span className="swarm-title"><Sparkle /> Verifying from space</span>
        <span className={`swarm-status s-${status}`}>{status}</span>
      </div>
      <div className="swarm-body">
        {logs.length === 0 && <p className="swarm-empty">Waiting for the satellite swarm…</p>}
        {logs.map((l, i) => (
          <p key={i} className={`swarm-line t-${l.tag}`}>
            <span className="swarm-tag">{TAG_LABEL[l.tag] || "System"}</span>
            <span className="swarm-msg">{l.message}</span>
          </p>
        ))}
        <div ref={endRef} />
      </div>
      {ndvi != null && (
        <div className="swarm-ndvi">
          Forest health (NDVI): <strong>{Number(ndvi).toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
