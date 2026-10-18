"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LiveRoutePos, LiveStop } from "./LiveMap";
import { Ic } from "./icons";

// Leaflet necesita el navegador: el mapa no se genera en el servidor.
const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false, loading: () => <div className="card">Cargando mapa…</div> });

type LiveRoute = {
  id: string; name: string; vehicle: string; driver: string; started_at: string | null;
  total: number; collected: number; skipped: number;
  lat: number | null; lng: number | null; recorded_at: string | null; speed_mps: number | null;
};
type Incident = { id: string; route_id: string; route_name?: string | null; category: string; description: string; created_at: string; driver: string };
type Snapshot = { routes: LiveRoute[]; stops: LiveStop[]; incidents: Incident[] };

const COLORS = ["#18b56a", "#2f8bff", "#8b5cf6", "#f5a524", "#8ea3bd"]; // R1 verde, R2 azul, R3 púrpura, R4 naranja, R5 gris
const CAT: Record<string, string> = {
  vehicle: "Problema con el camión", blocked_road: "Calle bloqueada",
  container: "Problema con un contenedor", safety: "Riesgo de seguridad", other: "Otro",
};

function ago(iso: string | null, now: number) {
  if (!iso) return null;
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`;
}

export default function LiveBoard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<string | null>(null);
  const slots = useRef(new Map<string, number>()); // ruta -> número (R1, R2…) estable mientras la ruta siga en curso
  const [paths, setPaths] = useState<Record<string, [number, number][]>>({}); // trazados por calles ya cargados
  const asked = useRef(new Set<string>());

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch("/api/v1/live", { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        if (!r.ok) { setErr(j.error ?? "No se pudo cargar"); return; }
        setSnap(j); setErr("");
      } catch { if (!stop) setErr("Sin conexión con el servidor. Reintentando…"); }
    }
    load();
    const poll = setInterval(load, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop = true; clearInterval(poll); clearInterval(tick); };
  }, []);

  // Solo se recalcula con cada lectura del servidor, para que el mapa no se redibuje cada segundo.
  const view = useMemo(() => {
    if (!snap) return null;
    const m = slots.current, ids = snap.routes.map((r) => r.id);
    for (const k of [...m.keys()]) if (!ids.includes(k)) m.delete(k);
    const used = new Set(m.values());
    for (const id of ids) if (!m.has(id)) { let n = 1; while (used.has(n)) n++; m.set(id, n); used.add(n); }
    const t = Date.now();
    return snap.routes.map((r) => {
      const n = m.get(r.id)!;
      const stale = !r.recorded_at || t - new Date(r.recorded_at).getTime() > 60000;
      return { ...r, n, color: COLORS[(n - 1) % COLORS.length], stale } as LiveRoute & LiveRoutePos & { n: number; color: string; stale: boolean };
    });
  }, [snap]);

  // Pide una sola vez el trazado por calles de cada ruta en curso.
  useEffect(() => {
    view?.forEach((r) => {
      if (asked.current.has(r.id)) return;
      asked.current.add(r.id);
      fetch(`/api/v1/routes/${r.id}/path`).then((x) => x.json()).then((j) => {
        if (Array.isArray(j.path)) setPaths((p) => ({ ...p, [r.id]: j.path }));
      }).catch(() => asked.current.delete(r.id));
    });
  }, [view]);

  if (!snap || !view) return <div className="card">{err || "Cargando…"}</div>;
  const focusId = view.some((r) => r.id === focus) ? focus : null;
  const routeName = (id: string) => view.find((r) => r.id === id)?.name ?? "Ruta finalizada";

  return (
    <>
      <div className="pagehead">
        <h1>Rutas en tiempo real</h1>
        <span className="pill" role="status"><span className={"dot" + (err ? " bad" : "")} />{err ? "Sin conexión" : "En vivo"}</span>
      </div>
      {err && <div className="card err">{err}</div>}

      <div className="livegrid">
        <div>
          <div className="mapwrap">
            <LiveMap routes={view} stops={snap.stops} focus={focusId} paths={paths} />
            {view.length > 0 && (
              <div className="maplegend">
                {view.map((r) => (
                  <button key={r.id} className="chip" style={{ ["--rc" as string]: r.color }} onClick={() => setFocus(focusId === r.id ? null : r.id)}>
                    <i /> {r.name} · Camión {r.vehicle}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mapkey">
            <span><i style={{ background: "#3ddc97" }} />Recogido</span>
            <span><i style={{ background: "#ff6b68" }} />No se pudo</span>
            <span><i style={{ background: "#8ea3bd" }} />Pendiente</span>
            <span>Línea punteada: ruta planificada</span>
          </div>
        </div>

        <div>
          {focusId && <button className="s" style={{ marginTop: 0, marginBottom: 12 }} onClick={() => setFocus(null)}>Ver todas las rutas</button>}
          {view.length === 0 && (
            <div className="card empty"><Ic name="live" size={28} /><span>No hay rutas en curso. Cuando un conductor inicie su ruta aparecerá aquí.</span></div>
          )}
          {view.map((r) => {
            const pct = r.total ? Math.round(((r.collected + r.skipped) / r.total) * 100) : 0;
            const live = r.recorded_at ? (now - new Date(r.recorded_at).getTime()) / 1000 : null;
            const stale = live === null || live > 60;
            return (
              <div key={r.id} role="button" tabIndex={0} aria-pressed={focusId === r.id}
                   className={"rcard" + (focusId === r.id ? " sel" : "")} style={{ ["--rc" as string]: r.color }}
                   onClick={() => setFocus(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocus(r.id); } }}>
                <div className="rhead">
                  <span className="rbadge"><Ic name="truck" size={20} /></span>
                  <div><b>{r.name}</b><span>{r.driver} · Camión {r.vehicle}</span></div>
                </div>
                <div className="pbar"><i style={{ width: `${pct}%` }} /></div>
                <div>{r.collected} recogidos · {r.skipped} no se pudo · {r.total - r.collected - r.skipped} pendientes <span style={{ color: "var(--mut)" }}>({pct}%)</span></div>
                <div className={"gps" + (stale ? " stale" : "")}>
                  {r.lat === null || r.lng === null ? "Aún sin ubicación" : (
                    <>
                      {stale ? "Sin actualización GPS · " : ""}Ubicación de hace {ago(r.recorded_at, now)}
                      {r.speed_mps !== null && ` · ${Math.round(r.speed_mps * 3.6)} km/h`}
                      {" · "}
                      <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`}
                         target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>abrir en OpenStreetMap</a>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="card">
            <h2 style={{ fontSize: 18 }}>Alertas y notificaciones</h2>
            {snap.incidents.length === 0 && <span style={{ color: "var(--mut)" }}>Sin incidencias abiertas.</span>}
            {snap.incidents.map((i) => (
              <div key={i.id} className="alert">
                <span className="ai"><Ic name="alert" size={18} /></span>
                <div>
                  <b>{CAT[i.category] ?? i.category}</b>
                  <small>{i.description}</small>
                  <small>{i.driver} · {i.route_name ?? routeName(i.route_id)}</small>
                </div>
                <time>hace {ago(i.created_at, now)}</time>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
