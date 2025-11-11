import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlanEntitlements } from '@/lib/server/entitlements'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

function containsUnsafeContent(situation: string, characters: any[], relationships: any[]): boolean {
  const text = `${situation} ${JSON.stringify(characters)} ${JSON.stringify(relationships)}`
  const disallowed = [/\bminor(s)?\b/i, /\bchild(ren)?\b/i, /under\s*age|underage/i, /incest|step-(?:mom|mother|dad|father|sister|brother)/i, /rape|non\s*-?consent|nonconsensual|coercion/i, /bestiality|animal sex/i]
  return disallowed.some((re) => re.test(text))
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = authHeader.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })
    const { data, error } = await supabase.from('story_blueprint').select('*, story_output(id, created_at)').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, message: 'Failed to fetch story blueprints' }, { status: 500 })
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { situation, phase, read_minutes, language, tone, characters = [], relationships = [] } = body
    if (!situation || !read_minutes || !language || !tone) return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    const effectivePhase = (['setup','conflict','twist','climax','resolution'].includes(phase) ? phase : 'setup') as 'setup' | 'conflict' | 'twist' | 'climax' | 'resolution'
    if (!['tamil','thanglish'].includes(language)) return NextResponse.json({ success: false, message: 'Invalid language' }, { status: 400 })
    if (containsUnsafeContent(situation, characters, relationships)) return NextResponse.json({ success: false, message: 'Content contains unsafe elements' }, { status: 400 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = authHeader.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    const entitlements = await getUserPlanEntitlements(supabase, user.id)
    // Daily limits: only enforce when > 0
    const today = new Date().toISOString().split('T')[0]
    const { data: usage } = await supabase.from('usage_event').select('id').eq('user_id', user.id).eq('feature', 'story').gte('created_at', today).eq('status', 'ok')
    const dailyCount = usage?.length || 0
    const maxDaily = entitlements.entitlements.max_story_per_day
    if (typeof maxDaily === 'number' && maxDaily > 0 && dailyCount >= maxDaily) return NextResponse.json({ success: false, message: `Daily story limit exceeded: ${dailyCount}/${maxDaily}` }, { status: 429 })

    const { data: blueprint, error } = await supabase.from('story_blueprint').insert({ user_id: user.id, situation, phase: effectivePhase, read_minutes, language, tone, characters, relationships }).select('*').single()
    if (error || !blueprint) return NextResponse.json({ success: false, message: 'Failed to create story blueprint' }, { status: 500 })
    return NextResponse.json({ success: true, blueprint_id: blueprint.id })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}
