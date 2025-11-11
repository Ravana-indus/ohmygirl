import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

export const runtime = 'edge'

async function holdEscrow(userId: string, microcredits: number, requestId: string) {
  let { data: wallet } = await supabase
    .from('wallet')
    .select('balance_microcredits')
    .eq('user_id', userId)
    .maybeSingle()
  if (!wallet) {
    const created = await supabase
      .from('wallet')
      .insert({ user_id: userId, balance_microcredits: 0 })
      .select('balance_microcredits')
      .single()
    wallet = created.data || { balance_microcredits: 0 }
  }
  const originalBalance = wallet.balance_microcredits
  const newBalance = originalBalance - microcredits
  if (newBalance < 0) throw new Error('Insufficient credits for escrow')
  const { error: updateError } = await supabase
    .from('wallet')
    .update({ balance_microcredits: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (updateError) throw new Error('Failed to hold escrow')
  const { error: txnError } = await supabase
    .from('wallet_txn')
    .insert({ user_id: userId, kind: 'escrow_hold', amount_microcredits: -microcredits, balance_microcredits: newBalance, request_id: requestId, note: `Escrow hold for request ${requestId}` })
  if (txnError) {
    await supabase.from('wallet').update({ balance_microcredits: originalBalance, updated_at: new Date().toISOString() }).eq('user_id', userId)
    throw new Error('Failed to create escrow transaction')
  }
}

async function refundEscrow(userId: string, microcredits: number, requestId: string) {
  const { data: wallet } = await supabase.from('wallet').select('balance_microcredits').eq('user_id', userId).single()
  if (!wallet) return
  const newBalance = wallet.balance_microcredits + microcredits
  await supabase.from('wallet').update({ balance_microcredits: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId)
  await supabase.from('wallet_txn').insert({ user_id: userId, kind: 'escrow_release', amount_microcredits: microcredits, balance_microcredits: newBalance, request_id: requestId, note: `Escrow refund for failed request ${requestId}` })
}

function buildRpPrompt(inputs: any) {
  const { language = 'tamil', category, intensity, user_character, ai_character, context = '', user_message } = inputs
  return `Role-Play Mode (WhatsApp chat simulation)
Language: ${language}
Category: ${category}
Intensity: ${intensity}
User Character: ${JSON.stringify(user_character)}
AI Character: ${JSON.stringify(ai_character)}
Conversation Context (recent WhatsApp-like messages):
${context || '(no prior history)'}

You are chatting inside a private WhatsApp thread. Write replies exactly like short, natural WhatsApp texts:
- Keep messages punchy, affectionate, and flirty but avoid explicit phone-sex narration.
- Use casual sentence fragments, emojis, or playful pauses just like real texting.
- Never describe physical actions in detail; focus on emotional beats, tone, and light teasing.
- Mix Tamil and Thanglish naturally if the language indicates it, but keep it readable.
- Stay strictly in character as ${ai_character?.name ?? 'AI partner'}.
- Reference details from the ongoing conversation to make it feel continuous.

Current user message: ${user_message}

Reply with only the AI’s WhatsApp-style response (no stage directions or explanations).`
}

async function callGrok(prompt: string, modelCode: string, maxTokens: number) {
  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelCode, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, stream: true, temperature: 0.7 })
  })
  if (!response.ok) throw new Error(`Grok API error: ${response.status}`)
  return response
}

export async function POST(request: NextRequest) {
  let requestId = ''
  let held = 0
  let userId: string | null = null
  try {
    const body = await request.json()
    const { feature, model_code = 'grok-4-fast', prompt_inputs, max_tokens = 800 } = body || {}
    if (!feature || !prompt_inputs) return NextResponse.json({ request_id: '', status: 'error', message: 'Missing required fields' }, { status: 400 })

    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ request_id: '', status: 'error', message: 'Missing authorization header' }, { status: 401 })
    const token = auth.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ request_id: '', status: 'error', message: 'Invalid authentication' }, { status: 401 })
    userId = user.id

    // Pricing: try model_code, fallback to grok-4-fast
    let { data: modelPrice } = await supabase.from('model_price').select('*').eq('code', model_code).maybeSingle()
    if (!modelPrice) {
      const fallback = await supabase.from('model_price').select('*').eq('code', 'grok-4-fast').maybeSingle()
      modelPrice = fallback.data
      if (!modelPrice) return NextResponse.json({ request_id: '', status: 'error', message: 'Invalid model code' }, { status: 400 })
    }
    const estimatedTokens = max_tokens
    const estimatedCostUSD = (estimatedTokens / 1_000_000) * modelPrice.output_ppm_usd
    const estimatedCostLKR = estimatedCostUSD * 320
    const requiredMicrocredits = Math.ceil(estimatedCostLKR * 1_000_000)

    requestId = uuidv4()
    await holdEscrow(user.id, requiredMicrocredits, requestId)
    held = requiredMicrocredits

    // Create usage event (estimate)
    await supabase.from('usage_event').insert({ id: requestId, user_id: user.id, feature, model_code, input_tokens: Math.floor(estimatedTokens * 0.3), output_tokens: Math.floor(estimatedTokens * 0.7), cost_usd: 0, price_lkr: 0, request_id: requestId, status: 'ok' })

    if (feature === 'rp') {
      const prompt = buildRpPrompt(prompt_inputs)
      const streamRes = await callGrok(prompt, model_code, max_tokens)
      return new Response(streamRes.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Request-ID': requestId } })
    }

    return NextResponse.json({ request_id: requestId, status: 'error', message: 'Unsupported feature' }, { status: 400 })
  } catch (e: any) {
    if (held && userId && requestId) { try { await refundEscrow(userId, held, requestId) } catch {} }
    return NextResponse.json({ request_id: requestId || '', status: 'error', message: e?.message || 'Internal server error' }, { status: 500 })
  }
}
