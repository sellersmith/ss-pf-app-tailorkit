export const ANALYTICS_ACTIONS = {
  TRACK: 'track',
  TRENDING: 'trending',
  INSIGHTS: 'insights',
} as const

export type AnalyticsAction = (typeof ANALYTICS_ACTIONS)[keyof typeof ANALYTICS_ACTIONS]
