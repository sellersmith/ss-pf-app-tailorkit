import { InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { CenterContainer } from '~/components/common/CenterContainer'
import ProgressBarComponent from '~/components/common/ProgressBarState'
import { useStore } from '~/libs/external-store'
import { ProgressStore } from '~/stores/canvas/progress'

export function ProgressProcessPSD() {
  const { t } = useTranslation()
  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const progress = total > 0 ? (index / total) * 100 : 0

  return (
    <CenterContainer style={{ gridTemplateColumns: '0.5fr auto' }}>
      <InlineStack align="center" gap={'100'}>
        <Text as="p" variant="bodyMd">
          {t('almost-done')}
        </Text>
        <ProgressBarComponent progress={progress} tone="success" size="medium" />
      </InlineStack>
    </CenterContainer>
  )
}
