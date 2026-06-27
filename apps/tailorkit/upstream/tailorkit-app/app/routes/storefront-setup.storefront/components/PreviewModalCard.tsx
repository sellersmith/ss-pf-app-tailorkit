import { Card } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import ModalPersonalizeDesignSetting from '~/routes/storefront-setup/components/ModalPersonalizeDesignSetting'

interface ModalPersonalizeDesignValue {
  mobile: boolean
  desktop: boolean
  showAddToCart?: boolean
  showBuyItNow?: boolean
}

interface PreviewModalCardProps {
  isSaving: boolean
  value: ModalPersonalizeDesignValue
  onChange: (value: ModalPersonalizeDesignValue) => void
}

export default function PreviewModalCard({ isSaving, value, onChange }: PreviewModalCardProps) {
  const { t } = useTranslation()

  return (
    <SettingLayout title={t('real-time-preview-modal')}>
      <Card>
        <ModalPersonalizeDesignSetting isSaving={isSaving} value={value} onChange={onChange} />
      </Card>
    </SettingLayout>
  )
}
