import { SHAPE_THUMBNAILS } from 'extensions/tailorkit-src/src/assets/constants/shape'

export const PHOTOSHOP_THUMBNAIL
  = 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Photoshop_icon_thumbnail.png?v=1721466595'

export const ILLUSTRATORS = {
  SEARCH_IMAGE: 'https://cdn.shopify.com/s/files/1/0646/2953/8985/files/no-search-found.svg?v=1718094132',
  EMPTY_TEMPLATE: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Illustration_type.png?v=1721178074',
  EMPTY_OPTION_SET:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/option_set_empty_state_illus.svg?v=1722932869',
  EMPTY_FONT: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/empty-font-icon.svg?v=1736758122',
  ACHIEVE_FIRST_SALE: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Achieve_first_sale.svg?v=1737531859',
  PUBLISH_FIRST_PRODUCT: 'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/The_First_Publish.svg?v=1743403006',
  COUPON_5_PERCENT:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Figma_Image_1223x478_75fa82c7-a606-49d5-8643-88f9d04aa847.png?v=1737710207',
  COUPON_20_PERCENT:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Figma_Image_1048x221_b1b97115-7f08-4378-a345-49f70f2d4c53.png?v=1737710226',
  COUPON_5_PERCENT_LARGE:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Figma_Image_2334x443_0e3c6f10-4419-4b81-9787-e0b604dae5b9.png?v=1737712794',
  COUPON_20_PERCENT_LARGE:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Image_2334x443_2137cf19-a525-49c8-be92-59c8a07579d4.png?v=1737712796',
  COUPON_OFFER_50_PERCENT: 'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/offer_50_percents.png?v=1742786181',
  COUPON_5_PERCENT_FOR_PUBLISH_FIRST_PRODUCT:
    'https://cdn.shopify.com/s/files/1/0705/9383/9319/files/coupon_5_percent_for_publish_first_product.png?v=1742822793',
}

export const EXTRA_ICONS = {
  ROTATE_ICON:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/rotate_icon_aea420b7-d0e6-46af-98ff-f650ba7d7894.svg?v=1721723311',
  SYNC_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/sync.svg?v=1723018307',
  UN_SYNC_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/unsync.svg?v=1723018306',
  TOGGLE_ICON: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/toggle-icon.svg?v=1724335290',
  ...SHAPE_THUMBNAILS,
}

export const COMMON_ICONS = {
  TAILORKIT_CHAT_BOT_ICON:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/SVG_ICON_73e6c78e-ea31-4bad-a365-e69aa745faa3.svg?v=1756032385',
}

const UTM_SOURCE = 'tailorkit'
const UTM_MEDIUM = 'referral'

export const APPS_PROMOTION = [
  {
    id: 'onetick',
    logo: 'https://cdn.shopify.com/app-store/listing_images/d2a0be9aaf961f68ad40a6c3981246cd/icon/CL7GtLX-m4cDEAE=.png?width=100',
    title: 'OneTick Upsell Cross Sell',
    description: 'onetick-description',
    link: `https://apps.shopify.com/onetick?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
    bfs: true,
  },
  {
    id: 'quicksub',
    logo: 'https://cdn.shopify.com/app-store/listing_images/4e7eea48c501c7b5c11f206c1cf52e59/icon/CICW5KP4hIcDEAE=.png?width=100',
    title: 'QuickSub Subscriptions',
    description: 'quicksub-description',
    link: `https://apps.shopify.com/quicksub-subscriptions?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
    bfs: false,
  },
  {
    id: 'vibe',
    logo: 'https://cdn.shopify.com/app-store/listing_images/060601d32aae4f467a68a76bd4e49f67/icon/CJH817qn_YYDEAE=.png?width=100',
    title: 'VIBE Shoppable Instagram Feed',
    description: 'vibe-description',
    link: `https://apps.shopify.com/vibe?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
    bfs: true,
  },
]
