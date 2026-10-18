# EcoRoute · Fase 1 (fundación + acceso)

## Probar en local (necesitas Docker y Node 20)
1. `cp .env.example .env` y completa `JWT_SECRET` (`openssl rand -base64 48`) y la clave de la base.
2. `docker compose up -d db` (crea las tablas con `database/migrations/001_initial.sql`).
3. `cd apps/web && npm install`
4. Crea tu primer usuario:
   `node --env-file=../../.env scripts/create-user.mjs --org "Municipalidad Demo" --email admin@demo.pe --name "Admin Demo" --role admin --password "UnaClaveLarga123"`
   y otro con `--role driver` para el conductor.
5. `npm run dev` y abre http://localhost:3000. El admin entra a /dashboard y el conductor a /driver.

## En el VPS
`docker compose up -d --build` y pon Nginx con HTTPS delante del puerto 3000.
Cuando uses HTTPS, `COOKIE_SECURE=true`. La base solo escucha en 127.0.0.1.
Si cambias la migración, el volumen ya creado no la vuelve a ejecutar.

## Pendiente antes de abrirlo a internet
Límite de intentos de login, filtrar por organización en cada consulta nueva,
auditoría y copias de seguridad de la base.
# EcoRoute
