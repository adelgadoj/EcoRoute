# Ajustes: rutas por las calles, mapa sin líneas y detalles del conductor
1. Descomprime este zip SOBRE C:\APPS\ecoroute (acepta reemplazar).
2. Aplica la migración nueva (desde C:\APPS\ecoroute):
   Get-Content database\migrations\004_route_path.sql | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
3. Reinicia la web (Ctrl+C y npm run dev). No hay paquetes nuevos.
Las rutas ya creadas se trazan por las calles la primera vez que alguien las abre; luego queda guardado.
