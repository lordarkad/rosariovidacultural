-- Catalogo del Slice 1 (ADR 0002): zonas, lugares, eventos y sus claves de fuente.
-- Convenciones: fechas locales como YYYY-MM-DD, instantes como ISO UTC con milisegundos y Z,
-- arrays como JSON en columnas TEXT, booleanos como INTEGER 0 o 1.
-- Sin claves foraneas: la integridad la garantiza la ingesta dentro de un batch atomico de D1.
-- No usar punto y coma dentro de comentarios ni de strings.

-- verify: table=zones column=radius_m
CREATE TABLE IF NOT EXISTS zones (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('barrio', 'localidad')),
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  radius_m    INTEGER NOT NULL CHECK (radius_m >= 100),
  sort_order  INTEGER NOT NULL
);

-- verify: table=places column=name_norm
CREATE TABLE IF NOT EXISTS places (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  id            TEXT NOT NULL UNIQUE,
  source_key    TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  name_norm     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('restaurante', 'bar', 'cafe', 'heladeria', 'comida_rapida', 'sala', 'otro')),
  origin        TEXT NOT NULL CHECK (origin IN ('curated', 'osm')),
  intents       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(intents)),
  offers        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(offers)),
  cuisine       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(cuisine)),
  address       TEXT,
  address_norm  TEXT,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  opening_hours TEXT CHECK (opening_hours IS NULL OR json_valid(opening_hours)),
  hours_text    TEXT,
  phone         TEXT,
  website       TEXT,
  instagram     TEXT,
  outdoor       INTEGER CHECK (outdoor IS NULL OR outdoor IN (0, 1)),
  note          TEXT,
  image_url     TEXT,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_places_coords ON places (lat, lon);
CREATE INDEX IF NOT EXISTS idx_places_name_norm ON places (name_norm);

-- Todas las claves conocidas de un lugar (la canonica y los alias absorbidos). Unicidad global.
-- verify: table=place_keys column=place_id
CREATE TABLE IF NOT EXISTS place_keys (
  source_key  TEXT PRIMARY KEY,
  place_id    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_place_keys_place ON place_keys (place_id);

-- Ids de lugares absorbidos por una fusion: siguen resolviendo al lugar vigente.
-- verify: table=place_id_redirects column=place_id
CREATE TABLE IF NOT EXISTS place_id_redirects (
  old_id    TEXT PRIMARY KEY,
  place_id  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_place_redirects_target ON place_id_redirects (place_id);

-- verify: table=events column=starts_at_utc
CREATE TABLE IF NOT EXISTS events (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT NOT NULL UNIQUE,
  source_key        TEXT NOT NULL UNIQUE,
  source_name       TEXT NOT NULL,
  source_tier       TEXT NOT NULL CHECK (source_tier IN ('curated', 'official', 'aggregator')),
  source_url        TEXT NOT NULL,
  via_json          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(via_json)),
  title             TEXT NOT NULL,
  title_norm        TEXT NOT NULL,
  description       TEXT,
  intents           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(intents)),
  music_genres      TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(music_genres)),
  start_date        TEXT NOT NULL,
  end_date          TEXT NOT NULL,
  start_time        TEXT,
  starts_at_utc     TEXT,
  date_text         TEXT,
  venue_name        TEXT,
  venue_norm        TEXT,
  address           TEXT,
  address_norm      TEXT,
  lat               REAL,
  lon               REAL,
  place_source_key  TEXT,
  price_status      TEXT NOT NULL CHECK (price_status IN ('free', 'paid', 'unknown')),
  price_from_ars    INTEGER CHECK (price_from_ars IS NULL OR price_from_ars >= 0),
  image_url         TEXT,
  created_at        TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  CHECK (end_date >= start_date),
  CHECK ((lat IS NULL) = (lon IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_events_title_date ON events (title_norm, start_date);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_last_seen ON events (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_events_place_key ON events (place_source_key);
CREATE INDEX IF NOT EXISTS idx_events_coords ON events (lat, lon);

-- Fuentes de cada evento (la primaria y las vias). Unicidad global de source_key.
-- verify: table=event_sources column=source_tier
CREATE TABLE IF NOT EXISTS event_sources (
  arrival      INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key   TEXT NOT NULL UNIQUE,
  event_id     TEXT NOT NULL,
  source_name  TEXT NOT NULL,
  source_tier  TEXT NOT NULL CHECK (source_tier IN ('curated', 'official', 'aggregator')),
  source_url   TEXT NOT NULL,
  via_json     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(via_json))
);
CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources (event_id);
CREATE INDEX IF NOT EXISTS idx_event_sources_url ON event_sources (source_url);

-- Ids de eventos absorbidos por una fusion: siguen resolviendo al evento vigente.
-- verify: table=event_id_redirects column=event_id
CREATE TABLE IF NOT EXISTS event_id_redirects (
  old_id    TEXT PRIMARY KEY,
  event_id  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_redirects_target ON event_id_redirects (event_id);

-- Zonas aprobadas el 2026-10-02 (centros del bbox de OSM, Centro en Plaza 25 de Mayo).
INSERT OR IGNORE INTO zones (id, name, kind, lat, lon, radius_m, sort_order) VALUES
  ('centro', 'Centro', 'barrio', -32.9469, -60.6393, 1200, 1),
  ('pichincha', 'Pichincha', 'barrio', -32.9373, -60.6585, 800, 2),
  ('echesortu', 'Echesortu', 'barrio', -32.9444, -60.6799, 1000, 3),
  ('alberdi', 'Alberdi', 'barrio', -32.8908, -60.7008, 1500, 4),
  ('fisherton', 'Fisherton', 'barrio', -32.9223, -60.7529, 1800, 5),
  ('abasto', 'Abasto', 'barrio', -32.9613, -60.6477, 800, 6),
  ('las-flores', 'Las Flores', 'barrio', -33.0178, -60.6575, 800, 7),
  ('puerto-norte', 'Puerto Norte', 'barrio', -32.9259, -60.6607, 800, 8),
  ('funes', 'Funes', 'localidad', -32.9262, -60.8164, 3000, 9),
  ('roldan', 'Roldán', 'localidad', -32.9041, -60.9031, 3000, 10),
  ('baigorria', 'Baigorria', 'localidad', -32.8538, -60.7137, 2500, 11),
  ('villa-gobernador-galvez', 'Villa Gobernador Gálvez', 'localidad', -33.0216, -60.6220, 3500, 12),
  ('perez', 'Pérez', 'localidad', -32.9887, -60.7769, 3000, 13);
