/* eslint-disable max-lines */
/**
 * VectorEditor - Main component for editing SVG vector graphics
 */

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useMemo } from 'react'
import { Modal, Button, Spinner, Banner, Tooltip, useBreakpoints } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import {
  parseSvgString,
  rebuildSvgStringExtended,
  encodeSvgToDataUri,
  decodeSvgDataUri,
  insertNodeIntoPath,
  createEmptyDefs,
  createSolidPaint,
  createNonePaint,
  generateDefId,
  stringToPaint,
  findConnectedSegment,
  calculatePathCenter,
  buildOverlaySvgOutput,
  calculateEffectGroups,
  getCleanedDefs,
} from './utils/svg'
import { computeEffectiveSubpathStyle, convertToSubpathOverride } from './utils/subpathStyles'
import { bakeRotationIntoCommands, scalePathCommands } from './utils/pathTransforms'
import type { ParsedSvg, ParsedPath, PathCommand, Point, ParsedSvgExtended, SvgDefs } from './utils/svg'
import type {
  VectorEditorOverlayProps,
  VectorEditorRef,
  EditorMode,
  ParsedPathExtended,
  GradientDef,
  FilterDef,
  ColorAdjustments,
  BlendMode,
  ConnectedSegment,
  PathStyleWithSubpaths,
  EditorCanvasRef,
  VectorEditorClipboardData,
  SidebarSection,
  ImageColorAdjustments,
  ViewBox,
} from './types'
import {
  useEditorHistory,
  useKeyboardShortcuts,
  useSvgLoader,
  useEffectsManager,
  useImageTracing,
  useEditModeSettings,
  useGridSettings,
  useGuidelines,
} from './hooks'
import { useRasterImage } from './hooks/useRasterImage'
import { useOverlayState } from './hooks/useOverlayState'
import {
  updateCommandPosition,
  updateControlPointPosition,
  updateMultipleNodePositions,
  updatePathPosition,
} from './utils/immutableUpdates'
import { getShapeById, isUnifiedGridShape, type AnyShapeDefinition } from './constants/shapes'
import type { CompositePathResult, UnifiedGridResult } from './utils/shapes/compositeTypes'
import EditorToolbar from './components/EditorToolbar'
import EditorCanvas from './components/EditorCanvas'
import EditorSidebar from './components/EditorSidebar'
import HintBanner from '~/components/common/HintBanner'
import useDevices from '~/utils/hooks/useDevice'
import { useVectorPathDrawing } from '~/hooks/useVectorPathDrawing'
import styles from './styles.module.css'

const VectorEditor = forwardRef<VectorEditorRef, VectorEditorOverlayProps>(function VectorEditor(
  {
    svgDataUri,
    svgUrl,
    isModal = true,
    modalOpen = true,
    modalTitle = 'Edit Vector',
    showFooter = true,
    showToolbar = true,
    initialMode = 'edit',
    initialDefs,
    onDefsChange,
    // Upload options
    uploadToShopify = false,
    onModalClose,
    onSave,
    onModeChange,
    // Overlay mode props (raster image background)
    rasterImageUrl,
    overlayMode: forceOverlayMode,
    initialOverlayState,
    onOverlayStateChange,
    onOverlaySave,
    // Blank canvas props
    allowBlankCanvas = false,
    initialDimensions,
    // Preview image from TemplateEditor (non-editable environmental background)
    previewImageConfig,
    // Additional secondary actions to prepend inside the modal header
    secondaryActions,
    // Centered canvas overlay (e.g. empty state CTA)
    canvasOverlay,
    // Floating action buttons at bottom-left of canvas area
    canvasActions,
    // Guide image sidebar tool
    guideImageProps,
  },
  ref
) {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const { mdDown } = useBreakpoints()
  const { trackEvent } = useEventsTracking()
  const wasSavedRef = useRef(false)
  const savedVectorUrlRef = useRef<string | null>(null)
  const startedTrackedRef = useRef(false)

  // Determine the original image URL for tracking (prioritize svgUrl, then svgDataUri, then rasterImageUrl)
  const originalImageUrl = svgUrl || svgDataUri || rasterImageUrl

  // Determine if we're in overlay mode (raster image background)
  const isOverlayMode = forceOverlayMode || !!rasterImageUrl

  // Determine blank canvas mode (no sources provided but allowBlankCanvas is true)
  const shouldCreateBlankCanvas = useMemo(() => {
    return allowBlankCanvas && !svgDataUri && !svgUrl && !rasterImageUrl
  }, [allowBlankCanvas, svgDataUri, svgUrl, rasterImageUrl])

  // Load raster image for overlay mode
  const {
    imageInfo,
    isLoading: imageLoading,
    error: imageError,
  } = useRasterImage({
    imageUrl: rasterImageUrl,
    enabled: !!rasterImageUrl,
  })

  // Overlay state management (clip paths, holes, color adjustments)
  const overlayStateManager = useOverlayState({
    initialState: initialOverlayState,
    onStateChange: onOverlayStateChange,
  })

  // Image tracing hook (for converting raster to vector paths)
  const { isTracing, trace: traceImage } = useImageTracing()

  // Edit mode settings hooks (for grid, ruler, viewport resize)
  const { settings: editModeSettings, updateSettings: updateEditModeSettings } = useEditModeSettings()
  const { gridSettings, updateGridSettings } = useGridSettings()
  const { guidelines, addGuideline, updateGuideline, removeGuideline } = useGuidelines()

  // Load SVG from data URI or URL (with gradient/filter/mask/clipPath extraction)
  // Disable SVG loading in overlay mode when no SVG source is provided, or in blank canvas mode
  const {
    svgString,
    defs: loadedDefs,
    clipPathIndices: loadedClipPathIndices,
    holePathIndices: loadedHolePathIndices,
    isLoading,
    error: loadError,
  } = useSvgLoader({
    svgDataUri,
    svgUrl,
    parseEffects: true,
    enabled: !shouldCreateBlankCanvas && (!isOverlayMode || !!svgDataUri || !!svgUrl),
  })

  // Parsed SVG state
  const [parsedSvg, setParsedSvg] = useState<ParsedSvg | null>(null)

  // Selection state - consolidated to Set-based only
  // Primary selection can be derived: selectedPathIndices.size > 0 ? [...selectedPathIndices][0] : null
  const [selectedPathIndices, setSelectedPathIndices] = useState<Set<number>>(new Set())
  const [selectedNodeIndices, setSelectedNodeIndices] = useState<Set<number>>(new Set())

  // Derived primary selection values (first element from Sets for single-selection logic)
  const selectedPathIndex = selectedPathIndices.size > 0 ? [...selectedPathIndices][0] : null
  const selectedNodeIndex = selectedNodeIndices.size > 0 ? [...selectedNodeIndices][0] : null

  // History management
  const { canUndo, canRedo, pushToHistory, undo, redo, resetHistory } = useEditorHistory()

  // Draw mode state
  const [editorMode, setEditorMode] = useState<EditorMode>(initialMode)
  const drawing = useVectorPathDrawing({ curveType: 'quadratic' })
  const [isStartingNewSubpath, setIsStartingNewSubpath] = useState(false)

  // Mobile modifier toggles (simulate Alt/Shift keys on mobile)
  const [mobileInsertNodeMode, setMobileInsertNodeMode] = useState(false)
  const [mobileMultiSelectMode, setMobileMultiSelectMode] = useState(false)
  const [mobileSelectionRectMode, setMobileSelectionRectMode] = useState(false)

  // Extend mode state (Feature 3)
  const [isExtendMode, setIsExtendMode] = useState(false)
  const [extendFromNode, setExtendFromNode] = useState<{ pathIndex: number; nodeIndex: number } | null>(null)

  // Predefined shape state
  const [selectedPredefinedShape, setSelectedPredefinedShape] = useState<string | null>(null)
  const [shapeDragStart, setShapeDragStart] = useState<Point | null>(null)
  const [shapeDragCurrent, setShapeDragCurrent] = useState<Point | null>(null)

  // Auto-open draw sidebar on first draw mode activation per session (blank canvas)
  const [shouldAutoOpenDrawSidebar, setShouldAutoOpenDrawSidebar] = useState(false)
  const hasShownDrawSidebarRef = useRef(false)

  // Dynamic mobile canvas height — measured from visualViewport to handle virtual keyboard
  const [mobileCanvasHeight, setMobileCanvasHeight] = useState<number | null>(null)
  useEffect(() => {
    if (!isMobileView) return
    const MODAL_OVERHEAD = 168 // Polaris Modal header + footer + padding on mobile
    const measure = () => {
      const viewportH = window.visualViewport?.height ?? window.innerHeight
      setMobileCanvasHeight(viewportH - MODAL_OVERHEAD)
    }
    measure()
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', measure)
    } else {
      window.addEventListener('resize', measure)
    }
    return () => {
      if (vv) vv.removeEventListener('resize', measure)
      else window.removeEventListener('resize', measure)
    }
  }, [isMobileView])

  // Internal guide image state — used when no external guideImageProps are provided.
  // Lets the Guide Image sidebar panel work in standalone VectorEditor instances (e.g. "Draw shape").
  const [internalGuideImageUrl, setInternalGuideImageUrl] = useState<string | undefined>()
  const internalImageBrowserRef = useRef<HTMLInputElement>(null)
  const internalImageBrowser = useMemo(
    () => (
      <>
        <input
          ref={internalImageBrowserRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => setInternalGuideImageUrl(ev.target?.result as string)
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
        <Button fullWidth onClick={() => internalImageBrowserRef.current?.click()}>
          {t('upload-reference-image')}
        </Button>
      </>
    ),
    [t]
  )
  const effectiveGuideImageProps = guideImageProps ?? {
    imageUrl: internalGuideImageUrl,
    onCaptureCanvas: () => {},
    onRemoveImage: () => setInternalGuideImageUrl(undefined),
    imageBrowser: internalImageBrowser,
  }

  // Upload state
  const [isUploading, setIsUploading] = useState(false)

  // Sidebar state (collapsible sidebar for style controls)
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSection>(null)

  // Mobile toolbar hint — lifted out of EditorToolbar so it doesn't scroll with the toolbar
  const [mobileHint, setMobileHint] = useState<string | null>(null)

  // Track popover open state from EditorToolbar
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  // Signal to close popover (toggled to trigger close)
  const [closePopoverSignal, setClosePopoverSignal] = useState(false)

  // Combined flag for blocking canvas click actions (popover or sidebar visible)
  const isPopoverOrSidebarOpen = isPopoverOpen || activeSidebarSection !== null

  // Reset node selection when selected path changes
  // This ensures node selection doesn't carry over when switching between paths
  const prevSelectedPathIndicesRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const prevIndices = prevSelectedPathIndicesRef.current
    const currentIndices = selectedPathIndices

    // Check if the selected path actually changed (not just the same path)
    const pathChanged
      = prevIndices.size !== currentIndices.size || ![...prevIndices].every(idx => currentIndices.has(idx))

    if (pathChanged) {
      setSelectedNodeIndices(new Set())
    }

    prevSelectedPathIndicesRef.current = new Set(currentIndices)
  }, [selectedPathIndices])

  const editorCanvasRef = useRef<EditorCanvasRef>(null)

  // Store original positions for multi-node/path moves (supports number keys for nodes, string keys for control points)
  const originalPositionsRef = useRef<Map<number | string, { x: number; y: number }>>(new Map())

  // Store initial state for resetting on cancel (to discard unsaved changes)
  const initialParsedSvgRef = useRef<ParsedSvg | null>(null)
  const initialPathStylesRef = useRef<Map<number, PathStyleWithSubpaths>>(new Map())
  const initialDefsRef = useRef<SvgDefs | null>(null)

  // Effects management hook - use loaded defs from SVG, or props initialDefs, or empty
  const effectsManager = useEffectsManager({
    initialDefs: loadedDefs || initialDefs || createEmptyDefs(),
    onDefsChange,
  })

  // Extended path styles (convert ParsedPath to ParsedPathExtended for inspector)
  // Using PathStyleWithSubpaths to support per-subpath styling
  const [pathStyles, setPathStyles] = useState<Map<number, PathStyleWithSubpaths>>(new Map())

  // Get extended path for selected index
  const selectedPathExtended = useMemo((): ParsedPathExtended | null => {
    if (selectedPathIndex === null || !parsedSvg) return null

    const path = parsedSvg.paths[selectedPathIndex]
    // Guard against out-of-bounds index or undefined path
    if (!path) return null

    const existingStyle = pathStyles.get(selectedPathIndex)

    return {
      ...path,
      style: existingStyle || {
        fill: stringToPaint(path.fill || 'none'),
        fillRule: path.fillRule,
        stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
        strokeWidth: path.strokeWidth,
        opacity: 1,
        mixBlendMode: 'normal',
      },
    }
  }, [selectedPathIndex, parsedSvg, pathStyles])

  // Check if selected path has non-default adjustments (for disabling filters)
  const selectedPathHasAdjustments = useMemo((): boolean => {
    if (!selectedPathExtended?.style) return false

    const style = selectedPathExtended.style

    // Check if color adjustments have non-default values
    const colorAdj = style.colorAdjustments
    if (colorAdj) {
      const hasColorAdjustment
        = (colorAdj.brightness && colorAdj.brightness !== 0)
        || (colorAdj.contrast && colorAdj.contrast !== 0)
        || (colorAdj.saturation && colorAdj.saturation !== 0)
        || (colorAdj.hueRotate && colorAdj.hueRotate !== 0)
        || (colorAdj.invert && colorAdj.invert !== 0)
        || (colorAdj.sepia && colorAdj.sepia !== 0)
        || (colorAdj.grayscale && colorAdj.grayscale !== 0)
      if (hasColorAdjustment) return true
    }

    // Check if opacity is not default (1)
    if (style.opacity !== undefined && style.opacity !== 1) return true

    // Check if blend mode is not default ('normal')
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') return true

    return false
  }, [selectedPathExtended])

  // Compute workspace dimensions for PreviewBackgroundLayer
  // Use initialDimensions if provided (blank canvas mode), otherwise use parsedSvg.viewBox
  const workspaceDimensions = useMemo((): { width: number; height: number } | undefined => {
    if (initialDimensions) {
      return initialDimensions
    }
    if (parsedSvg?.viewBox) {
      return { width: parsedSvg.viewBox.width, height: parsedSvg.viewBox.height }
    }
    return undefined
  }, [initialDimensions, parsedSvg?.viewBox])

  // Determine active segment based on selected nodes (for subpath styling)
  const activeSegment = useMemo((): ConnectedSegment | null => {
    if (selectedPathIndex === null || !parsedSvg) return null
    if (selectedNodeIndices.size === 0 && selectedNodeIndex === null) return null

    const path = parsedSvg.paths[selectedPathIndex]
    if (!path) return null

    const nodeIndex = selectedNodeIndex ?? Array.from(selectedNodeIndices)[0]
    if (nodeIndex === undefined) return null

    return findConnectedSegment(path.commands, nodeIndex)
  }, [selectedPathIndex, parsedSvg, selectedNodeIndex, selectedNodeIndices])

  // Check if all path nodes are selected (for enabling full styling)
  const allNodesSelected = useMemo((): boolean => {
    if (selectedPathIndex === null || !parsedSvg) return false
    if (selectedNodeIndices.size === 0 && selectedNodeIndex === null) return false

    const path = parsedSvg.paths[selectedPathIndex]
    if (!path) return false

    // Count non-Z commands (actual nodes)
    const nodeCount = path.commands.filter(cmd => cmd.type.toUpperCase() !== 'Z').length

    // All selected if selectedNodeIndices contains all nodes
    return selectedNodeIndices.size >= nodeCount
  }, [selectedPathIndex, parsedSvg, selectedNodeIndex, selectedNodeIndices])

  // Whether we're in subpath styling mode (some but not all nodes selected)
  const isSubpathStylingMode = activeSegment !== null && !allNodesSelected

  // Get style to display in toolbar (subpath or path level)
  const displayStyle = useMemo((): PathStyleWithSubpaths | null => {
    if (selectedPathIndex === null || !parsedSvg) return null

    const path = parsedSvg.paths[selectedPathIndex]
    if (!path) return null

    const pathStyle = pathStyles.get(selectedPathIndex) || {
      fill: stringToPaint(path.fill || 'none'),
      fillRule: path.fillRule,
      stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
      strokeWidth: path.strokeWidth,
      opacity: 1,
      mixBlendMode: 'normal' as BlendMode,
    }

    if (!activeSegment) return pathStyle // No nodes selected - show path style

    // Nodes selected - compute effective style for this subpath
    const override = pathStyle.subpathStyles?.get(activeSegment.startIndex)
    if (!override) return pathStyle // No override - show inherited

    return computeEffectiveSubpathStyle(pathStyle, override) as PathStyleWithSubpaths
  }, [selectedPathIndex, parsedSvg, pathStyles, activeSegment])

  // Initialize blank canvas when allowBlankCanvas is true and no sources are provided
  useEffect(() => {
    if (!shouldCreateBlankCanvas || parsedSvg) return

    const { width, height } = initialDimensions ?? { width: 1024, height: 1024 }

    const blankSvg: ParsedSvg = {
      paths: [],
      viewBox: { x: 0, y: 0, width, height },
      width,
      height,
    }

    setParsedSvg(blankSvg)
    setSelectedPathIndices(new Set())
    setSelectedNodeIndices(new Set())
    setPathStyles(new Map())

    // Store initial state for resetting on cancel
    initialParsedSvgRef.current = JSON.parse(JSON.stringify(blankSvg))
    initialPathStylesRef.current = new Map()
    initialDefsRef.current = effectsManager.defs

    resetHistory([], overlayStateManager.overlayState, new Map(), effectsManager.defs)
    // Switch to draw mode for blank canvas (user likely wants to start drawing)
    setEditorMode('draw')
    // Trigger auto-open draw sidebar on blank canvas initialization
    if (!hasShownDrawSidebarRef.current) {
      setShouldAutoOpenDrawSidebar(true)
    }
  }, [
    shouldCreateBlankCanvas,
    initialDimensions,
    parsedSvg,
    resetHistory,
    overlayStateManager.overlayState,
    effectsManager.defs,
  ])

  // Parse SVG when loaded
  useEffect(() => {
    if (!svgString) return

    try {
      const parsed = parseSvgString(svgString)
      setParsedSvg(parsed)
      setSelectedPathIndices(new Set())
      setSelectedNodeIndices(new Set())

      // Initialize pathStyles from parsed paths' style attributes
      const initialPathStyles = new Map<number, ParsedPathExtended['style']>()
      parsed.paths.forEach((path, idx) => {
        // Create style entry if path has effects, opacity, or blend mode
        const hasEffects = path.filterId || path.maskId || path.clipPathId || path.colorAdjustments
        const hasOpacity
          = path.opacity !== undefined || path.fillOpacity !== undefined || path.strokeOpacity !== undefined
        const hasBlendMode = path.mixBlendMode && path.mixBlendMode !== 'normal'

        if (hasEffects || hasOpacity || hasBlendMode) {
          initialPathStyles.set(idx, {
            fill: stringToPaint(path.fill || 'none'),
            fillRule: path.fillRule,
            stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
            strokeWidth: path.strokeWidth,
            opacity: path.opacity ?? 1,
            mixBlendMode: (path.mixBlendMode as BlendMode) || 'normal',
            filterId: path.filterId,
            maskId: path.maskId,
            clipPathId: path.clipPathId,
            colorAdjustments: path.colorAdjustments,
          })
        }
      })
      setPathStyles(initialPathStyles)

      // Sync loaded defs (gradients, filters, masks, clipPaths) to effectsManager
      const initialDefs = loadedDefs || effectsManager.defs
      if (loadedDefs) {
        effectsManager.setDefs(loadedDefs)
      }

      // Restore clip/hole path indices from SVG data attributes (for round-trip preservation)
      // This allows clip/hole state to persist even in SVG-only mode (not just overlay mode)
      if (loadedClipPathIndices.length > 0 || loadedHolePathIndices.length > 0) {
        overlayStateManager.restoreState({
          ...overlayStateManager.overlayState,
          clipPathIndices: loadedClipPathIndices,
          holePathIndices: loadedHolePathIndices,
        })
      }

      // Store initial state for resetting on cancel (deep clone to avoid mutations)
      initialParsedSvgRef.current = JSON.parse(JSON.stringify(parsed))
      initialPathStylesRef.current = new Map(initialPathStyles)
      initialDefsRef.current = initialDefs

      // Initialize history with all state after parsing
      resetHistory(parsed.paths, overlayStateManager.overlayState, initialPathStyles, initialDefs)

      // Track STARTED event after successful parse (only once per session)
      if (!startedTrackedRef.current) {
        startedTrackedRef.current = true
        trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_STARTED, {
          is_modal: isModal,
          [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
        })
      }
    } catch (err) {
      console.error('Failed to parse SVG:', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgString, resetHistory, loadedDefs, loadedClipPathIndices, loadedHolePathIndices])

  // Initialize empty SVG in overlay mode when image loads (and no SVG provided)
  useEffect(() => {
    if (!isOverlayMode || !imageInfo) return
    // Only initialize if no SVG was provided
    if (svgDataUri || svgUrl) return
    // Only initialize if parsedSvg is not already set
    if (parsedSvg) return

    // Create empty SVG. When initialDimensions are provided (e.g. template pixel size for movement
    // zone drawing), use those as the viewBox so user-drawn paths are in the correct coordinate
    // space even when the guide image was captured at a downscaled resolution for performance.
    const svgWidth = initialDimensions?.width ?? imageInfo.naturalWidth
    const svgHeight = initialDimensions?.height ?? imageInfo.naturalHeight
    const emptySvg: ParsedSvg = {
      paths: [],
      viewBox: { x: 0, y: 0, width: svgWidth, height: svgHeight },
      width: svgWidth,
      height: svgHeight,
    }
    setParsedSvg(emptySvg)

    // Store initial state for resetting on cancel
    initialParsedSvgRef.current = JSON.parse(JSON.stringify(emptySvg))
    initialPathStylesRef.current = new Map()
    initialDefsRef.current = effectsManager.defs

    resetHistory([], overlayStateManager.overlayState, new Map(), effectsManager.defs)

    // Track STARTED event for overlay mode (only once per session)
    if (!startedTrackedRef.current) {
      startedTrackedRef.current = true
      trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_STARTED, {
        is_modal: isModal,
        overlay_mode: true,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayMode, imageInfo, svgDataUri, svgUrl])

  // Notify parent of mode changes
  useEffect(() => {
    onModeChange?.(editorMode)
  }, [editorMode, onModeChange])

  // Helper: Detect and decode SVG from clipboard text
  const detectAndDecodeSvg = useCallback((text: string): string | null => {
    const trimmed = text.trim()

    // Raw SVG string
    if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml') || trimmed.startsWith('<SVG')) {
      return trimmed
    }

    // Data URI format
    if (trimmed.startsWith('data:image/svg+xml')) {
      try {
        return decodeSvgDataUri(trimmed)
      } catch {
        return null
      }
    }

    return null
  }, [])

  // Helper: Calculate scale factor to fit external SVG in canvas (shrink only, never enlarge)
  const calculateFitScale = useCallback(
    (sourceViewBox: { width: number; height: number }, targetViewBox: { width: number; height: number }): number => {
      const scaleX = targetViewBox.width / sourceViewBox.width
      const scaleY = targetViewBox.height / sourceViewBox.height
      const scale = Math.min(scaleX, scaleY)

      // Shrink only - never enlarge
      return Math.min(scale, 1)
    },
    []
  )

  // Helper: Transform paths from external SVG to fit and center on canvas
  const transformPathsToFitCanvas = useCallback(
    (
      paths: ParsedPath[],
      sourceViewBox: { x: number; y: number; width: number; height: number },
      targetViewBox: { x: number; y: number; width: number; height: number },
      scale: number
    ): ParsedPath[] => {
      // Calculate center offset
      const scaledWidth = sourceViewBox.width * scale
      const scaledHeight = sourceViewBox.height * scale
      const offsetX = targetViewBox.x + (targetViewBox.width - scaledWidth) / 2 - sourceViewBox.x * scale
      const offsetY = targetViewBox.y + (targetViewBox.height - scaledHeight) / 2 - sourceViewBox.y * scale

      return paths.map(path => ({
        ...path,
        commands: path.commands.map(cmd => {
          if (cmd.type.toUpperCase() === 'Z') return { ...cmd }
          return {
            ...cmd,
            x: cmd.x * scale + offsetX,
            y: cmd.y * scale + offsetY,
            ...(cmd.cp1 && { cp1: { x: cmd.cp1.x * scale + offsetX, y: cmd.cp1.y * scale + offsetY } }),
            ...(cmd.cp2 && { cp2: { x: cmd.cp2.x * scale + offsetX, y: cmd.cp2.y * scale + offsetY } }),
            ...(cmd.cp && { cp: { x: cmd.cp.x * scale + offsetX, y: cmd.cp.y * scale + offsetY } }),
          }
        }),
      }))
    },
    []
  )

  // Toggle sidebar section (same button = close, different button = switch)
  const handleToggleSidebarSection = useCallback((section: SidebarSection) => {
    setActiveSidebarSection(prev => (prev === section ? null : section))
  }, [])

  // Close sidebar and popover (for click-outside handling)
  const handleCloseSidebar = useCallback(() => {
    setActiveSidebarSection(null)
    // Toggle signal to close any open popover
    setClosePopoverSignal(prev => !prev)
  }, [])

  // Overlay toggle handlers with history support (for undo/redo)
  // Support multi-path selection - apply to all selected paths
  const handleToggleClipPath = useCallback(() => {
    if (selectedPathIndices.size === 0 || !parsedSvg) return

    const indicesToToggle = Array.from(selectedPathIndices)

    // Toggle clip path for all selected paths
    indicesToToggle.forEach(pathIndex => {
      overlayStateManager.toggleClipPath(pathIndex)
    })

    // Build new overlay state by toggling all selected paths
    let newClipPathIndices = [...overlayStateManager.overlayState.clipPathIndices]
    let newHolePathIndices = [...overlayStateManager.overlayState.holePathIndices]

    indicesToToggle.forEach(pathIndex => {
      const wasClipPath = newClipPathIndices.includes(pathIndex)
      if (wasClipPath) {
        // Remove from clip paths
        newClipPathIndices = newClipPathIndices.filter(i => i !== pathIndex)
      } else {
        // Add to clip paths and remove from hole paths
        newClipPathIndices.push(pathIndex)
        newHolePathIndices = newHolePathIndices.filter(i => i !== pathIndex)
      }
    })

    const newOverlayState = {
      ...overlayStateManager.overlayState,
      clipPathIndices: newClipPathIndices,
      holePathIndices: newHolePathIndices,
    }
    pushToHistory(parsedSvg.paths, newOverlayState, pathStyles, effectsManager.defs)
  }, [selectedPathIndices, parsedSvg, overlayStateManager, pushToHistory, pathStyles, effectsManager.defs])

  const handleToggleHolePath = useCallback(() => {
    if (selectedPathIndices.size === 0 || !parsedSvg) return

    const indicesToToggle = Array.from(selectedPathIndices)

    // Toggle hole path for all selected paths
    indicesToToggle.forEach(pathIndex => {
      overlayStateManager.toggleHolePath(pathIndex)
    })

    // Build new overlay state by toggling all selected paths
    let newHolePathIndices = [...overlayStateManager.overlayState.holePathIndices]
    let newClipPathIndices = [...overlayStateManager.overlayState.clipPathIndices]

    indicesToToggle.forEach(pathIndex => {
      const wasHolePath = newHolePathIndices.includes(pathIndex)
      if (wasHolePath) {
        // Remove from hole paths
        newHolePathIndices = newHolePathIndices.filter(i => i !== pathIndex)
      } else {
        // Add to hole paths and remove from clip paths
        newHolePathIndices.push(pathIndex)
        newClipPathIndices = newClipPathIndices.filter(i => i !== pathIndex)
      }
    })

    const newOverlayState = {
      ...overlayStateManager.overlayState,
      holePathIndices: newHolePathIndices,
      clipPathIndices: newClipPathIndices,
    }
    pushToHistory(parsedSvg.paths, newOverlayState, pathStyles, effectsManager.defs)
  }, [selectedPathIndices, parsedSvg, overlayStateManager, pushToHistory, pathStyles, effectsManager.defs])

  const handleToggleAdjustmentMask = useCallback(() => {
    if (selectedPathIndices.size === 0 || !parsedSvg) return

    const indicesToToggle = Array.from(selectedPathIndices)

    // Determine if we're creating or removing masks (based on majority or first path)
    // If any selected path doesn't have a mask, we'll create masks for all
    const anyWithoutMask = indicesToToggle.some(
      pathIndex => !overlayStateManager.overlayState.adjustmentMasks.some(m => m.pathIndex === pathIndex)
    )
    const isCreating = anyWithoutMask

    // Toggle adjustment mask for all selected paths
    indicesToToggle.forEach(pathIndex => {
      overlayStateManager.toggleAdjustmentMask(pathIndex)
    })

    // Build new overlay state by toggling all selected paths
    let newAdjustmentMasks = [...overlayStateManager.overlayState.adjustmentMasks]

    indicesToToggle.forEach(pathIndex => {
      const existingMaskIndex = newAdjustmentMasks.findIndex(m => m.pathIndex === pathIndex)
      if (isCreating) {
        // Creating: add mask if doesn't exist
        if (existingMaskIndex < 0) {
          newAdjustmentMasks.push({ pathIndex, adjustments: {} })
        }
      } else {
        // Removing: remove mask if exists
        if (existingMaskIndex >= 0) {
          newAdjustmentMasks = newAdjustmentMasks.filter(m => m.pathIndex !== pathIndex)
        }
      }
    })

    const newOverlayState = {
      ...overlayStateManager.overlayState,
      adjustmentMasks: newAdjustmentMasks,
    }
    pushToHistory(parsedSvg.paths, newOverlayState, pathStyles, effectsManager.defs)

    // Auto-open Adjustments panel when creating new adjustment masks
    if (isCreating) {
      setActiveSidebarSection('adjustments')
    } else {
      // Auto-close Adjustments panel when removing adjustment masks (if currently open)
      setActiveSidebarSection(prev => (prev === 'adjustments' ? null : prev))
    }
  }, [selectedPathIndices, parsedSvg, overlayStateManager, pushToHistory, pathStyles, effectsManager.defs])

  // Commit adjustment mask settings change to history (called on slider release)
  const handleAdjustmentMaskSettingsCommit = useCallback(() => {
    if (selectedPathIndex === null || !parsedSvg) return
    if (!overlayStateManager.isAdjustmentMask(selectedPathIndex)) return

    // Push current overlay state to history
    pushToHistory(parsedSvg.paths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
  }, [selectedPathIndex, parsedSvg, overlayStateManager, pushToHistory, pathStyles, effectsManager.defs])

  // Commit direct image color adjustments to history (called on slider release)
  const handleImageAdjustmentCommit = useCallback(() => {
    if (!parsedSvg) return

    // Push current overlay state to history
    pushToHistory(parsedSvg.paths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
  }, [parsedSvg, overlayStateManager, pushToHistory, pathStyles, effectsManager.defs])

  // Handle filter preset change for overlay mode background image
  const handleImageFilterPresetChange = useCallback(
    (presetId: string | null) => {
      const currentAdjustments = overlayStateManager.overlayState.imageColorAdjustments || {}
      const newAdjustments = {
        ...currentAdjustments,
        filterPresetId: presetId ?? undefined,
        // Reset preset params when changing presets
        filterPresetParams: undefined,
        // When applying a preset, clear individual adjustments for a clean preset effect
        ...(presetId
          ? {
              brightness: 0,
              contrast: 0,
              saturation: 0,
              hueRotate: 0,
              invert: 0,
              sepia: 0,
              grayscale: 0,
            }
          : {}),
      }
      overlayStateManager.setImageColorAdjustments(newAdjustments)
    },
    [overlayStateManager]
  )

  // Handle filter preset parameter change (for fine-tuning presets)
  // Uses functional update pattern in useOverlayState to avoid stale closure issues
  const handleImageFilterParamChange = useCallback(
    (paramKey: string, value: number) => {
      overlayStateManager.updateFilterPresetParam(paramKey, value)
    },
    [overlayStateManager]
  )

  // Handle viewBox change (for viewport resize via input fields in EditModeSection sidebar)
  // Updates both viewBox and width/height to keep SVG dimensions in sync
  const handleViewBoxChange = useCallback(
    (viewBox: ViewBox) => {
      if (!parsedSvg) return
      // Update width and height to match the new viewBox dimensions
      setParsedSvg({
        ...parsedSvg,
        viewBox,
        width: viewBox.width,
        height: viewBox.height,
      })
    },
    [parsedSvg]
  )

  // Move node (uses immutable update - no deep cloning)
  const handleNodeMove = useCallback(
    (pathIndex: number, nodeIndex: number, x: number, y: number) => {
      if (!parsedSvg) return

      const newPaths = updateCommandPosition(parsedSvg.paths, pathIndex, nodeIndex, x, y)
      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Finalize node move
  const handleNodeMoveEnd = useCallback(
    (pathIndex: number, nodeIndex: number, x: number, y: number) => {
      if (!parsedSvg) return

      const newPaths = updateCommandPosition(parsedSvg.paths, pathIndex, nodeIndex, x, y)
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Move control point (uses immutable update - no deep cloning)
  const handleControlPointMove = useCallback(
    (pathIndex: number, nodeIndex: number, cpIndex: number, x: number, y: number) => {
      if (!parsedSvg) return

      const newPaths = updateControlPointPosition(parsedSvg.paths, pathIndex, nodeIndex, cpIndex, x, y)
      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Finalize control point move
  const handleControlPointMoveEnd = useCallback(
    (pathIndex: number, nodeIndex: number, cpIndex: number, x: number, y: number) => {
      if (!parsedSvg) return

      const newPaths = updateControlPointPosition(parsedSvg.paths, pathIndex, nodeIndex, cpIndex, x, y)
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Move multiple nodes (uses immutable update - no deep cloning)
  const handleMultiNodeMove = useCallback(
    (pathIndex: number, nodeIndices: Set<number>, deltaX: number, deltaY: number) => {
      if (!parsedSvg) return

      const path = parsedSvg.paths[pathIndex]
      if (!path) return

      // Store original positions on first move (including control points)
      if (originalPositionsRef.current.size === 0) {
        nodeIndices.forEach(nodeIndex => {
          const cmd = path.commands[nodeIndex]
          originalPositionsRef.current.set(nodeIndex, { x: cmd.x, y: cmd.y })
          // Store control points for bezier curves
          if (cmd.cp1) {
            originalPositionsRef.current.set(`cp1_${nodeIndex}`, { ...cmd.cp1 })
          }
          if (cmd.cp2) {
            originalPositionsRef.current.set(`cp2_${nodeIndex}`, { ...cmd.cp2 })
          }
          if (cmd.cp) {
            originalPositionsRef.current.set(`cp_${nodeIndex}`, { ...cmd.cp })
          }
        })
      }

      const newPaths = updateMultipleNodePositions(
        parsedSvg.paths,
        pathIndex,
        originalPositionsRef.current,
        deltaX,
        deltaY
      )
      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Finalize multi-node move
  const handleMultiNodeMoveEnd = useCallback(
    (pathIndex: number, _nodeIndices: Set<number>, deltaX: number, deltaY: number) => {
      if (!parsedSvg) return

      const newPaths = updateMultipleNodePositions(
        parsedSvg.paths,
        pathIndex,
        originalPositionsRef.current,
        deltaX,
        deltaY
      )
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      originalPositionsRef.current.clear()
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Move entire paths (supports multi-path selection)
  const handlePathMove = useCallback(
    (pathIndices: Set<number>, deltaX: number, deltaY: number) => {
      if (!parsedSvg || pathIndices.size === 0) return

      // Store original positions on first move (for all selected paths)
      if (originalPositionsRef.current.size === 0) {
        pathIndices.forEach(pathIndex => {
          const path = parsedSvg.paths[pathIndex]
          if (!path) return
          path.commands.forEach((cmd, idx) => {
            // Use pathIndex prefix to differentiate between paths
            const key = `${pathIndex}_${idx}`
            originalPositionsRef.current.set(key, { x: cmd.x, y: cmd.y })
            if (cmd.cp1) {
              originalPositionsRef.current.set(`${pathIndex}_cp1_${idx}`, { ...cmd.cp1 })
            }
            if (cmd.cp2) {
              originalPositionsRef.current.set(`${pathIndex}_cp2_${idx}`, { ...cmd.cp2 })
            }
            if (cmd.cp) {
              originalPositionsRef.current.set(`${pathIndex}_cp_${idx}`, { ...cmd.cp })
            }
          })
        })
      }

      // Update all selected paths
      let newPaths = [...parsedSvg.paths]
      pathIndices.forEach(pathIndex => {
        // Create a filtered map for this path's original positions
        const pathOriginals = new Map<string | number, Point>()
        originalPositionsRef.current.forEach((value, key) => {
          const keyStr = String(key)
          if (keyStr.startsWith(`${pathIndex}_`)) {
            // Remove the pathIndex prefix for updatePathPosition
            const newKey = keyStr.replace(`${pathIndex}_`, '')
            // Convert back to number if it's a plain index, otherwise keep as string
            const parsedKey = /^\d+$/.test(newKey) ? parseInt(newKey, 10) : newKey
            pathOriginals.set(parsedKey, value)
          }
        })
        newPaths = updatePathPosition(newPaths, pathIndex, pathOriginals, deltaX, deltaY)
      })
      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Finalize path move
  const handlePathMoveEnd = useCallback(
    (pathIndices: Set<number>, deltaX: number, deltaY: number) => {
      if (!parsedSvg || pathIndices.size === 0) return

      // Update all selected paths
      let newPaths = [...parsedSvg.paths]
      pathIndices.forEach(pathIndex => {
        // Create a filtered map for this path's original positions
        const pathOriginals = new Map<string | number, Point>()
        originalPositionsRef.current.forEach((value, key) => {
          const keyStr = String(key)
          if (keyStr.startsWith(`${pathIndex}_`)) {
            // Remove the pathIndex prefix for updatePathPosition
            const newKey = keyStr.replace(`${pathIndex}_`, '')
            // Convert back to number if it's a plain index, otherwise keep as string
            const parsedKey = /^\d+$/.test(newKey) ? parseInt(newKey, 10) : newKey
            pathOriginals.set(parsedKey, value)
          }
        })
        newPaths = updatePathPosition(newPaths, pathIndex, pathOriginals, deltaX, deltaY)
      })
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      originalPositionsRef.current.clear()
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Insert node
  const handleNodeInsert = useCallback(
    (pathIndex: number, segmentIndex: number, position: Point, t: number) => {
      if (!parsedSvg) return

      const newPaths = JSON.parse(JSON.stringify(parsedSvg.paths)) as ParsedPath[]
      const updatedPath = insertNodeIntoPath(newPaths[pathIndex], segmentIndex, position, t)
      newPaths[pathIndex] = updatedPath

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      setSelectedNodeIndices(new Set([segmentIndex]))
      setSelectedNodeIndices(new Set([segmentIndex]))
    },
    [
      parsedSvg,
      pushToHistory,
      setSelectedNodeIndices,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // Drawing path handlers — delegate to shared useVectorPathDrawing hook, with subpath support
  const handleDrawPathClick = useCallback(
    (x: number, y: number) => {
      drawing.handleDrawPathClick(x, y, { moveTo: isStartingNewSubpath })
      if (isStartingNewSubpath) setIsStartingNewSubpath(false)
    },
    [drawing, isStartingNewSubpath]
  )

  const handleDrawPathCurve = useCallback(
    (x: number, y: number, controlDx: number, controlDy: number) => {
      drawing.handleDrawPathCurve(x, y, controlDx, controlDy, { moveTo: isStartingNewSubpath })
      if (isStartingNewSubpath) setIsStartingNewSubpath(false)
    },
    [drawing, isStartingNewSubpath]
  )

  const handleDrawPathQuadratic = useCallback(
    (x: number, y: number, controlDx: number, controlDy: number) => {
      drawing.handleDrawPathQuadratic(x, y, controlDx, controlDy, { moveTo: isStartingNewSubpath })
      if (isStartingNewSubpath) setIsStartingNewSubpath(false)
    },
    [drawing, isStartingNewSubpath]
  )

  // Finish drawing — hook returns raw commands, VectorEditor commits to SVG state
  const handleFinishDrawing = useCallback(() => {
    if (!parsedSvg) return
    const commands = drawing.handleFinishDrawing()
    if (!commands) return

    const hasClosedSubpath = commands.some(cmd => cmd.type === 'Z')
    const newPath: ParsedPath = {
      commands,
      fill: hasClosedSubpath ? '#000000' : 'none',
      fillRule: hasClosedSubpath ? 'nonzero' : undefined,
      stroke: '#000000',
      strokeWidth: 1,
    }

    const newPaths = [...parsedSvg.paths, newPath]
    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

    setIsStartingNewSubpath(false)
    setEditorMode('edit')
    setSelectedPathIndices(new Set([newPaths.length - 1]))
    setSelectedNodeIndices(new Set())
  }, [
    drawing,
    parsedSvg,
    pushToHistory,
    setSelectedPathIndices,
    setSelectedNodeIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  const { handleCloseDrawingPath, handleCloseDrawingPathWithCurve } = drawing

  // Cancel drawing — hook resets drawing state, VectorEditor resets subpath flag
  const handleCancelDrawing = useCallback(() => {
    drawing.handleCancelDrawing()
    setIsStartingNewSubpath(false)
  }, [drawing])

  // Toggle new subpath mode (Alt+M)
  const handleToggleNewSubpath = useCallback(() => {
    setIsStartingNewSubpath(prev => !prev)
  }, [])

  // Toggle mobile insert node mode (simulates Alt key on mobile)
  const handleToggleMobileInsertNodeMode = useCallback(() => {
    setMobileInsertNodeMode(prev => !prev)
  }, [])

  // Toggle mobile multi-select mode (simulates Shift key on mobile)
  const handleToggleMobileMultiSelectMode = useCallback(() => {
    setMobileMultiSelectMode(prev => !prev)
  }, [])

  // Toggle mobile selection rectangle mode (enables drag-to-select on mobile)
  const handleToggleMobileSelectionRectMode = useCallback(() => {
    setMobileSelectionRectMode(prev => !prev)
  }, [])

  // Toggle extend mode (Feature 3)
  const handleToggleExtendMode = useCallback(() => {
    setIsExtendMode(prev => {
      if (!prev && selectedPathIndex !== null && selectedNodeIndex !== null) {
        // Entering extend mode - set the node to extend from
        setExtendFromNode({ pathIndex: selectedPathIndex, nodeIndex: selectedNodeIndex })
      } else {
        // Exiting extend mode
        setExtendFromNode(null)
      }
      return !prev
    })
  }, [selectedPathIndex, selectedNodeIndex])

  // Handle extending path from a selected node (Feature 3)
  const handleExtendPath = useCallback(
    (pathIndex: number, nodeIndex: number, newX: number, newY: number) => {
      if (!parsedSvg) return

      const path = parsedSvg.paths[pathIndex]
      const commands = [...path.commands]
      const isFirstNode = nodeIndex === 0
      const isLastNode = nodeIndex === commands.length - 1 || commands[nodeIndex + 1]?.type === 'Z'

      // Create new command
      const newCmd: PathCommand = { type: 'L', x: newX, y: newY }

      if (isLastNode) {
        // Extend at end - simply append (before Z if present)
        const zIndex = commands.findIndex(cmd => cmd.type === 'Z' || cmd.type === 'z')
        if (zIndex !== -1) {
          commands.splice(zIndex, 0, newCmd)
        } else {
          commands.push(newCmd)
        }
      } else if (isFirstNode) {
        // Extend at start - insert new M at start, convert old M to L
        const oldM = commands[0]
        commands[0] = { type: 'M', x: newX, y: newY }
        commands.splice(1, 0, { type: 'L', x: oldM.x, y: oldM.y })
      }

      const newPaths = [...parsedSvg.paths]
      newPaths[pathIndex] = { ...path, commands }
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Update extend from node to the newly added node
      if (isLastNode) {
        const newNodeIndex = commands.findIndex(cmd => cmd.type === 'Z' || cmd.type === 'z')
        setExtendFromNode({
          pathIndex,
          nodeIndex: newNodeIndex !== -1 ? newNodeIndex - 1 : commands.length - 1,
        })
      } else {
        setExtendFromNode({ pathIndex, nodeIndex: 0 })
      }
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Close path during extend mode (Feature 3)
  const handleCloseExtendPath = useCallback(() => {
    if (!extendFromNode || !parsedSvg) return

    const { pathIndex } = extendFromNode
    const path = parsedSvg.paths[pathIndex]
    const commands = [...path.commands]

    // Check if path is already closed
    const hasZ = commands.some(cmd => cmd.type === 'Z' || cmd.type === 'z')
    if (hasZ) return

    // Add Z command to close the path
    commands.push({ type: 'Z', x: commands[0].x, y: commands[0].y })

    const newPaths = [...parsedSvg.paths]
    newPaths[pathIndex] = { ...path, commands }
    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

    // Exit extend mode
    setIsExtendMode(false)
    setExtendFromNode(null)
  }, [extendFromNode, parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles])

  // Break open a closed path at a specific node (Feature 3)
  const handleBreakOpenPath = useCallback(() => {
    if (selectedPathIndex === null || !parsedSvg) return

    const path = parsedSvg.paths[selectedPathIndex]
    const commands = [...path.commands]

    // Find and remove Z command
    const zIndex = commands.findIndex(cmd => cmd.type === 'Z' || cmd.type === 'z')
    if (zIndex === -1) return // Already open

    commands.splice(zIndex, 1)

    // If a node is selected, reorder commands so selected node becomes the end
    if (selectedNodeIndex !== null && selectedNodeIndex > 0 && selectedNodeIndex < commands.length) {
      const nodeIndex = selectedNodeIndex
      // Rotate commands so nodeIndex becomes the last node
      const beforeNode = commands.slice(1, nodeIndex + 1)
      const afterNode = commands.slice(nodeIndex + 1)
      const firstPoint = commands[0]

      // New M command at the split point
      const newCommands: PathCommand[] = [
        { type: 'M', x: commands[nodeIndex].x, y: commands[nodeIndex].y },
        ...afterNode,
        { type: 'L', x: firstPoint.x, y: firstPoint.y },
        ...beforeNode.slice(0, -1),
      ]
      commands.length = 0
      commands.push(...newCommands)
    }

    const newPaths = [...parsedSvg.paths]
    newPaths[selectedPathIndex] = { ...path, commands }
    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
  }, [
    parsedSvg,
    pushToHistory,
    selectedPathIndex,
    selectedNodeIndex,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Handle shape selection from popover
  const handleShapeSelect = useCallback(
    (shapeId: string | null) => {
      setSelectedPredefinedShape(shapeId)
      // Clear any existing drawing path when switching to shape mode
      if (shapeId !== null) {
        drawing.handleCancelDrawing()
        setIsStartingNewSubpath(false)
      }
    },
    [drawing]
  )

  // Handle draw sidebar opened (auto-open feature)
  const handleDrawSidebarOpened = useCallback(() => {
    hasShownDrawSidebarRef.current = true
    setShouldAutoOpenDrawSidebar(false)
  }, [])

  // Handle AI vector generation - insert generated paths into current canvas
  const handleAIVectorGenerate = useCallback(
    (newSvgDataUri: string, _newSvgUrl?: string) => {
      // Load the new SVG content
      if (newSvgDataUri && parsedSvg) {
        try {
          // Decode the data URI
          const base64Match = newSvgDataUri.match(/^data:image\/svg\+xml;base64,(.+)$/i)
          if (base64Match) {
            const svgContent = atob(base64Match[1])

            // Parse the new SVG using the already-imported parseSvgString function
            const generatedSvg = parseSvgString(svgContent)
            if (generatedSvg && generatedSvg.paths.length > 0) {
              // Calculate scale factor to fit generated SVG in current canvas (shrink only)
              const scaleFactor = calculateFitScale(generatedSvg.viewBox, parsedSvg.viewBox)

              // Transform paths to fit and center on current canvas
              const transformedPaths = transformPathsToFitCanvas(
                generatedSvg.paths,
                generatedSvg.viewBox,
                parsedSvg.viewBox,
                scaleFactor
              )

              // Add transformed paths to current canvas (preserving existing paths)
              const newPaths = [...parsedSvg.paths, ...transformedPaths]
              const firstNewPathIndex = parsedSvg.paths.length

              // Update pathStyles for each new path
              setPathStyles(prev => {
                const newStyles = new Map(prev)
                transformedPaths.forEach((path, i) => {
                  const pathIndex = firstNewPathIndex + i
                  newStyles.set(pathIndex, {
                    fill: stringToPaint(path.fill || 'none'),
                    stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
                    strokeWidth: path.strokeWidth,
                    fillRule: path.fillRule,
                    opacity: 1,
                    mixBlendMode: 'normal' as BlendMode,
                  })
                })
                return newStyles
              })

              // Update parsed SVG while preserving the current viewBox
              setParsedSvg({ ...parsedSvg, paths: newPaths })

              // Add to history
              pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

              // Select the first new path and switch to edit mode
              setSelectedPathIndices(new Set([firstNewPathIndex]))
              setSelectedNodeIndices(new Set())
              drawing.handleCancelDrawing()
              setEditorMode('edit')
            }
          }
        } catch (error) {
          console.error('Error loading AI-generated vector:', error)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      parsedSvg,
      pathStyles,
      effectsManager.defs,
      overlayStateManager.overlayState,
      calculateFitScale,
      transformPathsToFitCanvas,
    ]
  )

  // Handle shape drag start
  const handleShapeDragStart = useCallback((point: Point) => {
    setShapeDragStart(point)
    setShapeDragCurrent(point)
  }, [])

  // Handle shape drag move
  const handleShapeDragMove = useCallback((point: Point) => {
    setShapeDragCurrent(point)
  }, [])

  // Handle shape drag end - create the shape
  const handleShapeDragEnd = useCallback(
    (startPoint: Point, endPoint: Point) => {
      if (!selectedPredefinedShape || !parsedSvg) {
        setShapeDragStart(null)
        setShapeDragCurrent(null)
        return
      }

      const shape = getShapeById(selectedPredefinedShape) as AnyShapeDefinition | undefined
      if (!shape) {
        setShapeDragStart(null)
        setShapeDragCurrent(null)
        return
      }

      // Calculate bounding box from drag points
      const minX = Math.min(startPoint.x, endPoint.x)
      const maxX = Math.max(startPoint.x, endPoint.x)
      const minY = Math.min(startPoint.y, endPoint.y)
      const maxY = Math.max(startPoint.y, endPoint.y)

      const width = maxX - minX
      const height = maxY - minY

      // Minimum size check to avoid creating tiny shapes
      if (width < 5 || height < 5) {
        setShapeDragStart(null)
        setShapeDragCurrent(null)
        return
      }

      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2

      let newPaths: ParsedPath[]

      // Check if this is a composite shape (human figures, body parts, nature, objects)
      // or a pattern shape (generates multiple paths with config)
      if ('isComposite' in shape && shape.isComposite) {
        // Composite shape - generates multiple paths
        const compositeParts: CompositePathResult[] = shape.generator(cx, cy, width, height)

        // Sort by zIndex and create paths for each part
        const sortedParts = [...compositeParts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

        // Keep predefined fill/stroke for all composite shapes
        const partPaths: ParsedPath[] = sortedParts.map(part => ({
          commands: part.commands,
          fill: part.fill ?? '#000000',
          stroke: part.stroke ?? '#000000',
          strokeWidth: part.strokeWidth ?? 1,
          fillRule: 'nonzero' as const,
        }))

        newPaths = [...parsedSvg.paths, ...partPaths]
      } else if ('isPattern' in shape && shape.isPattern) {
        // Pattern shape - generates multiple paths with scatter effect
        const patternParts: CompositePathResult[] = shape.generator(cx, cy, width, height, shape.defaultConfig)

        // Sort by zIndex and create paths for each part
        const sortedParts = [...patternParts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

        // Keep predefined fill/stroke for all pattern shapes
        const partPaths: ParsedPath[] = sortedParts.map(part => ({
          commands: part.commands,
          fill: part.fill ?? '#000000',
          stroke: part.stroke ?? '#000000',
          strokeWidth: part.strokeWidth ?? 1,
          fillRule: 'nonzero' as const,
        }))

        newPaths = [...parsedSvg.paths, ...partPaths]
      } else if (isUnifiedGridShape(shape)) {
        // Unified grid shape - single path with multiple subpaths (one per tile)
        const result: UnifiedGridResult = shape.generator(cx, cy, width, height)

        // Keep predefined fill/stroke for unified grid shapes
        const newPath: ParsedPath = {
          commands: result.commands,
          fill: result.fill,
          stroke: result.stroke,
          strokeWidth: result.strokeWidth,
          fillRule: 'nonzero' as const,
        }

        newPaths = [...parsedSvg.paths, newPath]
      } else {
        // Single path shape (ShapeDefinition) - uses ShapeGenerator which returns PathCommand[]
        const simpleShape = shape as { generator: (cx: number, cy: number, w: number, h: number) => PathCommand[] }
        const commands = simpleShape.generator(cx, cy, width, height)

        // Single-color shapes: stroke only, no fill
        // This makes predefined shapes behave like outline-only drawings
        const newPath: ParsedPath = {
          commands,
          fill: 'none',
          stroke: '#000000',
          strokeWidth: 1,
        }

        newPaths = [...parsedSvg.paths, newPath]
      }

      // Update state and push to history
      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Calculate indices of all newly added paths
      const previousPathCount = parsedSvg.paths.length
      const newPathIndices = new Set(
        Array.from({ length: newPaths.length - previousPathCount }, (_, i) => previousPathCount + i)
      )

      // Reset state and select all newly added paths
      setShapeDragStart(null)
      setShapeDragCurrent(null)
      setSelectedPredefinedShape(null)
      setEditorMode('edit')
      setSelectedPathIndices(new Set([newPaths.length - 1])) // Primary = last path
      setSelectedPathIndices(newPathIndices) // All new paths selected
      setSelectedNodeIndices(new Set())
      setSelectedNodeIndices(new Set())
    },
    [
      selectedPredefinedShape,
      parsedSvg,
      pushToHistory,
      setSelectedPathIndices,
      setSelectedNodeIndices,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // Helper: Promote next node to first (when deleting first node)
  const promoteNextNodeToFirst = useCallback((commands: PathCommand[]): PathCommand[] => {
    if (commands.length < 2) return commands

    const nextCmd = commands[1]
    // Create new M command from next node's endpoint
    const newFirst: PathCommand = {
      type: 'M',
      x: nextCmd.x,
      y: nextCmd.y,
    }

    // Return: new M command + remaining commands (skip old first two)
    return [newFirst, ...commands.slice(2)]
  }, [])

  // Haptic feedback for mobile (50ms vibration on delete)
  const triggerHapticFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
  }, [])

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null) return

    // Trigger haptic feedback for mobile devices
    triggerHapticFeedback()

    const newPaths = JSON.parse(JSON.stringify(parsedSvg.paths)) as ParsedPath[]

    // Multi-path deletion (when multiple paths are selected)
    if (selectedPathIndices.size > 1) {
      // Delete paths in reverse index order to maintain indices
      const sortedIndices = Array.from(selectedPathIndices).sort((a, b) => b - a)

      for (const pathIndex of sortedIndices) {
        newPaths.splice(pathIndex, 1)
      }

      // Update pathStyles map by rebuilding with new indices
      setPathStyles(prev => {
        const newStyles = new Map<number, PathStyleWithSubpaths>()
        const deletedIndices = new Set(sortedIndices)

        // Calculate new index for each remaining style
        prev.forEach((style, oldIndex) => {
          if (!deletedIndices.has(oldIndex)) {
            // Count how many deleted indices are below this one
            let shift = 0
            for (const deletedIdx of sortedIndices) {
              if (deletedIdx < oldIndex) shift++
            }
            newStyles.set(oldIndex - shift, style)
          }
        })
        return newStyles
      })

      // Remap overlay indices (clip paths, hole paths, adjustment masks)
      const deletedIndices = new Set(sortedIndices)
      const indexMap = new Map<number, number | null>()
      for (let i = 0; i < parsedSvg.paths.length; i++) {
        if (deletedIndices.has(i)) {
          indexMap.set(i, null)
        } else {
          let shift = 0
          for (const deletedIdx of sortedIndices) {
            if (deletedIdx < i) shift++
          }
          indexMap.set(i, i - shift)
        }
      }
      overlayStateManager.remapIndices(indexMap)

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      setSelectedPathIndices(newPaths.length > 0 ? new Set([0]) : new Set())
      setSelectedPathIndices(newPaths.length > 0 ? new Set([0]) : new Set())
      setSelectedNodeIndices(new Set())
      setSelectedNodeIndices(new Set())
      return
    }

    // Multi-node deletion
    if (selectedNodeIndices.size > 1) {
      const commands = newPaths[selectedPathIndex].commands
      const sortedIndices = Array.from(selectedNodeIndices).sort((a, b) => b - a)
      const includesFirstNode = sortedIndices.includes(0)

      // Delete nodes in reverse order (excluding first node for now)
      for (const nodeIndex of sortedIndices) {
        if (nodeIndex === 0) continue // Handle first node separately
        commands.splice(nodeIndex, 1)
      }

      // If first node was selected, promote next node or delete path
      if (includesFirstNode) {
        if (commands.length >= 2) {
          newPaths[selectedPathIndex].commands = promoteNextNodeToFirst(commands)
        } else {
          // Delete entire path if not enough nodes remain
          newPaths.splice(selectedPathIndex, 1)
        }
      }

      // If path has fewer than 2 commands after deletion, remove it
      const pathWasDeleted
        = (includesFirstNode && commands.length < 2) || newPaths[selectedPathIndex]?.commands.length < 2
      if (newPaths[selectedPathIndex]?.commands.length < 2) {
        newPaths.splice(selectedPathIndex, 1)
      }

      // Remap overlay indices if a path was deleted
      if (pathWasDeleted) {
        const indexMap = new Map<number, number | null>()
        for (let i = 0; i < parsedSvg.paths.length; i++) {
          if (i === selectedPathIndex) {
            indexMap.set(i, null)
          } else if (i > selectedPathIndex) {
            indexMap.set(i, i - 1)
          } else {
            indexMap.set(i, i)
          }
        }
        overlayStateManager.remapIndices(indexMap)
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      setSelectedPathIndices(
        newPaths.length > 0 ? new Set([Math.min(selectedPathIndex ?? 0, newPaths.length - 1)]) : new Set()
      )
      setSelectedNodeIndices(new Set())
      setSelectedNodeIndices(new Set())
      return
    }

    // Single node deletion
    if (selectedNodeIndex !== null) {
      const commands = newPaths[selectedPathIndex].commands
      let singleNodePathDeleted = false

      if (selectedNodeIndex === 0) {
        // Deleting first node - promote next or delete path
        if (commands.length >= 3) {
          newPaths[selectedPathIndex].commands = promoteNextNodeToFirst(commands)
        } else {
          // Not enough nodes - delete entire path
          newPaths.splice(selectedPathIndex, 1)
          singleNodePathDeleted = true
        }
      } else {
        // Normal deletion
        commands.splice(selectedNodeIndex, 1)
        // If path now has fewer than 2 commands, delete it
        if (commands.length < 2) {
          newPaths.splice(selectedPathIndex, 1)
          singleNodePathDeleted = true
        }
      }

      // Remap overlay indices if a path was deleted
      if (singleNodePathDeleted) {
        const indexMap = new Map<number, number | null>()
        for (let i = 0; i < parsedSvg.paths.length; i++) {
          if (i === selectedPathIndex) {
            indexMap.set(i, null)
          } else if (i > selectedPathIndex) {
            indexMap.set(i, i - 1)
          } else {
            indexMap.set(i, i)
          }
        }
        overlayStateManager.remapIndices(indexMap)
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
      setSelectedPathIndices(
        newPaths.length > 0 ? new Set([Math.min(selectedPathIndex ?? 0, newPaths.length - 1)]) : new Set()
      )
      setSelectedNodeIndices(new Set())
      setSelectedNodeIndices(new Set())
      return
    }

    // Path deletion (no node selected) - allow deleting last path
    // Remap overlay indices before deleting
    const indexMap = new Map<number, number | null>()
    for (let i = 0; i < parsedSvg.paths.length; i++) {
      if (i === selectedPathIndex) {
        indexMap.set(i, null)
      } else if (i > selectedPathIndex) {
        indexMap.set(i, i - 1)
      } else {
        indexMap.set(i, i)
      }
    }
    overlayStateManager.remapIndices(indexMap)

    newPaths.splice(selectedPathIndex, 1)
    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    const newIndex = newPaths.length > 0 ? Math.min(selectedPathIndex, newPaths.length - 1) : null
    setSelectedPathIndices(newIndex !== null ? new Set([newIndex]) : new Set())
    setSelectedNodeIndices(new Set())
    setSelectedNodeIndices(new Set())
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedPathIndices,
    selectedNodeIndex,
    selectedNodeIndices,
    pushToHistory,
    promoteNextNodeToFirst,
    setSelectedPathIndices,
    setSelectedNodeIndices,
    overlayStateManager,
    effectsManager.defs,
    pathStyles,
    triggerHapticFeedback,
  ])

  // =============================================================================
  // Layer Ordering (Z-Index) Handlers
  // =============================================================================

  // Can move up = not already at top (last in array = front)
  const canMoveUp = useMemo(() => {
    if (selectedPathIndex === null || !parsedSvg) return false
    return selectedPathIndex < parsedSvg.paths.length - 1
  }, [selectedPathIndex, parsedSvg])

  // Can move down = not already at bottom (first in array = back)
  const canMoveDown = useMemo(() => {
    if (selectedPathIndex === null || !parsedSvg) return false
    return selectedPathIndex > 0
  }, [selectedPathIndex, parsedSvg])

  // Move path up (toward front - swap with next index)
  const handleMoveUp = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveUp) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    // Swap with next path
    ;[newPaths[idx], newPaths[idx + 1]] = [newPaths[idx + 1], newPaths[idx]]

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    setSelectedPathIndices(new Set([idx + 1]))

    // Update pathStyles map if needed
    setPathStyles(prev => {
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          newStyles.set(idx + 1, style)
        } else if (index === idx + 1) {
          newStyles.set(idx, style)
        } else {
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [
    parsedSvg,
    selectedPathIndex,
    canMoveUp,
    pushToHistory,
    setSelectedPathIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Move path down (toward back - swap with previous index)
  const handleMoveDown = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveDown) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    // Swap with previous path
    ;[newPaths[idx], newPaths[idx - 1]] = [newPaths[idx - 1], newPaths[idx]]

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    setSelectedPathIndices(new Set([idx - 1]))

    // Update pathStyles map
    setPathStyles(prev => {
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          newStyles.set(idx - 1, style)
        } else if (index === idx - 1) {
          newStyles.set(idx, style)
        } else {
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [
    parsedSvg,
    selectedPathIndex,
    canMoveDown,
    pushToHistory,
    setSelectedPathIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Move path to front (last in array)
  const handleMoveToFront = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveUp) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    const [path] = newPaths.splice(idx, 1)
    newPaths.push(path)

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    setSelectedPathIndices(new Set([newPaths.length - 1]))

    // Update pathStyles map - shift all indices above down, put moved path at end
    setPathStyles(prev => {
      const movedStyle = prev.get(idx)
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          // This path moves to end
          if (movedStyle) newStyles.set(newPaths.length - 1, movedStyle)
        } else if (index > idx) {
          // Shift down by 1
          newStyles.set(index - 1, style)
        } else {
          // Keep same index
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [
    parsedSvg,
    selectedPathIndex,
    canMoveUp,
    pushToHistory,
    setSelectedPathIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Move path to back (first in array)
  const handleMoveToBack = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveDown) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    const [path] = newPaths.splice(idx, 1)
    newPaths.unshift(path)

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)
    setSelectedPathIndices(new Set([0]))

    // Update pathStyles map - shift all indices below up, put moved path at start
    setPathStyles(prev => {
      const movedStyle = prev.get(idx)
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          // This path moves to start
          if (movedStyle) newStyles.set(0, movedStyle)
        } else if (index < idx) {
          // Shift up by 1
          newStyles.set(index + 1, style)
        } else {
          // Keep same index
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [
    parsedSvg,
    selectedPathIndex,
    canMoveDown,
    pushToHistory,
    setSelectedPathIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Handle image tracing - convert raster image to vector paths
  const handleTraceImage = useCallback(async () => {
    if (!isOverlayMode || !rasterImageUrl) return

    const result = await traceImage(rasterImageUrl)

    if (result.success && result.paths.length > 0) {
      // Convert traced paths to ParsedPath format and add to current paths
      // Traced paths have no fill and no stroke - they're used for clipping/holes
      const tracedPaths: ParsedPath[] = result.paths.map((path, index) => ({
        ...path,
        fill: 'none',
        stroke: 'none',
        strokeWidth: 0,
        // Ensure unique IDs
        id: path.id || `traced-path-${Date.now()}-${index}`,
      }))

      // Merge with existing paths
      const currentPaths = parsedSvg?.paths || []
      const newPaths = [...currentPaths, ...tracedPaths]

      // Update or create parsedSvg
      if (parsedSvg) {
        setParsedSvg({ ...parsedSvg, paths: newPaths })
      } else {
        // Create new parsedSvg from scratch for overlay mode
        setParsedSvg({
          viewBox: imageInfo
            ? { x: 0, y: 0, width: imageInfo.width, height: imageInfo.height }
            : { x: 0, y: 0, width: 100, height: 100 },
          width: imageInfo?.width || 100,
          height: imageInfo?.height || 100,
          paths: newPaths,
        })
      }

      // Push to history for undo support
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Select the first traced path
      if (tracedPaths.length > 0) {
        setSelectedPathIndices(new Set([currentPaths.length]))
      }
    }
  }, [
    isOverlayMode,
    rasterImageUrl,
    traceImage,
    parsedSvg,
    imageInfo,
    pushToHistory,
    setSelectedPathIndices,
    overlayStateManager.overlayState,
    effectsManager.defs,
    pathStyles,
  ])

  // Store original rotations for multi-path rotation (set on first handleRotationChange call)
  const originalRotationsRef = useRef<Map<number, { rotation: number; origin: Point }>>(new Map())
  // Store the unified center used for multi-path rotation
  const rotationUnifiedCenterRef = useRef<Point | null>(null)

  // Handle rotation change (live preview during drag) - supports multi-path selection
  const handleRotationChange = useCallback(
    (pathIndices: Set<number>, deltaAngle: number, center: Point) => {
      if (!parsedSvg) return

      const isMultiPath = pathIndices.size > 1

      // Store original rotations and unified center on first call (when ref is empty)
      if (originalRotationsRef.current.size === 0) {
        rotationUnifiedCenterRef.current = center
        for (const idx of pathIndices) {
          const path = parsedSvg.paths[idx]
          if (path) {
            originalRotationsRef.current.set(idx, {
              rotation: path.pathRotation || 0,
              origin: path.pathRotationOrigin || calculatePathCenter(path.commands),
            })
          }
        }
      }

      // Apply delta angle to all selected paths
      const newPaths = [...parsedSvg.paths]
      for (const idx of pathIndices) {
        const original = originalRotationsRef.current.get(idx)
        if (original) {
          let newRotation = original.rotation + deltaAngle
          // Normalize to -180 to 180 range
          while (newRotation > 180) newRotation -= 360
          while (newRotation < -180) newRotation += 360

          // For multi-path rotation, all paths rotate around the unified center
          // For single path, use the path's own center
          const rotationOrigin = isMultiPath ? rotationUnifiedCenterRef.current! : original.origin

          newPaths[idx] = {
            ...newPaths[idx],
            pathRotation: newRotation,
            pathRotationOrigin: rotationOrigin,
          }
        }
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Handle rotation change end (commit to history) - supports multi-path selection
  // BAKES rotation directly into path coordinates instead of storing as transform
  const handleRotationChangeEnd = useCallback(
    (pathIndices: Set<number>, deltaAngle: number, _center: Point) => {
      if (!parsedSvg) return

      const isMultiPath = pathIndices.size > 1

      // Bake rotation into path coordinates for all selected paths
      const newPaths = [...parsedSvg.paths]
      for (const idx of pathIndices) {
        const original = originalRotationsRef.current.get(idx)
        if (original) {
          // Calculate the total rotation to apply
          const totalRotation = original.rotation + deltaAngle

          // For multi-path rotation, all paths rotate around the unified center
          // For single path, use the path's own center
          const rotationOrigin = isMultiPath ? rotationUnifiedCenterRef.current! : original.origin

          // Bake the rotation directly into the path commands
          const rotatedCommands = bakeRotationIntoCommands(newPaths[idx].commands, totalRotation, rotationOrigin)

          newPaths[idx] = {
            ...newPaths[idx],
            commands: rotatedCommands,
            // Clear rotation transform - it's now baked into coordinates
            pathRotation: undefined,
            pathRotationOrigin: undefined,
          }
        }
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Clear original rotations for next rotation operation
      originalRotationsRef.current.clear()
      rotationUnifiedCenterRef.current = null
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Store original commands for multi-path resize (set on first handleResizeChange call)
  const originalCommandsForResizeRef = useRef<Map<number, PathCommand[]>>(new Map())
  // Store the unified center used for multi-path resize
  const resizeUnifiedCenterRef = useRef<Point | null>(null)

  // Handle resize change (live preview during drag) - supports multi-path selection
  const handleResizeChange = useCallback(
    (pathIndices: Set<number>, scaleX: number, scaleY: number, center: Point) => {
      if (!parsedSvg) return

      // Store original commands and unified center on first call (when ref is empty)
      if (originalCommandsForResizeRef.current.size === 0) {
        resizeUnifiedCenterRef.current = center
        for (const idx of pathIndices) {
          const path = parsedSvg.paths[idx]
          if (path) {
            // Deep clone commands
            originalCommandsForResizeRef.current.set(
              idx,
              path.commands.map(cmd => ({
                ...cmd,
                cp1: cmd.cp1 ? { ...cmd.cp1 } : undefined,
                cp2: cmd.cp2 ? { ...cmd.cp2 } : undefined,
                cp: cmd.cp ? { ...cmd.cp } : undefined,
              }))
            )
          }
        }
      }

      // Apply scale to all selected paths
      const newPaths = [...parsedSvg.paths]
      for (const idx of pathIndices) {
        const originalCommands = originalCommandsForResizeRef.current.get(idx)
        if (originalCommands) {
          // Use the unified center for consistent scaling
          const scaledCommands = scalePathCommands(originalCommands, scaleX, scaleY, resizeUnifiedCenterRef.current!)

          newPaths[idx] = {
            ...newPaths[idx],
            commands: scaledCommands,
          }
        }
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
    },
    [parsedSvg]
  )

  // Handle resize change end (commit to history) - supports multi-path selection
  const handleResizeChangeEnd = useCallback(
    (pathIndices: Set<number>, scaleX: number, scaleY: number, _center: Point) => {
      if (!parsedSvg) return

      // Apply final scale to all selected paths
      const newPaths = [...parsedSvg.paths]
      for (const idx of pathIndices) {
        const originalCommands = originalCommandsForResizeRef.current.get(idx)
        if (originalCommands) {
          // Use the unified center for consistent scaling
          const scaledCommands = scalePathCommands(originalCommands, scaleX, scaleY, resizeUnifiedCenterRef.current!)

          newPaths[idx] = {
            ...newPaths[idx],
            commands: scaledCommands,
          }
        }
      }

      setParsedSvg({ ...parsedSvg, paths: newPaths })
      pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Clear original commands for next resize operation
      originalCommandsForResizeRef.current.clear()
      resizeUnifiedCenterRef.current = null
    },
    [parsedSvg, pushToHistory, overlayStateManager.overlayState, effectsManager.defs, pathStyles]
  )

  // Get selected path colors
  const selectedPath = selectedPathIndex !== null ? parsedSvg?.paths[selectedPathIndex] : null
  const selectedStrokeColor = selectedPath?.stroke ?? null
  const selectedStrokeWidth = selectedPath?.strokeWidth ?? null

  // Helper to update path style (supports subpath styling when nodes are selected)
  // Defined early because handleFillColorChange and handleStrokeColorChange depend on it
  // Applies to all selected paths when multiple paths are selected
  // Set commitToHistory=false for live preview during slider drag, then call with true on release
  const updatePathStyle = useCallback(
    (updates: Partial<ParsedPathExtended['style']>, commitToHistory = true) => {
      if (selectedPathIndex === null || !parsedSvg) return

      // Get all path indices to update
      const pathIndicesToUpdate = selectedPathIndices.size > 1 ? Array.from(selectedPathIndices) : [selectedPathIndex]

      // Calculate new styles first so we can push to history
      const newStyles = new Map(pathStyles)

      for (const pathIndex of pathIndicesToUpdate) {
        // Get the original path's fillRule to preserve it when creating default style
        const originalPath = parsedSvg.paths[pathIndex]

        const currentStyle: PathStyleWithSubpaths = newStyles.get(pathIndex) || {
          fill: stringToPaint(originalPath?.fill || 'none'),
          fillRule: originalPath?.fillRule, // Preserve fillRule for holes/compound paths
          opacity: 1,
          mixBlendMode: 'normal' as BlendMode,
        }

        // Apply at path level if:
        // 1. Multiple paths selected (no subpath styling for multi-path), OR
        // 2. No nodes selected (activeSegment is null), OR
        // 3. All nodes are selected (allNodesSelected is true)
        // Only apply subpath styling for single path with partial node selection
        const shouldApplyToSubpath
          = selectedPathIndices.size === 1 && activeSegment && !allNodesSelected && pathIndex === selectedPathIndex

        if (shouldApplyToSubpath) {
          // Apply to subpath only - store as override
          const subpathStyles = new Map(currentStyle.subpathStyles || new Map())
          const currentOverride = subpathStyles.get(activeSegment.startIndex) || {}

          // Convert full style updates to subpath override format
          const overrideUpdates = convertToSubpathOverride(updates)

          subpathStyles.set(activeSegment.startIndex, {
            ...currentOverride,
            ...overrideUpdates,
          })

          newStyles.set(pathIndex, { ...currentStyle, subpathStyles })
        } else {
          // Apply to entire path (multi-path, no nodes selected, or all nodes selected)
          newStyles.set(pathIndex, { ...currentStyle, ...updates })
        }
      }

      // Update state
      setPathStyles(newStyles)

      // Only push to history if commitToHistory is true (e.g., on mouse release, not during drag)
      if (commitToHistory) {
        pushToHistory(parsedSvg.paths, overlayStateManager.overlayState, newStyles, effectsManager.defs)
      }
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      pathStyles,
      activeSegment,
      allNodesSelected,
      pushToHistory,
      overlayStateManager.overlayState,
      effectsManager.defs,
    ]
  )

  // Handle fill color change (applies to all selected paths)
  const handleFillColorChange = useCallback(
    (color: string) => {
      if (selectedPathIndex === null || !parsedSvg) return

      const updatedPaths = [...parsedSvg.paths]

      // Apply to all selected paths
      const pathIndicesToUpdate = selectedPathIndices.size > 1 ? Array.from(selectedPathIndices) : [selectedPathIndex]

      for (const pathIndex of pathIndicesToUpdate) {
        updatedPaths[pathIndex] = {
          ...updatedPaths[pathIndex],
          fill: color,
        }
      }

      setParsedSvg({ ...parsedSvg, paths: updatedPaths })
      pushToHistory(updatedPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Update pathStyles for all selected paths
      setPathStyles(prev => {
        const newStyles = new Map(prev)
        for (const pathIndex of pathIndicesToUpdate) {
          const originalPath = parsedSvg.paths[pathIndex]
          const currentStyle = newStyles.get(pathIndex) || {
            fill: stringToPaint(originalPath?.fill || 'none'),
            fillRule: originalPath?.fillRule,
            opacity: 1,
            mixBlendMode: 'normal' as BlendMode,
          }
          newStyles.set(pathIndex, {
            ...currentStyle,
            fill: color === 'none' ? createNonePaint() : createSolidPaint(color),
          })
        }
        return newStyles
      })
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      pushToHistory,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // Handle stroke color change (including 'none' to remove stroke, applies to all selected paths)
  const handleStrokeColorChange = useCallback(
    (color: string) => {
      if (selectedPathIndex === null || !parsedSvg) return

      const updatedPaths = [...parsedSvg.paths]

      // Apply to all selected paths
      const pathIndicesToUpdate = selectedPathIndices.size > 1 ? Array.from(selectedPathIndices) : [selectedPathIndex]

      for (const pathIndex of pathIndicesToUpdate) {
        const currentPath = updatedPaths[pathIndex]

        // Handle stroke removal
        if (color === 'none') {
          updatedPaths[pathIndex] = {
            ...currentPath,
            stroke: undefined,
            strokeWidth: undefined,
          }
        } else {
          updatedPaths[pathIndex] = {
            ...currentPath,
            stroke: color,
            // Set default stroke width if enabling stroke
            strokeWidth: !currentPath.strokeWidth ? 1 : currentPath.strokeWidth,
          }
        }
      }

      setParsedSvg({ ...parsedSvg, paths: updatedPaths })
      pushToHistory(updatedPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Update pathStyles for all selected paths
      setPathStyles(prev => {
        const newStyles = new Map(prev)
        for (const pathIndex of pathIndicesToUpdate) {
          const originalPath = parsedSvg.paths[pathIndex]
          const currentStyle = newStyles.get(pathIndex) || {
            fill: stringToPaint(originalPath?.fill || 'none'),
            fillRule: originalPath?.fillRule,
            opacity: 1,
            mixBlendMode: 'normal' as BlendMode,
          }
          if (color === 'none') {
            newStyles.set(pathIndex, { ...currentStyle, stroke: createNonePaint(), strokeWidth: undefined })
          } else {
            newStyles.set(pathIndex, {
              ...currentStyle,
              stroke: createSolidPaint(color),
              strokeWidth: originalPath.strokeWidth || 1,
            })
          }
        }
        return newStyles
      })
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      pushToHistory,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // Handle stroke width change (applies to all selected paths)
  // Uses functional update to avoid stale closure issues when called immediately after handleStrokeColorChange
  const handleStrokeWidthChange = useCallback(
    (width: number) => {
      if (selectedPathIndex === null) return

      // Apply to all selected paths
      const pathIndicesToUpdate = selectedPathIndices.size > 1 ? Array.from(selectedPathIndices) : [selectedPathIndex]

      // Use functional update to get the latest parsedSvg state
      // This prevents overwriting stroke color when width change is called right after color change
      setParsedSvg(currentParsedSvg => {
        if (!currentParsedSvg) return currentParsedSvg

        const updatedPaths = [...currentParsedSvg.paths]

        for (const pathIndex of pathIndicesToUpdate) {
          updatedPaths[pathIndex] = {
            ...updatedPaths[pathIndex],
            strokeWidth: width,
          }
        }

        // Push to history with the new paths
        pushToHistory(updatedPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

        return { ...currentParsedSvg, paths: updatedPaths }
      })

      // Update pathStyles for immediate visual feedback
      // Also uses functional update to get latest pathStyles
      setPathStyles(prev => {
        const newStyles = new Map(prev)
        for (const pathIndex of pathIndicesToUpdate) {
          const currentStyle = newStyles.get(pathIndex)
          if (currentStyle) {
            newStyles.set(pathIndex, { ...currentStyle, strokeWidth: width })
          } else {
            // If no existing style, we need to read from the latest parsedSvg
            // Since we're in a functional update, we can't access parsedSvg directly
            // The style will be created properly when the path is next accessed
            newStyles.set(pathIndex, {
              fill: { type: 'none' },
              strokeWidth: width,
              opacity: 1,
              mixBlendMode: 'normal' as BlendMode,
            })
          }
        }
        return newStyles
      })
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      pushToHistory,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // Handle fill rule change (for creating holes with evenodd, applies to all selected paths)
  const handleFillRuleChange = useCallback(
    (fillRule: 'nonzero' | 'evenodd') => {
      if (selectedPathIndex === null || !parsedSvg) return

      const updatedPaths = [...parsedSvg.paths]

      // Apply to all selected paths
      const pathIndicesToUpdate = selectedPathIndices.size > 1 ? Array.from(selectedPathIndices) : [selectedPathIndex]

      for (const pathIndex of pathIndicesToUpdate) {
        updatedPaths[pathIndex] = {
          ...updatedPaths[pathIndex],
          fillRule,
        }
      }

      setParsedSvg({ ...parsedSvg, paths: updatedPaths })
      pushToHistory(updatedPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

      // Also update pathStyles for all selected paths - create entry if none exists
      setPathStyles(prev => {
        const newStyles = new Map(prev)

        for (const pathIndex of pathIndicesToUpdate) {
          const currentStyle = newStyles.get(pathIndex)
          const originalPath = parsedSvg.paths[pathIndex]

          // Create default style if none exists, or update existing
          const baseStyle = currentStyle || {
            fill: stringToPaint(originalPath?.fill || 'none'),
            stroke: originalPath?.stroke ? stringToPaint(originalPath.stroke) : undefined,
            strokeWidth: originalPath?.strokeWidth,
            opacity: 1,
            mixBlendMode: 'normal' as BlendMode,
          }

          newStyles.set(pathIndex, { ...baseStyle, fillRule })
        }

        return newStyles
      })
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      pushToHistory,
      overlayStateManager.overlayState,
      effectsManager.defs,
      pathStyles,
    ]
  )

  // =============================================================================
  // Effects Callbacks
  // =============================================================================

  // Gradient callbacks
  const handleGradientCreate = useCallback(
    (gradient: GradientDef) => {
      effectsManager.createGradient(gradient)
    },
    [effectsManager]
  )

  const handleGradientUpdate = useCallback(
    (id: string, updates: Partial<GradientDef>) => {
      effectsManager.updateGradient(id, updates)
    },
    [effectsManager]
  )

  const handleGradientDelete = useCallback(
    (id: string) => {
      effectsManager.deleteGradient(id)
    },
    [effectsManager]
  )

  const handleFillGradientApply = useCallback(
    (gradientId: string) => {
      const fillUpdate = effectsManager.applyFillGradient(gradientId)
      updatePathStyle(fillUpdate)
    },
    [effectsManager, updatePathStyle]
  )

  // Filter callbacks
  const handleFilterCreate = useCallback(
    (filter: FilterDef) => {
      effectsManager.createFilter(filter)
    },
    [effectsManager]
  )

  const handleFilterUpdate = useCallback(
    (id: string, updates: Partial<FilterDef>) => {
      effectsManager.updateFilter(id, updates)
    },
    [effectsManager]
  )

  const handleFilterDelete = useCallback(
    (id: string) => {
      effectsManager.deleteFilter(id)
    },
    [effectsManager]
  )

  const handleFilterApply = useCallback(
    (filterId: string | null) => {
      const filterUpdate = effectsManager.applyFilter(filterId)
      updatePathStyle(filterUpdate)
    },
    [effectsManager, updatePathStyle]
  )

  // Apply filter to ALL paths (used when no path is selected but paths exist)
  const handleFilterApplyToAll = useCallback(
    (filterId: string | null) => {
      if (!parsedSvg || parsedSvg.paths.length === 0) return

      const filterUpdate = effectsManager.applyFilter(filterId)
      const newStyles = new Map(pathStyles)

      // Apply to every path in the SVG
      for (let pathIndex = 0; pathIndex < parsedSvg.paths.length; pathIndex++) {
        const originalPath = parsedSvg.paths[pathIndex]
        const currentStyle: PathStyleWithSubpaths = newStyles.get(pathIndex) || {
          fill: stringToPaint(originalPath?.fill || 'none'),
          fillRule: originalPath?.fillRule,
          opacity: 1,
          mixBlendMode: 'normal' as BlendMode,
        }
        newStyles.set(pathIndex, { ...currentStyle, ...filterUpdate })
      }

      setPathStyles(newStyles)
      pushToHistory(parsedSvg.paths, overlayStateManager.overlayState, newStyles, effectsManager.defs)
    },
    [parsedSvg, pathStyles, effectsManager, pushToHistory, overlayStateManager.overlayState]
  )

  // Color correction callbacks
  // commitToHistory: set to false during slider drag for live preview, true on release
  const handleColorAdjustmentsChange = useCallback(
    (adjustments: ColorAdjustments, commitToHistory = true) => {
      const result = effectsManager.applyColorAdjustments(adjustments)
      updatePathStyle(result, commitToHistory)
    },
    [effectsManager, updatePathStyle]
  )

  // Blend mode callback
  // commitToHistory: set to false during slider drag for live preview, true on release
  const handleBlendModeChange = useCallback(
    (blendMode: BlendMode, commitToHistory = true) => {
      const blendUpdate = effectsManager.applyBlendMode(blendMode)
      updatePathStyle(blendUpdate, commitToHistory)
    },
    [effectsManager, updatePathStyle]
  )

  // Opacity callback
  // commitToHistory: set to false during slider drag for live preview, true on release
  const handleOpacityChange = useCallback(
    (opacity: number, commitToHistory = true) => {
      const opacityUpdate = effectsManager.applyOpacity(opacity)
      updatePathStyle(opacityUpdate, commitToHistory)
    },
    [effectsManager, updatePathStyle]
  )

  // Reset all adjustments (color adjustments, opacity, blend mode) in a single update
  // This avoids the stale closure issue when calling multiple updatePathStyle in sequence
  const handleResetAdjustments = useCallback(() => {
    const colorAdjustmentsUpdate = effectsManager.applyColorAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hueRotate: 0,
      invert: 0,
      sepia: 0,
      grayscale: 0,
      opacity: 1,
    })
    const opacityUpdate = effectsManager.applyOpacity(1)
    const blendModeUpdate = effectsManager.applyBlendMode('normal')
    // Combine all updates into a single call to updatePathStyle
    updatePathStyle({ ...colorAdjustmentsUpdate, ...opacityUpdate, ...blendModeUpdate }, true)
  }, [effectsManager, updatePathStyle])

  // Select all: paths when no path selected, nodes when a path is selected
  const handleSelectAllNodes = useCallback(() => {
    if (!parsedSvg || parsedSvg.paths.length === 0) return

    // If no path selected, select all paths
    if (selectedPathIndex === null) {
      const allPathIndices = new Set<number>(parsedSvg.paths.map((_, index) => index))
      setSelectedPathIndices(allPathIndices)
      return
    }

    // If a path is selected, select all nodes in that path
    const path = parsedSvg.paths[selectedPathIndex]
    const allNodeIndices = new Set<number>()

    path.commands.forEach((cmd, index) => {
      if (cmd.type.toUpperCase() !== 'Z') {
        allNodeIndices.add(index)
      }
    })

    setSelectedNodeIndices(allNodeIndices)
  }, [selectedPathIndex, parsedSvg, setSelectedPathIndices])

  // Invert selection: paths when no nodes selected, nodes when nodes are selected
  const handleInvertSelection = useCallback(() => {
    if (!parsedSvg) return

    // If no path is selected, invert all paths (select all that aren't selected)
    if (selectedPathIndex === null) {
      const allPathIndices = new Set<number>(parsedSvg.paths.map((_, index) => index))
      const invertedPathIndices = new Set<number>()
      allPathIndices.forEach(index => {
        if (!selectedPathIndices.has(index)) {
          invertedPathIndices.add(index)
        }
      })
      setSelectedPathIndices(invertedPathIndices)
      return
    }

    // If a path is selected but no nodes are selected, invert path selection
    if (selectedNodeIndices.size === 0) {
      const allPathIndices = new Set<number>(parsedSvg.paths.map((_, index) => index))
      const invertedPathIndices = new Set<number>()
      allPathIndices.forEach(index => {
        if (!selectedPathIndices.has(index)) {
          invertedPathIndices.add(index)
        }
      })
      setSelectedPathIndices(invertedPathIndices)
      return
    }

    // If nodes are selected, invert node selection on current path
    const path = parsedSvg.paths[selectedPathIndex]
    const allNodeIndices = new Set<number>()

    // Get all non-Z node indices
    path.commands.forEach((cmd, index) => {
      if (cmd.type.toUpperCase() !== 'Z') {
        allNodeIndices.add(index)
      }
    })

    // Invert: select nodes not currently selected
    const invertedIndices = new Set<number>()
    allNodeIndices.forEach(index => {
      if (!selectedNodeIndices.has(index)) {
        invertedIndices.add(index)
      }
    })

    // Set the inverted selection
    setSelectedNodeIndices(invertedIndices)
  }, [selectedPathIndex, parsedSvg, selectedNodeIndices, selectedPathIndices, setSelectedPathIndices])

  // Helper to group indices into contiguous runs
  const groupIntoRuns = useCallback((indices: Set<number>): number[][] => {
    const sorted = Array.from(indices).sort((a, b) => a - b)
    if (sorted.length === 0) return []

    const runs: number[][] = []
    let currentRun: number[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        currentRun.push(sorted[i])
      } else {
        runs.push(currentRun)
        currentRun = [sorted[i]]
      }
    }
    runs.push(currentRun)
    return runs
  }, [])

  // Check if copy/cut operation is valid
  // - Path-level: one or more paths selected (no node selection required)
  // - Node-level: contiguous segments with ≥2 nodes each, or entire path selected
  const canCopy = useMemo(() => {
    if (!parsedSvg) return false

    // Path-level copy: allow when paths are selected (even without node selection)
    if (selectedPathIndices.size > 0 && selectedNodeIndices.size === 0) {
      // Check that all selected paths exist and have at least 2 nodes
      return [...selectedPathIndices].every(idx => {
        const path = parsedSvg.paths[idx]
        if (!path) return false
        const nodeCount = path.commands.filter(cmd => cmd.type.toUpperCase() !== 'Z').length
        return nodeCount >= 2
      })
    }

    // Node-level copy: requires a selected path with node selection
    if (selectedPathIndex === null) return false

    const path = parsedSvg.paths[selectedPathIndex]
    if (!path) return false

    // Allow copy when entire path is selected
    const nodeCount = path.commands.filter(cmd => cmd.type.toUpperCase() !== 'Z').length
    const isEntirePathSelected = selectedNodeIndices.size === nodeCount
    if (isEntirePathSelected && nodeCount >= 2) return true

    // Otherwise, check for contiguous segments (each segment ≥2 nodes)
    if (selectedNodeIndices.size < 2) return false

    const runs = groupIntoRuns(selectedNodeIndices)

    // Each run must have at least 2 nodes to be a valid segment
    return runs.every(run => run.length >= 2)
  }, [parsedSvg, selectedPathIndex, selectedPathIndices, selectedNodeIndices, groupIntoRuns])

  // =============================================================================
  // Copy/Cut/Paste Handlers
  // =============================================================================

  // Core copy function that accepts action type for paste positioning
  // Supports both path-level copy (entire paths) and node-level copy (segments within a path)
  const handleCopyToClipboard = useCallback(
    async (action: 'copy' | 'cut'): Promise<boolean> => {
      if (!parsedSvg) return false

      const clipboardData: VectorEditorClipboardData = {
        __vectorEditorClipboard__: true,
        version: 2,
        action,
        gradients: [],
        filters: [],
      }

      // Determine copy mode: path-level or node-level
      const isPathLevelCopy = selectedPathIndices.size > 0 && selectedNodeIndices.size === 0

      if (isPathLevelCopy) {
        // Path-level copy: copy entire selected paths
        clipboardData.type = 'paths'
        clipboardData.paths = []

        const sortedIndices = [...selectedPathIndices].sort((a, b) => a - b)
        const addedGradientIds = new Set<string>()
        const addedFilterIds = new Set<string>()

        for (const pathIdx of sortedIndices) {
          const path = parsedSvg.paths[pathIdx]
          if (!path) continue

          const pathStyle = pathStyles.get(pathIdx)

          // Add path to clipboard (including filterId if present)
          clipboardData.paths.push({
            commands: JSON.parse(JSON.stringify(path.commands)),
            style: {
              fill: path.fill || 'none',
              stroke: path.stroke,
              strokeWidth: path.strokeWidth,
              fillRule: path.fillRule,
              filterId: pathStyle?.filterId,
            },
          })

          // Collect gradients used by this path
          if (pathStyle?.fill?.type === 'gradient' && !addedGradientIds.has(pathStyle.fill.gradientId)) {
            const grad = effectsManager.defs.gradients.get(pathStyle.fill.gradientId)
            if (grad) {
              clipboardData.gradients!.push(grad)
              addedGradientIds.add(pathStyle.fill.gradientId)
            }
          }
          if (pathStyle?.stroke?.type === 'gradient' && !addedGradientIds.has(pathStyle.stroke.gradientId)) {
            const grad = effectsManager.defs.gradients.get(pathStyle.stroke.gradientId)
            if (grad) {
              clipboardData.gradients!.push(grad)
              addedGradientIds.add(pathStyle.stroke.gradientId)
            }
          }

          // Collect filter used by this path
          if (pathStyle?.filterId && !addedFilterIds.has(pathStyle.filterId)) {
            const filter = effectsManager.defs.filters.get(pathStyle.filterId)
            if (filter) {
              clipboardData.filters!.push(filter)
              addedFilterIds.add(pathStyle.filterId)
            }
          }
        }

        if (clipboardData.paths.length === 0) return false
      } else {
        // Node-level copy: copy selected segments within a single path
        if (selectedPathIndex === null || selectedNodeIndices.size === 0) return false

        const path = parsedSvg.paths[selectedPathIndex]
        if (!path) return false

        clipboardData.type = 'nodes'

        // Group selected nodes into contiguous runs (segments)
        const runs = groupIntoRuns(selectedNodeIndices)

        // Extract commands for each segment, preserving Z commands for closed segments
        const segments: PathCommand[][] = runs.map(run => {
          const segmentCommands: PathCommand[] = run.map((idx, i) => {
            const cmd = path.commands[idx]
            // First command of each segment becomes M
            if (i === 0) {
              return { type: 'M' as const, x: cmd.x, y: cmd.y }
            }
            return { ...cmd }
          })

          // Check if segment is closed (next command after last selected node is Z)
          const lastSelectedIdx = run[run.length - 1]
          const nextCmd = path.commands[lastSelectedIdx + 1]
          if (nextCmd && nextCmd.type.toUpperCase() === 'Z') {
            // Find the start of this subpath to get proper Z coordinates
            let subpathStartIdx = run[0]
            for (let i = run[0] - 1; i >= 0; i--) {
              if (path.commands[i].type.toUpperCase() === 'M') {
                subpathStartIdx = i
                break
              }
            }
            const startCmd = path.commands[subpathStartIdx]
            segmentCommands.push({ type: 'Z' as const, x: startCmd.x, y: startCmd.y })
          }

          return segmentCommands
        })

        // Handle gradient and filter cloning for clipboard
        const pathStyle = pathStyles.get(selectedPathIndex)

        clipboardData.segments = segments
        clipboardData.style = {
          fill: path.fill || 'none',
          stroke: path.stroke,
          strokeWidth: path.strokeWidth,
          fillRule: path.fillRule,
          filterId: pathStyle?.filterId,
        }

        if (pathStyle?.fill?.type === 'gradient') {
          const grad = effectsManager.defs.gradients.get(pathStyle.fill.gradientId)
          if (grad) clipboardData.gradients!.push(grad)
        }
        if (pathStyle?.stroke?.type === 'gradient') {
          const grad = effectsManager.defs.gradients.get(pathStyle.stroke.gradientId)
          if (grad) clipboardData.gradients!.push(grad)
        }
        // Copy filter definition if present
        if (pathStyle?.filterId) {
          const filter = effectsManager.defs.filters.get(pathStyle.filterId)
          if (filter) clipboardData.filters!.push(filter)
        }
      }

      try {
        await navigator.clipboard.writeText(JSON.stringify(clipboardData))
        return true
      } catch {
        console.error('Clipboard write failed - permissions may be disabled')
        return false
      }
    },
    [parsedSvg, selectedPathIndex, selectedPathIndices, selectedNodeIndices, pathStyles, effectsManager, groupIntoRuns]
  )

  // Copy handler for keyboard shortcut
  const handleCopy = useCallback(async () => {
    const isPathLevelCopy = selectedPathIndices.size > 0 && selectedNodeIndices.size === 0
    const success = await handleCopyToClipboard('copy')
    if (success) {
      if (isPathLevelCopy) {
        console.log(`Copied ${selectedPathIndices.size} path(s)`)
      } else {
        console.log(`Copied ${selectedNodeIndices.size} node(s)`)
      }
    }
  }, [handleCopyToClipboard, selectedNodeIndices, selectedPathIndices])

  // Cut handler - combines copy (with 'cut' action) + delete
  const handleCut = useCallback(async () => {
    if (!parsedSvg) return

    const isPathLevelCut = selectedPathIndices.size > 0 && selectedNodeIndices.size === 0

    // For path-level cut, we need paths selected; for node-level cut, we need nodes selected
    if (!isPathLevelCut && (selectedPathIndex === null || selectedNodeIndices.size === 0)) return

    const count = isPathLevelCut ? selectedPathIndices.size : selectedNodeIndices.size
    const success = await handleCopyToClipboard('cut')
    if (success) {
      handleDeleteSelected()
      if (isPathLevelCut) {
        console.log(`Cut ${count} path(s)`)
      } else {
        console.log(`Cut ${count} node(s)`)
      }
    }
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedPathIndices,
    selectedNodeIndices,
    handleCopyToClipboard,
    handleDeleteSelected,
  ])

  // Paste handler - supports internal VectorEditor format (nodes/paths) and external SVG
  const handlePaste = useCallback(async () => {
    if (!parsedSvg) return

    try {
      const text = await navigator.clipboard.readText()

      // Try VectorEditor internal format first
      let internalData: VectorEditorClipboardData | null = null
      try {
        const parsed = JSON.parse(text) as VectorEditorClipboardData
        // Accept both path-level (paths) and node-level (segments) clipboard data
        if (parsed?.__vectorEditorClipboard__ && (parsed.paths?.length || parsed.segments?.length)) {
          internalData = parsed
        }
      } catch {
        // Not JSON, will try external SVG
      }

      if (internalData) {
        // Check if this is path-level paste (version 2 with paths array)
        if (internalData.type === 'paths' && internalData.paths?.length) {
          // Path-level paste: add complete paths
          const gradientIdMap = new Map<string, string>()
          const filterIdMap = new Map<string, string>()

          // Clone gradients with new IDs first
          if (internalData.gradients?.length) {
            for (const grad of internalData.gradients) {
              const newId = generateDefId('grad', effectsManager.defs)
              const cloned = { ...grad, id: newId }
              effectsManager.createGradient(cloned as GradientDef)
              gradientIdMap.set(grad.id, newId)
            }
          }

          // Clone filters with new IDs
          if (internalData.filters?.length) {
            for (const filter of internalData.filters) {
              const newId = generateDefId('filter', effectsManager.defs)
              const cloned = { ...filter, id: newId }
              effectsManager.createFilter(cloned)
              filterIdMap.set(filter.id, newId)
            }
          }

          const newParsedPaths: ParsedPath[] = []
          const newPathStyleEntries: [number, PathStyleWithSubpaths][] = []
          const firstNewPathIndex = parsedSvg.paths.length

          for (let i = 0; i < internalData.paths.length; i++) {
            const clipPath = internalData.paths[i]
            let fill = clipPath.style.fill
            let stroke = clipPath.style.stroke
            const pathStyleOverrides: Partial<PathStyleWithSubpaths> = {}

            // Update gradient references if any
            for (const [oldId, newId] of gradientIdMap.entries()) {
              if (fill?.includes(oldId)) {
                fill = `url(#${newId})`
                pathStyleOverrides.fill = { type: 'gradient', gradientId: newId }
              }
              if (stroke?.includes(oldId)) {
                stroke = `url(#${newId})`
                pathStyleOverrides.stroke = { type: 'gradient', gradientId: newId }
              }
            }

            // Update filter reference if present
            if (clipPath.style.filterId) {
              const newFilterId = filterIdMap.get(clipPath.style.filterId)
              if (newFilterId) {
                pathStyleOverrides.filterId = newFilterId
              }
            }

            // Create the new path
            newParsedPaths.push({
              commands: JSON.parse(JSON.stringify(clipPath.commands)),
              fill: fill || 'none',
              stroke,
              strokeWidth: clipPath.style.strokeWidth,
              fillRule: clipPath.style.fillRule,
            })

            // Store style for this path
            newPathStyleEntries.push([
              firstNewPathIndex + i,
              {
                fill: stringToPaint(fill || 'none'),
                stroke: stroke ? stringToPaint(stroke) : undefined,
                strokeWidth: clipPath.style.strokeWidth,
                fillRule: clipPath.style.fillRule,
                opacity: 1,
                mixBlendMode: 'normal' as BlendMode,
                ...pathStyleOverrides,
              },
            ])
          }

          const newPaths = [...parsedSvg.paths, ...newParsedPaths]

          // Update pathStyles for all new paths
          setPathStyles(prev => {
            const newStyles = new Map(prev)
            for (const [idx, style] of newPathStyleEntries) {
              newStyles.set(idx, style)
            }
            return newStyles
          })

          setParsedSvg({ ...parsedSvg, paths: newPaths })
          pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

          // Select all new paths
          const newPathIndices = new Set(newPathStyleEntries.map(([idx]) => idx))
          setSelectedPathIndices(newPathIndices)
          setSelectedNodeIndices(new Set())

          console.log(`Pasted ${internalData.paths.length} path(s) from internal clipboard`)
          return
        }

        // Node-level paste (version 1 or version 2 with type='nodes')
        if (internalData.segments?.length && internalData.style) {
          const allCommands: PathCommand[] = []
          let totalNodes = 0

          for (const segment of internalData.segments) {
            for (const cmd of segment) {
              if (cmd.type.toUpperCase() === 'Z') {
                allCommands.push({ ...cmd })
              } else {
                allCommands.push({ ...cmd })
                totalNodes++
              }
            }
          }

          // Clone gradients with new IDs
          let fill = internalData.style.fill
          let stroke = internalData.style.stroke
          const newPathStyle: Partial<PathStyleWithSubpaths> = {}

          if (internalData.gradients?.length) {
            for (const grad of internalData.gradients) {
              const newId = generateDefId('grad', effectsManager.defs)
              const cloned = { ...grad, id: newId }
              effectsManager.createGradient(cloned as GradientDef)

              if (fill?.includes(grad.id)) {
                fill = `url(#${newId})`
                newPathStyle.fill = { type: 'gradient', gradientId: newId }
              }
              if (stroke?.includes(grad.id)) {
                stroke = `url(#${newId})`
                newPathStyle.stroke = { type: 'gradient', gradientId: newId }
              }
            }
          }

          // Clone filter with new ID if present
          if (internalData.filters?.length && internalData.style.filterId) {
            const originalFilter = internalData.filters.find(f => f.id === internalData!.style!.filterId)
            if (originalFilter) {
              const newFilterId = generateDefId('filter', effectsManager.defs)
              const clonedFilter = { ...originalFilter, id: newFilterId }
              effectsManager.createFilter(clonedFilter)
              newPathStyle.filterId = newFilterId
            }
          }

          // Create a single new path with all subpaths
          const newPath: ParsedPath = {
            commands: allCommands,
            fill: fill || 'none',
            stroke,
            strokeWidth: internalData.style.strokeWidth,
            fillRule: internalData.style.fillRule,
          }

          const newPaths = [...parsedSvg.paths, newPath]
          const newPathIndex = newPaths.length - 1

          // Update pathStyles for the new path
          setPathStyles(prev => {
            const newStyles = new Map(prev)
            newStyles.set(newPathIndex, {
              fill: stringToPaint(fill || 'none'),
              stroke: stroke ? stringToPaint(stroke) : undefined,
              strokeWidth: internalData!.style!.strokeWidth,
              fillRule: internalData!.style!.fillRule,
              opacity: 1,
              mixBlendMode: 'normal' as BlendMode,
              ...newPathStyle,
            })
            return newStyles
          })

          setParsedSvg({ ...parsedSvg, paths: newPaths })
          pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

          // Select the new path
          setSelectedPathIndices(new Set([newPathIndex]))
          setSelectedNodeIndices(new Set())

          console.log(`Pasted ${totalNodes} node(s) from internal clipboard`)
          return
        }
      }

      // Try external SVG format
      const svgString = detectAndDecodeSvg(text)
      if (svgString) {
        const externalSvg = parseSvgString(svgString)
        if (externalSvg.paths.length > 0) {
          // Calculate scale factor (shrink only, not enlarge) and transform paths
          const scaleFactor = calculateFitScale(externalSvg.viewBox, parsedSvg.viewBox)
          const transformedPaths = transformPathsToFitCanvas(
            externalSvg.paths,
            externalSvg.viewBox,
            parsedSvg.viewBox,
            scaleFactor
          )

          // Add all transformed paths to the editor
          const newPaths = [...parsedSvg.paths, ...transformedPaths]
          const firstNewPathIndex = parsedSvg.paths.length

          // Update pathStyles for each new path
          setPathStyles(prev => {
            const newStyles = new Map(prev)
            transformedPaths.forEach((path, i) => {
              const pathIndex = firstNewPathIndex + i
              newStyles.set(pathIndex, {
                fill: stringToPaint(path.fill || 'none'),
                stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
                strokeWidth: path.strokeWidth,
                fillRule: path.fillRule,
                opacity: 1,
                mixBlendMode: 'normal' as BlendMode,
              })
            })
            return newStyles
          })

          setParsedSvg({ ...parsedSvg, paths: newPaths })
          pushToHistory(newPaths, overlayStateManager.overlayState, pathStyles, effectsManager.defs)

          // Select the first new path
          setSelectedPathIndices(new Set([firstNewPathIndex]))
          setSelectedNodeIndices(new Set())
          setSelectedNodeIndices(new Set())

          console.log(`Pasted ${transformedPaths.length} path(s) from external SVG`)
          return
        }
      }
    } catch {
      // Invalid clipboard data - silently ignore
    }
  }, [
    parsedSvg,
    pushToHistory,
    effectsManager,
    setSelectedPathIndices,
    setSelectedNodeIndices,
    detectAndDecodeSvg,
    calculateFitScale,
    transformPathsToFitCanvas,
    overlayStateManager.overlayState,
    pathStyles,
  ])

  // Undo handler — routes to drawing-level undo when actively drawing, otherwise editor-level
  const handleUndo = useCallback(() => {
    if (editorMode === 'draw' && drawing.isDrawing) {
      drawing.handleUndo()
      return
    }

    const historyState = undo()
    if (historyState && parsedSvg) {
      setParsedSvg({ ...parsedSvg, paths: historyState.paths })
      overlayStateManager.restoreState(historyState.overlayState)
      setPathStyles(historyState.pathStyles)
      effectsManager.setDefs(historyState.defs)

      // Validate selectedPathIndex after undo - clear if now out of bounds
      if (selectedPathIndex !== null && selectedPathIndex >= historyState.paths.length) {
        setSelectedPathIndices(new Set())
        setSelectedNodeIndices(new Set())
      }

      // Auto-close Adjustments panel if undo removes the adjustment mask for selected path
      if (
        activeSidebarSection === 'adjustments'
        && selectedPathIndex !== null
        && !historyState.overlayState.adjustmentMasks.some(m => m.pathIndex === selectedPathIndex)
      ) {
        setActiveSidebarSection(null)
      }
    }
  }, [
    editorMode,
    drawing,
    undo,
    parsedSvg,
    selectedPathIndex,
    setSelectedPathIndices,
    setSelectedNodeIndices,
    overlayStateManager,
    effectsManager,
    activeSidebarSection,
  ])

  // Redo handler — routes to drawing-level redo when actively drawing, otherwise editor-level
  const handleRedo = useCallback(() => {
    if (editorMode === 'draw' && drawing.isDrawing) {
      drawing.handleRedo()
      return
    }

    // Capture current state before redo to detect adjustment mask creation
    const wasAdjustmentMask = selectedPathIndex !== null && overlayStateManager.isAdjustmentMask(selectedPathIndex)

    const historyState = redo()
    if (historyState && parsedSvg) {
      setParsedSvg({ ...parsedSvg, paths: historyState.paths })
      overlayStateManager.restoreState(historyState.overlayState)
      setPathStyles(historyState.pathStyles)
      effectsManager.setDefs(historyState.defs)

      // Validate selectedPathIndex after redo - clear if now out of bounds
      if (selectedPathIndex !== null && selectedPathIndex >= historyState.paths.length) {
        setSelectedPathIndices(new Set())
        setSelectedNodeIndices(new Set())
      }

      // Auto-open Adjustments panel if redo creates an adjustment mask for selected path
      const isNowAdjustmentMask
        = selectedPathIndex !== null
        && historyState.overlayState.adjustmentMasks.some(m => m.pathIndex === selectedPathIndex)

      if (isOverlayMode && !wasAdjustmentMask && isNowAdjustmentMask) {
        setActiveSidebarSection('adjustments')
      }
      // Auto-close Adjustments panel if redo removes the adjustment mask for selected path
      else if (activeSidebarSection === 'adjustments' && selectedPathIndex !== null && !isNowAdjustmentMask) {
        setActiveSidebarSection(null)
      }
    }
  }, [
    editorMode,
    drawing,
    redo,
    parsedSvg,
    selectedPathIndex,
    setSelectedPathIndices,
    setSelectedNodeIndices,
    overlayStateManager,
    effectsManager,
    activeSidebarSection,
    isOverlayMode,
  ])

  // Keyboard shortcuts
  // Exit extend mode handler (for keyboard shortcuts)
  const handleExitExtendMode = useCallback(() => {
    setIsExtendMode(false)
    setExtendFromNode(null)
  }, [])

  useKeyboardShortcuts({
    editorMode,
    drawingPath: drawing.drawingPath,
    canCopy,
    isExtendMode,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: handleDeleteSelected,
    onSetEditMode: () => setEditorMode('edit'),
    onSetDrawMode: () => {
      setEditorMode('draw')
      // Trigger auto-open draw sidebar on first draw mode activation via keyboard
      if (!hasShownDrawSidebarRef.current) {
        setShouldAutoOpenDrawSidebar(true)
      }
    },
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onFinishDrawing: handleFinishDrawing,
    onCancelDrawing: handleCancelDrawing,
    onSelectAllNodes: handleSelectAllNodes,
    onInvertSelection: handleInvertSelection,
    onToggleNewSubpath: handleToggleNewSubpath,
    onExitExtendMode: handleExitExtendMode,
  })

  // Upload SVG to Shopify CDN
  const uploadSvgToShopify = useCallback(async (svgDataUri: string): Promise<string | null> => {
    try {
      // Convert data URI to blob
      const response = await fetch(svgDataUri)
      const blob = await response.blob()

      // Create a File object from the blob
      const fileName = `vector-edit-${Date.now()}.svg`
      const file = new File([blob], fileName, { type: 'image/svg+xml' })

      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('files', file)
      formData.append('fileUploadType', 'image')

      // Upload using the templates API
      const uploadResponse = await fetch(`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`HTTP error! status: ${uploadResponse.status}`)
      }

      const result = await uploadResponse.json()

      if (!result.success) {
        throw new Error(`Upload failed: ${result.message || 'Unknown error'}`)
      }

      // Extract CDN URL from response
      const { data } = result
      if (data?.uploadedFiles?.length > 0) {
        const uploadedFile = data.uploadedFiles[0]
        return uploadedFile.image?.originalSrc || uploadedFile.url
      }

      return null
    } catch (error) {
      console.error('Error uploading SVG to Shopify:', error)
      return null
    }
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!parsedSvg) return

    // Track PROCESSED event (SVG rebuild)
    trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_PROCESSED, {
      is_modal: isModal,
      overlay_mode: isOverlayMode,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
    })

    // Build extended paths with styles (fill, stroke, filters, blend modes, etc.)
    const extendedPaths: ParsedPathExtended[] = parsedSvg.paths.map((path, idx) => {
      // Build transform string from pathRotation if present
      let transform: string | undefined
      if (path.pathRotation && path.pathRotation !== 0) {
        const center = path.pathRotationOrigin || calculatePathCenter(path.commands)
        transform = `rotate(${path.pathRotation} ${center.x} ${center.y})`
      }

      return {
        ...path,
        style: pathStyles.get(idx) || {
          fill: stringToPaint(path.fill || 'none'),
          fillRule: path.fillRule,
          stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
          strokeWidth: path.strokeWidth,
          opacity: 1,
          mixBlendMode: 'normal' as BlendMode,
        },
        transform,
      }
    })

    // Cleanup orphaned defs before serialization (removes filters/gradients no longer referenced by any path)
    const cleanedDefs = getCleanedDefs(effectsManager.defs, extendedPaths)

    // Handle overlay mode save (output OverlaySvgOutput instead of single data URI)
    if (isOverlayMode && onOverlaySave && imageInfo) {
      const overlayOutput = buildOverlaySvgOutput({
        paths: extendedPaths,
        defs: cleanedDefs,
        overlayState: overlayStateManager.overlayState,
        imageInfo,
      })
      onOverlaySave(overlayOutput)
      wasSavedRef.current = true
      // Note: Overlay output doesn't produce a single saved URL, store the original rasterImageUrl
      savedVectorUrlRef.current = rasterImageUrl || null
      trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_APPLIED, {
        is_modal: isModal,
        overlay_mode: true,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
      })
      onModalClose?.()
      return
    }

    // Build extended SVG with defs (gradients, filters, masks, clip paths)
    const extendedSvg: ParsedSvgExtended = {
      ...parsedSvg,
      paths: extendedPaths,
      defs: cleanedDefs,
    }

    // Compute effect groups for SVG-only mode clip/hole effects
    const effectGroups = calculateEffectGroups(
      extendedPaths.length,
      overlayStateManager.overlayState.clipPathIndices,
      overlayStateManager.overlayState.holePathIndices
    )

    // Rebuild SVG with effect groups and clip/hole path markers for round-trip preservation
    const svgStringOutput = rebuildSvgStringExtended(extendedSvg, {
      effectGroups,
      clipPathIndices: overlayStateManager.overlayState.clipPathIndices,
      holePathIndices: overlayStateManager.overlayState.holePathIndices,
    })
    const dataUri = encodeSvgToDataUri(svgStringOutput)

    if (uploadToShopify) {
      setIsUploading(true)
      try {
        // Upload to Shopify first, then call onSave with CDN URL
        const shopifyUrl = await uploadSvgToShopify(dataUri)
        const savedUrl = shopifyUrl || dataUri
        onSave?.(savedUrl) // Pass dimensions so caller knows actual SVG size
        // Track APPLIED event after successful save
        wasSavedRef.current = true
        // Only store CDN URL for tracking, not data URI
        savedVectorUrlRef.current = shopifyUrl || null
        trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_APPLIED, {
          is_modal: isModal,
          [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
          // Only include SAVED_VECTOR_URL if we have an actual CDN URL (not data URI)
          ...(shopifyUrl && { [EVENTS_PARAMETERS_NAME.SAVED_VECTOR_URL]: shopifyUrl }),
        })
        // Close modal after successful save
        onModalClose?.()
      } finally {
        setIsUploading(false)
      }
    } else {
      // Direct callback with data URI (no upload, so no CDN URL to track)
      onSave?.(dataUri)
      // Track APPLIED event after successful save
      wasSavedRef.current = true
      // Don't store data URI for tracking - only CDN URLs should be tracked
      savedVectorUrlRef.current = null
      trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_APPLIED, {
        is_modal: isModal,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
        // SAVED_VECTOR_URL intentionally omitted - no CDN URL available when uploadToShopify=false
      })
      // Close modal after save
      onModalClose?.()
    }
  }, [
    parsedSvg,
    pathStyles,
    effectsManager.defs,
    uploadToShopify,
    uploadSvgToShopify,
    onSave,
    onModalClose,
    trackEvent,
    isModal,
    isOverlayMode,
    onOverlaySave,
    imageInfo,
    overlayStateManager.overlayState,
    originalImageUrl,
    rasterImageUrl,
  ])

  // Cancel handler - reset all editing state when modal closes
  const handleCancel = useCallback(() => {
    trackEvent(EVENTS_TRACKING.VECTOR_EDITOR_CLOSED, {
      is_modal: isModal,
      was_saved: wasSavedRef.current,
      overlay_mode: isOverlayMode,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: originalImageUrl,
      // Only include SAVED_VECTOR_URL if we have a CDN URL (not null/data URI)
      ...(savedVectorUrlRef.current && { [EVENTS_PARAMETERS_NAME.SAVED_VECTOR_URL]: savedVectorUrlRef.current }),
    })
    wasSavedRef.current = false
    savedVectorUrlRef.current = null

    // Reset selection state
    setSelectedPathIndices(new Set())
    setSelectedNodeIndices(new Set())

    // Reset drawing state
    drawing.handleCancelDrawing()
    setIsStartingNewSubpath(false)

    // Reset extend mode
    setIsExtendMode(false)
    setExtendFromNode(null)

    // Reset predefined shape state
    setSelectedPredefinedShape(null)
    setShapeDragStart(null)
    setShapeDragCurrent(null)

    // Reset mobile modifiers
    setMobileInsertNodeMode(false)
    setMobileMultiSelectMode(false)
    setMobileSelectionRectMode(false)

    // Reset editor mode to initial
    setEditorMode(initialMode)

    // Reset overlay state on cancel
    if (isOverlayMode) {
      overlayStateManager.reset()
    }

    // Restore initial SVG state to discard unsaved changes
    if (initialParsedSvgRef.current) {
      setParsedSvg(JSON.parse(JSON.stringify(initialParsedSvgRef.current)))
    }
    setPathStyles(new Map(initialPathStylesRef.current))
    if (initialDefsRef.current) {
      effectsManager.setDefs(initialDefsRef.current)
    }
    // Reset history to initial state
    resetHistory(
      initialParsedSvgRef.current?.paths || [],
      overlayStateManager.overlayState,
      initialPathStylesRef.current,
      initialDefsRef.current || createEmptyDefs()
    )

    onModalClose?.()
  }, [
    onModalClose,
    trackEvent,
    isModal,
    isOverlayMode,
    overlayStateManager,
    initialMode,
    effectsManager,
    resetHistory,
    originalImageUrl,
    drawing,
  ])

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      undo: handleUndo,
      redo: handleRedo,
      setMode: setEditorMode,
      getMode: () => editorMode,
      resetViewport: () => {
        // This would need to be connected to the viewport hook
        // For now, it's a no-op
      },
    }),
    [handleSave, handleUndo, handleRedo, editorMode]
  )

  // Sidebar props (memoized to avoid unnecessary re-renders)
  // Must be before any early returns to satisfy React hooks rules
  const sidebarFillProps = useMemo(
    () => ({
      selectedPath: displayStyle ? { ...selectedPathExtended!, style: displayStyle } : selectedPathExtended,
      defs: effectsManager.defs,
      disabled: selectedPathIndex === null,
      onFillColorChange: handleFillColorChange,
      onFillRuleChange: handleFillRuleChange,
      onGradientCreate: handleGradientCreate,
      onGradientUpdate: handleGradientUpdate,
      onGradientDelete: handleGradientDelete,
      onFillGradientApply: handleFillGradientApply,
    }),
    [
      selectedPathExtended,
      displayStyle,
      effectsManager.defs,
      selectedPathIndex,
      handleFillColorChange,
      handleFillRuleChange,
      handleGradientCreate,
      handleGradientUpdate,
      handleGradientDelete,
      handleFillGradientApply,
    ]
  )

  const sidebarStrokeProps = useMemo(
    () => ({
      color: selectedStrokeColor,
      width: selectedStrokeWidth,
      disabled: selectedPathIndex === null,
      onColorChange: handleStrokeColorChange,
      onWidthChange: handleStrokeWidthChange,
    }),
    [selectedStrokeColor, selectedStrokeWidth, selectedPathIndex, handleStrokeColorChange, handleStrokeWidthChange]
  )

  const sidebarFiltersProps = useMemo(
    () => ({
      selectedPath: displayStyle ? { ...selectedPathExtended!, style: displayStyle } : selectedPathExtended,
      defs: effectsManager.defs,
      disabled: selectedPathIndex === null,
      selectedPathHasAdjustments,
      hasPaths: Boolean(parsedSvg && parsedSvg.paths.length > 0),
      onFilterCreate: handleFilterCreate,
      onFilterUpdate: handleFilterUpdate,
      onFilterDelete: handleFilterDelete,
      onFilterApply: handleFilterApply,
      onFilterApplyToAll: handleFilterApplyToAll,
      // Callbacks to change fill/stroke (used by leather techniques)
      onFillChange: handleFillColorChange,
      onStrokeChange: handleStrokeColorChange,
      // Callback to switch sidebar section (used by filter info banners)
      onSwitchSection: setActiveSidebarSection,
      // Overlay mode props for filter presets
      isOverlayMode,
      imageColorAdjustments: overlayStateManager.overlayState.imageColorAdjustments,
      onImageFilterPresetChange: handleImageFilterPresetChange,
      onImageFilterPresetCommit: handleImageAdjustmentCommit,
      onImageFilterParamChange: handleImageFilterParamChange,
    }),
    [
      selectedPathExtended,
      displayStyle,
      effectsManager.defs,
      selectedPathIndex,
      selectedPathHasAdjustments,
      parsedSvg,
      handleFilterCreate,
      handleFilterUpdate,
      handleFilterDelete,
      handleFilterApply,
      handleFilterApplyToAll,
      handleFillColorChange,
      handleStrokeColorChange,
      isOverlayMode,
      overlayStateManager.overlayState.imageColorAdjustments,
      handleImageFilterPresetChange,
      handleImageAdjustmentCommit,
      handleImageFilterParamChange,
    ]
  )

  const sidebarAdjustmentsProps = useMemo(
    () => ({
      selectedPath: displayStyle ? { ...selectedPathExtended!, style: displayStyle } : selectedPathExtended,
      disabled: selectedPathIndex === null,
      selectedPathHasFilter: Boolean(selectedPathExtended?.style?.filterId),
      onColorAdjustmentsChange: handleColorAdjustmentsChange,
      onBlendModeChange: handleBlendModeChange,
      onOpacityChange: handleOpacityChange,
      onResetAdjustments: handleResetAdjustments,
      // Overlay mode props
      isOverlayMode,
      imageColorAdjustments: overlayStateManager.overlayState.imageColorAdjustments,
      onImageAdjustmentsChange: overlayStateManager.setImageColorAdjustments,
      onImageAdjustmentChange: overlayStateManager.updateImageColorAdjustment,
      onImageAdjustmentCommit: handleImageAdjustmentCommit,
      // Adjustment mask props - check if ALL selected paths are adjustment masks
      isSelectedPathAdjustmentMask:
        selectedPathIndices.size > 0
        && Array.from(selectedPathIndices).every(idx => overlayStateManager.isAdjustmentMask(idx)),
      selectedPathAdjustments:
        selectedPathIndex !== null ? overlayStateManager.getAdjustmentMask(selectedPathIndex)?.adjustments : undefined,
      onUpdateAdjustmentMask:
        selectedPathIndices.size > 0
          ? (adjustments: Partial<ImageColorAdjustments>) => {
              // Update ALL selected paths that are adjustment masks
              Array.from(selectedPathIndices).forEach(pathIndex => {
                if (overlayStateManager.isAdjustmentMask(pathIndex)) {
                  overlayStateManager.updateAdjustmentMask(pathIndex, adjustments)
                }
              })
            }
          : undefined,
      onUpdateAdjustmentMaskCommit: handleAdjustmentMaskSettingsCommit,
    }),
    [
      selectedPathExtended,
      displayStyle,
      selectedPathIndex,
      selectedPathIndices,
      handleColorAdjustmentsChange,
      handleBlendModeChange,
      handleOpacityChange,
      handleResetAdjustments,
      isOverlayMode,
      overlayStateManager,
      handleImageAdjustmentCommit,
      handleAdjustmentMaskSettingsCommit,
    ]
  )

  // Loading state (SVG or image)
  const isAnyLoading = isLoading || (isOverlayMode && imageLoading)
  if (isAnyLoading) {
    const loadingMessage = isOverlayMode && imageLoading ? 'Loading image...' : 'Loading SVG...'
    const loadingContent = (
      <div className={styles.loadingContainer}>
        <Spinner size="large" />
        <p>{loadingMessage}</p>
      </div>
    )

    if (isModal) {
      return (
        <Modal open={modalOpen} onClose={handleCancel} title={modalTitle} size="large">
          {loadingContent}
        </Modal>
      )
    }
    return loadingContent
  }

  // Error state (SVG or image)
  const currentError = loadError || (isOverlayMode && imageError ? imageError : null)
  if (currentError) {
    const errorContent = (
      <div className={styles.errorContainer}>
        <Banner tone="critical">
          <p>
            {isOverlayMode && imageError ? `Failed to load image: ${imageError}` : `Failed to load SVG: ${loadError}`}
          </p>
        </Banner>
      </div>
    )

    if (isModal) {
      return (
        <Modal
          open={modalOpen}
          onClose={handleCancel}
          title={modalTitle}
          size="large"
          secondaryActions={[{ content: 'Close', onAction: handleCancel }]}
        >
          {errorContent}
        </Modal>
      )
    }
    return errorContent
  }

  // Main content
  const content = (
    <div className={styles.editorContainer}>
      {/* Main content with canvas and sidebar */}
      <div
        className={styles.mainContent}
        style={isMobileView && mobileCanvasHeight ? { height: `${mobileCanvasHeight}px` } : undefined}
      >
        {/* Canvas column */}
        <div className={styles.canvasColumn}>
          {/* Canvas wrapper with toolbar overlay */}
          <div className={styles.canvasWrapper}>
            {/* Toolbar - positioned inside canvas area */}
            {showToolbar && (
              <EditorToolbar
                editorMode={editorMode}
                canUndo={editorMode === 'draw' && drawing.isDrawing ? drawing.canUndo : canUndo}
                canRedo={editorMode === 'draw' && drawing.isDrawing ? drawing.canRedo : canRedo}
                hasSelection={selectedPathIndex !== null}
                hasNodeSelection={
                  selectedPathIndex !== null && (selectedNodeIndex !== null || selectedNodeIndices.size > 0)
                }
                canCopy={canCopy}
                drawingPath={drawing.drawingPath}
                isStartingNewSubpath={isStartingNewSubpath}
                selectedPredefinedShape={selectedPredefinedShape}
                isSubpathStylingMode={isSubpathStylingMode}
                selectedPathHasFilter={Boolean(selectedPathExtended?.style?.filterId)}
                selectedPathHasAdjustments={selectedPathHasAdjustments}
                onModeChange={setEditorMode}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onDelete={handleDeleteSelected}
                onCopy={handleCopy}
                onCut={handleCut}
                onPaste={handlePaste}
                onInvertSelection={handleInvertSelection}
                onFinishDrawing={handleFinishDrawing}
                onCancelDrawing={handleCancelDrawing}
                onToggleNewSubpath={handleToggleNewSubpath}
                onShapeSelect={handleShapeSelect}
                shouldAutoOpenDrawSidebar={shouldAutoOpenDrawSidebar}
                onDrawSidebarOpened={handleDrawSidebarOpened}
                onPopoverOpenChange={setIsPopoverOpen}
                // Layer ordering props
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onMoveToFront={handleMoveToFront}
                onMoveToBack={handleMoveToBack}
                // Overlay mode props
                isOverlayMode={isOverlayMode}
                // Image tracing props
                isTracing={isTracing}
                onTraceImage={handleTraceImage}
                // Clip/Hole path controls (overlay mode) - support multi-path selection
                isSelectedPathClip={
                  selectedPathIndices.size > 0
                  && Array.from(selectedPathIndices).some(idx => overlayStateManager.isClipPath(idx))
                }
                isSelectedPathHole={
                  selectedPathIndices.size > 0
                  && Array.from(selectedPathIndices).some(idx => overlayStateManager.isHolePath(idx))
                }
                onToggleClipPath={selectedPathIndices.size > 0 ? handleToggleClipPath : undefined}
                onToggleHolePath={selectedPathIndices.size > 0 ? handleToggleHolePath : undefined}
                // Adjustment mask controls (overlay mode) - support multi-path selection
                isSelectedPathAdjustmentMask={
                  selectedPathIndices.size > 0
                  && Array.from(selectedPathIndices).some(idx => overlayStateManager.isAdjustmentMask(idx))
                }
                onToggleAdjustmentMask={selectedPathIndices.size > 0 ? handleToggleAdjustmentMask : undefined}
                // Drawing curve type props (Feature 1)
                drawingCurveType={drawing.curveType}
                onDrawingCurveTypeChange={drawing.setCurveType}
                // Select all nodes (Feature 2)
                onSelectAllNodes={handleSelectAllNodes}
                // Mobile modifier toggles (Feature 2)
                mobileInsertNodeMode={mobileInsertNodeMode}
                mobileMultiSelectMode={mobileMultiSelectMode}
                mobileSelectionRectMode={mobileSelectionRectMode}
                onToggleMobileInsertNodeMode={handleToggleMobileInsertNodeMode}
                onToggleMobileMultiSelectMode={handleToggleMobileMultiSelectMode}
                onToggleMobileSelectionRectMode={handleToggleMobileSelectionRectMode}
                // Extend mode props (Feature 3)
                isExtendMode={isExtendMode}
                onToggleExtendMode={handleToggleExtendMode}
                onBreakOpenPath={handleBreakOpenPath}
                selectedPathIsClosed={
                  selectedPathIndex !== null
                  && parsedSvg?.paths[selectedPathIndex]?.commands?.some(cmd => cmd.type === 'Z' || cmd.type === 'z')
                }
                // Sidebar props
                activeSidebarSection={activeSidebarSection}
                onToggleSidebarSection={handleToggleSidebarSection}
                onCloseSidebar={handleCloseSidebar}
                // Close popover signal (toggled when canvas is tapped while popover open)
                closePopover={closePopoverSignal}
                // AI vector generation props
                imageUrl={svgDataUri || svgUrl}
                onAIVectorGenerate={handleAIVectorGenerate}
                // Edit mode settings props
                editModeSettings={editModeSettings}
                onEditModeSettingsChange={updateEditModeSettings}
                gridSettings={gridSettings}
                onGridSettingsChange={updateGridSettings}
                // Viewport resize props (for EditModeSection canvas size inputs)
                viewBox={parsedSvg?.viewBox}
                onViewBoxChange={handleViewBoxChange}
                onMobileHintChange={setMobileHint}
              />
            )}

            {/* Mobile hint bar — lifted outside the scrollable toolbar so it stays visible */}
            {isMobileView && (
              <div
                className={
                  editModeSettings?.showRuler
                    ? `${styles.mobileToolbarHint} ${styles.mobileToolbarHintWithRuler}`
                    : styles.mobileToolbarHint
                }
              >
                <HintBanner show={!!mobileHint} onClose={() => setMobileHint(null)}>
                  {mobileHint}
                </HintBanner>
              </div>
            )}

            {/* Centered canvas overlay (e.g. empty state CTA) */}
            {canvasOverlay && <div className={styles.canvasOverlay}>{canvasOverlay}</div>}

            {/* Floating canvas actions (e.g. guide image toggle) */}
            {canvasActions && canvasActions.length > 0 && (
              <div className={styles.canvasActions}>
                {canvasActions.map((action, i) => (
                  <Tooltip key={i} content={action.tooltip}>
                    <Button
                      icon={action.icon}
                      variant={action.active ? 'primary' : 'secondary'}
                      onClick={action.onAction}
                      disabled={action.disabled}
                      accessibilityLabel={action.tooltip}
                    >
                      {action.label}
                    </Button>
                  </Tooltip>
                ))}
              </div>
            )}

            {parsedSvg && (
              <EditorCanvas
                parsedSvg={parsedSvg}
                pathStyles={pathStyles}
                defs={effectsManager.defs}
                // Consolidated selection state (Set-based only)
                selectedPathIndices={selectedPathIndices}
                selectedNodeIndices={selectedNodeIndices}
                editorMode={editorMode}
                drawingPath={drawing.drawingPath}
                isStartingNewSubpath={isStartingNewSubpath}
                // Predefined shape props
                selectedPredefinedShape={selectedPredefinedShape}
                shapeDragStart={shapeDragStart}
                shapeDragCurrent={shapeDragCurrent}
                // Consolidated selection callbacks (Set-based only)
                onPathIndicesChange={setSelectedPathIndices}
                onNodeIndicesChange={setSelectedNodeIndices}
                onNodeMove={handleNodeMove}
                onNodeMoveEnd={handleNodeMoveEnd}
                onControlPointMove={handleControlPointMove}
                onControlPointMoveEnd={handleControlPointMoveEnd}
                onMultiNodeMove={handleMultiNodeMove}
                onMultiNodeMoveEnd={handleMultiNodeMoveEnd}
                onPathMove={handlePathMove}
                onPathMoveEnd={handlePathMoveEnd}
                onNodeInsert={handleNodeInsert}
                onDrawPathClick={handleDrawPathClick}
                onDrawPathCurve={handleDrawPathCurve}
                onDrawPathQuadratic={handleDrawPathQuadratic}
                onCloseDrawingPath={handleCloseDrawingPath}
                onCloseDrawingPathWithCurve={handleCloseDrawingPathWithCurve}
                // Drawing curve type (Feature 1)
                drawingCurveType={drawing.curveType}
                // Mobile modifier toggles (Feature 2)
                mobileInsertNodeMode={mobileInsertNodeMode}
                mobileMultiSelectMode={mobileMultiSelectMode}
                mobileSelectionRectMode={mobileSelectionRectMode}
                // Extend mode props (Feature 3)
                isExtendMode={isExtendMode}
                extendFromNode={extendFromNode}
                onExtendPath={handleExtendPath}
                onCloseExtendPath={handleCloseExtendPath}
                // Predefined shape callbacks
                onShapeDragStart={handleShapeDragStart}
                onShapeDragMove={handleShapeDragMove}
                onShapeDragEnd={handleShapeDragEnd}
                // Rotation callbacks
                onRotationChange={handleRotationChange}
                onRotationChangeEnd={handleRotationChangeEnd}
                // Resize callbacks
                onResizeChange={handleResizeChange}
                onResizeChangeEnd={handleResizeChangeEnd}
                // Overlay mode props
                isOverlayMode={isOverlayMode}
                imageInfo={imageInfo}
                imageColorAdjustments={overlayStateManager.overlayState.imageColorAdjustments}
                clipPathIndices={overlayStateManager.overlayState.clipPathIndices}
                holePathIndices={overlayStateManager.overlayState.holePathIndices}
                adjustmentMasks={overlayStateManager.overlayState.adjustmentMasks}
                // Block click actions when popover/sidebar is visible (only allow pan/zoom)
                isPopoverOrSidebarOpen={isPopoverOrSidebarOpen}
                // Close sidebar when clicking on canvas
                onCloseSidebar={handleCloseSidebar}
                // Hide path selection feedback when sidebar is open, show only bounding box with handles
                hidePathSelectionFeedback={activeSidebarSection !== null}
                // Edit mode settings for overlays (grid, ruler, viewport resize)
                editModeSettings={editModeSettings}
                gridSettings={gridSettings}
                guidelines={guidelines}
                onGuidelineAdd={addGuideline}
                onGuidelineUpdate={updateGuideline}
                onGuidelineRemove={removeGuideline}
                // Preview image from TemplateEditor (non-editable environmental background)
                previewImageConfig={previewImageConfig}
                workspaceDimensions={workspaceDimensions}
                ref={editorCanvasRef}
              />
            )}
          </div>
        </div>

        {/* Desktop: Sidebar column */}
        {activeSidebarSection && !mdDown && (
          <div className={styles.sidebarColumn}>
            <EditorSidebar
              activeSection={activeSidebarSection}
              onClose={handleCloseSidebar}
              fillProps={sidebarFillProps}
              strokeProps={sidebarStrokeProps}
              filtersProps={sidebarFiltersProps}
              adjustmentsProps={sidebarAdjustmentsProps}
              drawModeProps={{
                selectedShape: selectedPredefinedShape,
                onShapeSelect: handleShapeSelect,
                editorMode,
                onModeChange: setEditorMode,
                imageUrl: svgDataUri || svgUrl,
                onAIVectorGenerate: handleAIVectorGenerate,
                onClose: handleCloseSidebar,
              }}
              editModeProps={{
                editModeSettings,
                onEditModeSettingsChange: updateEditModeSettings,
                gridSettings,
                onGridSettingsChange: updateGridSettings,
                viewBox: parsedSvg?.viewBox,
                onViewBoxChange: handleViewBoxChange,
              }}
              guideImageProps={effectiveGuideImageProps}
            />
          </div>
        )}
      </div>

      {/* Mobile: Bottom panel */}
      {activeSidebarSection && mdDown && (
        <div className={styles.bottomPanel}>
          <EditorSidebar
            activeSection={activeSidebarSection}
            onClose={handleCloseSidebar}
            fillProps={sidebarFillProps}
            strokeProps={sidebarStrokeProps}
            filtersProps={sidebarFiltersProps}
            adjustmentsProps={sidebarAdjustmentsProps}
            drawModeProps={{
              selectedShape: selectedPredefinedShape,
              onShapeSelect: handleShapeSelect,
              editorMode,
              onModeChange: setEditorMode,
              imageUrl: svgDataUri || svgUrl,
              onAIVectorGenerate: handleAIVectorGenerate,
              onClose: handleCloseSidebar,
            }}
            editModeProps={{
              editModeSettings,
              onEditModeSettingsChange: updateEditModeSettings,
              gridSettings,
              onGridSettingsChange: updateGridSettings,
              viewBox: parsedSvg?.viewBox,
              onViewBoxChange: handleViewBoxChange,
            }}
            guideImageProps={effectiveGuideImageProps}
          />
        </div>
      )}

      {/* Action buttons (non-modal mode) */}
      {!isModal && showFooter && (
        <div className={styles.actionButtons}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      )}
    </div>
  )

  if (isModal) {
    return (
      <Modal
        open={modalOpen}
        onClose={handleCancel}
        title={modalTitle}
        size="large"
        primaryAction={{
          content: isUploading ? t('uploading') : t('save'),
          loading: isUploading,
          disabled: isUploading,
          onAction: handleSave,
        }}
        secondaryActions={[
          ...(secondaryActions ?? []),
          {
            content: t('cancel'),
            onAction: handleCancel,
            disabled: isUploading,
          },
        ]}
      >
        {content}
      </Modal>
    )
  }

  return content
})

export default VectorEditor
