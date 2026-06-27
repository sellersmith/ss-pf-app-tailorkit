import { Checkbox } from '@shopify/polaris'
import { useCallback, useState } from 'react'

export function LayerCheckbox() {
  const [checked, setChecked] = useState(false)
  const handleChange = useCallback((newChecked: boolean) => setChecked(newChecked), [])

  return (
    <div style={{ display: 'inline-flex' }} className="Checkbox-Icon">
      <Checkbox label="Layer checkbox" labelHidden checked={checked} onChange={handleChange} />
    </div>
  )
}
