// Fresh loose read-only schemas bound to the REAL native collection names.
// Upstream models are NOT imported (their ~/bootstrap/db + path aliases don't resolve here); these
// schemas only need to be loose enough to read the populated graph. Collection name is the 3rd arg to
// conn.model() because mongoose pluralization is wrong for most of these (e.g. variantintegrations).
import { Schema, type Connection, type Model } from 'mongoose'

/** Loose schema: string _id, no enforced shape, extra fields tolerated. */
function looseSchema(): Schema {
  return new Schema({ _id: { type: String } }, { strict: false, _id: false, versionKey: false })
}

export interface NativeModels {
  Integration: Model<any>
  VariantIntegration: Model<any>
  Mockup: Model<any>
  LayerIntegration: Model<any>
  MockupView: Model<any>
  Template: Model<any>
  Layer: Model<any>
  Image: Model<any>
  PSD: Model<any>
  OptionSet: Model<any>
  PrintArea: Model<any>
  Order: Model<any>
  UserJourney: Model<any>
  Shop: Model<any>
  GlobalStyling: Model<any>
}

/** [modelName, exact-collection-name] — verified against live + local TailorKit DBs. */
const MODEL_COLLECTION_BINDINGS: Array<[keyof NativeModels, string]> = [
  ['Integration', 'integrations'],
  ['VariantIntegration', 'variantintegrations'],
  ['Mockup', 'mockups'],
  ['LayerIntegration', 'layerintegrations'],
  ['MockupView', 'mockupviews'],
  ['Template', 'templates'],
  ['Layer', 'layers'],
  ['Image', 'images'],
  ['PSD', 'psds'],
  ['OptionSet', 'optionsets'],
  ['PrintArea', 'printareas'],
  ['Order', 'orders'],
  ['UserJourney', 'user_journey'],
  ['Shop', 'shops'],
  ['GlobalStyling', 'globalstylings'],
]

/**
 * Registers every native model on the given connection, bound to its exact collection name.
 * Idempotent per connection: reuses an already-registered model instead of re-defining it.
 */
export function registerNativeModels(connection: Connection): NativeModels {
  const models = {} as NativeModels
  MODEL_COLLECTION_BINDINGS.forEach(([name, collection]) => {
    const existing = connection.models[name]
    models[name] = existing || connection.model(name, looseSchema(), collection)
  })
  return models
}

/**
 * Upstream ProductEditor opens detail with `populateTemplate=1`, which populates Template.layers plus
 * layer.image/optionSet (Integration.server.ts:206-226). Migration must preserve that fully-populated
 * editor blob; leaving Template.layers as bare ids makes the copied editor outline show UUIDs and inert
 * elements. Keep this pipeline in sync with that upstream populateTemplate branch.
 */
const TEMPLATE_POPULATE = {
  populate: [
    {
      path: 'layers',
      model: 'Layer',
      strictPopulate: false,
      // Keep the fields the copied editor needs for outline/canvas identity, but do NOT persist heavy PSD
      // or image channel blobs inside editorPayload. A full populate can exceed Mongo's 16MB document limit
      // on real TailorKit shops with many layered templates.
      select: '_id type width height visible parent legacyName label name top left right bottom image optionSet psdId',
      populate: [
        { path: 'image', model: 'Image', select: '_id src originalSrc hasMask opacity', strictPopulate: false },
        { path: 'optionSet', model: 'OptionSet', select: '_id label labelOnStoreFront type data values', strictPopulate: false },
      ],
    },
  ],
}

/**
 * Populate constant mirroring upstream getDetailIntegration (Integration.server.ts:206-277) with
 * populateTemplate=1 semantics.
 *
 * Key join detail: Integration.variants[] holds Shopify GID strings, so the variants populate matches
 * VariantIntegration on `id` (localField/foreignField), NOT `_id`. MockupView is registered as
 * 'MockupView'; pass the model name string so the nested populate resolves.
 */
export const INTEGRATION_POPULATE = {
  path: 'variants',
  model: 'VariantIntegration',
  localField: 'variants',
  foreignField: 'id',
  strictPopulate: false,
  populate: [
    {
      path: 'mockup',
      model: 'Mockup',
      strictPopulate: false,
      populate: [
        {
          path: 'layers',
          model: 'LayerIntegration',
          strictPopulate: false,
          populate: { path: 'data.templateId', model: 'Template', strictPopulate: false, ...TEMPLATE_POPULATE },
        },
        {
          path: 'views',
          model: 'MockupView',
          strictPopulate: false,
          populate: [{ path: 'layers', model: 'LayerIntegration', strictPopulate: false }],
        },
      ],
    },
    {
      path: 'printAreas',
      model: 'PrintArea',
      strictPopulate: false,
      populate: { path: 'template', model: 'Template', strictPopulate: false, ...TEMPLATE_POPULATE },
    },
  ],
}

// (no `as const` — recursive readonly trips TS inference for nested populate arrays).
