import { Box, Button, IconSource, VideoThumbnail } from '@shopify/polaris'
import { VideoThumbnailProps } from '@shopify/polaris/build/ts/src/components/VideoThumbnail'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ISocialVideoThumbnailProps extends VideoThumbnailProps {
  socialAction?: {
    content?: React.ReactNode
  }
  radius?: boolean
}

export default function SocialVideoThumbnail(props: ISocialVideoThumbnailProps) {
  const { socialAction = {}, radius = false } = props
  const { content = null } = socialAction
  return (
    <div
      style={{ position: 'relative', borderRadius: radius ? 'var(--p-border-radius-200)' : '0', overflow: 'hidden' }}
    >
      <VideoThumbnail {...props} />
      {content && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            marginRight: 'var(--p-space-400)',
            marginBottom: 'var(--p-space-400)',
          }}
          role="button"
        >
          {content}
        </div>
      )}
    </div>
  )
}

export interface ISocialVideoProps {
  videoUrl: string
  socialAction?: {
    icon: React.ReactElement | IconSource
    label: string
    onClick: () => void
  }
  videoLength: number
  thumbnailUrl: string
  radius?: boolean
  autoPlay?: boolean
}

export function SocialVideo(props: ISocialVideoProps) {
  const { videoUrl, socialAction, videoLength, thumbnailUrl, radius = false, autoPlay = false } = props
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const { t } = useTranslation()

  const onPlayVideo = useCallback(() => {
    setIsPlaying(true)
  }, [])

  return (
    <Box>
      {isPlaying ? (
        <Box>
          <video
            controls
            style={{ display: 'block', width: '100%', height: '100%', aspectRatio: '16/9' }}
            autoPlay={autoPlay}
            muted={autoPlay}
          >
            <source src={videoUrl} type="video/mp4" />
            {t('your-browser-does-not-support-the-video-tag')}
          </video>
        </Box>
      ) : (
        <SocialVideoThumbnail
          radius={radius}
          socialAction={
            socialAction
              ? {
                  content: (
                    <Button icon={socialAction.icon} variant="plain" onClick={socialAction.onClick}>
                      {socialAction.label}
                    </Button>
                  ),
                }
              : undefined
          }
          videoLength={videoLength}
          thumbnailUrl={thumbnailUrl}
          onClick={onPlayVideo}
        />
      )}
    </Box>
  )
}
