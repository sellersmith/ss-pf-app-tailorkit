// App-platform theme build workspace owns generated Shopify extension output for internal apps.
import fs from 'fs'
import path from 'path'
import ts from 'typescript'
import vm from 'vm'

// Loads app-owned theme surface metadata without requiring a server build. The only supported
// import is the type-only app-platform contract path, so theme generation cannot execute app code.
export function loadThemeSurfaces(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const module = { exports: {} }

  vm.runInNewContext(transpiled.outputText, {
    exports: module.exports,
    module,
    require(specifier) {
      if (specifier.includes('web/server/src/app-platform/contracts')) return {}
      throw new Error(`Unsupported theme surface import: ${specifier}`)
    },
  })

  const themeSurfaces = module.exports.themeSurfaces || module.exports.default
  if (!themeSurfaces?.appId) {
    throw new Error(`Theme surface module must export themeSurfaces: ${sourcePath}`)
  }
  return themeSurfaces
}

export function discoverThemeSurfaceApps(repoRoot) {
  const appsRoot = path.join(repoRoot, 'apps')
  if (!fs.existsSync(appsRoot)) return []

  // apps/* is the source-of-truth; extensions/pagefly-theme-helper is only the Shopify deploy shell.
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const sourceRoot = path.join('apps', entry.name, 'theme-extension')
      const themeSurfacesPath = path.join(repoRoot, sourceRoot, 'theme-surfaces.ts')
      if (!fs.existsSync(themeSurfacesPath)) return null

      return {
        appId: entry.name,
        sourceRoot,
        themeSurfacesPath,
        themeSurfaces: loadThemeSurfaces(themeSurfacesPath),
      }
    })
    .filter(Boolean)
}

export function selectThemeSurfaceApps(apps, appId, options = {}) {
  if (!appId && !options.includeOnDemand) {
    return apps.filter(app => app.themeSurfaces.buildMode !== 'on-demand')
  }
  if (!appId) return apps

  const selected = apps.filter(app => app.appId === appId || app.themeSurfaces.appId === appId)
  if (!selected.length) {
    throw new Error(`No app-platform theme surface app found for appId=${appId}`)
  }

  return selected
}
