import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

async function getUser(auth?: string) {
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.substring(7)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

async function verifySessionOwnership(sessionId: string, userId: string) {
  const { data, error } = await supabase.from('rp_session').select('id').eq('id', sessionId).eq('user_id', userId).maybeSingle()
  if (error || !data) throw new Error('Session not found')
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request.headers.get('authorization'))
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    if (!sessionId) return NextResponse.json({ success: false, message: 'session_id is required' }, { status: 400 })
    await verifySessionOwnership(sessionId, user.id)
    const { data, error } = await supabase.from('rp_turn').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(limit)
    if (error) return NextResponse.json({ success: false, message: 'Failed to fetch turns' }, { status: 500 })
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request.headers.get('authorization'))
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })
    const body = await request.json()
    const { session_id, speaker, content, character_id, language } = body
    if (!session_id || !speaker || !content || !character_id || !language) return NextResponse.json({ success: false, message: 'Missing required fields: session_id, speaker, content, character_id, language' }, { status: 400 })
    if (!['user', 'ai'].includes(speaker)) return NextResponse.json({ success: false, message: 'Invalid speaker' }, { status: 400 })
    if (!['tamil', 'thanglish'].includes(language)) return NextResponse.json({ success: false, message: 'Invalid language' }, { status: 400 })
    await verifySessionOwnership(session_id, user.id)
    const { data: character } = await supabase.from('rp_character').select('id').eq('id', character_id).eq('session_id', session_id).maybeSingle()
    if (!character) return NextResponse.json({ success: false, message: 'Character not found for session' }, { status: 400 })
    const { data, error } = await supabase.from('rp_turn').insert({ session_id, character_id, speaker, content, language }).select('*').single()
    if (error || !data) return NextResponse.json({ success: false, message: 'Failed to save turn' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}

