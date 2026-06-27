/**
 * Permanent preview panel that sits in the right column of the editor grid.
 * Always shows PreviewInspector — it handles empty layers/option sets gracefully
 * by showing "PERSONALIZED DESIGN" heading + Sales tools info banner.
 *
 * Selection highlight behavior:
 * - On pointer enter: hide canvas transformer handles so they don't distract while
 *   the user is working in this panel (buyer's view context).
 * - On pointer leave: restore transformer so canvas is fully interactive again.
 * - Layer selection (`clickedLayerStore`) is never cleared, so the left inspector
 *   stays open throughout.
 */
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import MultiTemplatePreviewPanel from './MultiTemplatePreviewPanel.client'

interface PreviewPanelProps {
  width: string
  visible: boolean
}

export default function PreviewPanel({ width, visible }: PreviewPanelProps) {
  return (
    <div
      // Do NOT clear layer selection here — in the 3-column layout the preview panel is a
      // separate column that users interact with while keeping the left inspector open.
      onPointerEnter={() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)}
      onPointerLeave={() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)}
      style={{
        width: visible ? width : '0px',
        height: '100%',
        overflow: 'hidden',
        overflowY: 'auto',
        borderLeft: visible ? '1px solid var(--p-color-border)' : 'none',
        background: 'var(--p-color-bg-surface)',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        contain: 'layout style paint',
      }}
    >
      {visible && <MultiTemplatePreviewPanel />}
    </div>
  )
}
