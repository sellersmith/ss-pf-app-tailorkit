import { type ReactNode } from 'react'
import type { CharmSettings, CharmNodeSettings, CharmProductRef, CharmTransformInstance, LayerType } from '~/types/psd'
import TemplateElement from '..'
import { ELayerType } from '~/types/psd'
import { HashtagIcon } from '@shopify/polaris-icons'
import { CharmCanvasRenderer } from './CharmCanvasRenderer.client'
import { getLayerStoreById } from '~/stores/modules/layer'
import { CHARM_THUMB_SIZE } from '../CharmNode/charm-node-utils'

/**
 * P1-1: Get transform data from parent CHARM_NODE (single source of truth)
 * Returns undefined if parent or transform not found
 */
function getTransformFromParent(
  nodeId: string | undefined,
  productId: string | undefined,
  instanceId: string | undefined
): CharmTransformInstance | undefined {
  if (!nodeId || !productId || !instanceId) return undefined

  const parentStore = getLayerStoreById(nodeId)
  if (!parentStore) return undefined

  const parentSettings = parentStore.getState().settings as CharmNodeSettings | undefined
  const products = parentSettings?.linkedProducts || []
  const product = products.find((p: CharmProductRef) => p._id === productId)
  return product?.transforms?.find((t: CharmTransformInstance) => t.instanceId === instanceId)
}

export default class CharmElement extends TemplateElement<void, void> {
  type: LayerType = ELayerType.CHARM
  icon = HashtagIcon
  optionSetType = 'none'

  /**
   * P1-1: Derived position from parent CHARM_NODE (single source of truth)
   * Falls back to local state if parent lookup fails
   */
  get derivedLeft(): number {
    const settings = this.state.settings as CharmSettings | undefined
    const transform = getTransformFromParent(
      settings?.nodeId,
      settings?.productRef?._id,
      settings?.productRef?.instanceId
    )
    return transform?.x ?? this.state.left ?? 0
  }

  get derivedTop(): number {
    const settings = this.state.settings as CharmSettings | undefined
    const transform = getTransformFromParent(
      settings?.nodeId,
      settings?.productRef?._id,
      settings?.productRef?.instanceId
    )
    return transform?.y ?? this.state.top ?? 0
  }

  get derivedRotate(): number {
    const settings = this.state.settings as CharmSettings | undefined
    const transform = getTransformFromParent(
      settings?.nodeId,
      settings?.productRef?._id,
      settings?.productRef?.instanceId
    )
    return transform?.rotation ?? this.state.rotate ?? 0
  }

  get derivedScale(): number {
    const settings = this.state.settings as CharmSettings | undefined
    const transform = getTransformFromParent(
      settings?.nodeId,
      settings?.productRef?._id,
      settings?.productRef?.instanceId
    )
    return transform?.scale ?? 1
  }

  get derivedWidth(): number {
    return CHARM_THUMB_SIZE * this.derivedScale
  }

  get derivedHeight(): number {
    return CHARM_THUMB_SIZE * this.derivedScale
  }

  /**
   * P1-1: Override setData to update parent CHARM_NODE directly for transform changes
   * This maintains single source of truth - CHARM_NODE is authoritative
   */
  public setData(key: string | object, value?: any, validateCallback?: string | ((value?: any) => string | undefined)) {
    const transformKeys = ['left', 'top', 'rotate', 'width', 'height']
    const changedKeys = typeof key === 'string' ? [key] : Object.keys(key as object)
    const hasTransformChange = changedKeys.some(k => transformKeys.includes(k))

    // For transform changes, update parent CHARM_NODE directly (single source of truth)
    if (hasTransformChange) {
      this.updateParentTransform(key, value)
    }

    // Still call super for non-transform changes and to update local state
    // Local state serves as fallback and for initial load
    super.setData(key, value, validateCallback)
  }

  /**
   * P1-1: Update parent CHARM_NODE transform directly
   */
  private updateParentTransform(key: string | object, value?: any) {
    const settings = this.state.settings as CharmSettings | undefined
    const nodeId = settings?.nodeId
    const instanceId = settings?.productRef?.instanceId
    const productId = settings?.productRef?._id

    if (!nodeId || !instanceId || !productId) return

    const parentStore = getLayerStoreById(nodeId)
    if (!parentStore) return

    // Build updated values from key/value
    let newLeft = this.state.left ?? 0
    let newTop = this.state.top ?? 0
    let newRotate = this.state.rotate ?? 0
    let newWidth = this.state.width ?? CHARM_THUMB_SIZE

    if (typeof key === 'string') {
      if (key === 'left') newLeft = value
      else if (key === 'top') newTop = value
      else if (key === 'rotate') newRotate = value
      else if (key === 'width') newWidth = value
      else if (key === 'height') newWidth = value // Use width = height (square)
    } else {
      const obj = key as Record<string, any>
      if ('left' in obj) newLeft = obj.left
      if ('top' in obj) newTop = obj.top
      if ('rotate' in obj) newRotate = obj.rotate
      if ('width' in obj) newWidth = obj.width
      if ('height' in obj) newWidth = obj.height
    }

    const scale = newWidth / CHARM_THUMB_SIZE

    parentStore.dispatch({
      type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
      payload: {
        productId,
        instanceId,
        transform: { x: newLeft, y: newTop, rotation: newRotate, scale },
      },
    })
  }

  protected renderCustomizeInspector(): ReactNode {
    return null
  }

  protected renderCanvas(): ReactNode {
    const { layerStore } = this.props
    return <CharmCanvasRenderer layerStore={layerStore} />
  }

  protected renderStylingToolBar(): ReactNode {
    return null
  }
}
