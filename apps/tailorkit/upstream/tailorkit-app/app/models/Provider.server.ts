import mongoose, { type Model } from 'mongoose'
import type { ProviderDocument } from './Provider'
import { EPROVIDER, PROVIDER_API_URL } from '~/constants/fulfillment-providers'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { fetchItem } from '~/bootstrap/fns/fetch.server'
import { serverInitiator } from '~/bootstrap/fns/initiator'

const providerSchema = new mongoose.Schema<ProviderDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    description: {
      type: String,
      index: true,
      required: true,
    },
    detailsUrl: {
      type: String,
      index: true,
      required: true,
    },
    baseUrl: {
      type: String,
      index: true,
    },
    logoUrl: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      index: true,
      default: 'active',
    },
    recommended: {
      type: Number,
      index: true,
      default: Infinity,
    },
  },
  { timestamps: true }
)

const Provider = mongoose.models.Provider || mongoose.model<ProviderDocument>('Provider', providerSchema, 'providers')

export default Provider

export const getModelDataWithProviderData = async (params: {
  request: LoaderFunctionArgs['request']
  model: Model<any>
  shopDomain: string
  providerId: string
}) => {
  const { request, model, shopDomain, providerId } = params

  try {
    const modelData = await fetchItem(request, model, [
      {
        $match: {
          $and: [{ shopDomain }, { providerId }],
        },
      },
      {
        $lookup: {
          from: Provider.collection.collectionName,
          let: { tProviderId: { $toObjectId: '$providerId' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$$tProviderId', '$_id'],
                },
              },
            },
          ],
          as: 'providerInfo',
        },
      },
      {
        $unwind: {
          path: '$providerInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
    ])

    return modelData
  } catch (err) {
    return null
  }
}

export async function runCreateDefaultProviders() {
  if (!process.env.DEFAULT_PROVIDER_IMPORTED) {
    ;(async function () {
      // Define default providers
      const providersList = [
        {
          name: EPROVIDER.PRINTIFY,
          baseUrl: PROVIDER_API_URL.Printify.baseUrl,
          description:
            'Printify is all about helping you find financial freedom by building your print-on-demand business.',
          detailsUrl: 'https://try.printify.com/tailorkit',
          logoUrl: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Provider-Printify-Logo.svg?v=1730211113',
        },
        {
          name: EPROVIDER.SHINEON,
          baseUrl: 'https://api.shineon.com',
          description:
            'ShineOn offers personalized jewelry with custom engraving — necklaces, bracelets, rings, and more.',
          detailsUrl: 'https://shineon.com',
          logoUrl: 'https://shineon.com/images/logo.svg',
        },
        {
          name: EPROVIDER.PRINTWAY,
          baseUrl: PROVIDER_API_URL.PrintWay.baseUrl,
          description:
            'PrintWay offers 550+ print-on-demand products with global manufacturing locations and multi-position artwork support.',
          detailsUrl: 'https://printway.io',
          logoUrl: 'https://printway.io/images/logo_header.png',
        },
      ]

      // Import default providers
      for (let i = 0; i < providersList.length; i++) {
        const { name, ...rest } = providersList[i]

        await Provider.updateOne({ name }, rest, { upsert: true })
      }
    })()

    process.env.DEFAULT_PROVIDER_IMPORTED = 'yes'
  }
}

// Add runCreateDefaultProviders to serverInitiator
serverInitiator.addInitiator(runCreateDefaultProviders)
