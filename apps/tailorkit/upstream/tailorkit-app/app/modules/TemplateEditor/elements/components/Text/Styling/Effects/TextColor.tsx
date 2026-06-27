import { Button, Icon, Tooltip } from '@shopify/polaris'
import { TextColorIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useInspectorPanel } from '../../../common/StylingInspector/useInspectorPanel'
import { FlexCenter } from '~/components/common/Flex'

/**
 * Fill button - Opens the unified fill panel (solid, image, gradient)
 * Replaces the old TextColor button but keeps the same icon
 */
export const Fill = () => {
  const { t } = useTranslation()

  // Use new fill panel with unified fill support
  const { openInspector, isOpen } = useInspectorPanel('fill', t('fill'))

  return (
    <Tooltip content={t('fill')}>
      <FlexCenter>
        <Button
          pressed={isOpen}
          variant={isOpen ? 'secondary' : 'tertiary'}
          fullWidth
          icon={<Icon source={TextColorIcon} />}
          onClick={openInspector}
        />
      </FlexCenter>
    </Tooltip>
  )
}

/**
 * @deprecated Use Fill instead
 * Legacy TextColor button - kept for backward compatibility
 */
export const TextColor = () => {
  const { t } = useTranslation()

  // Simple hook - only stores panel ID, content rendered fresh by registry!
  const { openInspector, isOpen } = useInspectorPanel('text-color', t('text-color'))

  return (
    <Tooltip content={t('text-color')}>
      <FlexCenter>
        <Button
          pressed={isOpen}
          variant={isOpen ? 'secondary' : 'tertiary'}
          fullWidth
          icon={<Icon source={TextColorIcon} />}
          onClick={openInspector}
        />
      </FlexCenter>
    </Tooltip>
  )
}
