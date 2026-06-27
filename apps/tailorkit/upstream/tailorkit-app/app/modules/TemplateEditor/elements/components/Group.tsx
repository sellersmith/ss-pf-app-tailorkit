import type { ReactNode } from 'react'
import TemplateElement from '.'
import { FolderIcon } from '@shopify/polaris-icons'
import { ELayerType } from '~/types/psd'

export default class GroupElement extends TemplateElement<void, void> {
  type = ELayerType.GROUP
  icon = FolderIcon

  protected renderCanvas(): ReactNode {
    // Don't need to render group elements on canvas
    return null
  }

  protected renderInspector(): ReactNode {
    // Group elements don't have inspector controls
    return null
  }

  protected renderStylingToolBar(): ReactNode {
    return null
  }
}
