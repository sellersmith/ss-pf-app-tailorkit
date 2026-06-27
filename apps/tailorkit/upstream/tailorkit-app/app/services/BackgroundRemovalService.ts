import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'

// Model configuration
const DEFAULT_MODEL_ID = 'Xenova/modnet'
const FALLBACK_MODEL_ID = 'briaai/RMBG-1.4'

interface BackgroundRemovalState {
  model: PreTrainedModel | null
  processor: Processor | null
  currentModelId: string | null
  isWebGPUSupported: boolean
  isIOS: boolean
  isInitialized: boolean
}

class BackgroundRemovalService {
  private state: BackgroundRemovalState = {
    model: null,
    processor: null,
    currentModelId: null,
    isWebGPUSupported: false,
    isIOS: false,
    isInitialized: false,
  }

  private initializationPromise: Promise<void> | null = null

  /**
   * Initialize the background removal service
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._initialize()
    return this.initializationPromise
  }

  private async _initialize(): Promise<void> {
    try {
      // Detect iOS
      this.state.isIOS = this.detectIOS()

      // Check WebGPU support
      this.state.isWebGPUSupported = await this.checkWebGPUSupport()

      // Configure environment
      this.configureEnvironment()

      // Choose and load model
      const modelId = this.selectModel()
      await this.loadModel(modelId)

      this.state.isInitialized = true
      console.log('Background removal service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize background removal service:', error)
      throw error
    }
  }

  /**
   * Process an image to remove its background
   */
  async removeBackground(imageFile: File): Promise<File> {
    if (!this.state.isInitialized) {
      try {
        await this.initialize()
      } catch (error) {
        throw new Error(`Failed to initialize background removal service: ${error}`)
      }
    }

    if (!this.state.model || !this.state.processor) {
      throw new Error('Background removal service not properly initialized')
    }

    try {
      // Load image
      const img = await RawImage.fromURL(URL.createObjectURL(imageFile))

      // Pre-process image
      const { pixel_values } = await this.state.processor(img)

      // Run inference
      const { output } = await this.state.model({ input: pixel_values })

      // Create mask and apply it
      const maskData = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(img.width, img.height)

      // Create canvas and apply mask
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Could not get 2d context')
      }

      // Draw original image
      ctx.drawImage(img.toCanvas(), 0, 0)

      // Apply alpha mask
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const maskArray = maskData.data

      for (let i = 0; i < maskArray.length; i++) {
        imageData.data[i * 4 + 3] = maskArray[i] // Set alpha channel
      }

      ctx.putImageData(imageData, 0, 0)

      // Convert to blob and file
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))), 'image/png')
      })

      const fileName = imageFile.name.split('.')[0] || 'processed'
      return new File([blob], `${fileName}-bg-removed.png`, { type: 'image/png' })
    } catch (error) {
      console.error('Error removing background:', error)
      throw new Error('Failed to process image for background removal')
    }
  }

  /**
   * Get processing status and model info
   */
  getModelInfo() {
    return {
      isWebGPUSupported: this.state.isWebGPUSupported,
      isIOS: this.state.isIOS,
      currentModelId: this.state.currentModelId,
      isInitialized: this.state.isInitialized,
    }
  }

  /**
   * Check if the service is available for use
   */
  isAvailable(): boolean {
    return this.state.isInitialized || this.state.isWebGPUSupported || !this.state.isIOS
  }

  private detectIOS(): boolean {
    const ua = window.navigator.userAgent
    const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i)
    const webkit = !!ua.match(/WebKit/i)
    const iOSSafari = iOS && webkit && !ua.match(/CriOS/i) && !ua.match(/OPiOS/i) && !ua.match(/FxiOS/i)
    return iOSSafari && 'ontouchend' in document
  }

  private async checkWebGPUSupport(): Promise<boolean> {
    if (!('gpu' in navigator)) {
      return false
    }

    try {
      const gpu = (navigator as any).gpu
      const adapter = await gpu.requestAdapter()
      if (!adapter) {
        return false
      }
      const device = await adapter.requestDevice()
      return !!device
    } catch {
      return false
    }
  }

  private configureEnvironment(): void {
    // Configure for WebGPU if supported and not iOS
    if (this.state.isWebGPUSupported && !this.state.isIOS) {
      env.backends.onnx.wasm.proxy = false
    } else {
      // Configure for WASM with threading
      if (env.backends.onnx?.wasm) {
        const wasmBackend = env.backends.onnx.wasm
        wasmBackend.proxy = true
        if ('numThreads' in wasmBackend) {
          wasmBackend.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8)
        }
      }
    }

    // Allow local models for better performance
    env.allowLocalModels = false
  }

  private selectModel(): string {
    // Always use RMBG-1.4 for iOS for better compatibility
    if (this.state.isIOS) {
      console.log('iOS detected, using RMBG-1.4 model')
      return FALLBACK_MODEL_ID
    }

    // Use MODNet with WebGPU if supported
    if (this.state.isWebGPUSupported) {
      console.log('WebGPU supported, using MODNet model')
      return DEFAULT_MODEL_ID
    }

    // Fallback to RMBG-1.4 for broader compatibility
    console.log('Using RMBG-1.4 fallback model')
    return FALLBACK_MODEL_ID
  }

  private async loadModel(modelId: string): Promise<void> {
    try {
      // Load model with appropriate configuration
      const modelConfig = this.getModelConfig(modelId)

      this.state.model = await AutoModel.from_pretrained(modelId, modelConfig)
      this.state.processor = await AutoProcessor.from_pretrained(modelId, {
        config: this.getProcessorConfig(modelId),
      })

      this.state.currentModelId = modelId
    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error)

      // Try fallback model if not already using it
      if (modelId !== FALLBACK_MODEL_ID) {
        console.log('Trying fallback model...')
        await this.loadModel(FALLBACK_MODEL_ID)
      } else {
        throw error
      }
    }
  }

  private getModelConfig(modelId: string) {
    const baseConfig: any = {}

    // Add WebGPU device if supported and not iOS
    if (this.state.isWebGPUSupported && !this.state.isIOS && modelId === DEFAULT_MODEL_ID) {
      baseConfig.device = 'webgpu'
    }

    return baseConfig
  }

  private getProcessorConfig(modelId: string) {
    if (modelId === FALLBACK_MODEL_ID) {
      return {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: 'ImageFeatureExtractor',
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      }
    }

    // Default config for MODNet
    return {}
  }
}

// Export singleton instance
export const backgroundRemovalService = new BackgroundRemovalService()
export default backgroundRemovalService
