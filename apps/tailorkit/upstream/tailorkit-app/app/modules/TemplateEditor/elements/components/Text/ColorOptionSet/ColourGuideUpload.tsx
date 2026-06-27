import { BlockStack, Box, Button, Divider, DropZone, InlineStack, Text, TextField, Thumbnail } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { type TLayerStore } from '~/stores/modules/layer'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'
import type { OptionSet } from '~/types/psd'

/** Max characters for the modal-level Colour Guide description (shown above swatches). */
const MAX_DESCRIPTION_LENGTH = 500
/** Max characters for a per-colour description (shown under each swatch in the modal). */
const MAX_PER_COLOUR_DESCRIPTION_LENGTH = 200
const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Shape of a single colour inside a ColorOptionSet's data.colors[]. */
interface ColourEntry {
  _id: string
  name?: string
  value?: string
  colourGuideDescription?: string
}

interface ColourGuideData {
  colors?: ColourEntry[]
  colourGuideImageUrl?: string
  colourGuideDescription?: string
}

const EMPTY_DATA: ColourGuideData = Object.freeze({})

interface Props {
  layerStore: TLayerStore
  optionSet: OptionSet
}

/**
 * Per-template Colour Guide override. Lives inside the Text element's
 * Color Option Set edit panel. When set, overrides the shop-wide
 * default configured in Storefront Setup → Colour Guide.
 *
 * Persisted at `optionSet.data.colourGuideImageUrl` via the existing
 * `UPDATE_OPTION_SET` layer store action. Template save flow already
 * serializes the `data` field so no extra wiring is needed.
 */
export default function ColourGuideUpload({ layerStore, optionSet }: Props) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)

  // Subscribe via layer store so the field re-renders after dispatch.
  // optionSet.data is Mongoose Mixed at runtime; cast to a narrow shape we own.
  // Wrap in useMemo with frozen EMPTY_DATA constant so the reference is stable
  // when data is absent — keeps useCallback deps stable across renders.
  const data: ColourGuideData = useMemo(() => (optionSet?.data as ColourGuideData) || EMPTY_DATA, [optionSet])
  const url = useStore(layerStore, () => data.colourGuideImageUrl || '')
  const description = useStore(layerStore, () => data.colourGuideDescription || '')

  const dispatchPatch = useCallback(
    (patch: { colourGuideImageUrl?: string; colourGuideDescription?: string }) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            data: {
              ...data,
              ...patch,
            },
          },
        },
      })
    },
    [layerStore, optionSet, data]
  )

  const dispatchUpdate = useCallback(
    (newUrl: string) => dispatchPatch({ colourGuideImageUrl: newUrl }),
    [dispatchPatch]
  )

  const handleDescriptionChange = useCallback(
    (newDescription: string) => dispatchPatch({ colourGuideDescription: newDescription }),
    [dispatchPatch]
  )

  const handlePerColourDescriptionChange = useCallback(
    (colourId: string, perColourDescription: string) => {
      const colors = (data.colors || []).map(c =>
        c?._id === colourId ? { ...c, colourGuideDescription: perColourDescription } : c
      )
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            data: {
              ...data,
              colors,
            },
          },
        },
      })
    },
    [layerStore, optionSet, data]
  )

  const colours: ColourEntry[] = data.colors || []

  const handleDrop = useCallback(
    async (_files: File[], accepted: File[]) => {
      const file = accepted[0]
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
        dispatchUpdate(res.url)
      } catch (err) {
        console.error('[ColourGuideUpload] upload failed', err)
        showToast(t('upload-failed') || 'Upload failed', { isError: true })
      } finally {
        setUploading(false)
      }
    },
    [dispatchUpdate, t]
  )

  const handleRemove = useCallback(() => dispatchUpdate(''), [dispatchUpdate])

  return (
    <Box padding="200" borderColor="border" borderWidth="025" borderRadius="200">
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" fontWeight="medium">
          {t('colour-guide-image')}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t('colour-guide-template-override-description')}
        </Text>
        {url ? (
          <InlineStack gap="200" blockAlign="center">
            <Thumbnail source={url} alt={t('colour-guide-image')} size="medium" />
            <Button onClick={handleRemove} tone="critical" size="slim" disabled={uploading}>
              {t('remove')}
            </Button>
          </InlineStack>
        ) : (
          <DropZone
            accept="image/jpeg,image/png,image/webp"
            type="image"
            allowMultiple={false}
            onDrop={handleDrop}
            disabled={uploading}
          >
            <DropZone.FileUpload
              actionTitle={uploading ? t('uploading') : t('add-image')}
              actionHint={t('jpeg-png-webp-up-to-5mb')}
            />
          </DropZone>
        )}

        <TextField
          label={t('colour-guide-description')}
          value={description}
          onChange={handleDescriptionChange}
          placeholder={t('colour-guide-description-placeholder')}
          multiline={2}
          autoComplete="off"
          maxLength={MAX_DESCRIPTION_LENGTH}
          showCharacterCount
        />

        {colours.length > 0 && (
          <>
            <Divider />
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {t('colour-guide-per-colour-description')}
            </Text>
            <BlockStack gap="200">
              {colours.map(c => (
                <TextField
                  key={c._id}
                  label={c.name || ''}
                  value={c.colourGuideDescription || ''}
                  onChange={next => handlePerColourDescriptionChange(c._id, next)}
                  placeholder={t('colour-guide-per-colour-description-placeholder')}
                  autoComplete="off"
                  maxLength={MAX_PER_COLOUR_DESCRIPTION_LENGTH}
                />
              ))}
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Box>
  )
}
