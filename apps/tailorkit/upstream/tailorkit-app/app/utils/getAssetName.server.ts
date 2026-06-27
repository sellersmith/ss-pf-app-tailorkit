import fs from 'node:fs'
import path from 'node:path'

interface Template {
  id: string
  name: string
  type: string
}

let templatesCache: Template[] | null = null

/**
 * Load templates from public/templates.json
 * Caches the result for performance
 */
function loadTemplates(): Template[] {
  if (templatesCache) {
    return templatesCache
  }

  try {
    const templatesPath = path.join(process.cwd(), 'public', 'templates.json')
    const templatesData = fs.readFileSync(templatesPath, 'utf-8')
    templatesCache = JSON.parse(templatesData)
    return templatesCache || []
  } catch (error) {
    console.error('Failed to load templates.json:', error)
    return []
  }
}

/**
 * Get asset name by ID and type from templates.json
 * Only works for assetType='clipart'
 * Returns "Deleted" if not found or if type is not 'clipart'
 */
export function getAssetName(assetId: string, assetType: string): string {
  if (assetType !== 'clipart') {
    return assetId // For non-clipart types, just return the ID
  }

  const templates = loadTemplates()
  const template = templates.find(t => t.id === assetId)
  return template?.name || 'Deleted'
}

/**
 * Get multiple asset names at once
 * More efficient than calling getAssetName multiple times
 * @param assets Array of {id, type} objects
 */
export function getAssetNames(assets: Array<{ id: string; type: string }>): Map<string, string> {
  const templates = loadTemplates()
  const nameMap = new Map<string, string>()

  const templatesById = new Map(templates.map(t => [t.id, t.name]))

  for (const asset of assets) {
    if (asset.type === 'clipart') {
      const assetName = templatesById.get(asset.id)

      nameMap.set(asset.id, assetName || 'Deleted')
    } else {
      nameMap.set(asset.id, asset.id) // For non-clipart, use ID as name
    }
  }

  return nameMap
}
