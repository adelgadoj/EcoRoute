"use client";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/v1/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
    });
    const d = await r.json();
    if (r.ok) window.location.href = d.redirect; else { setError(d.error); setBusy(false); }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <Logo size={56} />
          <div><h1>EcoRoute</h1><span>Operaciones de recolección</span></div>
        </div>
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Ingresando..." : "Ingresar"}</button>
      </form>
    </main>
  );
}
