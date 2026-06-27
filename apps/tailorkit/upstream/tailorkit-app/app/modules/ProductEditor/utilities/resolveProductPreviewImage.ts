import type { BaseImage, VariantIntegration } from '~/types/integration'

type ImageLike = (Pick<BaseImage, 'url' | 'altText' | 'width' | 'height'> & { id?: string | null }) | null | undefined

export interface ResolvedPreviewImage {
  id?: string
  src: string
  altText?: string
  width?: number
  height?: number
}

interface ResolveProductPreviewImageParams {
  variant?: VariantIntegration | null
  /**
   * Optional higher-priority base image (e.g., view-specific base) that should win over variant/product imagery.
   */
  baseImage?: ImageLike
  /**
   * Optional explicit fallback order of additional variants to inspect for images.
   */
  additionalVariants?: VariantIntegration[]
}

const isValidImage = (image: ImageLike): image is NonNullable<ImageLike> & { url: string } =>
  Boolean(image && image.url)

function extractFirstValidImage(images: ImageLike[]): (NonNullable<ImageLike> & { url: string }) | null {
  for (const image of images) {
    if (isValidImage(image)) {
      return image
    }
  }
  return null
}

export function resolveProductPreviewImage(params: ResolveProductPreviewImageParams): ResolvedPreviewImage | null {
  const { variant, baseImage, additionalVariants = [] } = params
  const variantFallbacks = [variant, ...additionalVariants].filter(Boolean) as VariantIntegration[]

  const imageCandidates: ImageLike[] = [
    baseImage,
    ...variantFallbacks.map(v => v.image),
    ...variantFallbacks.map(v => v.product?.featuredImage),
  ]

  const resolved = extractFirstValidImage(imageCandidates)
  if (!resolved) {
    return null
  }

  return {
    id: resolved.id ?? undefined,
    src: resolved.url,
    altText: resolved.altText ?? undefined,
    width: typeof resolved.width === 'number' ? resolved.width : undefined,
    height: typeof resolved.height === 'number' ? resolved.height : undefined,
  }
}
