import { cookies } from "next/headers";
import { COOKIE, readSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import DriverNav from "@/components/DriverNav";

export const dynamic = "force-dynamic";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  let activeId: string | null = null;
  if (s) {
    const r = await pool.query(
      `SELECT id FROM routes WHERE organization_id = $1 AND driver_id = $2 AND status IN ('active','paused')
        ORDER BY started_at DESC NULLS LAST LIMIT 1`, [s.orgId, s.userId]);
    activeId = r.rows[0]?.id ?? null;
  }
  return <div className="dapp">{children}<DriverNav activeId={activeId} /></div>;
}
