import type { ZodSchema } from 'zod'
import { ApiError } from './httpClient'

export function parseWithZod<T>(schema: ZodSchema<T>, payload: unknown, label?: string): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const message = `${label || 'validation-error'}: ${result.error.errors.map(e => e.message).join(', ')}`
    throw new ApiError(message, 422, result.error)
  }
  return result.data
}
