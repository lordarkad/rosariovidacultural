import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'

// Cada línea `-- verify: table=X column=Y` de una migración debe existir en el esquema real:
// es la misma comprobación (PRAGMA table_info) que corre el workflow post-merge.
describe('migración 0001_catalogo', () => {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith('0001_catalogo'))

  it('existe y declara líneas -- verify: para cada tabla nueva', () => {
    expect(migration).toBeDefined()
    const sql = migration!.queries.join(';\n')
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1])
    expect(tables.length).toBeGreaterThanOrEqual(7)
    const verified = new Set(
      [...sql.matchAll(/--\s*verify:\s*table=(\w+)\s+column=(\w+)/g)].map((m) => m[1]),
    )
    for (const t of tables) expect(verified, `falta -- verify: para ${t}`).toContain(t)
  })

  it('cada -- verify: table=X column=Y existe según PRAGMA table_info', async () => {
    expect(migration).toBeDefined()
    const sql = migration!.queries.join(';\n')
    const pairs = [...sql.matchAll(/--\s*verify:\s*table=(\w+)\s+column=(\w+)/g)]
    expect(pairs.length).toBeGreaterThanOrEqual(7)
    for (const [, table, column] of pairs) {
      const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
      expect(info.results.map((r) => r.name), `${table}.${column}`).toContain(column)
    }
  })
})
