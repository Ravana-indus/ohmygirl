import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { createGrokClient, createStoryPrompt, extractStreamContent, isStreamComplete } from '@/lib/grok-api'
import { estimateTokens, estimateCost } from '@/lib/token-estimation'
import { MICROCREDITS_PER_LKR } from '@/lib/constants'
import { getUserPlanEntitlements } from '@/lib/server/entitlements'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

async function getBlueprint(blueprintId: string, userId: string) {
  const { data, error } = await supabase.from('story_blueprint').select('*').eq('id', blueprintId).eq('user_id', userId).single()
  if (error || !data) throw new Error('Story blueprint not found or not accessible')
  return data
}

async function holdEscrow(userId: string, microcredits: number, requestId: string) {
  let { data: wallet } = await supabase.from('wallet').select('balance_microcredits').eq('user_id', userId).maybeSingle()
  if (!wallet) {
    const created = await supabase.from('wallet').insert({ user_id: userId, balance_microcredits: 0 }).select('balance_microcredits').single()
    wallet = created.data || { balance_microcredits: 0 }
  }
  const original = wallet.balance_microcredits
  const next = original - microcredits
  if (next < 0) throw new Error('Insufficient credits for escrow')
  const { error: upErr } = await supabase.from('wallet').update({ balance_microcredits: next, updated_at: new Date().toISOString() }).eq('user_id', userId)
  if (upErr) throw new Error('Failed to hold escrow')
  const { error: txnErr } = await supabase.from('wallet_txn').insert({ user_id: userId, kind: 'escrow_hold', amount_microcredits: -microcredits, balance_microcredits: next, request_id: requestId, note: `Escrow hold for story generation ${requestId}` })
  if (txnErr) {
    await supabase.from('wallet').update({ balance_microcredits: original, updated_at: new Date().toISOString() }).eq('user_id', userId)
    throw new Error('Failed to create escrow transaction')
  }
}

async function refundEscrow(userId: string, microcredits: number, requestId: string) {
  const { data: wallet } = await supabase.from('wallet').select('balance_microcredits').eq('user_id', userId).single()
  if (!wallet) return
  const next = wallet.balance_microcredits + microcredits
  await supabase.from('wallet').update({ balance_microcredits: next, updated_at: new Date().toISOString() }).eq('user_id', userId)
  await supabase.from('wallet_txn').insert({ user_id: userId, kind: 'escrow_release', amount_microcredits: microcredits, balance_microcredits: next, request_id, note: `Escrow refund for failed story generation ${requestId}` })
}

export async function POST(request: NextRequest) {
  let requestId = ''
  let held = 0
  let userId: string | null = null
  try {
    const body = await request.json()
    const { blueprint_id, max_tokens } = body
    if (!blueprint_id) return NextResponse.json({ success: false, message: 'Missing blueprint_id' }, { status: 400 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })
    userId = user.id

    const blueprint = await getBlueprint(blueprint_id, user.id)
    const entitlements = await getUserPlanEntitlements(supabase, user.id)

    // Enforce model for stories
    const model_code = 'grok-4'
    // Pricing
    let { data: modelPrice } = await supabase.from('model_price').select('*').eq('code', model_code).maybeSingle()
    if (!modelPrice) {
      const fallback = await supabase.from('model_price').select('*').eq('code', 'grok-4-fast').maybeSingle()
      modelPrice = fallback.data
      if (!modelPrice) return NextResponse.json({ success: false, message: 'Invalid model code' }, { status: 400 })
    }

    const tokenEstimation = estimateTokens({ language: blueprint.language as 'tamil' | 'thanglish', readMinutes: blueprint.read_minutes, feature: 'story' })
    const costEstimation = estimateCost(tokenEstimation, modelPrice, 320, 20, MICROCREDITS_PER_LKR)

    requestId = uuidv4()
    await holdEscrow(user.id, costEstimation.estimatedMicrocredits, requestId)
    held = costEstimation.estimatedMicrocredits

    // stream
    const messages = createStoryPrompt({ language: blueprint.language, readMinutes: blueprint.read_minutes, situation: blueprint.situation, characters: blueprint.characters || [], relationships: blueprint.relationships || [], tone: blueprint.tone, maxTokens: max_tokens || modelPrice.max_output_tokens })
    const grok = createGrokClient()
    const stream = grok.chatStream({ model: model_code as any, messages, max_tokens: max_tokens || modelPrice.max_output_tokens, temperature: 0.7 })

    const encoder = new TextEncoder()
    const sse = new ReadableStream({
      async start(controller) {
        let fullContent = ''
        let inputTokens = 0
        let outputTokens = 0
        try {
          for await (const chunk of stream) {
            const content = extractStreamContent(chunk)
            if (content) {
              fullContent += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
            }
            if (isStreamComplete(chunk)) {
              if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens || 0; outputTokens = chunk.usage.completion_tokens || 0 }
              break
            }
          }
          // save output
          const insertPayload: any = { blueprint_id: blueprint_id, content: fullContent, language: blueprint.language, read_minutes: blueprint.read_minutes, input_tokens: inputTokens, output_tokens: outputTokens, categories: blueprint.tone ? [String(blueprint.tone)] : [] }
          await supabase.from('story_output').insert(insertPayload)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', content: fullContent })}\n\n`))
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Story generation failed' })}\n\n`))
        } finally { controller.close() }
      }
    })

    return new Response(sse, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Request-ID': requestId } })
  } catch (e: any) {
    if (held && userId && requestId) { try { await refundEscrow(userId, held, requestId) } catch {} }
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}
