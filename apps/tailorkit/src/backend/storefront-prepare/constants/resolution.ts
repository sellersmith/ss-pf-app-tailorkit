export type RESOLUTION = 300 | 150 | 72 | 36

export const RESOLUTIONS: { [key in RESOLUTION]: string } = {
  300: 'High (300 ppi)',
  150: 'Medium (150 ppi)',
  72: 'Screen (72 ppi)',
  36: '36 ppi',
}
