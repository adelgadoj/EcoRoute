import RouteForm from "@/components/RouteForm";
import { UUID } from "@/lib/stops";

export const dynamic = "force-dynamic";

// /dashboard/routes/new            -> ruta nueva
// /dashboard/routes/new?edit=<id>  -> editar una ruta que aún no empezó
// /dashboard/routes/new?copy=<id>  -> volver a asignar (crea una ruta nueva a partir de otra)
export default async function NewRoute({ searchParams }: { searchParams: Promise<{ edit?: string; copy?: string }> }) {
  const q = await searchParams;
  const ok = (v?: string) => (v && UUID.test(v) ? v : undefined);
  return <RouteForm editId={ok(q.edit)} copyId={ok(q.copy)} />;
}
