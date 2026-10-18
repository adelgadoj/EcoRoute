# Rediseño · paso 3 (mapa azul neón + app del conductor)
Descomprime este zip SOBRE C:\APPS\ecoroute (acepta reemplazar). No hay migraciones ni paquetes nuevos.

Reemplaza: app/globals.css, components/icons.tsx, components/LiveMap.tsx, components/LiveBoard.tsx,
components/RouteRunner.tsx, app/driver/page.tsx, app/dashboard/live/page.tsx.
Nuevos: app/driver/layout.tsx, app/driver/route/[id]/page.tsx, components/DriverNav.tsx, components/StartButton.tsx.

IMPORTANTE: este paso incluye también los cambios del paso 2 (En vivo). Si no habías aplicado el 2, no hace falta.
Prueba: /driver (inicio), "Iniciar ruta" y la pantalla con mapa en /driver/route/<id>. Mejor en una ventana de incógnito.
