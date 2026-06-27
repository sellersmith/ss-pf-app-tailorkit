const ADAPTER_MARKER = 'app-platform-pruned-route-ui-adapter'

export function usePTEStatus() {
  return {
    data: null,
    error: null,
    loading: false,
    isLoading: false,
    async refetch() {
      void ADAPTER_MARKER
      return null
    },
  }
}
