import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-side-by-side";

// Real Sentinel-2 cloudless yearly mosaics from EOX (free, ~10m, no API key).
const BEFORE = 2017;
const AFTER = 2024;
const layer = (year) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`;

// `projected` = show only the simulated "fully restored" view (driven by the flow).
// `gap` = projection strength (scales with the chosen ETH gift).
export default function SatelliteCompare({ lat, lng, projected = false, gap = 0.4 }) {
  const elRef = useRef(null);

  useEffect(() => {
    const map = L.map(elRef.current, {
      center: [lat, lng],
      zoom: 12,
      minZoom: 4,
      maxZoom: 14,
      zoomControl: false,
      scrollWheelZoom: false,   // don't hijack page scroll
      attributionControl: true,
      keyboard: true
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const opts = {
      maxNativeZoom: 14, maxZoom: 14, tileSize: 256,
      keepBuffer: 4, updateWhenIdle: false, crossOrigin: true,
      attribution: "Sentinel-2 cloudless &copy; EOX"
    };

    // EOX occasionally drops a tile — retry the same URL a few times before giving up.
    const withRetry = (year) => {
      const l = L.tileLayer(layer(year), opts);
      l.on("tileerror", (ev) => {
        const img = ev.tile;
        const n = img._retry || 0;
        if (n < 3) {
          img._retry = n + 1;
          const src = img.src;
          setTimeout(() => { img.src = src; }, 600 * (n + 1));
        }
      });
      return l;
    };

    const before = withRetry(BEFORE).addTo(map);
    const after = withRetry(AFTER).addTo(map);
    L.control.sideBySide(before, after).addTo(map);

    // The grid cell stretches AFTER mount, so the map must recompute its size.
    const fix = () => map.invalidateSize({ animate: false });
    const ro = new ResizeObserver(fix);
    ro.observe(elRef.current);
    const t1 = setTimeout(fix, 80);
    const t2 = setTimeout(fix, 400);

    return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); map.remove(); };
  }, [lat, lng]);

  return (
    <div className={`compare sat${projected ? " projected" : ""}`}>
      <div ref={elRef} className="sat-map"
           aria-label={`Real satellite imagery from ${BEFORE} and ${AFTER}. Drag the divider to compare.`} />

      {/* Simulated future canopy — strength scales with the chosen gift */}
      <div className="sat-projection" style={{ "--proj": gap }} aria-hidden="true" />

      {projected
        ? <span className="compare-tag proj">How it could look, restored</span>
        : <><span className="compare-tag before">{BEFORE}</span><span className="compare-tag after">{AFTER} (today)</span></>}
    </div>
  );
}
