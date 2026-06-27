import { Box, Button, InlineStack, Tooltip } from '@shopify/polaris'
import { LightbulbIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalVideoTutorialComponent } from '~/routes/dashboard/components/GetStartedCard'

export function ButtonTutorial() {
  const { t } = useTranslation()
  const [modalVideoTutorialOpen, setModalVideoTutorialOpen] = useState(false)

  const onCloseModalVideoTutorial = useCallback(() => {
    setModalVideoTutorialOpen(false)
  }, [])

  const onOpenModalVideoTutorial = useCallback(() => {
    setModalVideoTutorialOpen(true)
  }, [])

  return (
    <Box>
      <InlineStack>
        <Tooltip content={t('learn-how-to-create-ai-powered-personalized-product')}>
          <Button icon={LightbulbIcon} variant="plain" onClick={onOpenModalVideoTutorial} />
        </Tooltip>
      </InlineStack>
      <ModalVideoTutorialComponent
        open={modalVideoTutorialOpen}
        onClose={onCloseModalVideoTutorial}
        secondaryActions={[
          {
            content: t('close'),
            onAction: onCloseModalVideoTutorial,
          },
        ]}
      />
    </Box>
  )
}
