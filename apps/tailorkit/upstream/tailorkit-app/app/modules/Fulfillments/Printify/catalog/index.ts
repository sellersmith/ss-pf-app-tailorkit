/* eslint-disable max-len */
import type { FetchDataFunc } from '../'
import type { GetBlueprintsFunc } from './getBlueprints'
import getBlueprints from './getBlueprints'
import type { GetBlueprintFunc } from './getBlueprint'
import getBlueprint from './getBlueprint'
import type { GetBlueprintProvidersFunc } from './getBlueprintProviders'
import getBlueprintProviders from './getBlueprintProviders'
import type { GetBlueprintVariantsFunc } from './getBlueprintVariants'
import getBlueprintVariants from './getBlueprintVariants'
import type { GetVariantShippingFunc } from './getVariantShipping'
import getVariantShipping from './getVariantShipping'
import type { GetProvidersFunc } from './getProviders'
import listProviders from './getProviders'
import type { GetProviderFunc } from './getProvider'
import getProvider from './getProvider'
import type { SearchBlueprintsFunc } from './searchBlueprints'
import searchBlueprints from './searchBlueprints'

export interface CatalogMethods {
  getBluePrints: GetBlueprintsFunc
  getBlueprint: GetBlueprintFunc
  getBlueprintProviders: GetBlueprintProvidersFunc
  getBlueprintVariants: GetBlueprintVariantsFunc
  getVariantShipping: GetVariantShippingFunc
  getProviders: GetProvidersFunc
  getProvider: GetProviderFunc
  searchBlueprints: SearchBlueprintsFunc
}

/**
 * @see https://developers.printify.com/#catalog
 * @description 
 * Through the Catalog resource you can see all of the products, product variants, variant options and print providers available in the Printify catalog.
  Products in the Printify catalog are referred to as blueprints (only after user artwork has been added, are they referred to as products).
  Every blueprint in the printify catalog has multiple Print Providers that offer that blueprint. In addition to general differences between Print Providers including location and print technology employed, each Print Provider also offers different colors, sizes, print areas and prices.
  Each Print Provider's blueprint has specific size and color combinations known as variants. Variants also contain information on a products available print areas and sizes.
*/
class Catalog implements CatalogMethods {
  /** Get list blue prints */
  getBluePrints: GetBlueprintsFunc
  /** Get blueprint by id */
  getBlueprint: GetBlueprintFunc
  /** Get blueprint's provider by blueprintId */
  getBlueprintProviders: GetBlueprintProvidersFunc
  /** Get blueprint's variant by blueprintId and providerId */
  getBlueprintVariants: GetBlueprintVariantsFunc
  /** Get variant shipping by blueprintId and providerId */
  getVariantShipping: GetVariantShippingFunc
  /** Get list providers */
  getProviders: GetProvidersFunc
  /** Get provider by id */
  getProvider: GetProviderFunc
  /** Search blueprints */
  searchBlueprints: SearchBlueprintsFunc

  constructor(fetchData: FetchDataFunc) {
    this.getBluePrints = getBlueprints(fetchData)
    this.getBlueprint = getBlueprint(fetchData)
    this.getBlueprintProviders = getBlueprintProviders(fetchData)
    this.getBlueprintVariants = getBlueprintVariants(fetchData)
    this.getVariantShipping = getVariantShipping(fetchData)
    this.getProviders = listProviders(fetchData)
    this.getProvider = getProvider(fetchData)
    this.searchBlueprints = searchBlueprints(fetchData)
  }
}

export default Catalog
