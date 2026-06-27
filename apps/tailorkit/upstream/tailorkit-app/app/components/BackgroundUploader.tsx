import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import type { ComponentProps, ComponentState, ErrorInfo, ReactNode } from 'react'
import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { PureComponent } from 'react'
import { InlineStack } from '@shopify/polaris'
import { authenticatedFetch } from '~/shopify/fns.client'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type { TFileToUpload } from '~/shopify/graphql/files/types'

export type BackgroundUploaderStatus = {
  error: Error
  failed: number
  pending: number
  completed: number
  uploading: number
}

export type BackgroundUploaderResponse = BackgroundUploaderStatus & {
  errors: string
  errorFiles: any[]
  uploadedFiles: any[]
}

export type BackgroundUploaderProps = WithTranslationProps &
  ComponentProps<any> & {
    // Action URL to submit files to for uploading
    actionUrl?: string
    // A message to describe the uploading status
    message?: string
    // Name of event to reset the component state
    resetStateEvent?: string
    // Name of event to receive list of `File` objects to upload
    selectFileEvent?: string
    // Name of event to trigger when uploading files
    uploadFileEvent?: string
    // Name of event to trigger when an upload action completed
    uploadedFileEvent?: string
    // CSS selector of `file` input to listen to `change` event
    fileInputSelector?: string
    // Callback to handle upload action if action URL is not provided
    uploadHandler?: (file: File, aborter: AbortController) => Promise<void>
    // Max. time in seconds per upload action.
    //
    // If this prop is set, the component will automatically calculate
    // the `maxFilesInOneUploadAction` value to ensure the value of this
    // prop.
    maxSecondsPerUploadAction?: number
    // Max. files to upload in one upload action.
    maxFilesInOneUploadAction?: number
  }

export type BackgroundUploaderState = ComponentState & {
  // A list of `File` objects waiting to be uploaded
  files: File[]
  // A list of `File` object failed to upload
  failed: File[]
  // A list of `File` objects being uploaded
  uploading: File[]
  // A list of `File` objects has been uploaded
  completed: File[]
  // Max. bytes to upload in one upload action
  maxBytesInOneUploadAction?: number
  // Max. files to upload in one upload action
  maxFilesInOneUploadAction?: number
  // The last error occurred
  error?: Error
  // Metadata to pass through from SELECT to UPLOADED events (keyed by file _id)
  fileMetadata: Map<string, Record<string, any>>
}

export type TFileUploadByURL = TFileToUpload

export default class BackgroundUploader<P, S> extends PureComponent<
  P & BackgroundUploaderProps,
  S & BackgroundUploaderState
> {
  static defaultProps: BackgroundUploaderProps = {
    resetStateEvent: 'reset-files',
    selectFileEvent: 'select-files',
    uploadFileEvent: 'upload-files',
    uploadedFileEvent: 'uploaded-files',
    maxSecondsPerUploadAction: 10,
    maxFilesInOneUploadAction: 10,
    message: 'Uploading {{index}} of {{total}} files',
  }

  state: S & BackgroundUploaderState = {
    files: [],
    failed: [],
    uploading: [],
    completed: [],
    fileMetadata: new Map(),
  }

  timer: any = null
  aborter: AbortController | null = null

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error(error, errorInfo)
  }

  componentDidMount(): void {
    const { fileInputSelector, selectFileEvent, resetStateEvent } = this.props

    // Listen to file input if specified
    if (fileInputSelector) {
      const input = document.querySelector(fileInputSelector)

      if (input) {
        input.addEventListener('change', this.selectFiles)
      }
    }

    // Listen to custom select file event if specified
    if (selectFileEvent) {
      Transmitter.listen(selectFileEvent, this.selectFiles)
    }

    // Listen to custom event to reset component state
    if (resetStateEvent) {
      Transmitter.listen(resetStateEvent, this.resetState)
    }
  }

  componentWillUnmount(): void {
    const { fileInputSelector, selectFileEvent, resetStateEvent } = this.props

    // Stop listening to file input if specified
    if (fileInputSelector) {
      const input = document.querySelector(fileInputSelector)

      if (input) {
        input.removeEventListener('change', this.selectFiles)
      }
    }

    // Stop listening to custom select file event if specified
    if (selectFileEvent) {
      Transmitter.remove(selectFileEvent, this.selectFiles)
    }

    // Listen to custom event to reset component state
    if (resetStateEvent) {
      Transmitter.remove(resetStateEvent, this.resetState)
    }

    // Abort upload in action
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.aborter) {
      this.aborter.abort()
    }
  }

  render(): ReactNode {
    const { t, message } = this.props
    const { failed, pending, completed, uploading } = this.getStatus()

    const index = failed + completed + uploading
    const total = index + pending

    return total && (pending || uploading) ? <InlineStack>{t(message, { index, total })}</InlineStack> : null
  }

  selectFiles = (e: EventObject) => {
    const eventData = (e as EventObject).data || {}
    const files = eventData.files || (e.target as HTMLInputElement)?.files

    if (files?.length) {
      // Extract all metadata (except files) to pass through to UPLOADED event
      const { files: _files, ...metadata } = eventData

      this.setFiles(Array.from(files), Object.keys(metadata).length > 0 ? metadata : undefined)
    }
  }

  resetState = () => {
    // Abort upload in action
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.aborter) {
      this.aborter.abort()
    }

    // Clear metadata map
    this.state.fileMetadata.clear()

    // Reset component state
    this.setState({
      files: [],
      failed: [],
      uploading: [],
      completed: [],
      error: undefined,
      fileMetadata: new Map(),
    })
  }

  private setFiles = (files: TFileToUpload[], metadata?: Record<string, any>) => {
    this.state.files.splice(this.state.files.length - 1, 0, ...files)

    // Store metadata for each file (keyed by _id)
    if (metadata) {
      files.forEach((file: TFileToUpload) => {
        const fileId = !(file instanceof File) ? file._id : undefined
        if (fileId) {
          this.state.fileMetadata.set(fileId, metadata)
        }
      })
    }

    // Upload immediately if there is no upload in action
    if (!this.aborter && !this.timer) {
      this.timer = setTimeout(() => {
        this.uploadFiles()

        this.timer = null
      }, 100)
    }
  }

  private getStatus = () => {
    const { files, failed, completed, uploading, error } = this.state

    return {
      error,
      failed: failed.length,
      pending: files.length,
      completed: completed.length,
      uploading: uploading.length,
    }
  }

  private getFile = (_file: TFileUploadByURL) => {
    if (!(_file.file instanceof File) && _file.file?.originalSource?.includes('https://')) {
      const file = _file.file
      return JSON.stringify({
        originalSource: file.originalSource,
        contentType: 'IMAGE',
        filename: file.filename,
        alt: file.alt,
      })
    }

    return _file
  }

  private uploadFiles = async () => {
    if (!this.state.files.length) {
      return
    }

    // Get a list of files to upload
    let files: TFileToUpload[] = []
    const { maxBytesInOneUploadAction } = this.state
    const { maxFilesInOneUploadAction, maxSecondsPerUploadAction } = this.props

    if (!maxSecondsPerUploadAction || !maxBytesInOneUploadAction) {
      files = this.state.files.splice(0, maxSecondsPerUploadAction ? 1 : maxFilesInOneUploadAction)
    } else {
      // Get files to upload until the total bytes reaches the max. bytes per upload action
      let totalBytes = 0

      while (totalBytes < maxBytesInOneUploadAction && files.length < maxFilesInOneUploadAction) {
        files = files.concat(this.state.files.splice(0, 1))
        const file = files[files.length - 1]
        totalBytes += file.file instanceof File ? file.file.size : 0

        if (!this.state.files[0] || maxBytesInOneUploadAction - totalBytes < this.state.files[0].file.size) {
          break
        }
      }
    }

    // Update uploading state
    this.state.uploading.splice(this.state.uploading.length ? this.state.uploading.length - 1 : 0, 0, ...files)

    // Trigger uploading event
    this.forceUpdate(() => Transmitter.trigger(this.props.uploadFileEvent, this.getStatus()))

    const startTime = new Date()

    // Upload files concurrently using Promise.all
    const uploadPromises = files.map(async (file: TFileToUpload) => {
      try {
        let result: any = null
        const aborter = new AbortController()

        // If an action URL is specified, submit the file to that URL
        if (this.props.actionUrl) {
          const formData = new FormData()
          const _file = this.getFile(file)

          if (typeof _file === 'string' || _file instanceof File) {
            formData.append('files', _file)
          } else if (typeof _file._id === 'string' && _file.file instanceof File) {
            formData.append('files', _file.file)
          }

          result = await authenticatedFetch(this.props.actionUrl, {
            method: 'POST',
            body: formData,
            signal: aborter.signal,
          })
        }

        // If an upload handler callback is specified, execute the callback
        else if (this.props.uploadHandler) {
          result = await this.props.uploadHandler(file, aborter)
        }

        return { file, result, success: true }
      } catch (error) {
        return { file, error, success: false }
      }
    })

    try {
      const results = await Promise.all(uploadPromises)

      // Process all results after all uploads complete
      const completedFiles: TFileToUpload[] = []
      const failedFiles: TFileToUpload[] = []
      let lastError: Error | undefined

      results.forEach(({ file, result, error, success }) => {
        // Remove file from uploading state
        const uploadingIndex = this.state.uploading.findIndex((f: TFileToUpload) => f === file)
        if (uploadingIndex !== -1) {
          this.state.uploading.splice(uploadingIndex, 1)
        }

        if (success && result && !result.error && !result.data?.errors) {
          completedFiles.push(file)
        } else {
          failedFiles.push(file)
          lastError
            = error instanceof Error ? error : result?.error || result?.data?.errors || new Error('Upload failed')
        }
      })

      // Update state with all results
      if (completedFiles.length > 0 || failedFiles.length > 0) {
        const newState: any = {}

        if (completedFiles.length > 0) {
          newState.completed = [...this.state.completed, ...completedFiles]
        }

        if (failedFiles.length > 0) {
          newState.failed = [...this.state.failed, ...failedFiles]
          newState.error = lastError
        }

        if (maxSecondsPerUploadAction && completedFiles.length > 0) {
          // Calculate timing based on the batch
          const numSeconds = (Date.now() - startTime.getTime()) / 1000
          const numBytes = completedFiles.reduce(
            (bytes: number, file: TFileToUpload) => bytes + (file.file instanceof File ? file.file.size : 0),
            0
          )
          newState.maxBytesInOneUploadAction = Math.floor(maxSecondsPerUploadAction * (numBytes / numSeconds))
        }

        this.setState(newState, () => {
          // Trigger uploaded event for each completed file
          results.forEach(({ file, result, success }) => {
            if (success && result) {
              const fileId = !(file instanceof File) ? file._id : undefined
              // Get stored metadata for this file
              const metadata = fileId ? this.state.fileMetadata.get(fileId) : undefined

              Transmitter.trigger(this.props.uploadedFileEvent, {
                ...this.getStatus(),
                ...(result.data || result),
                _id: fileId,
                // Pass through metadata from SELECT event
                ...(metadata || {}),
              })

              // Clean up metadata after upload completes
              if (fileId) {
                this.state.fileMetadata.delete(fileId)
              }
            }
          })
        })
      }

      this.aborter = null
    } catch (error) {
      // Handle any unexpected errors
      this.setState({
        failed: [...this.state.failed, ...files],
        error: error instanceof Error ? error : new Error('Batch upload failed'),
      })
      this.aborter = null
    }

    // Continue uploading until all files are uploaded
    this.uploadFiles()
  }
}
