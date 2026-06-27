import mongoose from '~/bootstrap/db/connect-db.server'
import type { CheckboxOrderSettingDocument } from '~/types/checkbox'
import { ECheckboxSortOptions } from '~/enums/checkbox'

const CheckboxOrderSettingSchema = new mongoose.Schema<CheckboxOrderSettingDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    defaultSortOption: {
      type: String,
      enum: Object.values(ECheckboxSortOptions),
      default: ECheckboxSortOptions.LAST_CREATED_ASC,
    },
    manualCheckboxesOrder: {
      type: [String],
      default: [],
    },
    defaultCartSortOption: {
      type: String,
      enum: Object.values(ECheckboxSortOptions),
      default: ECheckboxSortOptions.LAST_CREATED_ASC,
    },
    manualCheckboxesCartOrder: {
      type: [String],
      default: [],
    },
    customSelector: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
)

export const CheckboxOrderSettingModel
  = mongoose.models.CheckboxOrderSetting
  || mongoose.model<CheckboxOrderSettingDocument>('CheckboxOrderSetting', CheckboxOrderSettingSchema)

export default CheckboxOrderSettingModel
