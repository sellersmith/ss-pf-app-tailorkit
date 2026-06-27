import {
  TextIcon,
  TextInColumnsIcon,
  TextTitleIcon,
  ImageIcon,
  ImageMagicIcon,
  ThemeTemplateIcon,
  CircleUpIcon,
  TextFontIcon,
} from '@shopify/polaris-icons'
import type { IconSource } from '@shopify/polaris'

export interface CategoryItem {
  id: string
  name: string
  description: string
  icon: IconSource
  /** Optional category image URL (replaces icon when provided) */
  image?: string
  /** Premade template ID to clone when this category is selected */
  premadeTemplateId: string
  /** Special category (green highlight, e.g. "Explore all features") */
  isSpecial?: boolean
}

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'custom-text',
    name: 'Custom text',
    description: 'Add names or short text with custom fonts and colors.',
    icon: TextFontIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Custom_text.png?v=1772076703',
    premadeTemplateId: 'b4cb4839-4d2c-4d19-8bd9-dd7616fbe5c3',
  },
  {
    id: 'engraving-effects',
    name: 'Engraving effects',
    description: 'Create realistic engraved or embossed text effects.',
    icon: TextIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/3D_effects.png?v=1772076703',
    premadeTemplateId: '29a0a82b-b6ab-4b15-be6e-10dc46f214eb',
  },
  {
    id: 'multi-line-text',
    name: 'Multi-line text',
    description: 'Allow longer messages with flexible line breaks.',
    icon: TextInColumnsIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Multiline.png?v=1772076716',
    premadeTemplateId: '35b73c20-9feb-4f3f-87c8-eba30bbf629f',
  },
  {
    id: 'curve-text',
    name: 'Curve text',
    description: 'Design eye-catching curved text layouts.',
    icon: TextTitleIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Curve.png?v=1772076703',
    premadeTemplateId: 'f2c42cbb-8004-4937-b2b9-3f6c45e90173',
  },
  {
    id: 'image-upload',
    name: 'Image upload',
    description: 'Let buyers upload and preview their own photos.',
    icon: ImageIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Upload_image.png?v=1772076703',
    premadeTemplateId: 'd87d2df0-9258-486b-8ef8-34beec7ae2bc',
  },
  {
    id: 'ai-image-effects',
    name: 'AI image effects',
    description: 'Apply creative AI styles to uploaded images.',
    icon: ImageMagicIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/AI_Image.png?v=1772076703',
    premadeTemplateId: '09af59ba-05ec-4e21-904a-dc0b4a5a30c6',
  },
  {
    id: 'image-shapes',
    name: 'Image shapes',
    description: 'Crop images into stylish shapes like circle or heart.',
    icon: CircleUpIcon,
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Image_shape.png?v=1772076709',
    premadeTemplateId: '43eb2610-0f5f-4fcf-9b49-d13a72b07db3',
  },
  {
    id: 'explore-all',
    name: 'Explore all features',
    description: 'Build template your way with full customization.',
    icon: ThemeTemplateIcon,
    image:
      'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/None_fabb68cf-82a4-4fe9-942f-5b400127ecb9.png?v=1772076764',
    premadeTemplateId: '',
    isSpecial: true,
  },
]

export const DEFAULT_SELECTED_CATEGORY = 'custom-text'

export type OnboardingStep = 'category' | 'product'

export enum ONBOARDING_ACTIONS {
  CREATE_INTEGRATION = 'CREATE_INTEGRATION',
  SAVE_PROGRESS = 'SAVE_PROGRESS',
  COMPLETE = 'COMPLETE',
  SKIP = 'SKIP',
}
