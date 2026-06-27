import type { TFunction } from 'i18next'

// Reusable type for the 't' function
type TTranslationFunction = TFunction<'translation', undefined>

// Define the props interface with a common 't' function type
export interface IRenderFiltersProps {
  t: TTranslationFunction
}

export interface IRenderSortOptionsProps {
  t: TTranslationFunction
}

export interface IRenderResourceNameProps {
  t: TTranslationFunction
}
