import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]

    if (key === '--dry-run') {
      args['dry-run'] = true
      continue
    }

    const value = argv[index + 1]

    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Invalid argument pair: ${key ?? ''} ${value ?? ''}`.trim())
    }

    args[key.slice(2)] = value
    index += 1
  }

  return args
}

function resolveInputPath(value, name) {
  if (!value) {
    throw new Error(`Missing required --${name}`)
  }

  return path.resolve(repoRoot, value)
}

function readArtifactManifest(artifactRoot) {
  const manifestPath = path.join(artifactRoot, 'artifact-manifest.json')

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Artifact manifest is missing at ${manifestPath}`)
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

function assertSafeSegment(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child)

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return
  }

  throw new Error(`Refusing to write outside target app root: ${child}`)
}

function checksumFile(filePath) {
  return `sha256-${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`
}

function verifyChecksums(root, checksums) {
  for (const [relativePath, expected] of Object.entries(checksums ?? {})) {
    const normalized = path.posix.normalize(relativePath)

    if (path.isAbsolute(relativePath) || normalized.startsWith('../') || normalized === '..') {
      throw new Error(`Invalid checksum path: ${relativePath}`)
    }

    const filePath = path.join(root, normalized)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Checksum file is missing: ${relativePath}`)
    }

    const actual = checksumFile(filePath)

    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${relativePath}`)
    }
  }
}

function assertArtifact(manifest) {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported artifact schema version: ${manifest.schemaVersion}`)
  }

  if (manifest.appId !== 'tailorkit' || manifest.artifactType !== 'admin-static') {
    throw new Error(`Unsupported artifact: ${manifest.appId}/${manifest.artifactType}`)
  }

  assertSafeSegment(manifest.artifactId, 'artifactId')
}

function copyRelease(artifactRoot, releaseRoot) {
  const tmpReleaseRoot = `${releaseRoot}.tmp-${process.pid}`

  fs.rmSync(tmpReleaseRoot, { recursive: true, force: true })
  fs.cpSync(artifactRoot, tmpReleaseRoot, { recursive: true })
  fs.rmSync(releaseRoot, { recursive: true, force: true })
  fs.renameSync(tmpReleaseRoot, releaseRoot)
}

function promoteByCopy(releaseRoot, currentRoot) {
  const tmpCurrentRoot = `${currentRoot}.tmp-${process.pid}`

  fs.rmSync(tmpCurrentRoot, { recursive: true, force: true })
  fs.cpSync(releaseRoot, tmpCurrentRoot, { recursive: true })
  fs.rmSync(currentRoot, { recursive: true, force: true })
  fs.renameSync(tmpCurrentRoot, currentRoot)
}

function promoteBySymlink(releaseRoot, currentRoot, targetAppRoot) {
  const tmpCurrentRoot = `${currentRoot}.tmp-${process.pid}`
  const relativeReleaseRoot = path.relative(targetAppRoot, releaseRoot)

  fs.rmSync(tmpCurrentRoot, { recursive: true, force: true })
  fs.symlinkSync(relativeReleaseRoot, tmpCurrentRoot, 'dir')
  fs.rmSync(currentRoot, { recursive: true, force: true })
  fs.renameSync(tmpCurrentRoot, currentRoot)
}

function writeLedger(targetAppRoot, manifest, strategy) {
  const ledgerPath = path.join(targetAppRoot, 'releases/ledger.jsonl')
  const entry = {
    appId: manifest.appId,
    artifactId: manifest.artifactId,
    strategy,
    deployedAt: new Date().toISOString(),
  }

  fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`)
}

function deploy(argv) {
  const args = parseArgs(argv)
  const artifactRoot = resolveInputPath(args.artifact, 'artifact')
  const targetAppRoot = resolveInputPath(args['target-app-root'], 'target-app-root')
  const strategy = args.strategy ?? 'copy'
  const manifest = readArtifactManifest(artifactRoot)

  if (!['copy', 'symlink'].includes(strategy)) {
    throw new Error(`Unsupported promote strategy: ${strategy}`)
  }

  assertArtifact(manifest)
  verifyChecksums(artifactRoot, manifest.checksums)

  const releasesRoot = path.join(targetAppRoot, 'releases')
  const releaseRoot = path.join(releasesRoot, manifest.artifactId)
  const currentRoot = path.join(targetAppRoot, 'current')

  for (const target of [releasesRoot, releaseRoot, currentRoot]) {
    assertInside(targetAppRoot, target)
  }

  if (args['dry-run']) {
    process.stdout.write(JSON.stringify({ artifactId: manifest.artifactId, releaseRoot, currentRoot, strategy }, null, 2))
    process.stdout.write('\n')
    return
  }

  fs.mkdirSync(releasesRoot, { recursive: true })
  copyRelease(artifactRoot, releaseRoot)
  verifyChecksums(releaseRoot, manifest.checksums)

  if (strategy === 'symlink') {
    promoteBySymlink(releaseRoot, currentRoot, targetAppRoot)
  } else {
    promoteByCopy(releaseRoot, currentRoot)
  }

  verifyChecksums(currentRoot, manifest.checksums)
  writeLedger(targetAppRoot, manifest, strategy)
  process.stdout.write(`${currentRoot}\n`)
}

try {
  deploy(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
