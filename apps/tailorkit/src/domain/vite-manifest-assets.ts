export interface TailorKitViteManifestEntry {
  file?: string
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
  src?: string
}

export type TailorKitViteManifest = Record<string, TailorKitViteManifestEntry>

export interface TailorKitViteManifestEntryAssets {
  entryFile: string
  cssFiles: string[]
}

function collectCssFiles(manifest: TailorKitViteManifest, entryKey: string, visited = new Set<string>()): string[] {
  if (visited.has(entryKey)) return []
  visited.add(entryKey)

  const entry = manifest[entryKey]
  if (!entry) return []

  const nestedCss = (entry.imports || []).flatMap(importKey => collectCssFiles(manifest, importKey, visited))
  return [...(entry.css || []), ...nestedCss]
}

/** Collects a Vite manifest entry and deduped CSS from its static import graph. */
export function collectTailorKitViteManifestEntryAssets(
  manifest: TailorKitViteManifest,
  entryKey: string,
  missingEntryMessage: string
): TailorKitViteManifestEntryAssets {
  const entry = manifest[entryKey]
  if (!entry?.file) {
    throw new Error(missingEntryMessage)
  }

  return {
    entryFile: entry.file,
    cssFiles: Array.from(new Set(collectCssFiles(manifest, entryKey))),
  }
}
