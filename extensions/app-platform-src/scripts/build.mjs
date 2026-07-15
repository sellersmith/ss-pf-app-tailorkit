import { buildThemeAssets, parseBuildOptions } from './build-theme-assets.mjs'
import { generateThemeSurfaces } from './generate-theme-surfaces.mjs'

const options = parseBuildOptions(process.argv.slice(2))

await buildThemeAssets(options)
generateThemeSurfaces(options)
