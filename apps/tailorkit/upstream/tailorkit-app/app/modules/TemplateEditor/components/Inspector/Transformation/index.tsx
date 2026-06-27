import { Button, Tooltip } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { useInspectorPanel } from '../../../elements/components/common/StylingInspector/useInspectorPanel'

export function TransformationInspector() {
  const { t } = useTranslation()

  // Simple hook - content is rendered fresh by registry using element state!
  const { openInspector, isOpen } = useInspectorPanel('transformation', t('transformation'))

  return (
    <Tooltip content={t('transformation')}>
      <FlexCenter>
        <Button pressed={isOpen} variant="tertiary" onClick={openInspector}>
          {t('transformation')}
        </Button>
      </FlexCenter>
    </Tooltip>
  )
}
