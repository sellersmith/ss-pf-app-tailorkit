import type { TFunction } from 'i18next'

export function getAutoDetectLabel(
  t: TFunction,
  phase: string,
  progress: { percent: number },
  isMobile: boolean
): string {
  switch (phase) {
    case 'downloading':
      return isMobile
        ? t('auto-detect-downloading-short', { percent: Math.round(progress.percent) })
        : t('auto-detect-downloading', { percent: Math.round(progress.percent) })
    case 'initializing':
      return t('auto-detect-preparing')
    case 'inferring':
      return t('auto-detect-analyzing')
    case 'contouring':
      return t('auto-detect-tracing')
    default:
      return t('auto-detect-processing')
  }
}
