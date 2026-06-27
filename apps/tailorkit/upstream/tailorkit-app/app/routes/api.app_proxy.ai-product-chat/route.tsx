import { type ActionFunctionArgs } from '@remix-run/node'
import OpenAI from 'openai'
import { getOptionSetsRecommendations } from '~/services/ai-agent/option-sets-agent'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { catchAsync } from '~/utils/catchAsync'

// Validate OpenAI API key at startup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  // Comprehensive file logging for debugging
  const timestamp = new Date().toISOString()

  // ALWAYS log that we received a request, regardless of source
  try {
    console.log(`=== ${timestamp} ===`)
    console.log('🚀 APP PROXY AI Product Chat endpoint hit!')
    console.log('📍 Request method:', request.method)
    console.log('📍 Request URL:', request.url)
    console.log('📍 User-Agent:', request.headers.get('user-agent') || 'unknown')
    console.log('📍 Origin:', request.headers.get('origin') || 'unknown')
    console.log('📍 Referer:', request.headers.get('referer') || 'unknown')
  } catch (e) {
    // Ignore file write errors
  }

  console.log('🚀 APP PROXY AI Product Chat endpoint hit!')
  console.log('📍 Request method:', request.method)
  console.log('📍 Request URL:', request.url)

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS request')
    return new Response(null, { status: 200, headers })
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    console.log('❌ Invalid method:', request.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  // Validate request size for POST requests
  if (request.method === 'POST') {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      // 1MB limit
      return new Response(JSON.stringify({ error: 'Request too large' }), { status: 413, headers })
    }
  }

  try {
    // Authenticate app proxy request
    const { session } = await authenticateAppProxy(request)
    console.log('✅ App Proxy Authentication Success - Shop:', session.shop)

    try {
      console.log(`✅ App Proxy Authentication Success - Shop: ${session.shop}`)
    } catch (e) {}

    // Get parameters from URL query string (GET) or JSON body (POST)
    const url = new URL(request.url)
    let message: string | null = null
    let templateId: string | null = null
    let useAgent: boolean = false
    let testMode: boolean = false
    let conversationHistory: any[] = []

    if (request.method === 'POST') {
      // Parse JSON body for POST requests
      try {
        const body = await request.json()
        message = body.message || null
        templateId = body.templateId || null
        useAgent = body.useAgent === true
        testMode = body.testMode === true
        conversationHistory = body.conversationHistory || []

        // Validate and sanitize inputs
        if (message && typeof message === 'string') {
          message = message.trim()
          if (message.length > 1000) {
            // Limit message length
            return new Response(JSON.stringify({ error: 'Message too long (max 1000 characters)' }), {
              status: 400,
              headers,
            })
          }
        }

        if (templateId && typeof templateId === 'string') {
          templateId = templateId.trim()
          if (templateId.length > 100) {
            // Limit templateId length
            return new Response(JSON.stringify({ error: 'Template ID too long' }), { status: 400, headers })
          }
        }

        // Validate conversation history
        if (Array.isArray(conversationHistory)) {
          conversationHistory = conversationHistory.slice(0, 10) // Limit to last 10 messages
        } else {
          conversationHistory = []
        }

        console.log('📨 POST request body parsed:', {
          message: message ? `"${message.substring(0, 50)}..."` : 'undefined',
          templateId,
          testMode,
          useAgent,
          conversationHistoryLength: conversationHistory.length,
        })
      } catch (parseError) {
        console.error('❌ Failed to parse POST body:', parseError)
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers })
      }
    } else {
      // Parse query parameters for GET requests
      message = url.searchParams.get('message')
      templateId = url.searchParams.get('templateId')
      useAgent = url.searchParams.get('useAgent') === 'true'
      testMode = url.searchParams.get('testMode') === 'true'

      // Validate and sanitize GET inputs
      if (message && typeof message === 'string') {
        message = message.trim()
        if (message.length > 1000) {
          return new Response(JSON.stringify({ error: 'Message too long (max 1000 characters)' }), {
            status: 400,
            headers,
          })
        }
      }

      if (templateId && typeof templateId === 'string') {
        templateId = templateId.trim()
        if (templateId.length > 100) {
          return new Response(JSON.stringify({ error: 'Template ID too long' }), { status: 400, headers })
        }
      }
    }

    console.log('🔍 Debug - Parsed request data:', {
      message: message ? `"${message.substring(0, 50)}..."` : 'undefined',
      templateId,
      testMode,
      useAgent,
    })

    // Log to file
    try {
      console.log(
        `🔍 Debug - Parsed request data: ${JSON.stringify({
          message: message ? `"${message.substring(0, 50)}..."` : 'undefined',
          templateId,
          testMode,
          useAgent,
        })}`
      )
    } catch (e) {}

    // Handle test mode - simple response without OpenAI
    if (testMode === true) {
      console.log('🧪 Test mode activated in ai-product-chat endpoint')
      console.log('📦 Received data:', { message, templateId, testMode })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'AI Product Chat endpoint test mode is working!',
          method: request.method,
          receivedData: { message, templateId, testMode, conversationHistory },
          timestamp: new Date().toISOString(),
          testMode: true,
        }),
        { headers }
      )
    }

    // Use OpenAI Agent if templateId is provided and useAgent is true
    console.log('🔍 Debug - Checking agent conditions:', {
      templateId: !!templateId,
      useAgent,
      useAgentStrict: useAgent === true,
    })
    console.log('🔍 Debug - useAgent type:', typeof useAgent)
    console.log('🔍 Debug - useAgent value:', useAgent)
    console.log('🔍 Debug - templateId value:', templateId)

    // Log to file
    try {
      console.log(
        `🔍 Debug - Agent conditions: templateId=${!!templateId}, useAgent=${useAgent}, type=${typeof useAgent}`
      )
    } catch (e) {}

    if (!templateId) {
      console.log('❌ No templateId provided, returning error')
      try {
        console.log('❌ No templateId provided, returning error')
      } catch (e) {}
      return new Response(JSON.stringify({ error: 'Template ID is required' }), { status: 400, headers })
    }

    if (templateId && useAgent === true) {
      console.log('✅ Agent conditions met - proceeding with agent')
      console.log('🤖 Using OptionSets Agent for personalization recommendations')

      try {
        console.log('✅ Agent conditions met - proceeding with agent')
      } catch (e) {}

      try {
        // Use the authenticated shop domain from the session
        const shopDomain = session.shop

        console.log('🚀 Calling OptionSets Agent...')
        console.log(`📋 Template ID: ${templateId}`)
        console.log(`🏪 Shop Domain: ${shopDomain}`)
        console.log(`💬 User Message: ${message}`)

        try {
          console.log(`🚀 Calling OptionSets Agent with templateId=${templateId}, shopDomain=${shopDomain}`)
        } catch (e) {}

        if (!shopDomain) {
          return new Response(JSON.stringify({ error: 'Shop domain is required' }), { status: 400, headers })
        }

        if (!message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers })
        }

        // Use the existing option-sets-agent service
        console.log('🔧 About to call getOptionSetsRecommendations...')
        try {
          console.log('🔧 About to call getOptionSetsRecommendations...')
        } catch (e) {}

        const agentResponse = await getOptionSetsRecommendations(templateId, shopDomain, message)

        console.log('✅ OptionSets Agent response received')
        console.log('📊 Agent response:', agentResponse)

        try {
          console.log(`✅ OptionSets Agent response received: ${JSON.stringify(agentResponse)}`)
        } catch (e) {}

        return new Response(
          JSON.stringify({
            response: agentResponse,
            agentMode: true,
            templateId: templateId,
            shopDomain: shopDomain,
          }),
          { headers }
        )
      } catch (agentError: any) {
        console.error('❌ OptionSets Agent error:', agentError.message)
        console.error('❌ Full error:', agentError)
        console.error('❌ Error stack:', agentError.stack)

        try {
          console.log(`❌ OptionSets Agent error: ${agentError.message}`)
          console.log(`❌ Error stack: ${agentError.stack}`)
        } catch (e) {}

        // Fallback to regular OpenAI if agent fails
        console.log('🔄 Falling back to regular OpenAI chat')
        try {
          console.log('🔄 Falling back to regular OpenAI chat')
        } catch (e) {}
        // Don't return here - let it fall through to regular OpenAI
      }
    } else {
      console.log('❌ Agent conditions NOT met')
      console.log('❌ templateId exists:', !!templateId)
      console.log('❌ useAgent === true:', useAgent === true)
      console.log('❌ Proceeding with regular OpenAI chat')
    }

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers })
    }

    // Regular OpenAI fallback (simplified version)
    console.log('🔄 Using regular OpenAI chat')

    // Prepare messages array with conversation history if available
    const messages = [
      {
        role: 'system' as const,
        content: `You are an AI assistant for TailorKit product personalization. 
          Help users create custom product designs by providing specific, actionable design advice.
          If they mention personalization preferences, suggest specific changes they can make to their product.`,
      },
      ...conversationHistory,
      {
        role: 'user' as const,
        content: message,
      },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      throw new Error('No response from OpenAI')
    }

    return new Response(JSON.stringify({ response }), { headers })
  } catch (authError: any) {
    console.error('❌ App Proxy Authentication Failed:', authError)
    try {
      console.log(`❌ App Proxy Authentication Failed: ${authError.message}`)
    } catch (e) {}

    return new Response(
      JSON.stringify({
        error: 'Authentication failed',
        details: authError.message,
      }),
      {
        status: 401,
        headers,
      }
    )
  }
})
