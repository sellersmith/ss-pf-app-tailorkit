/**
 * Jira issue creation for Elva feature request pipeline.
 * Creates issues in TK project via Jira REST API.
 * Standalone helper — no MCP dependency (MCP is for Claude Code sessions only).
 */

const JIRA_API_URL = process.env.JIRA_API_URL || 'https://bravebits.jira.com'
const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN
const JIRA_PROJECT_KEY = 'EMTLKIT'

interface JiraIssueResult {
  success: boolean
  key?: string
  error?: string
}

/** Create a Jira issue for a merchant feature request */
export async function createJiraFeatureRequest(args: {
  title: string
  description: string
  category: 'feature_request' | 'bug_report' | 'improvement'
  shopDomain: string
  conversationId?: string
}): Promise<JiraIssueResult> {
  if (!JIRA_USERNAME || !JIRA_API_TOKEN) {
    return { success: false, error: 'Jira credentials not configured' }
  }

  const issueType = args.category === 'bug_report' ? 'Bug' : 'Story'
  const labels = ['merchant-request', 'elva-generated', args.category.replace('_', '-')]

  const descriptionLines = [
    `h2. Merchant Request`,
    ``,
    args.description,
    ``,
    `h2. Context`,
    `* *Shop:* ${args.shopDomain}`,
    `* *Source:* Elva AI Chat`,
    `* *Category:* ${args.category.replace('_', ' ')}`,
    args.conversationId ? `* *Conversation:* ${args.conversationId}` : '',
    `* *Submitted:* ${new Date().toISOString()}`,
  ]

  const body = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: `[Elva AI] ${args.title}`,
      issuetype: { name: issueType },
      description: descriptionLines.filter(Boolean).join('\n'),
      labels,
    },
  }

  try {
    const auth = Buffer.from(`${JIRA_USERNAME}:${JIRA_API_TOKEN}`).toString('base64')
    const response = await fetch(`${JIRA_API_URL}/rest/api/2/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Jira] Issue creation failed:', errText)
      return { success: false, error: `Jira API error: ${response.status}` }
    }

    const data = (await response.json()) as { key: string }
    return { success: true, key: data.key }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Jira] Issue creation error:', message)
    return { success: false, error: message }
  }
}
