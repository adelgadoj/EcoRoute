import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { dur } from "@/lib/format";
import Logo from "@/components/Logo";
import { Ic } from "@/components/icons";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";
const COLORS = ["#18b56a", "#2f8bff", "#8b5cf6", "#f5a524", "#8ea3bd"]; // mismos colores del panel En vivo
const TEXT = ["#04160e", "#ffffff", "#ffffff", "#2b1a00", "#04160e"]; // letra de cada círculo, legible sobre su color

export default async function Driver() {
  const s = (await readSession((await cookies()).get(COOKIE)?.value))!;
  const me = await pool.query("SELECT full_name FROM users WHERE id = $1", [s.userId]);
  // Rutas pendientes o en curso, y las finalizadas en las últimas 12 horas (para ver el resumen).
  const routes = (await pool.query(
    `SELECT r.id, r.name, r.status, to_char(r.scheduled_date, 'YYYY-MM-DD') AS date, r.planned_duration_s,
            v.code AS vehicle, (SELECT count(*) FROM route_stops st WHERE st.route_id = r.id)::int AS stops
       FROM routes r JOIN vehicles v ON v.organization_id = r.organization_id AND v.id = r.vehicle_id
      WHERE r.organization_id = $1 AND r.driver_id = $2
        AND (r.status IN ('assigned','active','paused')
             OR (r.status = 'completed' AND r.completed_at > now() - interval '12 hours'))
      ORDER BY r.scheduled_date, r.created_at`, [s.orgId, s.userId])).rows;
  const name = String(me.rows[0]?.full_name ?? "");
  const open = routes.filter((r) => r.status !== "completed").length;
  const today = new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeZone: "America/Lima" }).format(new Date());

  return (
    <>
      <div className="dhead">
        <Logo size={42} />
        <div><b>EcoRoute</b><small>Conductor</small></div>
        <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      </div>
      <h1 style={{ marginBottom: 4 }}>Hola, {name.split(" ")[0]}</h1>
      <p className="sub" style={{ margin: 0 }}>
        {open === 0 ? "No tienes rutas pendientes" : `Tienes ${open} ${open === 1 ? "ruta asignada" : "rutas asignadas"}`}
      </p>
      <div className="datecard"><Ic name="cal" size={26} /><div><b>{today}</b></div></div>

      <h2>Rutas asignadas</h2>
      {routes.length === 0 && <div className="card">Aún no tienes una ruta asignada. Cuando el administrador te asigne una, aparecerá aquí.</div>}
      {routes.map((r, i) => (
        <div key={r.id} className="rcard rtc" style={{ ["--rc" as string]: COLORS[i % COLORS.length], ["--rt" as string]: TEXT[i % TEXT.length], cursor: "default" }}>
          <div className="rhead">
            <span className="rbadge">R{i + 1}</span>
            <div><b>{r.name}</b><span>{r.date} · Camión {r.vehicle}</span></div>
          </div>
          <div className="meta"><Ic name="pin" size={18} />{r.stops} puntos de recolección</div>
          <div className="meta"><Ic name="clock" size={18} />Aprox. {dur(r.planned_duration_s ?? 0)}</div>
          <div className="acts">
            {r.status === "assigned" && <StartButton id={r.id} />}
            {(r.status === "active" || r.status === "paused") && (
              <Link href={`/driver/route/${r.id}`} className="go"><Ic name="nav" size={18} />{r.status === "paused" ? "Reanudar" : "Continuar ruta"}</Link>
            )}
            {r.status === "completed" && <Link href={`/driver/route/${r.id}`} className="go s"><Ic name="check" size={18} />Ver resumen</Link>}
          </div>
        </div>
      ))}

      <div className="cheer">
        <Logo size={36} />
        <div><b>Tu trabajo hace una ciudad más limpia</b><span>¡Gracias por ser parte del cambio!</span></div>
      </div>
    </>
  );
}
