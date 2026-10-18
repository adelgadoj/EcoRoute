import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { Ic } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = (await readSession((await cookies()).get(COOKIE)?.value))!;
  const me = await pool.query("SELECT full_name FROM users WHERE id = $1", [s.userId]);
  const { rows } = await pool.query(
    `SELECT o.name,
       (SELECT count(*) FROM routes     WHERE organization_id = o.id AND status = 'active')::int AS active_routes,
       (SELECT count(*) FROM vehicles   WHERE organization_id = o.id AND active)::int AS vehicles,
       (SELECT count(*) FROM memberships WHERE organization_id = o.id AND role = 'driver')::int AS drivers,
       (SELECT count(*) FROM containers WHERE organization_id = o.id AND active)::int AS containers
     FROM organizations o WHERE o.id = $1`, [s.orgId]);
  const o = rows[0];
  const today = new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeZone: "America/Lima" }).format(new Date());
  const first = String(me.rows[0]?.full_name ?? "").split(" ")[0];

  return (
    <>
      <h1>Hola, {first}</h1>
      <p className="sub">{o.name} · {today}</p>
      <div className="kpis">
        <div className="kpi"><span className="kic green"><Ic name="live" size={24} /></span><div><b>{o.active_routes}</b><span>Rutas en curso</span></div></div>
        <div className="kpi"><span className="kic blue"><Ic name="truck" size={24} /></span><div><b>{o.vehicles}</b><span>Camiones activos</span></div></div>
        <div className="kpi"><span className="kic orange"><Ic name="users" size={24} /></span><div><b>{o.drivers}</b><span>Conductores</span></div></div>
        <div className="kpi"><span className="kic purple"><Ic name="bin" size={24} /></span><div><b>{o.containers}</b><span>Contenedores activos</span></div></div>
      </div>
      <div className="actions">
        <Link href="/dashboard/live"><b>Ver rutas en vivo</b><span>Mapa con los camiones, el avance y las incidencias.</span></Link>
        <Link href="/dashboard/routes/new"><b>Crear una ruta</b><span>Elige contenedores, ordénalos y asígnalos a un conductor.</span></Link>
      </div>
    </>
  );
}
