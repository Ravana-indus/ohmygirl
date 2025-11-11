import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mine = searchParams.get('mine')
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || ''
    const sort = searchParams.get('sort') || 'latest'

    if (mine) {
      // Return current user's outputs (requires auth)
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Missing authorization header' }, { status: 401 })
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 })

      const { data, error } = await supabase
        .from('story_output')
        .select('id, blueprint_id, content, language, read_minutes, created_at, is_published, story_blueprint!inner(user_id)')
        .eq('story_blueprint.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return NextResponse.json({ success: false, message: 'Failed to load list' }, { status: 500 })
      const sanitized = (data || []).map((o: any) => ({ id: o.id, blueprint_id: o.blueprint_id, content: o.content, language: o.language, read_minutes: o.read_minutes, is_published: o.is_published, created_at: o.created_at }))
      return NextResponse.json({ success: true, data: sanitized })
    }

    let query = supabase
      .from('story_output')
      .select('id, blueprint_id, content, language, read_minutes, created_at, views_count, rating_sum, rating_count, categories')
      .eq('is_published', true)
      .limit(200)

    if (q) query = query.ilike('content', `%${q}%`)
    if (category) query = query.contains('categories', [category])

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: 'Failed to load library' }, { status: 500 })

    const items = (data || []).map((s: any) => ({ ...s, rating_avg: s.rating_count ? s.rating_sum / s.rating_count : 0 }))
    const sorted = [...items].sort((a, b) => {
      if (sort === 'top') return (b.rating_avg - a.rating_avg) || (b.rating_count - a.rating_count)
      if (sort === 'views') return (b.views_count || 0) - (a.views_count || 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const categoriesSet = new Set<string>()
    sorted.forEach(s => (s.categories || []).forEach((c: string) => categoriesSet.add(c)))
    return NextResponse.json({ success: true, data: sorted, categories: Array.from(categoriesSet) })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}
