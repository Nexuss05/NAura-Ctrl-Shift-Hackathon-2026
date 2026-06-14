import { useCallback, useEffect, useRef, useState } from "react";

// WebSocket client for the Solana AI swarm (backend/agent_swarm.py, :8000/events).
// Streams console logs, NDVI updates, scan status and escrow-release events.
// Lazily connects on the first runScan() and stays open for live updates.

// In dev, default to the local swarm; in production only connect to an explicitly configured URL
// (otherwise the public site would try ws://localhost:8000 and log a connection error).
const URL = import.meta.env.VITE_SWARM_URL || (import.meta.env.DEV ? "ws://localhost:8000/events" : "");

export function useSwarm({ onRelease, onNdvi } = {}) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | running | consensusing | completed
  const [logs, setLogs] = useState([]);          // { tag, message, ts }
  const [ndvi, setNdvi] = useState(null);
  const wsRef = useRef(null);
  const cbRef = useRef({ onRelease, onNdvi });
  cbRef.current = { onRelease, onNdvi };

  const handle = useCallback((msg) => {
    switch (msg.type) {
      case "log":
        setLogs((l) => [...l, { tag: msg.tag || msg.logType || "system", message: msg.message, ts: Date.now() }]);
        break;
      case "ndvi_update":
        setNdvi(msg.ndvi);
        cbRef.current.onNdvi?.(msg);
        break;
      case "scan_status":
        setStatus(msg.status);
        break;
      case "tx_release":
        cbRef.current.onRelease?.(msg);
        break;
      default:
        break;
    }
  }, []);

  const ensureSocket = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!URL) return reject(new Error("swarm not configured")); // public build — skip, fall back to simulation
      const existing = wsRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) return resolve(existing);
      let ws;
      try {
        ws = new WebSocket(URL);
      } catch (e) {
        return reject(e);
      }
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); resolve(ws); };
      ws.onclose = () => { setConnected(false); wsRef.current = null; };
      ws.onerror = (e) => { setConnected(false); reject(e); };
      ws.onmessage = (ev) => {
        try { handle(JSON.parse(ev.data)); } catch { /* ignore malformed frames */ }
      };
    });
  }, [handle]);

  const runScan = useCallback(async (projectId) => {
    setLogs([]); setNdvi(null); setStatus("running");
    const ws = await ensureSocket();
    ws.send(JSON.stringify({ action: "run_scan", projectId }));
  }, [ensureSocket]);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  return { connected, status, logs, ndvi, runScan, clear: () => setLogs([]) };
}
