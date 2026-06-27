import { Button, Icon, Text, Tooltip } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { useInspectorPanel } from '../../../common/StylingInspector/useInspectorPanel'
import { WandIcon } from '@shopify/polaris-icons'
import type { ButtonProps } from '@shopify/polaris'

interface TextEffectsBlockProps {
  buttonProps?: ButtonProps
}

export const TextEffectsBlock = (props: TextEffectsBlockProps) => {
  const { buttonProps } = props || {}
  const { t } = useTranslation()

  // Simple hook - only stores panel ID, content rendered fresh by registry!
  const { openInspector, isOpen } = useInspectorPanel('effects', t('effects'))

  return (
    <Tooltip content={t('effects')}>
      <FlexCenter>
        <Button
          pressed={isOpen}
          variant="tertiary"
          icon={<Icon tone="success" source={WandIcon} />}
          onClick={openInspector}
          {...buttonProps}
        >
          {/* @ts-expect-error -- Polaris Button types don't allow children alongside icon prop */}
          {buttonProps?.children ? (
            buttonProps.children
          ) : (
            <Text variant="bodyMd" fontWeight="medium" as="span" tone="success">
              {t('effects')}
            </Text>
          )}
        </Button>
      </FlexCenter>
    </Tooltip>
  )
}
