const UUID_PATTERN = '^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-4[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$'

const RGB_COLOR_PATTERN = '^rgba\\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\\)$'

// Collection definitions for database operations
// 🔒 SECURITY: All collections are scoped by shopDomain to ensure data isolation
const SUPPORTED_COLLECTIONS = {
  Template: {
    name: 'Template',
    description: 'templates and cliparts',
    populateFields: ['layers', 'psds'],
    commonFilters: {
      all: { deletedAt: null },
      byId: (id: string) => ({ _id: id }),
      byName: (name: string) => ({ name: { $regex: name, $options: 'i' } }),
      byType: (type: string) => ({ type }),
    },
  },
  Layer: {
    name: 'Layer',
    description: 'layers within templates',
    populateFields: ['image', 'parent', 'children'],
    commonFilters: {
      all: { deletedAt: null },
      byId: (id: string) => ({ _id: id }),
      byTemplate: (templateId: string) => ({ templateId }),
      byType: (type: string) => ({ type }),
      byParent: (parentId: string) => ({ parent: parentId }),
    },
  },
  Shop: {
    name: 'Shop',
    description: 'shop information',
    populateFields: [],
    commonFilters: {
      all: {},
      byDomain: (domain: string) => ({ shopDomain: domain }),
    },
  },
} as const

export { UUID_PATTERN, RGB_COLOR_PATTERN, SUPPORTED_COLLECTIONS }
