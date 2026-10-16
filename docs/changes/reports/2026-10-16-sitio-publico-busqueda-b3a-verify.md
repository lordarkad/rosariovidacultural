# Verify — sitio-publico-busqueda (B-3a, clasificador de la ingesta)

- Fecha: 2026-10-16
- Track: app
- Commit base verificado: dd5fca1 (main) + cambios sin commitear de `feat/ingesta-intents`

## Comandos ejecutados
- `npm run lint:spec` → ✅ (una advertencia `security-defined` en `/health`, preexistente)
- `npm test` → ✅ (243 tests, 22 archivos; sin cambios: el slice no toca `apps/`)
- `python -m unittest discover -s tests` (desde `ingestion/`) → ✅ (101 tests; 29 nuevos: `test_intents.py` 17, `test_ingest_payload.py` 12)
- RED confirmado antes de implementar (`ModuleNotFoundError` / función inexistente); un caso falló en GREEN (géneros gateados por `intents` en vez de por categoría) y se corrigió.
- Snyk Code sobre `ingestion/` → 1 hallazgo (ReDoS, `ingestion/site/index.html`, sitio legacy, preexistente); sin hallazgos en el código nuevo.
- Medición sobre `ingestion/site/events.json` (390 registros) → 400 `IngestEvent`, 400 `source_key` únicos; 152 sin intención, 1 `bailar`, 14 con género.

## Cobertura de AC
Este slice (B-3a) no agrega ni modifica AC: no toca `apps/api`, el contrato de `/ingest` ni el spec. Las reglas de clasificación se documentaron en `docs/changes/sitio-publico-busqueda.md` («Decisiones de implementación (B-3a)») y cada una tiene un test en `test_intents.py` / `test_ingest_payload.py`. AC-29 a AC-39 (ingesta) siguen cubiertos por los tests de la API.

## Smoke real (Paso 4.5)
N/A: no toca `apps/api`; el adaptador solo transforma datos, sin red.

## Fuera de lo verificado
- El adaptador **no está conectado** a nada: no se publica a `/ingest` (B-3b) ni se vincula `place_source_key` (B-3c).
- No se validó el payload contra el `IngestEvent` de Zod de la API; los tests chequean los campos a mano.

## Resultado
✅ verificado, con las excepciones documentadas.
