import { BlockStack, Box, Button, Text } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import type { TextSettings } from '~/types/psd'
import PopoverStyle from '../../../common/PopoverStyle'

interface ITextWrapProps {
  wrap: TextSettings['wrap']
  allowMultiLineText: TextSettings['allowMultiLineText']
  onChangeWrap: (value: TextSettings['wrap'][]) => void
}

export const TextWrap = (props: ITextWrapProps) => {
  const { wrap, allowMultiLineText, onChangeWrap } = props
  const { t } = useTranslation()

  const options = useMemo(() => {
    return [
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('none')}
          </Text>
        ),
        content: t('none'),
        value: 'none',
        disabled: allowMultiLineText,
      },
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('word')}
          </Text>
        ),
        content: t('word'),
        value: 'word',
      },
      {
        label: (
          <Text as="span" variant="bodySm">
            {t('character')}
          </Text>
        ),
        content: t('character'),
        value: 'char',
      },
    ]
  }, [t, allowMultiLineText])

  const currentOption = useMemo(() => options.find(option => option.value === wrap), [options, wrap])

  const activator = <Button variant={'secondary'}>{currentOption?.content}</Button>

  return (
    <PopoverStyle activator={activator} tooltip={t('wrap-mode')}>
      <Box minWidth="200px">
        <BlockStack gap="150">
          <Text as="p" variant="bodyMd">
            {t('wrap-mode')}
          </Text>

          <MultipleButtonToggle selected={[wrap]} options={options} onClick={onChangeWrap} />
        </BlockStack>
      </Box>
    </PopoverStyle>
  )
}
