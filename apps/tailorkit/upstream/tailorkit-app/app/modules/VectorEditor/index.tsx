/**
 * VectorEditor Module - Public Entry Point
 *
 * A standalone, reusable SVG vector editor component for editing SVG paths.
 * Supports both data URI and URL inputs, with comprehensive editing features
 * including node manipulation, bezier curve editing, and multi-node selection.
 *
 * @example Basic usage with data URI
 * ```tsx
 * import VectorEditor from '~/modules/VectorEditor'
 *
 * function MyComponent() {
 *   return (
 *     <VectorEditor
 *       svgDataUri={svgData}
 *       onSave={(editedDataUri) => console.log(editedDataUri)}
 *     />
 *   )
 * }
 * ```
 *
 * @example Usage with URL
 * ```tsx
 * import VectorEditor from '~/modules/VectorEditor'
 *
 * function MyComponent() {
 *   return (
 *     <VectorEditor
 *       svgUrl="https://example.com/image.svg"
 *       onSave={(editedDataUri) => console.log(editedDataUri)}
 *     />
 *   )
 * }
 * ```
 *
 * @example Modal usage
 * ```tsx
 * import VectorEditor from '~/modules/VectorEditor'
 *
 * function MyModal() {
 *   const [open, setOpen] = useState(false)
 *
 *   return (
 *     <VectorEditor
 *       svgDataUri={svgData}
 *       isModal={true}
 *       modalOpen={open}
 *       modalTitle="Edit Vector"
 *       onModalClose={() => setOpen(false)}
 *       onSave={(data) => {
 *         handleSave(data)
 *         setOpen(false)
 *       }}
 *     />
 *   )
 * }
 * ```
 *
 * @example Imperative API with ref
 * ```tsx
 * import VectorEditor, { type VectorEditorRef } from '~/modules/VectorEditor'
 *
 * function MyComponent() {
 *   const editorRef = useRef<VectorEditorRef>(null)
 *
 *   return (
 *     <>
 *       <VectorEditor ref={editorRef} svgDataUri={svgData} onSave={handleSave} />
 *       <button onClick={() => editorRef.current?.save()}>Save</button>
 *       <button onClick={() => editorRef.current?.undo()}>Undo</button>
 *     </>
 *   )
 * }
 * ```
 */

// Default export
export { default } from './VectorEditor'

// Named exports for types
export type {
  VectorEditorProps,
  VectorEditorRef,
  EditorMode,
  HistoryState,
  ViewportState,
  SelectionState,
  DragState,
  HoveredSegment,
  SelectionRect,
  EditorCanvasProps,
  EditorToolbarProps,
  // Re-exported from svg utils
  ParsedSvg,
  ParsedPath,
  PathCommand,
  Point,
} from './types'

// Hook exports (for building custom editors)
export { useEditorHistory } from './hooks/useEditorHistory'
export { useViewport } from './hooks/useViewport'
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
export { useSvgLoader } from './hooks/useSvgLoader'

// Constants export
export {
  NODE_RADIUS,
  CONTROL_POINT_RADIUS,
  HIT_TOLERANCE,
  SELECTION_DRAG_THRESHOLD,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_FACTOR,
  DEFAULT_PADDING,
  MAX_HISTORY_SIZE,
  COLORS,
  CHECKER_SIZE,
  SHORTCUTS,
} from './constants'
