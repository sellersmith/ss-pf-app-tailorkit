/**
 * InlineImageBrowser - Compact image browser for the Guide Image sidebar panel.
 * Uses the same data source as ImageSelector but renders inline (no modal).
 * Single-click selects the image immediately.
 *
 * Layout: flex column that fills its parent. The Scrollable grid area takes
 * flex:1 so it expands/shrinks based on available sidebar space.
 */

import { Icon, Scrollable, Spinner, Text, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useImageSelector } from '~/modules/modals/ImageSelector/hooks/useImageSelector'
import ImageSelectorGrid from '~/modules/modals/ImageSelector/components/ImageSelectorGrid'
import type { IImageQuery } from '~/types/shopify-files'

interface InlineImageBrowserProps {
  /** Called when user clicks an image — instant selection, no "Done" step */
  onSelectImage: (imageUrl: string) => void
}

export default function InlineImageBrowser({ onSelectImage }: InlineImageBrowserProps) {
  const { t } = useTranslation()

  const {
    textFieldValue,
    mediaList,
    isFetching,
    fetchNextPage,
    deferredQuery,
    setTextFieldValue,
    handleFetchMoreMedia,
  } = useImageSelector({
    onSelectImage: () => {},
    onClose: () => {},
  })

  // Instant select on click — no multi-select, no "Done" button
  const handleImageClick = (image: IImageQuery) => {
    if (image?.image?.originalSrc) {
      onSelectImage(image.image.originalSrc)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p-space-200)', height: '100%', minHeight: 0 }}>
      <Text as="h3" variant="headingSm">
        {t('shop-images')}
      </Text>
      <TextField
        label=""
        labelHidden
        placeholder={t('search-images')}
        value={textFieldValue}
        onChange={setTextFieldValue}
        prefix={<Icon source={SearchIcon} />}
        autoComplete="off"
        clearButton
        onClearButtonClick={() => setTextFieldValue('')}
      />
      <Scrollable
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        onScrolledToBottom={() => setTimeout(handleFetchMoreMedia, 200)}
      >
        {isFetching && !mediaList?.length ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-400)' }}>
            <Spinner size="small" accessibilityLabel={t('loading-images')} />
          </div>
        ) : (
          <ImageSelectorGrid
            files={mediaList || []}
            isLoading={fetchNextPage}
            isFetching={isFetching}
            imagesSelected={[]}
            onSelectImages={() => {}}
            onImageClick={handleImageClick}
            showEmpty
            deferredQuery={deferredQuery}
            gridColumns={{ xs: 2, sm: 2, md: 3 }}
            showCheckbox={false}
            thumbnailFullWidth
          />
        )}
      </Scrollable>
    </div>
  )
}
