import type { ReactNode } from 'react'
import type { LayerType } from '~/types/psd'
import TemplateElement from '..'
import { ELayerType } from '~/types/psd'
import { CharmNodeCanvasRenderer } from './CharmNodeCanvasRenderer.client'
import { CharmBuilderIcon } from '~/assets/icons'

export default class CharmNodeElement extends TemplateElement<void, void> {
  type: LayerType = ELayerType.CHARM_NODE
  optionSetType = 'none'

  protected renderThumbnail(): ReactNode {
    return (
      <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {CharmBuilderIcon}
      </div>
    )
  }

  protected renderCanvas(): ReactNode {
    const { layerStore, previewMode } = this.props
    return <CharmNodeCanvasRenderer layerStore={layerStore} previewMode={previewMode} />
  }

  protected renderCustomizeInspector(): ReactNode {
    return null
  }

  protected renderStylingToolBar(): ReactNode {
    return null
  }
}
