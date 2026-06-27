interface InvalidFileError {
  name: string
  reason: 'type' | 'size'
}

type TUploadType = 'fonts' | 'images' | 'masks'

const VALIDATION_MESSAGES = {
  TYPE: 'type',
  SIZE: 'size',
} as const

const FILE_TYPE_UPLOAD = {
  fonts: 'GenericFile',
  images: 'MediaImage',
  masks: 'MaskImage',
} as const

export { type InvalidFileError, type TUploadType, VALIDATION_MESSAGES, FILE_TYPE_UPLOAD }
