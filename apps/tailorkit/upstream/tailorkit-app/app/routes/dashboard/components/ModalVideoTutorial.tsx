import type { ModalProps } from '@shopify/polaris'
import { Modal } from '@shopify/polaris'
import type { ISocialVideoProps } from '~/components/.client/SocialVideoThumbnail'
import { SocialVideo } from '~/components/.client/SocialVideoThumbnail'

interface IModalVideoTutorialProps extends ModalProps {}

export default function ModalVideoTutorial(props: IModalVideoTutorialProps & ISocialVideoProps) {
  const { videoUrl, socialAction, videoLength, thumbnailUrl, radius, autoPlay, ...modalProps } = props

  return (
    <Modal {...modalProps}>
      <SocialVideo
        videoUrl={videoUrl}
        socialAction={{
          icon: socialAction.icon,
          label: socialAction.label,
          onClick: socialAction.onClick,
        }}
        videoLength={videoLength}
        thumbnailUrl={thumbnailUrl}
        radius={radius}
        autoPlay={autoPlay}
      />
    </Modal>
  )
}
