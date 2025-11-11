import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { output_id, rating } = await request.json()
    if (!output_id || !rating || rating < 1 || rating > 5) return NextResponse.json({ success: false, message: 'Invalid rating payload' }, { status: 400 })
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
    const token = authHeader.substring(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

    const { data: existing } = await supabase.from('story_rating').select('id, rating').eq('output_id', output_id).eq('user_id', user.id).maybeSingle()
    if (existing) {
      await supabase.from('story_rating').update({ rating, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('story_rating').insert({ output_id, user_id: user.id, rating })
    }

    const { data: agg } = await supabase.from('story_rating').select('rating').eq('output_id', output_id)
    const ratings = (agg || []).map((r: any) => r.rating)
    const sum = ratings.reduce((a, b) => a + b, 0)
    const count = ratings.length
    await supabase.from('story_output').update({ rating_sum: sum, rating_count: count, updated_at: new Date().toISOString() }).eq('id', output_id)

    return NextResponse.json({ success: true, data: { rating_sum: sum, rating_count: count } })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}

