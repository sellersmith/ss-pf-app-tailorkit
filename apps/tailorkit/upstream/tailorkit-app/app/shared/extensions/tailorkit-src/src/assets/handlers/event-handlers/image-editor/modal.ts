/* eslint-disable max-len */
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import type { KonvaEditorState } from './index'
import EmtlkitModal from '../../../components/commons/modal'
import { MODAL_SIZES } from '../../../components/commons/modal/constants'
import { registerImageEditorModalElement } from '../../../../shared/components/ImageEditorModal'
import { handleRemoveBackground } from './handlers/remove-background'
import { translate } from '../../../libraries/translation'

export interface ImageEditorModalOptions {
  file?: File
  objectUrl: string
  layerDimensions: {
    width: number
    height: number
    left: number
    top: number
    rotation: number
  }
  imageElement: HTMLImageElement
  initialState?: Partial<KonvaEditorState>
  transformerConfig?: Partial<TransformerConfig>
  initialBackgroundRemoved?: boolean
  maskConfig?: {
    src: string
    invert?: boolean
    globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
    smoothEdges?: boolean
    smoothingStrength?: number
  }
  onCancel: () => void
  onSubmit: (editorState: KonvaEditorState, uploadedUrl: string, removedBackground?: boolean) => Promise<void>
  onReplaceImage: () => void
  onRemoveBackground?: (ctx: {
    objectUrl: string
    konvaEditor: any
    setLoading: (isLoading: boolean, keepRemoveBackgroundDisabled?: boolean) => void
    setObjectUrl: (nextUrl: string) => void
    setRemovedInSession: (v: boolean) => void
    setImageElement: (img: HTMLImageElement) => void
  }) => Promise<void> | void
}

export async function showImageEditorModal(options: ImageEditorModalOptions): Promise<void> {
  registerImageEditorModalElement()

  // Create web component and pass props
  const editorComponent = document.createElement('tailorkit-image-editor-modal') as any
  editorComponent.objectUrl = options.objectUrl
  editorComponent.layerDimensions = options.layerDimensions
  editorComponent.imageElement = options.imageElement
  editorComponent.initialState = options.initialState || { zoom: 1, rotation: 0 }
  editorComponent.transformerConfig = options.transformerConfig
  editorComponent.initialBackgroundRemoved = options.initialBackgroundRemoved || false
  editorComponent.maskConfig = options.maskConfig

  // Wrap callbacks to close modal appropriately
  let modalRef: EmtlkitModal | null = null
  editorComponent.onCancel = () => {
    if (modalRef) modalRef.close()
    options.onCancel()
  }
  editorComponent.onSubmit = async (state: KonvaEditorState, url: string, removedBg?: boolean) => {
    await options.onSubmit(state, url, removedBg)
    if (modalRef) modalRef.close()
  }
  editorComponent.onReplaceImage = () => {
    if (modalRef) modalRef.close()
    options.onReplaceImage()
  }
  editorComponent.onRemoveBackground = options.onRemoveBackground

  // Fallback default remove background implementation (preserves existing behavior) if not provided
  if (!editorComponent.onRemoveBackground) {
    editorComponent.onRemoveBackground = async ({
      objectUrl,
      konvaEditor,
      setLoading,
      setObjectUrl,
      setRemovedInSession,
      setImageElement,
    }: {
      objectUrl: string
      konvaEditor: any
      setLoading: (isLoading: boolean, keepRemoveBackgroundDisabled?: boolean) => void
      setObjectUrl: (nextUrl: string) => void
      setRemovedInSession: (v: boolean) => void
      setImageElement: (img: HTMLImageElement) => void
    }) => {
      await handleRemoveBackground({
        objectUrl,
        konvaEditor,
        onSuccess: (processedImageUrl: string, newImageElement: HTMLImageElement) => {
          setObjectUrl(processedImageUrl)
          setRemovedInSession(true)
          setImageElement(newImageElement)
        },
        onError: () => {
          // eslint-disable-next-line no-alert
          alert(translate('service-not-available', 'Service is not available right now'))
        },
        onLoadingStateChange: setLoading,
      })
    }
  }

  // Create Modal shell
  const modal = new EmtlkitModal({
    header: translate('edit-image', 'Edit image'),
    content: editorComponent,
    footer: null,
    size: MODAL_SIZES.LARGE,
    closeOnBackdropClick: false,
    closeOnEsc: true,
    zIndex: 9999,
  })
  modalRef = modal
  modal.open()
}
