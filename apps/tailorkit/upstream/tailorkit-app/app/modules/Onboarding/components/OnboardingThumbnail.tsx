import { Box } from '@shopify/polaris'
import type { OnboardingQuestion } from '../types'

export default function OnboardingThumbnail(props: {
  thumbnailSrc: OnboardingQuestion['thumbnailSrc']
  questionLabel: OnboardingQuestion['label']
}) {
  const { thumbnailSrc, questionLabel } = props

  return (
    <Box width="310px">
      <img src={thumbnailSrc} alt={questionLabel} width={'310px'} height={'100%'} />
    </Box>
  )
}
