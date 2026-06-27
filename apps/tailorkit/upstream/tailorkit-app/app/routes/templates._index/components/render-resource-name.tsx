import type { IRenderResourceNameProps } from '../type'

// Define resource name
export function renderResourceName(props: IRenderResourceNameProps) {
  const { t } = props

  return {
    singular: t('template'),
    plural: t('templates'),
  }
}
