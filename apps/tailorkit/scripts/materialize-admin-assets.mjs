import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const appId = 'tailorkit'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(appRoot, '../..')
const sourceAdminRoot = path.join(appRoot, 'dist/admin')
const sourcePublicFontsRoot = path.join(appRoot, 'upstream/tailorkit-app/public/fonts')
const defaultAdminSurfaceDirs = ['copied-routes']
const staticTargets = [
  path.join(repoRoot, 'web/core/app-platform/apps', appId),
  path.join(repoRoot, 'web/core/public/app-platform/apps', appId),
  path.join(repoRoot, 'public/app-platform/apps', appId),
]

function assertSourceExists() {
  const missingSurfaceDir = defaultAdminSurfaceDirs.find(
    surfaceDir => !fs.existsSync(path.join(sourceAdminRoot, surfaceDir))
  )

  if (missingSurfaceDir) {
    throw new Error(
      `TailorKit admin assets are missing at ${path.join(sourceAdminRoot, missingSurfaceDir)}. Run build:copied-routes-runtime first.`
    )
  }
}

function copyAppAssets(targetRoot) {
  const targetAdminRoot = path.join(targetRoot, 'admin')
  const targetFontsRoot = path.join(targetRoot, 'fonts')

  fs.rmSync(targetAdminRoot, { recursive: true, force: true })
  fs.rmSync(targetFontsRoot, { recursive: true, force: true })
  fs.mkdirSync(targetRoot, { recursive: true })
  fs.mkdirSync(targetAdminRoot, { recursive: true })

  for (const surfaceDir of defaultAdminSurfaceDirs) {
    fs.cpSync(path.join(sourceAdminRoot, surfaceDir), path.join(targetAdminRoot, surfaceDir), { recursive: true })
  }

  if (fs.existsSync(sourcePublicFontsRoot)) {
    fs.cpSync(sourcePublicFontsRoot, targetFontsRoot, { recursive: true })
  }
}

assertSourceExists()
staticTargets.forEach(copyAppAssets)
