import type { TFunction } from 'i18next'
import { PERSONALIZED_PRODUCT_TEMPLATE, PERSONALIZED_PRODUCT_TEMPLATE_2 } from '~/providers/ChatBotContext'

export interface ISuggestion {
  id: string
  label: string
  content: string
  icon?: any
  action?: string
  illustration?: string
  onboarding?: boolean
}

export const SUGGESTIONS: ISuggestion[] = [
  {
    id: 'ai_onboarding_create_first_product',
    label: 'ai-collects-context',
    content: PERSONALIZED_PRODUCT_TEMPLATE,
    illustration:
      'https://cdn.shopify.com/s/files/1/0705/8351/7367/files/I_want_to_see_a_product_auto-created_by_AI.png?v=1758637463&width=320',
    onboarding: true,
  },
  {
    id: 'ai_onboarding_create_first_product_2',
    label: 'i-ll-give-you-context',
    content: PERSONALIZED_PRODUCT_TEMPLATE_2,
    illustration:
      'https://cdn.shopify.com/s/files/1/0705/8351/7367/files/Let_AI_create_a_product_from_my_prompt.png?v=1758637484&width=320',
    onboarding: true,
  },
  // {
  //   id: 'ai_onboarding_custom_text_product',
  //   label: 'i-want-a-custom-text-on-my-products',
  //   content: '',
  //   action: 'open_product_selector_with_custom_text',
  //   illustration:
  //     'https://cdn.shopify.com/s/files/1/0705/8351/7367/files/I_want_a_custom_text_on_my_products.png?v=1758637509&width=320',
  //   onboarding: true,
  // },
  // {
  //   id: SUGGESTION_IDS.CREATE_A_TEMPLATE,
  //   label: 'create-a-template-label',
  //   content: SUGGESTION_TEXTS[SUGGESTION_IDS.CREATE_A_TEMPLATE],
  //   icon: MagicIcon,
  //   onboarding: false,
  // },
]

// Post-recommendation suggestions that appear after AI provides product recommendations
export const POST_RECOMMENDATION_SUGGESTIONS = (t: TFunction): ISuggestion[] => {
  return [
    {
      id: 'generate_another_version',
      label: t('show-another-version-of-this-product'),
      content: t('show-me-another-version-of-this-product-for-target-audience-on-occasion-in-a-style-mood-style'),
    },
    {
      id: 'suggest_product_description',
      label: t('suggest-product-description'),
      content: t('write-a-compelling-product-description-highlighting-mood-and-target-audience'),
    },
  ]
}

/** Suggestions shown in template editor context (not onboarding) */
export const TEMPLATE_EDITOR_SUGGESTIONS: ISuggestion[] = [
  {
    id: 'customize_this_product',
    label: 'customize-this-product',
    content: 'suggestion-customize-this-product',
  },
  {
    id: 'add_text_engraving',
    label: 'add-text-engraving',
    content: 'suggestion-add-text-engraving',
  },
  {
    id: 'add_image_upload',
    label: 'add-image-upload',
    content: 'suggestion-add-image-upload',
  },
  {
    id: 'submit_feedback',
    label: 'submit-a-feature-request',
    content: 'suggestion-submit-feedback',
  },
]

export const CHAT_BOX_ANIMATION_DURATION = 250
export const CHAT_BOX_SESSION_FLAG_KEY = 'tlk_ai_chat_auto_opened_session'
