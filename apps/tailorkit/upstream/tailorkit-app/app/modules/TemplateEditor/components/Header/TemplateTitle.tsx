import { Button, Icon, Text, Tooltip } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import TextFieldPopover from '~/components/common/TextFieldPopover'
import { MAX_TEMPLATE_NAME_SIZE } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'

export default function TemplateTitle(props: WithTranslationProps) {
  const { t } = props
  const name = useStore(TemplateEditorStore, state => state.name)

  const onNameChange = useCallback(function setName(value: string) {
    // Validate title length
    if (value.length > MAX_TEMPLATE_NAME_SIZE) {
      value = value.substring(0, 60)
    }

    TemplateEditorStore.dispatch({
      type: 'SET_NAME',
      payload: {
        name: value,
      },
    })
  }, [])

  const activator = (
    <Tooltip content={t('edit-template-name')}>
      <Button variant="tertiary" icon={<Icon source={EditIcon} tone="base" />}>
        {/* @ts-ignore */}
        <TemplateTitleUIComponent name={name} showTooltip={false} />
      </Button>
    </Tooltip>
  )

  return (
    <TextFieldPopover
      value={name}
      setValue={onNameChange}
      activator={activator}
      label={t('template-name')}
      maxLength={MAX_TEMPLATE_NAME_SIZE}
    />
  )
}

export function TemplateTitleUIComponent(props: {
  name: string
  maxWidth?: string | number
  minWidth?: string | number
  showTooltip?: boolean
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold'
}) {
  const { name, maxWidth = '20vw', minWidth = '50px', showTooltip = true, fontWeight = 'regular' } = props

  return (
    <div
      style={{
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
      }}
    >
      {showTooltip ? (
        <Tooltip content={name}>
          <Text as="h2" variant="bodyMd" truncate fontWeight={fontWeight}>
            {name}
          </Text>
        </Tooltip>
      ) : (
        <Text as="h2" variant="bodyMd" truncate fontWeight={fontWeight}>
          {name}
        </Text>
      )}
    </div>
  )
}
