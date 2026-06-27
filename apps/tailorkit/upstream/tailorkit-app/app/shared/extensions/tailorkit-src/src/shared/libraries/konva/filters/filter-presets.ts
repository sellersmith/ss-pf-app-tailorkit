/**
 * Filter Presets
 * Professional filter presets for quick image adjustments
 */

import type { FilterPreset, ImageFilters } from './types';
import { ImageFilterPipeline } from './image-filter-pipeline';

/**
 * Built-in filter presets collection
 */
export const FILTER_PRESETS: FilterPreset[] = [
  // Featured Presets (first 4)
  {
    name: 'Vintage',
    description: 'Warm, faded film look',
    category: 'vintage',
    filters: {
      exposure: 0.05,
      contrast: -0.1,
      saturation: -0.2,
      hue: 0.02,
      noise: 0.1,
    },
  },
  {
    name: 'Black & White',
    description: 'Classic monochrome',
    category: 'basic',
    filters: {
      saturation: -1,
      contrast: 0.1,
    },
  },
  {
    name: 'Cinematic',
    description: 'Movie-like color grading',
    category: 'modern',
    filters: {
      exposure: -0.1,
      contrast: 0.2,
      saturation: -0.15,
      hue: -0.03,
    },
  },
  {
    name: 'Vivid',
    description: 'Enhanced colors and contrast',
    category: 'modern',
    filters: {
      contrast: 0.15,
      saturation: 0.3,
      exposure: 0.05,
    },
  },

  // Additional Presets
  {
    name: 'Retro',
    description: '70s-inspired warm tones',
    category: 'vintage',
    filters: {
      exposure: 0.1,
      contrast: -0.05,
      saturation: -0.1,
      hue: 0.05,
      noise: 0.15,
    },
  },
  {
    name: 'Nordic',
    description: 'Cool, desaturated look',
    category: 'modern',
    filters: {
      exposure: 0.05,
      contrast: 0.05,
      saturation: -0.25,
      hue: -0.05,
    },
  },
  {
    name: 'Warm',
    description: 'Cozy, warm atmosphere',
    category: 'basic',
    filters: {
      exposure: 0.1,
      hue: 0.08,
      saturation: 0.1,
    },
  },
  {
    name: 'Cool',
    description: 'Cold, blue-tinted mood',
    category: 'basic',
    filters: {
      exposure: -0.05,
      hue: -0.15,
      saturation: 0.05,
    },
  },
  {
    name: 'Dramatic',
    description: 'High contrast, intense look',
    category: 'artistic',
    filters: {
      contrast: 0.4,
      saturation: -0.1,
      exposure: -0.1,
    },
  },
  {
    name: 'Soft',
    description: 'Gentle, dreamy effect',
    category: 'artistic',
    filters: {
      exposure: 0.15,
      contrast: -0.2,
      saturation: -0.05,
      blur: 0.1,
    },
  },
  {
    name: 'Pixelated',
    description: '8-bit retro gaming style',
    category: 'artistic',
    filters: {
      pixelate: 0.5,
      saturation: 0.2,
      contrast: 0.1,
    },
  },
  {
    name: 'Grainy',
    description: 'Film grain texture',
    category: 'vintage',
    filters: {
      noise: 0.3,
      contrast: 0.1,
      exposure: -0.05,
    },
  },
  {
    name: 'Sepia',
    description: 'Classic sepia tone',
    category: 'vintage',
    filters: {
      saturation: -0.5,
      hue: 0.11,
      exposure: 0.05,
      contrast: -0.05,
    },
  },
  {
    name: 'Faded',
    description: 'Washed out, low contrast',
    category: 'vintage',
    filters: {
      exposure: 0.2,
      contrast: -0.3,
      saturation: -0.15,
    },
  },
  {
    name: 'High Key',
    description: 'Bright and airy',
    category: 'modern',
    filters: {
      exposure: 0.4,
      contrast: -0.1,
      saturation: -0.05,
    },
  },
  {
    name: 'Low Key',
    description: 'Dark and moody',
    category: 'modern',
    filters: {
      exposure: -0.3,
      contrast: 0.2,
      saturation: -0.1,
    },
  },
];

/**
 * Preset management class
 */
export class FilterPresetManager {
  private static customPresets: FilterPreset[] = [];

  /**
   * Get all available presets (built-in + custom)
   */
  static getAllPresets(): FilterPreset[] {
    return [...FILTER_PRESETS, ...this.customPresets];
  }

  /**
   * Get featured presets (first 4)
   */
  static getFeaturedPresets(): FilterPreset[] {
    return FILTER_PRESETS.slice(0, 4);
  }

  /**
   * Get presets by category
   */
  static getPresetsByCategory(category: FilterPreset['category']): FilterPreset[] {
    return this.getAllPresets().filter(preset => preset.category === category);
  }

  /**
   * Get a specific preset by name
   */
  static getPreset(name: string): FilterPreset | undefined {
    return this.getAllPresets().find(preset => preset.name === name);
  }

  /**
   * Apply a preset and return the resulting filters
   */
  static applyPreset(presetName: string): ImageFilters | null {
    const preset = this.getPreset(presetName);
    if (!preset) {
      console.warn(`Preset "${presetName}" not found`);
      return null;
    }

    return {
      ...preset.filters,
      preset: presetName,
    };
  }

  /**
   * Create a custom preset from current filters
   */
  static createCustomPreset(
    name: string,
    filters: ImageFilters,
    description?: string
  ): FilterPreset {
    // Remove preset field from filters
    const { preset, ...cleanFilters } = filters;

    const customPreset: FilterPreset = {
      name,
      description,
      category: 'custom',
      filters: ImageFilterPipeline.normalizeFilters(cleanFilters),
    };

    this.customPresets.push(customPreset);
    return customPreset;
  }

  /**
   * Remove a custom preset
   */
  static removeCustomPreset(name: string): boolean {
    const index = this.customPresets.findIndex(preset => preset.name === name);
    if (index !== -1) {
      this.customPresets.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if a preset name is already taken
   */
  static isPresetNameTaken(name: string): boolean {
    return this.getAllPresets().some(preset => preset.name === name);
  }

  /**
   * Get preset categories
   */
  static getCategories(): Array<{ name: FilterPreset['category']; count: number }> {
    const categories = new Map<FilterPreset['category'], number>();

    this.getAllPresets().forEach(preset => {
      const category = preset.category || 'basic';
      categories.set(category, (categories.get(category) || 0) + 1);
    });

    return Array.from(categories.entries()).map(([name, count]) => ({ name, count }));
  }

  /**
   * Search presets by name or description
   */
  static searchPresets(query: string): FilterPreset[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllPresets().filter(
      preset =>
        preset.name.toLowerCase().includes(lowerQuery) ||
        preset.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get similar presets based on filter values
   */
  static getSimilarPresets(filters: ImageFilters, limit = 3): FilterPreset[] {
    const presets = this.getAllPresets();

    // Calculate similarity scores
    const scores = presets.map(preset => {
      let score = 0;
      const presetFilters = preset.filters;

      // Compare each filter value
      for (const key of Object.keys(filters) as Array<keyof ImageFilters>) {
        if (key === 'preset') continue;

        const value1 = filters[key] || 0;
        const value2 = presetFilters[key] || 0;

        // Calculate difference (0 = identical, 2 = maximum difference)
        const diff = Math.abs((value1 as number) - (value2 as number));
        score += 2 - diff; // Higher score = more similar
      }

      return { preset, score };
    });

    // Sort by similarity and return top matches
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.preset);
  }

  /**
   * Export custom presets to JSON
   */
  static exportCustomPresets(): string {
    return JSON.stringify(this.customPresets, null, 2);
  }

  /**
   * Import custom presets from JSON
   */
  static importCustomPresets(json: string): { success: boolean; imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const presets = JSON.parse(json);

      if (!Array.isArray(presets)) {
        errors.push('Invalid preset format: expected array');
        return { success: false, imported, errors };
      }

      for (const preset of presets) {
        if (!preset.name || !preset.filters) {
          errors.push(`Invalid preset: missing name or filters`);
          continue;
        }

        if (this.isPresetNameTaken(preset.name)) {
          errors.push(`Preset name "${preset.name}" already exists`);
          continue;
        }

        const validation = ImageFilterPipeline.validateFilters(preset.filters);
        if (!validation.valid) {
          errors.push(`Invalid filters for "${preset.name}": ${validation.errors.join(', ')}`);
          continue;
        }

        this.customPresets.push({
          ...preset,
          category: 'custom',
        });
        imported++;
      }

      return { success: imported > 0, imported, errors };
    } catch (error) {
      errors.push(`Failed to parse JSON: ${error}`);
      return { success: false, imported, errors };
    }
  }

  /**
   * Clear all custom presets
   */
  static clearCustomPresets(): void {
    this.customPresets = [];
  }

  /**
   * Generate a thumbnail for a preset
   * This would typically render the filters on a sample image
   */
  static generatePresetThumbnail(preset: FilterPreset, sampleImageUrl: string): Promise<string> {
    // This is a placeholder - actual implementation would:
    // 1. Load the sample image
    // 2. Apply the preset filters
    // 3. Generate a thumbnail
    // 4. Return as data URL
    return Promise.resolve(sampleImageUrl);
  }
}