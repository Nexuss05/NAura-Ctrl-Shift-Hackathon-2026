import { useRef, useEffect, useState } from "react";
import Globe from "react-globe.gl";
import { Cursor } from "../Icons.jsx";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function GlobeSelector({ forests, selectedId, onSelectForest, onSelectCustom }) {
  const globeEl = useRef();
  const wrapRef = useRef();
  const [size, setSize] = useState({ w: 800, h: 520 });

  // responsive sizing
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // initial view + gentle auto-rotate (off when reduced motion)
  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    const ctrl = g.controls();
    ctrl.autoRotate = !reduceMotion();
    ctrl.autoRotateSpeed = 0.45;
    ctrl.enableZoom = true;
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0);
  }, []);

  // fly to the selected forest
  useEffect(() => {
    const g = globeEl.current;
    const f = forests.find((x) => x.id === selectedId);
    if (g && f) {
      g.controls().autoRotate = false;
      g.pointOfView({ lat: f.lat, lng: f.lng, altitude: 1.6 }, reduceMotion() ? 0 : 1200);
    }
  }, [selectedId, forests]);

  const points = forests.map((f) => ({ ...f, selected: f.id === selectedId }));

  return (
    <div className="globe-wrap" ref={wrapRef}>
      <p className="globe-hint">
        <Cursor /> Click a green marker — or tap any land — to choose where to help.
      </p>

      <div className="globe-legend">
        <span><span className="legend-dot" style={{ background: "#10B981" }} /> A forest you can fund</span>
        <span><span className="legend-dot" style={{ background: "#FCD34D" }} /> Chosen</span>
      </div>

      <Globe
        ref={globeEl}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#10B981"
        atmosphereAltitude={0.2}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => (d.selected ? "#FCD34D" : "#34D399")}
        pointAltitude={0.07}
        pointRadius={(d) => (d.selected ? 0.95 : 0.6)}
        pointResolution={24}
        pointLabel={(d) =>
          `<div style="font-family:Lexend,sans-serif;background:#064E3B;color:#fff;padding:.5rem .8rem;border-radius:10px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.4)">
             <strong>${d.name}</strong><br/>${d.place}<br/>Health ${d.health}/100
           </div>`
        }
        onPointClick={(d) => onSelectForest(d.id)}
        onGlobeClick={({ lat, lng }) => onSelectCustom(lat, lng)}
        ringsData={points.filter((p) => p.selected)}
        ringColor={() => (t) => `rgba(252,211,77,${1 - t})`}
        ringMaxRadius={4}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={reduceMotion() ? Infinity : 900}
      />
    </div>
  );
}
