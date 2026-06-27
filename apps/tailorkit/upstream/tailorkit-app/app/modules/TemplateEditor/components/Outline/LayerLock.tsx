import { Button, Icon } from '@shopify/polaris'
import { LockIcon } from '@shopify/polaris-icons'

export function LayerLock() {
  return (
    <div className="Lock-Icon">
      <Button icon={<Icon source={LockIcon} tone="base" />} variant="plain" />
    </div>
  )
}
