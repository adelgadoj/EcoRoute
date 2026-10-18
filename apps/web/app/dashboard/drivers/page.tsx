"use client";
import { useCallback, useEffect, useState } from "react";

type D = { id: string; full_name: string; email: string; active: boolean };
const H = { "Content-Type": "application/json" };

export default function Drivers() {
  const [list, setList] = useState<D[]>([]);
  const [edit, setEdit] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/v1/drivers"); if (r.ok) setList(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await fetch("/api/v1/drivers", { method: "POST", headers: H, body: JSON.stringify({ full_name: f.get("full_name"), email: f.get("email"), password: f.get("password") }) });
    const d = await r.json();
    if (r.ok) { form.reset(); setMsg({ t: "Conductor creado. Entrégale su correo y contraseña.", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function save(e: React.FormEvent<HTMLFormElement>, x: D) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/v1/drivers/${x.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ full_name: f.get("full_name"), email: f.get("email"), password: f.get("password") }) });
    const d = await r.json();
    if (r.ok) { setEdit(null); setMsg({ t: "Cambios guardados", ok: true }); load(); } else setMsg({ t: d.error, ok: false });
  }
  async function toggle(x: D) {
    await fetch(`/api/v1/drivers/${x.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ active: !x.active }) });
    load();
  }

  return (
    <>
      <h1>Conductores</h1>
      <form className="card" onSubmit={add}>
        <label htmlFor="n">Nombre completo</label><input id="n" name="full_name" required />
        <div className="grid2">
          <div><label htmlFor="e">Correo</label><input id="e" name="email" type="email" autoComplete="off" required /></div>
          <div><label htmlFor="p">Contraseña (mín. 10)</label><input id="p" name="password" type="text" minLength={10} autoComplete="off" required /></div>
        </div>
        {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.t}</p>}
        <button type="submit">Crear conductor</button>
      </form>
      <div className="card">
        {list.length === 0 && <span style={{ color: "var(--mut)" }}>Aún no hay conductores.</span>}
        {list.map((d) => edit === d.id ? (
          <form key={d.id} className="editrow" onSubmit={(e) => save(e, d)}>
            <input name="full_name" defaultValue={d.full_name} aria-label="Nombre completo" required />
            <input name="email" type="email" defaultValue={d.email} aria-label="Correo" autoComplete="off" required />
            <input name="password" type="text" minLength={10} autoComplete="off" aria-label="Nueva contraseña (opcional)" placeholder="Nueva contraseña (opcional)" />
            <span className="eacts"><button type="submit" className="sm">Guardar</button><button type="button" className="s sm" onClick={() => setEdit(null)}>Cancelar</button></span>
          </form>
        ) : (
          <div key={d.id} className={"row" + (d.active ? "" : " off")}>
            <span><b>{d.full_name}</b> · {d.email}</span>
            <span className="eacts"><button className="s sm" onClick={() => { setEdit(d.id); setMsg(null); }}>Editar</button><button className="s sm" onClick={() => toggle(d)}>{d.active ? "Desactivar" : "Activar"}</button></span>
          </div>
        ))}
      </div>
    </>
  );
}
