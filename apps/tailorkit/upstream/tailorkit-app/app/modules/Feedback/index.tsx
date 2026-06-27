/* eslint-disable max-lines */
import type { ErrorInfo, ReactElement, ReactNode, RefObject } from 'react'
import type {
  FeedbackComponentProps,
  FeedbackComponentState,
  FeedbackFormDocument,
  QuestionOption,
  IPostFeedbackData,
} from './types'
import isEmpty from 'lodash/isEmpty'
import { createRef, Fragment, PureComponent } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, EmailNewsletterIcon, FileIcon, XIcon } from '@shopify/polaris-icons'
import {
  Bleed,
  BlockStack,
  Box,
  Button,
  ChoiceList,
  DropZone,
  Form,
  Icon,
  InlineStack,
  Modal,
  Popover,
  Scrollable,
  Select,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris'
import { DEFAULT_FEEDBACK_ACTIVATOR_ID, ARRAY_SEPARATOR } from './constants'
import { Trans } from 'react-i18next'
import { type FeedbackData, type OnboardingData } from '~/models/UserJourney'
import { type FooterProps } from '@shopify/polaris/build/ts/src/components/Modal/components'
import styles from './styles.module.css'
export default class FeedbackComponent<P, S> extends PureComponent<
  P & FeedbackComponentProps,
  S & FeedbackComponentState
> {
  declare props: P & FeedbackComponentProps

  declare popoverRef: RefObject<HTMLDivElement>

  static defaultProps: FeedbackComponentProps = {
    displayAs: 'popover',
    addLocalTimeToResponse: true,
    localeToResponse: false,
    activator: 'Give us feedback',
    showSubmitted: true,
    userJourney: {},
  }

  state: S & FeedbackComponentState = {
    forms: [],
    formIndex: 0,
    responses: {},
    showForms: false,
    submitted: false,
    invalidFields: {},
  }

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  constructor(props: P & FeedbackComponentProps) {
    super(props)
    const { dataSource, userJourney, defaultOpen } = props

    if (dataSource) {
      const fetchFunction = props.fetchFunction || (typeof window !== 'undefined' && window?.fetch)

      if (typeof fetchFunction === 'function') {
        fetchFunction(dataSource).then(async (res: any) => {
          const forms = typeof res?.json === 'function' ? await res.json() : res

          function evaluateForms(formsArray: FeedbackFormDocument[]) {
            return formsArray.flatMap(form => {
              if (form.nextAtQuestions && form.nextAtQuestions.length) {
                return splitForms(form, form.nextAtQuestions)
              }

              return [form]
            })
          }

          function splitForms(form: FeedbackFormDocument, nextAtQuestions: number[]) {
            const result = []
            const questions = form.questions
            let startIdx = 0

            for (let i = 0; i < nextAtQuestions.length; i++) {
              const endIdx = nextAtQuestions[i]

              // If index is greater than the number of questions, skip
              if (endIdx > questions.length) continue

              result.push({
                ...form,
                questions: questions.slice(startIdx, endIdx),
              })

              startIdx = endIdx
            }

            // If there are still questions that haven't been assigned to any form, create the last form
            if (startIdx < questions.length) {
              result.push({
                ...form,
                subInformation: '',
                formName: '',
                questions: questions.slice(startIdx),
              })
            }

            return result
          }

          const _forms = evaluateForms(forms || [])
          if (_forms?.length) {
            this.setState({ forms: _forms })

            if (defaultOpen) {
              this.setState({ showForms: true }, this.forceUpdate)
            }

            if (isEmpty(userJourney)) {
              return
            }

            const { formIndex } = this.state
            const formData = _forms[formIndex]

            if (!formData) {
              return
            }

            // Creating a map for quick lookup
            const userJourneyMap = new Map<string, FeedbackData>(
              userJourney.data.map((data: FeedbackData) => [data.formId, data])
            )
            const allDataSaved = _forms.reduce(
              (acc: Record<string, Record<string, string>>, form: FeedbackFormDocument) => {
                const currentData = userJourneyMap.get(form._id)
                acc[form._id] = currentData
                  ? Object.fromEntries(
                      (currentData.data || []).map((data: OnboardingData) => [data.questionKey, data.selectedValue])
                    )
                  : {}

                return acc
              },
              {}
            )

            // Update state with new responses
            this.setState({ responses: allDataSaved })
          }
        })
      }
    }

    this.popoverRef = createRef()
  }

  render(): ReactNode {
    const { showForms } = this.state
    const { t, displayAs, activator } = this.props

    // Generate activator to show the feedback form
    const activatorMarkup = (
      <div
        id={DEFAULT_FEEDBACK_ACTIVATOR_ID}
        className={styles.FeedbackFormActivator}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()

          this.setState({ showForms: !showForms })
        }}
      >
        {typeof activator === 'string' ? <Button>{t(activator)}</Button> : activator}
      </div>
    )

    return this.state.forms.length > 0 ? (
      displayAs === 'modal' ? (
        <>
          {activatorMarkup}
          {this.renderFormsInModal()}
        </>
      ) : (
        this.renderFormsInPopover(activatorMarkup)
      )
    ) : null
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo)
  }

  componentDidUpdate(prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any): void {
    const { showForms } = this.state
    const { displayAs } = this.props

    setTimeout(() => {
      if (showForms && this.popoverRef.current && displayAs === 'popover') {
        // Get the form body HTML element
        const formBody = this.popoverRef.current.querySelector('.feedback-popover-scrollable') as HTMLElement

        if (formBody && !formBody.style.height) {
          // Get necessary HTML elements to calculate the max. height for the form body
          const popoverPane = this.popoverRef.current.closest('.Polaris-Popover__Pane') as HTMLElement

          const formHeader = this.popoverRef.current.querySelector(
            '.Polaris-BlockStack > .Polaris-Box:first-child'
          ) as HTMLElement

          const formFooter = this.popoverRef.current.querySelector(
            '.Polaris-BlockStack > .Polaris-Box:last-child'
          ) as HTMLElement

          // Calculate and set max. height for the form body
          const maxHeight = popoverPane?.offsetHeight - formHeader?.offsetHeight - formFooter?.offsetHeight
          formBody.style.height = `${maxHeight}px`
        }
      }
    }, 100)
  }

  protected handleNextForm = () => {
    const { forms, formIndex, responses, invalidFields } = this.state
    const { questions, _id } = forms[formIndex] || {}
    const responseData = responses?.[_id] || {}

    questions.forEach((question: FeedbackFormDocument['questions'][0]) => {
      const { label, type } = question
      const value = responseData[label]

      this.validateValue(question, value)

      // Validate "Others" text field if "Others" is selected
      if ((type === 'checkbox' || type === 'radio') && value) {
        const selectedValues = typeof value === 'string' ? value.split(ARRAY_SEPARATOR) : []
        if (selectedValues.includes('Others')) {
          const othersTextKey = `${label}_others`
          const othersText = responseData[othersTextKey]
          if (question.required && (!othersText || othersText.trim() === '')) {
            if (!invalidFields[_id]?.includes(othersTextKey)) {
              invalidFields[_id] = (invalidFields[_id] || []).concat([othersTextKey])
            }
          }
        }
      }
    })

    Object.assign(this.state, { invalidFields })
    this.forceUpdate()

    if (isEmpty(invalidFields[_id])) {
      this.setState({ formIndex: Math.min(formIndex + 1, forms.length - 1) })
    }
  }

  protected handleBackForm = () => {
    const { formIndex } = this.state
    this.setState({ formIndex: Math.max(formIndex - 1, 0) })
  }

  protected getPrimaryActionModal(): {
    primaryAction: FooterProps['primaryAction']
    secondaryActions: FooterProps['secondaryActions']
  } {
    const { t, primaryActionContent, showSubmitted } = this.props
    const { forms, saving, submitted, responses, formIndex, invalidFields } = this.state
    const formId = this.getFormId()

    if (showSubmitted && submitted) {
      return {
        primaryAction: {
          content: t('close'),
          onAction: this.handleClose,
        },
        secondaryActions: undefined,
      }
    }

    const hasNextForm = formIndex + 1 < forms.length
    const hasPrevForm = formIndex > 0
    const _primaryActionContent = hasNextForm ? t('next') : primaryActionContent || t('send')
    const _secondaryActionContent = hasPrevForm ? t('back') : t('skip')
    const invalidFieldsOfCurrentForm = invalidFields[formId]

    return {
      primaryAction: {
        content: _primaryActionContent,
        loading: saving,
        disabled: saving || isEmpty(responses) || !isEmpty(invalidFieldsOfCurrentForm),
        id: 'feedback-send-button',
        onAction: hasNextForm ? this.handleNextForm : this.handleSave,
      },
      secondaryActions: [
        {
          content: _secondaryActionContent,
          onAction: hasPrevForm ? this.handleBackForm : this.handleClose,
        },
      ],
    }
  }
  protected renderFormsInModal(): ReactNode {
    const { t, footerMarkup } = this.props
    const { forms, submitted, formIndex, showForms } = this.state
    const { primaryAction, secondaryActions } = this.getPrimaryActionModal()

    return (
      <Modal
        open={showForms}
        onClose={this.handleClose}
        title={submitted ? t('message-sent') : t(forms[formIndex].title)}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        footer={footerMarkup}
      >
        <Modal.Section>{this.renderForms()}</Modal.Section>
      </Modal>
    )
  }

  protected renderFormsInPopover(activatorMarkup: ReactElement): ReactNode {
    const { t } = this.props
    const { forms, saving, submitted, responses, formIndex, showForms, invalidFields } = this.state

    return (
      <Popover active={showForms} zIndexOverride={1000} onClose={this.handleClose} activator={activatorMarkup}>
        <Box ref={this.popoverRef} background="bg">
          <BlockStack>
            <Box padding="200" borderBlockEndWidth="0165" borderColor="border-tertiary">
              <InlineStack gap="200" align="space-between">
                <Text variant="bodyMd" as="span" fontWeight="bold">
                  {submitted ? t('message-sent') : forms[formIndex].title}
                </Text>
                <InlineStack>
                  {forms.length > 1 && !submitted && (
                    <>
                      <Button
                        variant="plain"
                        disabled={formIndex === 0}
                        icon={<Icon source={ChevronLeftIcon} />}
                        onClick={() => this.setState({ formIndex: Math.max(formIndex - 1, 0) })}
                      />
                      <Button
                        variant="plain"
                        icon={<Icon source={ChevronRightIcon} />}
                        disabled={formIndex + 1 === forms.length}
                        onClick={() => this.setState({ formIndex: Math.min(formIndex + 1, forms.length - 1) })}
                      />
                    </>
                  )}
                  <Button variant="plain" onClick={this.handleClose} icon={<Icon source={XIcon} />} />
                </InlineStack>
              </InlineStack>
            </Box>
            <Scrollable className="feedback-popover-scrollable" style={{ padding: '8px' }}>
              {this.renderForms()}
            </Scrollable>
            <Box padding="200" borderBlockStartWidth="0165" borderColor="border-tertiary">
              <InlineStack align="center">
                {submitted ? (
                  <Button fullWidth onClick={this.handleClose}>
                    {t('close')}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    onClick={this.handleSave}
                    loading={saving}
                    disabled={saving || isEmpty(responses) || !isEmpty(invalidFields)}
                  >
                    {t('send')}
                  </Button>
                )}
              </InlineStack>
            </Box>
          </BlockStack>
        </Box>
      </Popover>
    )
  }

  protected renderSubInformation(subInformation: string): ReactNode {
    const { t } = this.props

    return (
      <Text variant="bodyMd" as="p">
        {t(subInformation)}
      </Text>
    )
  }

  protected renderFormName(formName: string): ReactNode {
    const { t } = this.props

    return (
      <Text variant="bodyMd" as="p" fontWeight="semibold">
        {t(formName)}
      </Text>
    )
  }

  protected renderForms(): ReactNode {
    const { t, displayAs } = this.props
    const { forms, submitted, formIndex, showForms } = this.state

    const subInformation = forms[formIndex]?.subInformation
    const formName = forms[formIndex]?.formName

    return submitted ? (
      <div style={{ height: 'inherit', display: displayAs === 'modal' ? 'block' : 'flex', alignItems: 'center' }}>
        <BlockStack gap="200">
          <InlineStack align="center">
            <Icon source={EmailNewsletterIcon} />
          </InlineStack>
          <InlineStack align="center">
            <Text variant="bodyMd" as="span" fontWeight="bold">
              {t('thanks-for-reaching-out')}
            </Text>
          </InlineStack>
          <InlineStack align="center">
            <Text variant="bodyMd" as="span">
              {t('someone-will-get-back-to-you-soon')}
            </Text>
          </InlineStack>
        </BlockStack>
      </div>
    ) : (
      showForms && (
        <BlockStack gap="200">
          {subInformation && this.renderSubInformation(subInformation)}
          {formName && this.renderFormName(formName)}
          <Form onSubmit={() => {}}>
            <BlockStack gap="300">
              {forms[formIndex]?.questions.map((field: FeedbackFormDocument['questions'][0]) => (
                <Fragment key={`${this.getFormId()}-${field.label}`}>{this.renderFormField(field)}</Fragment>
              ))}
            </BlockStack>
          </Form>
        </BlockStack>
      )
    )
  }

  protected renderFormField(field: FeedbackFormDocument['questions'][0]): ReactNode {
    const { t } = this.props
    const { saving, responses, invalidFields } = this.state

    const {
      type,
      label,
      description,
      options,
      fileType,
      required,
      hideLabel,
      maxLength,
      placeholder,
      requiredMessage,
      fileSize = 1024 * 1024,
    } = field

    // Get ID of the active form
    const formId = this.getFormId()

    // Get active response object
    const response = responses[formId]

    const allowMultiple = type === 'checkbox'
    const selectedValues = response?.[label]?.split(ARRAY_SEPARATOR) || []

    // Generate options with translated label
    const _options = options?.map((option: QuestionOption) => ({ label: t(option.label), value: option.value })) || []

    // Generate label markup
    const labelMarkup = (
      <BlockStack gap="100">
        <Text variant="bodyMd" as="span" fontWeight="semibold">
          {required && (
            <>
              <Text variant="bodyMd" as="span" tone="critical">
                *
              </Text>{' '}
            </>
          )}
          <Trans
            t={t}
            components={{
              strong: (
                <Text as="span" variant="bodyMd" fontWeight="medium">
                  {t('')}
                </Text>
              ),
            }}
          >
            {t(label)}
          </Trans>
        </Text>
        {description && (
          <Text variant="bodyMd" as="span" tone="subdued">
            {t(description)}
          </Text>
        )}
      </BlockStack>
    )

    switch (type) {
      case 'checkbox':
      case 'radio': {
        const isOthersSelected = selectedValues.includes('Others')
        const othersTextKey = `${label}_others`
        const othersText = response?.[othersTextKey] || ''
        // Find the "Others" option to get its placeholder
        const othersOption = options?.find(
          (option: QuestionOption & { placeholder?: string }) => option.value === 'Others'
        ) as (QuestionOption & { placeholder?: string }) | undefined
        const othersPlaceholder = othersOption?.placeholder || 'please-enter-your-feedback'

        return (
          _options
          && _options.length > 0 && (
            <BlockStack gap="200">
              {/* When the wrapper FeedbackForm element is called the preventDefault() and stopPropagation() are called,
               * the default function of ChoiceList is not called.
               *
               * Way to fix:
               * 1. Wrap the ChoiceList with a div element
               * 2. Process logic in the click event of the div element
               */}
              <div
                onClick={e => {
                  this.handleChoiceListClick(field, e)
                }}
              >
                <ChoiceList
                  choices={_options}
                  disabled={saving}
                  title={labelMarkup}
                  name={label}
                  titleHidden={hideLabel}
                  selected={selectedValues}
                  allowMultiple={allowMultiple}
                  error={
                    invalidFields[formId]?.includes(label)
                      ? requiredMessage || type === 'radio'
                        ? t('please-choose-an-option')
                        : t('please-choose-at-least-one-option')
                      : undefined
                  }
                />
              </div>
              {isOthersSelected && (
                <Bleed marginBlockStart="200">
                  <Box paddingInlineStart="600">
                    <TextField
                      disabled={saving}
                      autoComplete="off"
                      label={t(othersPlaceholder)}
                      labelHidden={true}
                      value={othersText}
                      multiline={3}
                      maxHeight={132}
                      placeholder={t(othersPlaceholder)}
                      onChange={(value: string) => this.handleOthersTextChange(field, value)}
                      error={invalidFields[formId]?.includes(othersTextKey) ? t('please-input-some-text') : undefined}
                    />
                  </Box>
                </Bleed>
              )}
            </BlockStack>
          )
        )
      }

      case 'file':
        return (
          <div style={{ width: '100%"' }}>
            <DropZone
              variableHeight
              type={fileType}
              disabled={saving}
              label={labelMarkup}
              allowMultiple={false}
              labelHidden={hideLabel}
              customValidator={(file: File) => file.size < fileSize}
              onDrop={(files: File[], acceptedFiles: File[], rejectedFiles: File[]) =>
                this.handleChange(field, acceptedFiles)
              }
            >
              {response?.[label] ? (
                <Box padding="200">
                  <InlineStack gap="200" wrap={false} blockAlign="center">
                    <Thumbnail
                      size="small"
                      alt={response[label].name}
                      source={
                        fileType === 'image'
                          ? typeof response[label] === 'string'
                            ? response[label]
                            : URL.createObjectURL(response[label])
                          : FileIcon
                      }
                    />
                    <BlockStack gap="200">
                      <Text variant="bodySm" as="p">
                        {response[label].name}
                      </Text>
                      <Text variant="bodySm" as="p">
                        {response[label].size} bytes
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              ) : (
                <DropZone.FileUpload
                  actionHint={t('files-having-file-size-greater-than-x-mb-cannot-be-uploaded', {
                    x: fileSize / 1024 / 1024,
                  })}
                />
              )}
            </DropZone>
          </div>
        )

      case 'select':
        return (
          _options
          && _options.length > 0 && (
            <Select
              options={_options}
              disabled={saving}
              label={labelMarkup}
              labelHidden={hideLabel}
              value={response?.[label]}
              placeholder={t(placeholder)}
              onChange={(value: string) => this.handleChange(field, value)}
              error={
                invalidFields[formId]?.includes(label) ? requiredMessage || t('please-select-an-option') : undefined
              }
            />
          )
        )

      case 'text':
      case 'textarea':
        return (
          <TextField
            disabled={saving}
            autoComplete="off"
            label={labelMarkup}
            maxLength={maxLength}
            labelHidden={hideLabel}
            value={response?.[label]}
            placeholder={t(placeholder)}
            showCharacterCount={Boolean(maxLength)}
            multiline={type === 'textarea' ? 4 : undefined}
            maxHeight={132}
            onChange={(value: string) => this.handleChange(field, value)}
            error={invalidFields[formId]?.includes(label) ? requiredMessage || t('please-input-some-text') : undefined}
          />
        )
    }
  }

  protected getFormId(form?: FeedbackFormDocument): string {
    const { forms, formIndex } = this.state

    // Get form
    form = form || forms[formIndex]

    return form?._id as string
  }

  protected validateValue(field: FeedbackFormDocument['questions'][0], value: any) {
    const { invalidFields } = this.state
    const { label, required, validationRegExpPattern } = field

    // Get ID of the active form
    const formId = this.getFormId()

    if (required) {
      if (
        isEmpty(typeof value === 'string' ? value.trim() : value)
        || (validationRegExpPattern && !value.match(new RegExp(validationRegExpPattern)))
      ) {
        if (!invalidFields[formId]?.includes(label)) {
          invalidFields[formId] = (invalidFields[formId] || []).concat([label])
        }
      } else {
        if (invalidFields[formId]?.includes(label)) {
          invalidFields[formId].splice(invalidFields[formId].indexOf(label), 1)
        }

        if (!invalidFields[formId]?.length) {
          delete invalidFields[formId]
        }
      }
    }

    Object.assign(this.state, { invalidFields })
  }

  protected handleClose = () => {
    const { onClose } = this.props
    if (typeof onClose === 'function') {
      onClose()
    }
    this.setState({ submitted: false, showForms: false })
  }

  protected removeStrongTag = (htmlString: string) => {
    return htmlString.replace(/<strong>.*?<\/strong>\s*/g, '')
  }

  protected valueFormatted = (field: FeedbackFormDocument['questions'][0], value: any) => {
    const { type } = field
    if (type === 'file') {
      return value[0]
    }

    return value
  }

  protected handleChange = async (field: FeedbackFormDocument['questions'][0], value: any) => {
    const { label } = field
    const { responses, invalidFields } = this.state

    // Get ID of the active form
    const formId = this.getFormId()

    // Update responses
    const _value = this.valueFormatted(field, value)

    responses[formId] = {
      ...responses[formId],
      [label]: _value,
    }

    // Validate field value
    this.validateValue(field, _value)

    // If "Others" was deselected, remove the others text
    if (field.type === 'checkbox' || field.type === 'radio') {
      const selectedValues = typeof _value === 'string' ? _value.split(ARRAY_SEPARATOR) : []
      if (!selectedValues.includes('Others')) {
        const othersTextKey = `${label}_others`
        if (responses[formId]?.[othersTextKey]) {
          delete responses[formId][othersTextKey]
          // Remove validation error for others text if it exists
          if (invalidFields[formId]?.includes(othersTextKey)) {
            invalidFields[formId].splice(invalidFields[formId].indexOf(othersTextKey), 1)
            if (!invalidFields[formId]?.length) {
              delete invalidFields[formId]
            }
          }
        }
      }
    }

    Object.assign(this.state, { invalidFields })
    this.setState({ responses }, this.forceUpdate)
  }

  /**
   * Handles changes to the "Others" text field when "Others" option is selected
   * @param field - The form field configuration
   * @param value - The text value entered by the user
   */
  protected handleOthersTextChange = (field: FeedbackFormDocument['questions'][0], value: string) => {
    const { label } = field
    const { responses, invalidFields } = this.state
    const formId = this.getFormId()
    const othersTextKey = `${label}_others`

    // Update responses with others text
    responses[formId] = {
      ...responses[formId],
      [othersTextKey]: value,
    }

    // Validate the others text field
    if (field.required && (!value || value.trim() === '')) {
      if (!invalidFields[formId]?.includes(othersTextKey)) {
        invalidFields[formId] = (invalidFields[formId] || []).concat([othersTextKey])
      }
    } else {
      if (invalidFields[formId]?.includes(othersTextKey)) {
        invalidFields[formId].splice(invalidFields[formId].indexOf(othersTextKey), 1)
        if (!invalidFields[formId]?.length) {
          delete invalidFields[formId]
        }
      }
    }

    Object.assign(this.state, { invalidFields })
    this.setState({ responses }, this.forceUpdate)
  }

  protected handleChoiceListClick = (
    field: FeedbackFormDocument['questions'][0],
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const { responses } = this.state
    const { type, label } = field

    // Get ID of the active form
    const formId = this.getFormId()

    // Get active response object
    const response = responses[formId]

    const allowMultiple = type === 'checkbox'
    const selectedValues = response?.[label]?.split(ARRAY_SEPARATOR) || []

    const target = e.target as HTMLElement
    const queryDomStr = `input[name="${label}${allowMultiple ? '[]' : ''}"]`
    let inputDom: HTMLInputElement | null = null
    const isLabelClick = target.tagName !== 'INPUT' && target.closest('label')

    // Check if click is directly on input element
    if (target.tagName === 'INPUT' && target.getAttribute('name') === `${label}${allowMultiple ? '[]' : ''}`) {
      inputDom = target as HTMLInputElement
    } else if (isLabelClick) {
      // Check if click is on label
      const itemSelected = target.closest('label')
      inputDom = itemSelected?.querySelector(queryDomStr) as HTMLInputElement

      // Prevent default label behavior to avoid double handling
      if (inputDom) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    if (inputDom) {
      const valueSelected = inputDom.value

      // For label clicks, manually toggle the input since we prevented default
      // For input clicks, the native behavior already toggled it, so read the current state
      if (isLabelClick) {
        const isChecked = selectedValues.includes(valueSelected)
        inputDom.checked = !isChecked
      }

      // Read the current checked state after potential toggle
      const isChecked = inputDom.checked

      if (allowMultiple) {
        if (isChecked) {
          // Add to selection if not already included
          if (!selectedValues.includes(valueSelected)) {
            this.handleChange(field, [...selectedValues, valueSelected].join(ARRAY_SEPARATOR))
          }
        } else {
          // Remove from selection
          this.handleChange(
            field,
            selectedValues.filter((value: string) => value !== valueSelected).join(ARRAY_SEPARATOR)
          )
        }
      } else {
        // For radio buttons, always set the selected value
        if (isChecked) {
          this.handleChange(field, valueSelected)
        }
      }
    }
  }

  protected handleSave = async () => {
    const {
      t,
      onSave,
      onError,
      dataSource,
      addLocalTimeToResponse,
      localeToResponse,
      fetchFunction = typeof window !== 'undefined' && window?.fetch,
      showSubmitted,
    } = this.props

    const { forms, responses } = this.state

    // Validate user inputs
    const now = new Date()
    const postData: IPostFeedbackData = {}

    for (let i = 0; i < forms.length; i++) {
      const form = forms[i]
      const formId = this.getFormId(form)

      postData[formId] = {
        ...(localeToResponse ? { locale: localeToResponse } : {}),
        ...(addLocalTimeToResponse ? { localTime: now.toString() } : {}),
        ...(postData[formId] || {}),
      }

      for (let j = 0; j < form.questions.length; j++) {
        const { type, label, fileSize = 1024 * 1024 } = form.questions[j]
        const value = responses?.[formId]?.[label]

        this.validateValue(form.questions[j], value)

        // Validate "Others" text field if "Others" is selected
        if ((type === 'checkbox' || type === 'radio') && value) {
          const selectedValues = typeof value === 'string' ? value.split(ARRAY_SEPARATOR) : []
          if (selectedValues.includes('Others')) {
            const othersTextKey = `${label}_others`
            const othersText = responses?.[formId]?.[othersTextKey]
            if (form.questions[j].required && (!othersText || othersText.trim() === '')) {
              const currentInvalidFields = this.state.invalidFields
              if (!currentInvalidFields[formId]?.includes(othersTextKey)) {
                currentInvalidFields[formId] = (currentInvalidFields[formId] || []).concat([othersTextKey])
                this.setState({ invalidFields: currentInvalidFields })
              }
            }
          }
        }

        // Always use English translation of label as the payload key
        // This ensures Google Apps Script receives English keys instead of translation keys
        const englishLabel = t(label, { lng: 'en' })
        const fieldKey = this.removeStrongTag(englishLabel)

        // Parse file input
        if (type === 'file') {
          if (!(value instanceof File) || value.size > fileSize) {
            continue
          }

          postData[formId][fieldKey] = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(value)
          })
        } else {
          // Handle checkbox/radio fields with "Others" option
          if ((type === 'checkbox' || type === 'radio') && value) {
            const selectedValues = typeof value === 'string' ? value.split(ARRAY_SEPARATOR) : []
            if (selectedValues.includes('Others')) {
              const othersTextKey = `${label}_others`
              const othersText = responses?.[formId]?.[othersTextKey]

              if (othersText) {
                // Replace "Others" with "Others: \"[user's custom value]\";" in the selected values
                const othersIndex = selectedValues.indexOf('Others')
                selectedValues[othersIndex] = `Others: "${othersText}"`
                postData[formId][fieldKey] = selectedValues.join(ARRAY_SEPARATOR)
              } else {
                // If Others is selected but no text provided, keep original value
                postData[formId][fieldKey] = value
              }
            } else {
              // No "Others" selected, use value as is
              postData[formId][fieldKey] = value
            }
          } else {
            // Not a checkbox/radio field, use value as is
            postData[formId][fieldKey] = value
          }
        }
      }
    }

    if (!isEmpty(this.state.invalidFields)) {
      return this.forceUpdate()
    }

    // Send a request to save user responses
    this.setState({ saving: true })

    if (typeof onSave === 'function') {
      await onSave(postData, dataSource, onError)
    } else if (typeof fetchFunction === 'function') {
      fetchFunction(dataSource, {
        method: 'POST',
        body: JSON.stringify(postData),
      })
        .then(async (res: any) => {
          const result = typeof res.json === 'function' ? await res.json() : res

          if (!result?.success) {
            this.setState({ saving: false }, () => this.handleError(res?.message || t('failed-to-save-your-responses')))
            return
          }

          this.setState({ saving: false, responses: {}, invalidFields: {} }, () => {
            this.handleSuccess(postData)

            if (showSubmitted) {
              this.setState({ submitted: true })
              return
            }

            this.handleClose()
          })
        })
        .catch((e: any) =>
          this.setState({ saving: false }, () =>
            this.handleError(e?.message || e || t('failed-to-save-your-responses'))
          )
        )
    }
  }

  handleSuccess = (postData: any) => {
    const { onSuccess } = this.props

    if (typeof onSuccess === 'function') {
      onSuccess(postData)
    }
  }

  handleError(message: string) {
    const { onError } = this.props

    if (typeof onError === 'function') {
      onError(message)
    }
  }
}
