import { useLocalStorage } from '~/utils/hooks/useLocalStorage'

export const PRINTIFY_KEY_LOCAL_STORAGE = 'selected-products-table-page-printify'
export const OTHER_PROVIDERS_KEY_LOCAL_STORAGE = 'selected-products-table-page-other-providers'

type UseImportedProductsListInitialPage = {
  printifyChoiceInitialPage: number
  otherProvidersInitialPage: number
  setPrintifyChoiceInitialPage: (page: number) => void
  setOtherProvidersInitialPage: (page: number) => void
}

/**
 * Hook to manage the initial page for the selected products table
 * @returns {Object} An object containing the initial page for the selected products table
 */
export const useImportedProductsListInitialPage = (): UseImportedProductsListInitialPage => {
  const [printifyChoiceInitialPage, setPrintifyChoiceInitialPage] = useLocalStorage(PRINTIFY_KEY_LOCAL_STORAGE, 1)

  const [otherProvidersInitialPage, setOtherProvidersInitialPage] = useLocalStorage(
    OTHER_PROVIDERS_KEY_LOCAL_STORAGE,
    1
  )

  return {
    printifyChoiceInitialPage,
    otherProvidersInitialPage,
    setPrintifyChoiceInitialPage,
    setOtherProvidersInitialPage,
  }
}
