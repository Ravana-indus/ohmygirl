import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { output_id, publish = true } = body
    if (!output_id) return NextResponse.json({ success: false, message: 'Missing output_id' }, { status: 400 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = authHeader.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    const { data: output } = await supabase.from('story_output').select('id, blueprint_id').eq('id', output_id).maybeSingle()
    if (!output) return NextResponse.json({ success: false, message: 'Story output not found' }, { status: 404 })

    const { data: blueprint } = await supabase.from('story_blueprint').select('id, user_id').eq('id', output.blueprint_id).maybeSingle()
    if (!blueprint || blueprint.user_id !== user.id) return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 })

    const { data, error } = await supabase.from('story_output').update({ is_published: !!publish, updated_at: new Date().toISOString() }).eq('id', output_id).select('id, is_published').maybeSingle()
    if (error || !data) return NextResponse.json({ success: false, message: 'Failed to update publish status' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}

