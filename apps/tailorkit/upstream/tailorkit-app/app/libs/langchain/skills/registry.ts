/**
 * Skill registry — maps skill IDs to their definitions and handler import thunks.
 * Built-in skills registered at module load. Custom skills can be added later.
 * Handlers are NOT imported until invoked (JIT pattern from Shopify Sidekick).
 */

import type { SkillRegistryEntry } from './types'

/** Internal registry map */
const registry = new Map<string, SkillRegistryEntry>()

/** Register a skill in the registry */
export function registerSkill(entry: SkillRegistryEntry): void {
  registry.set(entry.id, entry)
}

/** Get a skill by ID. Returns undefined if not found. */
export function getSkill(id: string): SkillRegistryEntry | undefined {
  return registry.get(id)
}

/** Get a skill by command name (without / prefix) */
export function getSkillByCommand(command: string): SkillRegistryEntry | undefined {
  for (const entry of registry.values()) {
    if (entry.command === command) return entry
  }
  return undefined
}

/** List all registered skills */
export function listSkills(): SkillRegistryEntry[] {
  return Array.from(registry.values())
}

/**
 * Register built-in skills.
 * Handler imports point to ./builtin/ — files created in Phase 4+6.
 * Until handlers exist, executor returns "skill not implemented yet".
 */
function registerBuiltInSkills(): void {
  registerSkill({
    id: 'customize',
    command: 'customize',
    description: 'Generate customization plan for a product (options, text inputs, image uploads, pricing)',
    status: 'active',
    handler: () => import('./builtin/generate-options'),
  })
}

// Auto-register built-in skills on module load
registerBuiltInSkills()
