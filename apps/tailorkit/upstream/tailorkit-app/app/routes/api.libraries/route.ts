import { type LoaderFunctionArgs } from '@remix-run/node'
import Layer from '~/models/Layer.server'
import { authenticate } from '~/shopify/app.server'
import { isClipart, TEMPLATE_TYPE } from '../api.templates/constants'
import { fetchList, json } from '~/bootstrap/fns/fetch.server'
import Asset, { createOrUpdateAsset, deleteAssets } from '~/models/Asset.server'
import { LIBRARY_ACTIONS } from './constants'
import { uuid } from '~/utils/uuid'
import { type AssetDocument } from '~/models/Asset'
import { EOptionSet } from '~/types/psd'
import OptionSet from '~/models/OptionSet.server'
import { duplicateTemplates } from '../api.templates/fns.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const templateTypes = [TEMPLATE_TYPE.CLIPART, TEMPLATE_TYPE.PREMADE_TEMPLATE]
  const storeAssetDomain = process.env.STORE_ASSET_DOMAIN

  const t1 = performance.now()
  const result = await fetchList(
    request,
    Asset,
    [
      {
        $match: {
          $or: [
            {
              shopDomain,
              type: {
                $nin: [EOptionSet.MULTI_LAYOUT_OPTION, TEMPLATE_TYPE.PREMADE_TEMPLATE],
              },
            },
            {
              shopDomain: storeAssetDomain,
              type: TEMPLATE_TYPE.PREMADE_TEMPLATE,
            },
          ],
          name: { $ne: '' }, // Filter out records with empty name
        },
      },
      {
        $lookup: {
          from: Layer.collection.collectionName,
          localField: 'refId',
          foreignField: 'optionSet',
          pipeline: [
            {
              $match: {
                type: { $nin: templateTypes },
                shopDomain,
                $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
              },
            },
            {
              $project: { _id: 1, deletedAt: 1 },
            },
          ],
          as: 'usedInLayer',
        },
      },
      {
        $addFields: {
          usedInLayerSize: { $size: '$usedInLayer' },
        },
      },
      {
        $addFields: {
          numberOfUses: {
            $cond: {
              if: { $not: [{ $in: ['$type', templateTypes] }] },
              then: '$usedInLayerSize',
              else: '$numberOfUses',
            },
          },
          status: {
            $cond: {
              if: { $and: [{ $in: ['$type', templateTypes] }, { $gt: ['$numberOfUses', 0] }] },
              then: 'active',
              else: {
                $cond: {
                  if: { $gt: ['$usedInLayerSize', 0] },
                  then: 'active',
                  else: 'inactive',
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          createdAt: 1,
          updatedAt: 1,
          previewUrl: 1,
          numberOfUses: 1,
          usedInLayer: 1,
          status: 1,
          refId: 1,
          isFromTailorkit: {
            $cond: {
              if: { $eq: ['$shopDomain', storeAssetDomain] },
              then: true,
              else: false,
            },
          },
        },
      },
      // {
      //   $sort: { shopDomain: 1 }, // Ensure shopDomain !== STORE_ASSET_DOMAIN is before
      // },
      // {
      //   $group: {
      //     _id: '$refId',
      //     records: { $push: '$$ROOT' },
      //   },
      // },
      // {
      //   $project: {
      //     _id: 0,
      //     records: {
      //       $slice: [
      //         {
      //           $filter: {
      //             input: '$records',
      //             as: 'record',
      //             cond: {
      //               $or: [
      //                 { $ne: ['$$record.shopDomain', storeAssetDomain] }, // Keep record with domain different from STORE_ASSET_DOMAIN
      //                 {
      //                   // If there is only 1 record and it is a premade template, keep it
      //                   $and: [{ $eq: [{ $size: '$records' }, 1] }, { $in: ['$$record.type', templateTypes] }],
      //                 },
      //               ],
      //             },
      //           },
      //         },
      //         1,
      //       ],
      //     },
      //   },
      // },
      // { $unwind: '$records' },
      // { $replaceRoot: { newRoot: '$records' } },
    ],
    [],
    true
  )
  const t2 = performance.now()

  return json({ ...result, totalExecutionTimeInMs: t2 - t1 })
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
    const optionSet: any = payload

    switch (action) {
      case LIBRARY_ACTIONS.DELETE: {
        const { selectedResources } = payload

        if (selectedResources.length) {
          await deleteAssets(shopDomain, selectedResources, true)
        }

        break
      }

      case LIBRARY_ACTIONS.DUPLICATE: {
        const { selectedResources } = payload

        if (selectedResources.length) {
          let max = 0

          // Get template data
          const assets = await Asset.find({ shopDomain, refId: { $in: selectedResources } }).lean()
          const { clipartIds, optionSetsInLibrary } = (assets as unknown as AssetDocument[]).reduce(
            (_assets: { clipartIds: string[]; optionSetsInLibrary: AssetDocument[] }, asset: AssetDocument) => {
              if (isClipart(asset.type)) {
                _assets.clipartIds.push(asset.refId as string)
              } else if (asset.type !== EOptionSet.MULTI_LAYOUT_OPTION) {
                _assets.optionSetsInLibrary.push(asset)
              }

              return _assets
            },
            { clipartIds: [], optionSetsInLibrary: [] }
          )

          if (clipartIds.length > 0) {
            await duplicateTemplates(clipartIds, shopDomain)
          }

          // Get full option set data
          const optionSets = await OptionSet.find({
            shopDomain,
            _id: { $in: optionSetsInLibrary.map(asset => asset.refId) },
          }).lean()

          await Promise.all(
            optionSets.map(async optionSet => {
              const itemHavingSelectedLabel = await OptionSet.aggregate([
                {
                  $match: {
                    $and: [
                      { shopDomain },
                      {
                        label: {
                          $regex: new RegExp(`^${optionSet.label?.replace(/ \(\d+\)$/, '')}( \\(\\d+\\))?$`),
                        },
                      },
                    ],
                  },
                },
              ])

              let tempMax = max
              // Get the greatest number in similar labels
              itemHavingSelectedLabel.forEach((item: any) => {
                const num = Number(item?.label?.replace(/^.+\((\d+)\)$/, '$1'))

                if (!isNaN(num) && num > tempMax) {
                  tempMax = num
                }
              })

              max = Math.max(max, tempMax) + 1
              const uniqueLabel = `${optionSet.label?.replace(/ \(\d+\)$/, '')} (${max})`

              return createOrUpdateAsset(shopDomain, {
                ...optionSet,
                _id: uuid(),
                model: 'OptionSet',
                label: uniqueLabel,
                name: uniqueLabel,
                shopDomain,
              })
            })
          )
        }

        break
      }
    }

    return json({ success: true, optionSet })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
