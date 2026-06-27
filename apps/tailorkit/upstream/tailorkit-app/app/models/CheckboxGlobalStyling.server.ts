import mongoose from '~/bootstrap/db/connect-db.server'
import type { CheckboxGlobalStylingDocument } from '~/types/checkbox'
import { ECheckboxStyle } from '~/enums/checkbox'

const CheckboxItemStylingSchema = new mongoose.Schema(
  {
    defaultBackground: {
      type: String,
      default: 'rgba(255, 255, 255, 0)',
    },
    defaultBorder: {
      type: String,
      default: 'rgba(255, 255, 255, 0)',
    },
  },
  { _id: false }
)

const PersonalizeButtonStylingSchema = new mongoose.Schema(
  {
    backgroundColor: {
      type: String,
      default: 'rgb(240, 245, 255)',
    },
    textColor: {
      type: String,
      default: 'rgb(0, 94, 194)',
    },
    borderColor: {
      type: String,
      default: 'rgb(0, 94, 194)',
    },
    borderRadius: {
      type: Number,
      default: 4,
    },
    buttonText: {
      type: String,
      default: 'Personalize',
    },
    doneText: {
      type: String,
      default: 'Personalized',
    },
    doneBackgroundColor: {
      type: String,
      default: 'rgb(0, 94, 194)',
    },
    doneTextColor: {
      type: String,
      default: 'rgb(255, 255, 255)',
    },
    doneBorderColor: {
      type: String,
      default: 'rgb(0, 94, 194)',
    },
    doneBorderRadius: {
      type: Number,
      default: 4,
    },
    paddingBlock: {
      type: Number,
      default: 4,
    },
    paddingInline: {
      type: Number,
      default: 8,
    },
    donePaddingBlock: {
      type: Number,
      default: 4,
    },
    donePaddingInline: {
      type: Number,
      default: 8,
    },
  },
  { _id: false }
)

const CheckboxGlobalStylingSchema = new mongoose.Schema<CheckboxGlobalStylingDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    checkboxType: {
      type: String,
      enum: Object.values(ECheckboxStyle),
      default: ECheckboxStyle.SQUARE,
    },
    tickIcon: {
      type: String,
      default: 'rgb(255, 255, 255)',
    },
    defaultBackground: {
      type: String,
      default: 'rgb(255, 255, 255)',
    },
    activeBackground: {
      type: String,
      default: 'rgb(48, 48, 48)',
    },
    defaultBorder: {
      type: String,
      default: 'rgb(138, 138, 138)',
    },
    activeBorder: {
      type: String,
      default: 'rgb(48, 48, 48)',
    },
    checkboxItem: {
      type: CheckboxItemStylingSchema,
      default: () => ({}),
    },
    imageSize: {
      type: Number,
      default: 40,
    },
    personalizeButton: {
      type: PersonalizeButtonStylingSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
)

export const CheckboxGlobalStylingModel
  = mongoose.models.CheckboxGlobalStyling
  || mongoose.model<CheckboxGlobalStylingDocument>('CheckboxGlobalStyling', CheckboxGlobalStylingSchema)

export default CheckboxGlobalStylingModel
