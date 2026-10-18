"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { MapContainer } from "@/components/ContainerMap";

const ContainerMap = dynamic(() => import("@/components/ContainerMap"), { ssr: false });
type C = MapContainer & { address: string | null };
const H = { "Content-Type": "application/json" };

export default function Containers() {
  const [list, setList] = useState<C[]>([]);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/v1/containers"); if (r.ok) setList(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);
  const editing = list.find((c) => c.id === edit);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await fetch("/api/v1/containers", { method: "POST", headers: H, body: JSON.stringify({ code: f.get("code"), address: f.get("address"), lat: pending?.lat, lng: pending?.lng }) });
    const d = await r.json();
    if (r.ok) { form.reset(); setPending(null); setMsg({ t: "Contenedor guardado", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function save(e: React.FormEvent<HTMLFormElement>, c: C) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { code: f.get("code"), address: f.get("address") };
    if (pending) { body.lat = pending.lat; body.lng = pending.lng; }  // solo se mueve si tocaste el mapa
    const r = await fetch(`/api/v1/containers/${c.id}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok) { setEdit(null); setPending(null); setMsg({ t: "Cambios guardados", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function toggle(c: C) {
    await fetch(`/api/v1/containers/${c.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ active: !c.active }) });
    load();
  }
  // CSV con columnas: codigo,lat,lng,direccion (la primera fila puede ser el encabezado)
  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const lines = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length && isNaN(Number(lines[0].split(",")[1]))) lines.shift();
    const rows = lines.map((l) => { const [code, lat, lng, ...rest] = l.split(","); return { code, lat, lng, address: rest.join(",") }; });
    const r = await fetch("/api/v1/containers/import", { method: "POST", headers: H, body: JSON.stringify({ rows }) });
    const d = await r.json();
    if (r.ok) { setMsg({ t: `${d.imported} contenedores importados`, ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }

  return (
    <>
      <h1>Contenedores</h1>
      <div className="card">
        <ContainerMap containers={list} pending={pending} onPick={(lat, lng) => setPending({ lat, lng })} />
        <p style={{ color: "var(--mut)", margin: "8px 0 0" }}>
          {editing
            ? `Editando ${editing.code}: toca el mapa si quieres moverlo${pending ? ` (nueva ubicación ${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)})` : ""}.`
            : `Toca el mapa para elegir la ubicación${pending ? ` (${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)})` : ""}.`}
        </p>
      </div>
      <form className="card" onSubmit={add}>
        <div className="grid2">
          <div><label htmlFor="code">Código</label><input id="code" name="code" placeholder="CT-001" required /></div>
          <div><label htmlFor="addr">Dirección (opcional)</label><input id="addr" name="address" /></div>
        </div>
        {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.t}</p>}
        <button type="submit" disabled={!!edit}>Guardar contenedor</button>
        <label htmlFor="csv" style={{ marginTop: 16 }}>Importar CSV (codigo,lat,lng,direccion)</label>
        <input id="csv" type="file" accept=".csv,text/csv" onChange={importCsv} />
      </form>
      <div className="card">
        <b>{list.length} contenedores</b>
        {list.map((c) => edit === c.id ? (
          <form key={c.id} className="editrow" onSubmit={(e) => save(e, c)}>
            <input name="code" defaultValue={c.code} aria-label="Código" required />
            <input name="address" defaultValue={c.address ?? ""} aria-label="Dirección" placeholder="Dirección" />
            <span style={{ color: "var(--mut)", fontSize: 14 }}>{pending ? "Se moverá al punto del mapa" : "Ubicación sin cambios"}</span>
            <span className="eacts"><button type="submit" className="sm">Guardar</button><button type="button" className="s sm" onClick={() => { setEdit(null); setPending(null); }}>Cancelar</button></span>
          </form>
        ) : (
          <div key={c.id} className={"row" + (c.active ? "" : " off")}>
            <span><b>{c.code}</b> · {c.address || "sin dirección"} · {c.lat.toFixed(5)}, {c.lng.toFixed(5)}</span>
            <span className="eacts"><button className="s sm" onClick={() => { setEdit(c.id); setPending(null); setMsg(null); }}>Editar</button><button className="s sm" onClick={() => toggle(c)}>{c.active ? "Desactivar" : "Activar"}</button></span>
          </div>
        ))}
      </div>
    </>
  );
}
