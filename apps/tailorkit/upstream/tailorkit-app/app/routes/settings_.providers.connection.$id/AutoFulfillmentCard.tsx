import { Box, Card } from '@shopify/polaris'
import Switch from '~/components/common/Switch'
import { useTranslation } from 'react-i18next'

export const AutoFulfillmentCard = (props: {
  autoFulfill: boolean
  setAutoFulfill: (autoFulfill: boolean) => void
  layout?: 'page' | 'modal'
}) => {
  const { t } = useTranslation()
  const { autoFulfill, setAutoFulfill, layout = 'page' } = props

  const toggleAutoFulfill = () => {
    setAutoFulfill(!autoFulfill)
  }

  const Wrapper = layout === 'page' ? Card : Box

  return (
    <div id="auto-fulfillment-card">
      <Wrapper>
        <Switch
          checked={autoFulfill}
          label={t('enable-auto-fulfillment')}
          accessibilityLabel={t('enable-auto-fulfillment')}
          details={t(
            'if-disabled-you-need-to-visit-the-order-detail-screen-inside-tailorkit-to-fulfill-an-order-manually'
          )}
          onInput={toggleAutoFulfill}
        />
      </Wrapper>
    </div>
  )
}
