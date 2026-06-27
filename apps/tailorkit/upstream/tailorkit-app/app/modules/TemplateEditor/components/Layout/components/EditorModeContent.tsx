/**
 * Editor mode content component — always renders the design canvas.
 *
 * On full desktop (>1055px): canvas only — inspector is in the left DesktopSidebar,
 * preview is in the right PreviewPanel grid column.
 *
 * On small desktop / tablet-inspector range (785-1055px): canvas + inline InspectorContainer
 * (the original master behavior). DesktopSidebar is hidden at this range.
 */

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import type { TLayerStore } from '~/stores/modules/layer'
import TemplateEditorCanvas from '../../Editor'
import { InspectorContainer } from './InspectorContainer'

const noop = () => {}

interface EditorModeContentProps {
  templateEditorCanvasContainerWidth: string
  /** Show inline inspector (for 785-1055px range where DesktopSidebar is hidden) */
  showInlineInspector?: boolean
  templateEditorInspectorWidth?: string
  isCompactRightPane?: boolean
  showInspectorOnCompact?: boolean
  clickedLayerStore?: TLayerStore | null
  onBackToOutline?: (() => void) | undefined
  isChatBotOpen?: boolean
}

export default function EditorModeContent({
  templateEditorCanvasContainerWidth,
  showInlineInspector = false,
  templateEditorInspectorWidth = '0px',
  isCompactRightPane = false,
  showInspectorOnCompact = false,
  clickedLayerStore,
  onBackToOutline,
  isChatBotOpen = false,
}: EditorModeContentProps) {
  const { t } = useTranslation()

  return (
    <Fragment>
      <div
        className={TEMPLATE_EDITOR_CANVAS_CONTAINER}
        style={{
          flex: 1,
          width: templateEditorCanvasContainerWidth,
          height: '100%',
          overflow: 'hidden',
          willChange: 'width',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          contain: 'layout style paint',
        }}
      >
        <TemplateEditorCanvas />
      </div>

      {/* Inline inspector for small desktop / tablet-inspector range (785-1055px).
          Mirrors the original master behavior where InspectorContainer sits beside the canvas. */}
      {showInlineInspector && (
        <div
          className="template-inspector-container"
          style={{
            position: 'relative',
            width: templateEditorInspectorWidth,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <InspectorContainer
            isCompactRightPane={isCompactRightPane}
            showInspectorOnCompact={showInspectorOnCompact}
            clickedLayerStore={clickedLayerStore}
            onBackToOutline={onBackToOutline ?? noop}
            t={t}
            isChatBotOpen={isChatBotOpen}
          />
        </div>
      )}
    </Fragment>
  )
}
