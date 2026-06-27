/* eslint-disable jsx-a11y/anchor-has-content */
import { Bleed, BlockStack, Box, Checkbox, InlineStack, Link, Spinner, Text } from '@shopify/polaris'
import { memo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { LEARN_MORE_PRINTIFY_CHOICE } from '../constants'

function ConfirmUsingPrintifyChoice(props: {
  confirmUsingPrintifyChoice: boolean
  loading: boolean
  handleConfirmUsingPrintifyChoice: (confirm: boolean) => Promise<void>
}) {
  const { confirmUsingPrintifyChoice, loading, handleConfirmUsingPrintifyChoice } = props
  const { t } = useTranslation()

  const renderLabel = (
    <Text variant="bodyMd" as="p">
      {t('i-confirm-using-the-printify-choice-for-imports')}
    </Text>
  )

  return (
    <Box paddingBlockStart={'200'}>
      <BlockStack gap={'050'}>
        <Text variant="bodyMd" as="p" fontWeight="medium">
          {t('set-printify-choice-as-the-default-for-all')}
        </Text>
        <Text variant="bodyMd" as="span">
          <Trans
            t={t}
            components={{
              url: <Link url={LEARN_MORE_PRINTIFY_CHOICE} target="_blank" removeUnderline />,
            }}
          >
            {t('confirm-using-the-printify-choice-for-imports-description')}
          </Trans>
        </Text>
        {loading ? (
          <InlineStack gap={'300'} blockAlign="center">
            <Bleed marginBlockEnd={'100'}>
              <Spinner size="small" />
            </Bleed>
            {renderLabel}
          </InlineStack>
        ) : (
          <Checkbox
            checked={confirmUsingPrintifyChoice}
            label={renderLabel}
            onChange={(newCheck: boolean) => {
              handleConfirmUsingPrintifyChoice(newCheck)
            }}
          />
        )}
      </BlockStack>
    </Box>
  )
}

export default memo(ConfirmUsingPrintifyChoice)
