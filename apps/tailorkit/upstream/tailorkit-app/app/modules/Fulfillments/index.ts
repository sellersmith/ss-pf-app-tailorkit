import { EPROVIDER } from '~/constants/fulfillment-providers'
import Printify from './Printify'
import { ShineOn } from '@sellersmith/shineon-sdk'

export { Printify, ShineOn }

export const fulfillmentProvidersSDK: Record<string, typeof Printify | typeof ShineOn> = {
  [EPROVIDER.PRINTIFY]: Printify,
  [EPROVIDER.SHINEON]: ShineOn,
}
