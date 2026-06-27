/**
 * Type-only clientLoader facade for TemplateEditor compile prep.
 * Runtime template loading must use PageFly app-platform adapters.
 */
export async function clientLoader() {
  return {
    template: null as unknown,
    autoOpenChatBot: 'false',
    currentConversationId: null as string | null,
    autoSelectFirstLayer: null as string | null,
    addAIImage: null as string | null,
  }
}
