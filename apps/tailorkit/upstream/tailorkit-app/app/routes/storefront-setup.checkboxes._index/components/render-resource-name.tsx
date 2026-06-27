import type { TFunction } from 'i18next'

export const renderResourceName = ({ t }: { t: TFunction }) => ({
  singular: t('addon'),
  plural: t('addon-products'),
})
