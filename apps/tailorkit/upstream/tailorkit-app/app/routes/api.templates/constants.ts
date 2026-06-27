export const TEMPLATES_ACTIONS = {
  DUPLICATE: 'duplicate',
  UPLOAD_FILES: 'uploadFiles',
  DELETE_TEMPLATES: 'deleteTemplates',
  GET_TEMPLATES_BY_IDS: 'getTemplatesByIds',
  GET_CLIPARTS_LIST: 'getClipartsList',
  GET_CLIPARTS_DETAILS: 'getClipartsDetails',
  CLONE_CLIPART_TO_TEMPLATE: 'cloneClipartToTemplate',
  EXPORT_TEMPLATES: 'exportTemplates',
  GET_CLIPARTS_CATEGORIES: 'getClipartsCategories',
  CHECK_TEMPLATE_USAGE: 'checkTemplateUsage',
}

export enum TEMPLATE_TYPE {
  TEMPLATE = 'template',
  CLIPART = 'clipart',
  PREMADE_TEMPLATE = 'premade-template',
}

export type TClipartsSelected = {
  _id: string
  type: TEMPLATE_TYPE
}

/** @deprecated */
export const isClipart = (type: TEMPLATE_TYPE | string) => type === TEMPLATE_TYPE.CLIPART

/**
 * Check if the template is a public clipart or premade template
 * @param category - The category of the template
 * @returns True if the template is a public clipart or premade template, false otherwise
 */
export const isPublicClipartOrPremadeTemplate = (category: string) => !!category

export const isStoreAsset = (shopDomain: string) => shopDomain === process.env.STORE_ASSET_DOMAIN
