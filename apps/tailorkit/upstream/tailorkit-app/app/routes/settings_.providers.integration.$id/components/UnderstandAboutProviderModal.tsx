/* eslint-disable jsx-a11y/anchor-has-content */
import { BlockStack, Box, Button, Checkbox, InlineStack, Link, List, Text } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { LEARN_MORE_PRINTIFY_CHOICE, LEARN_MORE_PROVIDER_PER_PRODUCT, UNDERSTAND_ABOUT_PROVIDER } from '../constants'
import { Modal, TitleBar } from '@shopify/app-bridge-react'
import { hideUnderstandAboutProviderModal } from '../utilities/hideUnderstandAboutProviderModal'

interface IUnderstandAboutProviderModalProps {
  active: boolean
  providerId: string
  onClose: () => void
}

export const UnderstandAboutProviderModal = (props: IUnderstandAboutProviderModalProps) => {
  const { active, providerId, onClose } = props
  const { t } = useTranslation()
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const onHide = useCallback(async () => {
    onClose()
  }, [onClose])

  const onDone = useCallback(async () => {
    if (dontShowAgain) {
      await hideUnderstandAboutProviderModal({ providerId, dontShowAgain })
    }
    onClose()
  }, [dontShowAgain, onClose, providerId])

  return (
    <Modal id={UNDERSTAND_ABOUT_PROVIDER} open={active} onHide={onHide}>
      <TitleBar title={t('understand-about-providers')}></TitleBar>
      <BlockStack>
        <Box padding={'400'}>
          <BlockStack gap={'100'}>
            <Text as={'p'} variant={'bodyMd'}>
              {t('fulfillment-requires-a-selected-provider-tailorkit-offers-two-options')}
            </Text>
            <List>
              <List.Item>
                <Trans
                  i18nKey={'Manually select <url>a provider per product</url>.'}
                  components={{ url: <Link url={LEARN_MORE_PROVIDER_PER_PRODUCT} removeUnderline target="_blank" /> }}
                />
              </List.Item>
              <List.Item>
                <Trans
                  i18nKey={'Assigning automatically <url>the Printify Choice.</url>'}
                  components={{ url: <Link url={LEARN_MORE_PRINTIFY_CHOICE} removeUnderline target="_blank" /> }}
                />
              </List.Item>
            </List>
          </BlockStack>
        </Box>
        <Box padding={'400'} borderColor="border" borderBlockStartWidth="025" background="bg-surface-tertiary">
          <InlineStack align="space-between">
            <Checkbox checked={dontShowAgain} onChange={setDontShowAgain} label={t('don-t-show-again')} />
            <Button variant={'primary'} onClick={onDone}>
              {t('done')}
            </Button>
          </InlineStack>
        </Box>
      </BlockStack>
    </Modal>
  )
}
