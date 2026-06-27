import { memo, useCallback, useMemo } from 'react'
import { Box, Button, Spinner } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { IItem } from './ListItems'
import { TemplateTitleUIComponent } from '~/modules/TemplateEditor/components/Header/TemplateTitle'
import { getShopifyThumbnail } from '~/utils/loadImage'
import UsesBadge from '~/components/UsesBadge/UsesBadge'

interface TemplateGridItemProps {
  item: IItem & { name?: string }
  index: number
  stylesImageItem?: React.CSSProperties
  showCheckbox?: boolean
  imageInSpecificWidth?: number
  showTitle?: boolean
  showViewDemoButton?: boolean
  showSelectButton?: boolean
  productPageUrl?: string
  onClickItem?: (newCheck: boolean, item: IItem) => void
}

export const TemplateGridItem = memo(function TemplateGridItem(props: TemplateGridItemProps) {
  const {
    item,
    index,
    onClickItem,
    stylesImageItem,
    showCheckbox = true,
    imageInSpecificWidth = 180,
    showTitle = true,
    showViewDemoButton = false,
    showSelectButton = false,
    productPageUrl,
  } = props
  const { t } = useTranslation()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      // Prevent click when selecting
      if (item.isSelecting) return
      onClickItem?.(!item.selected, item)
    },
    [item, onClickItem]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        // Prevent keyboard action when selecting
        if (item.isSelecting) return
        onClickItem?.(!item.selected, item)
      }
    },
    [item, onClickItem]
  )

  const thumbnailUrl = useMemo(
    () => getShopifyThumbnail(item.previewUrl, imageInSpecificWidth),
    [item.previewUrl, imageInSpecificWidth]
  )
  const checked = !!item.selected
  const isSelecting = !!item.isSelecting
  const title = (item as any).name || item.alt || ''

  return (
    <div
      id={`template-item-${index}`}
      style={{
        cursor: isSelecting ? 'wait' : 'pointer',
        opacity: isSelecting ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Box borderWidth="025" borderColor="border" borderRadius="200">
        <div style={{ position: 'relative', height: 135, ...stylesImageItem }}>
          {showCheckbox && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1,
                width: 18,
                height: 19,
                borderRadius: 9999,
                background: 'var(--p-color-bg-fill)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isSelecting ? 'wait' : 'pointer',
              }}
              aria-checked={checked}
              role="radio"
              tabIndex={isSelecting ? -1 : 0}
              aria-label="Select template"
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 9999,
                  background: checked ? 'var(--p-color-text)' : 'transparent',
                }}
              />
            </div>
          )}

          <img
            src={thumbnailUrl}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 8 }}
            loading="lazy"
            decoding="async"
          />

          {/* Uses badge - only show if clickCount is available */}
          {(item as any).clickCount !== undefined && <UsesBadge clickCount={(item as any).clickCount} />}

          {/* Loading overlay when selecting */}
          {isSelecting && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <Spinner size="small" />
            </div>
          )}
        </div>
      </Box>

      {showViewDemoButton && productPageUrl && (
        <div role="group" style={{ marginTop: '4px' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          {showSelectButton && (
            <Button size="slim" fullWidth onClick={() => onClickItem?.(!item.selected, item)}>
              {t('select')}
            </Button>
          )}
          <div style={{ marginTop: showSelectButton ? '4px' : 0 }}>
            <Button
              variant="tertiary"
              size="slim"
              fullWidth
              onClick={() => window.open(productPageUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('view-demo')}
            </Button>
          </div>
        </div>
      )}

      {showTitle !== false && (
        <Box padding={'200'}>
          <TemplateTitleUIComponent name={title} maxWidth={'100%'} showTooltip={true} />
        </Box>
      )}
    </div>
  )
})
