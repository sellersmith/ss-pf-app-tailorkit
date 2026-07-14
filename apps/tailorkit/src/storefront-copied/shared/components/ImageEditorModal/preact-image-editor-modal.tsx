/* eslint-disable react/no-danger */
/** @jsxImportSource preact */
import { h, render } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import { FEATURE_FLAGS } from '../../../assets/constants/feature-flags'
import {
  REDO_ICON,
  REMOVE_BACKGROUND_ICON,
  RESET_ICON,
  ROTATE_LEFT_ICON,
  ROTATE_RIGHT_ICON,
  UNDO_ICON,
  ZOOM_IN_ICON,
  ZOOM_OUT_ICON,
  REMOVED_BACKGROUND_ICON,
} from '../../../assets/icons/editor-icons'
import { loadFeature } from '../../../assets/utils/feature-loader'
import type { KonvaFeatureModule } from '../../../assets/utils/feature-loader.types'
import { translate } from '../../../assets/libraries/translation'
import { Button } from '../../../assets/components/preact/commons/button'

export interface LayerDimensions {
  width: number
  height: number
  left: number
  top: number
  rotation: number
}

export interface MaskConfig {
  src: string
  invert?: boolean
  globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
  smoothEdges?: boolean
  smoothingStrength?: number
}

export interface EditorState {
  zoom?: number
  rotation?: number
  x?: number
  y?: number
  width?: number
  height?: number
  transform?: 'fill' | 'fit' | string
}

export interface KonvaEditor {
  showLoadingOverlay: () => void
  hideLoadingOverlay: () => void
  zoomImage: (deltaPercent: number) => number
  updateEditor: (state: { zoom?: number; rotation?: number; transformMode?: string }) => void
  applyFullState: (state: EditorState) => void
  autoFitImageToBoundary: (center?: boolean) => void
  getEditorState: () => { zoom: number; rotation: number }
  resetEditor: () => void
  cleanup: () => void
  undo: () => void
  redo: () => void
}

export interface OnRemoveBackgroundContext {
  objectUrl: string
  konvaEditor: KonvaEditor
  setLoading: (isLoading: boolean, keepRemoveBackgroundDisabled?: boolean) => void
  setObjectUrl: (nextUrl: string) => void
  setRemovedInSession: (v: boolean) => void
  setImageElement: (img: HTMLImageElement) => void
}

export interface ImageEditorModalWebComponentProps {
  file?: File
  objectUrl: string
  layerDimensions: LayerDimensions
  imageElement: HTMLImageElement
  initialState?: EditorState
  transformerConfig?: Partial<TransformerConfig>
  initialBackgroundRemoved?: boolean
  maskConfig?: MaskConfig
  onCancel?: () => void
  onSubmit?: (editorState: EditorState, uploadedUrl: string, removedBackground?: boolean) => Promise<void> | void
  onReplaceImage?: () => void
  onRemoveBackground?: (ctx: OnRemoveBackgroundContext) => Promise<void> | void
}

export function PreactImageEditorModal(props: ImageEditorModalWebComponentProps & { close: () => void }) {
  const {
    objectUrl,
    layerDimensions,
    imageElement,
    initialState = { zoom: 1, rotation: 0 },
    transformerConfig,
    initialBackgroundRemoved = false,
    maskConfig,
    onCancel,
    onSubmit,
    onReplaceImage,
    onRemoveBackground,
  } = props

  const [currentZoom, setCurrentZoom] = useState<number>(() =>
    initialState.zoom && initialState.zoom <= 2 ? initialState.zoom * 100 : initialState.zoom || 100
  )
  const [currentRotation, setCurrentRotation] = useState<number>(initialState.rotation || 0)
  const [hasRemovedBackground, setHasRemovedBackground] = useState<boolean>(!!initialBackgroundRemoved)
  const [removedBackgroundInThisSession, setRemovedBackgroundInThisSession] = useState<boolean>(false)
  const [isBgRemoving, setIsBgRemoving] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const konvaContainerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<KonvaEditor | null>(null)
  const objectUrlRef = useRef<string>(objectUrl)
  const imageElRef = useRef<HTMLImageElement>(imageElement)
  const containerId = useMemo(() => `konva-container-${Math.random().toString(36).slice(2)}`, [])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      // Wait for the Konva module to load (from the separate konva bundle)
      const konvaModule = await loadFeature<KonvaFeatureModule>('konva')
      const { initKonvaEditor } = konvaModule

      const cfg = {
        width: layerDimensions.width,
        height: layerDimensions.height,
        rotation: layerDimensions.rotation,
        initialZoom: initialState.zoom || 1,
        initialRotation: initialState.rotation || 0,
        initialX: initialState.x,
        initialY: initialState.y,
        initialWidth: initialState.width,
        initialHeight: initialState.height,
        maskConfig,
      }
      const editor = (await initKonvaEditor(
        containerId,
        imageElRef.current,
        cfg,
        transformerConfig
      )) as unknown as KonvaEditor

      if (!isMounted) return
      editorRef.current = editor

      if (shouldRestoreState(initialState)) {
        setTimeout(() => editor.applyFullState(initialState), 150)
        setCurrentZoom(initialState.zoom || 100)
        setCurrentRotation(initialState.rotation || 0)
      } else {
        editor.autoFitImageToBoundary(true)
        const stateAfter = editor.getEditorState()
        setCurrentZoom(stateAfter.zoom)
        setCurrentRotation(stateAfter.rotation)
      }
    })()

    return () => {
      isMounted = false
      if (editorRef.current) {
        editorRef.current.cleanup()
        editorRef.current = null
      }
    }
  }, [
    containerId,
    initialState,
    layerDimensions.height,
    layerDimensions.rotation,
    layerDimensions.width,
    maskConfig,
    transformerConfig,
  ])

  const setLoading = (loading: boolean, keepRemoveBackgroundDisabled: boolean = false) => {
    setIsBgRemoving(loading)
    const editor = editorRef.current
    if (editor) {
      if (loading) {
        editor.showLoadingOverlay()
      } else {
        editor.hideLoadingOverlay()
      }
    }
    if (!loading && keepRemoveBackgroundDisabled) {
      setHasRemovedBackground(true)
    }
  }

  const handleZoom = (deltaPercent: number) => {
    const editor = editorRef.current
    if (!editor) return
    const newZoom = editor.zoomImage(deltaPercent)
    setCurrentZoom(newZoom)
  }

  const handleRotate = (delta: number) => {
    const editor = editorRef.current
    if (!editor) return
    const nextRotation = (currentRotation + delta) % 360
    setCurrentRotation(nextRotation)
    editor.updateEditor({ zoom: currentZoom, rotation: nextRotation, transformMode: 'fill' })
  }

  const handleReset = () => {
    const editor = editorRef.current
    if (!editor) return
    setCurrentZoom(100)
    setCurrentRotation(0)
    editor.resetEditor()
  }

  const handleRemoveBackground = async () => {
    const editor = editorRef.current
    if (!editor) return

    if (onRemoveBackground) {
      await onRemoveBackground({
        objectUrl: objectUrlRef.current,
        konvaEditor: editor,
        setLoading,
        setObjectUrl: next => (objectUrlRef.current = next),
        setRemovedInSession: v => setRemovedBackgroundInThisSession(v),
        setImageElement: img => (imageElRef.current = img),
      })
      return
    }

    console.warn('onRemoveBackground prop not provided; ignoring remove background action')
  }

  const handleSubmit = async () => {
    const editor = editorRef.current
    const state: EditorState = editor?.getEditorState() || {
      zoom: currentZoom,
      rotation: currentRotation,
      transform: 'fill',
    }
    try {
      setIsSubmitting(true)
      if (onSubmit) {
        await onSubmit(state, objectUrlRef.current, removedBackgroundInThisSession)
      }
      props.close()
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
      setIsSubmitting(false)
    }
  }

  const { resizeEnabled, rotateEnabled, draggable, removeBackgroundEnabled } = transformerConfig || {}
  const isDisabledAllConfigs = !resizeEnabled && !rotateEnabled && !draggable && !removeBackgroundEnabled

  return (
    <div className="emtlkit-image-editor-content">
      <div className="emtlkit-image-editor-main" style={{ opacity: 1 }}>
        <div className="emtlkit-image-editor-preview-area" style={{ width: '100%', marginBottom: 16 }}>
          <div
            id={containerId}
            ref={konvaContainerRef as any}
            style={{ width: '100%', minHeight: 270, maxHeight: 270, margin: 'auto' }}
          ></div>
        </div>
        <div className="emtlkit-image-editor-controls">
          <div className="emtlkit--d-flex emtlkit--align-items-center emtlkit--gap-16">
            <div className="emtlkit-image-editor-row emtlkit--d-flex emtlkit--justify-content-center emtlkit--align-items-center emtlkit--gap-16">
              {resizeEnabled && (
                <>
                  <Button
                    className="emtlkit-button-icon-round"
                    onClick={() => handleZoom(5)}
                    aria-label="Zoom In"
                    disabled={isBgRemoving || isSubmitting}
                    icon={ZOOM_IN_ICON}
                    iconOnly
                  />
                  <Button
                    className="emtlkit-button-icon-round"
                    onClick={() => handleZoom(-5)}
                    aria-label="Zoom Out"
                    disabled={isBgRemoving || isSubmitting}
                    icon={ZOOM_OUT_ICON}
                    iconOnly
                  />
                </>
              )}
              {rotateEnabled && (
                <>
                  <Button
                    className="emtlkit-button-icon-round"
                    onClick={() => handleRotate(-10)}
                    aria-label="Rotate Left"
                    disabled={isBgRemoving || isSubmitting}
                    icon={ROTATE_LEFT_ICON}
                    iconOnly
                  />
                  <Button
                    className="emtlkit-button-icon-round"
                    onClick={() => handleRotate(10)}
                    aria-label="Rotate Right"
                    disabled={isBgRemoving || isSubmitting}
                    icon={ROTATE_RIGHT_ICON}
                    iconOnly
                  />
                </>
              )}
            </div>
            {!isDisabledAllConfigs ? (
              <span
                style={{ display: 'inline-block', borderLeft: '1px solid var(--emtlkit-border-color-secondary)' }}
              />
            ) : null}

            <div className="emtlkit-control-group emtlkit--d-flex emtlkit--justify-content-end emtlkit--align-items-center">
              <div className="emtlkit-history-buttons">
                <Button
                  className="emtlkit-button-icon-round"
                  onClick={() => editorRef.current?.undo()}
                  aria-label="Undo"
                  disabled={isBgRemoving || isSubmitting}
                  icon={UNDO_ICON}
                  iconOnly
                />
                <Button
                  className="emtlkit-button-icon-round"
                  onClick={() => editorRef.current?.redo()}
                  aria-label="Redo"
                  disabled={isBgRemoving || isSubmitting}
                  icon={REDO_ICON}
                  iconOnly
                />
                <Button
                  className="emtlkit-button-icon-round"
                  onClick={handleReset}
                  aria-label="Reset"
                  disabled={isBgRemoving || isSubmitting}
                  icon={RESET_ICON}
                  iconOnly
                />
              </div>
            </div>
          </div>
          <div className="emtlkit-image-editor-row emtlkit--d-flex emtlkit--justify-content-center emtlkit--align-items-center emtlkit--gap-16">
            {removeBackgroundEnabled && FEATURE_FLAGS.REMOVE_BACKGROUND_IMAGE && (
              <Button
                icon={hasRemovedBackground ? REMOVED_BACKGROUND_ICON : REMOVE_BACKGROUND_ICON}
                variant="outline"
                onClick={handleRemoveBackground}
                disabled={isBgRemoving || hasRemovedBackground || isSubmitting}
                loading={isBgRemoving}
              >
                {hasRemovedBackground
                  ? `${translate('background-removed', 'Background removed')}`
                  : `${translate('remove-background', 'Remove background')}`}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="emtlkit--d-flex" style={{ justifyContent: 'space-between', width: '100%', marginTop: 12 }}>
        <Button
          className="emtlkit-button-modal"
          variant="plain"
          onClick={() => {
            props.close()
            onReplaceImage?.()
          }}
          disabled={isBgRemoving || isSubmitting}
        >
          {translate('replace-image', 'Replace image')}
        </Button>
        <div className="emtlkit--d-flex" style={{ gap: 8 }}>
          <Button
            className="emtlkit-button-modal"
            variant="secondary"
            onClick={() => {
              props.close()
              onCancel?.()
            }}
            disabled={isBgRemoving || isSubmitting}
          >
            {translate('cancel', 'Cancel')}
          </Button>
          <Button
            className={`emtlkit-button-modal emtlkit--apply-button`}
            variant="primary"
            onClick={handleSubmit}
            disabled={isBgRemoving || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? `${translate('saving', 'Saving')}` : `${translate('save-image', 'Save image')}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// id is generated once via useMemo above and assigned on the div

function shouldRestoreState(initialState: any): boolean {
  const zoomValue = initialState.zoom || 1
  const rotationValue = initialState.rotation || 0
  return (
    zoomValue > 1
    || rotationValue !== 0
    || (zoomValue !== 1 && zoomValue !== 100)
    || initialState.x !== undefined
    || initialState.y !== undefined
  )
}

export class EmtlkitImageEditorModalElement extends HTMLElement {
  #root: HTMLElement | null = null
  #cleanup: (() => void) | null = null

  static get observedAttributes() {
    return []
  }

  connectedCallback() {
    if (this.#root) return
    // Render into light DOM so IDs are visible to document.getElementById (Konva init relies on it)
    this.#root = this as unknown as HTMLElement
    const close = () => this.remove()
    const props = this.#readProps()
    this.#render(props, close)
  }

  disconnectedCallback() {
    if (this.#cleanup) this.#cleanup()
    this.#cleanup = null
    this.#root = null
  }

  #render(props: ImageEditorModalWebComponentProps, close: () => void) {
    if (!this.#root) return

    // Use explicit props instead of spreading to avoid frozen object issues
    render(
      h(PreactImageEditorModal, {
        objectUrl: props.objectUrl,
        layerDimensions: props.layerDimensions,
        imageElement: props.imageElement,
        initialState: props.initialState,
        transformerConfig: props.transformerConfig,
        initialBackgroundRemoved: props.initialBackgroundRemoved,
        maskConfig: props.maskConfig,
        onCancel: props.onCancel,
        onSubmit: props.onSubmit,
        onReplaceImage: props.onReplaceImage,
        onRemoveBackground: props.onRemoveBackground,
        close: close,
      }),
      this.#root
    )

    this.#cleanup = () => {
      if (this.#root) render(null as any, this.#root)
    }
  }

  #readProps(): ImageEditorModalWebComponentProps {
    const anyThis: any = this as any
    return {
      objectUrl: anyThis.objectUrl,
      layerDimensions: anyThis.layerDimensions,
      imageElement: anyThis.imageElement,
      initialState: anyThis.initialState,
      transformerConfig: anyThis.transformerConfig,
      initialBackgroundRemoved: anyThis.initialBackgroundRemoved,
      maskConfig: anyThis.maskConfig,
      onCancel: anyThis.onCancel,
      onSubmit: anyThis.onSubmit,
      onReplaceImage: anyThis.onReplaceImage,
      onRemoveBackground: anyThis.onRemoveBackground,
    }
  }
}
