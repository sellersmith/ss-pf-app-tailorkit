import { BlockStack, Button, ButtonGroup, Card, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { EModal } from '~/constants/enum'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { useModal } from '~/utils/hooks/useModal'

const AppUninstallation = () => {
  const { openModal } = useModal()
  const { t } = useTranslation()

  return (
    <SettingLayout title={t('app-uninstallation')}>
      <Card roundedAbove="sm">
        <BlockStack gap={'300'}>
          <BlockStack gap={'150'}>
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('app-uninstall-description-1')}
            </Text>
          </BlockStack>

          <ButtonGroup>
            <Button tone="critical" variant="primary" onClick={() => openModal(EModal.APP_UNINSTALL_MODAL)}>
              {t('uninstall')}
            </Button>
          </ButtonGroup>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}

export default AppUninstallation
