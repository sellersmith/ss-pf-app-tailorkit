const ADAPTER_MARKER = 'app-platform-pruned-route-ui-adapter'

export async function fetchPricingPlansV2() {
  void ADAPTER_MARKER
  return []
}

export async function fetchBillingState() {
  return {
    billingCycleBaseline: 0,
  }
}

export async function fetchTrialInfo() {
  return {
    hasUsedTrial: false,
  }
}

export async function subscribeToPlan(_planId: string, _discountCode?: string) {
  return {
    success: false,
    confirmationUrl: undefined,
    error: 'pricing-pruned-from-product-editor-v0',
  }
}
