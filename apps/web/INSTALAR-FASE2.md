# Fase 2 · cómo instalarla (Windows, PowerShell)

1. Descomprime este zip **sobre** C:\APPS\ecoroute (acepta reemplazar archivos).
   No incluye tu .env, .env.local ni next.config.mjs, así que no se pierden.
2. Aplica la migración nueva a tu base (desde C:\APPS\ecoroute):
   Get-Content database\migrations\002_phase2.sql | docker compose exec -T db psql -U ecoroute -d ecoroute
   (si cambiaste POSTGRES_USER en el .env, usa ese usuario y base)
3. Instala el mapa (desde C:\APPS\ecoroute\apps\web):
   npm install leaflet@1.9.4
   npm install -D @types/leaflet
4. Si estaba corriendo, detén con Ctrl+C y ejecuta: npm run dev
5. Entra como admin: verás Camiones, Conductores y Contenedores.
