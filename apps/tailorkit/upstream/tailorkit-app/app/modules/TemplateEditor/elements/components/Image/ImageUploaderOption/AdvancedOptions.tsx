import { BlockStack, Icon, InlineStack, OptionList, Popover, Text, TextField, Tooltip } from '@shopify/polaris'
import { SelectIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AdvancedOptionsProps {
  allowCustomerToUseQuickPrompts?: boolean
  autoRemoveSolidWhiteBackground?: boolean
  allowCustomerToUseReferenceImage?: boolean
  handleAllowCustomerToUseReferenceImageChange: (checked: boolean) => void
  handleAllowCustomerToUseQuickPromptsChange: (checked: boolean) => void
  handleAutoRemoveSolidBackgroundChange: (checked: boolean) => void
}

const OPTION_KEYS = {
  REFERENCE_IMAGE: 'reference-image',
  QUICK_PROMPTS: 'quick-prompts',
  AUTO_REMOVE_BG: 'auto-remove-bg',
} as const

export default function AdvancedOptions(props: AdvancedOptionsProps) {
  const {
    allowCustomerToUseQuickPrompts,
    allowCustomerToUseReferenceImage,
    handleAllowCustomerToUseQuickPromptsChange,
    handleAllowCustomerToUseReferenceImageChange,
    autoRemoveSolidWhiteBackground,
    handleAutoRemoveSolidBackgroundChange,
  } = props
  const [popoverActive, setPopoverActive] = useState(false)

  const { t } = useTranslation()

  const togglePopover = useCallback(() => {
    setPopoverActive(active => !active)
  }, [])

  const selected = useMemo(() => {
    const result: string[] = []
    if (allowCustomerToUseReferenceImage) result.push(OPTION_KEYS.REFERENCE_IMAGE)
    if (allowCustomerToUseQuickPrompts) result.push(OPTION_KEYS.QUICK_PROMPTS)
    if (autoRemoveSolidWhiteBackground) result.push(OPTION_KEYS.AUTO_REMOVE_BG)
    return result
  }, [allowCustomerToUseReferenceImage, allowCustomerToUseQuickPrompts, autoRemoveSolidWhiteBackground])

  const handleSelectionChange = useCallback(
    (newSelected: string[]) => {
      const wasReferenceImageSelected = selected.includes(OPTION_KEYS.REFERENCE_IMAGE)
      const isReferenceImageSelected = newSelected.includes(OPTION_KEYS.REFERENCE_IMAGE)
      if (wasReferenceImageSelected !== isReferenceImageSelected) {
        handleAllowCustomerToUseReferenceImageChange(isReferenceImageSelected)
      }

      const wasQuickPromptsSelected = selected.includes(OPTION_KEYS.QUICK_PROMPTS)
      const isQuickPromptsSelected = newSelected.includes(OPTION_KEYS.QUICK_PROMPTS)
      if (wasQuickPromptsSelected !== isQuickPromptsSelected) {
        handleAllowCustomerToUseQuickPromptsChange(isQuickPromptsSelected)
      }

      const wasAutoRemoveBgSelected = selected.includes(OPTION_KEYS.AUTO_REMOVE_BG)
      const isAutoRemoveBgSelected = newSelected.includes(OPTION_KEYS.AUTO_REMOVE_BG)
      if (wasAutoRemoveBgSelected !== isAutoRemoveBgSelected) {
        handleAutoRemoveSolidBackgroundChange(isAutoRemoveBgSelected)
      }
    },
    [
      selected,
      handleAllowCustomerToUseReferenceImageChange,
      handleAllowCustomerToUseQuickPromptsChange,
      handleAutoRemoveSolidBackgroundChange,
    ]
  )

  const options = useMemo(
    () => [
      {
        value: OPTION_KEYS.REFERENCE_IMAGE,
        label: t('allow-buyers-to-upload-reference-image'),
      },
      {
        value: OPTION_KEYS.QUICK_PROMPTS,
        label: t('allow-buyers-to-add-description'),
      },
      {
        value: OPTION_KEYS.AUTO_REMOVE_BG,
        label: (
          <Tooltip content={t('auto-remove-solid-white-background-tooltip')} hoverDelay={500}>
            <span>{t('auto-remove-solid-white-background')}</span>
          </Tooltip>
        ),
        labelString: t('auto-remove-solid-white-background'),
      },
    ],
    [t]
  )

  const displayValue = useMemo(() => {
    if (selected.length === 0) return ''
    if (selected.length === 1) {
      const option = options.find(opt => opt.value === selected[0])
      return option?.labelString || ''
    }
    return t('n-items-selected', { count: selected.length, type: t('options') })
  }, [selected, options, t])

  const activator = (
    <div onClick={togglePopover} style={{ cursor: 'pointer' }}>
      <TextField
        label={t('advanced-options')}
        labelHidden
        autoComplete="off"
        value={displayValue}
        placeholder={t('advanced-options')}
        suffix={<Icon source={SelectIcon} />}
        readOnly
      />
    </div>
  )

  return (
    <BlockStack gap="100">
      <InlineStack gap="100" blockAlign="center">
        <Text as="span" variant="bodyMd">
          {t('advanced-options')}
        </Text>
      </InlineStack>
      <Popover
        active={popoverActive}
        activator={activator}
        onClose={togglePopover}
        preferredAlignment="left"
        fullWidth
        fullHeight
      >
        <Popover.Pane>
          <div style={{ minHeight: '170px' }}>
            <OptionList onChange={handleSelectionChange} options={options} selected={selected} allowMultiple />
          </div>
        </Popover.Pane>
      </Popover>
    </BlockStack>
  )
}
