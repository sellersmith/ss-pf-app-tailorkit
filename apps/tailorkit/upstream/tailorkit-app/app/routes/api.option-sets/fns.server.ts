import { type PipelineStage } from 'mongoose'
import Layer from '~/models/Layer.server'
import OptionSet from '~/models/OptionSet.server'

/**
 * @description This function counts the number of layers that are using the specified option set
 * @param {string} optionSetId The id of the specified option set
 * @param {string} shopDomain The shop domain
 */
export const countLayersAreUsingOptionSet = async (optionSetId: string, shopDomain: string) => {
  try {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          $and: [{ _id: optionSetId }, { shopDomain }],
        },
      },
      {
        $project: {
          layerCounting: 1,
        },
      },
      {
        $lookup: {
          from: Layer.collection.collectionName,
          localField: '_id',
          foreignField: 'optionSet',
          as: 'usedInLayer',
        },
      },
      {
        $addFields: {
          layerCounting: {
            $size: '$usedInLayer',
          },
        },
      },
    ]

    const result = await OptionSet.aggregate(pipeline)

    return result[0]?.layerCounting
  } catch (err) {
    console.error(`Catch async error at fn: countLayersAreUsingOptionSet with error: ${err}`)
  }
}
