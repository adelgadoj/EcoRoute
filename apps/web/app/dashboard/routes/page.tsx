"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dur, km } from "@/lib/format";

type R = { id: string; name: string; status: string; scheduled_date: string; planned_distance_m: number | null;
  planned_duration_s: number | null; vehicle: string; driver: string; stops: number };
const STATUS: Record<string, [string, string]> = {
  planned: ["Planificada", "#8ea3bd"], assigned: ["Asignada", "#2f8bff"], active: ["En curso", "#22d68a"],
  paused: ["En pausa", "#f5a524"], completed: ["Completada", "#8b5cf6"], cancelled: ["Cancelada", "#ef5350"],
};
const COLOR = { vehicle: "#2f8bff", driver: "#8b5cf6", stops: "#f5a524", km: "#22d68a", time: "#ff6b9a" };

export default function Routes() {
  const [list, setList] = useState<R[]>([]);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/v1/routes"); if (r.ok) setList(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);

  async function cancel(id: string) {
    if (!confirm("¿Cancelar esta ruta? El conductor ya no la verá.")) return;
    const r = await fetch(`/api/v1/routes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    if (r.ok) { setErr(""); load(); } else setErr((await r.json()).error);
  }

  return (
    <>
      <div className="pagehead">
        <h1>Rutas</h1>
        <Link href="/dashboard/routes/new" className="go">Nueva ruta</Link>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="card">
        {list.length === 0 && <span style={{ color: "var(--mut)" }}>Aún no hay rutas. Crea la primera con “Nueva ruta”.</span>}
        {list.map((r) => {
          const [label, color] = STATUS[r.status] ?? [r.status, "#8ea3bd"];
          const open = r.status === "assigned" || r.status === "planned";
          return (
            <div key={r.id} className={"route" + (r.status === "cancelled" ? " off" : "")}>
              <div className="rtop"><b>{r.name}</b><span className="pill2" style={{ color }}><i style={{ background: color }} />{label}</span></div>
              <div className="legend">
                <span><i style={{ background: COLOR.vehicle }} />{r.vehicle}</span>
                <span><i style={{ background: COLOR.driver }} />{r.driver}</span>
                <span><i style={{ background: COLOR.stops }} />{r.stops} contenedores</span>
                {r.planned_distance_m != null && <span><i style={{ background: COLOR.km }} />{km(r.planned_distance_m)}</span>}
                {r.planned_duration_s != null && <span><i style={{ background: COLOR.time }} />{dur(r.planned_duration_s)}</span>}
                <span style={{ color: "var(--mut)" }}>{r.scheduled_date}</span>
              </div>
              <div className="racts">
                {open && <Link className="go s" href={`/dashboard/routes/new?edit=${r.id}`}>Editar</Link>}
                {(r.status === "completed" || r.status === "cancelled") && <Link className="go" href={`/dashboard/routes/new?copy=${r.id}`}>Volver a asignar</Link>}
                {open && <button className="s sm" onClick={() => cancel(r.id)}>Cancelar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
