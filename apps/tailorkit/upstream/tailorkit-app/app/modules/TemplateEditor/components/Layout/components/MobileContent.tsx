/**
 * Mobile-specific content components
 */

import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InspectorWithPreviewMode } from '../../Inspector'
import TemplateEditorOutline from '../../Navigation'
import type { TLayerStore } from '~/stores/modules/layer'
import { InspectorContainerBackButton } from './InspectorContainer'
import { LayerToolMap } from '../../Outline/LayerToolbar/constants'

// Lazy load the outline inspector mobile component
const TemplateEditorOutlineInspectorMobile = lazy(() => import('../TemplateEditorOutlineInspectorMobile'))

interface MobileContentProps {
  isSmallMobileView: boolean
  previewMode: boolean
}

interface TabletContentProps {
  isTabletView: boolean
  previewMode: boolean
  showInspectorOnTablet: boolean
  clickedLayerStore?: TLayerStore | null
  onBackToOutline: () => void
}

/**
 * Renders mobile-specific bottom sheet content
 */
export function MobileContent({ isSmallMobileView, previewMode }: MobileContentProps) {
  if (!isSmallMobileView) {
    return null
  }

  // In preview mode, show inspector instead of outline
  if (previewMode) {
    return (
      <div style={{ gridColumn: '1 / -1', gridRow: '4', height: '40vh', minHeight: '300px' }}>
        <InspectorWithPreviewMode includeHeader={false} />
      </div>
    )
  }

  return (
    <div style={{ gridColumn: '1 / -1', gridRow: '4' }}>
      <Suspense fallback={null}>
        <TemplateEditorOutlineInspectorMobile />
      </Suspense>
    </div>
  )
}

/**
 * Renders tablet-specific inspector/outline content under the canvas
 */
export function TabletContent({
  isTabletView,
  previewMode,
  showInspectorOnTablet,
  clickedLayerStore,
  onBackToOutline,
}: TabletContentProps) {
  const { t } = useTranslation()

  if (!isTabletView || previewMode) {
    return null
  }

  const renderInspectorContainer = (options?: { showBack?: boolean; content?: ReactNode; includeHeader?: boolean }) => {
    const { showBack, content, includeHeader } = options || {}

    return (
      <InspectorWithPreviewMode
        includeHeader={includeHeader}
        renderAction={
          showBack && clickedLayerStore ? (
            <InspectorContainerBackButton onBackToOutline={onBackToOutline} clickedLayerStore={clickedLayerStore} />
          ) : null
        }
        renderContent={content}
      />
    )
  }

  return (
    <div style={{ gridColumn: '1 / -1', gridRow: '4', height: '100%', overflow: 'hidden' }}>
      {renderInspectorContainer({
        includeHeader: false,
        showBack: showInspectorOnTablet,
        content: showInspectorOnTablet ? undefined : (
          <TemplateEditorOutline t={t} defaultToolId={LayerToolMap.LAYERS_LISTING} />
        ),
      })}
    </div>
  )
}
