-- Fase 4: flujo del conductor y seguimiento en vivo.
-- Las tablas gps_positions, collection_events e incidents ya existen (001); aquí solo se endurecen.

-- Un contenedor solo puede quedar "recogido" una vez, aunque lleguen dos pulsaciones con claves distintas.
CREATE UNIQUE INDEX one_collected_event_per_stop ON collection_events (route_stop_id) WHERE result = 'collected';

-- "No se pudo" siempre lleva motivo (NOT VALID: no revisa filas antiguas, sí las nuevas).
ALTER TABLE collection_events ADD CONSTRAINT reason_required_when_unable
  CHECK (result = 'collected' OR length(btrim(coalesce(reason, ''))) > 0) NOT VALID;

-- Incidencias abiertas, para el panel en vivo.
CREATE INDEX incidents_open_idx ON incidents (organization_id, created_at DESC) WHERE status <> 'resolved';
