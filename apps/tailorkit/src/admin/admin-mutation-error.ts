type TailorKitAdminNotificationTone = 'success' | 'critical' | 'info'

interface RunTailorKitAdminMutationInput<T> {
  action(): Promise<T>
  notify(message: string, tone: TailorKitAdminNotificationTone): void
  fallbackErrorMessage: string
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {}
}

export function getTailorKitAdminMutationErrorMessage(error: unknown, fallback: string): string {
  const record = asRecord(error)
  const decisionReason = Array.isArray(record.decision?.reasons)
    ? record.decision.reasons.find((reason: unknown) => typeof reason === 'string' && Boolean(reason.trim()))
    : undefined

  if (decisionReason) return decisionReason
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof record.message === 'string' && record.message.trim()) return record.message
  return fallback
}

export async function runTailorKitAdminMutation<T>({
  action,
  notify,
  fallbackErrorMessage,
}: RunTailorKitAdminMutationInput<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    notify(getTailorKitAdminMutationErrorMessage(error, fallbackErrorMessage), 'critical')
    throw error
  }
}
