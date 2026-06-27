import type { BoxProps } from '@shopify/polaris'
import { Box, Button, Divider } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { useLiveChat } from '~/utils/hooks/useLiveChat'

export default function GetHelpMessage(props: {
  t: TFunction
  message?: ReactNode
  showDivider?: boolean
  paddingBlock?: BoxProps['paddingBlock']
  paddingInline?: BoxProps['paddingInline']
  onOpenChatBoxCallback?: () => void
}) {
  const { t, message, showDivider = true, paddingBlock = '300', paddingInline = '400', onOpenChatBoxCallback } = props

  const { openChatBox } = useLiveChat()

  const getHelpMessage = (
    <Trans
      t={t}
      components={{
        button: (
          <Button
            variant="plain"
            onClick={() => {
              openChatBox()

              if (typeof onOpenChatBoxCallback === 'function') {
                onOpenChatBoxCallback()
              }
            }}
          />
        ),
      }}
    >
      {message || t('if-you-face-any-challenges-we-re-button-here-to-help-button-every-step-of-the-way')}
    </Trans>
  )

  return (
    <>
      {showDivider && <Divider />}
      <Box paddingBlock={paddingBlock} paddingInline={paddingInline}>
        {getHelpMessage}
      </Box>
    </>
  )
}
