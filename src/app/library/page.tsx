'use client'

import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase-browser'

export default function LibraryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'latest' | 'top' | 'views'>('latest')
  const [categories, setCategories] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      if (sort) params.set('sort', sort)
      const res = await fetch(`/api/stories/library?${params.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load library')
      setItems(json.data || [])
      setCategories(json.categories || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { load() }, [sort])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Public Library</h1>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories…" className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm" />
          <button className="text-sm px-3 py-2 rounded-md border" onClick={load}>Search</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button className={`px-2 py-1 text-xs rounded-full border ${!category ? 'bg-gray-100' : ''}`} onClick={() => setCategory('')}>All</button>
        {categories.map((c) => (
          <button key={c} className={`px-2 py-1 text-xs rounded-full border ${category === c ? 'bg-gray-100' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Sort:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="border rounded-md px-2 py-1">
            <option value="latest">Latest</option>
            <option value="top">Top Rated</option>
            <option value="views">Most Viewed</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No stories published yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <article key={s.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{s.language === 'tamil' ? 'Tamil' : 'Thanglish'} · {s.read_minutes || '?'} min</span>
                  {Array.isArray(s.categories) && s.categories.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">{s.categories.map((c: string) => (<span key={c} className="px-2 py-0.5 rounded-full border">{c}</span>))}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span>⭐ {(s.rating_avg || 0).toFixed(1)} ({s.rating_count || 0})</span>
                  <span>👁 {s.views_count || 0}</span>
                </div>
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{s.content}</div>
              <div className="mt-3 flex items-center gap-3">
                <a href={`/stories/${s.id}`} className="text-sm underline">Read</a>
                <RateStars outputId={s.id} initialAvg={s.rating_avg || 0} initialCount={s.rating_count || 0} onUpdated={(avg, count) => { setItems(prev => prev.map(it => it.id === s.id ? { ...it, rating_avg: avg, rating_count: count } : it)) }} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function RateStars({ outputId, initialAvg, initialCount, onUpdated }: { outputId: string; initialAvg: number; initialCount: number; onUpdated: (avg: number, count: number) => void }) {
  const [avg, setAvg] = useState(initialAvg || 0)
  const [count, setCount] = useState(initialCount || 0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const submit = async (rating: number) => {
    try {
      setBusy(true)
      setErr(null)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in to rate.')
      const res = await fetch('/api/stories/rate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ output_id: outputId, rating }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to rate')
      const sum = json.data.rating_sum
      const cnt = json.data.rating_count
      const newAvg = cnt ? sum / cnt : 0
      setAvg(newAvg)
      setCount(cnt)
      onUpdated(newAvg, cnt)
    } catch (e: any) {
      setErr(e?.message || 'Failed to rate')
    } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4,5].map((n) => (
        <button key={n} onClick={() => submit(n)} disabled={busy} className={`h-5 w-5 ${n <= Math.round(avg) ? 'text-yellow-500' : 'text-gray-400'}`} aria-label={`Rate ${n}`}>★</button>
      ))}
      <span className="text-xs text-gray-500">{avg.toFixed(1)} ({count})</span>
      {err && <span className="text-xs text-red-500 ml-2">{err}</span>}
    </div>
  )
}

