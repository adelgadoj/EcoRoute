"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dur, km } from "@/lib/format";
import type { Pin } from "@/components/RouteMap";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });
type C = Pin & { active: boolean };
type V = { id: string; code: string; plate: string; active: boolean };
type D = { id: string; full_name: string; active: boolean };
type Stats = { distance_m: number; duration_s: number; estimated: boolean };
const today = () => new Date().toLocaleDateString("en-CA");

// editId: edita una ruta que aún no empezó. copyId: crea una ruta nueva a partir de otra (volver a asignar).
export default function RouteForm({ editId, copyId }: { editId?: string; copyId?: string }) {
  const router = useRouter();
  const src = editId ?? copyId;
  const [vehicles, setVehicles] = useState<V[]>([]);
  const [drivers, setDrivers] = useState<D[]>([]);
  const [containers, setContainers] = useState<C[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [path, setPath] = useState<[number, number][] | null>(null); // trazado por calles tras ordenar
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const [v, d, c] = await Promise.all(["vehicles", "drivers", "containers"].map((p) => fetch(`/api/v1/${p}`).then((r) => r.json())));
      if (off) return;
      const act = (c as C[]).filter((x) => x.active);
      setVehicles((v as V[]).filter((x) => x.active)); setDrivers((d as D[]).filter((x) => x.active)); setContainers(act);
      if (!src) return;
      const r = await fetch(`/api/v1/routes/${src}`);
      if (off) return;
      if (!r.ok) { setMsg("No se pudo cargar la ruta"); return; }
      const j = await r.json();
      setName(j.name); setDate(editId ? j.scheduled_date : today()); setVehicleId(j.vehicle_id); setDriverId(j.driver_id);
      const ok = new Set(act.map((x) => x.id));
      const ids = (j.container_ids as string[]).filter((id) => ok.has(id));
      setSel(ids);
      if (ids.length < j.container_ids.length) setMsg(`Se quitaron ${j.container_ids.length - ids.length} contenedores desactivados.`);
    })();
    return () => { off = true; };
  }, [src, editId]);

  const change = (ids: string[]) => { setSel(ids); setStats(null); setPath(null); setMsg(""); };
  const toggle = (id: string) => change(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const move = (i: number, d: number) => { const a = [...sel], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; change(a); };
  const code = (id: string) => containers.find((c) => c.id === id)?.code ?? id;

  async function auto() {
    if (sel.length < 2) return setMsg("Elige al menos 2 contenedores para ordenarlos");
    setBusy(true); setMsg("");
    const r = await fetch("/api/v1/routes/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ container_ids: sel }) });
    const d = await r.json();
    if (r.ok) { setSel(d.container_ids); setStats(d); setPath(d.path ?? null); } else setMsg(d.error);
    setBusy(false);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await fetch(editId ? `/api/v1/routes/${editId}` : "/api/v1/routes", {
      method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scheduled_date: date, vehicle_id: vehicleId, driver_id: driverId, container_ids: sel }),
    });
    const d = await r.json();
    if (r.ok) router.push("/dashboard/routes"); else { setMsg(d.error); setBusy(false); }
  }

  const title = editId ? "Editar ruta" : copyId ? "Volver a asignar ruta" : "Nueva ruta";
  return (
    <>
      <h1>{title}</h1>
      {copyId && <p className="sub">Se creará una ruta nueva con los mismos contenedores. La anterior y su historial no cambian. Puedes cambiar el conductor, el camión, la fecha o los contenedores.</p>}
      <div className="card">
        <RouteMap containers={containers} selected={sel} onToggle={toggle} path={path} />
        <p style={{ color: "var(--mut)", margin: "8px 0 0" }}>Toca los contenedores en el orden en que se recogerán. El primero es el punto de partida.</p>
      </div>
      <div className="card">
        <b>{sel.length} contenedores elegidos</b>
        {sel.map((id, i) => (
          <div key={id} className="row">
            <span><b>{i + 1}.</b> {code(id)}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="s sm" aria-label="Subir" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="s sm" aria-label="Bajar" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="s sm" onClick={() => toggle(id)}>Quitar</button>
            </span>
          </div>
        ))}
        <button type="button" className="s" onClick={auto} disabled={busy}>Ordenar automáticamente</button>
        {stats && (
          <p className="ok" role="status">
            {km(stats.distance_m)} · {dur(stats.duration_s)} aprox.
            {stats.estimated && " (estimación aproximada: el servicio de rutas no respondió)"}
          </p>
        )}
      </div>
      <form className="card" onSubmit={save}>
        <div className="grid2">
          <div><label htmlFor="name">Nombre de la ruta</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ruta Norte" required /></div>
          <div><label htmlFor="date">Fecha</label><input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label htmlFor="vehicle">Camión</label>
            <select id="vehicle" required value={vehicles.some((v) => v.id === vehicleId) ? vehicleId : ""} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="" disabled>Elige un camión</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.plate}</option>)}</select></div>
          <div><label htmlFor="driver">Conductor</label>
            <select id="driver" required value={drivers.some((d) => d.id === driverId) ? driverId : ""} onChange={(e) => setDriverId(e.target.value)}>
              <option value="" disabled>Elige un conductor</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <button type="submit" disabled={busy || sel.length === 0}>{editId ? "Guardar cambios" : "Guardar y asignar ruta"}</button>
      </form>
    </>
  );
}
