import { BlockStack, Button, Text } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { VerticalAlignBottomIcon, VerticalAlignCenterIcon, VerticalAlignTopIcon } from '~/assets/icons'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import type { TextSettings } from '~/types/psd'
import PopoverStyle from '../../../common/PopoverStyle'

interface VerticalAlignmentProps {
  verticalAlign: NonNullable<TextSettings['verticalAlign']>
  onChangeVerticalAlignment: (value: NonNullable<TextSettings['verticalAlign']>[]) => void
}

export const VerticalAlignment = (props: VerticalAlignmentProps) => {
  const { verticalAlign, onChangeVerticalAlignment } = props
  const { t } = useTranslation()

  const options = useMemo(
    () => [
      { label: VerticalAlignTopIcon, value: 'top' },
      { label: VerticalAlignCenterIcon, value: 'middle' },
      { label: VerticalAlignBottomIcon, value: 'bottom' },
    ],
    []
  )

  const activator = <Button variant="plain" icon={options.find(option => option.value === verticalAlign)?.label} />

  return (
    <PopoverStyle activator={activator} tooltip={t('vertical-alignment')}>
      <BlockStack gap="150">
        <Text as="p" variant="bodyMd">
          {t('vertical-alignment')}
        </Text>
        <MultipleButtonToggle
          disableToggle
          selected={[verticalAlign]}
          options={options}
          onClick={onChangeVerticalAlignment}
        />
      </BlockStack>
    </PopoverStyle>
  )
}
