import type { ButtonProps } from '@shopify/polaris'
import { Button, Icon } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'

export function LayerEditor(props: ButtonProps) {
  return (
    <Button icon={<Icon source={EditIcon} />} {...props} size="micro">
      Option
    </Button>
  )
}
