import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-side-by-side";

// Real Sentinel-2 cloudless yearly mosaics from EOX (free, ~10m, no API key).
const BEFORE = 2017;
const AFTER = 2024;
const layer = (year) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`;

export default function SatelliteCompare({ lat, lng }) {
  const elRef = useRef(null);

  useEffect(() => {
    const map = L.map(elRef.current, {
      center: [lat, lng],
      zoom: 12,
      minZoom: 4,
      maxZoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,   // don't hijack page scroll
      attributionControl: true,
      keyboard: true
    });

    const opts = { maxNativeZoom: 14, maxZoom: 14, tileSize: 256, attribution: "Sentinel-2 cloudless &copy; EOX" };
    const before = L.tileLayer(layer(BEFORE), opts).addTo(map);
    const after = L.tileLayer(layer(AFTER), opts).addTo(map);
    L.control.sideBySide(before, after).addTo(map);

    // The grid cell stretches AFTER mount, so the map must recompute its size
    // whenever the container resizes — otherwise tiles leave an empty strip.
    const fix = () => map.invalidateSize({ animate: false });
    const ro = new ResizeObserver(fix);
    ro.observe(elRef.current);
    const t1 = setTimeout(fix, 80);
    const t2 = setTimeout(fix, 400);

    return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); map.remove(); };
  }, [lat, lng]);

  return (
    <div className="compare sat">
      <div ref={elRef} className="sat-map" aria-label={`Real satellite imagery from ${BEFORE} and ${AFTER}. Drag the divider to compare.`} />
      <span className="compare-tag before">{BEFORE}</span>
      <span className="compare-tag after">{AFTER}</span>
    </div>
  );
}
