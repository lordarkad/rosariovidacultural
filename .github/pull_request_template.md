## Cambio

<!-- Una oración: qué cambia y por qué -->

## Tipo

- [ ] `spec/` — contrato (requiere `/code-review ultra` antes de abrir)
- [ ] `feat/` — implementación estándar
- [ ] `feat/` — billing / auth / datos sensibles (requiere `/code-review ultra`)
- [ ] `fix/` — bugfix puntual
- [ ] `chore/` — deps, config, docs

## Checklist

- [ ] `npm run lint:spec` pasa
- [ ] `npm run generate:types && git diff --exit-code` sin drift
- [ ] `npm run type-check` sin errores
- [ ] `npm test` verde en todos los workspaces
- [ ] No hay `account_id` hardcodeado en `wrangler.toml`
- [ ] No hay secrets en archivos commiteados (no `.dev.vars`)
- [ ] `/code-review` corrió sobre este diff
