"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapContainer = { id: string; code: string; active: boolean; lat: number; lng: number };
type Props = {
  containers: MapContainer[];
  pending: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
};

export default function ContainerMap({ containers, pending, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView([-16.409, -71.537], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap",
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pick.current(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const g = layer.current, m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    containers.forEach((c) =>
      L.circleMarker([c.lat, c.lng], { radius: 8, color: "#fff", weight: 2, fillColor: c.active ? "#1f8a45" : "#888", fillOpacity: 1 })
        .bindTooltip(c.code).addTo(g));
    if (pending)
      L.circleMarker([pending.lat, pending.lng], { radius: 11, color: "#f2b705", weight: 4, fillColor: "#fff", fillOpacity: 0.6 }).addTo(g);
    if (!fitted.current && containers.length) {
      m.fitBounds(L.latLngBounds(containers.map((c) => [c.lat, c.lng] as [number, number])), { padding: [30, 30] });
      fitted.current = true;
    }
  }, [containers, pending]);

  return <div ref={el} style={{ height: 420, borderRadius: 12, border: "1px solid var(--line)" }} aria-label="Mapa de contenedores" />;
}
