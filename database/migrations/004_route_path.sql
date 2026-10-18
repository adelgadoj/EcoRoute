-- Trazado de cada ruta por las calles (lista de [lat,lng]). Se calcula la primera vez que se pide y se guarda.
ALTER TABLE routes ADD COLUMN IF NOT EXISTS path JSONB;
