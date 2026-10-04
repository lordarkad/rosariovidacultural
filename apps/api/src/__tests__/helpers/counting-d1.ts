import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'

export interface D1Calls {
  /** Llamadas a la API de D1: `batch`, `run`, `all`, `first`, `raw`, `exec`. */
  calls: number
  /** Sentencias enviadas dentro de cada `batch`. */
  batchSizes: number[]
}

const REAL = Symbol('real-statement')

/**
 * Envuelve un D1Database y cuenta las llamadas a su API. Miniflare no aplica el límite real de D1,
 * así que el presupuesto del spec (≤10 llamadas por request) se prueba contando.
 */
export function countingDb(db: D1Database): { db: D1Database; stats: D1Calls } {
  const stats: D1Calls = { calls: 0, batchSizes: [] }

  const wrap = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const w = {
      [REAL]: stmt,
      bind: (...values: unknown[]) => wrap(stmt.bind(...values)),
      run: () => (stats.calls++, stmt.run()),
      all: () => (stats.calls++, stmt.all()),
      first: (col?: string) => (stats.calls++, (stmt.first as (c?: string) => Promise<unknown>)(col)),
      raw: () => (stats.calls++, (stmt.raw as () => Promise<unknown>)()),
    }
    return w as unknown as D1PreparedStatement
  }
  const unwrap = (s: D1PreparedStatement): D1PreparedStatement =>
    (s as unknown as Record<symbol, D1PreparedStatement>)[REAL] ?? s

  const wrapped = {
    prepare: (sql: string) => wrap(db.prepare(sql)),
    batch: (stmts: D1PreparedStatement[]) => {
      stats.calls++
      stats.batchSizes.push(stmts.length)
      return db.batch(stmts.map(unwrap))
    },
    exec: (sql: string) => (stats.calls++, db.exec(sql)),
  }
  return { db: wrapped as unknown as D1Database, stats }
}
