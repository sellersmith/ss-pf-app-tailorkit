const noopAsync = async () => undefined

/**
 * TailorKit feedback/tour prompts are product-experience chrome, not required for
 * PageFly's V0.1 TailorKit admin core. Keep ProductEditor save/publish callbacks
 * callable without opening TailorKit feedback or user-journey side effects.
 */
export function useGatherUserFeedbackForm() {
  return {
    showFeedback: false,
    feedbackCallback: undefined,
    showFeedbackForm: noopAsync,
    handleAfterSaveTemplate: noopAsync,
    handleAfterPublishIntegration: noopAsync,
    handleAfterViewLive: noopAsync,
    handleAfterSaveOnboarding: noopAsync,
    handleAfterSaveProviderProduct: noopAsync,
  }
}
