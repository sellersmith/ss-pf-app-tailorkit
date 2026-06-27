import type { TemplateDimension } from '~/types/template'
import type { LayerDocument } from '../../models/Layer.server'
import type { OptionSetDocument } from '~/models/OptionSet'
import type { NodeImage, OptionSet as OptionSetType, PSD as PSDType, Template as TemplateDocument } from '~/types/psd'
import PSD from '../../models/PSD.server'
import Image from '../../models/Image.server'
import Layer from '../../models/Layer.server'
import Asset, { createOrUpdateAsset, evaluateRequestForMutatingAssets } from '~/models/Asset.server'
import Template, { createTemplateOrClipart } from '../../models/Template.server'
import { isClipart, isStoreAsset, TEMPLATE_TYPE } from '../api.templates/constants'
import { uuid } from '~/utils/uuid'
import { getObjectModel } from '~/utils/getObjectModel'
import { initializeAssistant } from '../api.ai-assistant/fns.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { chunkArray } from '~/utils/chunkArray'
import { updateOccurredEvent } from '../api.preferences/fns.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { getShopData } from '~/models/Shop.server'

// Maximum number of concurrent operations when updating assets
const BATCH_SIZE = 500

interface ITemplateData {
  _id: string
  name: string
  dimension: TemplateDimension
  previewUrl: string
  shopDomain: string
  psds: PSDType[]
  layers: LayerDocument[]
  images: NodeImage[]
  optionSets: OptionSetType[]
  type: string
  clipartsAdded?: any[]
  metadata?: any
}

/**
 * Saves a template with all its associated data (layers, images, PSDs, option sets, and cliparts).
 *
 * This function handles the creation or update of a template by:
 * - Validating request limits for mutating assets
 * - Processing and deduplicating option sets
 * - Updating images, layers, PSDs, and clipart usage in batches
 * - Creating a new template or updating an existing one
 * - Tracking AI-generated template usage events
 *
 * @param {ITemplateData} templateData - The template data object containing:
 *   - _id: Template ID
 *   - shopDomain: The shop domain identifier
 *   - psds: Array of PSD files
 *   - layers: Array of template layers
 *   - images: Array of template images
 *   - optionSets: Array of option set arrays (multi-layout support)
 *   - clipartsAdded: Array of cliparts to track usage
 *   - Additional template properties (name, metadata, previewUrl, etc.)
 * @param {boolean} [useAiFeature] - Optional flag to enable AI feature for the template.
 *   Only set on creation or first update; subsequent calls will not modify this flag.
 *
 * @returns {Promise<{isFirstTemplate: boolean, templateId: string, currentTemplate: any}>}
 *   - isFirstTemplate: Whether this is the first template created for the shop
 *   - templateId: The ID of the created/updated template
 *   - currentTemplate: The current template document (null if newly created)
 *
 * @throws {Error} If template validation or database operations fail
 */
export async function saveTemplate(templateData: ITemplateData, useAiFeature?: boolean) {
  const { _id, shopDomain, psds = [], layers = [], images = [], optionSets = [], clipartsAdded, ...rest } = templateData
  // Strip previewProductImage from template data - it's stored per print area, not in template
  if ((templateData as any).previewProductImage) {
    delete (templateData as any).previewProductImage
  }

  let isFirstTemplate = false
  let templateId = _id

  // Evaluate request number
  await evaluateRequestForMutatingAssets(shopDomain)

  // Flatten the option sets array to update each option set in batches
  // Example: optionSets: [[optionSet_text, optionSet_color], [], [], ....]
  // Deduplicate by _id to prevent E11000 duplicate key error when multi-layout child layers share option sets
  const flatOptionSets = optionSets.filter(Boolean).flat()
  const seenOptionSetIds = new Set<string>()
  const uniqueOptionSets = flatOptionSets.filter(optionSet => {
    if (!optionSet._id || seenOptionSetIds.has(optionSet._id)) return false
    seenOptionSetIds.add(optionSet._id)
    return true
  })

  // Heal legacy templates copied before #1174 that still share OptionSet documents
  // with their original. Detect any OptionSet _id also referenced by Layers of OTHER
  // templates in this shop; clone those to fresh _ids so saving this template no longer
  // overwrites the original's OptionSet records. Idempotent — no-op when no shares.
  // Healing failure is logged but does not block the save (best-effort optimization).
  const incomingOptionSetIds = Array.from(seenOptionSetIds)
  if (incomingOptionSetIds.length > 0) {
    try {
      const sharedOptionSetIds: string[] = await Layer.distinct('optionSet', {
        shopDomain,
        templateId: { $ne: _id },
        optionSet: { $in: incomingOptionSetIds },
      })

      if (sharedOptionSetIds.length > 0) {
        const optionSetIdRemap = new Map<string, string>(sharedOptionSetIds.map(id => [id, uuid()]))

        // Remap OptionSet collection records that will be upserted
        for (const optionSet of uniqueOptionSets) {
          const newId = optionSetIdRemap.get(optionSet._id)
          if (newId) optionSet._id = newId
        }

        // Remap layer foreign keys. layer.optionSet may contain raw string ids or
        // populated OptionSetDocument objects, depending on how the client sent them.
        for (const layer of layers) {
          const refs = layer.optionSet as Array<string | OptionSetDocument> | undefined
          if (Array.isArray(refs)) {
            layer.optionSet = refs.map((ref): string | OptionSetDocument => {
              if (typeof ref === 'string') return optionSetIdRemap.get(ref) ?? ref
              if (ref && typeof ref === 'object' && typeof ref._id === 'string') {
                const mapped = optionSetIdRemap.get(ref._id)
                return mapped ? { ...ref, _id: mapped } : ref
              }
              return ref
            }) as typeof layer.optionSet
          }
        }
      }
    } catch (error) {
      console.warn('[saveTemplate] OptionSet healing failed, continuing with original ids:', error)
    }
  }

  const optionSetChunks = chunkArray(uniqueOptionSets, BATCH_SIZE)

  for (const optionSetChunk of optionSetChunks) {
    await Promise.all(
      optionSetChunk.map(optionSet =>
        createOrUpdateAsset(shopDomain, {
          ...optionSet,
          model: 'OptionSet',
          name: optionSet.label,
          shopDomain,
        })
      )
    )
  }

  // Update images source in batches
  const imageChunks = chunkArray(images, BATCH_SIZE)
  for (const imageChunk of imageChunks) {
    await Promise.all(imageChunk.map(image => updateImage(image, shopDomain)))
  }

  // Clean up redundant/removed layers on database before upserting layers
  await removeRedundantLayers(_id, layers, shopDomain)

  // Update layers data in batches
  const layerChunks = chunkArray(layers, BATCH_SIZE)
  for (const layerChunk of layerChunks) {
    await Promise.all(layerChunk.map(layer => updateLayer({ ...layer, templateId: _id }, shopDomain)))
  }

  // Update psd data in batches
  const psdChunks = chunkArray(psds, BATCH_SIZE)
  for (const psdChunk of psdChunks) {
    await Promise.all(psdChunk.map(psd => updatePSD(psd, shopDomain)))
  }

  // Update the number of uses for cliparts in batches
  if (clipartsAdded && clipartsAdded.length) {
    const clipartChunks = chunkArray(clipartsAdded, BATCH_SIZE)
    for (const clipartChunk of clipartChunks) {
      await Promise.all(clipartChunk.map(clipart => updateClipartUsage(clipart, shopDomain)))
    }
  }

  // Update template data
  const currentTemplate = await Template.findOne({ _id, shopDomain })

  if (!currentTemplate) {
    const createPayload: Record<string, any> = {
      ...rest,
      _id,
      shopDomain,
      psds: psds.map(psd => psd.psdId),
      layers: layers.map(layer => layer._id),
    }

    // Only set useAiFeature on create when enabling it
    if (useAiFeature === true) {
      !createPayload?.metadata
        ? (createPayload['metadata.useAiFeature'] = true)
        : (createPayload['metadata'] = { ...createPayload?.metadata, useAiFeature: true })
    }

    const { isFirstTemplate: isFirstTemplateCreated, templateId: templateIdCreated } = await createTemplateOrClipart(
      shopDomain,
      createPayload
    )

    isFirstTemplate = isFirstTemplateCreated
    templateId = templateIdCreated

    if (templateData.metadata?.generatedByAIAssistantAt) {
      const shopData = await getShopData(shopDomain)
      const occurredEvents = shopData?.appConfig?.occurredEvents || {}

      if (shopData && !occurredEvents[CUSTOMERIO_EVENTS.USED_AI_GEN_DESIGN]) {
        updateOccurredEvent(shopData, CUSTOMERIO_EVENTS.USED_AI_GEN_DESIGN, true).catch(console.error)
      }
    }
  } else {
    const alreadyAiEnabled = currentTemplate?.metadata?.useAiFeature === true

    const updatePayload: Record<string, any> = {
      ...rest,
      _id,
      shopDomain,
      psds: psds.map(psd => psd.psdId),
      layers: layers.map(layer => layer._id),
    }

    // Once enabled, never mutate useAiFeature again. Only set it if enabling for the first time.
    if (!alreadyAiEnabled && useAiFeature === true) {
      !updatePayload?.metadata
        ? (updatePayload['metadata.useAiFeature'] = true)
        : (updatePayload['metadata'] = { ...updatePayload?.metadata, useAiFeature: true })
    }

    await Template.updateOne({ _id, shopDomain }, updatePayload)

    // If shop is store asset, insert template to Asset as a premade template.
    if (isStoreAsset(shopDomain)) {
      await Asset.updateOne(
        { refId: _id, shopDomain },
        {
          name: templateData.name,
          type: TEMPLATE_TYPE.PREMADE_TEMPLATE,
          model: 'Template',
          previewUrl: templateData.previewUrl,
        },
        { upsert: true }
      )
    }
  }

  if (templateData.metadata?.generatedByAIAssistantAt || templateData.metadata?.updatedByAIAssistantAt) {
    const shopData = await getShopData(shopDomain)
    const occurredEvents = shopData?.appConfig?.occurredEvents || {}

    if (shopData && !occurredEvents[CUSTOMERIO_EVENTS.USED_AI_GEN_DESIGN]) {
      updateOccurredEvent(shopData, CUSTOMERIO_EVENTS.USED_AI_GEN_DESIGN, true).catch(console.error)
    }
  }
  return { isFirstTemplate, templateId, currentTemplate }
}

export function updateImage(image: NodeImage, shopDomain?: string) {
  const { _id } = image

  return new Promise((resolve, reject) => {
    Image.findOneAndUpdate({ _id }, { ...image, shopDomain }, { upsert: true })
      .then(value => resolve(value))
      .catch(err => reject(err))
  })
}

export function updateLayer(layer: LayerDocument, shopDomain?: string) {
  const { _id } = layer

  return new Promise((resolve, reject) => {
    Layer.findOneAndUpdate({ _id }, { ...layer, shopDomain }, { upsert: true })
      .then(value => resolve(value))
      .catch(err => reject(err))
  })
}

export function deleteLayers(_ids: string[], shopDomain: string) {
  return new Promise((resolve, reject) => {
    Layer.deleteMany({ _id: { $in: _ids }, shopDomain })
      .then(result => resolve(result))
      .catch(err => reject(err))
  })
}

/**
 * @description By default, when saving template, client sends the existing layer and ignore the removed ids
 * so we need to clean up redundant/removed layers on database
 * @param templateId
 * @param updatedLayers
 * @param shopDomain
 */

async function removeRedundantLayers(templateId: string, updatedLayers: LayerDocument[], shopDomain: string) {
  const updatedLayerIds = updatedLayers.map(layer => layer._id)

  /** Find template by _id */
  const template = await Template.findOne({ _id: templateId })

  const currentLayerIds: string[] = template?.layers || []

  /** Get ids of layer to be removed */
  const removedIds = currentLayerIds.filter(currentLayerId => !updatedLayerIds.includes(currentLayerId))

  if (removedIds.length > 0) {
    await deleteLayers(removedIds, shopDomain)
  }
}

export function updatePSD(psd: PSDType, shopDomain?: string) {
  const { psdId } = psd

  return new Promise((resolve, reject) => {
    PSD.findOneAndUpdate({ _id: psdId }, { ...psd, shopDomain }, { upsert: true })
      .then(value => resolve(value))
      .catch(err => reject(err))
  })
}

export function updateClipartUsage(clipart: any, shopDomain: string) {
  const isClipartType = isClipart(clipart.type)

  return new Promise((resolve, reject) => {
    createOrUpdateAsset(
      shopDomain,
      {
        model: 'Template',
        ...clipart,
        type: isClipartType ? TEMPLATE_TYPE.CLIPART : TEMPLATE_TYPE.PREMADE_TEMPLATE,
        shopDomain,
      },
      { $inc: { numberOfUses: 1 } },
      isClipartType
    )
      .then(value => resolve(value))
      .catch(err => reject(err))
  })
}

export function populatePremadeTemplate(template: any, templateId: string, shopDomain: string) {
  const premadeTemplate = getObjectModel(template || {})
  const psds = populatePremadeTemplatePSDData(premadeTemplate?.psds || [], shopDomain)
  const layers = populatePremadeTemplateLayersData(premadeTemplate?.layers || [], shopDomain)

  const _premadeTemplate = {
    ...premadeTemplate,
    _id: templateId,
    createdAt: undefined,
    updatedAt: undefined,
    shopDomain,
    psds,
    layers: Object.values(layers),
  }

  return _premadeTemplate
}

// Duplicate layer data
function populatePremadeTemplateLayersData(layers: any[] = [], shopDomain: string) {
  const layerMap = layers.reduce<Record<string, any>>((acc, layer) => {
    const { _id, parent, optionSet } = layer

    const newId = uuid()
    const processedOptionSet = Array.isArray(optionSet)
      ? optionSet.map(option => ({ ...getObjectModel(option), shopDomain, _id: uuid() }))
      : []
    const newParentId = parent ? acc[parent]?._id : undefined

    acc[_id] = { ...getObjectModel(layer), _id: newId, parent: newParentId, shopDomain, optionSet: processedOptionSet }
    return acc
  }, {})

  return Object.values(layerMap)
}

// Duplicate PSD data
function populatePremadeTemplatePSDData(psds: any[] = [], shopDomain: string) {
  return psds.map(psd => ({ ...getObjectModel(psd), shopDomain, _id: uuid() }))
}

/**
 * Analyze the template content and update the template description
 * @param previewUrl
 * @param currentTemplate
 * @returns
 */
export async function analyzeTemplateContent(previewUrl: string, currentTemplate: TemplateDocument) {
  try {
    if (previewUrl) {
      // Analyze the image content
      const assistant = initializeAssistant({
        model: 'gpt-4.1-nano',
      })

      const currentTemplateMetadata = currentTemplate?.metadata || {}
      const currentTemplateDescription = currentTemplateMetadata?.templateDescription

      // Only update the template description 1 day after the last update to cache and reduce the number of requests
      const lastUpdatedAt = currentTemplateDescription?.createdAt

      const now = new Date()
      if (!lastUpdatedAt || now > new Date(lastUpdatedAt.getTime() + ONE_DAY_IN_MILLISECONDS)) {
        const templateDescription = { content: await assistant.analyzeImageContent(previewUrl), createdAt: new Date() }

        // Update the template description
        await Template.updateOne(
          { _id: currentTemplate._id },
          { metadata: { ...currentTemplateMetadata, templateDescription } }
        )
      }
    }
  } catch (error) {
    console.log('Error analyzing image content: ', error)
    console.log('===Skip updating template description===')
  }
}
