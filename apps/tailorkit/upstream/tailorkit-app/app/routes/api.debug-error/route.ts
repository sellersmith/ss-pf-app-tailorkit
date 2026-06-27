import type { ActionFunctionArgs } from '@remix-run/node'
import { appendFileSync } from 'fs'

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.text()
    const timestamp = new Date().toISOString()
    const logLine = `\n[${timestamp}] ${body}\n`
    console.error('🐛 CLIENT ERROR:', logLine)
    appendFileSync('/tmp/tailorkit-client-errors.log', logLine)
  } catch (e) {
    // ignore
  }
  return new Response('ok', { status: 200 })
}
