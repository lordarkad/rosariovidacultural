# AGENTS.md — Triptongo Engineering Agent Rules

Versión agnóstica de herramienta de las reglas operativas de Triptongo. Compatible con Cursor, Claude Code, Copilot Workspace, y cualquier agente que soporte este formato. Para reglas específicas de Claude Code, ver `CLAUDE.md`.

---

## Stack — Lo que existe aquí

```
Cloudflare Workers + Hono v4       → toda la API
Cloudflare D1 (SQLite, sin ORM)    → base de datos
Vue 3 + PrimeVue 4 + Tailwind v3   → frontend
Pinia                               → estado global
Zod v3 en packages/shared          → validación compartida (GENERADO desde spec)
Vitest v4                          → tests (solo desde root workspace)
Wrangler v4                        → deploy
TypeScript 5.5+ strict             → todo el código
```

No existe React, Express, Prisma, Drizzle, Node.js server, ni options API de Vue. No los introduzcas.

---

## Regla Central: Docs Primero

**Antes de modificar cualquier archivo en `src/`, verifica que `docs/api-spec.yml` ya refleje el cambio.**

```
✅ Orden correcto:   docs/api-spec.yml  →  generate:schemas  →  src/
❌ Orden prohibido:  src/               →  "después actualizo el spec"
```

**Pedido nuevo a mitad de un `/apply` (antes de mergear):** si el comportamiento pedido contradice un AC o el contrato, primero se actualiza la documentación (AC en `docs/changes/<slug>.md`, integrados donde corresponden, no como "bugfix" suelto; si cambia `docs/api-spec.yml`, vuelve a `/ff` con spec PR mergeado) y recién después el código, con `/verify` y `/code-review` re-corridos sobre el diff nuevo. Si en cambio el código no cumple un AC correcto, es un bug: se arregla el código con un test que cite el AC.

---

## Gates por Fase

| Qué quieres hacer | Gate previo requerido |
|---|---|
| Crear o modificar una ruta en `apps/api/src/routes/` | Endpoint en `docs/api-spec.yml` mergeado |
| Crear o modificar un store en `apps/dashboard/src/stores/` | Schema en `docs/api-spec.yml` mergeado |
| Modificar `packages/shared/src/schemas.ts` | **Nunca manualmente** — usar `npm run generate:schemas` |
| Modificar `packages/shared/src/types.ts` | **Nunca manualmente** — derivado de schemas.ts |
| Agregar un componente UI que consume API | Store implementado con contrato aprobado |
| Agregar `*.figma.ts` en `src/figma/` | Componente en producción y estabilizado |
| Cambiar esquema de D1 | Nuevo archivo en `apps/api/migrations/NNNN_desc.sql` |

---

## Comandos Disponibles

| Comando | Qué hace | Output |
|---|---|---|
| `/new-track-app` | Crea el scaffold completo de un nuevo proyecto desde el playbook | Directorio con `npm test` verde — usar una sola vez, antes de todo |
| `/enrich-us` | Expande un requisito con edge cases y preguntas técnicas | Solo texto, nunca código |
| `/ff` | Propone cambios en `docs/api-spec.yml` | Diff de `docs/` únicamente |
| `/apply` | Implementa lo que el spec aprobado ya define | Código en `src/` + tests |
| `/verify` | Valida que implementación respeta el spec | Resultado de lint + drift check + tests |
| `/code-review` | Audita el diff del PR buscando bugs y violaciones del stack | Hallazgos estructurados — usar `ultra` en spec PRs y PRs de billing |

---

## Prohibiciones Absolutas

```
✗  Editar packages/shared/src/schemas.ts manualmente
✗  Editar packages/shared/src/types.ts manualmente
✗  Agregar account_id a wrangler.toml  ← usar CLOUDFLARE_ACCOUNT_ID env var en su lugar (agencia multi-tenant)
✗  Commitear .dev.vars o secrets reales
✗  Escribir SQL fuera de apps/api/migrations/
✗  Usar req.json() sin @hono/zod-validator en una ruta
✗  Retornar objeto sin envelope { success, data/error } desde un endpoint
✗  Crear un store sin loading: boolean y error: string | null
✗  Correr vitest desde un subdirectorio — siempre npm test desde root
✗  Introducir React, Express, Drizzle, Prisma, cualquier ORM
```

---

## Response Envelope

Cada response de la API usa exactamente uno de estos shapes:

```json
{ "success": true, "data": <payload> }
{ "success": false, "error": "<mensaje legible>" }
```

`data` nunca es `null`. `error` siempre es string. No retornar arrays ni objetos naked al top level.

---

## Tests — Scope Estricto

**Testear:** stores Pinia, endpoints Hono (shape del response), funciones puras, validación Zod.
**No testear:** templates Vue, estilos, componentes PrimeVue, snapshots visuales.

Correr siempre desde root:
```bash
npm test          # todos los workspaces
npm run type-check
```

---

## Documentación de Referencia

```
docs/00-playbook.md  → metodología completa y stack canónico (MASTER)
CLAUDE.md                   → reglas extendidas para Claude Code
docs/api-spec.yml           → contrato vigente del API
docs/data-model.md          → modelo de datos conceptual (no ejecuta SQL)
docs/DESIGN.md              → brief de diseño UI (PrimeVue 4 context)
```

Leer el spec antes de leer `src/`. El spec es la fuente de verdad, no el código.
