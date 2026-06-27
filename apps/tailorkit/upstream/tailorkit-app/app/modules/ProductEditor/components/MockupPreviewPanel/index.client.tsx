/**
 * Preview panel for the Mockup tab's right column (desktop only).
 *
 * Same UI as the Design tab's preview panel, plus ViewsBar under the heading
 * for switching between mockup views.
 *
 * ViewsBar is rendered via `afterHeadingContent` slot (between heading/divider
 * and scrollable options) instead of `prependContent` (inside scrollable area)
 * because the Preact web component mounts more reliably at the top React tree level.
 *
 * Expects TemplateLayerStoresContext from parent wrapper.
 */
import IntegrationInspectorCard from '../Preview/IntegrationInspectorCard'

interface MockupPreviewPanelProps {
  width: string
}

export default function MockupPreviewPanel({ width }: MockupPreviewPanelProps) {
  return (
    <div
      style={{
        width,
        height: '100%',
        overflow: 'hidden',
        overflowY: 'auto',
        borderLeft: '1px solid var(--p-color-border)',
        background: 'var(--p-color-bg-surface)',
        contain: 'layout style paint',
      }}
    >
      <IntegrationInspectorCard previewMode showInfoBanner={false} showViewsBar />
    </div>
  )
}
