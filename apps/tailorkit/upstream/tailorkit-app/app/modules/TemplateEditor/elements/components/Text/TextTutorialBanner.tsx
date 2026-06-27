/**
 * Tutorial help banner shown at the top of the Text layer inspector.
 * Clicking "Watch tutorial" opens an inline VideoModal with the text tutorial video.
 */
import { useCallback } from 'react'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { MODAL_ID } from '~/constants/modal'
import FeatureHelpBanner from '~/modules/TemplateEditor/components/FeatureHelpBanner'
import { useModal } from '~/utils/hooks/useModal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'

const TEXT_TUTORIAL_VIDEO_URL = 'https://www.youtube.com/watch?v=PcEGcaervEc'
const DESCRIPTION_KEY
  = 'Learn how to customize text layers with fonts, colors, and effects. '
  + '<tutorial>Watch tutorial</tutorial> or <contact>contact us</contact> for help.'

export function TextTutorialBanner() {
  const { openModal } = useModal()

  const handleTutorialClick = useCallback(() => {
    openModal(MODAL_ID.TEXT_TUTORIAL_VIDEO_MODAL)
  }, [openModal])

  return (
    <>
      <FeatureHelpBanner
        descriptionKey={DESCRIPTION_KEY}
        contactMessage="I need help with text layers in TailorKit template editor."
        onTutorialClick={handleTutorialClick}
      />
      <VideoModal id={MODAL_ID.TEXT_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(TEXT_TUTORIAL_VIDEO_URL)}
          title="Text Layer Tutorial"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
    </>
  )
}
