import {
  Box,
  EmptySearchResult,
  EmptyState,
  Icon,
  TextField,
  Text,
  ResourceItem,
  RadioButton,
  Tooltip,
  Scrollable,
  ResourceList,
} from '@shopify/polaris'
import { OPTION_SET_SELECTOR } from '~/modules/TemplateEditor/components/Inspector/constants'
import { SubInspector } from '~/modules/TemplateEditor/components/Inspector/SubInspector'
import { useTranslation } from 'react-i18next'
import { SearchIcon } from '@shopify/polaris-icons'
import { ELayerType, optionSetDataKeys } from '~/types/psd'
import type { OptionSet, SHAPE_OPTION_SET, EOptionSet } from '~/types/psd'
import { OPTION_SET_TYPE_FORMATTED } from '~/routes/libraries._index/constants'
import type { LayerDocument } from '~/models/Layer.server'
import { useStore } from '~/libs/external-store'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { getLayerStoreById } from '~/stores/modules/layer'
import { useMemo, useState } from 'react'
import { ILLUSTRATORS } from '~/constants/assets-url'
import type { IOptionSetConfigurationCommonProps } from '~/modules/TemplateEditor/elements/components/common/OptionSetConfiguration'
import { evaluateTextOptionSetStyleCase } from '../../Text/TextOptionSet/fns'

interface IOptionSetSelectorDrawerProps extends IOptionSetConfigurationCommonProps {
  optionSetEditing: OptionSet
  layerState: LayerDocument
  optionSetList: OptionSet[]
  existOptionSetPressed: boolean
}

export default function OptionSetSelectorDrawer(props: IOptionSetSelectorDrawerProps) {
  const {
    optionSetEditing,
    layerState,
    optionSetList,
    existOptionSetPressed,
    setButtonsStatus,
    clearOptionSetValidationErrors,
  } = props
  const { t } = useTranslation()

  const keySubInspector = useStore(SubInspectorStore, state => state.key)
  const dataOfSubInspector = useStore(SubInspectorStore, state => state.data)

  const [queryString, setQueryString] = useState('')
  const [optionSetSelected, setOptionSetSelected] = useState<OptionSet | null>(null)

  const optionSetType = optionSetEditing.type as keyof typeof optionSetDataKeys
  const typeKey = OPTION_SET_TYPE_FORMATTED[optionSetType as EOptionSet]

  const optionSetDataKey = optionSetDataKeys[optionSetType]

  // Filter option sets only when dependencies change to avoid redundant computations
  const optionSetListFiltered = useMemo(
    () =>
      optionSetList.filter(
        optionSet =>
          optionSet.data?.[optionSetDataKey]?.length > 0
          && optionSet.label?.toLowerCase()?.includes(queryString.toLowerCase().trim())
      ),
    [optionSetList, optionSetDataKey, queryString]
  )

  const isEmptyState = !queryString && optionSetListFiltered.length === 0
  const isEmptySearchResult = queryString && optionSetListFiltered.length === 0

  const updatedButtonStatus = useMemo(() => {
    const hasData = optionSetEditing.data
    return { editMode: !!hasData, existOptionSetPressed: !!hasData }
  }, [optionSetEditing])

  const handleCloseSubInspector = ({
    editMode = false,
    existOptionSetPressed = false,
  }: {
    editMode?: boolean
    existOptionSetPressed?: boolean
  }) => {
    const buttonStatus = { editMode, existOptionSetPressed }
    setButtonsStatus(buttonStatus, optionSetType)

    if (!buttonStatus.editMode) {
      clearOptionSetValidationErrors(optionSetEditing)
    }

    // Close the sub inspector
    setTimeout(() => {
      SubInspectorStore.dispatch({ type: 'CLOSE_SUB_INSPECTOR' })
      setOptionSetSelected(null)
    }, 100)
  }

  const handleSelectOptionSet = () => {
    clearOptionSetValidationErrors(optionSetEditing)

    const layerStore = getLayerStoreById(layerState._id)
    const type = layerStore.getState().type
    if (optionSetSelected) {
      // Only transform the option set when necessary to keep performance optimal
      const optionSetToApply = (() => {
        switch (type) {
          case ELayerType.TEXT:
            return evaluateTextOptionSetStyleCase(optionSetSelected, layerStore.getState().settings?.styleCase)
          default:
            return optionSetSelected
        }
      })()

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: optionSetToApply,
          fromOption: optionSetEditing,
        },
      })

      // Auto-create label override to prevent cross-layer interference
      layerStore.dispatch({
        type: 'UPDATE_LAYER_SETTINGS_STOREFRONT_OPTION_SET_LABEL',
        payload: {
          optionSetType: optionSetToApply.type,
          label: optionSetToApply.labelOnStoreFront,
        },
      })
    }
    handleCloseSubInspector({ editMode: false, existOptionSetPressed })
  }

  const handleSearch = (value: string) => {
    setQueryString(value)
  }

  const handleChangeSelected = (value: OptionSet) => {
    setOptionSetSelected(value)
  }

  const renderItem = (item: Exclude<OptionSet, SHAPE_OPTION_SET>) => {
    return (
      <ResourceItem
        key={item._id}
        id={item._id}
        onClick={() => {
          handleChangeSelected(item)
        }}
      >
        <RadioButton
          label={
            <Box width="270px">
              <Tooltip content={item.label}>
                <Text variant="bodyMd" as={'p'} truncate>
                  {item.label}
                </Text>
              </Tooltip>
            </Box>
          }
          name={item.label}
          checked={(optionSetSelected || optionSetEditing)?._id === item._id}
          onChange={v => handleChangeSelected(item)}
        />
      </ResourceItem>
    )
  }

  return (
    <SubInspector
      key={optionSetEditing._id}
      title={t('select-type-option-set', { type: typeKey })}
      onClose={() => handleCloseSubInspector(updatedButtonStatus)}
      isOpen={keySubInspector === OPTION_SET_SELECTOR && optionSetType === dataOfSubInspector?.optionType}
      secondaryAction={{
        action: t('cancel'),
        onAction: () => handleCloseSubInspector(updatedButtonStatus),
      }}
      primaryAction={{
        action: t('done'),
        onAction: handleSelectOptionSet,
        disabled: !optionSetSelected?.data || optionSetSelected?._id === optionSetEditing._id,
      }}
    >
      <Box paddingInline={'300'} paddingBlock={'200'}>
        {!isEmptyState && (
          <TextField
            label="Option set image Search"
            labelHidden
            autoComplete="off"
            placeholder={t('search-type-option-set', { type: typeKey })}
            onChange={handleSearch}
            value={queryString}
            prefix={<Icon source={SearchIcon} />}
            clearButton
            onClearButtonClick={() => {
              handleSearch('')
            }}
          />
        )}

        {isEmptyState || isEmptySearchResult ? (
          <OptionSetListEmptyState queryString={queryString} optionSetType={optionSetType} />
        ) : (
          <Box paddingBlockStart={'300'}>
            <Box borderColor="border" borderRadius="200" borderWidth="025">
              <Scrollable style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <ResourceList
                  items={optionSetListFiltered}
                  renderItem={renderItem}
                  resolveItemId={item => item._id}
                  showHeader={false}
                />
              </Scrollable>
            </Box>
          </Box>
        )}
      </Box>
    </SubInspector>
  )
}

const OptionSetListEmptyState = ({
  queryString,
  optionSetType,
}: {
  queryString: string
  optionSetType: EOptionSet
}) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--p-space-300)',
      }}
    >
      {queryString ? (
        <EmptySearchResult
          withIllustration
          title={'No option set found'}
          description="Please select each layer to set up the option set!"
        />
      ) : (
        <EmptyState image={ILLUSTRATORS.EMPTY_OPTION_SET}>
          <Text variant="bodyMd" as="p">
            {t('let-s-start-creating-type-option-set-to-build-list-for-choosing', {
              type: OPTION_SET_TYPE_FORMATTED[optionSetType as EOptionSet],
            })}
          </Text>
        </EmptyState>
      )}
    </div>
  )
}
