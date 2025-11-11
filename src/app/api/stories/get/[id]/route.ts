import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const runtime = 'edge'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { data: story, error } = await supabase
      .from('story_output')
      .select('id, blueprint_id, content, language, read_minutes, created_at, is_published, views_count, rating_sum, rating_count, categories, story_blueprint!inner(user_id)')
      .eq('id', id)
      .maybeSingle()

    if (error || !story) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })

    if (!story.is_published) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user || story.story_blueprint.user_id !== user.id) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const payload = {
      id: story.id,
      content: story.content,
      language: story.language,
      read_minutes: story.read_minutes,
      created_at: story.created_at,
      is_published: story.is_published,
      views_count: story.views_count,
      rating_sum: story.rating_sum,
      rating_count: story.rating_count,
      rating_avg: story.rating_count ? story.rating_sum / story.rating_count : 0,
      categories: story.categories || [],
    }
    return NextResponse.json({ success: true, data: payload })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal server error' }, { status: 500 })
  }
}

