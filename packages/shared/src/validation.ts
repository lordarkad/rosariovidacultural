import { z } from 'zod'

// Hand-written for now; target state: generated from docs/api-spec.yml (ADR 0001 del playbook).
// packages/shared/src/types/openapi.d.ts is generated — never edit it manually.

export const HealthDataSchema = z.object({
  status: z.literal('ok'),
  ts: z.string(),
})

export const SuccessEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data })

export const ErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})
