import type { IconProps } from '@shopify/polaris'
import { Button, Icon, Tooltip } from '@shopify/polaris'
import { RemoveBackgroundIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { useInspectorPanel } from '~/modules/TemplateEditor/elements/components/common/StylingInspector/useInspectorPanel'

export function RemoveBackgroundButton() {
  const { t } = useTranslation()
  const { openInspector, isOpen } = useInspectorPanel('remove-background', t('remove-background'))

  return (
    <div className={styles.ToolItem}>
      <Tooltip content={t('background-removal-tool')} active={isOpen ? false : undefined}>
        <Button
          pressed={isOpen}
          variant="tertiary"
          onClick={openInspector}
          icon={<Icon source={RemoveBackgroundIcon as IconProps['source']} tone="success" />}
        >
          {t('remove-background')}
        </Button>
      </Tooltip>
    </div>
  )
}
