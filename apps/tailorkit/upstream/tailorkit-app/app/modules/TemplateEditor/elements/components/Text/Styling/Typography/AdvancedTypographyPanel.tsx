import { BlockStack, Select, Text } from '@shopify/polaris'
import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import { useCallback, useMemo } from 'react'
import { VerticalAlignBottomIcon, VerticalAlignCenterIcon, VerticalAlignTopIcon } from '~/assets/icons'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import {
  MAXIMUM_RANGE_LETTER_SPACING,
  MAXIMUM_RANGE_LINE_HEIGHT,
  MINIMUM_RANGE_LETTER_SPACING,
  MINIMUM_RANGE_LINE_HEIGHT,
} from '~/constants/text-field'
import type { TextSettings } from '~/types/psd'
import { EOptionSet } from '~/types/psd'
import type TemplateElement from '../../..'
import { mutateTextOptionSetStyleCase } from '../../TextOptionSet/fns'
import { NumericSliderField } from './NumericSliderField'
import type { TLayerStore } from '~/stores/modules/layer'
import { useStore } from '~/libs/external-store'

interface AdvancedTypographyPanelProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
  t: (key: string) => string
}

export function AdvancedTypographyPanel({ element, clickedLayerStore, t }: AdvancedTypographyPanelProps) {
  // Determine target layer store (for nested elements)
  const targetLayerStore = useMemo(() => {
    if (clickedLayerStore && clickedLayerStore.getState()._id !== element.state._id) {
      return clickedLayerStore
    }
    return element.props.layerStore
  }, [clickedLayerStore, element])

  // Subscribe to targetLayerStore for settings
  const settings = useStore(targetLayerStore, state => (state as any).settings || {})

  const STYLE_CASE_OPTIONS = useMemo(
    () => [
      { value: 'none', label: t('none') },
      { value: 'uppercase', label: t('uppercase') },
      { value: 'lowercase', label: t('lowercase') },
      { value: 'title', label: t('titlecase') },
      { value: 'sentence', label: t('sentencecase') },
    ],
    [t]
  )

  /**
   * Handle style case changes with content transformation and option set mutations
   */
  const onChangeStyleCase = useCallback(
    (value: string) => {
      const currentSettings = targetLayerStore.getState().settings as TextSettings
      const { content = '' } = currentSettings

      // Mutate the content right away when style case changes to keep all places in sync
      const transformedContent = applyStyleCase(content, value)

      // Mutate the text option set if existing
      const textOptionSet = element.getEditingOptionSet(EOptionSet.TEXT_OPTION)
      // Mutate the text option set style case
      mutateTextOptionSetStyleCase(textOptionSet, targetLayerStore, value)

      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              styleCase: value,
              content: transformedContent,
            },
          },
        },
      })
    },
    [element, targetLayerStore]
  )

  const WRAP_OPTIONS = useMemo(
    () => [
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('none')}
          </Text>
        ),
        value: 'none',
        disabled: settings.allowMultiLineText,
      },
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('word')}
          </Text>
        ),
        value: 'word',
      },
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('character')}
          </Text>
        ),
        value: 'char',
      },
    ],
    [settings.allowMultiLineText, t]
  )

  return (
    <BlockStack gap={'400'}>
      <BlockStack gap={'150'}>
        <Text as="p" variant="bodyMd">
          {t('style-case')}
        </Text>
        <Select
          options={STYLE_CASE_OPTIONS}
          value={settings.styleCase}
          onChange={onChangeStyleCase}
          label={t('style-case')}
          labelHidden
        />
      </BlockStack>

      <NumericSliderField
        label={t('letter-spacing')}
        value={settings.letterSpacing}
        min={MINIMUM_RANGE_LETTER_SPACING}
        max={MAXIMUM_RANGE_LETTER_SPACING}
        step={0.5}
        suffix="px"
        onChange={(value: number) => {
          const currentSettings = targetLayerStore.getState().settings || {}
          targetLayerStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                settings: { ...currentSettings, letterSpacing: value },
              },
            },
          })
        }}
      />

      <NumericSliderField
        label={t('line-height')}
        value={settings.lineHeight ?? MINIMUM_RANGE_LINE_HEIGHT}
        min={MINIMUM_RANGE_LINE_HEIGHT}
        max={MAXIMUM_RANGE_LINE_HEIGHT}
        step={0.1}
        suffix="px"
        onChange={(value: number) => {
          const currentSettings = targetLayerStore.getState().settings || {}
          targetLayerStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: {
                settings: { ...currentSettings, lineHeight: value },
              },
            },
          })
        }}
      />

      <BlockStack gap={'150'}>
        <Text as="p" variant="bodyMd">
          {t('vertical-alignment')}
        </Text>
        <MultipleButtonToggle
          disableToggle
          selected={[settings.verticalAlign]}
          options={[
            { label: VerticalAlignTopIcon, value: 'top' },
            { label: VerticalAlignCenterIcon, value: 'middle' },
            { label: VerticalAlignBottomIcon, value: 'bottom' },
          ]}
          onClick={(value: string[]) => {
            const currentSettings = targetLayerStore.getState().settings || {}
            targetLayerStore.dispatch({
              type: 'UPDATE_LAYER',
              payload: {
                state: {
                  settings: { ...currentSettings, verticalAlign: value[0] },
                },
              },
            })
          }}
        />
      </BlockStack>

      <BlockStack gap={'150'}>
        <Text as="p" variant="bodyMd">
          {t('wrap-mode')}
        </Text>
        <MultipleButtonToggle
          selected={[settings.wrap]}
          options={WRAP_OPTIONS}
          onClick={(value: string[]) => {
            const currentSettings = targetLayerStore.getState().settings || {}
            targetLayerStore.dispatch({
              type: 'UPDATE_LAYER',
              payload: {
                state: {
                  settings: { ...currentSettings, wrap: value[0] },
                },
              },
            })
          }}
        />
      </BlockStack>
    </BlockStack>
  )
}
