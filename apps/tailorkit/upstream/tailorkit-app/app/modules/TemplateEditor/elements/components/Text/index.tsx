/* eslint-disable max-lines */
import { BlockStack, Box, Checkbox, TextField, InlineStack, Text, Tooltip, Icon } from '@shopify/polaris'
import { TextIcon, QuestionCircleIcon } from '@shopify/polaris-icons'
import { t } from 'i18next'
import isEmpty from 'lodash/isEmpty'
import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { AccordionList } from '~/components/Accordion'
import ButtonGroup from '~/components/ButtonGroup'
import { MAX_LABEL_ON_STOREFRONT } from '~/constants/canvas'
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_STROKE_COLOR,
  DEFAULT_TEXT_FAMILY,
  DEFAULT_TEXT_STYLE_CASE,
  DEFAULT_TEXT_GENERATE_TEXT_WITH_AI,
  DEFAULT_TEXT_CHARACTER_LIMIT,
  DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
  DEFAULT_TEXT_ALLOW_MULTI_LINE,
  DEFAULT_TEXT_REQUIRED,
  DEFAULT_TEXT_PLACEHOLDER,
  DEFAULT_TEXT_ALIGNMENT,
  DEFAULT_TEXT_VERTICAL_ALIGN,
  DEFAULT_TEXT_CREATED_BY,
  DEFAULT_TEXT_STROKE_WEIGHT,
  DEFAULT_TEXT_CONTENT,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXT_SHAPE,
  DEFAULT_CURVE_PEAKS,
  DEFAULT_CURVE_BEND,
  DEFAULT_CIRCLE_START_ANGLE,
  DEFAULT_CIRCLE_END_ANGLE,
  DEFAULT_TEXT_WRAP_TEXT,
  DEFAULT_TEXT_LINE_HEIGHT,
  DEFAULT_TEXT_LETTER_SPACING,
  DEFAULT_HIDE_WHEN_PRINTING,
  DEFAULT_HIDE_WHEN_EMPTY,
  DEFAULT_SKIP_EFFECTS_WHEN_PRINTING,
  DEFAULT_TEXT_EMOJI_PICKER,
} from '~/constants/inspector/text'
import { DEFAULT_FONT_SIZE, MAXIMUM_CHARACTER_UTF_16_COUNT } from '~/constants/text-field'
import type { LayerType, TextSettings } from '~/types/psd'
import { ELayerType, EOptionSet } from '~/types/psd'
import { mergeDeep } from '~/utils/mergeDeep'
import TemplateElement from '..'
import type { TemplateElementProps, TemplateElementState } from '../types'
import { ColorOptionSet } from './ColorOptionSet'
import { TextCanvasWithZone } from './renderer.client'
import { fontLoader } from './instances'
import { EmojiFontPicker } from './EmojiFontPicker'
import { TextOptionSet } from './TextOptionSet'
import { stretchBoxToFit } from '~/components/canvas/elements/Text/utils/stretchBoxToFit'
import OptionSetConfiguration from '../common/OptionSetConfiguration'
import AITextField from '~/components/AITextField'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import BuildTextOptionSetWithAI from './BuildOptionSetWithAI'
import { uuid } from '~/utils/uuid'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { TemplateEditorStore } from '~/stores/modules/template'
import { FontOptionSet } from './FontOptionSet'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { TextStylingToolBar } from './Styling'
import { getDefaultStorefrontLabel } from '../../fns'
import Switch from '~/components/common/Switch'
import { TextEffectsBlock } from './Styling/Effects'
import { TextContentEditor } from './TextContentEditor'
import { TextTutorialBanner } from './TextTutorialBanner'
import { BuyerInteractionSection } from '~/modules/TemplateEditor/components/Preview/components/Inspector/Personalized/TextCreatedByCustomers'

export type TextElementState = TemplateElementState & {
  settings: TextSettings
}

export default class TextElement<P, S> extends TemplateElement<P & TemplateElementProps, S & TextElementState> {
  type: LayerType = ELayerType.TEXT
  icon = TextIcon

  declare canvas: HTMLCanvasElement

  constructor(props: P & TemplateElementProps) {
    super(props)

    const defaultStorefrontLabel = getDefaultStorefrontLabel({ t, type: 'custom' })
    this.state = mergeDeep(
      {
        settings: {
          storefrontLabel: defaultStorefrontLabel,
          content: DEFAULT_TEXT_CONTENT,
          textStyle: DEFAULT_TEXT_STYLE,
          textColor: DEFAULT_TEXT_COLOR,
          fontFamily: DEFAULT_TEXT_FAMILY,
          // Respect an existing fontSize if already provided in state.settings
          fontSize: (this.state.settings as TextSettings)?.fontSize || Math.round(this.state.width / 5),
          lineHeight: DEFAULT_TEXT_LINE_HEIGHT,
          letterSpacing: DEFAULT_TEXT_LETTER_SPACING,
          textAlign: DEFAULT_TEXT_ALIGNMENT,
          verticalAlign: DEFAULT_TEXT_VERTICAL_ALIGN,
          strokeColor: DEFAULT_TEXT_STROKE_COLOR,
          strokeWeight: DEFAULT_TEXT_STROKE_WEIGHT,
          textShape: DEFAULT_TEXT_SHAPE,
          curvePeaks: DEFAULT_CURVE_PEAKS,
          curveBend: DEFAULT_CURVE_BEND,
          circleStartAngle: DEFAULT_CIRCLE_START_ANGLE,
          circleEndAngle: DEFAULT_CIRCLE_END_ANGLE,
          textCreatedBy: DEFAULT_TEXT_CREATED_BY,
          characterLimit: DEFAULT_TEXT_CHARACTER_LIMIT,
          autoFitToContainer: DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
          allowMultiLineText: DEFAULT_TEXT_ALLOW_MULTI_LINE,
          required: DEFAULT_TEXT_REQUIRED,
          placeholder: DEFAULT_TEXT_PLACEHOLDER,
          styleCase: DEFAULT_TEXT_STYLE_CASE,
          generateTextWithAI: DEFAULT_TEXT_GENERATE_TEXT_WITH_AI,
          emojiPicker: DEFAULT_TEXT_EMOJI_PICKER,
          wrap: DEFAULT_TEXT_WRAP_TEXT,
          hideWhenPrinting: DEFAULT_HIDE_WHEN_PRINTING,
        },
      },
      this.state
    )

    // Extract some data from the layer store
    const { textAlign, verticalAlign } = this.state
    const { interaction, settings } = props.layerStore.getState()

    // Update default element settings to layer stores if missing.
    // Split into independent checks so that existing settings (e.g. from presets)
    // are never overwritten by mergeDeep defaults — only populate what's absent.
    const interactionPayload = {
      elementScalable: false,
      containerStyle: {
        display: 'flex',
        justifyContent: textAlign === 'top' ? 'flex-start' : textAlign === 'bottom' ? 'flex-end' : 'center',
        alignItems: verticalAlign === 'left' ? 'flex-start' : verticalAlign === 'right' ? 'flex-end' : 'center',
      },
    }

    if (!interaction && isEmpty(settings)) {
      // Both missing — set everything
      props.layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { settings: this.state.settings, interaction: interactionPayload } },
        skipTrace: true,
      })
    } else if (!interaction) {
      // Settings exist (e.g. preset-created element) — only add interaction, preserve settings
      props.layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { interaction: interactionPayload } },
        skipTrace: true,
      })
    } else if (isEmpty(settings)) {
      // Interaction exists but settings missing — apply defaults
      props.layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { settings: this.state.settings } },
        skipTrace: true,
      })
    }
  }

  protected renderTextOnCanvas() {
    const { settings } = this.state
    const textContent = settings.content || ''
    const autoFitToContainer = settings.autoFitToContainer || false

    return (
      <AccordionList
        items={[
          {
            open: true,
            id: 'text-content',
            className: 'text-content',
            label: t('content'),
            borderColor: 'border-inverse',
            content: (
              <TextContentEditor
                content={textContent}
                styleCase={settings.styleCase}
                autoFitToContainer={autoFitToContainer}
                onContentChange={value => this.setData('settings.content', value)}
                onAutoFitChange={() => this.setData('settings.autoFitToContainer', !autoFitToContainer, '')}
                onStretchBoxToFit={this.onStretchBoxToFit}
                renderTextEffects={() => this.renderTextEffects()}
              />
            ),
          },
        ]}
      />
    )
  }

  protected renderCustomizeInspector(): ReactNode {
    const { renderOptionSetInspector } = this.props

    // If renderOptionSetInspector is provided as a prop, use the old behavior (backward compatible)
    if (typeof renderOptionSetInspector === 'function') {
      return (
        <Box paddingBlockEnd={'1000'}>
          {this.renderCreateClipart()}
          {this.renderTextOnCanvas()}
          {renderOptionSetInspector()}
          {this.renderAdvancedInspector()}
        </Box>
      )
    }

    // Otherwise, use the new exclusive accordion behavior
    const accordionItems = [
      ...this.getTextContentItems(),
      ...this.getTextOptionSetItems(),
      ...this.getFontOptionSetItems(),
      ...this.getColorOptionSetItems(),
      ...this.getAdvancedItems(),
    ]

    return (
      <Box paddingBlockEnd={'1000'}>
        {this.renderCreateClipart()}
        <TextTutorialBanner />
        <AccordionList
          exclusiveOpen={true}
          groupId="text-inspector"
          defaultOpenId="text-content"
          items={accordionItems}
        />
      </Box>
    )
  }

  protected renderTextEffects(): ReactNode {
    return (
      <TextEffectsBlock
        buttonProps={{
          fullWidth: true,
          variant: 'secondary',
          // @ts-expect-error -- Polaris ButtonProps does not declare `children` but the runtime Button component accepts it
          children: (
            <Text variant="bodyMd" fontWeight="medium" as="span" tone="success">
              {t('add-text-effects')}
            </Text>
          ),
        }}
      />
    )
  }

  private getTextContentItems() {
    const { settings } = this.state
    const textContent = settings.content || ''
    const autoFitToContainer = settings.autoFitToContainer || false

    return [
      {
        open: true,
        id: 'text-content',
        className: 'text-content',
        label: t('content'),
        borderColor: 'border-inverse' as const,
        content: (
          <TextContentEditor
            content={textContent}
            styleCase={settings.styleCase}
            autoFitToContainer={autoFitToContainer}
            onContentChange={value => this.setData('settings.content', value)}
            onAutoFitChange={() => this.setData('settings.autoFitToContainer', !autoFitToContainer, '')}
            onStretchBoxToFit={this.onStretchBoxToFit}
            renderTextEffects={() => this.renderTextEffects()}
          />
        ),
      },
    ]
  }

  private renderTextOptionSetInspector(): ReactNode {
    const optionSetType = EOptionSet.TEXT_OPTION

    const layerState = this.state
    const { validationErrors, setValidationErrors } = this.context

    const optionSetEditing = this.getEditingOptionSet(optionSetType)
    const buttonsStatus = this.getAddButtonsStatus(optionSetType)
    const settings = layerState.settings as TextSettings
    const defaultStorefrontLabel = getDefaultStorefrontLabel({
      t,
      type: settings.textCreatedBy === 'customers' ? 'custom' : optionSetType,
    })
    const {
      content,
      textCreatedBy,
      characterLimit,
      notesForCustomers,
      storefrontLabel = defaultStorefrontLabel,
      placeholder,
      required = false,
      hideWhenEmpty = DEFAULT_HIDE_WHEN_EMPTY,
      allowMultiLineText = false,
      generateTextWithAI: { allow: allowGenerateTextWithAI } = {},
      emojiPicker = DEFAULT_TEXT_EMOJI_PICKER,
    } = settings

    const { _id: layerId } = layerState

    const layerStore = this.props.layerStore

    // Storefront label error
    const labelKeyError = 'settings.storefrontLabel'
    const placeholderKeyError = 'settings.placeholder'
    const labelError = validationErrors?.[`${layerId}-${labelKeyError}`]
    const storefrontLabelMsg = t('storefront-label-is-required')

    // Character limit error
    const characterLimitKeyError = 'settings.characterLimit'
    const characterLimitError = validationErrors?.[`${layerId}-${characterLimitKeyError}`]
    const characterLimitMsg = t('character-limit-must-be-between-1-and-512')

    const handleSelectTextCreatedBy = (textCreatedBy: string) => {
      const shouldClearTextOptionSet = textCreatedBy === 'customers'

      if (shouldClearTextOptionSet) {
        this.setData({ settings: { textCreatedBy } })
        setValidationErrors(layerId, labelKeyError, storefrontLabel ? null : storefrontLabelMsg)
        setTimeout(() => this.clearOptionSetValidationErrors(optionSetEditing), 100)
      } else {
        this.setData({ settings: { textCreatedBy } })
        setValidationErrors(layerId, labelKeyError, null)
        setValidationErrors(layerId, characterLimitKeyError, null)
      }

      setTimeout(this.forceRefreshEditorCanvas, 100)
    }

    const onChangeAllowToGenerateTextWithAI = () => {
      this.setData('settings.generateTextWithAI.allow', !allowGenerateTextWithAI, '')
    }

    const onChangeRequired = () => {
      const newRequired = !required
      if (newRequired) {
        this.setData({ settings: { required: newRequired, hideWhenEmpty: false } })
      } else {
        this.setData('settings.required', newRequired, '')
      }
    }

    const onChangeHideWhenEmpty = () => {
      this.setData('settings.hideWhenEmpty', !hideWhenEmpty)
    }

    // Write storefrontLabel and keep storefrontOptionSetLabels.text_customer in sync.
    // The text-customer override (api.integration/layer-preparation-helpers.server.ts:319-326)
    // ALWAYS prefers storefrontOptionSetLabels.text_customer over storefrontLabel at publish.
    // If we wrote only storefrontLabel here, a layer that already has text_customer set
    // (e.g. duplicated layers, MultiLayout instances) would keep showing the stale override
    // on the storefront after merchant rename.
    const writeStorefrontLabelAndSync = (value: string) => {
      this.setData({
        settings: {
          storefrontLabel: value,
          storefrontOptionSetLabels: {
            text_customer: value,
          },
        },
      })
    }

    const onChangeTextEntryMode = (mode: string) => {
      const isMultiLine = mode === 'multiLine'

      this.setData({
        settings: {
          ...(isMultiLine ? { autoFitToContainer: true } : {}),
          // Set wrap to word if multi-line, otherwise set to none
          wrap: isMultiLine ? 'word' : 'none',
          allowMultiLineText: isMultiLine,
        },
      })
    }

    const onSelectOptionAfterGenerating = (options: string[]) => {
      const newOptionItems = options.map(option => {
        const newId = uuid()
        const newItem = { _id: newId, id: newId, name: option, selecting: false }

        return newItem
      })

      const getCurrentOptionSet = () => {
        const optionSet = this.getEditingOptionSet(optionSetType)
        return optionSet
      }

      const getCurrentTextOptionSet = () => {
        const optionSet = getCurrentOptionSet()
        const texts = optionSet?.data?.texts || []
        const textOptions = texts.map((text: { _id: string; name: string; selecting: boolean }) => ({
          ...text,
          id: text._id,
        }))

        return textOptions
      }

      const existingOptionSetWithNoName = getCurrentTextOptionSet().filter(
        (item: { _id: string; name: string }) => item.name === ''
      )
      // Delete items with empty name
      existingOptionSetWithNoName.forEach((item: { _id: string; name: string }) => {
        layerStore.dispatch({
          type: 'DELETE_OPTION_ITEM',
          payload: {
            optionSet: getCurrentOptionSet(),
            _id: item._id,
            context: this.context,
          },
          skipTrace: true,
        })
      })

      // We use setTimeout to ensure the above dispatch is completed.
      // In the future, if the above dispatch is deleted, we can remove this setTimeout.
      setTimeout(() => {
        const isEmptyOptions = !getCurrentTextOptionSet().length

        const optionSet = getCurrentOptionSet()
        const textOptions = getCurrentTextOptionSet()
        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...optionSet.data,
                texts: isEmptyOptions ? newOptionItems : [...textOptions, ...newOptionItems],
              },
            },
          },
        })

        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
      })
    }

    const togglePopoverActive = () => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
    }

    const accordionContent = (
      <BlockStack gap={'200'}>
        <ButtonGroup
          value={textCreatedBy}
          label={t('text-is-created-by')}
          onChange={handleSelectTextCreatedBy}
          items={[
            { label: t('yourself'), value: 'merchant', id: 'text-by-your-self-btn' },
            { label: t('your-buyers'), value: 'customers', id: 'text-by-customer-btn' },
          ]}
        />
        {textCreatedBy === 'customers' && (
          <>
            <AITextField
              maxLength={MAX_LABEL_ON_STOREFRONT}
              autoComplete="off"
              showCharacterCount
              error={labelError}
              value={storefrontLabel}
              requiredIndicator
              label={t('set-label-to-show-on-storefront')}
              placeholder={t('input-your-label')}
              onChange={value => {
                writeStorefrontLabelAndSync(value)

                const invalidValue = !value || (typeof value === 'string' && !value.trim())
                setValidationErrors(layerId, labelKeyError, invalidValue ? storefrontLabelMsg : null)
                setTimeout(this.forceRefreshEditorCanvas, 100)
              }}
              onBlur={e => {
                const invalidValue = !(e?.target as HTMLInputElement).value?.trim()
                if (invalidValue) {
                  writeStorefrontLabelAndSync(defaultStorefrontLabel)
                  setValidationErrors(layerId, labelKeyError, null)
                  setTimeout(this.forceRefreshEditorCanvas, 100)
                }
              }}
              popoverContent={
                <PopoverAIContentGenerator
                  title={t('generate-label')}
                  value={storefrontLabel}
                  mainTextLabel={t('what-is-this-label-about')}
                  optionalTextLabel={t('special-instructions-optional')}
                  maxContentLength={MAX_LABEL_ON_STOREFRONT}
                  onSelectOptionAfterGenerating={(options: string[]) => {
                    writeStorefrontLabelAndSync(options[0])
                    setValidationErrors(layerId, labelKeyError, null)
                    setTimeout(this.forceRefreshEditorCanvas, 100)
                  }}
                  onTogglePopoverActive={togglePopoverActive}
                />
              }
            />
            <TextField
              maxLength={MAX_LABEL_ON_STOREFRONT}
              autoComplete="off"
              showCharacterCount
              value={placeholder}
              label={t('text-field-placeholder')}
              placeholder={t('text-field-placeholder-sample')}
              onChange={value => {
                this.setData(placeholderKeyError, value)
              }}
            />
            <Switch
              accessibilityLabel={t('require-buyer-input')}
              label={t('require-buyer-input')}
              checked={required}
              onInput={onChangeRequired}
            />
            {!required && (
              <Switch
                accessibilityLabel={t('hide-when-empty')}
                label={t('hide-when-empty')}
                checked={hideWhenEmpty}
                onInput={onChangeHideWhenEmpty}
              />
            )}
            <Switch
              accessibilityLabel={t('allow-buyers-to-generate-text-with-ai')}
              label={t('allow-buyers-to-generate-text-with-ai')}
              checked={allowGenerateTextWithAI}
              onInput={onChangeAllowToGenerateTextWithAI}
            />
            <Switch
              accessibilityLabel={t('allow-emoji-picker')}
              label={t('allow-emoji-picker')}
              checked={emojiPicker?.enabled || false}
              onInput={() => {
                this.setData('settings.emojiPicker.enabled', !emojiPicker?.enabled)
              }}
            />
            {emojiPicker?.enabled && (
              <BlockStack gap="200">
                <div className={emojiPicker?.font?.family ? 'emoji-font-input' : undefined}>
                  <TextField
                    autoComplete="off"
                    label={t('allowed-emojis')}
                    value={emojiPicker?.emojis || ''}
                    placeholder={t('type-or-paste-emojis-here')}
                    onChange={value => {
                      this.setData('settings.emojiPicker.emojis', value)
                    }}
                    helpText={t('customers-can-insert-these-emojis-into-their-text')}
                  />
                </div>
                <Checkbox
                  label={
                    <InlineStack gap="100" blockAlign="center">
                      <span>{t('allow-emoji-font-upload')}</span>
                      <Tooltip
                        content={t(
                          'let-customers-upload-icon-fonts-with-glyphs-in-the-private-use-area-pua-unicode-range'
                        )}
                      >
                        <Icon source={QuestionCircleIcon} tone="subdued" />
                      </Tooltip>
                    </InlineStack>
                  }
                  checked={emojiPicker?.allowFontUpload ?? false}
                  onChange={checked => {
                    this.setData('settings.emojiPicker.allowFontUpload', checked)
                  }}
                />
                <EmojiFontPicker
                  font={emojiPicker?.font}
                  emojis={emojiPicker?.emojis || ''}
                  allowFontUpload={emojiPicker?.allowFontUpload ?? false}
                  onChange={font => {
                    this.setData('settings.emojiPicker.font', font)
                  }}
                  onEmojisChange={value => {
                    this.setData('settings.emojiPicker.emojis', value)
                  }}
                />
              </BlockStack>
            )}
            <BlockStack gap={'100'}>
              <Text as="span" variant="bodyMd">
                {t('text-field-type')}
              </Text>
              <MultipleButtonToggle
                selected={[allowMultiLineText ? 'multiLine' : 'singleLine']}
                options={[
                  { label: <Text as="span">{t('single-line')}</Text>, value: 'singleLine' },
                  { label: <Text as="span">{t('multi-line')}</Text>, value: 'multiLine' },
                ]}
                onClick={value => onChangeTextEntryMode(value[0])}
              />
            </BlockStack>

            <TextField
              min={1}
              max={MAXIMUM_CHARACTER_UTF_16_COUNT}
              type="number"
              autoComplete="off"
              label={t('character-limit')}
              value={`${characterLimit}`}
              error={characterLimitError}
              onChange={value => {
                this.setData('settings.characterLimit', Number(value))

                const isValidStringValue = typeof value === 'string' && !value.trim()
                const isValidNumberValue = Number(value) < 1 || Number(value) > MAXIMUM_CHARACTER_UTF_16_COUNT
                const invalidValue = !value || isValidStringValue || isValidNumberValue

                setValidationErrors(layerId, characterLimitKeyError, invalidValue ? characterLimitMsg : null)
              }}
              onBlur={e => {
                const value = (e?.target as HTMLInputElement)?.value
                const isValidNumberValue = Number(value) < 1 || Number(value) > MAXIMUM_CHARACTER_UTF_16_COUNT
                const invalidValue = !value || isValidNumberValue
                this.setData('settings.characterLimit', Number(value) || 50)
                setValidationErrors(layerId, characterLimitKeyError, invalidValue ? characterLimitMsg : null)
              }}
            />
            <TextField
              multiline={5}
              label={t('notes')}
              autoComplete="off"
              value={notesForCustomers}
              placeholder={t('input-notes-for-your-buyers')}
              onChange={notesForCustomers => this.setData({ settings: { notesForCustomers } })}
            />
            <BuyerInteractionSection layerStore={layerStore} />
          </>
        )}
        {textCreatedBy === 'merchant' && (
          <Fragment>
            <OptionSetConfiguration
              layerState={layerState}
              optionSetEditing={optionSetEditing}
              buttonsStatus={buttonsStatus}
              renderBuildWithAI={
                <BuildTextOptionSetWithAI
                  disabled={!optionSetEditing.label}
                  onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
                  metadata={{
                    ...(TemplateEditorStore.getState().metadata?.templateDescription ?? {}),
                    content,
                  }}
                  maxContentLength={MAXIMUM_CHARACTER_UTF_16_COUNT}
                />
              }
              renderOptionSetList={this.renderOptionSetList(optionSetType)}
              setButtonsStatus={this.setAddButtonStatus}
              clearOptionSetValidationErrors={this.clearOptionSetValidationErrors}
            />
          </Fragment>
        )}
      </BlockStack>
    )

    return [
      {
        open: false,
        id: 'personalize-text-inspector',
        label: t('personalize-text'),
        content: accordionContent,
      },
    ]
  }

  private getTextOptionSetItems() {
    return this.renderTextOptionSetInspector()
  }

  private getColorOptionSetItems() {
    const optionSetType = EOptionSet.COLOR_OPTION
    const layerState = this.state
    const optionSetEditing = this.getEditingOptionSet(optionSetType)
    const buttonsStatus = this.getAddButtonsStatus(optionSetType)

    const accordionContent = (
      <BlockStack gap={'400'}>
        <OptionSetConfiguration
          layerState={layerState}
          optionSetEditing={optionSetEditing}
          buttonsStatus={buttonsStatus}
          renderOptionSetList={this.renderOptionSetList(optionSetType)}
          setButtonsStatus={this.setAddButtonStatus}
          clearOptionSetValidationErrors={this.clearOptionSetValidationErrors}
        />
      </BlockStack>
    )

    return [
      {
        open: false,
        id: 'personalize-color-inspector',
        className: 'color-option-set-collapsible',
        label: t('personalize-color'),
        content: accordionContent,
      },
    ]
  }

  private getFontOptionSetItems() {
    const optionSetType = EOptionSet.FONT_OPTION
    const layerState = this.state
    const optionSetEditing = this.getEditingOptionSet(optionSetType)
    const buttonsStatus = this.getAddButtonsStatus(optionSetType)

    const accordionContent = (
      <BlockStack gap={'400'}>
        <OptionSetConfiguration
          layerState={layerState}
          optionSetEditing={optionSetEditing}
          buttonsStatus={buttonsStatus}
          renderOptionSetList={this.renderOptionSetList(optionSetType)}
          setButtonsStatus={this.setAddButtonStatus}
          clearOptionSetValidationErrors={this.clearOptionSetValidationErrors}
        />
      </BlockStack>
    )

    return [
      {
        open: false,
        id: 'personalize-font-inspector',
        className: 'font-option-set-collapsible',
        label: t('personalize-font'),
        content: accordionContent,
      },
    ]
  }

  protected renderStylingToolBar(): ReactNode {
    return (
      <InlineStack gap={'100'} wrap={false} blockAlign="center">
        <TextStylingToolBar />
      </InlineStack>
    )
  }

  private getAdvancedItems() {
    const { settings } = this.state
    const hideWhenPrinting = settings.hideWhenPrinting ?? DEFAULT_HIDE_WHEN_PRINTING
    const skipEffectsWhenPrinting = settings.skipEffectsWhenPrinting ?? DEFAULT_SKIP_EFFECTS_WHEN_PRINTING

    const onChangeHideWhenPrinting = () => {
      this.setData('settings.hideWhenPrinting', !hideWhenPrinting)
    }

    const onChangeSkipEffectsWhenPrinting = () => {
      this.setData('settings.skipEffectsWhenPrinting', !skipEffectsWhenPrinting)
    }

    const accordionContent = (
      <BlockStack gap="400">
        <Tooltip content={t('hide-when-printing-description')}>
          <Box>
            <Switch
              accessibilityLabel={t('hide-when-printing')}
              label={t('hide-when-printing')}
              checked={hideWhenPrinting}
              onInput={onChangeHideWhenPrinting}
            />
          </Box>
        </Tooltip>
        <Tooltip content={t('when-enabled-text-effects-will-be-skipped-during-print-rendering-for-cleaner-output')}>
          <Box>
            <Switch
              accessibilityLabel={t('skip-effects-when-printing')}
              label={t('skip-effects-when-printing')}
              checked={skipEffectsWhenPrinting}
              onInput={onChangeSkipEffectsWhenPrinting}
            />
          </Box>
        </Tooltip>
        {this.renderConditionInspector()}
      </BlockStack>
    )

    return [
      {
        open: false,
        id: 'advanced-settings',
        label: t('advanced'),
        content: accordionContent,
      },
    ]
  }

  protected onStretchBoxToFit = async () => {
    const { settings } = this.state

    const { fontFamily, fontSize, content, textAlign, verticalAlign } = settings
    const position = { x: this.state.left, y: this.state.top }
    const currentDimension = { width: this.state.width, height: this.state.height }
    const rotate = this.state.rotate || 0 // Get current rotation angle

    try {
      // Only try to load font if family exists
      if (fontFamily?.family) {
        // Load the font src again
        await fontLoader.loadFont(fontFamily.family, fontFamily?.src)
      }
    } catch (error) {
      console.error('Error loading font:', error)
    }

    // Evaluate the dimension to fit the text
    const { width, height, x, y } = stretchBoxToFit({
      text: content || '',
      fontSize: fontSize || DEFAULT_FONT_SIZE,
      fontFamily: fontFamily?.family || 'Arial',
      fontStyle: fontFamily?.style || '',
      textAlign,
      verticalAlign,
      position,
      currentDimension,
      angle: rotate, // Pass the rotation angle
    })

    // Update the dimension and position of text if needed
    if (x !== undefined && y !== undefined) {
      this.setData({ width, height, left: x, top: y, rotate }) // Preserve the rotate angle
    } else {
      this.setData({ width, height })
    }

    // Update Transformer position and dimension after stretching
    this.updateTransformer()
  }

  // private renderTextShapeLabelOnStoreFront() {
  //   const { shapeSettings } = this.state
  //   const labelOnStoreFront = shapeSettings?.label as string | undefined

  //   const errorMessage = t('storefront-label-is-required')

  //   const onChangeShapeLabel = (value: any) => {
  //     this.setData('shapeSettings.label', value, (value?: any) => {
  //       if (!value || (typeof value === 'string' && !value.trim())) {
  //         return errorMessage
  //       }

  //       setTimeout(this.forceRefreshEditorCanvas, 100)
  //     })
  //   }

  //   return (
  //     <TextFieldValidation
  //       maxLength={MAX_LABEL_ON_STOREFRONT}
  //       autoComplete="off"
  //       showCharacterCount
  //       requiredIndicator
  //       value={labelOnStoreFront}
  //       label={t('set-label-to-show-on-storefront')}
  //       placeholder={t('input-your-label')}
  //       type="text"
  //       error={this.getError('shapeSettings.label')?.error?.message}
  //       onValidate={onChangeShapeLabel}
  //       onChange={onChangeShapeLabel}
  //     />
  //   )
  // }

  // private renderEnableForCustomer(props: CheckboxProps & RefAttributes<CheckboxHandles>): ReactNode {
  //   return (
  //     <Box id="enable-for-customer-checkbox">
  //       <InlineStack gap={'200'} align="start">
  //         <Box>
  //           <Checkbox {...props} />
  //         </Box>
  //         <Text as="p" variant="bodyMd">
  //           {t('enable-for-your-customers')}
  //         </Text>
  //       </InlineStack>
  //     </Box>
  //   )
  // }

  protected renderOptionSetList(optionSetType: string): ReactNode {
    const { layerStore } = this.props
    const { editMode, existOptionSetPressed, newOptionSetPressed } = this.getAddButtonsStatus(optionSetType)
    const optionSet = this.getEditingOptionSet(optionSetType)

    const updateOptionSelecting = (_id: string) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SELECTING',
        payload: {
          optionSet,
          _id,
        },
      })
    }

    const optionSetComponent = {
      [EOptionSet.COLOR_OPTION]: ColorOptionSet,
      [EOptionSet.FONT_OPTION]: FontOptionSet,
      [EOptionSet.TEXT_OPTION]: TextOptionSet,
    }
    const OptionSetComponent = optionSetComponent[optionSetType as keyof typeof optionSetComponent]
    if (!OptionSetComponent) return null

    return (
      <OptionSetComponent
        editingState={{ editMode, existOptionSetPressed, newOptionSetPressed }}
        layerStore={layerStore}
        optionSet={optionSet}
        updateOptionSelecting={updateOptionSelecting}
      />
    )
  }

  protected getOptionsForConditionalLogic(): { _id: string; name: string; selecting: boolean }[] {
    const {
      settings: { textCreatedBy },
    } = this.state

    return (textCreatedBy === 'merchant' && this.getEditingOptionSet(EOptionSet.TEXT_OPTION)?.data?.texts) || []
  }

  protected renderCanvas(): React.ReactNode {
    const { layerStore, previewMode } = this.props
    if (!layerStore) return null

    return (
      <TextCanvasWithZone
        layerStore={layerStore}
        previewMode={previewMode}
        onChangeCircleStartAngle={(value: number) => this.setData('settings.circleStartAngle', value, '')}
        onChangeCircleEndAngle={(value: number) => this.setData('settings.circleEndAngle', value, '')}
        onChangeCurveBend={(value: number) => this.setData('settings.curveBend', value.toFixed(2), '')}
      />
    )
  }

  protected renderAdvancedInspector(): ReactNode {
    const { settings } = this.state
    const hideWhenPrinting = settings.hideWhenPrinting ?? DEFAULT_HIDE_WHEN_PRINTING
    const skipEffectsWhenPrinting = settings.skipEffectsWhenPrinting ?? DEFAULT_SKIP_EFFECTS_WHEN_PRINTING

    const onChangeHideWhenPrinting = () => {
      this.setData('settings.hideWhenPrinting', !hideWhenPrinting)
    }

    const onChangeSkipEffectsWhenPrinting = () => {
      this.setData('settings.skipEffectsWhenPrinting', !skipEffectsWhenPrinting)
    }

    return (
      <AccordionList
        items={[
          {
            open: false,
            id: 'advanced-settings',
            label: t('advanced'),
            content: (
              <BlockStack gap="400">
                <Tooltip content={t('hide-when-printing-description')}>
                  <Box>
                    <Switch
                      accessibilityLabel={t('hide-when-printing')}
                      label={t('hide-when-printing')}
                      checked={hideWhenPrinting}
                      onInput={onChangeHideWhenPrinting}
                    />
                  </Box>
                </Tooltip>
                <Tooltip
                  content={t('when-enabled-text-effects-will-be-skipped-during-print-rendering-for-cleaner-output')}
                >
                  <Box>
                    <Switch
                      accessibilityLabel={t('skip-effects-when-printing')}
                      label={t('skip-effects-when-printing')}
                      checked={skipEffectsWhenPrinting}
                      onInput={onChangeSkipEffectsWhenPrinting}
                    />
                  </Box>
                </Tooltip>
                {this.renderConditionInspector()}
              </BlockStack>
            ),
          },
        ]}
      />
    )
  }
}
