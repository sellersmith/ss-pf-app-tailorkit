import { BlockStack, Box, Button, Grid, Image, InlineStack, Spinner, Text } from '@shopify/polaris'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELink } from '~/constants/enum'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { TemplateTitleUIComponent } from '~/modules/TemplateEditor/components/Header/TemplateTitle'
import type { PrintArea } from '~/types/integration'
import type { Template } from '~/types/psd'
import { getShopifyThumbnail } from '~/utils/loadImage'
import UsesBadge from '~/components/UsesBadge/UsesBadge'
import { trackAssetClick } from '~/utils/trackClipartClick'
import { AssetType, ClickContext } from '~/models/ClipartClickEvent'

interface ITemplateListContainerProps {
  templates: Template[]
  templateSelected?: PrintArea['template']
  onTemplateSelectedChange: (template?: PrintArea['template']) => void
  loading: boolean
  loadingMore: boolean
  existedTemplates: boolean
  renderEmptyTemplate: React.ReactNode
  /** When true (TailorKit cliparts tab): hides title and shows "View demo" button */
  isClipartTab?: boolean
}

// Simplified container component
export const TemplateListContainer = memo(function TemplateListContainer(props: ITemplateListContainerProps) {
  const {
    existedTemplates,
    templates,
    templateSelected,
    onTemplateSelectedChange,
    loading,
    loadingMore,
    renderEmptyTemplate,
    isClipartTab = false,
  } = props

  // Extract selected template ID once to avoid repeated computations
  const selectedTemplateId = useMemo(() => {
    return typeof templateSelected === 'string' ? templateSelected : templateSelected?._id
  }, [templateSelected])

  // Memoize template click handler to avoid recreating it for each template
  const handleTemplateClick = useCallback(
    (template: Template) => {
      // Track template click in database
      trackAssetClick({
        assetId: template._id,
        assetType: AssetType.CLIPART,
        context: ClickContext.MODAL_TEMPLATE_LISTING,
      }).catch(() => {
        // Silently fail - don't block user interaction
      })

      onTemplateSelectedChange(template)
    },
    [onTemplateSelectedChange]
  )

  // Show loading state for initial load
  if (loading) {
    return (
      <Box padding={'500'}>
        <BlockStack align="center" inlineAlign="center" gap="400">
          <Spinner />
        </BlockStack>
      </Box>
    )
  }

  // Show empty template modal if no templates exist
  if (!existedTemplates) {
    return <>{renderEmptyTemplate}</>
  }

  // Show no results found for search
  if (templates.length === 0) {
    return (
      <Box padding={'500'}>
        <BlockStack align="center" inlineAlign="center">
          <Image source={ILLUSTRATORS.SEARCH_IMAGE} alt="Search image" width={60} height={60} />
          <Text as="h3" variant="headingLg">
            No template found
          </Text>
          <Text as="p" variant="bodyMd">
            Try changing the search term
          </Text>
        </BlockStack>
      </Box>
    )
  }

  // Show template list with loading indicator at bottom when loading more
  return (
    <div>
      <Grid columns={{ xs: 2, md: 3, lg: 3 }}>
        {templates.map((template, index) => (
          <Grid.Cell key={template._id}>
            <TemplateItem
              template={template}
              checked={selectedTemplateId === template._id}
              onTemplateClick={handleTemplateClick}
              index={index}
              isClipartTab={isClipartTab}
            />
          </Grid.Cell>
        ))}
      </Grid>
      {loadingMore && (
        <InlineStack blockAlign="center" align="center">
          <Box padding="400">
            <BlockStack align="center">
              <Spinner size="small" />
            </BlockStack>
          </Box>
        </InlineStack>
      )}
    </div>
  )
})

interface ITemplateItemProps {
  template: Template
  checked: boolean
  onTemplateClick: (template: Template) => void
  index: number
  isClipartTab?: boolean
}

// Simplified template item component
const TemplateItem = memo(
  function TemplateItem(props: ITemplateItemProps) {
    const { template, checked, onTemplateClick, index, isClipartTab = false } = props
    const { t } = useTranslation()

    // productPageUrl is present on clipart templates fetched from the TailorKit tab
    const productPageUrl = (template as Template & { productPageUrl?: string }).productPageUrl

    // Track image loading error state
    const [imageError, setImageError] = useState(false)

    // Memoize the click handler to avoid recreating it on each render
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        onTemplateClick(template)
      },
      [template, onTemplateClick]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onTemplateClick(template)
        }
      },
      [template, onTemplateClick]
    )

    // Memoize thumbnail URL to avoid repeated function calls
    const thumbnailUrl = useMemo(
      () => getShopifyThumbnail(template.thumbnailUrl || template.previewUrl),
      [template.thumbnailUrl, template.previewUrl]
    )

    /**
     * Handle image load error by showing default placeholder
     */
    const handleImageError = useCallback(() => {
      setImageError(true)
    }, [])

    return (
      <div id={`template-item-${index}`} style={{ cursor: 'pointer' }}>
        <Box borderWidth="025" borderColor="border" borderRadius="200">
          <div
            style={{ position: 'relative', aspectRatio: '1/1', height: 'auto', objectFit: 'cover' }}
            onClick={handleClick}
          >
            {/* Radio overlay */}
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
                cursor: 'pointer',
              }}
              aria-checked={checked}
              role="radio"
              tabIndex={0}
              aria-label="Select template"
              onClick={handleClick}
              onKeyDown={handleKeyDown}
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

            {/* Preview image */}
            <img
              src={imageError || !thumbnailUrl ? ELink.IMAGE_PREVIEW_PLACEHOLDER : thumbnailUrl}
              alt={template.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 8 }}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />

            {/* Uses badge - only show for TailorKit templates */}
            {'clickCount' in template && template.clickCount !== undefined && (
              <UsesBadge clickCount={template.clickCount as number} />
            )}
          </div>
        </Box>

        {/* View demo button — TailorKit cliparts tab only */}
        {isClipartTab && productPageUrl && (
          <Box paddingBlockStart="100">
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button
                variant="tertiary"
                size="slim"
                fullWidth
                onClick={() => window.open(productPageUrl, '_blank', 'noopener,noreferrer')}
              >
                {t('view-demo')}
              </Button>
            </div>
          </Box>
        )}

        {/* Title — hidden on TailorKit cliparts tab */}
        {!isClipartTab && (
          <Box padding={'200'}>
            <TemplateTitleUIComponent name={template.name} maxWidth={'100%'} showTooltip={false} />
          </Box>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Simplified comparison - only check what actually matters for rendering
    return (
      prevProps.template._id === nextProps.template._id
      && prevProps.checked === nextProps.checked
      && prevProps.index === nextProps.index
      && prevProps.isClipartTab === nextProps.isClipartTab
    )
  }
)
