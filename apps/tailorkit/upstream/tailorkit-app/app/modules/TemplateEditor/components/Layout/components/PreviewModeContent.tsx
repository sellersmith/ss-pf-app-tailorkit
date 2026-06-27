/**
 * Preview mode content component
 */

import { Fragment } from 'react'
import { InspectorWithPreviewMode } from '../../Inspector'
import { PreviewTemplate } from '../../Preview/index.client'

interface PreviewModeContentProps {
  isDesktopView: boolean
  isTabletView: boolean
  showInspectorSidebar: boolean
  templateEditorInspectorWidth: string
  templateEditorCanvasContainerWidth: string
}

/**
 * Renders the preview mode layout with canvas and inspector
 * Note: Mobile inspector is handled separately in MobileContent component
 */
export default function PreviewModeContent({
  isDesktopView,
  isTabletView,
  showInspectorSidebar,
  templateEditorInspectorWidth,
  templateEditorCanvasContainerWidth,
}: PreviewModeContentProps) {
  return (
    <Fragment>
      {/* Preview canvas */}
      <div
        style={{
          flex: 1,
          height: '100%',
          minHeight: 0,
          width: templateEditorCanvasContainerWidth,
          background: 'var(--p-color-bg-fill-disabled)',
          padding: 'var(--p-space-200)',
          position: 'relative',
        }}
      >
        <PreviewTemplate canWheel={true} showSaveButton={false} scaleUpStageViewPort={true} />
      </div>

      {/* Inspector in preview mode - desktop and tablet only */}
      {(isDesktopView || isTabletView) && showInspectorSidebar && (
        <div
          className="template-inspector-container"
          style={{
            position: 'relative',
            width: isTabletView ? '100%' : templateEditorInspectorWidth,
            height: '100%',
            minHeight: 0,
            flex: isTabletView ? 1 : undefined,
            borderLeft: '1px solid var(--p-color-border)',
            background: 'white',
          }}
        >
          <InspectorWithPreviewMode includeHeader={isTabletView ? false : true} />
        </div>
      )}
    </Fragment>
  )
}
