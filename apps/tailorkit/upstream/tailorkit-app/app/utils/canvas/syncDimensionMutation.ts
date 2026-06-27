import type { Dimension } from '~/types/template'
import isInteger from 'lodash/isInteger'

export function syncDimensionMutation(
  params: {
    type: 'WIDTH' | 'HEIGHT'
    mutationMetric: number
  },
  proportions: number
): Dimension {
  const { type, mutationMetric } = params

  switch (type) {
    case 'WIDTH': {
      const _height = mutationMetric / proportions

      return {
        height: isInteger(_height) ? _height : +_height.toFixed(2),
        width: mutationMetric,
      }
    }

    case 'HEIGHT': {
      const _width = mutationMetric * proportions

      return {
        height: mutationMetric,
        width: isInteger(_width) ? _width : +_width.toFixed(2),
      }
    }
  }
}
