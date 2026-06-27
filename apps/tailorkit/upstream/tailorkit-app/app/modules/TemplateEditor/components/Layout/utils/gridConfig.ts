/**
 * Grid configuration utilities for template editor layout
 */
import { LAYER_TOOLBAR_WIDTH } from '../../Outline/LayerToolbar/constants'

export interface GridConfig {
  gridTemplateRows: string
  gridTemplateColumns: string
}

export interface LayoutState {
  isTabletView: boolean
  isSmallMobileView: boolean
  /** @deprecated Preview is now always visible in the right panel. */
  previewMode?: boolean
  templateEditorOutlineWidth: string
  /** Fixed pixel width for the left sidebar column — prevents auto-expansion when inspector opens. */
  templateEditorInspectorWidth: string
  /** Fixed pixel width for the right preview panel column — prevents auto-expansion when effects/AI panels open. */
  previewPanelWidth: string
  /** Whether DesktopSidebar is visible (false at 785-1055px and small desktop) */
  showDesktopSidebar: boolean
}

/**
 * Calculate grid template rows based on device type
 */
export function getGridTemplateRows(state: Pick<LayoutState, 'isTabletView' | 'isSmallMobileView'>): string {
  const { isTabletView, isSmallMobileView } = state

  if (isTabletView || isSmallMobileView) {
    return 'auto auto 1fr auto' // header + inspector header + canvas + mobile inspector
  }

  return 'auto 1fr' // default: header + content
}

/**
 * Calculate grid template columns based on device type.
 * Both the left and right columns use calculated fixed pixel widths (not `auto`) to prevent
 * expansion when Inspector or AI effects panels open — CSS `auto` tracks size to
 * max-content which ignores `overflow: hidden` on child elements.
 *
 * Left column = templateEditorInspectorWidth + LAYER_TOOLBAR_WIDTH (LayerToolbar rail).
 * This keeps the inspector/outline CONTENT area the same width as the right preview panel
 * (which is also templateEditorInspectorWidth), matching the old right-side inspector width.
 */
export function getGridTemplateColumns(
  state: Pick<LayoutState, 'isTabletView' | 'templateEditorInspectorWidth' | 'previewPanelWidth' | 'showDesktopSidebar'>
): string {
  if (state.isTabletView) {
    // Tablet mirrors mobile: single column
    return '1fr'
  }

  // When DesktopSidebar is hidden (785-1055px / small desktop), use single column.
  // EditorModeContent handles its own inline inspector for this range.
  if (!state.showDesktopSidebar) {
    return '1fr'
  }

  // Left column adds toolbar width for the LayerToolbar rail so content area = templateEditorInspectorWidth.
  // 3-column only when preview panel has width; otherwise 2-column (AI panel open, etc.)
  const hasPreviewPanel = state.previewPanelWidth && state.previewPanelWidth !== '0px'
  if (hasPreviewPanel) {
    return `calc(${state.templateEditorInspectorWidth} + ${LAYER_TOOLBAR_WIDTH}px) 1fr ${state.previewPanelWidth}`
  }
  return `calc(${state.templateEditorInspectorWidth} + ${LAYER_TOOLBAR_WIDTH}px) 1fr`
}

/**
 * Get complete grid configuration for the layout
 */
export function getGridConfig(state: LayoutState): GridConfig {
  return {
    gridTemplateRows: getGridTemplateRows(state),
    gridTemplateColumns: getGridTemplateColumns(state),
  }
}
