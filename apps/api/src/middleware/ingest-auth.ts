import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types/app'

const encoder = new TextEncoder()

/** Compara por SHA-256 con XOR acumulado: tiempo constante y portable a Node y Workers. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

const unauthorized: MiddlewareHandler<AppEnv> = async (c) =>
  c.json({ success: false, error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' })

/** `Authorization: Bearer <INGEST_TOKEN>`. Corre antes que el validador: un body inválido sin token es 401. */
export const ingestAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.env.INGEST_TOKEN
  if (!expected) {
    // falla cerrado: sin secreto configurado nadie puede ingerir
    console.error('INGEST_TOKEN no está configurado')
    return unauthorized(c, next)
  }
  const match = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')
  if (!match || !(await safeEqual(match[1]!, expected))) return unauthorized(c, next)
  await next()
}
