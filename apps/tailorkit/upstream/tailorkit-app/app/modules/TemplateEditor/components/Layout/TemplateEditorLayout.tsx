/**
 * Optimized Template Editor Layout Component
 *
 * This component orchestrates the main layout for the template editor,
 * providing responsive layouts for desktop, tablet, and mobile devices.
 *
 * Full desktop (>1055px): 3-column grid [LeftSidebar | Canvas | PreviewPanel]
 * Small desktop / tablet-inspector (785-1055px): 1-column grid, canvas + inline inspector
 * Tablet / mobile (<785px): unchanged from master — single column with mobile content
 */

import { useLayoutState } from './hooks/useLayoutState'
import LayoutHeader from './components/LayoutHeader'
import DesktopSidebar from './components/DesktopSidebar'
import PreviewModeContent from './components/PreviewModeContent'
import EditorModeContent from './components/EditorModeContent'
import { MobileContent } from './components/MobileContent'
import { AIGeneratorSubInspector } from '../Inspector/AIGeneratorSubInspector'
import { LibraryToolsSubInspector } from '../Inspector/LibraryToolsSubInspector'
import TemplateEditorKeyboardShortcuts from './TemplateEditorKeyboardShortcuts'
import PreviewPanel from './components/PreviewPanel'

/**
 * Main template editor layout component
 */
export default function TemplateEditorLayout() {
  const layoutState = useLayoutState()

  const {
    isTabletInspectorMode,
    isDesktopView,
    isSmallDesktopView,
    isSmallMobileView,
    isTabletView,
    previewMode,
    isChatBotOpen,
    showPreviewPanel,
    showDesktopSidebar,
    showInspectorSidebar,
    isCompactRightPane,
    showInspectorOnCompact,
    clickedLayerStore,
    templateEditorCanvasContainerWidth,
    templateEditorInspectorWidth,
    previewPanelWidth,
    gridTemplateRows,
    gridTemplateColumns,
    onBackToOutline,
  } = layoutState

  // Show inline inspector inside EditorModeContent when DesktopSidebar is hidden
  // (785-1055px range). Mirrors the original master behavior.
  const showInlineInspector = Boolean(isDesktopView) && !isTabletView && !showDesktopSidebar

  return (
    <div
      className={`${isDesktopView ? 'template-container' : ''}`}
      style={{
        display: 'grid',
        gridTemplateRows,
        gridTemplateColumns,
        height: '100vh',
        position: 'relative',
        transition: 'grid-template-columns 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'grid-template-columns',
        transform: 'translateZ(0)',
      }}
    >
      {/* Headers (main + device-specific inspector headers) */}
      <LayoutHeader isSmallMobileView={isSmallMobileView} isTabletView={isTabletView} />

      {/* Desktop sidebar navigation — col 1, also hosts inspector when layer selected.
          Only rendered on full desktop (>1055px). */}
      <DesktopSidebar
        isDesktopView={Boolean(isDesktopView)}
        isSmallDesktopView={Boolean(isSmallDesktopView)}
        isTabletView={Boolean(isTabletView)}
        isTabletInspectorMode={Boolean(isTabletInspectorMode)}
        clickedLayerStore={clickedLayerStore ?? null}
        onBackToOutline={onBackToOutline}
        panelWidth={templateEditorInspectorWidth}
      />

      {/* Main content area — col 1 or 2 depending on sidebar visibility */}
      <div
        style={{
          gridColumn: isTabletView || !showDesktopSidebar ? '1' : '2',
          gridRow: isTabletView || isSmallMobileView ? '3' : '2',
          display: 'flex',
          flexDirection: previewMode && isTabletView ? 'column' : undefined,
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Preview mode on mobile/tablet only — desktop has preview in right panel.
            Guard: only render PreviewModeContent when NOT on full desktop (prevents URL ?tab=preview overlap). */}
        {previewMode && !showDesktopSidebar ? (
          <PreviewModeContent
            isDesktopView={isDesktopView}
            isTabletView={isTabletView}
            showInspectorSidebar={showInspectorSidebar}
            templateEditorInspectorWidth={templateEditorInspectorWidth}
            templateEditorCanvasContainerWidth={templateEditorCanvasContainerWidth}
          />
        ) : (
          <EditorModeContent
            templateEditorCanvasContainerWidth={templateEditorCanvasContainerWidth}
            showInlineInspector={showInlineInspector}
            templateEditorInspectorWidth={templateEditorInspectorWidth}
            isCompactRightPane={isCompactRightPane}
            showInspectorOnCompact={showInspectorOnCompact}
            clickedLayerStore={clickedLayerStore}
            onBackToOutline={onBackToOutline}
            isChatBotOpen={isChatBotOpen}
          />
        )}
      </div>

      {/* Preview panel — col 3, full desktop only; option-set interactions update the design canvas in real-time */}
      {showPreviewPanel && (
        <div
          id="design-preview-panel"
          style={{
            gridColumn: '3',
            gridRow: '2',
            height: '100%',
            overflow: 'hidden',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            contain: 'layout style paint',
          }}
        >
          <PreviewPanel width={previewPanelWidth} visible={showPreviewPanel} />
        </div>
      )}

      {/* Mobile/Tablet content */}
      <MobileContent
        isSmallMobileView={Boolean(isSmallMobileView || (isTabletView && !isTabletInspectorMode))}
        previewMode={Boolean(previewMode)}
      />

      {/* Global AI Generator Sub-Inspector */}
      <AIGeneratorSubInspector />

      {/* Global Library Tools Sub-Inspector */}
      <LibraryToolsSubInspector />

      {/* Global editor keyboard shortcuts (active regardless of sidebar visibility) */}
      <TemplateEditorKeyboardShortcuts />
    </div>
  )
}
