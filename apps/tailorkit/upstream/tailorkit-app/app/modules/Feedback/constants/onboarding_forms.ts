import { TEMPLATE_DESIGN_TYPE } from '~/routes/api.templates_designs/constants'
import { FEEDBACK_TYPE } from './common'
import { ONBOARDING_FORM_API } from '~/routes/api.google-sheet/constants'

const ONBOARDING_QUESTION_KEY = {
  POD_EXPERIENCE: 'pod_experience',
  SHARE_YOUR_EXPERIENCE: 'share_your_experience',
  BEST_DESCRIBES: 'best_describes',
  TOPIC_FOCUS: 'topic_focus',
  PRODUCT_YOUR_SELL: 'product_your_sell',
  THANK_YOU: 'thank_you',
  LET_STARTED: 'let_started',
  FEATURE_WALKTHROUGH: 'featureWalkthrough',
}

/**
 * The onboarding and quick tour mechanism for Integration works as follows:
 * 1. Gather insights from the question, "Which products do you want to sell?"
 * 2. Based on each merchant's answer, locate the corresponding products from the fulfillment provider (e.g., Printify) and import them into Shopify.
 * 3. The selection criteria include factors like best sellers, popularity, etc.
 * The entire process is fully automated.
 */
const ONBOARDING_PRODUCT_YOUR_SELL_KEY = {
  CLOTHING: {
    VALUE: 'CLOTHING',
    PRINTIFY: {
      BLUEPRINT_ID: 6,
    },
  },
  HOME_AND_LIVING: {
    VALUE: 'HOME_AND_LIVING',
    PRINTIFY: {
      BLUEPRINT_ID: 478,
    },
  },
  ACCESSORIES: {
    VALUE: 'ACCESSORIES',
    PRINTIFY: {
      BLUEPRINT_ID: 421,
    },
  },
  FOOD_HEALTH_BEAUTY: {
    VALUE: 'FOOD_HEALTH_BEAUTY',
    PRINTIFY: {
      BLUEPRINT_ID: 1414,
    },
  },
  OTHERS: {
    VALUE: 'OTHERS',
  },
}

// Onboarding form,
const ONBOARDING_FORM = [
  {
    title: 'Onboarding feedback',
    status: 'active',
    postResponsesTo: ONBOARDING_FORM_API,
    questions: [
      {
        modalTitle: 'Welcome to TailorKit!',
        label: "Let's work together! Share your experience so we can support you better.",
        key: ONBOARDING_QUESTION_KEY.POD_EXPERIENCE,
        required: true,
        type: 'radio',
        thumbnailSrc:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Onboarding-Modal_pod_experience.png?v=1733996435',
        options: [
          {
            label: "Beginner: I'm new to selling POD.",
            value: 'beginner',
          },
          {
            label: 'Intermediate: I have some POD experience.',
            value: 'intermediate',
          },
          {
            label: "Advanced: I'm an experienced POD seller.",
            value: 'advanced',
          },
          {
            label: 'Others',
            value: 'others',
            hideLabel: true,
            type: 'textarea',
            placeholder: 'Input text',
          },
        ],
      },
      {
        modalTitle: 'Welcome to TailorKit!',
        label: 'What is the primary structure of your business/work?',
        key: ONBOARDING_QUESTION_KEY.BEST_DESCRIBES,
        required: true,
        type: 'radio',
        thumbnailSrc:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Onboarding-Modal_best_describes.png?v=1733996247',
        options: [
          {
            label: 'Individual Entrepreneur',
            value: 'individual_entrepreneur',
          },
          {
            label: 'Small Business Owner',
            value: 'small_business_owner',
          },
          {
            label: 'Agency/Freelancer',
            value: 'agency_freelancer',
          },
          {
            label: 'Organization/Team',
            value: 'organization_team',
          },
          {
            label: 'Others',
            value: 'others',
            hideLabel: true,
            type: 'textarea',
            placeholder: 'Input text',
          },
        ],
      },
      {
        modalTitle: 'Welcome to TailorKit!',
        label: 'What are the main themes of your designs/products?',
        key: ONBOARDING_QUESTION_KEY.TOPIC_FOCUS,
        required: true,
        type: 'checkbox',
        thumbnailSrc:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Onboarding-Modal_topic_focus.png?v=1733996295',
        options: [
          {
            label: 'Family',
            value: TEMPLATE_DESIGN_TYPE.FAMILY,
          },
          {
            label: 'Love',
            value: TEMPLATE_DESIGN_TYPE.LOVE,
          },
          {
            label: 'Friends',
            value: TEMPLATE_DESIGN_TYPE.FRIENDS,
          },
          {
            label: 'Pets',
            value: TEMPLATE_DESIGN_TYPE.PETS,
          },
          {
            label: 'Others',
            value: TEMPLATE_DESIGN_TYPE.OTHERS,
            hideLabel: true,
            type: 'textarea',
            placeholder: 'Input text',
          },
        ],
      },
      {
        modalTitle: 'Welcome to TailorKit!',
        label: 'Which products do you want to sell?',
        key: ONBOARDING_QUESTION_KEY.PRODUCT_YOUR_SELL,
        required: true,
        type: 'checkbox',
        thumbnailSrc:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Onboarding-Modal_product_your_sell.png?v=1733996264',
        options: [
          {
            label: 'Clothing',
            value: ONBOARDING_PRODUCT_YOUR_SELL_KEY.CLOTHING.VALUE,
          },
          {
            label: 'Home & Living',
            value: ONBOARDING_PRODUCT_YOUR_SELL_KEY.HOME_AND_LIVING.VALUE,
          },
          {
            label: 'Accessories',
            value: ONBOARDING_PRODUCT_YOUR_SELL_KEY.ACCESSORIES.VALUE,
          },
          {
            label: 'Food - Health - Beauty',
            value: ONBOARDING_PRODUCT_YOUR_SELL_KEY.FOOD_HEALTH_BEAUTY.VALUE,
          },
          {
            label: 'Others',
            value: ONBOARDING_PRODUCT_YOUR_SELL_KEY.OTHERS.VALUE,
            hideLabel: true,
            type: 'textarea',
            placeholder: 'Input text',
          },
        ],
      },
      {
        modalTitle: 'Thank you for sharing your insights!',
        key: ONBOARDING_QUESTION_KEY.LET_STARTED,
        required: true,
        type: 'text',
        // eslint-disable-next-line max-len
        placeholder: `<strong>Your insights will drive TailorKit's evolution, enhancing our print-on-demand simplification to maximize efficiency and profitability.</strong><strong>Let's build something amazing together!</strong><span>We'll guide you through your entire product journey in just three easy steps.</span><ul style="margin: 0px;"><li>Create a template</li><li>Integrate with products</li><li>Fulfill paid orders</li></ul>`,
        thumbnailSrc:
          'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Onboarding-Modal_thank_you.png?v=1734575251',
      },
    ],
    formType: FEEDBACK_TYPE.ONBOARDING_FEEDBACK,
  },
]

export { ONBOARDING_FORM, ONBOARDING_PRODUCT_YOUR_SELL_KEY, ONBOARDING_QUESTION_KEY }
