import type { OnboardingQuestion } from '../types'
import OnboardingThumbnail from './OnboardingThumbnail'
import OnboardingQuestionOptions from './OnboardingQuestionOptions'
import { useTranslation } from 'react-i18next'
import { type IOnboardingWithCurrentStepProps } from '../hoc/withCurrentStep'
import { useCallback, useEffect, useState } from 'react'
import { InlineStack } from '@shopify/polaris'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import ModalAppBridge from '~/components/AppBridge/ui-modal'
import { useAppBridge } from '@shopify/app-bridge-react'

interface IOnboardingModalProps extends Omit<IOnboardingWithCurrentStepProps, 'question' | 'isShowFirstTime'> {
  active: boolean
  question: OnboardingQuestion & { modalTitle?: string }
  onRefresh: () => void
  onCloseModal: () => void
}

function OnboardingModal(props: IOnboardingModalProps) {
  const {
    active,
    question,
    hasNextStep,
    hasPreviousStep,
    onRefresh,
    getSelectedAnswer,
    handleSelectAnswer,
    onCloseModal,
    handleNextStep,
    handlePreviousStep,
    handleSaveProgressOnboardingData,
    renderComponentToOthers,
  } = props
  const { thumbnailSrc, label, modalTitle, type, options, placeholder, key } = question

  const { t } = useTranslation()
  const shopify = useAppBridge()
  const [saving, setSaving] = useState(false)

  const onHide = useCallback(async () => {
    onCloseModal()
    try {
      await handleSaveProgressOnboardingData()
      onRefresh()
    } catch (err) {
      console.error('Cannot save the onboarding progress data')
    }
  }, [handleSaveProgressOnboardingData, onCloseModal, onRefresh])

  const onNext = useCallback(async () => {
    if (hasNextStep) {
      handleNextStep()
      return
    }

    setSaving(true)
    try {
      await handleSaveProgressOnboardingData(true)
      onRefresh()
    } catch (er) {
      console.error('Cannot save the onboarding progress data')
    } finally {
      setSaving(false)
      onCloseModal()
    }
  }, [handleNextStep, handleSaveProgressOnboardingData, hasNextStep, onCloseModal, onRefresh])

  useEffect(() => {
    if (active) {
      shopify.modal.show(MODALS.DASHBOARD.ONBOARDING_DASHBOARD_MODAL_ID)
    }
  }, [active, shopify])

  return (
    <ModalAppBridge
      id={MODALS.DASHBOARD.ONBOARDING_DASHBOARD_MODAL_ID}
      title={modalTitle || label}
      onHide={onHide}
      primaryAction={{
        content: hasNextStep ? t('next') : t('start'),
        loading: saving ? '' : undefined,
        onAction: onNext,
      }}
      secondaryAction={{
        content: t('previous'),
        disabled: !hasPreviousStep,
        onAction: handlePreviousStep,
      }}
    >
      <div className="wrapper_content">
        <InlineStack wrap={false} blockAlign="start">
          {thumbnailSrc && <OnboardingThumbnail thumbnailSrc={thumbnailSrc} questionLabel={label} />}
          <OnboardingQuestionOptions
            optionType={type}
            options={options}
            showQuestionLabel={modalTitle && label}
            placeholder={placeholder}
            questionKey={key}
            getSelectedAnswer={getSelectedAnswer}
            handleSelectAnswer={handleSelectAnswer}
            renderComponentToOthers={renderComponentToOthers}
          />
        </InlineStack>
      </div>
    </ModalAppBridge>
  )
}

export default OnboardingModal
