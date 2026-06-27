/* eslint-disable max-len */
import { useEffect } from 'react'
import { PageActions } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { CONTEXTUAL_SAVE_BAR_ID } from '~/constants'
import { SaveBar, useAppBridge } from '@shopify/app-bridge-react'

export type ContextualSaveBar = {
  isOpen: boolean
  showPageAction?: boolean
  onDiscard: () => void
  onSave: () => void
  loading?: boolean
}

export default function ContextualSaveBar(props: ContextualSaveBar) {
  const { t } = useTranslation()
  const { isOpen, onDiscard, onSave, showPageAction = false, loading } = props
  const shopifyAppBridge = useAppBridge()

  useEffect(() => {
    if (isOpen) {
      shopifyAppBridge.saveBar.show(CONTEXTUAL_SAVE_BAR_ID)
    } else {
      shopifyAppBridge.saveBar.hide(CONTEXTUAL_SAVE_BAR_ID)
    }
  }, [isOpen, shopifyAppBridge, loading])

  return (
    <>
      {/**
       * ContextualSaveBar error if discardConfirmation is assigned to boolean.
       *
       * @see https://github.com/Shopify/shopify-app-bridge/issues/321
       */}
      {/* @ts-ignore */}
      <SaveBar id={CONTEXTUAL_SAVE_BAR_ID} discardConfirmation="">
        {/**
         * The string must be empty for loading to work.
         *
         * @see https://shopify.dev/docs/api/app-bridge-library/react-components/savebar#savebar-with-different-options-setting-the-loading-state-of-the-save-and-discard-buttons
         */}
        <button variant="primary" onClick={onSave} loading={loading ? '' : undefined} />
        <button onClick={onDiscard} disabled={loading} />
      </SaveBar>

      {showPageAction && (
        <PageActions
          primaryAction={{
            content: t('save'),
            onAction: onSave,
            disabled: !isOpen,
            loading: loading,
          }}
        />
      )}
    </>
  )
}
