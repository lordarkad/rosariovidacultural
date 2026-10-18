-- Lugar propio de cada fuente de un evento (F-18, E-10)
-- Cada fuente conserva el place_source_key que trajo. La fila de events usa el de la canonica
-- y, si no tiene, hereda el del alias de mayor tier que lo trae.

-- verify: table=event_sources column=place_source_key
ALTER TABLE event_sources ADD COLUMN place_source_key TEXT;

-- Relleno de las filas existentes: la fuente canonica (la que da su source_key a events) recibe el lugar
-- de su evento. Los alias quedan en NULL y se completan cuando su fuente los reenvia.
UPDATE event_sources
   SET place_source_key = (
         SELECT e.place_source_key FROM events e
          WHERE e.id = event_sources.event_id AND e.source_key = event_sources.source_key)
 WHERE place_source_key IS NULL;
