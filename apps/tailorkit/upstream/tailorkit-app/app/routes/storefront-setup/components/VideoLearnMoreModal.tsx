import { Modal } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { getEmbedUrl } from '~/utils/getEmbedUrl'

interface VideoLearnMoreModalProps {
  youtubeUrl: string
  open: boolean
  onClose: () => void
}

export default function VideoLearnMoreModal({ youtubeUrl, open, onClose }: VideoLearnMoreModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('learn-more')}
      size="large"
      secondaryActions={[{ content: t('close'), onAction: onClose }]}
    >
      <Modal.Section>
        <iframe
          src={getEmbedUrl(youtubeUrl)}
          style={{ width: '100%', aspectRatio: '16/9', border: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
          title={t('tutorial-video')}
        />
      </Modal.Section>
    </Modal>
  )
}
