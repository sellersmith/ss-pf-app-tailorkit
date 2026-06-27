/**
 * Desktop sidebar component for the template editor.
 * Shows LayerToolbar + ToolSidebar by default; swaps panel content to Inspector
 * with breadcrumb navigation when a layer is selected.
 * Always visible — AI panels (Elva AI, SubInspector) close the preview panel instead.
 */

import type { TLayerStore } from '~/stores/modules/layer'
import OutlineInspectorPanel from './OutlineInspectorPanel'

interface DesktopSidebarProps {
  isDesktopView: boolean
  isSmallDesktopView: boolean
  isTabletView: boolean
  isTabletInspectorMode?: boolean
  clickedLayerStore: TLayerStore | null
  onBackToOutline: () => void
  panelWidth: string
}

/**
 * Renders the navigation sidebar for desktop view.
 * Delegates left panel content to OutlineInspectorPanel which toggles
 * between ToolSidebar and Inspector based on layer selection.
 * The left panel stays open when AI panels are open; the preview panel closes instead.
 */
export default function DesktopSidebar({
  isDesktopView,
  isSmallDesktopView,
  isTabletView,
  isTabletInspectorMode,
  clickedLayerStore,
  onBackToOutline,
  panelWidth,
}: DesktopSidebarProps) {
  // Desktop only; hide on tablet, small desktop, mobile, and tablet-inspector mode
  if (!isDesktopView || isTabletView || isSmallDesktopView || isTabletInspectorMode) {
    return null
  }

  return (
    <div
      style={{
        gridColumn: '1',
        gridRow: '2',
        height: '100%',
        overflow: 'hidden',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        contain: 'layout style paint',
      }}
    >
      <OutlineInspectorPanel
        clickedLayerStore={clickedLayerStore}
        onBackToOutline={onBackToOutline}
        panelWidth={panelWidth}
      />
    </div>
  )
}
