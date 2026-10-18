"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Logo from "./Logo";
import { Ic } from "./icons";
import { dur, km } from "@/lib/format";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false, loading: () => <div className="card">Cargando mapa…</div> });

export type StopView = {
  id: string; sequence: number; code: string; address: string | null;
  status: "pending" | "collected" | "skipped"; lat: number; lng: number;
};
export type RouteView = {
  id: string; name: string; status: string; date: string; vehicle: string;
  distanceM: number; durationS: number; elapsed: number | null;
};

const REASONS = ["Contenedor bloqueado por un vehículo", "No se encontró el contenedor", "Contenedor dañado", "Acceso cerrado", "Otro motivo"];
const CATS: [string, string][] = [
  ["vehicle", "Problema con el camión"], ["blocked_road", "Calle bloqueada"],
  ["container", "Problema con un contenedor"], ["safety", "Riesgo de seguridad"], ["other", "Otro"],
];
const LABEL = { pending: "Pendiente", collected: "Recogido", skipped: "No se pudo" };

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmt = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

type Lock = { release: () => Promise<void> };
const wakeLock = () =>
  (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;

export default function RouteRunner({ route, stops }: { route: RouteView; stops: StopView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [gps, setGps] = useState<"wait" | "ok" | "denied" | "error">("wait");
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [panel, setPanel] = useState<null | "skip" | "incident">(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState("");
  const [cat, setCat] = useState("vehicle");
  const [desc, setDesc] = useState("");
  const [fit, setFit] = useState(0);
  const [path, setPath] = useState<[number, number][] | null>(null); // trazado por calles
  const posRef = useRef<GeolocationPosition | null>(null);
  // La clave se conserva entre reintentos de la misma acción: así una doble pulsación no registra dos veces.
  const keyRef = useRef<{ stop: string; result: string; key: string } | null>(null);

  const active = route.status === "active";
  const next = stops.find((s) => s.status === "pending");
  const done = stops.filter((s) => s.status !== "pending").length;
  const collected = stops.filter((s) => s.status === "collected").length;
  const skipped = stops.filter((s) => s.status === "skipped").length;

  // Mientras la ruta está activa: sigue el GPS, lo envía cada 5 s y mantiene la pantalla encendida.
  useEffect(() => {
    if (!active) return;
    if (!("geolocation" in navigator)) { setGps("error"); return; }
    const watch = navigator.geolocation.watchPosition(
      (p) => { posRef.current = p; setPos(p); setGps("ok"); },
      (e) => setGps(e.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    const timer = setInterval(() => {
      const p = posRef.current;
      if (!p) return;
      fetch(`/api/v1/routes/${route.id}/position`, {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({
          lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy,
          speed: p.coords.speed, recorded_at: new Date(p.timestamp).toISOString(),
        }),
      }).catch(() => {});
    }, 3000);
    let lock: Lock | null = null;
    const grab = () => { wakeLock()?.request("screen").then((l) => { lock = l; }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible") grab(); };
    grab();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active, route.id]);

  useEffect(() => {
    fetch(`/api/v1/routes/${route.id}/path`).then((r) => r.json()).then((j) => { if (Array.isArray(j.path)) setPath(j.path); }).catch(() => {});
  }, [route.id]);
  const mapPaths = useMemo(() => (path ? { [route.id]: path } : undefined), [path, route.id]);

  async function call(path: string, body?: unknown): Promise<boolean> {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch(`/api/v1/routes/${route.id}/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "No se pudo completar la acción");
        if (r.status === 401) router.push("/login");
        if (r.status === 409) router.refresh();
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErr("Sin conexión. Cuando vuelva la señal, pulsa de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function record(result: "collected" | "unable_to_collect", why?: string) {
    if (!next) return;
    const k = keyRef.current;
    if (!k || k.stop !== next.id || k.result !== result) keyRef.current = { stop: next.id, result, key: crypto.randomUUID() };
    const ok = await call(`stops/${next.id}/result`, {
      result, reason: why, idempotency_key: keyRef.current!.key, recorded_at: new Date().toISOString(),
    });
    if (ok) { keyRef.current = null; setPanel(null); setOther(""); }
  }

  function skip() {
    const why = reason === "Otro motivo" ? other.trim() : reason;
    if (why.length < 3) { setErr("Escribe el motivo."); return; }
    record("unable_to_collect", why);
  }

  async function sendIncident() {
    if (desc.trim().length < 3) { setErr("Describe lo que pasó."); return; }
    if (await call("incidents", { category: cat, description: desc.trim() })) {
      setDesc(""); setPanel(null); setMsg("Incidencia enviada al administrador.");
    }
  }

  const toNext = pos && next ? meters({ lat: pos.coords.latitude, lng: pos.coords.longitude }, next) : null;
  const gpsText = {
    wait: "Buscando tu ubicación…",
    ok: `GPS activo${pos ? ` (±${Math.round(pos.coords.accuracy)} m)` : ""}`,
    denied: "Activa el permiso de ubicación para que el administrador te vea.",
    error: "Sin señal de GPS.",
  }[gps];

  // Tiempo y distancia que faltan: proporción de lo planificado según los contenedores pendientes.
  const left = stops.length ? (stops.length - done) / stops.length : 0;
  const mapRoutes = [{
    id: route.id, name: route.name, driver: "Tú", vehicle: route.vehicle, color: "#18b56a",
    lat: pos ? pos.coords.latitude : null, lng: pos ? pos.coords.longitude : null,
  }];
  const mapStops = stops.map((s) => ({ ...s, route_id: route.id }));

  const list = (
    <details style={{ marginTop: 12 }}><summary>Ver paradas</summary>
      {stops.map((x) => (
        <div key={x.id} className="row">
          <span><b>{x.sequence}.</b> {x.code}{x.address ? ` · ${x.address}` : ""}</span>
          <span style={{ color: "var(--mut)" }}>{LABEL[x.status]}</span>
        </div>
      ))}
    </details>
  );

  return (
    <>
      <div className="dhead">
        <Link href="/driver" className="back" aria-label="Volver al inicio"><Ic name="back" size={20} /></Link>
        <Logo size={36} />
        <div><b>EcoRoute</b><small>{active ? `En ruta: ${route.name}` : route.name}</small></div>
      </div>

      {route.status === "completed" ? (
        <div className="card sum">
          <div className="bigcheck"><Ic name="check" size={32} /></div>
          <h2 style={{ marginBottom: 4 }}>¡Ruta completada!</h2>
          <div style={{ color: "var(--mut)" }}>{route.name} · {route.date}</div>
          <div className="grid2" style={{ margin: "16px 0 8px" }}>
            <div><b style={{ fontSize: 28 }}>{collected}</b><br />recogidos</div>
            <div><b style={{ fontSize: 28 }}>{skipped}</b><br />no se pudo</div>
          </div>
          {route.elapsed !== null && <p>Tiempo total: <b>{dur(route.elapsed)}</b></p>}
          <Link href="/driver" className="go">Volver al inicio</Link>
          {list}
        </div>
      ) : (
        <>
          <div className="mapbox">
            <LiveMap routes={mapRoutes} stops={mapStops} focus={route.id} height={360} fitKey={fit} paths={mapPaths} />
            {active && next && (
              <div className="navcard">
                <Ic name="pin" size={30} />
                <div>
                  <b>{toNext !== null ? `A ${fmt(toNext)}` : "Buscando GPS…"}</b>
                  <small>Próximo punto: {next.address || next.code}</small>
                </div>
              </div>
            )}
          </div>

          <div className="maprow">
            {active && next && (
              <>
                <a className="go grow" target="_blank" rel="noreferrer"
                   href={`https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}&travelmode=driving`}>
                  <Ic name="nav" size={18} />Iniciar navegación
                </a>
                <a className="go s" target="_blank" rel="noreferrer"
                   href={`https://waze.com/ul?ll=${next.lat},${next.lng}&navigate=yes`}>Waze</a>
              </>
            )}
            <button type="button" className="iconbtn" aria-label="Centrar mapa" title="Centrar mapa" onClick={() => setFit((n) => n + 1)}>
              <Ic name="target" size={22} />
            </button>
          </div>

          <div className="dpanel">
            <div className="stat"><span>Contenedores restantes</span><b>{stops.length - done} / {stops.length}</b></div>
            <div className="stat">
              <span>Estimado (aprox.)</span>
              <b>{dur(route.durationS * left)} · {km(route.distanceM * left)}</b>
            </div>
            {next && <div className="stat"><span>Próximo</span><b>{next.code}</b></div>}

            {!active && (
              <button disabled={busy} onClick={() => call("start")}>
                {route.status === "paused" ? "Reanudar ruta" : "Iniciar ruta"}
              </button>
            )}

            {active && (
              <>
                <div style={{ color: gps === "ok" ? "var(--mut)" : "#ff8a87", margin: "8px 0 0", fontSize: 14 }}>
                  {gpsText} Mantén esta pantalla abierta.
                </div>

                {next ? (
                  <>
                    <button disabled={busy} onClick={() => record("collected")}>Marcar recogido</button>
                    <div className="btns2">
                      <button className="s" disabled={busy} onClick={() => { setPanel(panel === "skip" ? null : "skip"); setErr(""); }}>No se pudo</button>
                      <button className="danger" disabled={busy} onClick={() => { setPanel(panel === "incident" ? null : "incident"); setErr(""); }}>
                        Reportar incidencia
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "12px 0 0" }}>Registraste todos los contenedores. Ya puedes finalizar la ruta.</p>
                    <button disabled={busy} onClick={() => { if (confirm("¿Finalizar la ruta?")) call("finish"); }}>Finalizar ruta</button>
                    <button className="danger" disabled={busy} onClick={() => { setPanel(panel === "incident" ? null : "incident"); setErr(""); }}>
                      Reportar incidencia
                    </button>
                  </>
                )}

                {panel === "skip" && next && (
                  <div style={{ marginTop: 10 }}>
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                      {REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    {reason === "Otro motivo" && (
                      <input placeholder="¿Qué pasó?" value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} style={{ marginTop: 8 }} />
                    )}
                    <button disabled={busy} style={{ marginTop: 8 }} onClick={skip}>Confirmar “No se pudo”</button>
                  </div>
                )}
                {panel === "incident" && (
                  <div style={{ marginTop: 10 }}>
                    <select value={cat} onChange={(e) => setCat(e.target.value)}>
                      {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <textarea placeholder="Cuéntale al administrador qué pasó" value={desc} maxLength={500}
                              onChange={(e) => setDesc(e.target.value)} />
                    <button disabled={busy} style={{ marginTop: 8 }} onClick={sendIncident}>Enviar incidencia</button>
                  </div>
                )}
              </>
            )}

            {err && <div className="err" role="alert">{err}</div>}
            {msg && <div className="ok" role="status">{msg}</div>}
            {list}
          </div>
        </>
      )}
    </>
  );
}
