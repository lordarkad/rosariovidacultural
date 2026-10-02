import { z } from 'zod'

// Los schemas Zod de los payloads viven en schemas.ts (generado desde docs/api-spec.yml con
// `npm run generate:schemas` — nunca editar a mano). Acá solo van helpers que no salen del spec.

export const SuccessEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data })
