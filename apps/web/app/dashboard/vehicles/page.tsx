"use client";
import { useCallback, useEffect, useState } from "react";

type V = { id: string; code: string; plate: string; capacity_kg: string | null; active: boolean };
const H = { "Content-Type": "application/json" };

export default function Vehicles() {
  const [list, setList] = useState<V[]>([]);
  const [edit, setEdit] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/v1/vehicles"); if (r.ok) setList(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await fetch("/api/v1/vehicles", { method: "POST", headers: H, body: JSON.stringify({ code: f.get("code"), plate: f.get("plate"), capacity_kg: f.get("capacity_kg") }) });
    const d = await r.json();
    if (r.ok) { form.reset(); setMsg({ t: "Camión guardado", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function save(e: React.FormEvent<HTMLFormElement>, v: V) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/v1/vehicles/${v.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ code: f.get("code"), plate: f.get("plate"), capacity_kg: f.get("capacity_kg") }) });
    const d = await r.json();
    if (r.ok) { setEdit(null); setMsg({ t: "Cambios guardados", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function toggle(v: V) {
    await fetch(`/api/v1/vehicles/${v.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ active: !v.active }) });
    load();
  }

  return (
    <>
      <h1>Camiones</h1>
      <form className="card" onSubmit={add}>
        <div className="grid2">
          <div><label htmlFor="code">Código</label><input id="code" name="code" placeholder="C-04" required /></div>
          <div><label htmlFor="plate">Placa</label><input id="plate" name="plate" placeholder="ABC-123" required /></div>
        </div>
        <label htmlFor="cap">Capacidad (kg, opcional)</label><input id="cap" name="capacity_kg" type="number" min="1" step="any" />
        {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.t}</p>}
        <button type="submit">Agregar camión</button>
      </form>
      <div className="card">
        {list.length === 0 && <span style={{ color: "var(--mut)" }}>Aún no hay camiones. Agrega el primero arriba.</span>}
        {list.map((v) => edit === v.id ? (
          <form key={v.id} className="editrow" onSubmit={(e) => save(e, v)}>
            <input name="code" defaultValue={v.code} aria-label="Código" required />
            <input name="plate" defaultValue={v.plate} aria-label="Placa" required />
            <input name="capacity_kg" type="number" min="1" step="any" defaultValue={v.capacity_kg ? Number(v.capacity_kg) : ""} aria-label="Capacidad en kg" placeholder="kg" />
            <span className="eacts"><button type="submit" className="sm">Guardar</button><button type="button" className="s sm" onClick={() => setEdit(null)}>Cancelar</button></span>
          </form>
        ) : (
          <div key={v.id} className={"row" + (v.active ? "" : " off")}>
            <span><b>{v.code}</b> · {v.plate}{v.capacity_kg ? ` · ${Number(v.capacity_kg)} kg` : ""}</span>
            <span className="eacts"><button className="s sm" onClick={() => { setEdit(v.id); setMsg(null); }}>Editar</button><button className="s sm" onClick={() => toggle(v)}>{v.active ? "Desactivar" : "Activar"}</button></span>
          </div>
        ))}
      </div>
    </>
  );
}
