import { Box } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

interface ICustomPathInvertedProps {
  customPathInverted: boolean
  onChangeCustomPathInverted: (value: boolean) => void
}

export const CustomPathInverted = (props: ICustomPathInvertedProps) => {
  const { t } = useTranslation()
  const { customPathInverted, onChangeCustomPathInverted } = props

  return (
    <Box>
      <Switch
        label={t('invert-direction')}
        details={t('text-flows-in-reverse-direction-along-the-path-when-enabled')}
        checked={customPathInverted}
        onChange={onChangeCustomPathInverted}
      />
    </Box>
  )
}
