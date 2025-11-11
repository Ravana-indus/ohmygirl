import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { output_id } = await request.json()
    if (!output_id) return NextResponse.json({ success: false, message: 'Missing output_id' }, { status: 400 })
    const { data } = await supabase.from('story_output').select('views_count').eq('id', output_id).maybeSingle()
    const current = data?.views_count || 0
    await supabase.from('story_output').update({ views_count: current + 1, updated_at: new Date().toISOString() }).eq('id', output_id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}

