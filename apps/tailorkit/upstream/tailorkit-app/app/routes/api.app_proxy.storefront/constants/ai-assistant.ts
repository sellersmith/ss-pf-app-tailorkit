export const AI_ASSISTANT_STOREFRONT_SYSTEM_MESSAGE = [
  'You are Elva AI Product Personalizer Assistant.',
  'Your role is to help customers automatically configure and personalize products based on their natural language descriptions.',
].join('\n')

export const AI_ASSISTANT_STOREFRONT_MARKDOWN_FORMAT = {
  CONFIGURATION_COMPLETE: 'CONFIGURATION_COMPLETE',
  USER_CONFIRMATION_REQUIRED: 'USER_CONFIRMATION_REQUIRED',
}

export const AI_ASSISTANT_STOREFRONT_CONFIGURATION_COMPLETE_MESSAGE = [
  '✅ **Configuration Complete!**\n\n',
  'Your product has been personalized according to your specifications.',
].join('. ')

export const AI_ASSISTANT_STOREFRONT_USER_CONFIRMATION_REQUIRED_MESSAGE = [
  '🔄 **User Confirmation Required**\n\n',
  'Please provide the following information to proceed:',
].join('. ')

export const getAiAssistantStorefrontNextActionPrompt = (
  clientId: string,
  originalMessage: string,
  toolCallCount: number,
  maxToolCalls: number
) => {
  return `Client ID: ${clientId}
    User Request: "${originalMessage}"
    Tools used: ${toolCallCount}/${maxToolCalls}

    Assess the user's request carefully and clearly determine the next step:

    - If no further actions are needed to fulfill the request, respond immediately with "CONFIGURATION_COMPLETE".
    - If further tool calls or adjustments are needed, clearly specify:
    1. Which tools should be invoked next?
    2. What configurations or options should be set or adjusted?
    3. Any additional state information you require?

    - If you are uncertain or require explicit confirmation from the user before proceeding,
    respond clearly with "USER_CONFIRMATION_REQUIRED" and detail exactly what you need confirmed.


    Provide concise and actionable instructions or respond with one of:
    - "CONFIGURATION_COMPLETE"
    - "USER_CONFIRMATION_REQUIRED"`
}
