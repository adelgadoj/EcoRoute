"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type LiveStop = {
  route_id: string; sequence: number; status: "pending" | "collected" | "skipped";
  code: string; address: string | null; lat: number; lng: number;
};
export type LiveRoutePos = {
  id: string; name: string; driver: string; vehicle: string; lat: number | null; lng: number | null;
  color?: string; stale?: boolean;
};
type Props = {
  routes: LiveRoutePos[]; stops: LiveStop[]; focus: string | null;
  height?: number;   // alto del mapa en píxeles (520 por defecto)
  fitKey?: number;   // al cambiar este número, el mapa vuelve a encuadrar las paradas
  paths?: Record<string, [number, number][]>; // trazado por calles de cada ruta [lat, lng] (si no hay, línea recta)
};

const FALLBACK = ["#18b56a", "#2f8bff", "#8b5cf6", "#f5a524", "#8ea3bd"];
const STATE_COLOR = { collected: "#3ddc97", skipped: "#ff6b68", pending: "#8ea3bd" };
const STATE_TEXT = { collected: "recogido", skipped: "no se pudo", pending: "pendiente" };

// Mapa simple: solo calles, agua y parques. Sin negocios, instituciones ni casas.
// Para ocultar también los nombres de las calles, pon SHOW_STREET_NAMES en false.
const SHOW_STREET_NAMES = true;
const road = (id: string, classes: string[], color: string, w: number[], extra: Record<string, unknown> = {}) => ({
  id, type: "line", source: "omt", "source-layer": "transportation",
  filter: ["match", ["get", "class"], classes, true, false],
  layout: { "line-cap": "round", "line-join": "round" },
  paint: { "line-color": color, "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 10, w[0], 14, w[1], 17, w[2], 20, w[3]], ...extra },
});
const STYLE = {
  version: 8,
  sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#061225" } },
    { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": "#0a2236" } },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#0b2a55" } },
    { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": "#0b2a55", "line-width": 1.5 } },
    road("roads-glow", ["primary", "trunk", "motorway", "secondary"], "#2f8bff", [1, 5, 16, 44], { "line-opacity": 0.16, "line-blur": 5 }),
    road("roads-minor", ["minor", "service", "track"], "#1a4585", [0.2, 0.8, 3, 10]),
    road("roads-main", ["secondary", "tertiary"], "#2a69c9", [0.5, 1.5, 5, 16]),
    road("roads-major", ["primary", "trunk", "motorway"], "#4a92ff", [0.8, 2.2, 7, 20]),
    ...(SHOW_STREET_NAMES ? [{
      id: "road-names", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14,
      filter: ["match", ["get", "class"], ["minor", "service", "track", "secondary", "tertiary", "primary", "trunk"], true, false],
      layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11 },
      paint: { "text-color": "#8fb4ff", "text-halo-color": "#061225", "text-halo-width": 1.4 },
    }] : []),
  ],
} as unknown as maplibregl.StyleSpecification;

const truckEl = (color: string, stale: boolean, tip: string) => {
  const el = document.createElement("div");
  el.title = tip;
  el.innerHTML = `<div style="width:38px;height:38px;border-radius:12px;background:${color};border:3px solid #fff;display:grid;place-items:center;box-shadow:0 0 16px ${color},0 2px 8px rgba(0,0,0,.5);${stale ? "opacity:.55;" : ""}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#04160e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg></div>`;
  return el;
};
const stopEl = (color: string, next: boolean, dim: boolean, tip: string) => {
  const el = document.createElement("div");
  el.title = tip;
  const size = next ? 22 : 16;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${next ? 3 : 2}px solid #fff;box-shadow:0 0 ${next ? 14 : 8}px ${color};opacity:${dim ? 0.4 : 1}`;
  return el;
};

export default function LiveMap({ routes, stops, focus, height = 520, fitKey = 0, paths }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const lineIds = useRef<string[]>([]);
  const fitted = useRef<string | undefined>(undefined); // último encuadre aplicado
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: el.current, style: STYLE, center: [-71.537, -16.409], zoom: 12,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
      });
    } catch { setFailed(true); return; }
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.on("load", () => setReady(true));
    map.current = m;
    return () => {
      markers.current.forEach((x) => x.remove()); markers.current = []; lineIds.current = [];
      m.remove(); map.current = null; fitted.current = undefined; setReady(false);
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markers.current.forEach((x) => x.remove()); markers.current = [];
    lineIds.current.forEach((id) => {
      if (m.getLayer(id + "-halo")) m.removeLayer(id + "-halo");
      if (m.getLayer(id + "-line")) m.removeLayer(id + "-line");
      if (m.getSource(id)) m.removeSource(id);
    });
    lineIds.current = [];
    const pts: [number, number][] = []; // [lng, lat]
    const put = (e: HTMLElement, lng: number, lat: number) => markers.current.push(new maplibregl.Marker({ element: e }).setLngLat([lng, lat]).addTo(m));

    routes.forEach((r, ri) => {
      const color = r.color ?? FALLBACK[ri % FALLBACK.length];
      const dim = !!focus && focus !== r.id;
      const mine = stops.filter((s) => s.route_id === r.id).sort((a, b) => a.sequence - b.sequence);
      const next = mine.find((s) => s.status === "pending");
      if (mine.length > 1) {
        const line = (paths?.[r.id] ?? mine.map((s) => [s.lat, s.lng] as [number, number])).map(([la, ln]) => [ln, la] as [number, number]);
        const sid = `route-${r.id}`;
        m.addSource(sid, { type: "geojson", data: { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line } } });
        m.addLayer({ id: sid + "-halo", type: "line", source: sid, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": color, "line-width": 12, "line-opacity": dim ? 0.05 : 0.2, "line-blur": 4 } });
        m.addLayer({ id: sid + "-line", type: "line", source: sid, layout: { "line-join": "round" },
          paint: { "line-color": color, "line-width": 4, "line-opacity": dim ? 0.25 : 0.95, "line-dasharray": [2, 1.4] } });
        lineIds.current.push(sid);
      }
      mine.forEach((s) => {
        const isNext = s === next;
        put(stopEl(STATE_COLOR[s.status], isNext, dim, `${s.sequence}. ${s.code} · ${STATE_TEXT[s.status]}${isNext ? " (siguiente)" : ""}`), s.lng, s.lat);
        if (!dim) pts.push([s.lng, s.lat]);
      });
    });
    // Los camiones van al final para quedar por encima de las paradas.
    routes.forEach((r, ri) => {
      if (r.lat === null || r.lng === null) return;
      const color = r.color ?? FALLBACK[ri % FALLBACK.length];
      put(truckEl(color, !!r.stale, `${r.driver} · Camión ${r.vehicle}`), r.lng, r.lat);
      if (!focus || focus === r.id) pts.push([r.lng, r.lat]);
    });

    // Encuadra al abrir, al cambiar la ruta elegida o al pedirlo (fitKey); después respeta el zoom del usuario.
    const key = `${focus ?? ""}|${fitKey}`;
    if (fitted.current !== key && pts.length) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 40, maxZoom: 17, duration: 0 });
      fitted.current = key;
    }
  }, [ready, routes, stops, focus, fitKey, paths]);

  if (failed) return <div className="card err">Este navegador no pudo dibujar el mapa.</div>;
  return <div ref={el} className="livemap" style={{ height, borderRadius: 16, border: "1px solid var(--line)", overflow: "hidden" }} aria-label="Mapa de rutas en vivo" />;
}
