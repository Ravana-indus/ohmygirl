'use client'

import { useEffect, useState, ChangeEvent } from 'react'
import supabase from '@/lib/supabase-browser'
import { RPChat } from '@/components/chat/rp-chat'
import { Button } from '@/components/ui/button'

interface CharacterSummary { id: string; name: string; role: string; traits: Record<string, any> }
interface SessionSummary { id: string; title: string; language: 'tamil' | 'thanglish'; created_at: string; characters: CharacterSummary[] }

const inputClass = 'w-full border rounded-md p-2 text-sm'

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', language: 'tamil' as 'tamil' | 'thanglish', userName: '', aiName: '' })
  const [showSessions, setShowSessions] = useState(false)
  const selected = sessions.find(s => s.id === selectedSessionId) || null
  const ai = selected?.characters.find(c => c.role === 'ai') as any
  const user = selected?.characters.find(c => c.role === 'user') as any

  const load = async () => {
    try {
      setLoadingSessions(true); setError(null)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in')
      const res = await fetch('/api/rp/sessions', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load sessions')
      setSessions(json.data || [])
      if (!selectedSessionId && json.data?.length) setSelectedSessionId(json.data[0].id)
    } catch (e: any) { setError(e?.message || 'Failed to load sessions') } finally { setLoadingSessions(false) }
  }

  useEffect(() => { load() }, [])

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in')
      const payload = {
        title: form.title || `${form.userName || 'You'} & ${form.aiName || 'AI'}`,
        language: form.language,
        user_character: { name: form.userName || 'You', role: 'user', traits: {} },
        ai_character: { name: form.aiName || 'AI Partner', role: 'ai', traits: {} }
      }
      const res = await fetch('/api/rp/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to create session')
      await load(); setSelectedSessionId(json.data?.id || null); setForm({ title: '', language: 'tamil', userName: '', aiName: '' })
    } catch (e: any) { setError(e?.message || 'Failed to create session') }
  }

  return (
    <div className="flex md:h-[calc(100vh-6rem)] h-auto overflow-hidden pb-24 md:pb-0">
      {/* sidebar (desktop) */}
      <aside className="hidden md:block w-72 border-r p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {loadingSessions ? <p className="text-sm text-gray-500">Loading…</p> : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button key={s.id} onClick={() => setSelectedSessionId(s.id)} className={`w-full text-left p-2 rounded border ${selectedSessionId === s.id ? 'border-black' : ''}`}>
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-gray-500">{s.language} · {new Date(s.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={createSession} className="space-y-2 border-t pt-3 mt-3">
          <h3 className="text-sm font-semibold">New Session</h3>
          <input className={inputClass} placeholder="Title" value={form.title} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            {(['tamil','thanglish'] as const).map(l => (
              <button type="button" key={l} className={`border rounded p-2 text-sm ${form.language===l ? 'border-black' : ''}`} onClick={() => setForm({ ...form, language: l })}>{l}</button>
            ))}
          </div>
          <input className={inputClass} placeholder="Your name" value={form.userName} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, userName: e.target.value })} />
          <input className={inputClass} placeholder="AI name" value={form.aiName} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, aiName: e.target.value })} />
          <Button>Create</Button>
        </form>
      </aside>

      <main className="flex-1 overflow-hidden relative">
        {/* Mobile toggles */}
        <div className="md:hidden border-b p-2 flex items-center justify-between">
          <button className="px-3 py-2 rounded-md border text-sm" onClick={() => setShowSessions(true)}>Sessions</button>
          <div className="text-xs text-gray-500">WhatsApp-style RP chat</div>
        </div>
        {selected && ai && user ? (
          <RPChat sessionId={selected.id} aiCharacter={ai} userCharacter={user} sessionLanguage={selected.language} onHistoryChanged={load} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">Select or create a session to start chatting.</div>
        )}
        {/* Mobile floating Sessions FAB to ensure discoverability */}
        <button
          type="button"
          onClick={() => setShowSessions(true)}
          className="md:hidden fixed bottom-24 right-4 z-40 px-4 py-2 rounded-full border bg-white/90 backdrop-blur text-sm shadow hover:bg-white dark:bg-neutral-800/90 dark:text-gray-100 dark:border-neutral-700"
        >
          Sessions
        </button>
      </main>

      {/* Mobile sessions drawer */}
      {showSessions && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowSessions(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-full bg-white p-4 space-y-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sessions</h2>
              <button className="text-sm underline" onClick={() => setShowSessions(false)}>Close</button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {loadingSessions ? <p className="text-sm text-gray-500">Loading…</p> : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button key={s.id} onClick={() => { setSelectedSessionId(s.id); setShowSessions(false) }} className={`w-full text-left p-2 rounded border ${selectedSessionId === s.id ? 'border-black' : ''}`}>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-gray-500">{s.language} · {new Date(s.created_at).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={createSession} className="space-y-2 border-t pt-3 mt-3">
              <h3 className="text-sm font-semibold">New Session</h3>
              <input className={inputClass} placeholder="Title" value={form.title} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                {(['tamil','thanglish'] as const).map(l => (
                  <button type="button" key={l} className={`border rounded p-2 text-sm ${form.language===l ? 'border-black' : ''}`} onClick={() => setForm({ ...form, language: l })}>{l}</button>
                ))}
              </div>
              <input className={inputClass} placeholder="Your name" value={form.userName} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, userName: e.target.value })} />
              <input className={inputClass} placeholder="AI name" value={form.aiName} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, aiName: e.target.value })} />
              <Button>Create</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
