import { Badge, BlockStack, Box, Button, Card, InlineStack, SkeletonDisplayText, Text } from '@shopify/polaris'
import type { ButtonProps } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppConfig } from '~/hooks/useAppConfig'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'
import { InstallAppBlockActivator } from '~/modules/Onboarding/components/InstallAppBlockOnboardingCard'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import useDevices from '~/utils/hooks/useDevice'
import { Flex } from '~/components/common/Flex'

interface AppBlockStatusCardProps {
  appConfig: {
    enabledAppBlock?: boolean
    enabledAppEmbed?: boolean
    isOS2Theme?: boolean
  }
}

/**
 * AppBlockStatusCard Component
 *
 * A permanent, non-dismissable card that shows the status of app block and theme extension (app embed).
 * This is required for BFS 4.2.3 compliance:
 * "Your app must communicate the status of the theme app block and/or theme app embed on the app's homepage."
 *
 * Features:
 * - Shows count of active extensions (0, 1, or 2)
 * - Shows status badges (Active/Inactive) for each extension
 * - Provides install/activate buttons when extensions are inactive
 * - "Need help?" link opens Crisp chat
 * - NOT dismissable (permanent status indicator)
 */
export default function AppBlockStatusCard({ appConfig: appConfigProps }: AppBlockStatusCardProps) {
  const { t } = useTranslation()
  const { openChatBotAndSendUserMessage } = useLiveChat()
  const { isMobileView } = useDevices()

  // Centralised fetching of appConfig
  const { appConfig, refetch: revalidate, fetched } = useAppConfig(appConfigProps)
  const enabledAppBlock = appConfig?.enabledAppBlock
  const enabledAppEmbed = appConfig?.enabledAppEmbed
  const isOS2Theme = appConfig?.isOS2Theme

  const handleNeedHelp = useCallback(() => {
    const message = t('i-need-help-setting-up-my-app-block-and-theme-extension')
    openChatBotAndSendUserMessage(message)
  }, [openChatBotAndSendUserMessage, t])

  return (
    <Card padding="400">
      <BlockStack gap="300">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            {t('app-block-and-app-embed-status')}
          </Text>
          <Button variant="plain" onClick={handleNeedHelp}>
            {t('need-help')}
          </Button>
        </InlineStack>

        {/* Two-column status */}
        <Flex direction={isMobileView ? 'column' : 'row'} gap="12px">
          {/* App Embed Column (primary — required for personalization to work) */}
          <Box minWidth="0" width={isMobileView ? '100%' : '50%'}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="bodyMd" fontWeight="semibold">
                  {t('app-embed')}
                </Text>
                <Badge tone={!fetched ? 'info' : enabledAppEmbed ? 'success' : 'warning'}>
                  {!fetched ? t('checking') : enabledAppEmbed ? t('active') : t('inactive')}
                </Badge>
              </InlineStack>

              {!fetched ? (
                <SkeletonDisplayText size="small" maxWidth="60%" />
              ) : (
                <Text as="p" variant="bodyMd">
                  {enabledAppEmbed
                    ? t('personalization-is-active-on-your-store')
                    : t('personalization-will-not-work-until-app-embed-is-activated')}
                </Text>
              )}

              {/* Activate button when inactive */}
              {!fetched ? (
                <SkeletonDisplayText size="small" maxWidth="40%" />
              ) : (
                !enabledAppEmbed
                && isOS2Theme && (
                  <InstallAppEmbedActivator
                    appConfig={appConfig}
                    showDescription={false}
                    buttonProps={
                      {
                        variant: 'primary',
                        fullWidth: false,
                        children: t('activate-app-embed'),
                      } as ButtonProps
                    }
                    revalidate={revalidate}
                  />
                )
              )}
            </BlockStack>
          </Box>

          {/* App Block Column (optional — fallback panel covers missing app block) */}
          <Box minWidth="0" width={isMobileView ? '100%' : '50%'}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="bodyMd" fontWeight="semibold">
                  {t('app-block')}
                </Text>
                <Badge tone={!fetched ? 'info' : enabledAppBlock ? 'success' : 'warning'}>
                  {!fetched ? t('checking') : enabledAppBlock ? t('installed') : t('not-installed')}
                </Badge>
              </InlineStack>

              {!fetched ? (
                <SkeletonDisplayText size="small" maxWidth="60%" />
              ) : (
                <Text as="p" variant="bodyMd">
                  {enabledAppBlock
                    ? t('app-block-is-installed-on-your-product-page')
                    : t('not-installed-a-fallback-panel-will-appear-automatically-for-your-customers')}
                </Text>
              )}

              {/* Install button when inactive */}
              {!fetched ? (
                <SkeletonDisplayText size="small" maxWidth="40%" />
              ) : (
                !enabledAppBlock
                && isOS2Theme && (
                  <InstallAppBlockActivator
                    appConfig={appConfig}
                    showCommonIssues={false}
                    showDescription={false}
                    buttonProps={
                      {
                        variant: 'primary',
                        fullWidth: false,
                        children: t('install-app-block'),
                      } as ButtonProps
                    }
                    revalidate={revalidate}
                  />
                )
              )}
            </BlockStack>
          </Box>
        </Flex>
      </BlockStack>
    </Card>
  )
}
