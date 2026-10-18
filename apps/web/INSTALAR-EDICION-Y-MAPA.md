# Edición, rutas con colores, mapa simple y GPS cada 3 s
1. Descomprime este zip SOBRE C:\APPS\ecoroute (acepta reemplazar).
2. Instala el nuevo motor de mapas, desde C:\APPS\ecoroute\apps\web:
     npm install maplibre-gl
3. Si aún no aplicaste la migración 004 (del zip anterior), aplícala desde C:\APPS\ecoroute:
     Get-Content database\migrations\004_route_path.sql | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
4. Reinicia la web (Ctrl+C y npm run dev).
Si el mapa te sale muy cargado de nombres, en components/LiveMap.tsx pon SHOW_STREET_NAMES = false.
