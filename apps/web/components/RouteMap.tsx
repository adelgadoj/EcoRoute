"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type Pin = { id: string; code: string; lat: number; lng: number };
type Props = { containers: Pin[]; selected: string[]; onToggle: (id: string) => void; path?: [number, number][] | null };

export default function RouteMap({ containers, selected, onToggle, path }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const toggle = useRef(onToggle);
  toggle.current = onToggle;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView([-16.409, -71.537], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const g = layer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    const byId = new Map(containers.map((c) => [c.id, c]));
    const line = selected.map((id) => byId.get(id)).filter(Boolean).map((c) => [c!.lat, c!.lng] as [number, number]);
    if (line.length > 1) L.polyline(path && path.length > 1 ? path : line, { color: "#2a6fdb", weight: 4, opacity: 0.8 }).addTo(g);
    containers.forEach((c) => {
      const i = selected.indexOf(c.id);
      const mk = i >= 0
        ? L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "", html: `<div class="stopn">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
        : L.circleMarker([c.lat, c.lng], { radius: 8, color: "#fff", weight: 2, fillColor: "#7a8780", fillOpacity: 1 });
      mk.bindTooltip(c.code).on("click", () => toggle.current(c.id)).addTo(g);
    });
    if (!fitted.current && containers.length) {
      m.fitBounds(L.latLngBounds(containers.map((c) => [c.lat, c.lng] as [number, number])), { padding: [30, 30] });
      fitted.current = true;
    }
  }, [containers, selected, path]);

  return <div ref={el} style={{ height: 420, borderRadius: 12, border: "1px solid var(--line)" }} aria-label="Mapa para armar la ruta" />;
}
