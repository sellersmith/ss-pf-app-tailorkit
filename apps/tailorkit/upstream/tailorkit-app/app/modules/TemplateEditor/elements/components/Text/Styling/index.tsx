import { memo } from 'react'
import { TransformationInspector } from '~/modules/TemplateEditor/components/Inspector/Transformation'
import { TextEffectsBlock } from './Effects'
import { Fill } from './Effects/TextColor'
import { FontFamily } from './Typography/FontFamily'
import { FontSize } from './Typography/FontSize'
import { TextAlignment } from './Typography/TextAlignment'
import { TextStyleBold } from './Typography/TextStyleBold'
import { TextStyleItalic } from './Typography/TextStyleItalic'
import { TextStyleUnderline } from './Typography/TextStyleUnderline'
import OverflowToolbar from '~/components/OverflowToolbar'
import LayerActionButtons from '~/modules/TemplateEditor/components/Editor/LayerActionButtons'

const TextStylingToolBarComponent = () => {
  return (
    <OverflowToolbar>
      <FontFamily />
      <FontSize />
      <TextAlignment />
      <Fill />
      <TextStyleBold />
      <TextStyleItalic />
      <TextStyleUnderline />
      <TextEffectsBlock />
      <TransformationInspector />
      <LayerActionButtons />
    </OverflowToolbar>
  )
}

export const TextStylingToolBar = memo(TextStylingToolBarComponent)
