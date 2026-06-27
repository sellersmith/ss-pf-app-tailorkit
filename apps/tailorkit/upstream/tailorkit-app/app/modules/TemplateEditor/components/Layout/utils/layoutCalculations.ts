/**
 * Layout calculation utilities for template editor
 */

import { CHAT_BOT_DRAWER_WIDTH } from '~/components/ChatBotDrawer/constants'
import { EXTRA_INSPECTOR_WIDTH, LARGE_TEMPLATE_EDITOR_INSPECTOR_WIDTH, SMALL_INSPECTOR_WIDTH } from '../../../constants'

export interface LayoutDimensions {
  templateEditorOutlineWidth: string
  templateEditorInspectorWidth: string
  templateEditorCanvasContainerWidth: string
  previewPanelWidth: string
}

export interface LayoutCalculationProps {
  previewMode: boolean
  isSidebarOpen: boolean
  isSmallDesktopView: boolean
  isChatBotOpen: boolean
  isTabletView: boolean
  isDesktopView: boolean
  showInspectorSidebar: boolean
  viewportWidth: number
  /** Whether an AI panel (Elva AI chatbot, AI image inspector) is open */
  isAIPanelOpen: boolean
}

/**
 * Calculate the outline width. Returns 0px in the new layout because the left
 * sidebar column uses `auto` sizing from its content (toolbar + panel).
 * Kept for gridConfig.ts backward compat — will be removed in Phase 4 cleanup.
 */
export function calculateOutlineWidth(): string {
  return '0px'
}

/**
 * Calculate the shared panel width used for both the left sidebar and the preview panel.
 * This is the former inspector width — unchanged semantically.
 */
export function calculateInspectorWidth(
  props: Pick<
    LayoutCalculationProps,
    'showInspectorSidebar' | 'isSmallDesktopView' | 'isSidebarOpen' | 'isChatBotOpen' | 'viewportWidth'
  >
): string {
  const { showInspectorSidebar, isSmallDesktopView, isSidebarOpen, isChatBotOpen, viewportWidth } = props

  if (!showInspectorSidebar) {
    return '0px'
  }

  if (isSmallDesktopView) {
    return SMALL_INSPECTOR_WIDTH
  }

  if (isSidebarOpen || isChatBotOpen) {
    return LARGE_TEMPLATE_EDITOR_INSPECTOR_WIDTH
  }

  // Clamp between SMALL_INSPECTOR_WIDTH (280px) and EXTRA_INSPECTOR_WIDTH (320px)
  const min = parseInt(SMALL_INSPECTOR_WIDTH)
  const max = parseInt(EXTRA_INSPECTOR_WIDTH)
  return `${Math.min(max, Math.max(min, Math.floor(viewportWidth / 4)))}px`
}

/**
 * Calculate the preview panel width (right column).
 * Same as inspector width on desktop; 0px on tablet/mobile or preview mode.
 */
export function calculatePreviewPanelWidth(
  props: Pick<
    LayoutCalculationProps,
    | 'previewMode'
    | 'isTabletView'
    | 'isDesktopView'
    | 'isSmallDesktopView'
    | 'isAIPanelOpen'
    | 'showInspectorSidebar'
    | 'isSidebarOpen'
    | 'isChatBotOpen'
    | 'viewportWidth'
  >
): string {
  const { previewMode, isTabletView, isDesktopView, isSmallDesktopView, isAIPanelOpen } = props

  // Preview panel is desktop-only; hide for tablet, mobile, small desktop, preview mode, and AI panels.
  // When Elva AI or AI image inspector opens, only the preview panel closes — left sidebar stays.
  if (previewMode || isTabletView || !isDesktopView || isSmallDesktopView || isAIPanelOpen) {
    return '0px'
  }

  return calculateInspectorWidth(props)
}

/**
 * Calculate the canvas container width based on layout state.
 * Canvas sits in grid col 2 (1fr). Grid handles sidebar and preview panel sizing.
 * Only the chatbot drawer (overlaid outside grid) needs explicit subtraction.
 */
export function calculateCanvasContainerWidth(
  props: Pick<LayoutCalculationProps, 'isTabletView' | 'isChatBotOpen'>
): string {
  const { isTabletView, isChatBotOpen } = props

  // Tablet layout uses single column; canvas should take full width
  if (isTabletView) {
    return '100%'
  }

  const chatBotWidth = isChatBotOpen ? `${CHAT_BOT_DRAWER_WIDTH}px` : '0px'

  return `calc(100% - ${chatBotWidth})`
}

/**
 * Calculate all layout dimensions
 */
export function calculateLayoutDimensions(props: LayoutCalculationProps): LayoutDimensions {
  const templateEditorOutlineWidth = calculateOutlineWidth()
  const templateEditorInspectorWidth = calculateInspectorWidth(props)
  const previewPanelWidth = calculatePreviewPanelWidth(props)
  const templateEditorCanvasContainerWidth = calculateCanvasContainerWidth({
    isTabletView: props.isTabletView,
    isChatBotOpen: props.isChatBotOpen,
  })

  return {
    templateEditorOutlineWidth,
    templateEditorInspectorWidth,
    templateEditorCanvasContainerWidth,
    previewPanelWidth,
  }
}
