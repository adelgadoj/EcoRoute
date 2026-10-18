# Rediseño · paso 1 (estilos base, menú lateral, inicio y login)
1. Descomprime este zip SOBRE C:\APPS\ecoroute (acepta reemplazar). Sin migraciones ni paquetes nuevos.
2. Con la web corriendo (npm run dev) se actualiza sola; si no, ejecútala desde apps\web.
3. Revisa: /login, /dashboard (menú lateral) y las demás secciones del admin con el estilo nuevo.
Incluye .dockerignore en la raíz para que .env y node_modules no entren a la imagen de Docker.
Cambia estos archivos: app/globals.css, app/login/page.tsx, app/dashboard/layout.tsx, app/dashboard/page.tsx
y agrega components/Logo.tsx, components/icons.tsx, components/SideNav.tsx.
