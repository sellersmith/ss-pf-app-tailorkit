import { ActionList, Button, ButtonGroup, Popover } from '@shopify/polaris'
import { ChevronDownIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { memo, useCallback, useMemo, useState } from 'react'
import withTooltip from '~/bootstrap/hoc/withTooltip'
import useDevices from '~/utils/hooks/useDevice'
// import { getSaveBarStatus } from '~/utils/shopify'

interface PublishButtonGroupProps {
  disabled?: boolean
  isRepublish: boolean
  loading: boolean
  hasSharedTemplates: boolean
  loadingSharedTemplates: boolean
  onPublish: () => void
  onPublishAll: () => void
  tooltipContent?: string
  t: TFunction
}

/**
 * PublishButtonGroup - Primary publish button with dropdown for "Publish all products" option
 *
 * Displays:
 * - Primary button: Publish/Republish current product
 * - Dropdown option (when templates are shared): Publish all products
 */
export const PublishButtonGroup = memo(function PublishButtonGroup(props: PublishButtonGroupProps) {
  const {
    disabled = false,
    isRepublish,
    loading,
    hasSharedTemplates,
    loadingSharedTemplates,
    onPublish,
    onPublishAll,
    tooltipContent,
    t,
  } = props
  const { isMobileView } = useDevices()
  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopover = useCallback(() => {
    if (!loading && !loadingSharedTemplates) {
      setPopoverActive(prev => !prev)
    }
  }, [loading, loadingSharedTemplates])

  const handlePublish = useCallback(() => {
    setPopoverActive(false)
    onPublish()
  }, [onPublish])

  const handlePublishAll = useCallback(() => {
    setPopoverActive(false)
    onPublishAll()
  }, [onPublishAll])

  const label = isRepublish ? t('republish') : isMobileView ? t('publish') : t('publish-product')
  const publishAllLabel = isRepublish ? t('republish-all-products') : t('publish-all-products')
  const publishAllHelpText = isRepublish ? t('republish-all-products-help-text') : t('publish-all-products-help-text')
  const publishTooltip = tooltipContent
    ? t(tooltipContent)
    : t('save-then-publish-product-so-buyers-can-see-it-on-your-store-and-start-purchasing')
  const publishButtonDisabled = disabled || loadingSharedTemplates
  // const saveBarStatus = getSaveBarStatus()
  const tooltipEnabled = true //publishButtonDisabled || saveBarStatus

  const ButtonWithTooltip = useMemo(() => withTooltip(Button), [])
  // Mobile view - icon only with tooltip
  // if (isSmallMobileView) {
  //   return (
  //     <Tooltip content={label}>
  //       <Button
  //         id="integration-publish-btn"
  //         disabled={disabled}
  //         icon={UploadIcon}
  //         variant="primary"
  //         loading={loading}
  //         onClick={handlePublish}
  //       />
  //     </Tooltip>
  //   )
  // }

  // Desktop view - button with dropdown if templates are shared
  if (!hasSharedTemplates) {
    return (
      <ButtonWithTooltip
        tooltipContent={publishTooltip}
        tooltipEnabled={tooltipEnabled}
        id="integration-publish-btn"
        // icon={UploadIcon}
        variant="primary"
        loading={loading}
        onClick={handlePublish}
        disabled={publishButtonDisabled}
      >
        {label}
      </ButtonWithTooltip>
    )
  }

  return (
    <ButtonGroup variant="segmented">
      <ButtonWithTooltip
        tooltipContent={publishTooltip}
        tooltipEnabled={tooltipEnabled}
        id="integration-publish-btn"
        // icon={UploadIcon}
        variant="primary"
        loading={loading}
        onClick={handlePublish}
        disabled={publishButtonDisabled}
      >
        {label}
      </ButtonWithTooltip>
      <Popover
        active={popoverActive}
        preferredAlignment="right"
        activator={
          <Button
            variant="primary"
            onClick={togglePopover}
            icon={ChevronDownIcon}
            accessibilityLabel={t('more-publish-options')}
            disabled={publishButtonDisabled || loading}
          />
        }
        autofocusTarget="first-node"
        onClose={togglePopover}
      >
        <ActionList
          actionRole="menuitem"
          items={[
            {
              content: publishAllLabel,
              helpText: publishAllHelpText,
              onAction: handlePublishAll,
            },
          ]}
        />
      </Popover>
    </ButtonGroup>
  )
})
