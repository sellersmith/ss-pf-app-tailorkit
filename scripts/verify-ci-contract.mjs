import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requiredFiles = [
  'README.md',
  'Jenkinsfile',
  'docs/devops-handoff.md',
  'scripts/build-admin-artifact.mjs',
  'scripts/package-app-platform-admin-artifact.mjs',
  'scripts/package-app-platform-artifact.mjs',
  'scripts/deploy-app-platform-admin-artifact.mjs',
  '.github/workflows/app-platform-artifact.yml',
  'apps/tailorkit/package.json',
  'apps/tailorkit/src/admin/runtime-entry.tsx',
  'apps/tailorkit/vite.admin-runtime.config.mts',
]

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const tailorkitPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/tailorkit/package.json'), 'utf8'))
const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/app-platform-artifact.yml'), 'utf8')
const packageArtifactScript = fs.readFileSync(path.join(repoRoot, 'scripts/package-app-platform-artifact.mjs'), 'utf8')
const requiredScripts = [
  'build:artifact',
  'package:artifact',
  'build:admin-artifact',
  'package:admin-artifact',
  'deploy:admin-artifact',
  'deploy:admin-artifact:dry-run',
]

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, file))) {
    throw new Error(`Missing CI contract file: ${file}`)
  }
}

for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) {
    throw new Error(`Missing package script: ${script}`)
  }
}

if (tailorkitPackageJson.scripts?.['build:admin-artifact'] !== 'npm run build:copied-routes-runtime && npm run package:admin-artifact') {
  throw new Error('TailorKit package is missing build:admin-artifact contract')
}

if (tailorkitPackageJson.scripts?.['build:artifact'] !== 'npm run build:admin-runtime && npm run build:copied-routes-runtime && npm run package:artifact') {
  throw new Error('TailorKit package is missing build:artifact contract')
}

if (tailorkitPackageJson.scripts?.['package:artifact'] !== 'node ../../scripts/package-app-platform-artifact.mjs') {
  throw new Error('TailorKit package is missing package:artifact contract')
}

if (!workflow.includes('dist/artifacts/*.tgz.release.json')) {
  throw new Error('TailorKit artifact workflow must upload release metadata')
}

if (!workflow.includes('APP_PLATFORM_ARTIFACT_VERSION') || !workflow.includes('${GITHUB_REF_NAME#tailorkit-v}')) {
  throw new Error('TailorKit artifact workflow must derive artifact version from release tag')
}

if (!workflow.includes('Notify artifact failure')) {
  throw new Error('TailorKit artifact workflow must include failure notification hook')
}

if (!packageArtifactScript.includes('writeReleaseMetadata')) {
  throw new Error('TailorKit artifact package script must write release metadata')
}

if (!packageArtifactScript.includes('process.env.APP_PLATFORM_ARTIFACT_VERSION')) {
  throw new Error('TailorKit artifact package script must accept APP_PLATFORM_ARTIFACT_VERSION')
}

const requiredRootExports = {
  '.': './apps/tailorkit/src/index.ts',
  './manifest': './apps/tailorkit/manifest.ts',
  './admin': './apps/tailorkit/src/admin/index.tsx',
  './backend/plugin': './apps/tailorkit/src/backend/plugin.ts',
  './product-editor-route-contract': './apps/tailorkit/src/admin/product-editor-island/route-contract.ts',
  './domain/order-record': './apps/tailorkit/domain/order-record.ts',
  './domain/order-property-matchers': './apps/tailorkit/domain/order-property-matchers.ts',
}

for (const [exportName, target] of Object.entries(requiredRootExports)) {
  if (packageJson.exports?.[exportName] !== target) {
    throw new Error(`TailorKit root package export ${exportName} must point to ${target}`)
  }

  if (!fs.existsSync(path.join(repoRoot, target.replace(/^\.\//, '')))) {
    throw new Error(`TailorKit root package export ${exportName} points to missing file ${target}`)
  }
}

process.stdout.write('ci-contract-ok\n')
