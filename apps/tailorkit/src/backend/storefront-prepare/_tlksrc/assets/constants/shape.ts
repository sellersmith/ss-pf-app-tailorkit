const RECTANGLE = 'rectangle'
const ELLIPSE = 'ellipse'
const TRIANGLE = 'triangle'
const STAR = 'star'
const HEART = 'heart'

export { RECTANGLE, ELLIPSE, TRIANGLE, STAR, HEART }

export type Shape = '' | typeof RECTANGLE | typeof ELLIPSE | typeof TRIANGLE | typeof STAR | typeof HEART
export const SHAPE_THUMBNAILS = {
  RECTANGLE_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/rectangle-icon.svg?v=1724204568',
  ELLIPSE_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/ellipse-icon-1.svg?v=1724322394',
  TRIANGLE_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/triangle-icon.svg?v=1724204540',
  STAR_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/star-icon.svg?v=1724204397',
  HEART_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/heart-icon.svg?v=1724204386',
}

export const TEXT_SHAPE_OPTIONS = [
  {
    thumbnail: '',
    label: '--',
    value: '',
  },
  {
    thumbnail: SHAPE_THUMBNAILS.RECTANGLE_ICON,
    label: 'Rectangle',
    value: 'rectangle',
  },
  {
    thumbnail: SHAPE_THUMBNAILS.TRIANGLE_ICON,
    label: 'Triangle',
    value: 'triangle',
  },
  {
    thumbnail: SHAPE_THUMBNAILS.ELLIPSE_ICON,
    label: 'Ellipse',
    value: 'ellipse',
  },
  {
    thumbnail: SHAPE_THUMBNAILS.STAR_ICON,
    label: 'Star',
    value: 'star',
  },
  {
    thumbnail: SHAPE_THUMBNAILS.HEART_ICON,
    label: 'Heart',
    value: 'heart',
  },
]

// 1.2 is a common line-height ratio
export const COMMON_LINE_HEIGHT_RATIO = 1.2
