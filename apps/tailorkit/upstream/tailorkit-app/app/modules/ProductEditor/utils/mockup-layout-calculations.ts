/**
 * Layout calculation utilities for the Mockup tab (Live preview) grid.
 *
 * Extracted from ProductEditor/index.tsx for testability and clarity.
 * These are pure functions — no React hooks or side effects.
 */

import { calculateInspectorWidth } from '~/modules/TemplateEditor/components/Layout/utils/layoutCalculations'

/** Minimum viewport width for the desktop 3-column mockup layout */
export const DESKTOP_MOCKUP_LAYOUT_BREAKPOINT = 1056

/** CSS transition for smooth grid column changes */
export const MOCKUP_GRID_TRANSITION = 'grid-template-columns 0.2s cubic-bezier(0.4, 0, 0.2, 1)'

interface MockupLayoutFlags {
  isTabletOrMobile: boolean
  viewportWidth: number
  isChatBotOpen: boolean
  previewMode: boolean
}

/**
 * Determine whether the desktop 3-column mockup layout should be active.
 * When true, settings panel stays on the LEFT — even when AI panel hides the preview.
 */
export function isDesktopMockupLayoutActive(flags: MockupLayoutFlags): boolean {
  return !flags.isTabletOrMobile && flags.viewportWidth >= DESKTOP_MOCKUP_LAYOUT_BREAKPOINT && !flags.previewMode
}

/**
 * Determine whether the mockup preview panel (right column) should be visible.
 * Hidden when AI panel is open (right column gives way to AI chat).
 */
export function shouldShowMockupPreviewPanel(flags: MockupLayoutFlags): boolean {
  return isDesktopMockupLayoutActive(flags) && !flags.isChatBotOpen
}

/**
 * Calculate the panel width for both left (settings) and right (preview) columns.
 * Uses the Design tab's calculateInspectorWidth with isSidebarOpen=true
 * (compact 360px) since both panels are always visible simultaneously.
 */
export function calculateMockupPanelWidth(isChatBotOpen: boolean, viewportWidth: number): string {
  return calculateInspectorWidth({
    showInspectorSidebar: true,
    isSmallDesktopView: false,
    isSidebarOpen: true,
    isChatBotOpen,
    viewportWidth,
  })
}

interface MockupGridColumnsParams {
  isTabletOrMobile: boolean
  showMockupPreviewPanel: boolean
  isDesktopMockupLayout: boolean
  mockupPanelWidth: string
  inspectorWidth: number
}

/**
 * Calculate the CSS grid-template-columns value for the Mockup tab.
 *
 * Returns:
 * - '1fr' for mobile/tablet
 * - '[panelWidth] 1fr [panelWidth]' for desktop 3-column (preview visible)
 * - '[panelWidth] 1fr' for desktop 2-column (AI panel open, no preview)
 * - 'minmax(0, 2fr) [inspectorWidth]px' for narrow desktop fallback
 */
export function calculateMockupGridColumns(params: MockupGridColumnsParams): string {
  const { isTabletOrMobile, showMockupPreviewPanel, isDesktopMockupLayout, mockupPanelWidth, inspectorWidth } = params

  if (isTabletOrMobile) return '1fr'
  if (showMockupPreviewPanel) return `${mockupPanelWidth} 1fr ${mockupPanelWidth}`
  if (isDesktopMockupLayout) return `${mockupPanelWidth} 1fr`
  return `minmax(0, 2fr) ${inspectorWidth}px`
}
