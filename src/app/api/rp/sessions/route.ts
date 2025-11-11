import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

async function getUser(userToken?: string) {
  if (!userToken) return null
  const { data: { user } } = await supabase.auth.getUser(userToken)
  return user
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const user = await getUser(auth.substring(7))
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    const { data: sessions, error } = await supabase
      .from('rp_session')
      .select('id, title, language, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, message: 'Failed to fetch sessions' }, { status: 500 })

    const ids = (sessions || []).map(s => s.id)
    const { data: chars } = await supabase.from('rp_character').select('id, session_id, name, role, traits').in('session_id', ids)
    const bySession: Record<string, any[]> = {}
    ;(chars || []).forEach(c => {
      bySession[c.session_id] = bySession[c.session_id] || []
      bySession[c.session_id].push({ id: c.id, name: c.name, role: c.role, traits: c.traits || {} })
    })
    const response = (sessions || []).map(s => ({ id: s.id, title: s.title, language: s.language, active: s.is_active, created_at: s.created_at, characters: bySession[s.id] || [] }))
    return NextResponse.json({ success: true, data: response })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, language, user_character, ai_character } = body
    if (!language || !user_character || !ai_character) return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const user = await getUser(auth.substring(7))
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    const { data: session, error: sErr } = await supabase
      .from('rp_session')
      .insert({ user_id: user.id, title: title || `${user_character.name} & ${ai_character.name}`, language, category_slug: 'romance', intensity: 3 })
      .select('*')
      .single()
    if (sErr || !session) return NextResponse.json({ success: false, message: 'Failed to create session' }, { status: 500 })

    const userTraits = { ...(user_character.traits || {}), ...(user_character.gender ? { gender: user_character.gender } : {}) }
    const aiTraits = { ...(ai_character.traits || {}), ...(ai_character.gender ? { gender: ai_character.gender } : {}) }

    const { error: cErr1 } = await supabase.from('rp_character').insert({ session_id: session.id, name: user_character.name, role: 'user', traits: userTraits })
    if (cErr1) return NextResponse.json({ success: false, message: 'Failed to create user character' }, { status: 500 })
    const { error: cErr2 } = await supabase.from('rp_character').insert({ session_id: session.id, name: ai_character.name, role: 'ai', traits: aiTraits })
    if (cErr2) return NextResponse.json({ success: false, message: 'Failed to create AI character' }, { status: 500 })

    return NextResponse.json({ success: true, data: { id: session.id, title: session.title, language: session.language, active: session.is_active, created_at: session.created_at } })
  } catch (e: any) { return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 }) }
}

