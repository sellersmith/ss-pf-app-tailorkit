import isEqual from 'lodash/isEqual'
import isEmpty from 'lodash/isEmpty'

export const useProviderVariants = () => {
  // Helper function for recursive combination generation
  const combinedVariants = (categories: string[], validOptions: any, variants: any[]) => {
    const output: any[] = []

    function combine(categoryIndex: number, currentCombination: any[]) {
      const category = categories[categoryIndex]

      validOptions[category]?.forEach((option: any) => {
        const newCombination = [...currentCombination, option]

        if (categoryIndex === categories.length - 1) {
          const providerVariant = variants.find(variant => {
            const variantTitles = variant.title.split(' / ')
            if (isEqual(newCombination.sort(), variantTitles.sort())) {
              return variant
            }
            return null
          })

          !isEmpty(providerVariant) && output.push({ ...providerVariant, id: providerVariant.id.toString() }) // Format and store the result
        } else {
          combine(categoryIndex + 1, newCombination) // Continue to the next category
        }
      })
    }

    combine(0, [])

    return output
  }

  return {
    combinedVariants,
  }
}
