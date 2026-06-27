/* eslint-disable max-lines */
/**
 * EditorToolbar - Toolbar component for VectorEditor
 */

import { useEffect, useCallback, useRef, useMemo } from 'react'
import { InlineStack, Button, ButtonGroup, Tooltip } from '@shopify/polaris'
import {
  DeleteIcon,
  UndoIcon,
  RedoIcon,
  CheckIcon,
  XIcon,
  ClipboardIcon,
  PlusIcon,
  EditIcon,
} from '@shopify/polaris-icons'
import type { EditorToolbarProps } from '../../types'
import { formatShortcut, formatShortcutMulti } from '../../utils/platformShortcuts'
import styles from './styles.module.css'
import { useTranslation } from 'react-i18next'
import useDevices from '~/utils/hooks/useDevice'

// Import icons from icons folder
import {
  ToCurveIcon,
  ToLineIcon,
  QuadraticCurveIcon,
  SelectAllIcon,
  InvertSelectionIcon,
  MultiSelectIcon,
  SelectionRectIcon,
  InsertNodeIcon,
  BreakPathIcon,
  ExtendPathIcon,
  NewSubpathIcon,
  CopyIcon,
  ScissorsIcon,
  MoveUpIcon,
  MoveDownIcon,
  MoveToFrontIcon,
  MoveToBackIcon,
  TraceIcon,
  ClipPathIcon,
  HolePathIcon,
  AdjustmentMaskIcon,
  FillIcon,
  StrokeIcon,
  FiltersIcon,
  AdjustmentsIcon,
  GuideImageIcon,
} from './icons'

export default function EditorToolbar({
  editorMode,
  canUndo,
  canRedo,
  hasSelection,
  hasNodeSelection,
  canCopy,
  drawingPath,
  isStartingNewSubpath,
  selectedPredefinedShape,
  // Subpath styling props
  isSubpathStylingMode,
  // Filter applied state (for disabling adjustments)
  selectedPathHasFilter = false,
  // Adjustments applied state (for disabling filters)
  selectedPathHasAdjustments = false,
  onModeChange,
  onUndo,
  onRedo,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onInvertSelection,
  onFinishDrawing,
  onCancelDrawing,
  onToggleNewSubpath,
  // Layer ordering (z-index) props
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onMoveToFront,
  onMoveToBack,
  // Overlay mode props
  isOverlayMode,
  // Image tracing props
  isTracing,
  onTraceImage,
  // Clip path and hole path props
  isSelectedPathClip,
  isSelectedPathHole,
  onToggleClipPath,
  onToggleHolePath,
  // Adjustment mask props
  isSelectedPathAdjustmentMask,
  onToggleAdjustmentMask,
  // Drawing curve type props (Feature 1)
  drawingCurveType = 'cubic',
  onDrawingCurveTypeChange,
  // Select all nodes (Feature 2)
  onSelectAllNodes,
  // Mobile modifier toggles (Feature 2)
  mobileInsertNodeMode,
  mobileMultiSelectMode,
  mobileSelectionRectMode,
  onToggleMobileInsertNodeMode,
  onToggleMobileMultiSelectMode,
  onToggleMobileSelectionRectMode,
  // Extend mode props (Feature 3)
  isExtendMode,
  onToggleExtendMode,
  onBreakOpenPath,
  selectedPathIsClosed,
  // Auto-open draw sidebar on first draw mode activation (blank canvas)
  shouldAutoOpenDrawSidebar,
  onDrawSidebarOpened,
  // Notify parent when popover open state changes
  onPopoverOpenChange,
  // Close popover from parent (e.g., when canvas is tapped)
  closePopover,
  // Sidebar props
  activeSidebarSection,
  onToggleSidebarSection,
  onCloseSidebar,
  // Edit mode settings props (used for toolbar offset calculation)
  editModeSettings,
  // Mobile hint callback — parent renders hint outside the scrollable toolbar
  onMobileHintChange,
}: EditorToolbarProps) {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()

  // Keep track of closePopover ref for future use
  const prevClosePopoverRef = useRef(closePopover)
  useEffect(() => {
    prevClosePopoverRef.current = closePopover
  }, [closePopover])

  // Mobile tap hint: notify parent to render the hint outside the toolbar scroll container.
  const showMobileHint = useCallback(
    (text: string) => {
      if (!isMobileView) return
      onMobileHintChange?.(text)
    },
    [isMobileView, onMobileHintChange]
  )

  // Notify parent about popover state (no more popovers, always false)
  useEffect(() => {
    onPopoverOpenChange?.(false)
  }, [onPopoverOpenChange])

  // Helper to wrap button click handlers to also close sidebar
  const withSidebarClose = useCallback(
    <T extends (...args: never[]) => void>(handler?: T) => {
      return (...args: Parameters<T>) => {
        onCloseSidebar?.()
        handler?.(...args)
      }
    },
    [onCloseSidebar]
  )

  // Helper to build tooltip content with optional disabled reason
  const buildTooltip = useCallback((baseContent: string, isDisabled: boolean, disabledReason?: string) => {
    if (isDisabled && disabledReason) {
      return disabledReason
    }
    return baseContent
  }, [])

  // Compute disabled states and reasons for all buttons
  const curveTypeDisabled = !!selectedPredefinedShape
  const curveTypeDisabledReason = curveTypeDisabled ? t('unavailable-when-using-predefined-shapes') : undefined

  const newSubpathDisabled = !drawingPath || drawingPath.length < 1
  const newSubpathDisabledReason = newSubpathDisabled ? t('start-drawing-first') : undefined

  const finishDrawingDisabled = !drawingPath || drawingPath.length < 2
  const finishDrawingDisabledReason = finishDrawingDisabled ? t('draw-at-least-2-points-first') : undefined

  const cancelDrawingDisabled = !drawingPath
  const cancelDrawingDisabledReason = cancelDrawingDisabled ? t('no-drawing-to-cancel') : undefined

  const undoDisabled = !canUndo
  const undoDisabledReason = undoDisabled ? t('nothing-to-undo') : undefined

  const redoDisabled = !canRedo
  const redoDisabledReason = redoDisabled ? t('nothing-to-redo') : undefined

  const copyDisabled = !canCopy
  const copyDisabledReason = copyDisabled ? t('select-a-path-to-copy') : undefined

  const cutDisabled = !canCopy
  const cutDisabledReason = cutDisabled ? t('select-a-path-to-cut') : undefined

  const deleteDisabled = !hasSelection
  const deleteDisabledReason = deleteDisabled ? t('select-a-path-to-delete') : undefined

  const fillDisabled = !hasSelection || isSubpathStylingMode
  const fillDisabledReason = !hasSelection
    ? t('select-a-path-first')
    : isSubpathStylingMode
      ? t('unavailable-when-selecting-subpath')
      : undefined

  const strokeDisabled = !hasSelection || isSubpathStylingMode
  const strokeDisabledReason = !hasSelection
    ? t('select-a-path-first')
    : isSubpathStylingMode
      ? t('unavailable-when-selecting-subpath')
      : undefined

  // For legacy SVGs with both filter and adjustments, allow access to both panels
  // The panel will show remove-only UI in that case
  const hasBothEffects = selectedPathHasFilter && selectedPathHasAdjustments
  const filtersDisabled
    = (!hasSelection && !isOverlayMode) || isSubpathStylingMode || (selectedPathHasAdjustments && !hasBothEffects)
  const filtersDisabledReason
    = !hasSelection && !isOverlayMode
      ? t('select-a-path-first')
      : isSubpathStylingMode
        ? t('unavailable-when-selecting-subpath')
        : selectedPathHasAdjustments && !hasBothEffects
          ? t('unavailable-when-adjustments-are-applied')
          : undefined

  const adjustmentsDisabled
    = (!hasSelection && !isOverlayMode) || isSubpathStylingMode || (selectedPathHasFilter && !hasBothEffects)
  const adjustmentsDisabledReason
    = !hasSelection && !isOverlayMode
      ? t('select-a-path-first')
      : isSubpathStylingMode
        ? t('unavailable-in-subpath-styling-mode')
        : selectedPathHasFilter && !hasBothEffects
          ? t('unavailable-when-a-filter-is-applied')
          : undefined

  const traceImageDisabled = isTracing || !isOverlayMode || !onTraceImage
  const traceImageDisabledReason = !isOverlayMode
    ? t('available-when-editing-a-raster-image')
    : isTracing
      ? t('tracing-in-progress')
      : undefined

  const clipPathDisabled = !hasSelection || !onToggleClipPath
  const clipPathDisabledReason = clipPathDisabled && !hasSelection ? t('select-a-path-first') : undefined

  const holePathDisabled = !hasSelection || !onToggleHolePath
  const holePathDisabledReason = holePathDisabled && !hasSelection ? t('select-a-path-first') : undefined

  const adjustmentMaskDisabled = !isOverlayMode || !hasSelection || !onToggleAdjustmentMask
  const adjustmentMaskDisabledReason = !isOverlayMode
    ? t('available-when-editing-a-raster-image')
    : !hasSelection
      ? t('select-a-path-first')
      : undefined

  const extendPathDisabled = !hasNodeSelection && !isExtendMode
  const extendPathDisabledReason = extendPathDisabled ? t('select-a-node-to-extend-from') : undefined

  const breakPathDisabled = !hasNodeSelection || !selectedPathIsClosed
  const breakPathDisabledReason = !hasNodeSelection
    ? t('select-a-node-first')
    : !selectedPathIsClosed
      ? t('path-must-be-closed')
      : undefined

  const moveUpDisabled = !canMoveUp
  const moveUpDisabledReason = moveUpDisabled ? t('already-at-front') : undefined

  const moveDownDisabled = !canMoveDown
  const moveDownDisabledReason = moveDownDisabled ? t('already-at-back') : undefined

  // Map of button IDs to their tooltip text (used for mobile tap hint via event delegation)
  const mobileHintMap = useMemo<Record<string, string>>(
    () => ({
      've-btn-draw-mode': t('ve-hint-draw-mode'),
      've-btn-edit-mode': t('ve-hint-edit-mode'),
      've-btn-finish-drawing': buildTooltip(
        t('complete-the-current-path'),
        finishDrawingDisabled,
        finishDrawingDisabledReason
      ),
      've-btn-cancel-drawing': buildTooltip(
        t('discard-the-current-drawing'),
        cancelDrawingDisabled,
        cancelDrawingDisabledReason
      ),
      've-btn-straight-lines': buildTooltip(t('ve-hint-straight-lines'), curveTypeDisabled, curveTypeDisabledReason),
      've-btn-quadratic-curves': buildTooltip(
        t('ve-hint-quadratic-curves'),
        curveTypeDisabled,
        curveTypeDisabledReason
      ),
      've-btn-cubic-curves': buildTooltip(t('ve-hint-cubic-curves'), curveTypeDisabled, curveTypeDisabledReason),
      've-btn-new-subpath': buildTooltip(t('ve-hint-new-subpath'), newSubpathDisabled, newSubpathDisabledReason),
      've-btn-undo': buildTooltip(t('undo-the-last-action'), undoDisabled, undoDisabledReason),
      've-btn-redo': buildTooltip(t('redo-the-previously-undone-action'), redoDisabled, redoDisabledReason),
      've-btn-selection-rect': t('drag-to-draw-a-selection-rectangle-around-nodes'),
      've-btn-multi-select': t('toggle-multi-select-mode-to-select-multiple-items'),
      've-btn-insert-node': t('ve-hint-insert-node'),
      've-btn-select-all': t('select-all-nodes-in-the-current-path'),
      've-btn-invert-selection': t('invert-the-current-selection'),
      've-btn-copy': buildTooltip(t('copy-selected-items-to-clipboard'), copyDisabled, copyDisabledReason),
      've-btn-cut': buildTooltip(t('cut-selected-items-to-clipboard'), cutDisabled, cutDisabledReason),
      've-btn-paste': t('paste-items-from-clipboard'),
      've-btn-delete': buildTooltip(t('delete-selected-items'), deleteDisabled, deleteDisabledReason),
      've-btn-fill': buildTooltip(t('open-fill-color-and-gradient-settings'), fillDisabled, fillDisabledReason),
      've-btn-stroke': buildTooltip(t('open-stroke-color-and-width-settings'), strokeDisabled, strokeDisabledReason),
      've-btn-filters': buildTooltip(t('apply-blur-and-shadow-effects'), filtersDisabled, filtersDisabledReason),
      've-btn-adjustments': buildTooltip(
        t('adjust-opacity-blend-mode-and-color-settings'),
        adjustmentsDisabled,
        adjustmentsDisabledReason
      ),
      've-btn-clip-path': buildTooltip(
        t('use-path-as-a-clipping-mask-for-the-image'),
        clipPathDisabled,
        clipPathDisabledReason
      ),
      've-btn-hole-path': buildTooltip(
        t('use-path-as-a-hole-cutout-in-the-image'),
        holePathDisabled,
        holePathDisabledReason
      ),
      've-btn-trace-image': buildTooltip(
        t('trace-the-background-image-to-create-vector-paths'),
        traceImageDisabled,
        traceImageDisabledReason
      ),
      've-btn-adjustment-mask': buildTooltip(
        t('use-path-as-an-adjustment-mask-for-image-effects'),
        adjustmentMaskDisabled,
        adjustmentMaskDisabledReason
      ),
      've-btn-extend-path': buildTooltip(
        t('extend-the-path-from-the-selected-endpoint'),
        extendPathDisabled,
        extendPathDisabledReason
      ),
      've-btn-break-path': buildTooltip(
        t('break-open-a-closed-path-at-the-selected-node'),
        breakPathDisabled,
        breakPathDisabledReason
      ),
      've-btn-move-up': buildTooltip(t('move-path-one-layer-up'), moveUpDisabled, moveUpDisabledReason),
      've-btn-move-down': buildTooltip(t('move-path-one-layer-down'), moveDownDisabled, moveDownDisabledReason),
      've-btn-move-to-front': buildTooltip(t('move-path-to-the-front'), moveUpDisabled, moveUpDisabledReason),
      've-btn-move-to-back': buildTooltip(t('move-path-to-the-back'), moveDownDisabled, moveDownDisabledReason),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      t,
      finishDrawingDisabled,
      cancelDrawingDisabled,
      curveTypeDisabled,
      newSubpathDisabled,
      undoDisabled,
      redoDisabled,
      copyDisabled,
      cutDisabled,
      deleteDisabled,
      fillDisabled,
      strokeDisabled,
      filtersDisabled,
      adjustmentsDisabled,
      clipPathDisabled,
      holePathDisabled,
      traceImageDisabled,
      adjustmentMaskDisabled,
      extendPathDisabled,
      breakPathDisabled,
      moveUpDisabled,
      moveDownDisabled,
    ]
  )

  // Auto-open draw sidebar when flag is set (first draw mode activation per session / blank canvas)
  useEffect(() => {
    if (shouldAutoOpenDrawSidebar && editorMode === 'draw') {
      // Use requestAnimationFrame to ensure DOM is ready after state batch updates
      const frameId = requestAnimationFrame(() => {
        onToggleSidebarSection?.('draw')
        onDrawSidebarOpened?.()
      })
      return () => cancelAnimationFrame(frameId)
    }
  }, [shouldAutoOpenDrawSidebar, editorMode, onDrawSidebarOpened, onToggleSidebarSection])

  // Mobile layout: no Tooltips — hint text is shown via the mobile hint banner instead
  const mobileToolbar = (
    <InlineStack gap="200" wrap={false}>
      {/* Group 1: Mode toggle - Draw button opens draw sidebar, Edit button opens edit sidebar */}
      <ButtonGroup variant="segmented">
        <Button
          id="ve-btn-draw-mode"
          icon={PlusIcon}
          size="slim"
          pressed={editorMode === 'draw' || activeSidebarSection === 'draw'}
          onClick={() => {
            if (editorMode === 'edit') onModeChange('draw')
            onToggleSidebarSection?.('draw')
          }}
        >
          {t('draw')}
        </Button>
        <Button
          id="ve-btn-edit-mode"
          icon={EditIcon}
          size="slim"
          pressed={editorMode === 'edit' || activeSidebarSection === 'edit'}
          onClick={() => {
            if (editorMode === 'draw') onModeChange('edit')
            onToggleSidebarSection?.('edit')
          }}
        >
          {t('edit')}
        </Button>
      </ButtonGroup>

      {/* Draw Mode Actions - Draw mode only */}
      {editorMode === 'draw' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-finish-drawing"
            icon={CheckIcon}
            size="slim"
            onClick={onFinishDrawing}
            disabled={finishDrawingDisabled}
          >
            {t('finish')}
          </Button>
          <Button
            id="ve-btn-cancel-drawing"
            icon={XIcon}
            size="slim"
            onClick={onCancelDrawing}
            disabled={cancelDrawingDisabled}
          >
            {t('cancel')}
          </Button>
        </ButtonGroup>
      )}

      {/* Curve type selector - Draw mode only */}
      {editorMode === 'draw' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-straight-lines"
            icon={ToLineIcon}
            size="slim"
            pressed={drawingCurveType === 'line'}
            onClick={() => onDrawingCurveTypeChange?.('line')}
            disabled={curveTypeDisabled}
          >
            {t('line')}
          </Button>
          <Button
            id="ve-btn-quadratic-curves"
            icon={QuadraticCurveIcon}
            size="slim"
            pressed={drawingCurveType === 'quadratic'}
            onClick={() => onDrawingCurveTypeChange?.('quadratic')}
            disabled={curveTypeDisabled}
          >
            {t('quad')}
          </Button>
          <Button
            id="ve-btn-cubic-curves"
            icon={ToCurveIcon}
            size="slim"
            pressed={drawingCurveType === 'cubic'}
            onClick={() => onDrawingCurveTypeChange?.('cubic')}
            disabled={curveTypeDisabled}
          >
            {t('cubic')}
          </Button>
          <Button
            id="ve-btn-new-subpath"
            icon={NewSubpathIcon}
            size="slim"
            pressed={isStartingNewSubpath}
            onClick={onToggleNewSubpath}
            disabled={newSubpathDisabled}
          >
            {t('subpath')}
          </Button>
        </ButtonGroup>
      )}

      {/* History group */}
      <ButtonGroup variant="segmented">
        <Button id="ve-btn-undo" icon={UndoIcon} size="slim" onClick={withSidebarClose(onUndo)} disabled={undoDisabled}>
          {t('undo')}
        </Button>
        <Button id="ve-btn-redo" icon={RedoIcon} size="slim" onClick={withSidebarClose(onRedo)} disabled={redoDisabled}>
          {t('redo')}
        </Button>
      </ButtonGroup>

      {/* Mobile modifier toggles - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-selection-rect"
            icon={SelectionRectIcon}
            size="slim"
            pressed={mobileSelectionRectMode}
            onClick={withSidebarClose(onToggleMobileSelectionRectMode)}
          >
            {t('rect')}
          </Button>
          <Button
            id="ve-btn-multi-select"
            icon={MultiSelectIcon}
            size="slim"
            pressed={mobileMultiSelectMode}
            onClick={withSidebarClose(onToggleMobileMultiSelectMode)}
          >
            {t('multi')}
          </Button>
          <Button
            id="ve-btn-insert-node"
            icon={InsertNodeIcon}
            size="slim"
            pressed={mobileInsertNodeMode}
            onClick={onToggleMobileInsertNodeMode}
          >
            {t('insert')}
          </Button>
        </ButtonGroup>
      )}

      {/* Selection group - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Button id="ve-btn-select-all" icon={SelectAllIcon} size="slim" onClick={withSidebarClose(onSelectAllNodes)}>
            {t('all')}
          </Button>
          <Button
            id="ve-btn-invert-selection"
            icon={InvertSelectionIcon}
            size="slim"
            onClick={withSidebarClose(onInvertSelection)}
          >
            {t('invert')}
          </Button>
        </ButtonGroup>
      )}

      {/* Edit mode actions - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-copy"
            icon={CopyIcon}
            size="slim"
            onClick={withSidebarClose(onCopy)}
            disabled={copyDisabled}
          >
            {t('copy')}
          </Button>
          <Button
            id="ve-btn-cut"
            icon={ScissorsIcon}
            size="slim"
            onClick={withSidebarClose(onCut)}
            disabled={cutDisabled}
          >
            {t('cut')}
          </Button>
          <Button id="ve-btn-paste" icon={ClipboardIcon} size="slim" onClick={withSidebarClose(onPaste)}>
            {t('paste')}
          </Button>
          <Button
            id="ve-btn-delete"
            icon={DeleteIcon}
            size="slim"
            onClick={withSidebarClose(onDelete)}
            disabled={deleteDisabled}
            tone="critical"
          >
            {t('delete')}
          </Button>
        </ButtonGroup>
      )}

      {/* Style Controls (sidebar toggle buttons) */}
      <ButtonGroup variant="segmented">
        <Button
          id="ve-btn-fill"
          icon={FillIcon}
          size="slim"
          pressed={activeSidebarSection === 'fill'}
          onClick={() => onToggleSidebarSection?.('fill')}
          disabled={fillDisabled}
        >
          {t('fill')}
        </Button>
        <Button
          id="ve-btn-stroke"
          icon={StrokeIcon}
          size="slim"
          pressed={activeSidebarSection === 'stroke'}
          onClick={() => onToggleSidebarSection?.('stroke')}
          disabled={strokeDisabled}
        >
          {t('stroke')}
        </Button>
        <Button
          id="ve-btn-filters"
          icon={FiltersIcon}
          size="slim"
          pressed={activeSidebarSection === 'filters'}
          onClick={() => onToggleSidebarSection?.('filters')}
          disabled={filtersDisabled}
        >
          {t('filters')}
        </Button>
        <Button
          id="ve-btn-adjustments"
          icon={AdjustmentsIcon}
          size="slim"
          pressed={activeSidebarSection === 'adjustments'}
          onClick={() => onToggleSidebarSection?.('adjustments')}
          disabled={adjustmentsDisabled}
        >
          {t('adjustments')}
        </Button>
      </ButtonGroup>

      {/* Clip/Hole Path Controls */}
      <ButtonGroup variant="segmented">
        <Button
          id="ve-btn-clip-path"
          icon={ClipPathIcon}
          size="slim"
          onClick={onToggleClipPath}
          pressed={isSelectedPathClip}
          disabled={clipPathDisabled}
        >
          {t('clip')}
        </Button>
        <Button
          id="ve-btn-hole-path"
          icon={HolePathIcon}
          size="slim"
          onClick={onToggleHolePath}
          pressed={isSelectedPathHole}
          disabled={holePathDisabled}
        >
          {t('hole')}
        </Button>
      </ButtonGroup>

      {/* Raster-only buttons - only shown in overlay mode */}
      {isOverlayMode && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-trace-image"
            icon={TraceIcon}
            size="slim"
            onClick={onTraceImage}
            loading={isTracing}
            disabled={traceImageDisabled}
          >
            {t('trace')}
          </Button>
          <Button
            id="ve-btn-adjustment-mask"
            icon={AdjustmentMaskIcon}
            size="slim"
            onClick={onToggleAdjustmentMask}
            pressed={isSelectedPathAdjustmentMask}
            disabled={adjustmentMaskDisabled}
          >
            {t('mask')}
          </Button>
        </ButtonGroup>
      )}

      {/* Extend/Break path buttons - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-extend-path"
            icon={ExtendPathIcon}
            size="slim"
            pressed={isExtendMode}
            onClick={withSidebarClose(onToggleExtendMode)}
            disabled={extendPathDisabled}
          >
            {t('extend')}
          </Button>
          <Button
            id="ve-btn-break-path"
            icon={BreakPathIcon}
            size="slim"
            onClick={withSidebarClose(onBreakOpenPath)}
            disabled={breakPathDisabled}
          >
            {t('break')}
          </Button>
        </ButtonGroup>
      )}

      {/* Layer ordering buttons - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Button
            id="ve-btn-move-up"
            icon={MoveUpIcon}
            size="slim"
            onClick={withSidebarClose(onMoveUp)}
            disabled={moveUpDisabled}
          >
            {t('up')}
          </Button>
          <Button
            id="ve-btn-move-down"
            icon={MoveDownIcon}
            size="slim"
            onClick={withSidebarClose(onMoveDown)}
            disabled={moveDownDisabled}
          >
            {t('down')}
          </Button>
          <Button
            id="ve-btn-move-to-front"
            icon={MoveToFrontIcon}
            size="slim"
            onClick={withSidebarClose(onMoveToFront)}
            disabled={moveUpDisabled}
          >
            {t('front')}
          </Button>
          <Button
            id="ve-btn-move-to-back"
            icon={MoveToBackIcon}
            size="slim"
            onClick={withSidebarClose(onMoveToBack)}
            disabled={moveDownDisabled}
          >
            {t('back')}
          </Button>
        </ButtonGroup>
      )}
    </InlineStack>
  )

  // Desktop layout: multiple ButtonGroups with gaps
  const desktopToolbar = (
    <InlineStack align="start" gap="300">
      {/* Mode toggle - Draw button opens draw sidebar, Edit button opens edit sidebar */}
      <ButtonGroup variant="segmented">
        <Tooltip content={`${t('draw-mode')} (P / ${formatShortcut('A', 'alt')})`} dismissOnMouseOut>
          <Button
            id="ve-btn-draw-mode"
            icon={PlusIcon}
            pressed={editorMode === 'draw' || activeSidebarSection === 'draw'}
            onClick={() => {
              if (editorMode === 'edit') {
                onModeChange('draw')
              }
              onToggleSidebarSection?.('draw')
            }}
          >
            {t('draw')}
          </Button>
        </Tooltip>
        <Tooltip content={`${t('edit-mode')} (V / ${formatShortcut('E', 'alt')})`} dismissOnMouseOut>
          <Button
            id="ve-btn-edit-mode"
            icon={EditIcon}
            pressed={editorMode === 'edit' || activeSidebarSection === 'edit'}
            onClick={() => {
              if (editorMode === 'draw') {
                onModeChange('edit')
              }
              onToggleSidebarSection?.('edit')
            }}
          >
            {t('edit')}
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Draw mode buttons - Draw mode only */}
      {editorMode === 'draw' && (
        <ButtonGroup variant="segmented">
          <Tooltip
            content={buildTooltip(`${t('finish-drawing')} (Enter)`, finishDrawingDisabled, finishDrawingDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-finish-drawing"
              icon={CheckIcon}
              onClick={onFinishDrawing}
              disabled={finishDrawingDisabled}
            >
              {t('finish')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(`${t('cancel-drawing')} (Esc)`, cancelDrawingDisabled, cancelDrawingDisabledReason)}
            dismissOnMouseOut
          >
            <Button id="ve-btn-cancel-drawing" icon={XIcon} onClick={onCancelDrawing} disabled={cancelDrawingDisabled}>
              {t('cancel')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* Curve type selector (Feature 1) - Draw mode only */}
      {editorMode === 'draw' && (
        <ButtonGroup variant="segmented">
          <Tooltip
            content={buildTooltip(t('draw-straight-lines'), curveTypeDisabled, curveTypeDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-straight-lines"
              icon={ToLineIcon}
              pressed={drawingCurveType === 'line'}
              onClick={() => onDrawingCurveTypeChange?.('line')}
              disabled={curveTypeDisabled}
            >
              {t('line')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(t('draw-quadratic-curves'), curveTypeDisabled, curveTypeDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-quadratic-curves"
              icon={QuadraticCurveIcon}
              pressed={drawingCurveType === 'quadratic'}
              onClick={() => onDrawingCurveTypeChange?.('quadratic')}
              disabled={curveTypeDisabled}
            >
              {t('quad')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(t('draw-cubic-curves'), curveTypeDisabled, curveTypeDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-cubic-curves"
              icon={ToCurveIcon}
              pressed={drawingCurveType === 'cubic'}
              onClick={() => onDrawingCurveTypeChange?.('cubic')}
              disabled={curveTypeDisabled}
            >
              {t('cubic')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(
              `${t('new-subpath')} (${formatShortcut('M', 'alt')})`,
              newSubpathDisabled,
              newSubpathDisabledReason
            )}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-new-subpath"
              icon={NewSubpathIcon}
              pressed={isStartingNewSubpath}
              onClick={onToggleNewSubpath}
              disabled={newSubpathDisabled}
            >
              {t('subpath')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* History group */}
      <ButtonGroup variant="segmented">
        <Tooltip
          content={buildTooltip(`${t('undo')} (${formatShortcut('Z', 'ctrl')})`, undoDisabled, undoDisabledReason)}
          dismissOnMouseOut
        >
          <Button id="ve-btn-undo" icon={UndoIcon} onClick={withSidebarClose(onUndo)} disabled={undoDisabled}>
            {t('undo')}
          </Button>
        </Tooltip>
        <Tooltip
          content={buildTooltip(
            `${t('redo')} (${formatShortcutMulti('Z', ['ctrl', 'shift'])})`,
            redoDisabled,
            redoDisabledReason
          )}
          dismissOnMouseOut
        >
          <Button id="ve-btn-redo" icon={RedoIcon} onClick={withSidebarClose(onRedo)} disabled={redoDisabled}>
            {t('redo')}
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Select All (Feature 2) - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Tooltip content={`${t('select-all')} (${formatShortcut('A', 'ctrl')})`} dismissOnMouseOut>
            <Button id="ve-btn-select-all" icon={SelectAllIcon} onClick={withSidebarClose(onSelectAllNodes)}>
              {t('all')}
            </Button>
          </Tooltip>
          <Tooltip content={`${t('invert-selection')} (Shift+I)`} dismissOnMouseOut>
            <Button
              id="ve-btn-invert-selection"
              icon={InvertSelectionIcon}
              onClick={withSidebarClose(onInvertSelection)}
            >
              {t('invert')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* Edit mode buttons - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Tooltip
            content={buildTooltip(`${t('copy')} (${formatShortcut('C', 'ctrl')})`, copyDisabled, copyDisabledReason)}
            dismissOnMouseOut
          >
            <Button id="ve-btn-copy" icon={CopyIcon} onClick={withSidebarClose(onCopy)} disabled={copyDisabled}>
              {t('copy')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(`${t('cut')} (${formatShortcut('X', 'ctrl')})`, cutDisabled, cutDisabledReason)}
            dismissOnMouseOut
          >
            <Button id="ve-btn-cut" icon={ScissorsIcon} onClick={withSidebarClose(onCut)} disabled={cutDisabled}>
              {t('cut')}
            </Button>
          </Tooltip>
          <Tooltip content={`${t('paste')} (${formatShortcut('V', 'ctrl')})`} dismissOnMouseOut>
            <Button id="ve-btn-paste" icon={ClipboardIcon} onClick={withSidebarClose(onPaste)}>
              {t('paste')}
            </Button>
          </Tooltip>
          <Tooltip content={buildTooltip(t('delete'), deleteDisabled, deleteDisabledReason)} dismissOnMouseOut>
            <Button
              id="ve-btn-delete"
              icon={DeleteIcon}
              onClick={withSidebarClose(onDelete)}
              disabled={deleteDisabled}
              tone="critical"
            >
              {t('delete')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* Style controls (sidebar toggle buttons) */}
      {/* Gradient/Filter/Adjustments disabled in subpath mode (partial node selection) */}
      <ButtonGroup variant="segmented">
        <Tooltip content={buildTooltip(t('fill'), fillDisabled, fillDisabledReason)} dismissOnMouseOut>
          <Button
            id="ve-btn-fill"
            icon={FillIcon}
            pressed={activeSidebarSection === 'fill'}
            onClick={() => onToggleSidebarSection?.('fill')}
            disabled={fillDisabled}
          >
            {t('fill')}
          </Button>
        </Tooltip>
        <Tooltip content={buildTooltip(t('stroke'), strokeDisabled, strokeDisabledReason)} dismissOnMouseOut>
          <Button
            id="ve-btn-stroke"
            icon={StrokeIcon}
            pressed={activeSidebarSection === 'stroke'}
            onClick={() => onToggleSidebarSection?.('stroke')}
            disabled={strokeDisabled}
          >
            {t('stroke')}
          </Button>
        </Tooltip>
        <Tooltip content={buildTooltip(t('filters'), filtersDisabled, filtersDisabledReason)} dismissOnMouseOut>
          <Button
            id="ve-btn-filters"
            icon={FiltersIcon}
            pressed={activeSidebarSection === 'filters'}
            onClick={() => onToggleSidebarSection?.('filters')}
            disabled={filtersDisabled}
          >
            {t('filters')}
          </Button>
        </Tooltip>
        <Tooltip
          content={buildTooltip(t('adjustments'), adjustmentsDisabled, adjustmentsDisabledReason)}
          dismissOnMouseOut
        >
          <Button
            id="ve-btn-adjustments"
            icon={AdjustmentsIcon}
            pressed={activeSidebarSection === 'adjustments'}
            onClick={() => onToggleSidebarSection?.('adjustments')}
            disabled={adjustmentsDisabled}
          >
            {t('adjustments')}
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Guide image tool - opens sidebar for reference background image */}
      {onToggleSidebarSection && (
        <Tooltip content={t('guide-image')} dismissOnMouseOut>
          <Button
            id="ve-btn-guide-image"
            icon={GuideImageIcon}
            pressed={activeSidebarSection === 'guide-image'}
            onClick={() => onToggleSidebarSection?.('guide-image')}
          >
            {t('guide')}
          </Button>
        </Tooltip>
      )}

      {/* Clip/Hole Path Controls - work in both SVG-only and raster modes */}
      <ButtonGroup variant="segmented">
        <Tooltip
          content={buildTooltip(
            isSelectedPathClip ? t('remove-clip-mask') : t('use-as-clip-mask'),
            clipPathDisabled,
            clipPathDisabledReason
          )}
          dismissOnMouseOut
        >
          <Button
            id="ve-btn-clip-path"
            icon={ClipPathIcon}
            onClick={onToggleClipPath}
            pressed={isSelectedPathClip}
            disabled={clipPathDisabled}
          >
            {t('clip')}
          </Button>
        </Tooltip>
        <Tooltip
          content={buildTooltip(
            isSelectedPathHole ? t('remove-hole') : t('use-as-hole-cutout'),
            holePathDisabled,
            holePathDisabledReason
          )}
          dismissOnMouseOut
        >
          <Button
            id="ve-btn-hole-path"
            icon={HolePathIcon}
            onClick={onToggleHolePath}
            pressed={isSelectedPathHole}
            disabled={holePathDisabled}
          >
            {t('hole')}
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Raster-only buttons - only shown in overlay mode */}
      {isOverlayMode && (
        <ButtonGroup variant="segmented">
          {/* Image Tracing (Overlay Mode) */}
          <Tooltip
            content={buildTooltip(t('trace-image-to-vector-paths'), traceImageDisabled, traceImageDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-trace-image"
              icon={TraceIcon}
              onClick={onTraceImage}
              loading={isTracing}
              disabled={traceImageDisabled}
            >
              {t('trace')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(
              isSelectedPathAdjustmentMask ? t('remove-adjustment-mask') : t('use-as-adjustment-mask'),
              adjustmentMaskDisabled,
              adjustmentMaskDisabledReason
            )}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-adjustment-mask"
              icon={AdjustmentMaskIcon}
              onClick={onToggleAdjustmentMask}
              pressed={isSelectedPathAdjustmentMask}
              disabled={adjustmentMaskDisabled}
            >
              {t('mask')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* Extend/Break path buttons (Feature 3) - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Tooltip
            content={buildTooltip(t('extend-path-from-selected-node'), extendPathDisabled, extendPathDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-extend-path"
              icon={ExtendPathIcon}
              pressed={isExtendMode}
              onClick={withSidebarClose(onToggleExtendMode)}
              disabled={extendPathDisabled}
            >
              {t('extend')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(t('break-open-closed-path'), breakPathDisabled, breakPathDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-break-path"
              icon={BreakPathIcon}
              onClick={withSidebarClose(onBreakOpenPath)}
              disabled={breakPathDisabled}
            >
              {t('break')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}

      {/* Layer ordering buttons - Edit mode only */}
      {editorMode === 'edit' && (
        <ButtonGroup variant="segmented">
          <Tooltip content={buildTooltip(t('move-layer-up'), moveUpDisabled, moveUpDisabledReason)} dismissOnMouseOut>
            <Button
              id="ve-btn-move-up"
              icon={MoveUpIcon}
              onClick={withSidebarClose(onMoveUp)}
              disabled={moveUpDisabled}
            >
              {t('up')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(t('move-layer-down'), moveDownDisabled, moveDownDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-move-down"
              icon={MoveDownIcon}
              onClick={withSidebarClose(onMoveDown)}
              disabled={moveDownDisabled}
            >
              {t('down')}
            </Button>
          </Tooltip>
          <Tooltip content={buildTooltip(t('move-to-front'), moveUpDisabled, moveUpDisabledReason)} dismissOnMouseOut>
            <Button
              id="ve-btn-move-to-front"
              icon={MoveToFrontIcon}
              onClick={withSidebarClose(onMoveToFront)}
              disabled={moveUpDisabled}
            >
              {t('front')}
            </Button>
          </Tooltip>
          <Tooltip
            content={buildTooltip(t('move-to-back'), moveDownDisabled, moveDownDisabledReason)}
            dismissOnMouseOut
          >
            <Button
              id="ve-btn-move-to-back"
              icon={MoveToBackIcon}
              onClick={withSidebarClose(onMoveToBack)}
              disabled={moveDownDisabled}
            >
              {t('back')}
            </Button>
          </Tooltip>
        </ButtonGroup>
      )}
    </InlineStack>
  )

  // Determine toolbar class based on ruler visibility
  const showRuler = editModeSettings?.showRuler ?? false
  const toolbarClassName = showRuler ? `${styles.toolbar} ${styles.toolbarWithRuler}` : styles.toolbar

  const handleMobileToolbarClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isMobileView) return
      const btn = (e.target as HTMLElement).closest('[id^="ve-btn-"]')
      if (btn) {
        const hint = mobileHintMap[btn.id]
        if (hint) showMobileHint(hint)
      }
    },
    [isMobileView, mobileHintMap, showMobileHint]
  )

  return (
    <div className={toolbarClassName} onClickCapture={isMobileView ? handleMobileToolbarClick : undefined}>
      {isMobileView ? mobileToolbar : desktopToolbar}
    </div>
  )
}
