import { useLoaderData } from '@remix-run/react'
import { BlockStack, Box, Button, ButtonGroup, Card, InlineStack } from '@shopify/polaris'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { clientLoader } from '~/routes/dashboard/route'
import type { IOnboardingWithCurrentStepProps } from '../hoc/withCurrentStep'
import { InstallAppBlockOnboardingCard } from './InstallAppBlockOnboardingCard'
import OnboardingQuestionOptions from './OnboardingQuestionOptions'
import OnboardingThumbnail from './OnboardingThumbnail'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

interface IOnboardingCardProps extends Omit<IOnboardingWithCurrentStepProps, 'isShowFirstTime'> {
  onRefresh: () => void
}

const NEXT_STEP_APP_BLOCK_KEY = 'next_step_app_block'

export function OnboardingCard(props: IOnboardingCardProps) {
  const {
    question,
    hasNextStep,
    hasPreviousStep,
    onRefresh,
    getSelectedAnswer,
    handleSelectAnswer,
    handleNextStep,
    handlePreviousStep,
    handleSaveProgressOnboardingData,
    renderComponentToOthers,
  } = props

  const { shop, userHasProduct } = useLoaderData<typeof clientLoader>()
  const { appConfig } = shop || {}
  const { thumbnailSrc, label, modalTitle, type, options, placeholder, key } = question
  const nextStepAppBlock = appConfig?.occurredEvents?.[NEXT_STEP_APP_BLOCK_KEY]

  const [saving, setSaving] = useState(false)
  const [onInstalledAppBlockNext, setOnInstalledAppBlockNext] = useState(nextStepAppBlock)

  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  const onNextInstallAppBlockStep = useCallback(() => {
    trackEvent(EVENTS_TRACKING.NEXT_STEP_APP_BLOCK)
    setOnInstalledAppBlockNext(true)

    // Save state that user has installed app block to appConfig.occurredEvents object
    ;(async () => {
      await authenticatedFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          occurredEvents: { ...appConfig.occurredEvents, [NEXT_STEP_APP_BLOCK_KEY]: true },
        }),
      })
    })()
  }, [appConfig?.occurredEvents, trackEvent])

  const onNext = useCallback(async () => {
    if (hasNextStep) {
      handleNextStep()
      return
    }

    setSaving(true)
    try {
      await Promise.all([
        // Save the onboarding progress data
        handleSaveProgressOnboardingData(true),
      ])

      onRefresh()
    } catch (er) {
      console.error('Cannot save the onboarding progress data')
    } finally {
      setSaving(false)
    }
  }, [handleNextStep, handleSaveProgressOnboardingData, hasNextStep, onRefresh])

  const title = modalTitle && label

  useEffect(() => {
    setOnInstalledAppBlockNext(nextStepAppBlock)
  }, [nextStepAppBlock])

  return (
    <Fragment>
      {!onInstalledAppBlockNext && userHasProduct ? (
        <InstallAppBlockOnboardingCard appConfig={appConfig} onNextInstallAppBlockStep={onNextInstallAppBlockStep} />
      ) : (
        <BlockStack gap={'400'}>
          <Card padding={'0'}>
            <div className="wrapper_content">
              <Box paddingBlockStart={'400'}>
                <BlockStack gap={'200'}>
                  <InlineStack wrap={false} blockAlign="start">
                    {thumbnailSrc && <OnboardingThumbnail thumbnailSrc={thumbnailSrc} questionLabel={label} />}
                    <OnboardingQuestionOptions
                      optionType={type}
                      options={options}
                      showQuestionLabel={title}
                      placeholder={placeholder}
                      questionKey={key}
                      getSelectedAnswer={getSelectedAnswer}
                      handleSelectAnswer={handleSelectAnswer}
                      renderComponentToOthers={renderComponentToOthers}
                    />
                  </InlineStack>
                </BlockStack>
              </Box>
            </div>
          </Card>

          <InlineStack align="end">
            <ButtonGroup>
              <Button variant="secondary" disabled={!hasPreviousStep} onClick={handlePreviousStep}>
                {t('previous')}
              </Button>
              <Button variant="primary" loading={saving} onClick={onNext}>
                {hasNextStep ? t('next') : t('start')}
              </Button>
            </ButtonGroup>
          </InlineStack>
        </BlockStack>
      )}
    </Fragment>
  )
}
