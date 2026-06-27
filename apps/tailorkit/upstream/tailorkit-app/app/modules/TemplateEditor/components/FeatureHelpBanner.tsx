import { BlockStack, Box, Button, Divider, Link, Text } from '@shopify/polaris'
import type { SpaceScale } from '@shopify/polaris/build/ts/src/tokens'
import { useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ELink } from '~/constants/enum'
import { useLiveChat } from '~/utils/hooks/useLiveChat'

interface FeatureHelpBannerProps {
  /** i18n key for the full description text (must contain <tutorial> and <contact> slots) */
  descriptionKey: string
  /** Message to auto-send via Crisp when "Contact us" is clicked. Kept in English as support team reads English. */
  contactMessage: string
  /** URL for "Watch tutorial" link. Defaults to TailorKit YouTube channel. Ignored when onTutorialClick is provided. */
  tutorialUrl?: string
  /** Callback to handle tutorial click inline (e.g. open VideoModal). When provided, overrides tutorialUrl navigation. */
  onTutorialClick?: () => void
  /** Padding around the text content. Defaults to "300". Set to "0" for no padding. */
  padding?: SpaceScale
  /** Hide the divider below the description text. */
  hideDivider?: boolean
}

export default function FeatureHelpBanner({
  descriptionKey,
  contactMessage,
  tutorialUrl = ELink.TAILORKIT_OFFICIAL_YOUTUBE,
  onTutorialClick,
  padding = '300',
  hideDivider = false,
}: FeatureHelpBannerProps) {
  const { t } = useTranslation()
  const { openChatBotAndSendUserMessage } = useLiveChat()

  const handleContactClick = useCallback(() => {
    openChatBotAndSendUserMessage(contactMessage)
  }, [openChatBotAndSendUserMessage, contactMessage])

  // Tutorial link: use inline callback if provided, otherwise external URL
  const tutorialComponent = onTutorialClick ? (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <Link removeUnderline onClick={onTutorialClick} />
  ) : (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <Link url={tutorialUrl} target="_blank" />
  )

  return (
    <BlockStack>
      <Box padding={padding}>
        <Text variant="bodyMd" as="p" tone="subdued">
          <Trans
            t={t}
            components={{
              tutorial: tutorialComponent,
              contact: <Button variant="plain" onClick={handleContactClick} />,
            }}
          >
            {t(descriptionKey)}
          </Trans>
        </Text>
      </Box>
      {!hideDivider && <Divider />}
    </BlockStack>
  )
}
