import { BlockStack, Box, Button, InlineGrid, Modal, Scrollable, Tabs, Text } from '@shopify/polaris'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { ELink } from '~/constants/enum'
import { EPlacementType } from '~/enums/checkbox'

interface InstallCheckboxModalProps {
  typePlacement?: EPlacementType
  appConfig?: {
    isOS2Theme?: boolean
    checkboxBlockLinkProduct?: string
    checkboxBlockLinkCart?: string
  }
}

const OS2ThemeTab = memo(function OS2ThemeTab({
  typePlacement,
  checkboxBlockLinkProduct,
  checkboxBlockLinkCart,
}: {
  typePlacement?: EPlacementType
  checkboxBlockLinkProduct?: string
  checkboxBlockLinkCart?: string
}) {
  const { t } = useTranslation()

  // Use the appropriate link based on placement type
  const checkboxBlockLink = typePlacement === EPlacementType.CART ? checkboxBlockLinkCart : checkboxBlockLinkProduct

  const handleGoToThemeEditor = useCallback(() => {
    if (checkboxBlockLink) {
      window.open(checkboxBlockLink, '_blank')
    }
  }, [checkboxBlockLink])

  return (
    <InlineGrid columns={{ xs: 1, sm: 1, md: '1.2fr 1fr' }} gap="400">
      <Box minHeight="316px">
        <video
          controls
          autoPlay
          style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
          poster={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS}
        >
          <source src={ELink.INSTALL_TAILORKIT_APP_BLOCK_VIDEO} type="video/mp4" />
          {t('your-browser-does-not-support-the-video-tag')}
        </video>
      </Box>

      <Box paddingBlockEnd="400" paddingBlockStart="400">
        <BlockStack gap="400">
          <Text as="span" variant="bodyMd">
            {t('to-add-addon-on-os-2-theme-go-to-theme-editor-click')}{' '}
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {t('add-block-apps-tailorkit-addon-products')}
            </Text>
          </Text>
          <Text as="span" variant="bodyMd">
            {typePlacement === EPlacementType.CART
              ? t('please-note-tailorkit-addon-blocks-must-be-placed-inside-cart-page')
              : t('please-note-tailorkit-addon-blocks-must-be-placed-inside-product-section')}
          </Text>

          <Button variant="primary" onClick={handleGoToThemeEditor}>
            {t('go-to-theme-editor')}
          </Button>
        </BlockStack>
      </Box>
    </InlineGrid>
  )
})

const VintageThemeTab = memo(function VintageThemeTab() {
  const { t } = useTranslation()

  const liquidCode = `{% if section.settings.product %}
  {% assign product = section.settings.product %}
{% endif %}

{% assign currentProduct = product.id | append: '' %}
{% assign currentProductTitle = product.title | append: '' %}

<onetick-group-checkboxes
  data-onetick-theme-code="true"
  data-target-product="{{ currentProduct }}"
  data-target-product-title="{{ currentProductTitle }}"
></onetick-group-checkboxes>`

  const handleCopyCode = useCallback(async () => {
    showToast(t(TOAST.COMMON.COPYING))
    if (window.navigator) {
      await navigator.clipboard.writeText(liquidCode)
    }
    showToast(t(TOAST.COMMON.COPIED))
  }, [liquidCode, t])

  return (
    <InlineGrid columns={{ xs: 1, sm: 1, md: '1.2fr 1fr' }} gap="400">
      <Box padding="300" minHeight="316px" background="bg-surface-secondary" borderRadius="300">
        <Scrollable style={{ height: '292px' }}>
          <Text as="span" variant="bodyMd" breakWord>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>{liquidCode}</pre>
          </Text>
        </Scrollable>
      </Box>

      <Box paddingBlockEnd="400" paddingBlockStart="400">
        <BlockStack gap="400">
          <Text as="span" variant="bodyMd">
            {t('copy-and-paste-this-code-snippet-to-embed-tailorkit-addon-products-into-vintage-themes')}
          </Text>

          <Button variant="primary" onClick={handleCopyCode}>
            {t('copy-code')}
          </Button>
        </BlockStack>
      </Box>
    </InlineGrid>
  )
})

const MemoizedModalContent = memo(function ModalContent({
  typePlacement,
  checkboxBlockLinkProduct,
  checkboxBlockLinkCart,
}: {
  typePlacement?: EPlacementType
  checkboxBlockLinkProduct?: string
  checkboxBlockLinkCart?: string
}) {
  const { t } = useTranslation()
  const [selectedTab, setSelectedTab] = useState(0)

  const tabs = [
    {
      id: 'OS2-theme',
      content: t('os-2-0-theme'),
      accessibilityLabel: t('os-2-0-theme'),
      panelID: 'OS2-theme',
    },
    {
      id: 'vintage-theme',
      content: t('vintage-themes-and-page-builders'),
      panelID: 'vintage-theme',
    },
  ]

  return (
    <>
      <Box padding="200" borderBlockEndWidth="025" borderColor="border">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
      </Box>

      <Box padding="400">
        {selectedTab === 0 ? (
          <OS2ThemeTab
            typePlacement={typePlacement}
            checkboxBlockLinkProduct={checkboxBlockLinkProduct}
            checkboxBlockLinkCart={checkboxBlockLinkCart}
          />
        ) : (
          <VintageThemeTab />
        )}
      </Box>
    </>
  )
})

function InstallCheckboxModal({ typePlacement, appConfig }: InstallCheckboxModalProps) {
  const { t } = useTranslation()
  const { state: stateModal, closeModal } = useModal()
  const { openChatBox } = useLiveChat()

  const stateModalInstallCheckbox = stateModal[MODAL_ID.INSTALL_CHECKBOX_MODAL]
  const isOpen = stateModalInstallCheckbox?.active

  usePreventPageScroll(isOpen)

  const handleCloseModal = useCallback(() => {
    closeModal(MODAL_ID.INSTALL_CHECKBOX_MODAL)
  }, [closeModal])

  const handleContactUs = useCallback(() => {
    handleCloseModal()
    openChatBox()
  }, [handleCloseModal, openChatBox])

  return (
    <Modal
      open={isOpen}
      onClose={handleCloseModal}
      title={t('install-addon-products')}
      secondaryActions={[
        {
          content: t('close'),
          onAction: handleCloseModal,
        },
      ]}
      size="large"
      footer={
        <Text as="span" variant="bodyMd">
          {t('have-trouble-installing-tailorkit-addon-products')}{' '}
          <Button variant="plain" onClick={handleContactUs}>
            {t('contact-support')}
          </Button>
        </Text>
      }
    >
      <MemoizedModalContent
        typePlacement={typePlacement}
        checkboxBlockLinkProduct={appConfig?.checkboxBlockLinkProduct}
        checkboxBlockLinkCart={appConfig?.checkboxBlockLinkCart}
      />
    </Modal>
  )
}

export default memo(InstallCheckboxModal)
