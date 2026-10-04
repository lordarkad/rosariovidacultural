Track: app

> **Repo:** `rosariovidacultural` — Agregador de planes en Rosario (eventos, espacios, lugares): sitio público + panel admin.
> **Cuenta Cloudflare:** Triptongo (account ID en `CLOUDFLARE_ACCOUNT_ID` env var, nunca en archivos commiteados)

# CLAUDE.md — Triptongo Engineering Agent Rules

Este archivo gobierna el comportamiento de Claude Code (y cualquier agente IA compatible) en todos los monorepos de Triptongo Enterprise. Copia este archivo a la raíz de cada nuevo monorepo sin modificarlo.

**Nota para agentes IA — dónde corregir un problema de proceso.** Si estás en un Track App y encontrás una copia de este archivo (idéntica hasta la sección `## Datos del Proyecto` al final, que sí es específica del repo), y el usuario pide corregir algo "de raíz", "para todos los proyectos", o "que no se repita en el futuro" — eso significa editar este archivo (y los comandos correspondientes en `commands/`, `tracks/`) en el repo playbook (`triptongo-dev-playbook`), no la copia local. Editar solo la copia local resuelve el síntoma en ese repo pero dos días después otro Track App repite el mismo problema porque nunca leyó la fuente. *(Motivo: incidente real, proyecto `pas`, 2026-08-19 — se corrigió primero la copia local antes de tocar el playbook.)*

---

## Stack Declarado

Este proyecto usa exclusivamente:

- **Runtime:** Cloudflare Workers
- **API:** Hono v4 + `@hono/zod-validator`
- **DB:** Cloudflare D1 (raw queries, sin ORM)
- **Frontend:** Vue 3 (Composition API, SFCs)
- **UI:** PrimeVue 4 + Tailwind CSS v3
- **Estado:** Pinia (stores con `loading` + `error` siempre)
- **Validación:** Zod v3 en `packages/shared` — generado desde spec, nunca escrito a mano
- **Tests:** Vitest v4 desde el root workspace
- **Deploy:** Wrangler v4
- **Scope interno:** `@tript/`

**PROHIBIDO introducir:** React, Next.js, Express, Fastify, Prisma, Drizzle, cualquier ORM, `fetch` sin tipos, `any` explícito, Options API de Vue.

---

## Perfil del Proyecto

La sección `## Datos del Proyecto` (al final de este archivo) declara dos campos que fijan la **base de UI**. No cambian el rigor de los gates: ese lo marcan el nivel 0–3 (`tracks/app/00-playbook.md` Fase 1A) y la elección del owner.

- **Relación:** `interna` (la usa el equipo de Triptongo para operar la agencia) · `producto propio` · `cliente` · `personal`.
- **Tecnología de UI:** se deriva del track (`app`, `data`, `wp-traditional`); un sitio estático sin framework es `static`.

| Relación | Base de UI |
|---|---|
| `interna` | `Triptongo UI Seed v1.0` + `@triptongo/ui`, **obligatorios** (DoD `docs/11` §5) |
| `cliente` | Escenario A–D de `docs/design-system/design-engagement-scenarios.md` |
| `producto propio` / `personal` | Preset PrimeVue por defecto, un color de marca, una tipografía, dark mode sí/no |
| Tecnología `static` | Archivo de tokens CSS, sin PrimeVue |

El scaffold de `/new-track-app` sigue trayendo `@triptongo/ui` como punto de partida técnico (ADR 0003). «Obligatorio» para `interna` significa que la semilla es **la base y se audita** (DoD, remapeo en Figma); en las demás relaciones el paquete es reemplazable por un preset propio y **no se audita contra la semilla**.

Un perfil por repo; si una app del monorepo difiere, se declara solo esa excepción. Si el repo no declara perfil, se asume `interna` y se le pregunta al owner (`/tript-wireframe-brief`, Fase A). El owner cambia el perfil editando esta sección con fecha y motivo. Detalle y origen: `docs/13-sop-figma-design-make-claude.md` §9b.

---

## OpenSpec Gate — Reglas de Modificación de Archivos

### PROHIBIDO sin aprobación previa del spec:

```
NUNCA modificar archivos en:
  apps/api/src/routes/
  apps/api/src/index.ts
  packages/shared/src/schemas.ts   ← archivo generado, no editar manualmente
  packages/shared/src/types.ts     ← archivo derivado, no editar manualmente
  apps/dashboard/src/stores/
  apps/dashboard/src/services/

...si docs/api-spec.yml no refleja ya el contrato correspondiente.
```

**La verificación es:** ¿existe en `docs/api-spec.yml` el endpoint o schema que estás implementando? Si no existe, el primer paso es editar el spec, no el código.

### PERMITIDO sin spec previo:

```
docs/              ← siempre editable (es el primer paso)
wireframes/        ← input externo del owner, no gateado por el spec
apps/api/migrations/   ← nuevas migraciones D1
apps/dashboard/src/components/   ← componentes UI puros sin contrato API
apps/dashboard/src/views/        ← vistas, siempre que el store ya tenga el contrato
.github/
*.config.ts / *.config.js
wrangler.toml
```

### NUNCA, bajo ninguna circunstancia:

- Editar `packages/shared/src/schemas.ts` o `types.ts` manualmente. Estos son archivos generados.
- Agregar `account_id` a `wrangler.toml`. Triptongo es una agencia con múltiples cuentas de cliente — el account ID se setea via `CLOUDFLARE_ACCOUNT_ID` en el entorno (shell o CI secret), nunca hardcodeado en archivos commiteados.
- Commitear `.dev.vars` o cualquier archivo con secrets reales.
- Escribir SQL fuera de `apps/api/migrations/`.
- Usar `req.json()` sin `zValidator` en una ruta Hono.
- Retornar un objeto naked (sin envelope `{ success, data/error }`) desde un endpoint.
- Agregar `loading` o `error` opcionales en un store — son requeridos siempre.
- Correr `vitest` desde un subdirectorio — siempre desde el root con `npm test`.

---

## Comandos de Agente

### `/new-track-app <nombre> [track=app|data] [account=triptongo|construshop] ["descripción"]`

**Propósito:** Crear el scaffold completo de un nuevo proyecto Track App desde cero, con todos los archivos canónicos del playbook, npm test verde, y listo para `/enrich-us`.
**Output esperado:** Directorio con estructura completa, `npm test` 2/2 verde (health + 404), `npm run lint:spec` pasa.
**Regla:** Se ejecuta **una sola vez por repo, antes de cualquier otra cosa**. No escribe rutas de dominio ni stores — esos quedan gateados por el spec.
**Instalación:** copiar `commands/new-track-app.md` de este playbook a `~/.claude/commands/` para uso global.

```
Argumentos (en orden, separados por espacio):
  1. nombre-del-proyecto  (kebab-case, requerido)
  2. track                (app | data, default: app)
  3. account              (triptongo | construshop, default: triptongo)
  4. "descripción"        (texto libre, opcional)

Ejemplo:
  /new-track-app tript-billing-v2 app triptongo "Nuevo módulo de facturación"
```

---

### `/enrich-us [descripción de feature]`

**Propósito:** Expandir un requisito con preguntas técnicas, edge cases, y decisiones de diseño.
**Output esperado:** Lista de preguntas/decisiones, nunca código.
**Regla:** Si el output contiene código fuente, el comando fue mal ejecutado.
**Regla de wireframes:** si el requisito es Nivel 2/3 (página/vista nueva, rediseño estructural, componente interactivo nuevo — ver tabla de niveles en `tracks/app/00-playbook.md` §Fase 1A), debe existir ya un wireframe del owner en `wireframes/` (más su validación con el cliente en `docs/`, si la hay): o lo entregó el owner, o lo generó `/tript-wireframe-brief` (entrevista) y el owner lo aprobó explícitamente. Si no existe, es un gap bloqueante; los supuestos sin confirmar de una entrevista se listan como gaps (§D). Nivel 0/1 y slices puramente backend sin superficie de UI están exceptuados.

```
Ejemplo de prompt interno:
"Analiza este requisito y lista: (1) edge cases no mencionados, (2) decisiones de diseño
que el tech lead debe tomar antes de escribir el spec, (3) dependencias con otros módulos.
No escribas código. Output: texto estructurado para review humano."
```

---

### `/tript-wireframe-brief [slug opcional]`

**Propósito:** (A) fijar la base de UI según el perfil del proyecto, y (B) si el owner no entrega los wireframes, generarlos con una entrevista de opciones concretas, con lista de supuestos.
**Cuándo:** antes de `/enrich-us`, en cualquier requisito Nivel 2/3. Nivel 0/1 y slices solo backend no aplican.
**Regla:** **siempre** le pregunta al owner si entrega los wireframes o prefiere la entrevista — en proyectos personales y en los que no lo son. Los wireframes generados solo cuentan como «del owner» con su aprobación explícita.
**Output:** `wireframes/` (HTML en grises), `wireframes/README.md` (decisiones + supuestos), entrada «Baseline» y registro de aprobación en `docs/DESIGN.md`; opcionalmente `wireframes/make-prompt.md` para Figma Make.
**Instalación:** copiar `commands/tript-wireframe-brief.md` de este playbook a `~/.claude/commands/` para uso global.

---

### `/ff [descripción de cambio]`

**Propósito:** Fast-forward — proponer cambios en `docs/api-spec.yml` dado un requisito ya enriquecido.
**Output esperado:** Diff de `docs/api-spec.yml` con el nuevo endpoint/schema.
**Regla:** Solo modifica archivos en `docs/`. Si el output toca `src/`, el comando fue mal ejecutado.
**Regla de wireframes:** para slices Nivel 2/3 (ver `tracks/app/00-playbook.md` §Fase 1A), sin wireframe del owner (entregado por él, o generado con `/tript-wireframe-brief` y aprobado por él) o su validación con el cliente cubriendo la pantalla del slice, `/ff` no avanza. Nivel 0/1 no lo requieren. Excepción: slices puramente backend sin superficie de UI.

**Script equivalente (post-edición):**
```bash
npm run lint:spec
# Verificar manualmente que el envelope canónico esté presente en cada response
```

---

### `/apply`

**Propósito:** Implementar lo que ya está aprobado en `docs/api-spec.yml`.
**Precondición obligatoria:** El spec PR debe estar mergeado en `main` antes de ejecutar.
**Secuencia que ejecuta:**

```bash
# 1. Regenerar schemas desde el spec aprobado
npm run generate:schemas

# 2. Verificar sin drift
git diff --exit-code packages/shared/src/schemas.ts

# 3. RED — escribir los tests desde los acceptance criteria del slice (docs/changes/)
#    y confirmar que fallan por la razón correcta. No escribir implementación todavía.
# 4. GREEN — implementar rutas (apps/api/src/routes/) y stores (apps/dashboard/src/stores/)
#    hasta que los tests pasen
# 4.5. Loop de autocorrección acotado (máx. 3 intentos): lint:spec + type-check + test,
#      diagnosticar el error exacto antes de cada fix. Al 3er intento en rojo, parar y
#      reportar — nunca corre migraciones remotas ni deploy (ver commands/apply.md §9.5)
# 5. REFACTOR — limpiar con los tests en verde
# 5.5. Cierre — invoca /verify automáticamente sobre el mismo slice (ver commands/apply.md §10.5).
#      Un fallo de /verify no reintenta solo: se reporta y se decide (fix a mano o volver a /ff).
# 5.6. Cierre — invoca /code-review automáticamente sobre el diff (ver commands/apply.md §10.6):
#      estándar, o el fallback ultra en el propio proceso si el slice toca billing/auth/datos
#      sensibles. Nunca dispara el /code-review ultra pago — eso sigue siendo decisión del usuario.
npm test
```

**Regla:** Si `generate:schemas` falla o produce un diff inesperado, detener y reportar — no parchear `schemas.ts` a mano.
**Regla TDD:** Los acceptance criteria de `/ff` son los tests. No se escribe código de implementación antes de que exista su test que falla. Cada AC se mapea a uno o más tests que lo referencian por nombre (`[AC-N]`).
**Regla del loop de autocorrección:** acotado a 3 intentos y solo contra checks locales/reversibles (`lint:spec`, `type-check`, `test`).
**Regla de `/verify` automático:** `/apply` ya no termina en REFACTOR — cierra invocando `/verify` sobre el mismo slice y devuelve un solo reporte consolidado. Deja de ser un paso manual que dependía de que el usuario se acordara de correrlo.
**Regla de `/code-review` automático:** `/apply` también cierra invocando `/code-review` sobre el diff — mismo motivo que `/verify`. Usa el nivel estándar o el fallback `ultra` en el propio proceso (nunca el pago) según la tabla de nivel por tipo de PR de la sección `/code-review` más abajo.

**Regla de cambios posteriores al `/apply`:** un pedido nuevo que aparece **después de arrancar `/apply` y antes de mergear el PR de implementación** se trata primero como cambio de documentación, no como un "arreglalo rápido" en código. El criterio para distinguirlo:
- **El código no cumple un AC que sigue siendo correcto** → es un bug: se corrige el código con un test que cite ese AC. No hay cambio de spec.
- **Lo que se quiere ahora es distinto de lo que dice un AC o el contrato** → es un cambio de spec, y el orden es: (1) actualizar los AC afectados en `docs/changes/<slug>.md`, integrándolos en la sección que les corresponde — nunca como una tarea suelta de "bugfix" al final —; (2) si cambia el contrato de `docs/api-spec.yml`, **parar**: vuelve a `/ff` con su propio spec PR mergeado antes de seguir (el gate de siempre, no se negocia por estar a mitad de un `/apply`); (3) recién con los docs al día, RED → GREEN sobre el AC nuevo; (4) volver a correr `/verify` y `/code-review` sobre el diff resultante — el review de una versión anterior no cubre el diff nuevo.
Nunca aplicar un fix solo en código cuando el comportamiento pedido contradice lo documentado: deja al spec mintiendo y rompe la regla de que el código implementa el spec, no al revés.

---

### `/verify`

**Propósito:** Confirmar que la implementación respeta el spec y el envelope canónico.
**Ejecuta en orden:**

```bash
npm run lint:spec                              # spec válido y con reglas de Triptongo
npm run generate:schemas                      # schemas regenerables sin cambios
git diff --exit-code packages/shared/src/schemas.ts  # sin drift
npm run type-check                            # TypeScript sin errores
npm test                                      # todos los workspaces
```

Si alguno falla, reportar exactamente qué falló y por qué antes de proponer un fix.

---

### `/qa-visual [qué verificar y contra qué URL]`

**Propósito:** Verificar en un navegador real (Playwright) lo recién implementado, o reproducir un bug, sin contaminar el hilo principal.
**Cómo funciona:** Delega a un subagente `qa-visual` (Haiku) que maneja Playwright MCP y devuelve solo un reporte pass/fail — los snapshots quedan en su contexto, no en el del hilo principal.
**Cuándo:** Después de `/apply` (sobre todo si el slice tocó UI), o cuando un error necesita comprobarse en el browser. `/apply` lo recuerda al cerrar.
**Postura:** No-destructivo por defecto. Mutaciones solo en dev local y con autorización explícita; contra producción, solo smoke read-only.
**Regla:** Nunca manejar Playwright MCP en el hilo principal — siempre vía este subagente. Complementa a Vitest, no lo reemplaza.
**Instalación:** `cp agents/qa-visual.md ~/.claude/agents/` y `cp commands/qa-visual.md ~/.claude/commands/`.
**Setup:** si el repo todavía no tiene el MCP de Playwright configurado, ver `tracks/app/00-playbook.md` §7.7 antes de invocar.

---

### `/code-review [--comment] [--fix]`

**Propósito:** Auditar el diff actual buscando bugs de correctitud, violaciones de las reglas del stack, y oportunidades de simplificación.
**Regla:** No mergear ningún PR sin haber corrido al menos `/code-review` sobre el diff. Para spec PRs, `/code-review ultra` es obligatorio.
**Auto-disparo desde `/apply`:** para el flujo estándar (`/ff` → `/apply`), `/apply` ya invoca este comando solo al cerrar — ver `commands/apply.md` §10.6. Esta sección sigue aplicando tal cual para todo lo que `/apply` no cubre: spec PRs (siempre `ultra`, corridos a mano tras `/ff`), y cualquier PR que no salga de un `/apply` (hotfixes directos, chores).
**Regla del agente:** esta responsabilidad es proactiva, no reactiva — el agente debe avisar explícitamente el estado del review ("esto todavía no tiene review, ¿lo corro antes de que mergees?") antes de que el usuario mergee un PR, sin esperar a que el usuario lo pregunte. Si el usuario ya mergeó sin que corriera ningún review, el agente lo señala igual y ofrece correrlo retroactivamente sobre el diff ya mergeado antes de construir más código encima.

**Nivel por tipo de PR:**

| Tipo de PR | Comando |
|---|---|
| `spec/` (solo docs) | `/code-review ultra` — auditoría multi-agente del contrato |
| `feat/` implementación estándar | `/code-review` |
| `feat/` billing, auth, o datos sensibles | `/code-review ultra` |
| `fix/` bugfix puntual | `/code-review` |
| `chore/` deps, config | `/code-review low` |

**Flags:**
- `--comment` — postea los hallazgos como comentarios inline en el PR de GitHub
- `--fix` — aplica los fixes automáticamente al working tree

**Integración con el flujo:**
- En spec PRs: correr antes de abrir el PR, después de `npm run lint:spec`
- En feat PRs: correr después de `/verify`, antes de pedir revisión humana

**Motor de revisión — agente `tript-code-reviewer`:**
`/code-review` despacha el agente `tript-code-reviewer` (vía la tool `Agent`) sobre el diff. El agente revisa contra las reglas Triptongo (envelope, gate OpenSpec, snake_case, archivos generados, stores con loading/error, stack prohibido, DoD visual de UI — `docs/10`/`docs/11` §5) y busca bugs reales, reportando solo issues con confidence ≥80.
- **Nivel estándar:** un agente `tript-code-reviewer` sobre el `git diff`, con el `model: sonnet` default del agente. Es una decisión explícita de costo (ver "Costo del fallback" abajo), no un downgrade accidental: si un PR estándar amerita más rigor en bugs/correctitud, el agente puede pasar `model: opus` como override puntual en esa invocación de la tool `Agent`.
- **Nivel `ultra`:** lanzar varios agentes en paralelo con focos distintos — (1) reglas Triptongo + envelope, (2) bugs/correctitud (con foco en operaciones async de Kinsta e idempotencia de callbacks), (3) simplicidad/DRY, y (4) alineación spec↔código — contra los acceptance criteria de `docs/changes/<slug>.md` y `docs/api-spec.yml`: ¿cada AC tiene un test `[AC-N]` que realmente lo prueba (no solo el camino feliz)?, ¿el código hace lo que dice el spec (status codes, campos, envelope), y qué falla aunque el autor crea que pasa? El foco (4) solo aplica si el diff implementa un slice con AC (un `feat/`/`fix/` que sale de `/apply`); en spec PRs (solo docs) y `chore/` se omite y corren los otros 3. Consolidar los hallazgos y presentar los de mayor severidad primero. El nivel estándar no cambia: un solo agente, sin el foco (4) — la cobertura de AC ya la cubre `/verify`, y el foco (4) es lo que agrega el nivel `ultra` sobre esa base.

**Fallback sin créditos de `/code-review ultra`:** el comando en la nube `/code-review ultra` es facturado y solo lo puede disparar el usuario — el agente no puede invocarlo por su cuenta. Cuando no hay créditos disponibles (o el usuario prefiere no gastarlos) pero el PR igual requiere nivel `ultra` (spec PR, o `feat/` de billing/auth/datos sensibles), el agente puede correr una revisión equivalente en el propio proceso: lanzar 3 agentes `tript-code-reviewer` en paralelo vía la tool `Agent` (4 si aplica el foco de alineación spec↔código), cada uno con uno de los focos de arriba, y consolidar los hallazgos exactamente igual que con `ultra` (mayor severidad primero, solo confidence ≥80). No reemplaza a `/code-review ultra` cuando sí hay créditos — es la alternativa cuando no los hay.

**Costo del fallback — dos reglas para que no salga más caro que `ultra` en la nube:**
1. **Modelo por foco:** lanzar el agente del foco (2) bugs/correctitud con override `model: opus` en la tool `Agent`. Los focos (1) reglas Triptongo, (3) simplicidad/DRY y (4) alineación spec↔código van con el `model: sonnet` default del agente — son verificación mayormente mecánica contra `CLAUDE.md`, opus no agrega precisión que compense el costo, y triplicarlo en opus es lo que hacía más caro este fallback que `/code-review ultra` en la nube.
2. **Contexto una sola vez, no triplicado:** antes de lanzar los agentes, correr `git diff` una vez en el hilo principal y armar el prompt de cada uno con ese diff más el/los extracto(s) de `CLAUDE.md` (y `docs/10`/`docs/11` §5 si el diff toca UI) relevantes al foco de ese agente, pegados inline; al agente del foco (4), además, los AC del slice (`docs/changes/<slug>.md`) y los operationIds del spec que el diff implementa. No lanzar los agentes con tools de exploración abierta para que cada uno redescubra por su cuenta el mismo `CLAUDE.md`/spec/docs — eso multiplica la misma lectura por la cantidad de agentes. Los agentes conservan `Grep`/`Read` para lo puntual que el diff no cubra (un archivo referenciado, código relacionado fuera del diff).

Instalar el agente: `cp agents/*.md ~/.claude/agents/` (ver guía de onboarding). **Importante tras cualquier cambio a `agents/tript-code-reviewer.md` (como el de "Costo del fallback" arriba):** volver a correr ese `cp` en cada copia local del playbook — la copia instalada en `~/.claude/agents/` no se actualiza sola, así que sin este paso el fallback sigue corriendo con el modelo/tools viejos aunque este archivo ya diga lo contrario.

---

### `/tript-project-status [slug-del-proyecto opcional]`

**Propósito:** Generar o actualizar `docs/status-<proyecto>.html` — un artifact vivo, interactivo y jargon-free (resumen + stats, áreas relevadas, alcance como acordeón por área, y pendientes en tarjetas filtrables por de quién depende avanzar) para que vos y el cliente tengan una foto clara del proyecto sin leer el Business Spec completo.
**Output esperado:** HTML self-contained (CSS embebido, paleta crema/verde fija sin variante dark — ver `commands/tript-project-status.md` §Formato de output), siempre con la misma estructura de secciones, publicado además como Artifact (link compartible, ver `commands/tript-project-status.md` §Publicación) — cada corrida re-publica sobre el mismo link vía `docs/status-<proyecto>.artifact-url.txt`, nunca crea uno nuevo si ya existe.
**Regla:** Nunca inventa una definición sin respaldo en Business Spec/Minuta/decisión registrada — lo que está en discusión va a "Qué falta definir", no a "Qué ya definimos". No toca la sección "Notas" salvo pedido explícito. Un solo archivo por proyecto, nunca copias versionadas a mano.
**Cuándo:** Después de cualquier decisión nueva de la Parte 0 (o de scope más adelante). Si ya se corrió antes en el proyecto y aparece una decisión nueva, correrlo de nuevo proactivamente sin esperar a que se pida.
**Instalación:** copiar `commands/tript-project-status.md` de este playbook a `~/.claude/commands/` para uso global.

---

### `/tript-validar-spec [slug-del-proyecto opcional]`

**Propósito:** Generar `docs/business-spec-<proyecto>.html` — el Business Spec **completo** en HTML navegable, con el que recorrer el documento junto al cliente y cerrar la **Etapa F (Aprobación registrada)** de la Parte 0.
**Output esperado:** HTML self-contained (salvo la hoja de Google Fonts), con las 12 secciones del Spec sin recortar, cada regla de negocio como tarjeta propia con su código RN visible y un botón "Marcar" — lo marcado se junta en una lista copiable al pie, que es el registro de ajustes pendientes de la reunión. Publicado además como Artifact vía `docs/business-spec-<proyecto>.artifact-url.txt`, mismo link entre rondas.
**Regla:** Fidelidad literal sobre síntesis — el cliente aprueba exactamente lo que dice el Spec, así que las reglas van completas, no reescritas para acortar. Se saca la mecánica interna del playbook (rutas, nombres de comandos, "slice"), pero **los códigos RN se conservan**: son lo que permite decir "volvamos a la RN-38" en la reunión.
**Cuándo:** Antes de la reunión de Etapa F, con el Spec ya enriquecido (Etapa D) y los wireframes ya mostrados (Etapa E). De nuevo después de aplicar los ajustes pedidos, para la re-validación.
**No confundir con `/tript-project-status`:** ese es el resumen condensado y jargon-free, transversal a toda la Parte 0. Este es el documento entero, para la validación puntual de la Etapa F.
**Instalación:** copiar `commands/tript-validar-spec.md` de este playbook a `~/.claude/commands/` para uso global.

---

## Hook `guard-gh-pr-merge` — enforcement técnico del gate de review

La regla «no mergear sin `/code-review` sobre el diff exacto» (sección `/code-review`) tiene un enforcement técnico opcional: el hook `PreToolUse` `hooks/guard-gh-pr-merge.sh`. Bloquea cualquier `gh pr merge` que ejecute Claude Code si no existe un marcador de review para el **commit SHA exacto** del PR. Un commit nuevo en la rama deja el marcador viejo sin efecto: el review de una versión anterior no cubre el diff nuevo.

**Qué NO cubre:** merges hechos desde la UI de GitHub o desde tu propia terminal — ahí el único gate es la disciplina de no ofrecer ni asumir el merge sin haber revisado antes. El hook tampoco corre `/code-review`: solo verifica que alguien lo corrió y dejó el marcador.

**Instalación (una vez por máquina):**
```bash
mkdir -p ~/.claude/hooks && cp hooks/guard-gh-pr-merge.sh ~/.claude/hooks/
```
Y registrarlo en `~/.claude/settings.json` (mezclar con el bloque `hooks` si ya existe; usar la ruta absoluta si `$HOME` no se expande en tu shell):
```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash", "hooks": [ { "type": "command", "command": "bash \"$HOME/.claude/hooks/guard-gh-pr-merge.sh\"" } ] }
  ]
}
```
Requiere `bash`, `node` y `gh` en el PATH (en Windows, git-bash). Los marcadores viven en `<carpeta del hook>/../review-log/<slug>/`, donde `<slug>` es la ruta de la raíz del repo con todo carácter no alfanumérico reemplazado por `_`.

**Después de un review limpio**, escribir el marcador. No derivar el slug a mano: correr el `gh pr merge` y copiar el comando exacto del mensaje de bloqueo.

**Cómo decide:** parsea el JSON del hook con `node` (no con `grep`), resuelve el repo desde un `cd` previo o `--repo`, y **bloquea ante la duda** (fail-closed): JSON ilegible, `gh` que no resuelve el PR, merge anidado en `bash -c`, o `node`/`gh` ausentes.

**Limitación conocida — falso positivo por diseño:** el hook inspecciona el *texto* del comando, no su ejecución. Cualquier comando Bash que contenga `gh pr merge`, aunque solo lo mencione (un heredoc, un `echo`, un `grep`, un script de prueba inline, una nota o un commit message), se bloquea igual. Es el costo de ser fail-closed: distinguir «lo ejecuta» de «lo menciona» exige un parser de shell completo, y equivocarse en ese sentido deja pasar un merge sin review. **Si te bloquea algo que no es un merge real:** escribir ese texto con `Write`/`Edit` (no pasan por el hook) o guardarlo en un archivo y ejecutar el archivo. No aflojar el matcheo sin revisar la superficie de evasión (`bash -c`, subshells, variables, `cd` previo); el test `falso positivo por diseño` fija este comportamiento a propósito.

**Tests:** `node --test hooks/guard-gh-pr-merge.test.mjs` (Node 24+, sin dependencias; usa un `gh` falso y un config dir temporal, nunca toca el real). Correrlos tras cualquier cambio al hook y **volver a copiar** `hooks/guard-gh-pr-merge.sh` a `~/.claude/hooks/` — la copia instalada no se actualiza sola.

*(Origen: incidente real, 2026-10-04 — la primera versión sacaba el comando del JSON con `grep` y se cortaba en la primera comilla escapada, así que `cd "ruta" && gh pr merge N` pasaba sin bloqueo (fail-open). Cinco merges cross-repo se hicieron sin que el hook actuara, y nadie lo notó porque no había tests.)*

---

## Post-Merge: Deploy y Migraciones (automatizado vía workflow reusable)

**Mergear un PR de implementación a `main` no significa que está en producción por sí solo** — pero en cualquier repo que ya tenga instalado el workflow reusable de post-merge, mergear a `main` **sí** dispara automáticamente deploy a staging + migraciones D1 + verificación de esquema real, sin que el agente ni el humano tengan que acordarse de correr nada a mano. Esto reemplaza un incidente real: 3 semanas de dashboard desactualizado + 4 migraciones nunca aplicadas en producción rompieron el login, sin ningún error visible hasta que un usuario reportó no poder loguearse.

**Cómo funciona (cuando el repo tiene el workflow instalado):**

1. Cada repo tiene un caller delgado en `.github/workflows/deploy.yml` (ver plantilla en `commands/new-track-app.md`) que referencia `Triptongo/triptongo-ci-shared/.github/workflows/post-merge-deploy.yml@main` — la lógica real vive en un solo lugar, nunca copiada por repo. Ese workflow vive en un repo **separado y público** (`triptongo-ci-shared`, no acá) porque un reusable workflow privado solo puede ser invocado por repos del mismo owner de GitHub — necesario para que Track Apps fuera de la org Triptongo (proyectos personales, repos de clientes bajo otra cuenta) puedan seguir usándolo. No tiene nada sensible: todo credential/valor de ambiente entra vía `secrets:`/`inputs:` del repo llamador (ver 2026-09-04, movido desde acá tras el caso OrbitalDash).
2. Push a `main` → job `deploy-staging` corre solo: migraciones D1 contra la base de staging, verificación `PRAGMA table_info` por cada migración que declare una línea `-- verify: table=X column=Y` (ver `commands/apply.md` paso 4), y recién después el deploy del Worker/dashboard que cambiaron — en ese orden, para que el código nuevo nunca corra contra un schema que la migración todavía no aplicó.
3. **Producción no es parte de este flujo automático.** Es un workflow aparte, `.github/workflows/deploy-production.yml`, de disparo manual (`workflow_dispatch`: `Actions → Deploy (production) → Run workflow`, con un `ref` opcional). Es la regla en todos los repos de Triptongo: `Required reviewers` de los Environments no existe en repos privados con plan gratuito, y el click explícito después de mirar staging es el gate. Nada llega a producción sin que una persona lo corra.
4. Si la verificación PRAGMA falla en cualquiera de los dos ambientes, el job falla en rojo — visible en la pestaña Actions, no depende de que alguien lea un mensaje de chat.

**Rol del agente:** al reportar el cierre de un `/apply`, recordar que el deploy a staging es automático y que producción se despliega a mano corriendo `deploy-production.yml` (ver `commands/apply.md` paso 13) — no ejecutar deploy manualmente en un repo que ya tiene este workflow.

**Desvío local — producción en este repo (verificado 2026-10-04):** lo anterior sobre producción describe el estado objetivo del playbook, no el de este repo. Acá **no existe `deploy-production.yml`** ni disparo manual: `.github/workflows/deploy.yml` todavía encadena el job `deploy-production` (`needs: [changes, deploy-staging]`, `environment: production`), y los Environments no tienen reglas de protección (sin `Required reviewers`). Mientras no se migre al modelo del playbook, **un merge a `main` despliega también a producción**: al reportar el cierre de un `/apply`, decirlo así, no «producción espera un click».

**Si el repo todavía NO tiene el workflow instalado** (repos creados antes de esta convención, o migración pendiente — ver tarea de sync canónico entre repos): sigue aplicando el procedimiento manual. Apenas el usuario confirma que un PR se mergeó, el agente:
1. Sincroniza `main` localmente y borra la rama (local + remota).
2. Si tocó `apps/api/`: corre el deploy del Worker. Si tocó `apps/dashboard/`: corre el deploy del dashboard.
3. Si agregó una migración: corre `wrangler d1 migrations apply <db> --remote`.
4. Verifica con un smoke check real y `PRAGMA table_info(<tabla>)` — nunca asume que exit code 0 alcanza.
5. Si no tiene credenciales/`CLOUDFLARE_ACCOUNT_ID` en el entorno, lo dice explícitamente y pide confirmación al usuario — nunca asume silenciosamente que ya pasó.

**Nota — la tabla `d1_migrations` puede mentir**, automatizado o no: puede marcar una migración como "aplicada" en su bookkeeping sin que el DDL real haya corrido (reproducido en producción: `wrangler d1 migrations list --remote` decía que una migración ya estaba aplicada, y la columna que debía crear no existía). `PRAGMA table_info` contra la tabla real es la fuente de verdad, nunca la tabla de tracking de Wrangler — por eso el workflow reusable verifica así, no confiando en `migrations list`.

---

## Reglas de Testing

- Vitest **siempre** se ejecuta desde el root: `npm test`
- **Testear:** Pinia stores, endpoints Hono (shape de response), funciones puras en `packages/shared`, validación Zod.
- **No testear:** Templates Vue, estilos CSS, comportamiento visual de PrimeVue, integraciones Figma.
- **D1 real vs. mock:** un mock manual de D1 no ejecuta SQL real — no detecta columnas ambiguas en un `JOIN`, errores de sintaxis, ni typos de columna/tabla. Todo endpoint cuya query haga `JOIN` entre 2+ tablas necesita además cobertura contra D1 real (`@cloudflare/vitest-pool-workers`, migraciones aplicadas), no solo mock — un endpoint sobre una sola tabla puede seguir solo con mock. Detalle y gotcha real en `tracks/app/00-playbook.md` §Fase 6.
- **QA visual / E2E interactivo:** no manejar el MCP de Playwright en el hilo principal. Delegar al subagente `qa-visual` (Haiku) vía `/qa-visual` o la tool `Agent` — el navegador devuelve snapshots/DOM que, en el hilo principal, quedan en contexto el resto de la sesión e inflan el costo. El subagente absorbe ese ruido y devuelve solo pass/fail. Aplica tanto para verificar lo recién implementado como para reproducir un bug en el navegador. No reemplaza a Vitest (la lógica pura sigue en Vitest).
- Environment: `node` para `apps/api`, `jsdom` o `happy-dom` para `apps/dashboard`.
- El alias `@tript/shared` se resuelve via `vitest.config.ts` en cada workspace — no instalar dependencias cruzadas.

---

## Reglas de Response Envelope

Todo response de un endpoint Hono debe usar exactamente uno de estos shapes:

```ts
// Éxito
return c.json({ success: true, data: payload })

// Error
return c.json({ success: false, error: 'Mensaje legible' }, statusCode)
```

- `data` nunca es `null` en éxito — usar `{}` si no hay payload.
- `error` es siempre `string` — nunca objeto, nunca array.
- Listas: `data` es el array directamente.
- HTTP 200 con `success: false` está prohibido — usar el status code correcto (4xx).

---

## Reglas de Pinia Stores

```ts
state: () => ({
  items: [] as EntityType[],
  loading: false,        // REQUERIDO
  error: null as string | null,  // REQUERIDO
})
```

- `loading` y `error` son **obligatorios** en todo store, no opcionales.
- Las actions siempre hacen `loading = true` al inicio y `loading = false` en `finally`.
- Las actions capturan errores y los asignan a `this.error` — nunca throws sin capturar.
- Nombre de archivo: `<domain>.store.ts`.

---

## Reglas de `packages/shared`

- `schemas.ts`: generado por `openapi-to-zod`. **No editar manualmente.**
- `types.ts`: derivado con `z.infer<>`. **No editar manualmente.**
- `index.ts`: re-exporta todo. Sí editable para agregar/quitar exports.
- Sin dependencias externas excepto `zod`.
- Sin código de framework (no Vue, no Hono). Debe ser importable desde ambos contextos.

---

## Contexto para Nuevos Agentes

Si eres un agente nuevo en este repo, lee en este orden:
1. Este archivo (`CLAUDE.md`) — reglas operativas
2. `docs/00-playbook.md` — contexto de stack y metodología completa
3. `docs/api-spec.yml` — contrato actual del API
4. `docs/data-model.md` — modelo de datos conceptual
5. `packages/shared/src/schemas.ts` — schemas Zod vigentes

No leas `src/` para entender el contrato — lee el spec. El código implementa el spec, no al revés.

---

## Datos del Proyecto

- **Nombre:** `rosariovidacultural`
- **Track:** app
- **Relación:** personal <!-- declarado 2026-10-03; fija la base de UI: preset PrimeVue propio, sin auditoría contra `Triptongo UI Seed v1.0` -->
- **Tecnología de UI:** app
- **Cuenta:** Triptongo
- **Descripción:** Agregador de planes en Rosario (eventos, espacios, lugares): sitio público + panel admin.
- **Creado:** 2026-09-29

## Particularidades de este repo

- **`ingestion/`** (Python, ADR 0002): scrapers de 11 fuentes + tests (`python -m unittest discover -s tests` desde `ingestion/`). Corren en GitHub Actions y publican a la API por un endpoint de ingesta autenticado. `ingestion/site/` es el sitio estático legacy — sirve de referencia visual/prototipo hasta que el dashboard lo reemplace; no es el wireframe del owner (ver `wireframes/`).
- El resto del repo sigue el Track App al pie de la letra.
