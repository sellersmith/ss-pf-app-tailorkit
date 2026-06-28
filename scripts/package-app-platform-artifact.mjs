import crypto from 'crypto'
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import process from 'process'
import ts from 'typescript'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repoRoot, 'apps/tailorkit')
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const appPackageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
const appId = 'tailorkit'
const appName = 'ss-pf-app-tailorkit'

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
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

function safePath(relativePath) {
  const normalized = path.posix.normalize(relativePath)

  if (!relativePath || path.isAbsolute(relativePath) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Invalid artifact path: ${relativePath}`)
  }

  return normalized
}

function walkFiles(rootDir, currentDir = rootDir) {
  if (!fs.existsSync(currentDir)) return []

  return fs.readdirSync(currentDir, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) return walkFiles(rootDir, filePath)

    return entry.isFile() ? [path.relative(rootDir, filePath).split(path.sep).join('/')] : []
  })
}

function copyDirectoryIfExists(fromRoot, toRoot) {
  if (!fs.existsSync(fromRoot)) return false

  fs.mkdirSync(path.dirname(toRoot), { recursive: true })
  fs.cpSync(fromRoot, toRoot, { recursive: true })
  return true
}

function collectManifestAssets(manifest, entryKey, visited = new Set()) {
  if (visited.has(entryKey)) return []
  visited.add(entryKey)

  const entry = manifest[entryKey]
  if (!entry || typeof entry !== 'object') return []

  const assets = [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])].filter(Boolean)

  for (const importKey of entry.imports ?? []) {
    assets.push(...collectManifestAssets(manifest, importKey, visited))
  }

  return assets
}

function validateAdminManifest(artifactRoot, manifestRelativePath) {
  const manifestPath = path.join(artifactRoot, safePath(manifestRelativePath))
  const manifestRoot = path.dirname(manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  for (const entryKey of Object.keys(manifest)) {
    for (const assetPath of collectManifestAssets(manifest, entryKey)) {
      const fullPath = path.join(manifestRoot, safePath(assetPath))

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Admin manifest references missing asset: ${assetPath}`)
      }
    }
  }
}

function transpileFile(sourceRoot, outputRoot, relativePath) {
  const sourcePath = path.join(sourceRoot, relativePath)
  const outputRelativePath = relativePath.replace(/\.(?:tsx?|jsx?)$/, '.js')
  const outputPath = path.join(outputRoot, outputRelativePath)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  if (!/\.(?:tsx?|jsx?)$/.test(relativePath) || /\.d\.ts$/.test(relativePath)) {
    fs.copyFileSync(sourcePath, outputPath)
    return
  }

  const source = fs.readFileSync(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
    fileName: sourcePath,
  }).outputText

  fs.writeFileSync(outputPath, output)
}

function transpileDirectory(sourceRoot, outputRoot) {
  for (const relativePath of walkFiles(sourceRoot)) {
    transpileFile(sourceRoot, outputRoot, relativePath)
  }
}

function createChecksums(artifactRoot) {
  return Object.fromEntries(
    walkFiles(artifactRoot)
      .filter(relativePath => !['artifact.json', 'checksums.sha256'].includes(relativePath))
      .sort()
      .map(relativePath => {
        const filePath = path.join(artifactRoot, relativePath)
        const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

        return [relativePath, `sha256-${digest}`]
      })
  )
}

function writeChecksumsFile(artifactRoot, checksums) {
  const lines = Object.entries(checksums)
    .map(([relativePath, digest]) => `${digest.replace('sha256-', '')}  ${relativePath}`)
    .join('\n')

  fs.writeFileSync(path.join(artifactRoot, 'checksums.sha256'), `${lines}\n`)
}

function createTarball(artifactRoot, tarballPath) {
  fs.rmSync(tarballPath, { force: true })
  const result = spawnSync('tar', ['-czf', tarballPath, '-C', artifactRoot, '.'], { stdio: 'inherit' })

  if (result.status !== 0) {
    throw new Error(`Failed to create artifact tarball at ${tarballPath}`)
  }

  const digest = crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex')
  fs.writeFileSync(`${tarballPath}.sha256`, `${digest}  ${path.basename(tarballPath)}\n`)
  return digest
}

function writeReleaseMetadata(tarballPath, artifact, sha256) {
  const fileName = path.basename(tarballPath)
  const metadata = {
    environment: null,
    appId: artifact.appId,
    artifactType: artifact.artifactType,
    version: artifact.version,
    sourceRepo: artifact.sourceRepo,
    gitSha: artifact.gitSha,
    artifactFile: fileName,
    checksumFile: `${fileName}.sha256`,
    sha256,
    releaseTag: `${artifact.appId}-v${artifact.version}`,
    githubReleaseUrl: `https://github.com/${artifact.sourceRepo}/releases/download/${artifact.appId}-v${artifact.version}/${fileName}`,
    pageflyConfig: {
      version: artifact.version,
      url: `https://github.com/${artifact.sourceRepo}/releases/download/${artifact.appId}-v${artifact.version}/${fileName}`,
      sha256,
    },
    createdAt: artifact.createdAt,
  }

  fs.writeFileSync(`${tarballPath}.release.json`, `${JSON.stringify(metadata, null, 2)}\n`)
}

function packageArtifact(argv) {
  const args = parseArgs(argv)
  const version = args.version ?? appPackageJson.version ?? rootPackageJson.version
  const createdAt = args['created-at'] ?? new Date().toISOString()
  const gitSha = args['git-sha'] ?? getGitSha()
  const outDir = path.resolve(repoRoot, args.out ?? `dist/artifacts/${appName}-${version}`)
  const tarballPath = path.resolve(repoRoot, args.tarball ?? `dist/artifacts/${appName}-${version}.tgz`)
  const adminManifest = 'admin/runtime/manifest.json'
  const copiedRoutesManifest = 'admin/copied-routes/manifest.json'

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  const sourceAdminRuntimeRoot = path.join(appRoot, 'dist/admin/runtime')
  if (!copyDirectoryIfExists(sourceAdminRuntimeRoot, path.join(outDir, 'admin/runtime'))) {
    throw new Error(`TailorKit admin runtime assets are missing at ${sourceAdminRuntimeRoot}. Run build:admin-runtime first.`)
  }

  const sourceCopiedRoutesRoot = path.join(appRoot, 'dist/admin/copied-routes')
  if (!copyDirectoryIfExists(sourceCopiedRoutesRoot, path.join(outDir, 'admin/copied-routes'))) {
    throw new Error(`TailorKit admin assets are missing at ${sourceCopiedRoutesRoot}. Run build:copied-routes-runtime first.`)
  }

  copyDirectoryIfExists(path.join(appRoot, 'upstream/tailorkit-app/public/fonts'), path.join(outDir, 'fonts'))
  transpileDirectory(path.join(appRoot, 'src/backend'), path.join(outDir, 'server/src/backend'))
  transpileDirectory(path.join(appRoot, 'src/domain'), path.join(outDir, 'server/src/domain'))
  transpileDirectory(path.join(appRoot, 'src/storefront'), path.join(outDir, 'server/src/storefront'))
  transpileFile(appRoot, path.join(outDir, 'server'), 'manifest.ts')
  transpileFile(path.join(appRoot, 'theme-extension'), path.join(outDir, 'theme-extension'), 'theme-surfaces.ts')
  fs.writeFileSync(path.join(outDir, 'server/plugin.js'), "module.exports = require('./src/backend/plugin.js')\n")

  const pluginPath = 'server/plugin.js'
  validateAdminManifest(outDir, adminManifest)
  validateAdminManifest(outDir, copiedRoutesManifest)

  const checksums = createChecksums(outDir)
  const artifact = {
    contractVersion: 1,
    appId,
    artifactType: 'app-platform',
    version,
    gitSha,
    sourceRepo: 'sellersmith/ss-pf-app-tailorkit',
    platformCompatibility: { minPageFlyAppPlatform: '0.1.0' },
    admin: {
      manifest: adminManifest,
      entrySource: 'src/admin/runtime-entry.tsx',
      copiedRoutesManifest,
    },
    server: { plugin: pluginPath },
    themeExtension: { surfaces: 'theme-extension/theme-surfaces.js' },
    build: {
      node: process.versions.node,
      npm: process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] ?? 'unknown',
      command: 'npm run build:artifact',
    },
    checksums,
    createdAt,
  }

  fs.writeFileSync(path.join(outDir, 'artifact.json'), `${JSON.stringify(artifact, null, 2)}\n`)
  writeChecksumsFile(outDir, checksums)
  const tarballSha256 = createTarball(outDir, tarballPath)
  writeReleaseMetadata(tarballPath, artifact, tarballSha256)
  process.stdout.write(`${tarballPath}\n`)
}

try {
  packageArtifact(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
