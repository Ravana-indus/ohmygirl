'use client'

import { useEffect, useState } from 'react'
import { StoryComposer } from '@/components/story/story-composer'
import supabase from '@/lib/supabase-browser'

export default function StoriesPage() {
  const [generated, setGenerated] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blueprintMap, setBlueprintMap] = useState<Record<string, string>>({})
  const [myStories, setMyStories] = useState<any[]>([])
  const [loadingMyStories, setLoadingMyStories] = useState(false)
  const [serverBlueprints, setServerBlueprints] = useState<any[]>([])

  const refreshMyStories = async () => {
    try {
      setLoadingMyStories(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return setMyStories([])
      const res = await fetch('/api/stories/library?mine=list', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok && json.success) setMyStories(json.data || [])
    } finally { setLoadingMyStories(false) }
  }

  const loadServerBlueprints = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return setServerBlueprints([])
      const res = await fetch('/api/stories/blueprint', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const json = await res.json()
        if (json.success) setServerBlueprints(json.data || [])
      }
    } catch {}
  }

  useEffect(() => { refreshMyStories(); loadServerBlueprints() }, [])

  const persistBlueprint = async (blueprint: any) => {
    if (blueprintMap[blueprint.id]) return blueprintMap[blueprint.id]
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) throw new Error('Please sign in to save a blueprint.')
    const relationships = (blueprint.relationships || []).map((rel: any) => {
      const charA = blueprint.characters.find((c: any) => c.id === rel.a)
      const charB = blueprint.characters.find((c: any) => c.id === rel.b)
      return { a: charA?.name || rel.a, b: charB?.name || rel.b, relation_type: rel.relation_type || 'romantic', tension_level: rel.tension_level || 5 }
    })
    const payload = { situation: blueprint.situation, phase: blueprint.phase, read_minutes: blueprint.read_minutes, language: blueprint.language, tone: blueprint.tone || 'romantic', characters: (blueprint.characters || []).map((c: any) => ({ name: c.name, role: c.role, gender: c.gender, traits: c.traits || {} })), relationships }
    const res = await fetch('/api/stories/blueprint', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save blueprint')
    setBlueprintMap(prev => ({ ...prev, [blueprint.id]: json.blueprint_id }))
    return json.blueprint_id as string
  }

  const handleSaveBlueprint = async (blueprint: any) => { setError(null); try { await persistBlueprint(blueprint); await loadServerBlueprints() } catch (e: any) { setError(e?.message || 'Failed to save blueprint.') } }

  const readSSE = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader(); const decoder = new TextDecoder('utf-8'); let buffer=''; let content='';
    const process = (block: string) => { const lines = block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.replace(/^data:\s*/, '')); if (!lines.length) return; try { const json = JSON.parse(lines.join('\n').trim()); if (json.type==='content' && json.content) content+=json.content; if (json.type==='error') throw new Error(json.message||'Story generation failed') } catch {} }
    while(true){ const {done,value}=await reader.read(); if(done) break; buffer+=decoder.decode(value,{stream:true}); let idx=buffer.indexOf('\n\n'); while(idx!==-1){ process(buffer.slice(0,idx)); buffer=buffer.slice(idx+2); idx=buffer.indexOf('\n\n') } }
    if (buffer.trim()) process(buffer)
    return content.trim()
  }

  const handleGenerateStory = async (blueprint: any) => {
    setGenerated(''); setError(null); setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const blueprintServerId = await persistBlueprint(blueprint)
      const res = await fetch('/api/stories/generate', { method: 'POST', headers, body: JSON.stringify({ blueprint_id: blueprintServerId, model_code: 'grok-4' }) })
      if (!res.ok || !res.body) throw new Error('Failed to start story generation')
      const content = await readSSE(res.body)
      setGenerated(content || '... (no content)')
      await refreshMyStories()
    } catch (e: any) { setError(e?.message || 'Story generation failed.') } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-6">
      <StoryComposer initialBlueprints={serverBlueprints} onSaveBlueprint={handleSaveBlueprint} onGenerateStory={handleGenerateStory} />
      <div className="border rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
        {error ? (<span className="text-sm text-red-500">{error}</span>) : loading ? ('Generating story…') : (generated || 'Generated story will appear here.')}
      </div>
      <section className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">My Stories</h2><button className="text-xs underline" onClick={refreshMyStories} disabled={loadingMyStories}>{loadingMyStories ? 'Refreshing…' : 'Refresh'}</button></div>
        {myStories.length === 0 ? (<p className="text-sm text-gray-500">No stories yet.</p>) : (
          <div className="space-y-3">
            {myStories.map((s) => (
              <article key={s.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span className="truncate max-w-[50%]">{new Date(s.created_at).toLocaleString()}</span>
                  <span>{s.language === 'tamil' ? 'Tamil' : 'Thanglish'} · {s.read_minutes || '?'} min</span>
                </div>
                <div className="line-clamp-6 whitespace-pre-wrap text-sm md:text-base">{s.content}</div>
                <div className="mt-2 flex items-center gap-2">
                  <a className="px-2 py-1 rounded-md text-xs border hover:bg-gray-50" href={`/stories/${s.id}`}>Read</a>
                  <a className="px-2 py-1 rounded-md text-xs border hover:bg-gray-50" href={`/stories/${s.id}?continue=1`}>Continue</a>
                  <PublishButtons outputId={s.id} initial={!!s.is_published} onChanged={refreshMyStories} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PublishButtons({ outputId, initial, onChanged }: { outputId: string; initial: boolean; onChanged: () => void }) {
  const [isPublished, setIsPublished] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const toggle = async () => {
    try {
      setBusy(true)
      setMsg(null)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in to update publish state.')
      const res = await fetch('/api/stories/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ output_id: outputId, publish: !isPublished }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update')
      setIsPublished(json.data?.is_published)
      onChanged()
    } catch (e: any) { setMsg(e?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <button className="px-2 py-1 rounded-md text-xs border hover:bg-gray-50" onClick={toggle} disabled={busy}>{busy ? 'Updating…' : isPublished ? 'Unpublish' : 'Publish'}</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
}
