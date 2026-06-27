import { BlockStack, Box, Button, Card, Image, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { useNavigate } from '@remix-run/react'
import { XIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { dismissCardForever } from '../../utilities/dismissCardForever'
import useDevices from '~/utils/hooks/useDevice'
import { FlexCenter } from '~/components/common/Flex'

interface NewFeatureCardProps {
  onTryInEditor?: () => void
  onSeeHowItWorks?: () => void
}

export default function NewFeatureCard({ onTryInEditor, onSeeHowItWorks }: NewFeatureCardProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()
  const navigate = useNavigate()

  const [isDismissed, setIsDismissed] = useState(false)

  const handleDismiss = useCallback(async () => {
    setIsDismissed(true)
    await dismissCardForever('new-feature-card')

    trackEvent(EVENTS_TRACKING.CLICK_FEATURED_BANNER, {
      [EVENTS_PARAMETERS_NAME.FEATURED_BANNER]: 'new-feature-dismiss',
    })
  }, [trackEvent])

  const handlePrimaryButtonClick = useCallback(() => {
    trackEvent(EVENTS_TRACKING.CLICK_FEATURED_BANNER, {
      [EVENTS_PARAMETERS_NAME.FEATURED_BANNER]: 'try-new-feature-in-editor',
    })
    navigate('/templates?open=cliparts')
  }, [trackEvent, navigate])

  const handleSecondaryButtonClick = useCallback(() => {
    trackEvent(EVENTS_TRACKING.CLICK_FEATURED_BANNER, {
      [EVENTS_PARAMETERS_NAME.FEATURED_BANNER]: 'see-how-new-feature-works',
    })
    onSeeHowItWorks?.()
  }, [trackEvent, onSeeHowItWorks])

  const FEATURE_CONFIG = useMemo(
    () => ({
      title: t('new-feature-card-title'),
      description: t('new-feature-card-description'),
      helpText: t('new-feature-card-help-text'),
      // image: isMobileView ? ELink.NEW_FEATURE_CARD_BACKGROUND_MINOR : ELink.NEW_FEATURE_CARD_BACKGROUND,
      thumbnail: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Group_5.png?v=1757662854',
      primaryButton: {
        label: t('new-feature-card-primary-button'),
        onClick: handlePrimaryButtonClick,
      },
      secondaryButton: {
        label: t('new-feature-card-secondary-button'),
        onClick: handleSecondaryButtonClick,
      },
      endDate: new Date('2025-09-30'), // September 30, 2025
      backgroundCSS: 'linear-gradient(90deg, #52B250 0%, #005747 100%)',
    }),
    [handlePrimaryButtonClick, handleSecondaryButtonClick, t]
  )

  // Check if the card should be auto-dismissed based on date
  useEffect(() => {
    const today = new Date()
    if (today >= FEATURE_CONFIG.endDate) {
      setIsDismissed(true)
    }
  }, [FEATURE_CONFIG.endDate])

  if (isDismissed) {
    return null
  }

  return (
    <Card padding="0">
      <div style={{ background: FEATURE_CONFIG.backgroundCSS, position: 'relative' }}>
        <Box position="relative" zIndex="1">
          {/* Close button */}
          <Box position="absolute" insetBlockStart="400" insetInlineEnd="400" zIndex="1">
            <Tooltip content={t('dismiss')}>
              <Button variant="tertiary" icon={XIcon} onClick={handleDismiss} />
            </Tooltip>
          </Box>

          {/* Main content */}
          <Box padding={'400'} paddingInlineEnd={'0'} width="100%">
            <InlineStack gap="600" blockAlign="center" wrap={isMobileView ? true : false} align="space-between">
              {/* Text content */}
              <div style={{ color: '#fff' }}>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd" fontWeight="bold" tone="inherit">
                    {FEATURE_CONFIG.title}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="inherit">
                    {t(FEATURE_CONFIG.description)}
                  </Text>

                  {FEATURE_CONFIG.helpText && (
                    <Text as="p" variant="bodyMd" tone="inherit">
                      {t(FEATURE_CONFIG.helpText)}
                    </Text>
                  )}

                  <Box width="fit-content">
                    {/* Action buttons */}
                    <InlineStack gap="300">
                      <Button onClick={FEATURE_CONFIG.secondaryButton.onClick}>
                        {FEATURE_CONFIG.secondaryButton.label}
                      </Button>
                      <Button variant="primary" onClick={FEATURE_CONFIG.primaryButton.onClick}>
                        {FEATURE_CONFIG.primaryButton.label}
                      </Button>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </div>

              <FlexCenter style={{ width: '100%' }}>
                <Image
                  source={FEATURE_CONFIG.thumbnail}
                  style={{
                    objectFit: 'cover',
                    maxWidth: isMobileView ? '100%' : '344px',
                    maxHeight: isMobileView ? '200px' : '100%',
                  }}
                  alt={'New feature card preview image'}
                />
              </FlexCenter>
            </InlineStack>
          </Box>
        </Box>
      </div>
    </Card>
  )
}
