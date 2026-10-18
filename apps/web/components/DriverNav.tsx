"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ic } from "./icons";

export default function DriverNav({ activeId }: { activeId: string | null }) {
  const path = usePathname();
  const onHome = path === "/driver";
  const onMap = path.startsWith("/driver/route");
  return (
    <nav className="dbar" aria-label="Menú del conductor">
      <Link href="/driver" className={"tab" + (onHome ? " on" : "")} aria-current={onHome ? "page" : undefined}>
        <Ic name="home" size={24} />Inicio
      </Link>
      {activeId ? (
        <Link href={`/driver/route/${activeId}`} className={"tab" + (onMap ? " on" : "")} aria-current={onMap ? "page" : undefined}>
          <Ic name="routes" size={24} />Mapa
        </Link>
      ) : (
        <span className="tab dis" aria-disabled="true"><Ic name="routes" size={24} />Mapa</span>
      )}
      <form action="/api/v1/auth/logout" method="post">
        <button className="tab" type="submit"><Ic name="back" size={24} />Salir</button>
      </form>
    </nav>
  );
}
