'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import supabase from '@/lib/supabase-browser'

export default function StoryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const search = useSearchParams()
  const [story, setStory] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/stories/get/${id}`, { headers })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load story')
      setStory(json.data)
      fetch('/api/stories/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ output_id: id }) })
    } catch (e: any) {
      setError(e?.message || 'Failed to load story')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (search?.get('continue') === '1') {
      // fire-and-forget; errors will show in error state
      handleContinue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const readSSE = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const handle = (block: string) => {
      const line = block.trim()
      if (!line.startsWith('data:')) return
      const payload = line.replace(/^data:\s*/, '')
      try {
        const json = JSON.parse(payload)
        if (json.type === 'content' && json.content) {
          setStory((prev: any) => prev ? { ...prev, content: (prev.content || '') + json.content } : prev)
        }
      } catch {}
    }
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        handle(buffer.slice(0, idx))
        buffer = buffer.slice(idx + 2)
        idx = buffer.indexOf('\n\n')
      }
    }
    if (buffer.trim()) handle(buffer)
  }

  const handleContinue = async () => {
    try {
      setContinuing(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in to continue the story.')
      const res = await fetch('/api/stories/continue', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ output_id: id, model_code: 'grok-4' }) })
      if (!res.ok || !res.body) throw new Error('Failed to continue story')
      await readSSE(res.body)
    } catch (e: any) {
      setError(e?.message || 'Failed to continue')
    } finally { setContinuing(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-6">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : story ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{new Date(story.created_at).toLocaleString()}</span>
              <span>•</span>
              <span>{story.language === 'tamil' ? 'Tamil' : 'Thanglish'} · {story.read_minutes || '?'} min</span>
              {Array.isArray(story.categories) && story.categories.length > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">{story.categories.map((c: string) => (<span key={c} className="px-2 py-0.5 rounded-full border">{c}</span>))}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>⭐ {(story.rating_avg || 0).toFixed(1)} ({story.rating_count || 0})</span>
              <span>👁 {story.views_count || 0}</span>
            </div>
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{story.content}</div>
          <div className="mt-4">
            <button className="px-3 py-2 text-sm rounded-md border hover:bg-gray-50" onClick={handleContinue} disabled={continuing}>{continuing ? 'Continuing…' : 'Continue story'}</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
