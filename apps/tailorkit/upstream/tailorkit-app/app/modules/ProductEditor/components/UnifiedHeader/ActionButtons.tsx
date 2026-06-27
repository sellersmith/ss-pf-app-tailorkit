import { Button, Tooltip } from '@shopify/polaris'
import { LiveIcon, UploadIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { memo } from 'react'
import { createPortal } from 'react-dom'
import useDevices from '~/utils/hooks/useDevice'

// Re-export PublishButtonGroup
export { PublishButtonGroup } from './components/PublishButtonGroup'

/**
 * PublishButton - Primary/secondary publish/republish action
 */
export const PublishButton = memo(function PublishButton(props: {
  visible: boolean
  isRepublish: boolean
  loading: boolean
  onPublishAction: () => void
  t: TFunction
}) {
  const { visible, isRepublish, loading, onPublishAction, t } = props
  const { isMobileView, isSmallMobileView } = useDevices()
  if (!visible) return null

  const label = isRepublish ? t('republish') : isMobileView ? t('publish') : t('publish-product')

  if (isSmallMobileView) {
    return (
      <Tooltip content={label}>
        <Button
          id="integration-publish-btn"
          // icon={UploadIcon}
          variant="primary"
          loading={loading}
          onClick={onPublishAction}
        />
      </Tooltip>
    )
  }
  return (
    <Button
      id="integration-publish-btn"
      icon={UploadIcon}
      variant="primary"
      loading={loading}
      onClick={onPublishAction}
    >
      {label}
    </Button>
  )
})

/**
 * UnpublishButton - Critical tone unpublish action
 */
export const UnpublishButton = memo(function UnpublishButton(props: {
  visible: boolean
  loading: boolean
  onOpenConfirm: () => void
  t: TFunction
}) {
  const { visible, loading, onOpenConfirm, t } = props

  if (!visible) return null

  // if (isSmallMobileView) {
  //   return (
  //     <Tooltip content={t('unpublish')}>
  //       <Button
  //         id="integration-unpublish-btn"
  //         variant="secondary"
  //         loading={loading}
  //         // tone="critical"
  //         onClick={onOpenConfirm}
  //         icon={UnLinkIconCritical}
  //       />
  //     </Tooltip>
  //   )
  // }

  return (
    <Button
      id="integration-unpublish-btn"
      variant="monochromePlain"
      loading={loading}
      // tone="critical"
      onClick={onOpenConfirm}
    >
      {/* @ts-ignore */}
      <span style={{ textDecoration: 'underline' }}>{t('unpublish')}</span>
    </Button>
  )
})

/**
 * ViewLiveButton - View live product button
 */
export const ViewLiveButton = memo(function ViewLiveButton(props: {
  visible: boolean
  primary: boolean
  onClick: () => void
  t: TFunction
  iconOnly?: boolean
}) {
  const { visible, onClick, t, iconOnly = false } = props
  const { isSmallMobileView } = useDevices()

  if (!visible) return null

  if (isSmallMobileView) {
    return (
      <Tooltip content={t('view-live')}>
        <Button
          icon={LiveIcon}
          onClick={onClick}
          variant="secondary"
          id={'integration-view-live-btn'}
          accessibilityLabel={t('view-live')}
        />
      </Tooltip>
    )
  }
  return (
    <Button
      icon={iconOnly ? LiveIcon : undefined}
      onClick={onClick}
      variant="secondary"
      id={'integration-view-live-btn'}
      accessibilityLabel={t('view-live')}
    >
      {iconOnly ? undefined : t('view-live')}
    </Button>
  )
})

/**
 * HiddenSaveButtonPortal - Hidden save button used by external triggers
 */
export const HiddenSaveButtonPortal = memo(function HiddenSaveButtonPortal(props: {
  isClient: boolean
  saving: boolean
  saveAll: () => void
  t: TFunction
}) {
  const { isClient, saving, saveAll, t } = props
  if (!isClient || typeof document === 'undefined') return null
  return createPortal(
    <div style={{ visibility: 'hidden', position: 'absolute', right: '20px', top: '-30px', zIndex: 1002 }}>
      <Button id="btn-save-integration" disabled={saving} onClick={saveAll}>
        {t('save')}
      </Button>
    </div>,
    document.body
  )
})
