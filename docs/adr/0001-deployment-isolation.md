# ADR 0001 — Aislamiento de secrets y deployment

- **Estado:** Aceptado · 2026-09-29

## Decisión

- SSH private keys y tokens de terceros van **solo en GitHub Actions secrets** — nunca en D1, nunca en el control plane.
- **D1 almacena únicamente metadata no-secreta.**
- Los secrets del Worker (`INGEST_TOKEN`) van en `wrangler secret put` — nunca en `wrangler.toml` ni en archivos commiteados.
- `CLOUDFLARE_ACCOUNT_ID` se setea via env var (shell o CI secret) — **nunca en `wrangler.toml`**.
- `.dev.vars` está en `.gitignore`; `.dev.vars.example` documenta qué vars se necesitan sin valores reales.

## Consecuencias

- El job de ingesta (GitHub Actions) recibe `INGEST_TOKEN` de GH Actions secrets, no del Worker.
- El Worker solo expone endpoints de la API — no maneja secrets de infraestructura.
