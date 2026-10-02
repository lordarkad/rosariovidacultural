import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodTypeAny } from 'zod'

/** Mensaje legible (string) de los primeros issues: el envelope no admite objetos ni arrays en `error`. */
export function issuesToMessage(issues: Array<{ path: Array<string | number>; message: string }>): string {
  return issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}

/**
 * `zValidator` con el envelope canónico: el hook por defecto devuelve el ZodError crudo,
 * que viola `{ success: false, error: string }`.
 */
export const validate = <T extends ZodTypeAny, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ success: false as const, error: issuesToMessage(result.error.issues) }, 400)
    }
  })
