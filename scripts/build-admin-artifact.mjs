import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tailorkitPackageJson = path.join(repoRoot, 'apps/tailorkit/package.json')

if (!fs.existsSync(tailorkitPackageJson)) {
  process.stderr.write(
    [
      'TailorKit source has not been migrated into this repo yet.',
      '',
      'Expected source layout:',
      '  apps/tailorkit/package.json',
      '  apps/tailorkit/dist/admin/copied-routes after build',
      '',
      'Until source migration lands, use this repo as the CI/CD contract skeleton.',
    ].join('\n')
  )
  process.stderr.write('\n')
  process.exit(1)
}

const result = spawnSync('npm', ['--workspace', '@pagefly/app-tailorkit', 'run', 'build:admin-artifact'], {
  cwd: repoRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)

