#!/usr/bin/env node
/**
 * Build script for feature modules
 *
 * Usage:
 *   node scripts/build-features.js                 # Build all features (one-shot)
 *   node scripts/build-features.js pinch-zoom      # Build a specific feature
 *   node scripts/build-features.js --watch         # Watch all features
 *   node scripts/build-features.js charm --watch   # Watch a specific feature
 *
 * NOTE on --watch: each feature is built in its own vite process because
 * vite.features.config.js compiles a single feature per invocation (FEATURE_NAME env).
 * Without this multi-process orchestration, only one feature would actually be watched
 * — which previously caused the charm-builder bundle to go stale while editor + konva
 * stayed fresh.
 */
import { spawn } from 'child_process'
import { features } from '../features.config.js'

const args = process.argv.slice(2)
const watchMode = args.includes('--watch')
const targetFeature = args.find(a => !a.startsWith('--'))

// Filter features to build
const featuresToBuild = targetFeature ? features.filter(f => f.name === targetFeature) : features

if (featuresToBuild.length === 0) {
  console.error(`Feature "${targetFeature}" not found.`)
  console.log('Available features:', features.map(f => f.name).join(', '))
  process.exit(1)
}

console.log(`${watchMode ? 'Watching' : 'Building'} ${featuresToBuild.length} feature(s)...`)

// Spawn one vite build per feature. Each writes to a unique output file with
// emptyOutDir: false, so parallel builds / watches do not stomp on each other.
async function buildFeature(feature) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 ${watchMode ? 'Watching' : 'Building'}: ${feature.name}`)

    const viteArgs = ['vite', 'build', '--config', 'vite.features.config.js']
    if (watchMode) viteArgs.push('--watch')

    const child = spawn('npx', viteArgs, {
      cwd: process.cwd(),
      env: { ...process.env, FEATURE_NAME: feature.name },
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', code => {
      if (code === 0) {
        console.log(`✅ ${feature.name} ${watchMode ? 'watcher exited' : 'built successfully'}`)
        resolve()
      } else {
        reject(new Error(`Failed to ${watchMode ? 'watch' : 'build'} ${feature.name}`))
      }
    })
  })
}

async function run() {
  await Promise.all(featuresToBuild.map(feature => buildFeature(feature)))
  if (!watchMode) console.log(`\n All features built successfully!`)
}

run().catch(err => {
  console.error(err.message)
  process.exit(1)
})
