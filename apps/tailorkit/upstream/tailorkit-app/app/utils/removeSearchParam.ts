// TypeScript type for searchParams to ensure it's a URLSearchParams object
type SearchParams = URLSearchParams

/**
 * Function to remove a query parameter from the URL's search params
 *
 * @param searchParams - The current URLSearchParams object
 * @param setSearchParams - The function to update the search params
 * @param paramToRemove - The name of the parameter to be removed
 */
export function removeSearchParam(
  searchParams: SearchParams,
  setSearchParams: (params: SearchParams) => void,
  paramToRemove: string
): void {
  // Create a new URLSearchParams object based on the current search parameters
  const newSearchParams = new URLSearchParams(searchParams)

  // Remove the specified parameter by name
  newSearchParams.delete(paramToRemove)

  // Update the URL with the new search parameters, reflecting the removal of the param
  setSearchParams(newSearchParams)
}
