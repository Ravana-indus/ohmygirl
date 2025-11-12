'use client'

import supabase from '@/lib/supabase-browser'

interface Pack { usd: number; label: string; popular?: boolean }

const USD_TO_LKR = 320

const PACKS: Pack[] = [
  { usd: 5, label: 'Starter' },
  { usd: 10, label: 'Value', popular: true },
  { usd: 25, label: 'Pro' },
  { usd: 50, label: 'Unlimited (month)' },
]

export function CreditPackages({ compact = false }: { compact?: boolean }) {
  const onBuy = async (usd: number) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        // send to sign-in; back to wallet afterwards
        window.location.href = '/auth/signin'
        return
      }
      const res = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_usd: usd }),
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.url) throw new Error(json.message || 'Failed to start checkout')
      window.location.href = json.url
    } catch (e: any) {
      alert(e?.message || 'Failed to start checkout')
    }
  }

  return (
    <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'}>
      {PACKS.map((p) => {
        const lkr = p.usd * USD_TO_LKR
        return (
          <div key={p.usd} className={`border rounded-xl p-4 bg-white ${p.popular ? 'ring-2 ring-black' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{p.label}</div>
              {p.popular && <span className="text-[10px] uppercase px-2 py-0.5 border rounded-full">Popular</span>}
            </div>
            <div className="mt-2 text-2xl font-bold">${p.usd}</div>
            <div className="text-xs text-gray-500">≈ LKR {lkr.toLocaleString()}</div>
            <button onClick={() => onBuy(p.usd)} className="mt-3 w-full px-3 py-2 rounded-md border hover:bg-gray-50 text-sm">Buy credits</button>
          </div>
        )
      })}
    </div>
  )
}

