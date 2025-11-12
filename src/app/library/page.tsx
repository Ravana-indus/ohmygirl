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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Public Library</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stories…"
            className="px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm dark:bg-neutral-900 dark:text-gray-100 dark:border-neutral-700"
          />
          <button className="text-sm px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={load}>Search</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-full overflow-x-auto whitespace-nowrap -mx-4 px-4">
          <button className={`inline-block mr-2 mb-2 px-2 py-1 text-xs rounded-full border ${!category ? 'bg-gray-100' : ''}`} onClick={() => setCategory('')}>All</button>
          {categories.map((c) => (
            <button key={c} className={`inline-block mr-2 mb-2 px-2 py-1 text-xs rounded-full border ${category === c ? 'bg-gray-100' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="border rounded-md px-2 py-1 border-gray-300 bg-white text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
          >
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((s) => {
            const content: string = s.content || ''
            const firstSentence = content.split(/\n|\.|!|\?/)[0]?.trim() || 'Untitled story'
            const excerpt = content.slice(firstSentence.length).trim().slice(0, 180)
            return (
              <article key={s.id} className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4 hover:shadow-sm transition bg-white dark:bg-neutral-900">
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-600 dark:text-gray-300">{new Date(s.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-gray-600 dark:text-gray-300">{s.language === 'tamil' ? 'Tamil' : 'Thanglish'} · {s.read_minutes || '?'} min</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700 dark:text-gray-200">⭐ {(s.rating_avg || 0).toFixed(1)} ({s.rating_count || 0})</span>
                    <span className="text-gray-700 dark:text-gray-200">👁 {s.views_count || 0}</span>
                  </div>
                </div>
                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 line-clamp-2">{firstSentence}</h3>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{excerpt || content.slice(0, 180)}</p>
                <div className="mt-3 flex items-center gap-3">
                  <a href={`/stories/${s.id}`} className="text-sm underline text-gray-900 dark:text-gray-100">Read</a>
                  <RateStars outputId={s.id} initialAvg={s.rating_avg || 0} initialCount={s.rating_count || 0} onUpdated={(avg, count) => { setItems(prev => prev.map(it => it.id === s.id ? { ...it, rating_avg: avg, rating_count: count } : it)) }} />
                </div>
              </article>
            )
          })}
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
