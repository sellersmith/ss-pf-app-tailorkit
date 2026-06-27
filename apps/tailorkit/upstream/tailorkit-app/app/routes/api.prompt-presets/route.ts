import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import PromptPreset from '~/models/PromptPreset.server'
import quickPrompts from '~/models/PromptPreset.quickPrompts'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { visualStyles } from '~/modules/PromptPresets/taxonomies/visualStyles'
import { contentThemes } from '~/modules/PromptPresets/taxonomies/contentThemes'
import { templateTypes } from '~/modules/PromptPresets/taxonomies/templateTypes'

// Increment this version to force re-migration of prompt presets
const PROMPT_PRESETS_VERSION = 4

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get query params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as string

  // Query taxonomy presets from database (visual_style, content_theme, template_type)
  if (['template_type', 'visual_style', 'content_theme'].includes(type)) {
    return json({
      items: type === 'template_type' ? templateTypes : type === 'visual_style' ? visualStyles : contentThemes,
    })
  }

  // Import default prompt presets
  const imported = await PromptPreset.find({ shopDomain, imported: true }).lean()

  // Check if any imported prompt is missing the category field (for migration)
  const needsCategoryMigration = imported.some(item => item.category === undefined)

  // Check if presets version has changed (force re-migration)
  const currentVersion = imported[0]?.presetVersion as number | undefined
  const needsVersionMigration = currentVersion !== PROMPT_PRESETS_VERSION

  if (imported.length !== quickPrompts.length || needsCategoryMigration || needsVersionMigration) {
    // Remove obsolete predefined quick prompts
    const itemsAlias = quickPrompts.map(item => item.alias)
    // await PromptPreset.deleteMany({ shopDomain, alias: { $nin: quickPrompts.map(item => item.alias) } })

    await PromptPreset.bulkWrite([
      // Clean-up obsolete predefined quick prompts
      {
        updateMany: {
          filter: { shopDomain, alias: { $nin: itemsAlias } },
          update: { $set: { imported: false } },
        },
      },
      // Upsert predefined quick prompts
      ...quickPrompts.map((item, index) => {
        const typedItem = item as typeof item & { hot?: boolean; category?: string }
        const isHot = typedItem.hot === true

        return {
          updateOne: {
            filter: {
              $or: [
                { shopDomain, alias: typedItem.alias },
                { shopDomain, alias: { $in: [null, undefined] }, name: typedItem.name },
              ],
            },
            update: {
              $set: {
                name: typedItem.name,
                alias: typedItem.alias,
                type: typedItem.type,
                instruction: typedItem.instruction,
                thumbnail: typedItem.thumbnail,
                category: typedItem.category ?? null,
                shopDomain,
                imported: true,
                ordering: (index + 1) / 100,
                presetVersion: PROMPT_PRESETS_VERSION,
                ...(isHot && { hot: true }),
              },
              ...(!isHot && { $unset: { hot: 1 } }),
            },
            upsert: true,
          },
        }
      }),
    ])
  }

  return json({
    items: await PromptPreset.find({ shopDomain }).sort({
      ordering: 1,
    }),
  })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (!action) {
    throw 'Action is required'
  }

  try {
    switch (action) {
      case 'sort': {
        const { items } = await request.json()

        for (const item of items) {
          const { _id, name, ordering } = item

          // Verify item ownership
          const existing = await PromptPreset.findOne({ _id, shopDomain })

          if (!existing) {
            throw `Item ${name} not found`
          }

          // Update ordering
          await PromptPreset.updateOne({ _id }, { ordering })
        }

        break
      }

      case 'update': {
        const { _id, name, instruction, ...data } = await request.json()

        // Make sure users not entering empty values
        if (!name || !instruction) {
          throw !name ? "Label can't be empty" : "Content can't be empty"
        }

        // Make sure users not duplicating a prompt preset
        const existing = await PromptPreset.findOne({
          $and: [
            { shopDomain },
            { _id: { $ne: _id } },
            { $or: [{ name: name.trim() }, { instruction: instruction.trim() }] },
          ],
        })

        if (existing) {
          throw existing.name === name ? "Label can't be duplicated" : "Content can't be duplicated"
        }

        if (_id) {
          await PromptPreset.updateOne(
            { _id, shopDomain },
            { name: name.trim(), instruction: instruction.trim(), ...data }
          )
          return json({ success: true })
        }

        const created = await PromptPreset.create({
          name: name.trim(),
          instruction: instruction.trim(),
          ...data,
          shopDomain,
        })
        return json({ success: true, item: created })
      }

      case 'delete': {
        const { _id } = await request.json()

        await PromptPreset.deleteOne({ _id, shopDomain, imported: false })

        break
      }

      default: {
        break
      }
    }

    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, message: e.message || e })
  }
}
