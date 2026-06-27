import { json, type LoaderFunctionArgs } from '@remix-run/node'
import fs from 'node:fs/promises'
import path from 'node:path'

// Serves https://tailorkit.ecomate.co/flywheel/data.json
// Reads the latest snapshot file produced by the daily Mantle pull
// (see marketing/.claude/skills/flywheel/scripts/snapshot-writer.cjs).
//
// NOTE: file is baked into the Docker image at build time, so a redeploy
// is required to surface a new snapshot. Future iteration: fetch from S3
// or GitHub raw to skip the redeploy step.
const SNAPSHOT_PATH = path.resolve(process.cwd(), 'marketing/data/flywheel/current.json')

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const content = await fs.readFile(SNAPSHOT_PATH, 'utf-8')
    return json(JSON.parse(content), {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ _error: 'Flywheel snapshot unavailable', detail: message }, { status: 503 })
  }
}
