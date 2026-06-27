import type { TailorKitProductPersonalizer } from '../../components/product-personalizer'
import { handleTextShapeChange } from '../optionHandlers'
import { findViewAndSwitchTo } from '../../utils/query-views'

export const handleTextShapeClick = (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
  handleTextShapeChange(target, instance.renderCanvas.bind(instance))

  // Find and switch to the appropriate view for this layer
  const fieldset = target.closest('fieldset') as HTMLFieldSetElement | null
  findViewAndSwitchTo(instance, fieldset)
}
