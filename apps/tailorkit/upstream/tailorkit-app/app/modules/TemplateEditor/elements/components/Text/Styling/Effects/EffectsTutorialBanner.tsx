/**
 * Tutorial help banner shown at the top of the Text Effects inspector panel.
 * Provides a link to the tutorial video and a contact button.
 */
import FeatureHelpBanner from '~/modules/TemplateEditor/components/FeatureHelpBanner'

const DESCRIPTION_KEY
  = 'Learn how to apply text effects like shadows, outlines, and glows. '
  + '<tutorial>Watch tutorial</tutorial> or <contact>contact us</contact> for help.'

export function EffectsTutorialBanner() {
  return (
    <FeatureHelpBanner
      descriptionKey={DESCRIPTION_KEY}
      contactMessage="I need help with text effects in TailorKit template editor."
    />
  )
}
