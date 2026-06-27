import { SUPPORTED_COLLECTIONS } from './constants'

// Helper functions
const getCollectionNames = () => Object.keys(SUPPORTED_COLLECTIONS)

const getCollectionDescription = (collectionName: string) => {
  const collection = SUPPORTED_COLLECTIONS[collectionName as keyof typeof SUPPORTED_COLLECTIONS]
  return collection ? `${collection.name} - ${collection.description}` : ''
}

const getPopulateFields = (collectionName: string) => {
  const collection = SUPPORTED_COLLECTIONS[collectionName as keyof typeof SUPPORTED_COLLECTIONS]
  return collection?.populateFields || []
}

const getCommonFilters = (collectionName: string) => {
  const collection = SUPPORTED_COLLECTIONS[collectionName as keyof typeof SUPPORTED_COLLECTIONS]
  return collection?.commonFilters || {}
}

// Generate dynamic description
const generateSupportedCollectionsDescription = () => {
  return Object.entries(SUPPORTED_COLLECTIONS)
    .map(([key, value], index) => `${index + 1}. ${value.name} - ${value.description}`)
    .join('\n')
}

export {
  getCollectionNames,
  getCollectionDescription,
  getPopulateFields,
  getCommonFilters,
  generateSupportedCollectionsDescription,
}
