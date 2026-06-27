import { EOptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import type { getClickedLayerStore } from '~/stores/modules/layer-store-selection'
import type { PostAction } from '../../../Editor/utils/element-presets/types'

/**
 * Apply personalization settings from postActions to a given layer store.
 * Does NOT open any inspector panel — purely applies settings.
 */
export function applyPersonalizationActions(
  layerStore: ReturnType<typeof getClickedLayerStore>,
  postActions: PostAction[]
): void {
  if (!layerStore) return

  for (const action of postActions) {
    const config = action.config as Record<string, unknown>

    if (action.type === 'open-personalize-text') {
      const section = config.section as string | undefined
      const settings: Record<string, unknown> = {
        textCreatedBy: section === 'buyers' ? 'customers' : 'merchant',
      }

      if (section === 'buyers') {
        if (config.label) settings.storefrontLabel = config.label
        if (config.placeholder) settings.placeholder = config.placeholder
        if (config.required !== undefined) {
          settings.required = config.required
          if (config.required) settings.hideWhenEmpty = false
        }
        if (config.fieldType === 'single-line') {
          settings.allowMultiLineText = false
          settings.wrap = 'none'
        } else if (config.fieldType === 'multi-line') {
          settings.allowMultiLineText = true
          settings.wrap = 'word'
        }
        if (config.characterLimit !== undefined) {
          settings.characterLimit = config.characterLimit
        }
      }

      if (section === 'yourself') {
        if (config.label) settings.storefrontLabel = config.label
      }

      const existingSettings = layerStore.getState().settings || {}
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { settings: { ...existingSettings, ...settings } } },
      })

      // Create text option set for 'yourself' section
      if (section === 'yourself' && config.optionSet) {
        const optionSetConfig = config.optionSet as { label: string; options: string[] }
        const optionSetList = layerStore.getState().optionSet || []
        const textOptionSet = optionSetList.find((os: any) => os.type === EOptionSet.TEXT_OPTION)

        if (textOptionSet) {
          const textItems = optionSetConfig.options.map((name, index) => ({
            _id: uuid(),
            name,
            selecting: index === 0,
          }))

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: {
              optionSet: {
                ...textOptionSet,
                data: { texts: textItems },
                label: optionSetConfig.label,
                labelOnStoreFront: optionSetConfig.label,
              } as any,
              fromOption: textOptionSet,
            },
          })

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET_EDITING_STATE',
            payload: {
              optionSetType: EOptionSet.TEXT_OPTION,
              editingState: {
                newOptionSetPressed: true,
                existOptionSetPressed: false,
                editMode: true,
              },
            },
          })
        }
      }
    }

    // Apply color personalization: populate color option set with preset color options
    if (action.type === 'open-personalize-color') {
      const colorOptions = config.options as Array<{ name: string; value: string }>
      const label = (config.label as string) || 'Select font color'

      if (colorOptions?.length > 0) {
        const optionSetList = layerStore.getState().optionSet || []
        const colorOptionSet = optionSetList.find((os: any) => os.type === EOptionSet.COLOR_OPTION)

        if (colorOptionSet) {
          const colorItems = colorOptions.map((color, index) => ({
            _id: uuid(),
            name: color.name,
            value: color.value,
            selecting: index === 0,
          }))

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: {
              optionSet: {
                ...colorOptionSet,
                data: { colors: colorItems, displayStyle: 'color_swatch' },
                label,
                labelOnStoreFront: label,
              } as any,
              fromOption: colorOptionSet,
            },
          })

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET_EDITING_STATE',
            payload: {
              optionSetType: EOptionSet.COLOR_OPTION,
              editingState: {
                newOptionSetPressed: true,
                existOptionSetPressed: false,
                editMode: true,
              },
            },
          })
        }
      }
    }

    // Apply font personalization: populate font option set with preset font options
    if (action.type === 'open-personalize-font') {
      const fontOptions = config.options as Array<{ family: string; src: string }>
      const label = (config.label as string) || 'Select font family'

      if (fontOptions?.length > 0) {
        const optionSetList = layerStore.getState().optionSet || []
        const fontOptionSet = optionSetList.find((os: any) => os.type === EOptionSet.FONT_OPTION)

        if (fontOptionSet) {
          const fontItems = fontOptions.map((font, index) => {
            const isGoogle = typeof font.src === 'string' && /fonts\.gstatic\.com/.test(font.src)
            return {
              _id: uuid(),
              name: font.family,
              family: font.family,
              src: font.src,
              selecting: index === 0,
              svgString: '',
              fontSource: isGoogle ? 'google' : 'custom',
            }
          })

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: {
              optionSet: {
                ...fontOptionSet,
                data: { fonts: fontItems, displayStyle: 'font_swatch' },
                label,
                labelOnStoreFront: label,
              } as any,
              fromOption: fontOptionSet,
            },
          })

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET_EDITING_STATE',
            payload: {
              optionSetType: EOptionSet.FONT_OPTION,
              editingState: {
                newOptionSetPressed: true,
                existOptionSetPressed: false,
                editMode: true,
              },
            },
          })
        }
      }
    }
  }
}
