/**
 * Tutorial help banner shown at the top of the Image layer inspector.
 * Clicking "Watch tutorial" opens an inline VideoModal with the image tutorial video.
 */
import { useCallback } from 'react'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { MODAL_ID } from '~/constants/modal'
import FeatureHelpBanner from '~/modules/TemplateEditor/components/FeatureHelpBanner'
import { useModal } from '~/utils/hooks/useModal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'

const IMAGE_TUTORIAL_VIDEO_URL = 'https://www.youtube.com/watch?v=qkT6H_LLZTg'
const DESCRIPTION_KEY
  = 'Learn how to add and customize image layers with upload options and AI generation. '
  + '<tutorial>Watch tutorial</tutorial> or <contact>contact us</contact> for help.'

export function ImageTutorialBanner() {
  const { openModal } = useModal()

  const handleTutorialClick = useCallback(() => {
    openModal(MODAL_ID.IMAGE_TUTORIAL_VIDEO_MODAL)
  }, [openModal])

  return (
    <>
      <FeatureHelpBanner
        descriptionKey={DESCRIPTION_KEY}
        contactMessage="I need help with image layers in TailorKit template editor."
        onTutorialClick={handleTutorialClick}
      />
      <VideoModal id={MODAL_ID.IMAGE_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(IMAGE_TUTORIAL_VIDEO_URL)}
          title="Image Layer Tutorial"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
    </>
  )
}
