import { Box } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

interface ICircleInvertedProps {
  circleInverted: boolean
  onChangeCircleInverted: (value: boolean) => void
}

export const CircleInverted = (props: ICircleInvertedProps) => {
  const { t } = useTranslation()
  const { circleInverted, onChangeCircleInverted } = props

  return (
    <Box>
      <Switch
        label={t('invert-direction')}
        details={t('text-flows-counter-clockwise-when-enabled')}
        checked={circleInverted}
        onChange={onChangeCircleInverted}
      />
    </Box>
  )
}
