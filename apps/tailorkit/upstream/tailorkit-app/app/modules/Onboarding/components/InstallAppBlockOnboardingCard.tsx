/* eslint-disable max-len */
import type { ButtonProps } from '@shopify/polaris'
import { Bleed, BlockStack, Box, Button, InlineStack, List, Text } from '@shopify/polaris'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { CollapsibleSection } from '~/modules/CollapsibleSection'
import { VintageThemeTailorKitInstallation } from '~/routes/settings.preferences/components/VintageThemeTailorKitInstallation'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useInstallAppBlock } from '~/hooks/useInstallAppBlock'

interface IInstallAppBlockActivatorProps {
  appConfig: any
  buttonProps?: ButtonProps
  showDescription?: boolean
  showCommonIssues?: boolean
  showActionGroup?: boolean
  revalidate: () => void
  preventRecursive?: boolean
  showContactSupportButton?: boolean
  onAfterContactSupport?: () => void
}

export function InstallAppBlockActivator(props: IInstallAppBlockActivatorProps) {
  const {
    appConfig = {},
    buttonProps,
    showDescription = true,
    showActionGroup = true,
    revalidate,
    showContactSupportButton = false,
    showCommonIssues = true,
    onAfterContactSupport,
  } = props
  const { enabledAppBlock, customizerLink } = appConfig
  const { openChatBox } = useLiveChat()
  const { t } = useTranslation()

  // Use install app block hook
  const { showCountdown, countdown, isChecking, installFailed, onInstallingAppBlock } = useInstallAppBlock({
    customizerLink,
    enabledAppBlock,
    revalidate,
    appBlockDiagnostics: appConfig.appBlockDiagnostics,
  })

  return !appConfig.isOS2Theme ? (
    <VintageThemeTailorKitInstallation />
  ) : (
    <BlockStack gap="400">
      <InstallAppBlockDescription
        showDescription={showDescription}
        enabledAppBlock={enabledAppBlock}
        showCommonIssues={showCommonIssues}
      />

      {/* Action buttons */}
      {!enabledAppBlock && showActionGroup && (
        <InlineStack gap="200" align="start" blockAlign="center">
          {showContactSupportButton && (
            <Button
              variant="secondary"
              onClick={() => {
                openChatBox()
                onAfterContactSupport?.()
              }}
            >
              {t('contact-support')}
            </Button>
          )}

          {/* Install app block button - always visible */}
          {buttonProps ? (
            <Button {...buttonProps} onClick={onInstallingAppBlock} />
          ) : (
            <Button variant="primary" onClick={onInstallingAppBlock}>
              {t('install-app-block')}
            </Button>
          )}

          {/* Check installation button - shown after installation attempt */}
          {showCountdown && (
            <Button
              variant="monochromePlain"
              // onClick={handleCheckInstallation}
              loading={isChecking}
              disabled={true}
            >
              {isChecking ? 'Installing...' : countdown > 0 ? `Installing... (${countdown}s)` : 'Installing...'}
            </Button>
          )}
          {installFailed && (
            <Text as="span" variant="bodySm" tone="critical">
              {t('installation-failed')}
            </Text>
          )}
        </InlineStack>
      )}

      {enabledAppBlock && (
        <InlineStack>
          <Button icon={CheckCircleIcon} disabled={true} variant="primary">
            {t('install-app-block')}
          </Button>
        </InlineStack>
      )}
    </BlockStack>
  )
}

interface IInstallAppBlockOnboardingCardProps {
  appConfig: any
  buttonProps?: ButtonProps
  revalidate: () => void
  showActionGroup?: boolean
  tutorialContent?: ReactNode
  onAfterContactSupport?: () => void
}

export function InstallAppBlockOnboardingCard(props: IInstallAppBlockOnboardingCardProps) {
  const {
    appConfig = {},
    buttonProps,
    revalidate,
    tutorialContent,
    onAfterContactSupport,
    showActionGroup = true,
  } = props
  return (
    <Box>
      <InlineStack gap="300" align="start" wrap={false}>
        <BlockStack gap="400">
          <InstallAppBlockActivator
            showActionGroup={showActionGroup}
            showCommonIssues
            showContactSupportButton
            appConfig={appConfig}
            buttonProps={buttonProps}
            revalidate={revalidate}
            onAfterContactSupport={onAfterContactSupport}
          />

          {tutorialContent}
        </BlockStack>
      </InlineStack>
    </Box>
  )
}

export function InstallAppBlockDescription(props: {
  enabledAppBlock: boolean
  showCommonIssues?: boolean
  showDescription?: boolean
}) {
  const { enabledAppBlock, showCommonIssues = true, showDescription = true } = props
  const { t } = useTranslation()

  if (!showDescription && showCommonIssues && !enabledAppBlock) {
    return <InstallAppBlockCommonIssues />
  }

  if (!showDescription) {
    return null
  }

  return (
    <Box>
      <BlockStack gap={'200'}>
        <Text as="span" variant="bodyMd">
          <Trans
            t={t}
            components={{
              b: <strong />,
            }}
          >
            {!enabledAppBlock
              ? t(
                  'b-easy-one-time-setup-b-install-the-tailorkit-app-block-to-show-personalization-options-on-your-storefront-please-go-back-here-to-complete-publishing'
                )
              : t('install-app-block-description-completed')}
          </Trans>
        </Text>

        {showCommonIssues && !enabledAppBlock && <InstallAppBlockCommonIssues />}

        {enabledAppBlock && (
          <Text as="span" variant="bodyMd">
            <Trans
              t={t}
              components={{
                b: (
                  <Text as="span" variant="bodyMd" fontWeight="bold">
                    {t('add-block-apps-tailorkit')}
                  </Text>
                ),
              }}
            >
              {t('install-app-block-description-completed-2')}
            </Trans>
          </Text>
        )}
      </BlockStack>
    </Box>
  )
}

export function InstallAppBlockCommonIssues() {
  const { t } = useTranslation()
  const [openCollapsible, setOpenCollapsible] = useState(false)

  return (
    <CollapsibleSection
      title={
        <Button variant="plain" onClick={() => setOpenCollapsible(!openCollapsible)} disclosure>
          {t('common-issues-may-arise')}
        </Button>
      }
      open={openCollapsible}
      id={'common-issues-may-arise'}
    >
      <Bleed marginInlineStart="400">
        <List type="number">
          <List.Item>
            <Trans
              t={t}
              components={{
                b: <strong />,
              }}
            >
              {t('b-unable-to-save-theme-b-reload-the-theme-editor-then-try-saving-again')}
            </Trans>
          </List.Item>
          <List.Item>
            <Trans
              t={t}
              components={{
                b: <strong />,
              }}
            >
              {t('b-customizer-not-added-b-your-store-has-no-products-add-at-least-one-product-then-try-again')}
            </Trans>
          </List.Item>
          <List.Item>
            <Trans
              t={t}
              components={{
                b: <strong />,
              }}
            >
              {t('b-other-issues-b-contact-support')}
            </Trans>
          </List.Item>
        </List>
      </Bleed>
    </CollapsibleSection>
  )
}
