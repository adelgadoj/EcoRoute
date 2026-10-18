-- Fase 2: turnos por fecha y una sola ruta en curso por conductor y por camión.
ALTER TABLE routes ADD COLUMN scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE UNIQUE INDEX one_open_route_per_driver  ON routes (driver_id)  WHERE status IN ('active','paused');
CREATE UNIQUE INDEX one_open_route_per_vehicle ON routes (vehicle_id) WHERE status IN ('active','paused');
