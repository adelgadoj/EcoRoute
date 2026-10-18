# Fase 4 · Parte A — flujo del conductor y panel en vivo

## 1. Copiar los archivos
Descomprime este ZIP **sobre tu proyecto** (misma estructura). Reemplaza un solo archivo existente:
`apps/web/app/driver/page.tsx`. Todo lo demás es nuevo.

## 2. Aplicar la migración 003
Desde la carpeta raíz del proyecto, con la base levantada (`docker compose up -d db`), en PowerShell:

    Get-Content database\migrations\003_phase4.sql | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

Debe responder `CREATE INDEX`, `ALTER TABLE`, `CREATE INDEX`. (Si ya la aplicaste, dará error de "already exists": no pasa nada.)

## 3. Revisar dos cosas en tu código
- **`apps/web/proxy.ts`**: si restringe `/api/v1/routes/*` solo a administradores, el conductor recibirá 403 al iniciar la ruta.
  Permite a los conductores las rutas `/api/v1/routes/<id>/start|stops|incidents|finish|position`.
- **Menú del panel** (`app/dashboard/layout.tsx`): agrega un enlace a `/dashboard/live` ("Rutas en vivo").

## 4. Probar en tu computadora
1. `cd apps/web` y `npm run dev`.
2. Como admin, crea (o usa) una ruta **asignada a hoy** para el conductor `carlos@demo.pe`.
3. Abre una ventana de incógnito, entra como Carlos en `http://localhost:3000` → `/driver`.
4. Pulsa **Iniciar ruta**. El navegador pide permiso de ubicación: acepta.
5. Para simular movimiento: Chrome → F12 → menú ⋮ → *More tools* → *Sensors* → *Location*, y elige una ciudad o escribe coordenadas.
6. Pulsa **Recogido** / **No se pudo**, reporta una incidencia y finaliza la ruta.
7. En otra ventana, como admin, abre `/dashboard/live`: se actualiza cada 5 segundos.

## Reglas que ya cumple
- Una sola ruta en curso por conductor y por camión (índices de la migración 002; el aviso sale en español).
- Los contenedores se confirman **en orden**; una doble pulsación no registra dos veces (clave de operación + índice único).
- "No se pudo" exige motivo; cada confirmación guarda hora y conductor.
- No se puede finalizar con contenedores sin registrar.
- La fecha de la ruta se compara con la hora de Lima (`America/Lima`, en `start/route.ts`).

## Límites conocidos
- El navegador deja de enviar ubicación con la pantalla bloqueada (la app Expo lo resuelve). La pantalla pide mantenerla abierta e intenta evitar que se apague.
- El GPS del celular solo funciona en páginas con HTTPS (en localhost sí).
- El panel en vivo muestra la última posición con un enlace al mapa. El mapa embebido falta (necesita ver `RouteMap.tsx`).
- Las posiciones GPS se acumulan (una cada 5 s por ruta activa); más adelante conviene una limpieza periódica.
- Probado: tipos y sintaxis revisados con TypeScript. No se ejecutó contra una base real.
