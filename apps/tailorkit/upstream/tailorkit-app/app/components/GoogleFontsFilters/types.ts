export interface GoogleFontsStyleOption {
  id: string
  label: string
  tagPath: string
  usageCount: number
  weightAvg: number
  weightMax: number
  /** Sample font family that best represents this style */
  sampleFont?: {
    family: string
  }
  /** Pre-rendered SVG string for displaying font preview without loading the actual font */
  sampleSvg?: string
}

export interface GoogleFontsStyleGroup {
  id: string
  label: string
  options: GoogleFontsStyleOption[]
}

/**
 * Language entry from googlefonts/lang repository
 * Matches the Google Fonts website language filter
 */
export interface GoogleFontsLanguage {
  id: string
  name: string
  autonym?: string
  script?: string
  population?: number
  region?: string
  subsetKeys: string[]
}

export interface GoogleFontsFiltersArtifact {
  version: 2
  generatedAt: string
  source: 'googlefonts/lang'
  languages: GoogleFontsLanguage[]
  styles: {
    groups: GoogleFontsStyleGroup[]
  }
}
