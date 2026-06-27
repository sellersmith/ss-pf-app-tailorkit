/**
 * Adapter registry — maps element types to their adapters.
 * Adding a new element type = add one adapter file + register here.
 */

import type { ElementAdapter, AIElementType } from '../types'
import { ImagelessAdapter } from './imageless-adapter'
import { TextCustomerAdapter } from './text-customer-adapter'
import { TextAdapter } from './text-adapter'
import { ImageAdapter } from './image-adapter'

/** All registered element adapters keyed by AIElementType */
export const ELEMENT_ADAPTERS: Record<AIElementType, ElementAdapter> = {
  imageless: new ImagelessAdapter(),
  text_customer: new TextCustomerAdapter(),
  text: new TextAdapter(),
  image: new ImageAdapter(),
}
