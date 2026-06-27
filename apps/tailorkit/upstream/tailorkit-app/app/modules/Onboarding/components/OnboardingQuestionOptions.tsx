import { BlockStack, Box, ChoiceList, Text } from '@shopify/polaris'
import type { OnboardingQuestion } from '../types'
import { Fragment, useCallback } from 'react'
import { type IOnboardingWithCurrentStepProps } from '../hoc/withCurrentStep'

export default function OnboardingQuestionOptions(props: {
  options: OnboardingQuestion['options']
  optionType: OnboardingQuestion['type']
  questionKey: string
  showQuestionLabel?: string
  placeholder?: string
  getSelectedAnswer: IOnboardingWithCurrentStepProps['getSelectedAnswer']
  handleSelectAnswer: IOnboardingWithCurrentStepProps['handleSelectAnswer']
  renderComponentToOthers: IOnboardingWithCurrentStepProps['renderComponentToOthers']
}) {
  const {
    options,
    optionType,
    questionKey,
    showQuestionLabel,
    placeholder,
    getSelectedAnswer,
    handleSelectAnswer,
    renderComponentToOthers,
  } = props
  const isSelection = ['checkbox', 'radio'].includes(optionType)
  const allowMultiple = optionType === 'checkbox'

  const onChange = useCallback(
    (selected: string[]) => {
      handleSelectAnswer(selected.join(', '), questionKey)
    },
    [handleSelectAnswer, questionKey]
  )

  return (
    <Fragment>
      {isSelection ? (
        <Box width="100%">
          <BlockStack>
            <Box width="100%">
              <div className="onboarding-question-options">
                <ChoiceList
                  title={
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {showQuestionLabel}
                    </Text>
                  }
                  titleHidden={!showQuestionLabel}
                  choices={options || []}
                  selected={getSelectedAnswer(questionKey, allowMultiple)}
                  onChange={onChange}
                  allowMultiple={allowMultiple}
                />
              </div>
            </Box>
            {renderComponentToOthers()}
          </BlockStack>
        </Box>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p-space-300)' }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: placeholder || '' }}
        />
      )}
    </Fragment>
  )
}
