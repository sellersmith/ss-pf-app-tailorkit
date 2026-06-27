import type { LoaderFunctionArgs } from '@remix-run/node'
import { json, fetchList } from '~/bootstrap/fns/fetch.server'
import OptionSet from '~/models/OptionSet.server'
import { authenticate } from '~/shopify/app.server'
import { uuid } from '~/utils/uuid'
import { OPTION_SET_ACTIONS } from './constants'
import type { OptionSet as OptionSetType } from '~/types/psd'
import { countLayersAreUsingOptionSet } from './fns.server'
import { createOrUpdateAsset, deleteAssets } from '~/models/Asset.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get search params
  const { searchParams } = new URL(request.url)
  const ids = searchParams.get('ids')
  const idsList = ids && ids.split(',')

  const res = await fetchList(request, OptionSet, [
    {
      $match: {
        $and: [{ shopDomain }, idsList ? { _id: { $in: idsList } } : {}],
      },
    },
    {
      $project: {
        _id: 1,
        label: 1,
        labelOnStoreFront: 1,
        shopDomain: 1,
        type: 1,
        data: 1,
        values: 1,
        createdAt: 1,
        updatedAt: 1,
        status: 1,
      },
    },
    /**
     * @deprecated DO NOT COUNT THE OPTION SET USED IN LAYER. Because this task is very heavy.
     * It iterate all the options set query then looking up the layer ids that use this option set id.
     */
    // {
    //   $lookup: {
    //     from: Layer.collection.collectionName,
    //     localField: '_id',
    //     foreignField: 'optionSet',
    //     as: 'usedInLayer',
    //   },
    // },
    // {
    //   $addFields: {
    //     layerCounting: {
    //       $size: '$usedInLayer',
    //     },
    //     status: {
    //       $cond: {
    //         if: { $gt: [{ $size: '$usedInLayer' }, 0] },
    //         then: 'active',
    //         else: 'inactive',
    //       },
    //     },
    //   },
    // },
  ])

  return json(res)
}

export const action = async ({ request }: LoaderFunctionArgs) => {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    // Get action from search params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Parse request body
    const payload = await request.json()

    // Process action
    let optionSet: any = payload

    switch (action) {
      case OPTION_SET_ACTIONS.CREATE:
      case OPTION_SET_ACTIONS.UPDATE: {
        optionSet = await createOrUpdateAsset(shopDomain, { ...payload, model: 'OptionSet', shopDomain })

        break
      }

      case OPTION_SET_ACTIONS.DELETE: {
        const { selectedResources } = payload

        if (selectedResources.length) {
          await deleteAssets(shopDomain, selectedResources, true)
        }

        break
      }

      case OPTION_SET_ACTIONS.DUPLICATE: {
        const { selectedResources } = payload

        if (selectedResources.length) {
          const optionSetsSelected: OptionSetType[] = await OptionSet.find({
            shopDomain,
            _id: { $in: selectedResources },
          }).lean()

          if (optionSetsSelected.length) {
            let max = 0

            await Promise.all(
              optionSetsSelected.map(async optionSet => {
                // Find all the option sets that contain the label of this optionSet
                const optionSetHavingSelectedLabel = await OptionSet.aggregate([
                  {
                    $match: {
                      $and: [
                        { shopDomain },
                        {
                          label: {
                            $regex: new RegExp(`^${optionSet?.label?.replace(/ \(\d+\)$/, '')}( \\(\\d+\\))?$`),
                          },
                        },
                      ],
                    },
                  },
                ])

                let tempMax = max

                // Get the greatest number in similar labels
                optionSetHavingSelectedLabel.forEach((item: any) => {
                  const num = Number(item?.label?.replace(/^.+\((\d+)\)$/, '$1'))

                  if (!isNaN(num) && num > tempMax) {
                    tempMax = num
                  }
                })

                max = Math.max(max, tempMax) + 1
                optionSet.label = `${optionSet?.label?.replace(/ \(\d+\)$/, '')} (${max})`

                return createOrUpdateAsset(shopDomain, {
                  ...optionSet,
                  _id: uuid(),
                  model: 'OptionSet',
                  name: optionSet.label,
                  shopDomain,
                })
              })
            )
          }
        }

        break
      }

      case OPTION_SET_ACTIONS.FIND_LAYER_BEING_USED: {
        const { optionSetId } = payload
        const layerCountingBeingUsedFound = await countLayersAreUsingOptionSet(optionSetId, shopDomain)
        optionSet = { layerCounting: layerCountingBeingUsedFound }

        break
      }
    }

    return json({ success: true, optionSet })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
