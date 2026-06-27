/* eslint-disable max-len */
import { LANGUAGE_SUPPORT_MESSAGE } from '~/libs/openai/constants'

export const AI_ASSISTANT_SUGGESTION_ACTION = {
  ANALYZE_CONVERSATION: 'analyze-conversation',
  ANALYZE_IMAGE_CONTENT: 'analyze-image-content',
  GENERATE_CONTENT: 'generate-content',
  GENERATE_IMAGES: 'generate-images',
  GENERATE_VECTOR: 'generate-vector',
  SUGGEST_CLIPART_CATEGORY: 'suggest-clipart-category',
}

/**
 * Response from the conversation analysis
 */
export interface ConversationAnalysisResponse {
  mainTopic: string
  suggestionsOptions: string[]
  questionGainDeeper: string | null
  defer?: number
}

export const SUGGESTION_IDS = {
  CREATE_A_PERSONALIZED_PRODUCT: 'create-a-personalized-product',
  CREATE_A_TEMPLATE: 'create-a-template',
}

// Suggested response texts
export const SUGGESTION_TEXTS = {
  [SUGGESTION_IDS.CREATE_A_PERSONALIZED_PRODUCT]: 'ai-onboarding-personalize-product-content',
  [SUGGESTION_IDS.CREATE_A_TEMPLATE]: 'template-template-message',
}

// Definitions for AI to correctly recognize the scope of each feature
export const FEATURE_DEFINITIONS = {
  [SUGGESTION_IDS.CREATE_A_PERSONALIZED_PRODUCT]: `Conversations related to **${SUGGESTION_IDS.CREATE_A_PERSONALIZED_PRODUCT}** for POD products, including suggesting, developing, and exploring creative concepts related to imagery, layout, styles, colors, or trends suitable for the POD market.`,
  [SUGGESTION_IDS.CREATE_A_TEMPLATE]: `Conversations related to **${SUGGESTION_IDS.CREATE_A_TEMPLATE}** for POD products, including creating and editing personalization templates with product-aware constraints (printable areas, DPI), managing layers (text/image) and option sets, style mapping, layout/composition, and ensuring production-safe outputs. Also covers ideation of imagery and styles aligned to POD requirements.`,
}

// System message for conversation analysis
export const CONVERSATION_ANALYSIS_SYSTEM_MESSAGE = [
  '**Required JSON structure:**',
  '{',
  '  "mainTopic": "The primary topic of conversation",',
  '  "suggestionsOptions": ["Category1", "Category2", "Category3"],',
  '  "questionGainDeeper": "A pre-made question for user to or can ask main assistant to ask, often relate to topic definition.",',
  '  "reasonOfResult": "Explanation for why the result was determined.",',
  '  "defer": 0 or 10000  // In milliseconds',
  '}',
  '',
  '### **Feature of TailorKit**',
  `  - ${SUGGESTION_IDS.CREATE_A_PERSONALIZED_PRODUCT}: ${FEATURE_DEFINITIONS[SUGGESTION_IDS.CREATE_A_PERSONALIZED_PRODUCT]}`,
  `  - ${SUGGESTION_IDS.CREATE_A_TEMPLATE}: ${FEATURE_DEFINITIONS[SUGGESTION_IDS.CREATE_A_TEMPLATE]}`,
  '',
  'You are an AI specializing in conversation analysis. Your task is to:',
  '1. Keep track the conversation between user and a main assistant. You will consider the message from main assistant',
  '2. Extract key information from the message (like the main topic).',
  '3. Provide suggestions category options can suggest to user in `suggestionsOptions`.',
  '4. Ensure `questionGainDeeper` is a pre-made question or can ask main assistant to ask, this question is under user view will ask main assistant to ask.',
  '5. Explain reasoning in `reasonOfResult` clearly.',
  '6. Set `defer` to control response timing appropriately.',
  `${LANGUAGE_SUPPORT_MESSAGE}`,
  '',
  '### **Step 1: Identify the Main Context**',
  '- Look for the user’s focus or request intent. This becomes `"mainTopic"`.',
  '',
  '### **Step 2: Provide `suggestionsOptions`**',
  '- **Suggest category options can relate to the message and return with array items.**',
  '',
  '### **Step 3: Ensure `questionGainDeeper` Asks About Topic Definition**',
  '- You will received the message from main assistant, and you need to decide whether to ask about defining the topic under user view.',
  'Example: Main assistant: "Great choice! Nature themes are always refreshing. For the next step, which product will you use to showcase on this nature-themed background?."',
  'You should ask: "I don\'t know what product to use, can you help me?"',
  '',
  '### **Step 4: Handle `defer` Correctly**',
  '- **Use `"defer": 0` (Immediate Response) when:**',
  '  - The assistant is asking for clarification due to an unclear user response.',
  '  - Example:',
  '    - ✅ **Input:** "I apologize, but I couldn\'t understand your response. Could you please clarify your answer for the theme of the background?"',
  '    - ✅ **Output:** `"defer": 0`',
  '',
  '- **Use `"defer": 10000` (Delayed Reflection) when:**',
  '  - The assistant is friendly asking simple questions',
  '  - Example:',
  '    - ✅ **Input:** `"Question 1: What is the theme of your background?"`',
  '    - ✅ **Output:** `"defer": 10000`',
  '',
  '### **Example: Normal Reflection Question (`defer: 10000`)**',
  '**Input:**',
  '"assistant": "What type of artistic style are you envisioning for this background?"',
  '',
  '**Expected Output:**',
  '{',
  '  "mainTopic": "Choosing an artistic style for the background",',
  '  "suggestionsOptions": ["Minimalist", "Vintage", "Illustration", "Typography", "Patterns"],',
  '  "questionGainDeeper": "What is the definition of this artistic style?",',
  '  "reasonOfResult": "User is making a creative decision, so suggestions are provided for reflection.",',
  '  "defer": 10000',
  '}',
].join('\n')

/**
 * Runtime limits and defaults for AI image editing/generation.
 * Keep these values centralized to avoid hard-coded magic numbers across the app.
 */
export const AI_IMAGE_EDIT_LIMITS = {
  /** Maximum number of input images Gemini works best with */
  MAX_INPUT_IMAGES: 1,
  /** Per-image size cap used by our UI validation (bytes). Matches screenshot spec: 4MB. */
  MAX_IMAGE_SIZE_BYTES: 4 * 1024 * 1024,
  /** Supported MIME types for input images */
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/webp'] as const,
  /** Maximum number of output images requested per edit */
  MAX_OUTPUT_IMAGES: 4,
  /** Supported aspect ratios for input images */
  ALLOWED_ASPECT_RATIOS: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const,
} as const

export type AllowedMimeType = (typeof AI_IMAGE_EDIT_LIMITS.ALLOWED_MIME_TYPES)[number]
export type AllowedAspectRatio = (typeof AI_IMAGE_EDIT_LIMITS.ALLOWED_ASPECT_RATIOS)[number]
