import crypto from 'crypto'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apps = {
  tailorkit: {
    artifactType: 'admin-static',
    buildCommand: 'npm run build:admin-artifact',
    entryManifest: 'admin/copied-routes/manifest.json',
    sourceRepo: 'sellersmith/ss-pf-app-tailorkit',
    sourceAdminRoot: path.join(repoRoot, 'apps/tailorkit/dist/admin'),
    sourceFontsRoot: path.join(repoRoot, 'apps/tailorkit/upstream/tailorkit-app/public/fonts'),
  },
}

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]

    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Invalid argument pair: ${key ?? ''} ${value ?? ''}`.trim())
    }

    args[key.slice(2)] = value
  }

  return args
}

function getGitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function createArtifactId(appId, gitSha, createdAt) {
  const shortSha = gitSha === 'unknown' ? 'unknown' : gitSha.slice(0, 12)
  const timestamp = createdAt.replace(/[-:.]/g, '').replace('T', '-').replace('Z', 'Z')
  return `${appId}-admin-static-${shortSha}-${timestamp}`
}

function assertSafeRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error(`Invalid TailorKit admin artifact path: ${relativePath}`)
  }

  const normalized = path.posix.normalize(relativePath)

  if (path.isAbsolute(relativePath) || normalized === '..' || normalized.startsWith('../') || normalized.includes('\0')) {
    throw new Error(`Invalid TailorKit admin artifact path escapes artifact root: ${relativePath}`)
  }
  return normalized
}

function collectManifestAssets(manifest, entryKey, visited = new Set()) {
  if (visited.has(entryKey)) {
    return []
  }

  visited.add(entryKey)

  const entry = manifest[entryKey]
  if (!entry || typeof entry !== 'object') {
    return []
  }

  const assets = [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])].filter(Boolean)

  for (const importKey of entry.imports ?? []) {
    assets.push(...collectManifestAssets(manifest, importKey, visited))
  }

  return assets
}

function validateCopiedRoutesManifest(artifactRoot, entryManifest) {
  const manifestPath = path.join(artifactRoot, entryManifest)
  const copiedRoutesRoot = path.dirname(manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  for (const entryKey of Object.keys(manifest)) {
    for (const assetPath of collectManifestAssets(manifest, entryKey)) {
      const safeAssetPath = assertSafeRelativePath(assetPath)
      const fullPath = path.join(copiedRoutesRoot, safeAssetPath)

      if (!fs.existsSync(fullPath)) {
        throw new Error(`TailorKit admin artifact manifest references missing asset: ${assetPath}`)
      }
    }
  }
}

function walkFiles(rootDir, currentDir = rootDir) {
  if (!fs.existsSync(currentDir)) {
    return []
  }

  return fs.readdirSync(currentDir, { withFileTypes: true }).flatMap(dirent => {
    const absolutePath = path.join(currentDir, dirent.name)

    if (dirent.isDirectory()) {
      return walkFiles(rootDir, absolutePath)
    }

    return dirent.isFile() ? [path.relative(rootDir, absolutePath).split(path.sep).join('/')] : []
  })
}

function createChecksums(artifactRoot) {
  return Object.fromEntries(
    walkFiles(artifactRoot)
      .filter(relativePath => relativePath !== 'artifact-manifest.json')
      .sort()
      .map(relativePath => {
        const filePath = path.join(artifactRoot, relativePath)
        const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

        return [relativePath, `sha256-${digest}`]
      })
  )
}

function createManifest({ app, appId, args, artifactId, createdAt, gitSha, outRoot }) {
  return {
    schemaVersion: 1,
    appId,
    artifactType: app.artifactType,
    artifactId,
    gitSha,
    sourceRepo: args['source-repo'] ?? app.sourceRepo,
    platformCompatibility: { minPageFlyAppPlatform: '0.1.0' },
    build: {
      node: process.versions.node,
      npm: process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] ?? 'unknown',
      command: app.buildCommand,
    },
    entrypoints: { manifest: app.entryManifest },
    checksums: createChecksums(outRoot),
    createdAt,
  }
}

function packageArtifact(argv) {
  const args = parseArgs(argv)
  const appId = args.app
  const app = apps[appId]

  if (!app) {
    throw new Error(`Unsupported app-platform app for admin artifact packaging: ${appId}`)
  }

  const sourceAdminRoot = path.resolve(repoRoot, args['source-admin-root'] ?? app.sourceAdminRoot)
  const sourceFontsRoot = path.resolve(repoRoot, args['source-fonts-root'] ?? app.sourceFontsRoot)
  const outRoot = path.resolve(repoRoot, args.out ?? `artifacts/${appId}-admin-static`)
  const sourceCopiedRoutesRoot = path.join(sourceAdminRoot, 'copied-routes')
  const sourceManifestPath = path.join(sourceCopiedRoutesRoot, 'manifest.json')
  const createdAt = args['created-at'] ?? new Date().toISOString()
  const gitSha = args['git-sha'] ?? getGitSha()
  const artifactId = args['artifact-id'] ?? createArtifactId(appId, gitSha, createdAt)

  if (!fs.existsSync(sourceCopiedRoutesRoot)) {
    throw new Error(`TailorKit admin copied-routes assets are missing at ${sourceCopiedRoutesRoot}. Run build:copied-routes-runtime first.`)
  }

  if (!fs.existsSync(sourceManifestPath)) {
    throw new Error(`TailorKit admin copied-routes manifest is missing at ${sourceManifestPath}.`)
  }

  fs.rmSync(outRoot, { recursive: true, force: true })
  fs.mkdirSync(path.join(outRoot, 'admin'), { recursive: true })
  fs.cpSync(sourceCopiedRoutesRoot, path.join(outRoot, 'admin/copied-routes'), { recursive: true })

  if (fs.existsSync(sourceFontsRoot)) {
    fs.cpSync(sourceFontsRoot, path.join(outRoot, 'fonts'), { recursive: true })
  }

  validateCopiedRoutesManifest(outRoot, app.entryManifest)
  fs.writeFileSync(
    path.join(outRoot, 'artifact-manifest.json'),
    `${JSON.stringify(createManifest({ app, appId, args, artifactId, createdAt, gitSha, outRoot }), null, 2)}\n`
  )
  process.stdout.write(`${outRoot}\n`)
}

try {
  packageArtifact(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
