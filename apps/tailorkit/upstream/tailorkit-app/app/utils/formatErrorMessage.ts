export function formatErrorMessage(e: Error | any) {
  return e instanceof Error ? e.message : (e as string)
}
