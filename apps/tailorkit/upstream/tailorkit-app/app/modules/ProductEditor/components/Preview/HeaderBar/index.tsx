import { Box, Button, InlineStack } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ProductTitle from '../../HeaderBar/ProductTitle'
import { useEditorParams } from '~/modules/ProductEditor/hooks/useEditorParams'
import { EDITOR_TABS } from '~/modules/ProductEditor/constants'

export const HeaderBar = () => {
  const { t } = useTranslation()
  const { setTab } = useEditorParams()

  const handleBackEditor = useCallback(() => {
    setTab(EDITOR_TABS.MOCKUP)
  }, [setTab])

  return (
    <Box padding={'200'}>
      <InlineStack align="space-between" blockAlign="center">
        <ProductTitle />
        <Button icon={EditIcon} onClick={handleBackEditor}>
          {t('back-editor')}
        </Button>
      </InlineStack>
    </Box>
  )
}
