import { BlockStack, Button, Card, DropZone, InlineStack, Text, TextField, Thumbnail } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'

const MAX_FILE_SIZE = 5 * 1024 * 1024

interface ColourGuideValue {
  defaultImageUrl?: string
  defaultDescription?: string
}

interface ColourGuideCardProps {
  isSaving: boolean
  value: ColourGuideValue
  onChange: (value: ColourGuideValue) => void
}

/**
 * Storefront Setup card for the GLOBAL Colour Guide image.
 *
 * The image is shown in the storefront Personalise modal under a Text Colour
 * option set's swatches. Merchants can override this default per template via
 * the ColorOptionSet editor inside the template editor.
 */
export default function ColourGuideCard({ isSaving, value, onChange }: ColourGuideCardProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)

  const handleDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        showToast(t('colour-guide-file-too-large') || 'Image must be 5MB or smaller', { isError: true })
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await authenticatedFetch('/api/colour-guide/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res?.success || !res?.url) {
          throw new Error(res?.error || 'Upload failed')
        }
        onChange({ ...value, defaultImageUrl: res.url })
      } catch (err) {
        console.error('[ColourGuideCard] upload failed', err)
        showToast(t('upload-failed') || 'Upload failed', { isError: true })
      } finally {
        setUploading(false)
      }
    },
    [onChange, t, value]
  )

  const handleRemove = useCallback(() => {
    onChange({ ...value, defaultImageUrl: '' })
  }, [onChange, value])

  const handleDescriptionChange = useCallback(
    (defaultDescription: string) => {
      onChange({ ...value, defaultDescription })
    },
    [onChange, value]
  )

  const hasImage = Boolean(value.defaultImageUrl)

  return (
    <SettingLayout title={t('colour-guide')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('colour-guide-card-description')}
          </Text>

          {hasImage ? (
            <InlineStack gap="300" blockAlign="center">
              <Thumbnail source={value.defaultImageUrl || ''} alt={t('colour-guide')} size="large" />
              <Button onClick={handleRemove} disabled={isSaving || uploading} tone="critical">
                {t('remove')}
              </Button>
            </InlineStack>
          ) : (
            <DropZone
              accept="image/jpeg,image/png,image/webp"
              type="image"
              allowMultiple={false}
              onDrop={handleDrop}
              disabled={isSaving || uploading}
            >
              <DropZone.FileUpload
                actionTitle={uploading ? t('uploading') : t('add-image')}
                actionHint={t('jpeg-png-webp-up-to-5mb')}
              />
            </DropZone>
          )}

          <TextField
            label={t('colour-guide-description')}
            value={value.defaultDescription || ''}
            onChange={handleDescriptionChange}
            placeholder={t('colour-guide-description-placeholder')}
            disabled={isSaving}
            multiline={2}
            autoComplete="off"
            maxLength={500}
            showCharacterCount
          />
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
