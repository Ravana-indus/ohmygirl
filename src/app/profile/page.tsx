'use client'

import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase-browser'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [language, setLanguage] = useState<'tamil' | 'thanglish'>('tamil')
  const [tone, setTone] = useState('romantic')
  const [defaultReadMinutes, setDefaultReadMinutes] = useState<number>(5)
  const [tonePresets, setTonePresets] = useState<string>('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: session } = await supabase.auth.getSession()
        const user = session.session?.user
        if (!user) { setError('Please sign in to view your profile.'); setLoading(false); return }
        setEmail(user.email || '')
        const meta = (user.user_metadata || {}) as any
        setDisplayName(meta.display_name || '')
        setLanguage(meta.language === 'thanglish' ? 'thanglish' : 'tamil')
        setTone(meta.tone || 'romantic')
        setDefaultReadMinutes(Number.isFinite(meta.default_read_minutes) ? Number(meta.default_read_minutes) : 5)
        if (Array.isArray(meta.tone_presets)) setTonePresets(meta.tone_presets.join(', '))
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const save = async () => {
    try {
      setSavedMsg(null)
      const presets = tonePresets.split(',').map(s => s.trim()).filter(Boolean)
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName, language, tone, default_read_minutes: defaultReadMinutes, tone_presets: presets } })
      if (error) throw error
      setSavedMsg('Profile saved')
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile')
    }
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500">Email</label>
            <div className="mt-1 text-sm">{email}</div>
          </div>
          <div>
            <label className="block text-sm">Display name</label>
            <input className="mt-1 w-full border rounded-md p-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Preferred language</label>
              <select className="mt-1 w-full border rounded-md p-2" value={language} onChange={(e) => setLanguage(e.target.value as any)}>
                <option value="tamil">Tamil</option>
                <option value="thanglish">Thanglish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Preferred tone</label>
              <input className="mt-1 w-full border rounded-md p-2" value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Default story read time (minutes)</label>
              <input type="number" min={1} max={20} className="mt-1 w-full border rounded-md p-2" value={defaultReadMinutes} onChange={(e) => setDefaultReadMinutes(Math.min(20, Math.max(1, parseInt(e.target.value || '1'))))} />
            </div>
            <div>
              <label className="block text-sm">Tone presets (comma‑separated)</label>
              <input className="mt-1 w-full border rounded-md p-2" placeholder="romantic, spicy, playful" value={tonePresets} onChange={(e) => setTonePresets(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50">Save</button>
            <button onClick={signOut} className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50">Sign out</button>
            {savedMsg && <span className="text-xs text-gray-500">{savedMsg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
