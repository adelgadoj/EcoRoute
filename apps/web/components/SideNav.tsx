"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { Ic, type IconName } from "./icons";

const ITEMS: [string, string, IconName][] = [
  ["/dashboard", "Inicio", "home"],
  ["/dashboard/live", "En vivo", "live"],
  ["/dashboard/routes", "Rutas", "routes"],
  ["/dashboard/vehicles", "Camiones", "truck"],
  ["/dashboard/drivers", "Conductores", "users"],
  ["/dashboard/containers", "Contenedores", "bin"],
];

export default function SideNav() {
  const path = usePathname();
  return (
    <aside className="side">
      <div className="brand">
        <Logo size={40} />
        <div><b>EcoRoute</b><small>Ciudades más limpias</small></div>
      </div>
      <nav aria-label="Secciones">
        {ITEMS.map(([href, label, icon]) => {
          const on = href === "/dashboard" ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
              <Ic name={icon} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="push">
        <div className="promo"><b>Juntos por un mejor ambiente</b>Una ciudad limpia empieza con una buena gestión.</div>
        <form action="/api/v1/auth/logout" method="post"><button className="s sm" style={{ width: "100%" }}>Cerrar sesión</button></form>
      </div>
    </aside>
  );
}
