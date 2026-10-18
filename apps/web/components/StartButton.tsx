"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "./icons";

export default function StartButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/v1/routes/${id}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (r.ok) { router.push(`/driver/route/${id}`); return; }
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "No se pudo iniciar la ruta");
      if (r.status === 401) router.push("/login");
    } catch { setErr("Sin conexión. Intenta de nuevo."); }
    setBusy(false);
  }
  return (
    <>
      <button className="go" disabled={busy} onClick={go}><Ic name="nav" size={18} />{busy ? "Iniciando…" : "Iniciar ruta"}</button>
      {err && <div className="err" role="alert">{err}</div>}
    </>
  );
}
