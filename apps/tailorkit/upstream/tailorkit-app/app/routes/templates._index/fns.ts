import isInteger from 'lodash/isInteger'
import { openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { TemplateErrors } from '~/constants/errors'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { uuid } from '~/utils/uuid'

/**
 * Validate the width of the template
 *
 * @param value
 * @param measurementUnit
 * @returns
 */
export function validateTemplateWidth(value: number, measurementUnit: MEASUREMENT_UNIT) {
  let error = null
  if (!(value > 0)) {
    error = TemplateErrors.WIDTH_MUST_GREATER_THAN_ZERO
  } else if (measurementUnit === 'px' && !isInteger(value)) {
    error = TemplateErrors.WIDTH_MUST_BE_A_DECIMAL
  }

  return error
}

/**
 * Validate the height of the template
 *
 * @param value
 * @param measurementUnit
 * @returns
 */
export function validateTemplateHeight(value: number, measurementUnit: MEASUREMENT_UNIT) {
  let error = null
  if (!(value > 0)) {
    error = TemplateErrors.HEIGHT_MUST_GREATER_THAN_ZERO
  } else if (measurementUnit === 'px' && !isInteger(value)) {
    error = TemplateErrors.HEIGHT_MUST_BE_A_DECIMAL
  }

  return error
}

/**
 * Create a template from form data
 *
 * @param formData
 * @returns
 */
export async function createTemplateFromFormData(formData: {
  title: string
  width: number
  height: number
  measurementUnit: MEASUREMENT_UNIT
  resolution: number
  currentConversationId?: string
  autoSelectFirstLayer?: boolean
}) {
  const id = uuid()
  const { currentConversationId, autoSelectFirstLayer, ...restFormData } = formData

  const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION

  const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)
  await storeJSONFileToIDB(db, storeName, restFormData, id)

  const withCurrentConversationId = currentConversationId ? `&currentConversationId=${currentConversationId}` : ''
  const withAutoSelectFirstLayer = autoSelectFirstLayer ? `&autoSelectFirstLayer=${autoSelectFirstLayer}` : ''

  // eslint-disable-next-line max-len
  return `/templates/${id}?source=form&content=${id}${withCurrentConversationId}${withAutoSelectFirstLayer}`
}
